import { guard, sanitizeReply } from "./guard"
import { askGemini } from "./gemini"
import {
  getConversation, saveMessage, logBlocked, getShopContext,
  getState, setState, saveLocation, getLocation,
  saveKeyword, getKeyword,
} from "./storage"
import { getPricing, calcFee, haversineKm } from "./pricing"
import { detectServiceType, checkServiceAvailable, SERVICE_LABEL, type ServiceKey } from "./service-check"
import { buildShopCards, type BotResponse, type TextWithWebviewResponse } from "./cards"

const RATE_LIMIT_PER_MIN = 5
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(senderId: string): boolean {
  const now = Date.now()
  const window = 60_000
  const timestamps = (rateLimitMap.get(senderId) ?? []).filter(t => now - t < window)
  timestamps.push(now)
  rateLimitMap.set(senderId, timestamps)
  return timestamps.length > RATE_LIMIT_PER_MIN
}

// Xử lý khi khách click "Đặt ngay" hoặc "Xem menu"
export async function processPostback(senderId: string, payload: string): Promise<BotResponse> {
  if (payload.startsWith("ORDER_SHOP:")) {
    const [, , shopName] = payload.split(":")
    await setState(senderId, "ordering")
    await saveMessage(senderId, "user", `[Chọn quán: ${shopName}]`)
    const reply = `🛵 Bạn chọn **${shopName}** rồi!\n\nBạn muốn đặt món gì ạ?`
    await saveMessage(senderId, "model", reply)
    return { type: "text", content: reply }
  }

  if (payload.startsWith("VIEW_MENU:")) {
    const [, , shopName] = payload.split(":")
    const reply = `📋 Quán **${shopName}** hiện đang đóng cửa.\n\nBạn có thể đặt trước — mình ghi nhận đơn và tài xế sẽ lấy hàng khi quán mở cửa nhé!\n\nBạn muốn đặt món gì?`
    await saveMessage(senderId, "model", reply)
    return { type: "text", content: reply }
  }

  return { type: "text", content: "Bạn cần hỗ trợ gì không? 😊" }
}

// Xử lý khi khách share vị trí
export async function processLocation(
  senderId: string,
  lat: number,
  lng: number,
  shopName?: string,
): Promise<BotResponse> {
  await saveLocation(senderId, lat, lng)
  await setState(senderId, "done")

  if (shopName) {
    const { getShopLocation } = await import("./storage")
    const shopLoc = await getShopLocation(shopName)
    if (shopLoc) {
      const distKm = haversineKm(shopLoc.lat, shopLoc.lng, lat, lng)
      const pricing = await getPricing()
      if (pricing) {
        const fee = calcFee(distKm, "food", pricing)
        const reply = `📍 Đã xác định vị trí!\n🚚 Khoảng cách: ~${distKm.toFixed(1)}km\n💰 Phí ship: ${(fee / 1000).toFixed(0)}k\n\nBạn xác nhận đặt đơn nhé?`
        await saveMessage(senderId, "model", reply)
        return { type: "text", content: reply }
      }
    }
  }

  const reply = `📍 Mình đã nhận vị trí của bạn rồi!\n✅ Phí ship sẽ được tính chính xác khi xác nhận đơn.\n\nBạn muốn đặt gì nào? 😊`
  await saveMessage(senderId, "model", reply)
  return { type: "text", content: reply }
}

// Xử lý từ chối share vị trí → bước B → bước C
export async function handleLocationRefused(senderId: string): Promise<BotResponse | null> {
  const state = await getState(senderId)

  if (state === "awaiting_location") {
    await setState(senderId, "awaiting_address")
    const reply = `Không sao bạn ơi! 😊\n📝 Bạn cho mình biết địa chỉ giao hàng cụ thể nhé\n(Ví dụ: 55 Nguyễn Chí Thanh, Phường Phước An)`
    await saveMessage(senderId, "model", reply)
    return { type: "text", content: reply }
  }

  if (state === "awaiting_address") {
    await setState(senderId, "done")
    const reply = `✅ Mình ghi nhận rồi!\n🚚 Phí ship tài xế sẽ xác nhận khi nhận đơn bạn nhé\n🛵 Tài xế sẽ liên hệ bạn sớm!`
    await saveMessage(senderId, "model", reply)
    return { type: "text", content: reply }
  }

  return null
}

// Xử lý tin nhắn chính
export async function processMessage(senderId: string, text: string): Promise<BotResponse> {
  if (isRateLimited(senderId)) {
    return { type: "text", content: "Bạn nhắn nhanh quá mình theo không kịp rồi 😄 Cho mình xíu nhé!" }
  }

  // State phải lấy TRƯỚC guard để không chặn địa chỉ/SĐT khi đang đặt đơn
  const state = await getState(senderId)
  const isOrdering = ["ordering","awaiting_location","awaiting_address","awaiting_shop_address"].includes(state)

  const guardResult = guard(text)
  if (guardResult.pass === false) {
    // Trong flow đặt hàng → chỉ chặn competitor, bỏ qua off_topic/unrelated
    if (isOrdering && guardResult.reason !== "competitor") {
      // Cho qua để Groq xử lý tự nhiên (địa chỉ, SĐT, ghi chú...)
    } else {
      await logBlocked(senderId, text, guardResult.reason)
      return { type: "text", content: guardResult.reply }
    }
  }

  // Khách nhắn "xem thêm" quán
  if (state === "ordering" && /(xem thêm|thêm quán|quán khác|có quán nào khác)/i.test(text)) {
    const keyword = await getKeyword(senderId)
    // Lấy page hiện tại từ __PAGE__ metadata
    const supabase = (await import("@supabase/supabase-js")).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: pageData } = await supabase
      .from("bot_conversations").select("content")
      .eq("sender_id", senderId).like("content", "__PAGE__%")
      .order("created_at", { ascending: false }).limit(1).single()
    const currentPage = pageData ? parseInt(pageData.content.replace("__PAGE__:", "")) : 0
    const nextPage = currentPage + 1

    const cardResponse = await buildShopCards(keyword, nextPage)
    if (cardResponse && cardResponse.elements.length > 0) {
      await saveMessage(senderId, "user", text)
      await supabase.from("bot_conversations").insert({
        sender_id: senderId, role: "model", content: `__PAGE__:${nextPage}`
      })
      return cardResponse
    }
    const noMore = "Mình đã gợi ý hết các quán đang mở rồi bạn ơi 😊\nBạn muốn chọn quán nào ở trên không?"
    await saveMessage(senderId, "model", noMore)
    return { type: "text", content: noMore }
  }

  // Khách vừa cung cấp địa chỉ để tìm quán gần
  if (state === "awaiting_shop_address") {
    await saveMessage(senderId, "user", text)
    const keyword = await getKeyword(senderId)
    const cardResponse = await buildShopCards(keyword, 0)
    if (cardResponse && cardResponse.elements.length > 0) {
      await setState(senderId, "ordering")
      return cardResponse
    }
    await setState(senderId, "ordering")
    const noShopMsg = `😔 Mình chưa tìm thấy quán nào đang mở có "${keyword}" bạn ơi.\nBạn muốn thử món/quán khác không?`
    await saveMessage(senderId, "model", noShopMsg)
    return { type: "text", content: noShopMsg }
  }

  // Detect dịch vụ và check availability — chỉ khi chưa vào flow
  if (!isOrdering) {
    const service = detectServiceType(text)
    if (service) {
      const status = await checkServiceAvailable(service)
      if (!status.available) {
        await saveMessage(senderId, "user", text)
        const msg = status.customerMsg ?? "Dịch vụ này tạm thời chưa hoạt động bạn ơi 😔"
        await saveMessage(senderId, "model", msg)
        return { type: "text", content: msg }
      }

      // Dịch vụ OK — đồ ăn thì gửi nút webview xác định vị trí
      if (service === "food") {
        await saveMessage(senderId, "user", text)
        const kw = text.toLowerCase().match(/(cơm|bún|phở|bánh|gà|bò|heo|cá|mì|xôi|pizza|cháo|lẩu|nướng|đồ ăn|ăn|trà sữa|nước|đồ uống)/)?.[0] ?? "đồ ăn"
        await setState(senderId, "awaiting_shop_address")
        await saveKeyword(senderId, kw)
        const webviewUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dakgo.com"}/bot-location?sid=${senderId}&kw=${encodeURIComponent(kw)}`
        const introMsg = `✅ Dịch vụ ${SERVICE_LABEL[service]} đang hoạt động!\n\n📍 Bấm nút bên dưới để mình xác định vị trí và tìm quán gần bạn nhất nhé!`
        await saveMessage(senderId, "model", introMsg)
        return {
          type: "webview_button",
          text: introMsg,
          buttonTitle: "📍 Xác định vị trí",
          url: webviewUrl,
        } as unknown as BotResponse
      }

      // Xe ôm / Taxi / Mua hộ / Giao hộ → vào ordering flow luôn
      await setState(senderId, "ordering")
    }
  }
  if (state === "awaiting_address") {
    await setState(senderId, "done")
    await saveMessage(senderId, "user", text)
    const pricing = await getPricing()
    const low  = pricing ? calcFee(1, "food", pricing) : 10000
    const high = pricing ? calcFee(5, "food", pricing) : 25000
    const reply = `📍 Địa chỉ: ${text}\n🚚 Phí ship ước tính: ~${(low/1000).toFixed(0)}–${(high/1000).toFixed(0)}k\n(Tài xế xác nhận chính xác)\n\nMình tiếp tục xác nhận đơn nhé? 😊`
    await saveMessage(senderId, "model", reply)
    return { type: "text", content: reply }
  }

  // Groq text flow
  const [history, shopContext] = await Promise.all([
    getConversation(senderId, 20),
    getShopContext(),
  ])

  const now = new Date().toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false,
  })

  const rawReply = await askGemini(history, text, `GIỜ HIỆN TẠI: ${now}\n\n${shopContext}`)
  const reply = sanitizeReply(rawReply)

  await saveMessage(senderId, "user", text)
  await saveMessage(senderId, "model", reply)

  // Khi Groq hỏi địa chỉ giao hàng → tự động gửi thêm nút webview xác định vị trí
  const asksForAddress = /địa chỉ giao|giao (đến|tới|hàng)|nhận hàng ở|giao đến đâu|địa chỉ (nhận|của bạn)/i.test(reply)
  const hasLocation = await getLocation(senderId)

  if (asksForAddress && !hasLocation) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dakgo.com"
    const webviewUrl = `${appUrl}/bot-location?sid=${senderId}&kw=đồ ăn`
    const response: TextWithWebviewResponse = {
      type: "text_with_webview",
      content: reply,
      buttonTitle: "📍 Xác định vị trí để tính phí ship",
      url: webviewUrl,
    }
    return response
  }

  return { type: "text", content: reply }
}
