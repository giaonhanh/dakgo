/**
 * Processor chính — tích hợp 13 layers theo spec DakGo AI
 *
 * Fix v2:
 * - Conversation history → Groq hiểu ngữ cảnh đại từ
 * - Item removal/decrease (qty=0)
 * - Giá ước tính trong confirmation summary
 * - Nhớ phone qua đơn tiếp theo
 * - Reorder từ đơn cũ
 * - Resume session sau idle dài
 * - VietMap geocoding (geo.ts)
 */

import { guard, sanitizeReply } from "./guard"
import { extractAndReply, INTENT_MAP, type ChatTurn } from "./extractor"
import { detectServiceType, checkServiceAvailable } from "./service-check"
import {
  buildShopCards,
  type BotResponse, type FBButton, type TextWithWebviewResponse, type ButtonTemplateResponse, type ReceiptTemplateResponse,
  QR_SERVICE_MENU, QR_LOCATION, QR_CONFIRM_CANCEL, QR_PAYMENT,
  QR_ORDER_ACTION, QR_RESUME, makeConfirmButtons,
} from "./cards"
import { saveMessage, logBlocked, saveKeyword, getKeyword, getConversation, getLastUserMessageTime } from "./storage"
import {
  getSession, saveSession, resetSession, mergeData,
  getMissingFields, getNextMissingField,
  buildConfirmationSummary, isConfirmation, isCorrection,
  isEscalationRequest, isReorderRequest,
  FIELD_QUESTION,
  type BotSession, type CollectedData,
} from "./session"
import { createOrder } from "./order-creator"
import { geocodeAddress, tryGeocodeAddress, distanceKm, reverseGeocode } from "./geo"
import { getPricing, calcFee, type ServiceType } from "./pricing"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// ─── Rate limit (in-memory) ────────────────────────────────────────────────────

const RATE_LIMIT = 5
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(id: string): boolean {
  const now = Date.now()
  const ts  = (rateLimitMap.get(id) ?? []).filter(t => now - t < 60_000)
  ts.push(now)
  rateLimitMap.set(id, ts)
  return ts.length > RATE_LIMIT
}

function db() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Shop search by name ──────────────────────────────────────────────────────

async function searchShopByName(name: string): Promise<{ id: string; name: string } | null> {
  try {
    const { data } = await db()
      .from("shops")
      .select("id, name")
      .eq("status", "approved")
      .ilike("name", `%${name}%`)
      .limit(1)
      .maybeSingle()
    return data ?? null
  } catch { return null }
}

// ─── Price estimation ──────────────────────────────────────────────────────────

async function getShopCoordsById(shopId: string): Promise<{ lat: number; lng: number } | null> {
  const { data } = await db().from("shops").select("location").eq("id", shopId).single()
  if (!data?.location) return null
  const geo = data.location as { coordinates?: [number, number] }
  if (!geo.coordinates) return null
  const [lng, lat] = geo.coordinates
  return { lat, lng }
}

async function estimatePrice(intent: string, data: CollectedData): Promise<Partial<CollectedData>> {
  try {
    const pricing = await getPricing()
    if (!pricing) return {}

    switch (intent) {
      case "food_order": {
        const subtotal = (data.items ?? []).reduce((s, i) => s + i.price * i.qty, 0)
        let shipFee    = 15000
        if (data.shop_id && (data.delivery_address || (data.delivery_lat && data.delivery_lng))) {
          const shopCoords = await getShopCoordsById(data.shop_id)
          const delivery   = (data.delivery_lat && data.delivery_lng)
            ? { lat: data.delivery_lat, lng: data.delivery_lng }
            : await geocodeAddress(data.delivery_address!)
          if (shopCoords) {
            const km = distanceKm(shopCoords, delivery)
            shipFee  = calcFee(Math.max(km, 1), "food" as ServiceType, pricing)
          }
        }
        const total = subtotal + shipFee
        return {
          estimated_subtotal: subtotal > 0 ? subtotal : undefined,
          estimated_ship_fee: shipFee,
          estimated_total:    total > 0 ? total : undefined,
        }
      }

      case "motorbike":
      case "taxi":
      case "taxi7": {
        const pickupAddr  = data.pickup_address
        const dropoffAddr = data.dropoff_address
        if (!pickupAddr || !dropoffAddr) return {}
        const [pickup, dropoff] = await Promise.all([
          (data.pickup_lat && data.pickup_lng)
            ? { lat: data.pickup_lat, lng: data.pickup_lng }
            : geocodeAddress(pickupAddr),
          (data.dropoff_lat && data.dropoff_lng)
            ? { lat: data.dropoff_lat, lng: data.dropoff_lng }
            : geocodeAddress(dropoffAddr),
        ])
        const km  = distanceKm(pickup, dropoff)
        const svc = intent === "motorbike" ? "motorbike" : "taxi"
        return { estimated_total: calcFee(Math.max(km, 1), svc as ServiceType, pricing) }
      }

      case "deliver_for_me":
      case "buy_for_me": {
        if (!data.pickup_address || !data.delivery_address) return {}
        const [pickup, delivery] = await Promise.all([
          (data.pickup_lat && data.pickup_lng)
            ? { lat: data.pickup_lat, lng: data.pickup_lng }
            : geocodeAddress(data.pickup_address),
          (data.delivery_lat && data.delivery_lng)
            ? { lat: data.delivery_lat, lng: data.delivery_lng }
            : geocodeAddress(data.delivery_address),
        ])
        const km     = distanceKm(pickup, delivery)
        const svc    = intent === "deliver_for_me" ? "delivery_pkg" : "errand"
        const svcFee = calcFee(Math.max(km, 1), svc as ServiceType, pricing)
        return {
          estimated_service_fee: svcFee,
          estimated_total: svcFee + (data.estimated_items_cost ?? 0),
        }
      }
      default: return {}
    }
  } catch (e) {
    console.warn("[processor] estimatePrice error:", (e as Error).message?.slice(0, 60))
    return {}
  }
}

// ─── Reorder từ đơn cũ ────────────────────────────────────────────────────────

async function loadLastOrder(phone: string): Promise<CollectedData | null> {
  try {
    const { data: profile } = await db()
      .from("profiles").select("id").eq("phone", phone).maybeSingle()
    if (!profile?.id) return null

    const { data: order } = await db()
      .from("orders")
      .select(`
        id, shop_id, delivery_address, delivery_lat, delivery_lng, note, payment_method,
        shops!inner(name),
        order_items(product_id, name, price, quantity)
      `)
      .eq("customer_id", profile.id)
      .eq("status", "delivered")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!order) return null

    const shopRow  = (order.shops as unknown as { name: string })
    const itemRows = (order.order_items as Array<{ product_id: string; name: string; price: number; quantity: number }>)

    return {
      shop_id:          order.shop_id,
      shop_name:        shopRow?.name,
      items:            itemRows?.map(i => ({ product_id: i.product_id, name: i.name, price: i.price, qty: i.quantity })) ?? [],
      delivery_address: order.delivery_address,
      delivery_lat:     order.delivery_lat,
      delivery_lng:     order.delivery_lng,
      note:             order.note ?? undefined,
      payment_method:   order.payment_method,
      phone,
    }
  } catch (e) {
    console.warn("[processor] loadLastOrder error:", (e as Error).message?.slice(0, 60))
    return null
  }
}

// ─── Menu cards helper ─────────────────────────────────────────────────────────

async function buildMenuCards(shopId: string, shopName: string): Promise<BotResponse> {
  const { data: products } = await db()
    .from("products")
    .select("id, name, description, image_url, price, original_price")
    .eq("shop_id", shopId)
    .eq("is_available", true)
    .order("sort_order", { ascending: true })
    .limit(10)

  if (!products?.length) {
    return { type: "text", content: `😔 Quán ${shopName} chưa cập nhật menu. Nhắn tên món muốn đặt nhé!` }
  }

  return {
    type:  "cards",
    intro: `🍽️ Menu **${shopName}** — chọn món nhé!`,
    elements: products.map(p => ({
      title:     p.name,
      subtitle:  p.description?.slice(0, 80) ?? `${(p.price / 1000).toFixed(0)}k`,
      image_url: p.image_url ?? undefined,
      buttons: [{
        type:    "postback" as const,
        title:   `🛒 Chọn — ${(p.price / 1000).toFixed(0)}k`,
        payload: `CHOOSE_PRODUCT:${shopId}:${encodeURIComponent(shopName)}:${p.id}:${encodeURIComponent(p.name)}:${p.price}`,
      }],
    })),
  }
}

// ─── L4: Ask next missing field ────────────────────────────────────────────────

async function askNextField(session: BotSession, aiReply?: string): Promise<BotResponse> {
  const { intent, collected_data, sender_id } = session
  if (!intent) {
    const msg = "Bạn cần dịch vụ gì ạ? 😊\n🍜 Đồ ăn · 📦 Giao hộ · 🛒 Mua hộ · 🛵 Xe ôm · 🚕 Taxi"
    await saveMessage(sender_id, "model", msg)
    return { type: "text", content: msg }
  }

  const nextField = getNextMissingField(intent, collected_data)

  if (!nextField) {
    // Tất cả field đủ → chuyển sang confirming với button template
    return transitionToConfirming(session)
  }

  // Food + cần shop_id nhưng đã có shop_name → auto-search
  if (nextField === "shop_id" && intent === "food_order" && collected_data.shop_name) {
    const found = await searchShopByName(collected_data.shop_name)
    if (found) {
      const newData = mergeData(collected_data, { shop_id: found.id, shop_name: found.name })
      await saveSession(sender_id, { collected_data: newData })
      return buildMenuCards(found.id, found.name)
    }
    // Không tìm thấy → search cards
    return buildShopCards(collected_data.shop_name, 0)
  }

  // Food + cần items + đã có shop → show menu cards
  if (nextField === "items" && intent === "food_order" && collected_data.shop_id) {
    return buildMenuCards(collected_data.shop_id, collected_data.shop_name ?? "quán")
  }

  // Câu hỏi theo context intent (taxi khác food)
  const INTENT_OVERRIDE: Partial<Record<string, Partial<Record<keyof CollectedData, string>>>> = {
    motorbike: { pickup_address: "Bạn đang ở đâu? Mình đến đón nhé! 📍", dropoff_address: "Bạn muốn đến đâu ạ? 🏁" },
    taxi:      { pickup_address: "Bạn đang ở đâu? Mình đón bạn nhé! 📍", dropoff_address: "Bạn muốn đến đâu ạ? 🏁" },
    taxi7:     { pickup_address: "Bạn đang ở đâu? Mình đến đón nhé! 📍", dropoff_address: "Bạn muốn đến đâu ạ? 🏁" },
    deliver_for_me: { pickup_address: "Lấy hàng ở đâu vậy bạn? 📍", delivery_address: "Giao đến địa chỉ nào? 🏠" },
    buy_for_me:     { pickup_address: "Mua ở đâu vậy bạn? (chợ/siêu thị) 📍", delivery_address: "Giao về địa chỉ nào? 🏠" },
  }
  const intentQ = intent ? (INTENT_OVERRIDE[intent]?.[nextField]) : undefined
  // Ưu tiên: intent-specific > FIELD_QUESTION > aiReply > fallback
  const reply = sanitizeReply(intentQ || FIELD_QUESTION[nextField] || aiReply?.trim() || "Bạn cho mình biết thêm nhé 😊")

  // Địa chỉ → quick reply "Chia sẻ vị trí" + nút webview bản đồ
  if (nextField === "delivery_address" || nextField === "pickup_address" || nextField === "dropoff_address") {
    const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dakgo.com"
    const addressUrl = `${appUrl}/bot-address?sid=${sender_id}`
    await saveMessage(sender_id, "model", reply)
    return {
      type:         "text_with_webview",
      content:      reply,
      buttonTitle:  "🗺️ Chọn trên bản đồ",
      url:          addressUrl,
      quick_replies: QR_LOCATION,  // chip "📍 Chia sẻ vị trí" + "✏️ Tôi tự nhập"
    } as TextWithWebviewResponse
  }

  // Phương thức thanh toán → quick reply chips
  if (nextField === "payment_method") {
    await saveMessage(sender_id, "model", reply)
    return { type: "text", content: reply, quick_replies: QR_PAYMENT }
  }

  await saveMessage(sender_id, "model", reply)
  return { type: "text", content: reply }
}

// ─── Transition sang confirming (có tính giá, có button template) ─────────────

async function transitionToConfirming(session: BotSession): Promise<BotResponse> {
  const priceHints = await estimatePrice(session.intent!, session.collected_data)
  const enriched   = { ...session.collected_data, ...priceHints }
  await saveSession(session.sender_id, { state: "confirming", collected_data: enriched })
  const summary = buildConfirmationSummary(session.intent!, enriched)
  await saveMessage(session.sender_id, "model", summary)
  // Button Template — nút xác nhận + sửa to, rõ ràng hơn text
  return {
    type:    "button_template",
    text:    summary.slice(0, 640), // Messenger giới hạn 640 chars
    buttons: makeConfirmButtons(session.intent!),
  } as ButtonTemplateResponse
}

// ─── Success message ───────────────────────────────────────────────────────────

function buildSuccessMsg(intent: string, displayId: string, data?: CollectedData): BotResponse {
  // Đồ ăn → Receipt Template (hóa đơn đẹp)
  if (intent === "food_order" && data?.items?.length) {
    const elements = data.items.map(it => ({
      title:    it.name,
      quantity: it.qty,
      price:    it.price * it.qty,
    }))
    const subtotal     = data.estimated_subtotal ?? data.items.reduce((s, i) => s + i.price * i.qty, 0)
    const shipping     = data.estimated_ship_fee ?? 15000
    const total        = data.estimated_total ?? (subtotal + shipping)
    const payLabel: Record<string, string> = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", momo: "MoMo", wallet: "Ví DakGo" }

    return {
      type:            "receipt_template",
      recipient_name:  data.customer_name ?? "Khách hàng",
      order_number:    displayId,
      payment_method:  payLabel[data.payment_method ?? "cash"] ?? "Tiền mặt",
      elements,
      subtotal,
      shipping_cost:   shipping,
      total_cost:      total,
      delivery_address: data.delivery_address,
      timestamp:       Math.floor(Date.now() / 1000),
    } as ReceiptTemplateResponse
  }

  // Xe ôm / Taxi / Giao hộ → text đẹp
  const ICON: Record<string, string> = {
    food_order: "🍜", deliver_for_me: "📦", buy_for_me: "🛒",
    motorbike: "🛵", taxi: "🚕", taxi7: "🚕",
  }
  const LABEL: Record<string, string> = {
    food_order: "Đặt đồ ăn", deliver_for_me: "Giao hộ",
    buy_for_me: "Mua hộ", motorbike: "Xe ôm", taxi: "Taxi 4 chỗ", taxi7: "Taxi 7 chỗ",
  }
  const icon = ICON[intent] ?? "✅"
  const svc  = LABEL[intent] ?? "Dịch vụ"
  const fmt  = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ"

  const lines = [
    `${icon} ĐẶT THÀNH CÔNG!`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `🧾 Mã đơn : #${displayId}`,
    `📋 Dịch vụ: ${svc}`,
  ]

  if (data) {
    if (data.pickup_address)  lines.push(`📍 Đón tại : ${data.pickup_address}`)
    if (data.dropoff_address) lines.push(`🏁 Đến     : ${data.dropoff_address}`)
    if (data.delivery_address && !data.pickup_address)
      lines.push(`📍 Giao đến: ${data.delivery_address}`)
    if (data.estimated_total) lines.push(`💰 Giá     : ~${fmt(data.estimated_total)}`)
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━`)
  lines.push(`🛵 Tài xế sẽ liên hệ bạn sớm!`)
  lines.push(`🙏 Cảm ơn bạn đã dùng DakGo`)

  return { type: "text", content: lines.join("\n"), quick_replies: QR_ORDER_ACTION }
}

// ─── Kiểm tra địa chỉ có thể geocode không ────────────────────────────────────
// Phước An (có số nhà + tên đường) → geocode được
// Xã / buôn / thôn → không có địa chỉ số → yêu cầu chọn map
function isGeocodable(addr: string): boolean {
  const lower = addr.toLowerCase()

  // Buôn / thôn / làng / ấp → địa chỉ dân tộc/nông thôn, không geocode được
  if (/(buôn[\s,]|bon[\s,]|thôn[\s,]|làng[\s,]|ấp[\s,]|xóm[\s,])/.test(lower)) return false

  // "xã [tên]" mà không phải Phước An → xã lân cận
  if (/\bxã\b/.test(lower) && !/phước\s*an/i.test(lower)) return false

  // Không có chữ số nào → thiếu số nhà / km cụ thể
  if (!/\d/.test(addr)) return false

  return true
}

// ─── processPostback ──────────────────────────────────────────────────────────

export async function processPostback(senderId: string, payload: string): Promise<BotResponse> {
  const session = await getSession(senderId)

  // ── Show service menu (từ persistent menu) ────────────────────────────────
  if (payload === "SHOW_MENU") {
    const msg = "Bạn cần dịch vụ gì ạ? 😊"
    await saveMessage(senderId, "model", msg)
    return { type: "text", content: msg, quick_replies: QR_SERVICE_MENU }
  }

  // ── Get Started (lần đầu mở chat) ─────────────────────────────────────────
  if (payload === "GET_STARTED") {
    await resetSession(senderId)
    const welcome = "Chào mừng bạn đến DakGo! 🎉\nMình phục vụ tại Phước An, Krông Pắc 📍\n\nBạn cần dịch vụ gì ạ?"
    await saveMessage(senderId, "model", welcome)
    return { type: "text", content: welcome, quick_replies: QR_SERVICE_MENU }
  }

  // ── Đặt lại đơn cũ từ persistent menu ──────────────────────────────────────
  if (payload === "REORDER") {
    await saveMessage(senderId, "user", "[Đặt lại đơn cũ]")
    return processMessage(senderId, "đặt lại như hôm qua")
  }

  // ── Quick Reply service selection ──────────────────────────────────────────
  if (payload.startsWith("SERVICE:")) {
    const svc = payload.slice(8)
    type SvcKey = "food" | "motorbike" | "taxi" | "taxi7" | "mua_ho" | "giao_ho"
    const intentMap: Record<string, string> = {
      food: "food_order", deliver_for_me: "deliver_for_me",
      buy_for_me: "buy_for_me", motorbike: "motorbike", taxi: "taxi", taxi7: "taxi7",
    }
    const svcKeyMap: Record<string, SvcKey> = {
      food: "food", deliver_for_me: "giao_ho", buy_for_me: "mua_ho",
      motorbike: "motorbike", taxi: "taxi", taxi7: "taxi7",
    }
    const labelMap: Record<string, string> = {
      food: "🍜 Đặt đồ ăn", deliver_for_me: "📦 Giao hộ", buy_for_me: "🛒 Mua hộ",
      motorbike: "🛵 Xe ôm", taxi: "🚕 Taxi", taxi7: "🚕 Taxi 7 chỗ",
    }
    const intent = intentMap[svc]
    if (!intent) return { type: "text", content: "Dịch vụ không hợp lệ 😅", quick_replies: QR_SERVICE_MENU }

    const initData = session.collected_data.phone ? { phone: session.collected_data.phone } : {}

    // ── Đồ ăn: show tất cả quán đang mở ─────────────────────────────────────
    if (svc === "food") {
      const status = await checkServiceAvailable("food")
      if (!status.available) {
        const msg = status.customerMsg ?? "Dịch vụ tạm thời chưa hoạt động bạn ơi 😔"
        await saveMessage(senderId, "model", msg)
        return { type: "text", content: msg, quick_replies: QR_SERVICE_MENU }
      }
      await saveMessage(senderId, "user", `[${labelMap.food}]`)
      await saveSession(senderId, { state: "collecting", intent: "food_order", collected_data: initData, confusion_count: 0 })
      const cards = await buildShopCards("", 0)
      if (cards?.elements && cards.elements.length > 0) return cards
      const msg = "🍜 Bạn muốn ăn gì? Nhắn tên món hoặc tên quán nhé!"
      await saveMessage(senderId, "model", msg)
      return { type: "text", content: msg }
    }

    // ── Taxi: chọn loại xe 4 chỗ hoặc 7 chỗ ─────────────────────────────────
    if (svc === "taxi") {
      const [status4, status7] = await Promise.all([
        checkServiceAvailable("taxi"),
        checkServiceAvailable("taxi7"),
      ])
      const taxiBtns: FBButton[] = []
      if (status4.available) taxiBtns.push({ type: "postback", title: "🚕 Taxi 4 chỗ", payload: "TAXI_TYPE:taxi" })
      if (status7.available) taxiBtns.push({ type: "postback", title: "🚐 Taxi 7 chỗ", payload: "TAXI_TYPE:taxi7" })

      await saveMessage(senderId, "user", "[🚕 Taxi]")

      if (taxiBtns.length === 0) {
        const msg = status4.customerMsg ?? "😔 Taxi hiện đang kín. Bạn thử Xe ôm nhé!"
        await saveMessage(senderId, "model", msg)
        return { type: "text", content: msg, quick_replies: QR_SERVICE_MENU }
      }

      await saveSession(senderId, { state: "collecting", intent: "taxi", collected_data: initData, confusion_count: 0 })

      // Chỉ còn 1 loại → đi thẳng
      if (taxiBtns.length === 1) {
        const tType = taxiBtns[0].payload!.replace("TAXI_TYPE:", "")
        await saveSession(senderId, { intent: tType })
        return askNextField({ ...session, state: "collecting" as const, intent: tType, collected_data: initData })
      }

      const msg = "Bạn muốn đặt taxi mấy chỗ ạ? 🚕"
      await saveMessage(senderId, "model", msg)
      return { type: "button_template", text: msg, buttons: taxiBtns } as ButtonTemplateResponse
    }

    // ── Các dịch vụ còn lại ───────────────────────────────────────────────────
    const svcKey = svcKeyMap[svc]
    if (svcKey) {
      const status = await checkServiceAvailable(svcKey)
      if (!status.available) {
        const msg = status.customerMsg ?? "Dịch vụ tạm thời chưa hoạt động bạn ơi 😔"
        await saveMessage(senderId, "user", `[${labelMap[svc] ?? svc}]`)
        await saveMessage(senderId, "model", msg)
        return { type: "text", content: msg, quick_replies: QR_SERVICE_MENU }
      }
    }

    await saveMessage(senderId, "user", `[${labelMap[svc] ?? svc}]`)
    await saveSession(senderId, { state: "collecting", intent, collected_data: initData, confusion_count: 0 })
    return askNextField({ ...session, state: "collecting" as const, intent, collected_data: initData })
  }

  // ── Chọn loại taxi ─────────────────────────────────────────────────────────
  if (payload.startsWith("TAXI_TYPE:")) {
    const tType  = payload.slice(10)   // "taxi" hoặc "taxi7"
    const svcKey = (tType === "taxi7" ? "taxi7" : "taxi") as Parameters<typeof checkServiceAvailable>[0]
    const status = await checkServiceAvailable(svcKey)
    if (!status.available) {
      const seats = tType === "taxi7" ? "7 chỗ" : "4 chỗ"
      const msg   = status.customerMsg ?? `😔 Taxi ${seats} hiện chưa hoạt động. Bạn chọn loại khác không?`
      await saveMessage(senderId, "model", msg)
      return { type: "text", content: msg }
    }
    const taxiLabel = tType === "taxi7" ? "🚐 Taxi 7 chỗ" : "🚕 Taxi 4 chỗ"
    await saveMessage(senderId, "user", `[Chọn: ${taxiLabel}]`)
    const initData = session.collected_data.phone ? { phone: session.collected_data.phone } : {}
    await saveSession(senderId, { state: "collecting", intent: tType, collected_data: initData, confusion_count: 0 })
    return askNextField({ ...session, state: "collecting" as const, intent: tType, collected_data: initData })
  }

  // ── Xác nhận / Sửa đơn hàng ───────────────────────────────────────────────
  if (payload === "CONFIRM_ORDER") {
    await saveMessage(senderId, "user", "[Xác nhận đơn]")
    return processMessage(senderId, "đúng rồi")
  }
  if (payload === "EDIT_ORDER") {
    await saveMessage(senderId, "user", "[Sửa đơn]")
    await saveSession(senderId, { state: "collecting" })
    const msg = "Bạn muốn sửa thông tin gì ạ? 😊"
    await saveMessage(senderId, "model", msg)
    return { type: "text", content: msg }
  }

  // ── Thanh toán ─────────────────────────────────────────────────────────────
  if (payload.startsWith("PAYMENT:")) {
    const method = payload.slice(8)  // cash | bank_transfer | momo
    const label: Record<string, string> = {
      cash:          "💵 Tiền mặt",
      bank_transfer: "🏦 Chuyển khoản",
      momo:          "💙 MoMo",
    }
    await saveMessage(senderId, "user", `[Chọn: ${label[method] ?? method}]`)
    const newData = mergeData(session.collected_data, { payment_method: method })
    await saveSession(senderId, { collected_data: newData })
    const updatedSession = { ...session, collected_data: newData }
    const missing = session.intent ? getMissingFields(session.intent, newData) : []
    if (missing.length === 0 && session.intent) {
      return transitionToConfirming(updatedSession)
    }
    return askNextField(updatedSession)
  }

  // ── Xác nhận vị trí ───────────────────────────────────────────────────────
  if (payload === "LOC_CONFIRMED") {
    await saveMessage(senderId, "user", "[Xác nhận vị trí]")
    return processMessage(senderId, "đúng rồi")
  }
  if (payload === "LOC_RETRY") {
    await saveMessage(senderId, "user", "[Thay đổi địa chỉ]")
    // Xóa địa chỉ vừa nhận, hỏi lại
    const target = resolveLocationTarget(session.intent, session.collected_data)
    const cleaned = { ...session.collected_data }
    delete (cleaned as Record<string, unknown>)[target.addr]
    delete (cleaned as Record<string, unknown>)[target.lat]
    delete (cleaned as Record<string, unknown>)[target.lng]
    await saveSession(senderId, { collected_data: cleaned })
    return askNextField({ ...session, collected_data: cleaned })
  }

  // ── Session resume ─────────────────────────────────────────────────────────
  if (payload === "DONE_ORDERING") {
    await saveMessage(senderId, "user", "[Xong, đặt]")
    return askNextField(session)
  }
  if (payload === "CONTINUE_SESSION") {
    await saveMessage(senderId, "user", "[Tiếp tục đặt]")
    return askNextField(session)
  }
  if (payload === "NEW_ORDER") {
    await resetSession(senderId)
    const msg = "Bạn cần dịch vụ gì ạ? 😊"
    await saveMessage(senderId, "model", msg)
    return { type: "text", content: msg, quick_replies: QR_SERVICE_MENU }
  }
  if (payload === "ESCALATE") {
    await saveSession(senderId, { state: "escalated" })
    const msg = "Mình đã ghi nhận! 🙏\nNhân viên DakGo sẽ liên hệ bạn sớm.\n📞 Hotline: 0900 000 000"
    await saveMessage(senderId, "model", msg)
    return { type: "text", content: msg }
  }
  if (payload === "TYPE_ADDRESS") {
    // User chọn tự gõ địa chỉ thay vì share GPS
    const msg = "Bạn gõ địa chỉ vào đây nhé! 📝\n(Ví dụ: 55 Nguyễn Chí Thanh, Phước An)"
    await saveMessage(senderId, "model", msg)
    return { type: "text", content: msg }
  }

  // ── Shop / Product selection ───────────────────────────────────────────────
  if (payload.startsWith("ORDER_SHOP:")) {
    const parts    = payload.split(":")
    const shopId   = parts[1]
    const shopName = decodeURIComponent(parts.slice(2).join(":"))
    const newData  = mergeData(session.collected_data, { shop_id: shopId, shop_name: shopName })
    await saveSession(senderId, { state: "collecting", intent: "food_order", collected_data: newData })
    await saveMessage(senderId, "user", `[Chọn quán: ${shopName}]`)
    return buildMenuCards(shopId, shopName)
  }

  if (payload.startsWith("CHOOSE_PRODUCT:")) {
    const parts       = payload.split(":")
    const shopId      = parts[1]
    const shopName    = decodeURIComponent(parts[2])
    const productId   = parts[3]
    const productName = decodeURIComponent(parts[4])
    const price       = parseInt(parts[5])

    const existing = session.collected_data.items ?? []
    const idx      = existing.findIndex(i => i.product_id === productId)
    const items    = idx >= 0
      ? existing.map((it, i) => i === idx ? { ...it, qty: it.qty + 1 } : it)
      : [...existing, { product_id: productId, name: productName, qty: 1, price }]

    const newData = mergeData(session.collected_data, { shop_id: shopId, shop_name: shopName, items })
    await saveSession(senderId, { state: "collecting", intent: "food_order", collected_data: newData })
    await saveMessage(senderId, "user", `[Chọn: ${productName} × 1 — ${(price / 1000).toFixed(0)}k]`)

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
    const text     = `✅ ${productName} ×1 thêm vào giỏ!\n🛒 Tổng giỏ: ${(subtotal / 1000).toFixed(0)}k`
    await saveMessage(senderId, "model", text)
    return {
      type: "text", content: text,
      quick_replies: [
        { content_type: "text", title: "✅ Xong, đặt",    payload: "DONE_ORDERING" },
        { content_type: "text", title: "🍽️ Thêm món",     payload: `VIEW_MENU:${shopId}:${encodeURIComponent(shopName)}` },
      ],
    }
  }

  if (payload.startsWith("VIEW_MENU:")) {
    const parts    = payload.split(":")
    const shopId   = parts[1]
    const shopName = decodeURIComponent(parts.slice(2).join(":"))
    return buildMenuCards(shopId, shopName)
  }

  return { type: "text", content: "Bạn cần hỗ trợ gì không? 😊", quick_replies: QR_SERVICE_MENU }
}

// ─── processLocation ──────────────────────────────────────────────────────────

// Map intent + trạng thái hiện tại → field nào cần lưu khi share vị trí
function resolveLocationTarget(intent: string | null, data: CollectedData): {
  lat: keyof CollectedData; lng: keyof CollectedData
  addr: keyof CollectedData; label: string
} {
  switch (intent) {
    case "motorbike": case "taxi": case "taxi7":
      if (!data.pickup_lat && !data.pickup_address)
        return { lat: "pickup_lat", lng: "pickup_lng", addr: "pickup_address", label: "điểm đón" }
      return { lat: "dropoff_lat", lng: "dropoff_lng", addr: "dropoff_address", label: "điểm đến" }

    case "deliver_for_me": case "buy_for_me":
      if (!data.pickup_lat && !data.pickup_address)
        return { lat: "pickup_lat", lng: "pickup_lng", addr: "pickup_address", label: "điểm lấy hàng" }
      return { lat: "delivery_lat", lng: "delivery_lng", addr: "delivery_address", label: "địa chỉ giao" }

    default:
      return { lat: "delivery_lat", lng: "delivery_lng", addr: "delivery_address", label: "địa chỉ giao hàng" }
  }
}

export async function processLocation(
  senderId: string,
  lat: number,
  lng: number,
): Promise<BotResponse> {
  const session = await getSession(senderId)
  const target  = resolveLocationTarget(session.intent, session.collected_data)

  // Reverse-geocode → địa chỉ text cho đúng field (taxi=pickup, food=delivery,...)
  const addrText   = await reverseGeocode(lat, lng)
  const coordsData: Partial<CollectedData> = {
    [target.lat]: lat,
    [target.lng]: lng,
    ...(addrText ? { [target.addr]: addrText } : {}),
  }

  const newData = mergeData(session.collected_data, coordsData)
  await saveSession(senderId, { state: "collecting", collected_data: newData })
  await saveMessage(senderId, "user", `[Vị trí ${target.label}: ${addrText ?? `${lat.toFixed(4)},${lng.toFixed(4)}`}]`)

  if (addrText) {
    const confirmMsg = `📍 Đã ghi nhận ${target.label}:\n${addrText}\n\nĐúng chưa bạn?`
    await saveMessage(senderId, "model", confirmMsg)
    // Quick reply: Đúng rồi | Sửa lại
    return { type: "text", content: confirmMsg, quick_replies: QR_CONFIRM_CANCEL }
  }

  if (session.intent) {
    const missing = getMissingFields(session.intent, newData)
    if (missing.length === 0) return transitionToConfirming({ ...session, collected_data: newData })
  }

  return askNextField({ ...session, state: "collecting" as const, collected_data: newData })
}

// ─── handleLocationRefused ────────────────────────────────────────────────────

export async function handleLocationRefused(senderId: string): Promise<BotResponse | null> {
  const session = await getSession(senderId)
  if (!["collecting", "idle"].includes(session.state)) return null

  const reply = "Không sao bạn ơi! 😊\n📝 Bạn nhắn địa chỉ giao hàng cụ thể cho mình nhé!\n(Ví dụ: 55 Nguyễn Chí Thanh, Phước An)"
  await saveSession(senderId, { state: "collecting" })
  await saveMessage(senderId, "model", reply)
  return { type: "text", content: reply }
}

// ─── processMessage — MAIN STATE MACHINE ─────────────────────────────────────

export async function processMessage(senderId: string, text: string): Promise<BotResponse> {
  if (isRateLimited(senderId)) {
    return { type: "text", content: "Bạn nhắn nhanh quá mình theo không kịp 😄 Cho mình xíu nhé!" }
  }

  const session    = await getSession(senderId)
  const { state, intent, collected_data } = session
  const isOrdering = ["collecting", "confirming", "creating_order"].includes(state)

  // L0: Guard
  const guardResult = guard(text)
  if (!guardResult.pass) {
    const gr = guardResult as { pass: false; reason: string; reply: string }
    if (isOrdering && gr.reason !== "competitor") {
      // Cho qua khi đang đặt hàng — địa chỉ/SĐT có thể bị guard nhầm
    } else {
      await logBlocked(senderId, text, gr.reason)
      return { type: "text", content: gr.reply }
    }
  }

  // L11: Human handover
  if (isEscalationRequest(text)) {
    await saveSession(senderId, { state: "escalated" })
    await saveMessage(senderId, "user", text)
    const msg = "Mình đã ghi nhận rồi! 🙏\n👤 Nhân viên DakGo sẽ liên hệ bạn sớm nhé.\n📞 Hoặc gọi: 0900 000 000"
    await saveMessage(senderId, "model", msg)
    return { type: "text", content: msg }
  }

  // Reset sau khi đặt xong / bị escalate / khách muốn bắt đầu lại
  if (state === "order_created" || state === "escalated") {
    await resetSession(senderId)
    return processMessage(senderId, text)
  }

  // Khách nhắn "đặt mới" / "bắt đầu lại" → reset session
  if (/^(đặt mới|bắt đầu lại|đặt lại từ đầu|hủy đơn cũ|xóa đi|làm lại)$/i.test(text.trim())) {
    await resetSession(senderId)
    const msg = "Mình đã xóa thông tin cũ rồi! 😊\nBạn cần dịch vụ gì?\n🍜 Đồ ăn · 📦 Giao hộ · 🛒 Mua hộ · 🛵 Xe ôm · 🚕 Taxi"
    await saveMessage(senderId, "model", msg)
    return { type: "text", content: msg }
  }

  // Phát hiện lời chào — không kéo vào flow cũ
  const isGreeting = /^(alo|hello|hi|chào|ơi|hey|xin chào|này|ờ alo|alo ơi|cho hỏi|cho mình hỏi)$/i.test(text.trim())
  if (isGreeting) {
    if (state === "collecting" && intent) {
      // Có flow đang dở → hỏi có muốn tiếp không (dùng quick reply)
      const label: Record<string, string> = {
        food_order: "đặt đồ ăn", deliver_for_me: "giao hộ",
        buy_for_me: "mua hộ", motorbike: "xe ôm", taxi: "taxi", taxi7: "taxi 7 chỗ",
      }
      const msg = `Chào bạn! 👋\nBạn đang ${label[intent] ?? "đặt dịch vụ"} chưa xong.`
      await saveMessage(senderId, "model", msg)
      return { type: "text", content: msg, quick_replies: QR_RESUME }
    }
    // Idle → chào và show menu với quick reply chips
    const greet = "Chào bạn! Mình là DakGo 🛵\nBạn cần dịch vụ nào ạ?"
    await saveMessage(senderId, "model", greet)
    return { type: "text", content: greet, quick_replies: QR_SERVICE_MENU }
  }

  // ── Gợi ý tiếp tục đơn dang dở sau khi idle > 30 phút ────────────────────
  if (state === "collecting" && intent && session.updated_at) {
    const idleMin = (Date.now() - new Date(session.updated_at).getTime()) / 60_000
    if (idleMin > 30) {
      await saveMessage(senderId, "user", text)
      const label: Record<string, string> = {
        food_order: "đặt đồ ăn", deliver_for_me: "giao hộ",
        buy_for_me: "mua hộ", motorbike: "đặt xe ôm", taxi: "đặt taxi", taxi7: "đặt taxi 7 chỗ",
      }
      const svc = label[intent] ?? "đặt dịch vụ"

      // Nếu text hiện tại là xác nhận tiếp tục → tiếp tục luôn
      if (isConfirmation(text)) {
        return askNextField(session)
      }

      // Nếu là yêu cầu mới → reset và xử lý
      const hasNewIntent = detectServiceType(text) || isReorderRequest(text)
      if (hasNewIntent) {
        await resetSession(senderId)
        return processMessage(senderId, text)
      }

      // Hỏi có muốn tiếp tục không → dùng quick reply
      const remind = `Hồi nãy bạn đang ${svc} nhưng chưa xong.\nBạn muốn tiếp tục không?`
      await saveMessage(senderId, "model", remind)
      return { type: "text", content: remind, quick_replies: QR_RESUME }
    }
  }

  // ── STATE: confirming ─────────────────────────────────────────────────────
  if (state === "confirming" && intent) {
    await saveMessage(senderId, "user", text)

    if (isConfirmation(text)) {
      await saveSession(senderId, { state: "creating_order" })
      const result = await createOrder({ ...session, state: "creating_order" })

      if (result.success) {
        await saveSession(senderId, { state: "order_created" })
        const successResp = buildSuccessMsg(intent, result.displayId!, collected_data)
        // Lưu log text tóm tắt
        const logText = `[Đặt thành công #${result.displayId}]`
        await saveMessage(senderId, "model", logText)
        // Quick reply cho non-receipt (receipt không có quick_replies)
        if (successResp.type !== "receipt_template") {
          return successResp
        }
        // Receipt: gửi receipt rồi gửi thêm text với quick reply
        return successResp  // webhook sẽ xử lý, gửi thêm quick reply riêng bên dưới
      } else {
        await saveSession(senderId, { state: "confirming" })
        const msg = `😔 Có lỗi khi tạo đơn: ${result.error}\nBạn thử xác nhận lại nhé!`
        await saveMessage(senderId, "model", msg)
        return { type: "text", content: msg }
      }
    }

    if (isCorrection(text)) {
      const history   = await getConversation(senderId, 10)
      const extracted = await extractAndReply(text, intent, collected_data, null, history as ChatTurn[])
      const newData   = mergeData(collected_data, extracted.data)
      await saveSession(senderId, { state: "collecting", collected_data: newData })

      const missing = getMissingFields(intent, newData)
      if (missing.length === 0) {
        return transitionToConfirming({ ...session, collected_data: newData })
      }
      return askNextField({ ...session, state: "collecting", collected_data: newData }, extracted.reply)
    }

    const bump = "Bạn ơi, để xác nhận đơn bạn nhắn *đúng rồi* nhé!\nHoặc cho mình biết cần sửa gì? 😊"
    await saveMessage(senderId, "model", bump)
    return { type: "text", content: bump }
  }

  // ── STATE: collecting ─────────────────────────────────────────────────────
  if (state === "collecting" && intent) {
    await saveMessage(senderId, "user", text)

    // Khách nhắn "xong" hoặc xác nhận đơn giản → tiếp tục hỏi field tiếp theo
    // (vd: "đúng rồi" sau khi bot xác nhận địa chỉ → không cần Groq)
    if (
      /^(xong|done|ok xong|chọn xong|đủ rồi)$/i.test(text.trim()) ||
      isConfirmation(text)
    ) {
      return askNextField(session)
    }

    const nextField = getNextMissingField(intent, collected_data)
    const history   = await getConversation(senderId, 10)
    const extracted = await extractAndReply(text, intent, collected_data, nextField, history as ChatTurn[])
    let newData     = mergeData(collected_data, extracted.data)

    // Geocode ngay khi địa chỉ text vừa được extract — lưu lat/lng vào session
    // và echo lại để user xác nhận bot hiểu đúng
    const ADDR_FIELDS = [
      { addr: "delivery_address" as const, lat: "delivery_lat" as const, lng: "delivery_lng" as const },
      { addr: "pickup_address"  as const, lat: "pickup_lat"   as const, lng: "pickup_lng"   as const },
      { addr: "dropoff_address" as const, lat: "dropoff_lat"  as const, lng: "dropoff_lng"  as const },
    ]
    for (const f of ADDR_FIELDS) {
      const isNew = extracted.data[f.addr] && !collected_data[f.addr]
      if (isNew) {
        const addrText = newData[f.addr]!
        const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dakgo.com"
        const mapUrl   = `${appUrl}/bot-address?sid=${senderId}`

        const sendMapLink = async (reason: string): Promise<BotResponse> => {
          // Xóa địa chỉ vừa extract — chưa có tọa độ
          const cleaned = { ...newData }
          delete (cleaned as Record<string, unknown>)[f.addr]
          await saveSession(senderId, { collected_data: cleaned })
          await saveMessage(senderId, "model", reason)
          return {
            type:          "text_with_webview",
            content:       reason,
            buttonTitle:   "🗺️ Chọn vị trí trên bản đồ",
            url:           mapUrl,
            quick_replies: [{ content_type: "location" }],
          } as TextWithWebviewResponse
        }

        // Địa chỉ xã / buôn / thôn → không có số nhà → cần chọn map
        if (!isGeocodable(addrText)) {
          return sendMapLink(
            `📍 Địa chỉ "${addrText}" ở khu vực ngoài thị trấn, mình cần bạn ghim vị trí chính xác nhé!\n\nDùng link bên dưới hoặc share GPS trực tiếp:`
          )
        }

        // Phước An / có số nhà → thử geocode
        const coords = await tryGeocodeAddress(addrText)
        if (!coords) {
          // Không geocode được → giữ địa chỉ text, cho user xác nhận hoặc ghim bản đồ
          await saveSession(senderId, { collected_data: newData })
          const mapMsg = `📍 Lưu địa chỉ: "${addrText}"\n\nMình chưa tìm được vị trí này trên bản đồ.\nNhắn "đúng rồi" để dùng địa chỉ này, hoặc ghim vị trí chính xác hơn:`
          await saveMessage(senderId, "model", mapMsg)
          return {
            type:          "text_with_webview",
            content:       mapMsg,
            buttonTitle:   "🗺️ Ghim vị trí chính xác",
            url:           mapUrl,
            quick_replies: QR_CONFIRM_CANCEL,
          } as TextWithWebviewResponse
        }

        // Tìm được → lưu coords + hỏi xác nhận
        newData = mergeData(newData, { [f.lat]: coords.lat, [f.lng]: coords.lng })
        await saveSession(senderId, { collected_data: newData })
        const confirmMsg = `📍 ${addrText}\n\nĐúng chưa bạn?`
        await saveMessage(senderId, "model", confirmMsg)
        return { type: "text", content: confirmMsg, quick_replies: QR_CONFIRM_CANCEL }
      }
    }

    await saveSession(senderId, { collected_data: newData })

    // Phát hiện đổi intent giữa chừng
    if (extracted.intent && extracted.intent !== intent) {
      const svcKey = Object.entries(INTENT_MAP).find(([, v]) => v === extracted.intent)?.[0]
      if (svcKey) {
        const status = await checkServiceAvailable(svcKey as Parameters<typeof checkServiceAvailable>[0])
        if (!status.available) {
          const msg = status.customerMsg ?? "Dịch vụ này tạm thời chưa hoạt động bạn ơi 😔"
          await saveMessage(senderId, "model", msg)
          return { type: "text", content: msg }
        }
        const keepData = { delivery_address: newData.delivery_address, phone: newData.phone }
        await saveSession(senderId, { intent: extracted.intent, state: "collecting", collected_data: keepData })
        return askNextField({ ...session, intent: extracted.intent, state: "collecting", collected_data: keepData }, extracted.reply)
      }
    }

    const missing        = getMissingFields(intent, newData)
    const updatedSession = { ...session, collected_data: newData }

    if (missing.length === 0) {
      return transitionToConfirming(updatedSession)
    }

    // Confusion counter
    const gotData   = Object.keys(extracted.data).length > 0
    const confusion = gotData ? 0 : (session.confusion_count + 1)
    await saveSession(senderId, { confusion_count: confusion })

    if (confusion >= 3) {
      await saveSession(senderId, { state: "escalated" })
      const msg = "Mình xin lỗi vì chưa hỗ trợ tốt 😔\nBạn có thể:\n• Dùng app: dakgo.com\n• Gọi: 0900 000 000"
      await saveMessage(senderId, "model", msg)
      return { type: "text", content: msg }
    }

    return askNextField(updatedSession, extracted.reply)
  }

  // ── STATE: idle — Chào user quay lại sau >6 giờ ──────────────────────────
  if (state === "idle") {
    const lastTime = await getLastUserMessageTime(senderId)
    const idleHours = lastTime ? (Date.now() - lastTime.getTime()) / 3_600_000 : null
    if (lastTime && idleHours !== null && idleHours > 6 && !isGreeting) {
      const hasIntent = detectServiceType(text) || isReorderRequest(text)
      if (!hasIntent) {
        // Không có intent rõ → chào + menu, dừng tại đây
        await saveMessage(senderId, "user", text)
        const hour = new Date().getHours()
        const hi   = hour < 11 ? "buổi sáng" : hour < 13 ? "buổi trưa" : hour < 18 ? "buổi chiều" : "buổi tối"
        const greeting = idleHours > 20
          ? "Chào bạn quay lại! 👋\nDạo này có gì cần DakGo hỗ trợ không?"
          : `Chào bạn ${hi}! 👋\nBạn cần dịch vụ gì ạ?`
        await saveMessage(senderId, "model", greeting)
        return { type: "text", content: greeting, quick_replies: QR_SERVICE_MENU }
      }
      // hasIntent → fall through, lưu tin tại khối detect intent bên dưới
    }
  }

  // ── STATE: idle — Detect intent ───────────────────────────────────────────
  await saveMessage(senderId, "user", text)

  // Reorder từ đơn cũ
  if (isReorderRequest(text)) {
    const phone = session.collected_data.phone
    if (!phone) {
      const msg = "Để đặt lại đơn cũ, bạn cho mình xin số điện thoại để tìm đơn nhé! 📞"
      await saveMessage(senderId, "model", msg)
      await saveSession(senderId, { state: "collecting", intent: "food_order", collected_data: {} })
      return { type: "text", content: msg }
    }
    const lastOrder = await loadLastOrder(phone)
    if (lastOrder) {
      const priceHints = await estimatePrice("food_order", lastOrder)
      const enriched   = { ...lastOrder, ...priceHints }
      await saveSession(senderId, { state: "confirming", intent: "food_order", collected_data: enriched })
      const summary = buildConfirmationSummary("food_order", enriched)
      const msg     = `🔄 Tìm được đơn cũ của bạn:\n\n${summary}`
      await saveMessage(senderId, "model", msg)
      return { type: "text", content: msg }
    }
    const notFound = "😔 Mình không tìm được đơn cũ. Bạn đặt mới nhé!\n\nMuốn: 🍜 Đồ ăn · 📦 Giao hộ · 🛒 Mua hộ · 🛵 Xe ôm · 🚕 Taxi?"
    await saveMessage(senderId, "model", notFound)
    return { type: "text", content: notFound }
  }

  // Xem thêm quán
  if (/(xem thêm|thêm quán|quán khác|còn quán|quán nào (khác|nữa)|cho.*xem.*quán|gợi ý.*quán)/i.test(text)) {
    const keyword  = await getKeyword(senderId)
    const { data: pageData } = await db()
      .from("bot_conversations").select("content")
      .eq("sender_id", senderId).like("content", "__PAGE__%")
      .order("created_at", { ascending: false }).limit(1).single()
    const currentPage = pageData ? parseInt(pageData.content.replace("__PAGE__:", "")) : 0
    const nextPage    = currentPage + 1
    const cardResp    = await buildShopCards(keyword, nextPage)
    if (cardResp?.elements.length > 0) {
      await db().from("bot_conversations").insert({ sender_id: senderId, role: "model", content: `__PAGE__:${nextPage}` })
      return cardResp
    }
    const msg = `😊 Mình đã gợi ý hết quán có "${keyword}" rồi bạn ơi!`
    await saveMessage(senderId, "model", msg)
    return { type: "text", content: msg }
  }

  // L1: Detect intent
  const serviceKey = detectServiceType(text)

  if (serviceKey) {
    const status = await checkServiceAvailable(serviceKey)
    if (!status.available) {
      const msg = status.customerMsg ?? "Dịch vụ tạm thời chưa hoạt động bạn ơi 😔"
      await saveMessage(senderId, "model", msg)
      return { type: "text", content: msg }
    }

    const sessionIntent = INTENT_MAP[serviceKey] ?? serviceKey

    if (serviceKey === "food") {
      // Tách: "đặt đồ ăn ở quán ABC" → keyword="quán ABC", shopName="ABC"
      const atShop   = text.match(/(?:ở|tại|quán|shop)\s+([\wÀ-ỹ\s]{2,40})/i)
      const shopHint = atShop?.[1]?.trim()

      const cleaned = text
        .replace(/cho\s*(tôi|mình|t|tui)\s*/gi, "")
        .replace(/\b(đặt|muốn|ăn|nha|nhé|đi|ơi|order|lấy|mua|thử|ship|giao|giúp|dùm|ở|tại)\b/gi, "")
        .trim()
      const kw = cleaned.length >= 2 ? cleaned : "đồ ăn"

      await saveKeyword(senderId, kw)

      const keepPhone  = session.collected_data.phone
      const initData: CollectedData = keepPhone ? { phone: keepPhone } : {}

      // Nếu user nói tên quán cụ thể → auto-tìm
      if (shopHint) {
        const found = await searchShopByName(shopHint)
        if (found) {
          initData.shop_id   = found.id
          initData.shop_name = found.name
          await saveSession(senderId, { state: "collecting", intent: "food_order", collected_data: initData })
          const intro = `🏪 Tìm thấy **${found.name}**! Xem menu nhé:`
          await saveMessage(senderId, "model", intro)
          return buildMenuCards(found.id, found.name)
        }
        initData.shop_name = shopHint
      }

      await saveSession(senderId, { state: "collecting", intent: "food_order", collected_data: initData })

      const cardResp = await buildShopCards(kw, 0)
      if (cardResp?.elements.length > 0) return cardResp

      const noShop = `😔 Chưa tìm được quán nào có "${kw}" đang mở. Bạn thử món khác không?`
      await saveMessage(senderId, "model", noShop)
      return { type: "text", content: noShop }
    }

    // Non-food: kế thừa phone nếu đã biết
    const initData = session.collected_data.phone ? { phone: session.collected_data.phone } : {}
    await saveSession(senderId, { state: "collecting", intent: sessionIntent, collected_data: initData })
    return askNextField({ ...session, state: "collecting", intent: sessionIntent, collected_data: initData })
  }

  // L3: Groq detect intent
  const history   = await getConversation(senderId, 10)
  const extracted = await extractAndReply(text, null, session.collected_data, null, history as ChatTurn[])

  if (extracted.intent) {
    const svcKey = Object.entries(INTENT_MAP).find(([, v]) => v === extracted.intent)?.[0]
    if (svcKey) {
      const status = await checkServiceAvailable(svcKey as Parameters<typeof checkServiceAvailable>[0])
      if (!status.available) {
        const msg = status.customerMsg ?? "Dịch vụ tạm chưa hoạt động"
        await saveMessage(senderId, "model", msg)
        return { type: "text", content: msg }
      }
      const initData = session.collected_data.phone
        ? mergeData({ phone: session.collected_data.phone }, extracted.data)
        : (extracted.data as CollectedData)
      await saveSession(senderId, { state: "collecting", intent: extracted.intent, collected_data: initData })
      const newSession: BotSession = {
        sender_id: senderId, state: "collecting",
        intent: extracted.intent, collected_data: initData, confusion_count: 0,
      }
      return askNextField(newSession, extracted.reply)
    }
  }

  // Fallback greeting + service menu quick replies
  const reply = sanitizeReply(
    extracted.reply?.trim() || "Mình hỗ trợ gì cho bạn ạ? 😊"
  )
  await saveMessage(senderId, "model", reply)
  return { type: "text", content: reply, quick_replies: QR_SERVICE_MENU }
}
