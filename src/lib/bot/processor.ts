import { guard, sanitizeReply } from "./guard"
import { askGemini } from "./gemini"
import { getConversation, saveMessage, logBlocked, getShopContext } from "./storage"

const RATE_LIMIT_PER_MIN = 5

// Rate limit đơn giản bằng in-memory map (reset theo process)
// Với production scale, dùng Supabase hoặc Redis
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(senderId: string): boolean {
  const now = Date.now()
  const window = 60_000
  const timestamps = (rateLimitMap.get(senderId) ?? []).filter(t => now - t < window)
  timestamps.push(now)
  rateLimitMap.set(senderId, timestamps)
  return timestamps.length > RATE_LIMIT_PER_MIN
}

export async function processMessage(senderId: string, text: string): Promise<string> {
  // Rate limit
  if (isRateLimited(senderId)) {
    return "Bạn nhắn nhanh quá mình theo không kịp rồi 😄 Cho mình xíu nhé!"
  }

  // Guard — chặn trước khi gọi Gemini
  const guardResult = guard(text)
  if (guardResult.pass === false) {
    await logBlocked(senderId, text, guardResult.reason)
    return guardResult.reply
  }

  // Lấy lịch sử + shop context song song
  const [history, shopContext] = await Promise.all([
    getConversation(senderId, 10),
    getShopContext(),
  ])

  // Gọi Groq với context quán đang mở
  const rawReply = await askGemini(history, text, shopContext)

  // Sanitize output — phòng AI tự ý nhắc đối thủ
  const reply = sanitizeReply(rawReply)

  // Lưu lịch sử
  await saveMessage(senderId, "user", text)
  await saveMessage(senderId, "model", reply)

  return reply
}
