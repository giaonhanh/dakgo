import { guard, sanitizeReply } from "./guard"
import { askGemini } from "./gemini"
import {
  getConversation, saveMessage, logBlocked, getShopContext,
  getState, setState, saveLocation, getLocation,
} from "./storage"
import { getPricing, calcFee, haversineKm } from "./pricing"

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

// Xử lý khi khách share vị trí qua Messenger
export async function processLocation(
  senderId: string,
  lat: number,
  lng: number,
  shopName?: string,
): Promise<string> {
  await saveLocation(senderId, lat, lng)
  await setState(senderId, "done")

  // Nếu biết tên quán → tính phí luôn
  if (shopName) {
    const { getShopLocation } = await import("./storage")
    const shopLoc = await getShopLocation(shopName)
    if (shopLoc) {
      const distKm = haversineKm(shopLoc.lat, shopLoc.lng, lat, lng)
      const pricing = await getPricing()
      if (pricing) {
        const fee = calcFee(distKm, "food", pricing)
        return `📍 Mình đã xác định vị trí của bạn rồi!\n🚚 Khoảng cách: ~${distKm.toFixed(1)}km\n💰 Phí ship: ${(fee / 1000).toFixed(0)}k\n\nBạn xác nhận đặt đơn nhé?`
      }
    }
  }

  // Không biết quán cụ thể → báo đã nhận vị trí, tiếp tục flow
  const pricing = await getPricing()
  if (pricing) {
    return `📍 Mình đã nhận vị trí của bạn rồi!\n✅ Phí ship sẽ được tính chính xác khi xác nhận đơn.\n\nBạn muốn đặt gì nào? 😊`
  }
  return `📍 Đã nhận vị trí! Bạn muốn đặt gì nào? 😊`
}

// Xử lý tin nhắn thông thường
export async function processMessage(senderId: string, text: string): Promise<string> {
  if (isRateLimited(senderId)) {
    return "Bạn nhắn nhanh quá mình theo không kịp rồi 😄 Cho mình xíu nhé!"
  }

  const guardResult = guard(text)
  if (guardResult.pass === false) {
    await logBlocked(senderId, text, guardResult.reason)
    return guardResult.reply
  }

  // Kiểm tra state — nếu đang chờ địa chỉ text (bước B)
  const state = await getState(senderId)

  if (state === "awaiting_address") {
    // Khách vừa gửi địa chỉ text → ước tính theo khu vực
    await setState(senderId, "done")
    await saveMessage(senderId, "user", text)

    const pricing = await getPricing()
    let feeHint = "10–25k tùy khoảng cách"
    if (pricing) {
      // Ước tính 2–4km cho khu vực Phước An
      const low = calcFee(1, "food", pricing)
      const high = calcFee(5, "food", pricing)
      feeHint = `${(low / 1000).toFixed(0)}–${(high / 1000).toFixed(0)}k`
    }

    const reply = `📍 Địa chỉ: ${text}\n🚚 Phí ship ước tính: ~${feeHint} (tài xế xác nhận chính xác)\n\nMình tiếp tục xác nhận đơn nhé? 😊`
    await saveMessage(senderId, "model", reply)
    return reply
  }

  // Lấy lịch sử + shop context + giờ hiện tại song song
  const [history, shopContext] = await Promise.all([
    getConversation(senderId, 10),
    getShopContext(),
  ])

  const now = new Date().toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false,
  })
  const fullContext = `GIỜ HIỆN TẠI: ${now}\n\n${shopContext}`

  const rawReply = await askGemini(history, text, fullContext)
  const reply = sanitizeReply(rawReply)

  await saveMessage(senderId, "user", text)
  await saveMessage(senderId, "model", reply)

  // Nếu bot vừa hỏi xong đủ thông tin → trigger yêu cầu share vị trí (bước A)
  const needLocation = getLocation(senderId).then(loc => loc === null)
  const shouldAskLocation =
    (await needLocation) &&
    state === "idle" &&
    (reply.includes("Đúng chưa bạn") || reply.includes("xác nhận"))

  if (shouldAskLocation) {
    await setState(senderId, "awaiting_location")
    const locationMsg =
      `📍 Để tính phí ship chính xác, bạn chia sẻ vị trí cho mình nhé!\n\n` +
      `👉 Nhấn dấu **(+)** → chọn **Vị trí** → **Gửi vị trí hiện tại**`
    await saveMessage(senderId, "model", locationMsg)
    return `${reply}\n\n${locationMsg}`
  }

  return reply
}

// Xử lý khi khách từ chối share vị trí (nhắn text thay vì share)
export async function handleLocationRefused(senderId: string): Promise<string> {
  const state = await getState(senderId)

  if (state === "awaiting_location") {
    // Bước B: hỏi địa chỉ text
    await setState(senderId, "awaiting_address")
    const reply =
      `Không sao bạn ơi! 😊\n` +
      `📝 Bạn cho mình biết địa chỉ giao hàng cụ thể nhé\n` +
      `(Ví dụ: 55 Nguyễn Chí Thanh, Phường Phước An)`
    await saveMessage(senderId, "model", reply)
    return reply
  }

  if (state === "awaiting_address") {
    // Bước C: tiếp tục không có phí chính xác
    await setState(senderId, "done")
    const reply =
      `✅ Mình ghi nhận rồi!\n` +
      `🚚 Phí ship tài xế sẽ xác nhận khi nhận đơn bạn nhé\n` +
      `🛵 Tài xế sẽ liên hệ bạn sớm!`
    await saveMessage(senderId, "model", reply)
    return reply
  }

  return ""
}
