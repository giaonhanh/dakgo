import { guard, sanitizeReply } from "./guard"
import { askGemini } from "./gemini"
import {
  getConversation, saveMessage, logBlocked, getShopContext,
  getState, setState, saveLocation, getLocation,
} from "./storage"
import { getPricing, calcFee, haversineKm } from "./pricing"
import { extractFoodKeyword } from "./intent"
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
    const reply = `🛵 Bạn muốn đặt từ **${shopName}**!\n\nBạn muốn đặt món gì? Mình sẽ giúp bạn hoàn tất đơn nhé 😊`
    await saveMessage(senderId, "model", reply)
    await saveMessage(senderId, "user", `[Chọn quán: ${shopName}]`)
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

  // Detect intent tìm quán/đặt đồ → hiện card
  const keyword = extractFoodKeyword(text)
  if (keyword) {
    const cardResponse = await buildShopCards(keyword)
    if (cardResponse) {
      await saveMessage(senderId, "user", text)
      await saveMessage(senderId, "model", `[Card gợi ý quán: ${keyword}]`)
      return cardResponse
    }
  }

  // State: đang chờ địa chỉ text (bước B)
  const state = await getState(senderId)
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
    getConversation(senderId, 10),
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
