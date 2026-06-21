/**
 * Processor chính — tích hợp 13 layers theo spec DakGo AI
 *
 * L0:  Guard (chặn ngoài luồng)
 * L1:  Intent detection (service-check + extractor)
 * L2:  Session memory (chat_sessions Supabase)
 * L3:  Entity extraction (Groq NLP)
 * L4:  Dialog manager / Missing field engine
 * L5:  Business rules (shop open, service enabled)
 * L6:  Pricing engine (từ DB, không qua AI)
 * L7:  Geo engine (Nominatim geocoding)
 * L8:  State machine
 * L9:  Payment (P1 — hiện tại skip)
 * L10: Order engine (tạo đơn thật)
 * L11: Human handover
 * L12: Natural conversation (Groq reply)
 */

import { guard, sanitizeReply } from "./guard"
import { extractAndReply, INTENT_MAP } from "./extractor"
import { detectServiceType, checkServiceAvailable } from "./service-check"
import { buildShopCards, type BotResponse, type TextWithWebviewResponse } from "./cards"
import { saveMessage, logBlocked, saveKeyword, getKeyword } from "./storage"
import {
  getSession, saveSession, resetSession, mergeData,
  getMissingFields, getNextMissingField,
  buildConfirmationSummary, isConfirmation, isCorrection, isEscalationRequest,
  FIELD_QUESTION,
  type BotSession,
} from "./session"
import { createOrder } from "./order-creator"
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

// ─── Menu cards helper ─────────────────────────────────────────────────────────

async function buildMenuCards(shopId: string, shopName: string): Promise<BotResponse> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: products } = await supabase
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

  // Đã đủ field → show confirmation
  if (!nextField) {
    await saveSession(sender_id, { state: "confirming" })
    const summary = buildConfirmationSummary(intent, collected_data)
    await saveMessage(sender_id, "model", summary)
    return { type: "text", content: summary }
  }

  // Food + cần items nhưng đã có shop → show menu cards
  if (nextField === "items" && intent === "food_order" && collected_data.shop_id) {
    return buildMenuCards(collected_data.shop_id, collected_data.shop_name ?? "quán")
  }

  const reply = sanitizeReply(aiReply?.trim() || FIELD_QUESTION[nextField] || "Bạn cho mình biết thêm nhé 😊")

  // Hỏi địa chỉ → kèm nút chọn trên bản đồ
  if (nextField === "delivery_address" || nextField === "pickup_address" || nextField === "dropoff_address") {
    const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dakgo.com"
    const addressUrl = `${appUrl}/bot-address?sid=${sender_id}`
    await saveMessage(sender_id, "model", reply)
    return {
      type:        "text_with_webview",
      content:     reply,
      buttonTitle: "📍 Chọn địa chỉ trên bản đồ",
      url:         addressUrl,
    } as TextWithWebviewResponse
  }

  await saveMessage(sender_id, "model", reply)
  return { type: "text", content: reply }
}

// ─── Success message ───────────────────────────────────────────────────────────

function buildSuccessMsg(intent: string, displayId: string): string {
  const label: Record<string, string> = {
    food_order: "Đặt đồ ăn", deliver_for_me: "Giao hộ",
    buy_for_me: "Mua hộ", motorbike: "Xe ôm", taxi: "Taxi 4 chỗ", taxi7: "Taxi 7 chỗ",
  }
  return [
    "✅ Đặt hàng thành công!",
    "",
    `🧾 Mã đơn: #${displayId}`,
    `📋 Dịch vụ: ${label[intent] ?? "Dịch vụ"}`,
    "🛵 Tài xế sẽ nhận đơn và liên hệ bạn sớm nhé!",
    "",
    "Cảm ơn bạn đã dùng DakGo! 🙏",
  ].join("\n")
}

// ─── processPostback ─────────────────────────────────────────────────────────

export async function processPostback(senderId: string, payload: string): Promise<BotResponse> {
  const session = await getSession(senderId)

  // Khách chọn quán → lưu shop + show menu
  if (payload.startsWith("ORDER_SHOP:")) {
    const parts    = payload.split(":")
    const shopId   = parts[1]
    const shopName = decodeURIComponent(parts.slice(2).join(":"))

    const newData = mergeData(session.collected_data, { shop_id: shopId, shop_name: shopName })
    await saveSession(senderId, { state: "collecting", intent: "food_order", collected_data: newData })
    await saveMessage(senderId, "user", `[Chọn quán: ${shopName}]`)
    return buildMenuCards(shopId, shopName)
  }

  // Khách chọn món
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
    await saveMessage(senderId, "user", `[Chọn: ${productName} × 1 — ${(price/1000).toFixed(0)}k]`)

    const confirmText = `✅ **${productName}** ×1 — ${(price/1000).toFixed(0)}k\n\nBạn muốn thêm món nữa không? Nếu không mình hỏi địa chỉ giao nhé! 😊`
    await saveMessage(senderId, "model", confirmText)
    return { type: "text", content: confirmText }
  }

  if (payload.startsWith("VIEW_MENU:")) {
    const parts    = payload.split(":")
    const shopId   = parts[1]
    const shopName = decodeURIComponent(parts.slice(2).join(":"))
    return buildMenuCards(shopId, shopName)
  }

  return { type: "text", content: "Bạn cần hỗ trợ gì không? 😊" }
}

// ─── processLocation ─────────────────────────────────────────────────────────

export async function processLocation(
  senderId: string,
  lat: number,
  lng: number,
): Promise<BotResponse> {
  const session = await getSession(senderId)
  const newData = mergeData(session.collected_data, { delivery_lat: lat, delivery_lng: lng })
  await saveSession(senderId, { state: "collecting", collected_data: newData })
  await saveMessage(senderId, "user", `[Chia sẻ vị trí: ${lat.toFixed(4)}, ${lng.toFixed(4)}]`)

  const updatedSession: BotSession = { ...session, state: "collecting", collected_data: newData }

  if (session.intent) {
    const missing = getMissingFields(session.intent, newData)
    if (missing.length === 0) {
      await saveSession(senderId, { state: "confirming" })
      const summary = buildConfirmationSummary(session.intent, newData)
      await saveMessage(senderId, "model", summary)
      return { type: "text", content: summary }
    }
  }

  return askNextField(updatedSession)
}

// ─── handleLocationRefused (backward compat) ──────────────────────────────────

export async function handleLocationRefused(senderId: string): Promise<BotResponse | null> {
  const session = await getSession(senderId)
  if (!["collecting", "idle"].includes(session.state)) return null

  const reply = "Không sao bạn ơi! 😊\n📝 Bạn nhắn địa chỉ giao hàng cụ thể cho mình nhé!\n(Ví dụ: 55 Nguyễn Chí Thanh, Phước An)"
  await saveSession(senderId, { state: "collecting" })
  await saveMessage(senderId, "model", reply)
  return { type: "text", content: reply }
}

// ─── processMessage — MAIN STATE MACHINE ──────────────────────────────────────

export async function processMessage(senderId: string, text: string): Promise<BotResponse> {
  // L: Rate limit
  if (isRateLimited(senderId)) {
    return { type: "text", content: "Bạn nhắn nhanh quá mình theo không kịp 😄 Cho mình xíu nhé!" }
  }

  const session = await getSession(senderId)
  const { state, intent, collected_data } = session
  const isOrdering = ["collecting", "confirming", "creating_order"].includes(state)

  // L0: Guard
  const guardResult = guard(text)
  if (!guardResult.pass) {
    const gr = guardResult as { pass: false; reason: string; reply: string }
    if (isOrdering && gr.reason !== "competitor") {
      // Cho qua — địa chỉ/SĐT trong flow có thể bị guard nhầm
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

  // Reset sau khi đặt xong / bị escalate → treat as idle
  if (state === "order_created" || state === "escalated") {
    await resetSession(senderId)
    return processMessage(senderId, text)
  }

  // ── STATE: confirming ──────────────────────────────────────────────────────
  if (state === "confirming" && intent) {
    await saveMessage(senderId, "user", text)

    if (isConfirmation(text)) {
      await saveSession(senderId, { state: "creating_order" })
      const result = await createOrder({ ...session, state: "creating_order" })

      if (result.success) {
        await saveSession(senderId, { state: "order_created" })
        const msg = buildSuccessMsg(intent, result.displayId!)
        await saveMessage(senderId, "model", msg)
        return { type: "text", content: msg }
      } else {
        await saveSession(senderId, { state: "confirming" })
        const msg = `😔 Có lỗi khi tạo đơn: ${result.error}\nBạn thử xác nhận lại nhé!`
        await saveMessage(senderId, "model", msg)
        return { type: "text", content: msg }
      }
    }

    if (isCorrection(text)) {
      const extracted = await extractAndReply(text, intent, collected_data, null)
      const newData   = mergeData(collected_data, extracted.data)
      await saveSession(senderId, { state: "collecting", collected_data: newData })

      const missing = getMissingFields(intent, newData)
      if (missing.length === 0) {
        await saveSession(senderId, { state: "confirming" })
        const summary = buildConfirmationSummary(intent, newData)
        await saveMessage(senderId, "model", summary)
        return { type: "text", content: summary }
      }
      return askNextField({ ...session, state: "collecting", collected_data: newData }, extracted.reply)
    }

    // Không rõ → nhắc nhở
    const bump = "Bạn ơi, để xác nhận đơn bạn nhắn *đúng rồi* nhé!\nHoặc cho mình biết cần sửa gì? 😊"
    await saveMessage(senderId, "model", bump)
    return { type: "text", content: bump }
  }

  // ── STATE: collecting ──────────────────────────────────────────────────────
  if (state === "collecting" && intent) {
    await saveMessage(senderId, "user", text)

    const nextField = getNextMissingField(intent, collected_data)
    const extracted = await extractAndReply(text, intent, collected_data, nextField)
    const newData   = mergeData(collected_data, extracted.data)
    await saveSession(senderId, { collected_data: newData })

    // Phát hiện intent mới (đổi dịch vụ giữa chừng)
    if (extracted.intent && extracted.intent !== intent) {
      const svcKey = Object.entries(INTENT_MAP).find(([, v]) => v === extracted.intent)?.[0]
      if (svcKey) {
        const status = await checkServiceAvailable(svcKey as Parameters<typeof checkServiceAvailable>[0])
        if (!status.available) {
          const msg = status.customerMsg ?? "Dịch vụ này tạm thời chưa hoạt động bạn ơi 😔"
          await saveMessage(senderId, "model", msg)
          return { type: "text", content: msg }
        }
        // Giữ lại địa chỉ + phone khi đổi intent
        const keepData = {
          delivery_address: newData.delivery_address,
          phone:            newData.phone,
        }
        await saveSession(senderId, { intent: extracted.intent, state: "collecting", collected_data: keepData })
        const newSession: BotSession = { ...session, intent: extracted.intent, state: "collecting", collected_data: keepData }
        return askNextField(newSession, extracted.reply)
      }
    }

    // Check missing sau khi merge
    const missing = getMissingFields(intent, newData)
    const updatedSession: BotSession = { ...session, collected_data: newData }

    if (missing.length === 0) {
      await saveSession(senderId, { state: "confirming" })
      const summary = buildConfirmationSummary(intent, newData)
      await saveMessage(senderId, "model", summary)
      return { type: "text", content: summary }
    }

    // Đếm confusion nếu AI không extract được gì
    const gotData    = Object.keys(extracted.data).length > 0
    const confusion  = gotData ? 0 : (session.confusion_count + 1)
    await saveSession(senderId, { confusion_count: confusion })

    // L11: Escalate sau 3 lần không hiểu
    if (confusion >= 3) {
      await saveSession(senderId, { state: "escalated" })
      const msg = "Mình xin lỗi vì chưa hỗ trợ tốt 😔\nBạn có thể:\n• Dùng app: dakgo.com\n• Gọi: 0900 000 000"
      await saveMessage(senderId, "model", msg)
      return { type: "text", content: msg }
    }

    return askNextField(updatedSession, extracted.reply)
  }

  // ── STATE: idle — Detect intent ────────────────────────────────────────────
  await saveMessage(senderId, "user", text)

  // Hỏi xem thêm quán
  if (/(xem thêm|thêm quán|quán khác|còn quán|quán nào (khác|nữa)|cho.*xem.*quán|gợi ý.*quán)/i.test(text)) {
    const keyword = await getKeyword(senderId)
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: pageData } = await supabase
      .from("bot_conversations").select("content")
      .eq("sender_id", senderId).like("content", "__PAGE__%")
      .order("created_at", { ascending: false }).limit(1).single()
    const currentPage = pageData ? parseInt(pageData.content.replace("__PAGE__:", "")) : 0
    const nextPage    = currentPage + 1
    const cardResp    = await buildShopCards(keyword, nextPage)
    if (cardResp?.elements.length > 0) {
      await supabase.from("bot_conversations").insert({ sender_id: senderId, role: "model", content: `__PAGE__:${nextPage}` })
      return cardResp
    }
    const msg = `😊 Mình đã gợi ý hết quán có "${keyword}" rồi bạn ơi! Muốn thử món khác không?`
    await saveMessage(senderId, "model", msg)
    return { type: "text", content: msg }
  }

  // L1: Detect intent bằng keywords
  const serviceKey = detectServiceType(text)

  if (serviceKey) {
    // L5: Check service availability
    const status = await checkServiceAvailable(serviceKey)
    if (!status.available) {
      const msg = status.customerMsg ?? "Dịch vụ này tạm thời chưa hoạt động bạn ơi 😔"
      await saveMessage(senderId, "model", msg)
      return { type: "text", content: msg }
    }

    const sessionIntent = INTENT_MAP[serviceKey] ?? serviceKey

    // Food: trích keyword → show shop cards
    if (serviceKey === "food") {
      const cleaned = text
        .replace(/cho\s*(tôi|mình|t|tui)\s*/gi, "")
        .replace(/\b(đặt|muốn|ăn|nha|nhé|đi|ơi|order|lấy|mua|thử|ship|giao|giúp|dùm)\b/gi, "")
        .trim()
      const kw = cleaned.length >= 2 ? cleaned : "đồ ăn"

      await saveKeyword(senderId, kw)
      await saveSession(senderId, { state: "collecting", intent: "food_order", collected_data: {} })

      const cardResp = await buildShopCards(kw, 0)
      if (cardResp?.elements.length > 0) return cardResp

      const noShop = `😔 Mình chưa tìm được quán nào có "${kw}" đang mở bạn ơi.\nBạn thử món khác không?`
      await saveMessage(senderId, "model", noShop)
      return { type: "text", content: noShop }
    }

    // Non-food: bắt đầu thu thập thông tin
    await saveSession(senderId, { state: "collecting", intent: sessionIntent, collected_data: {} })
    const newSession: BotSession = {
      sender_id: senderId, state: "collecting", intent: sessionIntent, collected_data: {}, confusion_count: 0,
    }
    return askNextField(newSession)
  }

  // L3: Không detect được keyword → nhờ Groq extract intent
  const extracted = await extractAndReply(text, null, {}, null)

  if (extracted.intent) {
    const svcKey = Object.entries(INTENT_MAP).find(([, v]) => v === extracted.intent)?.[0]
    if (svcKey) {
      const status = await checkServiceAvailable(svcKey as Parameters<typeof checkServiceAvailable>[0])
      if (!status.available) {
        const msg = status.customerMsg ?? "Dịch vụ tạm chưa hoạt động"
        await saveMessage(senderId, "model", msg)
        return { type: "text", content: msg }
      }

      await saveSession(senderId, { state: "collecting", intent: extracted.intent, collected_data: extracted.data })
      const newSession: BotSession = {
        sender_id: senderId, state: "collecting",
        intent: extracted.intent, collected_data: extracted.data, confusion_count: 0,
      }
      return askNextField(newSession, extracted.reply)
    }
  }

  // Fallback: chào + gợi ý dịch vụ
  const reply = sanitizeReply(
    extracted.reply?.trim() ||
    "Xin chào! Mình là nhân viên DakGo 🛵\nMình hỗ trợ:\n• 🍜 Đặt đồ ăn\n• 📦 Giao hộ\n• 🛒 Mua hộ\n• 🛵 Xe ôm\n• 🚕 Taxi\n\nBạn cần dịch vụ nào ạ?"
  )
  await saveMessage(senderId, "model", reply)
  return { type: "text", content: reply }
}
