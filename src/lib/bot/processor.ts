import { guard, sanitizeReply } from "./guard"
import { askGemini } from "./gemini"
import {
  getConversation, saveMessage, logBlocked, getShopContext,
  getState, setState, saveLocation, getLocation,
} from "./storage"
import { getPricing, calcFee, haversineKm } from "./pricing"
import { detectServiceType, checkServiceAvailable, SERVICE_LABEL, type ServiceKey } from "./service-check"
import { buildShopCards, type BotResponse } from "./cards"

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

  const guardResult = guard(text)
  if (guardResult.pass === false) {
    await logBlocked(senderId, text, guardResult.reason)
    return { type: "text", content: guardResult.reply }
  }

  // State hiện tại
  const state = await getState(senderId)
  const isOrdering = ["ordering","awaiting_location","awaiting_address","awaiting_shop_address"].includes(state)

  // Khách nhắn "xem thêm" quán
  if (state === "ordering" && /(xem thêm|thêm quán|quán khác|có quán nào khác)/i.test(text)) {
    const history = await getConversation(senderId, 10)
    const lastCard = history.findLast(h => h.parts.includes("[Card gợi ý quán:"))
    const keyword = lastCard?.parts.match(/\[Card gợi ý quán: (.+?)\]/)?.[1] ?? "đồ ăn"
    const pageMatch = lastCard?.parts.match(/\[Page:(\d+)\]/)
    const nextPage = pageMatch ? parseInt(pageMatch[1]) + 1 : 1
    const cardResponse = await buildShopCards(keyword, nextPage)
    if (cardResponse && cardResponse.elements.length > 0) {
      await saveMessage(senderId, "user", text)
      await saveMessage(senderId, "model", `[Card gợi ý quán: ${keyword}][Page:${nextPage}]`)
      return cardResponse
    }
    const noMore = "Mình đã gợi ý hết các quán đang mở rồi bạn ơi 😊\nBạn muốn chọn quán nào ở trên không?"
    await saveMessage(senderId, "model", noMore)
    return { type: "text", content: noMore }
  }

  // Khách vừa cung cấp địa chỉ để tìm quán gần
  if (state === "awaiting_shop_address") {
    await saveMessage(senderId, "user", text)
    // Lấy keyword từ conversation gần nhất
    const history = await getConversation(senderId, 5)
    const lastKeyword = history.findLast(h => h.role === "model" && h.parts.includes("[KEYWORD:"))
    const keyword = lastKeyword?.parts.match(/\[KEYWORD:(.+?)\]/)?.[1] ?? "đồ ăn"
    const cardResponse = await buildShopCards(keyword)
    if (cardResponse && cardResponse.elements.length > 0) {
      await setState(senderId, "ordering")
      await saveMessage(senderId, "model", `[Card gợi ý quán: ${keyword}]`)
      return cardResponse
    }
    await setState(senderId, "ordering")
    const noShopMsg = `😔 Mình chưa tìm thấy quán nào đang mở gần "${text}" có món bạn cần.\nBạn muốn thử món/quán khác không?`
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

      // Dịch vụ OK — đồ ăn thì hỏi địa chỉ để tìm quán
      if (service === "food") {
        await saveMessage(senderId, "user", text)
        // Tìm keyword từ message
        const kw = text.toLowerCase().match(/(cơm|bún|phở|bánh|gà|bò|heo|cá|mì|xôi|pizza|cháo|lẩu|nướng|đồ ăn|ăn)/)?.[0] ?? "đồ ăn"
        await setState(senderId, "awaiting_shop_address")
        const askMsg = `✅ Dịch vụ ${SERVICE_LABEL[service]} đang hoạt động!\n\n📍 Bạn cho mình biết địa chỉ hoặc khu vực của bạn để mình tìm quán gần nhất nhé!`
        await saveMessage(senderId, "model", `[KEYWORD:${kw}]${askMsg}`)
        return { type: "text", content: askMsg }
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

  // Sau khi xác nhận đơn → yêu cầu share vị trí (bước A)
  const hasLocation = await getLocation(senderId)
  const isConfirmStep = reply.includes("Đúng chưa bạn") || reply.includes("tổng kết đơn")
  if (!hasLocation && isConfirmStep && state === "idle") {
    await setState(senderId, "awaiting_location")
    const locationMsg =
      `\n\n📍 Để tính phí ship chính xác, bạn chia sẻ vị trí nhé!\n` +
      `👉 Nhấn **(+)** → chọn **Vị trí** → **Gửi vị trí hiện tại**`
    const fullReply = reply + locationMsg
    await saveMessage(senderId, "model", locationMsg)
    return { type: "text", content: fullReply }
  }

  return { type: "text", content: reply }
}
