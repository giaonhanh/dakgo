/**
 * Layer 1+3: Intent detection + Entity extraction
 * Groq ONLY cho NLP — không xử lý business logic
 * Trả về {intent, data} → TypeScript xử lý phần còn lại
 */
import Groq from "groq-sdk"
import type { CollectedData } from "./session"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Map từ service-check ServiceKey → session intent name
export const INTENT_MAP: Record<string, string> = {
  food:      "food_order",
  motorbike: "motorbike",
  taxi:      "taxi",
  taxi7:     "taxi7",
  mua_ho:    "buy_for_me",
  giao_ho:   "deliver_for_me",
}

const EXTRACT_SYSTEM = `Bạn là engine NLP cho DakGo — ứng dụng giao hàng tại Krông Pắc, Đắk Lắk.
Nhiệm vụ: Trích xuất thông tin từ tin nhắn tiếng Việt (kể cả viết tắt, tiếng địa phương).
Trả về JSON thuần, KHÔNG giải thích, KHÔNG markdown.

FORMAT TRẢ VỀ:
{
  "intent": "food_order|deliver_for_me|buy_for_me|motorbike|taxi|taxi7|null",
  "data": { ...chỉ field MỚI từ tin nhắn... },
  "reply": "câu hỏi tiếp theo ngắn gọn bằng tiếng Việt tự nhiên"
}

INTENT RULES:
- food_order: cơm/bún/phở/trà sữa/đặt ăn/ship đồ ăn
- deliver_for_me: giao hộ/ship đồ/gửi hàng/chuyển hộ
- buy_for_me: mua hộ/ghé mua/mua giúp/đi chợ hộ
- motorbike: xe ôm/chở tui/đón tui/chạy xe
- taxi: taxi/xe ô tô/xe 4 chỗ/xe 5 chỗ
- taxi7: taxi 7 chỗ/xe 7 chỗ/xe gia đình
- null: không rõ intent

DATA EXTRACTION RULES:
- phone/sender_phone/receiver_phone: chuẩn hóa 10 số bắt đầu 0 (84xxx→0xxx, +84→0)
- items: [{name, qty, price}] — qty integer, price integer VND (30k→30000, 0 nếu không rõ)
- estimated_items_cost: integer VND (200k→200000)
- Địa chỉ: giữ nguyên text người dùng nhập
- KHÔNG đoán mò, KHÔNG bịa field

REPLY RULES:
- Hỏi đúng 1 field còn thiếu được chỉ định trong context
- Tự nhiên như nhân viên thật, ngắn (1-2 dòng)
- Dùng emoji phù hợp
- Nếu đã đủ info → reply = "Mình tổng kết đơn cho bạn nhé!"

TIẾNG ĐỊA PHƯƠNG KRÔNG PẮC:
- "dùm/giúp" = nhờ làm hộ
- "tui" = tôi
- "nha/nhé" = đồng ý/yêu cầu nhẹ
- "ghé" = singgha/tạt vào
- "BMT" = Buôn Ma Thuột
- "Ea Kly/Ea Yông" = tên xã gần Phước An`

export interface ExtractResult {
  intent: string | null
  data: Partial<CollectedData>
  reply: string
}

const FALLBACK_REPLY = "Bạn cho mình biết thêm nhé! 😊"

export async function extractAndReply(
  userMessage: string,
  currentIntent: string | null,
  collectedData: CollectedData,
  nextMissingField: string | null,
): Promise<ExtractResult> {
  const contextLines = [
    `Intent hiện tại: ${currentIntent ?? "chưa xác định"}`,
    `Data đã thu thập: ${JSON.stringify(collectedData)}`,
    nextMissingField
      ? `Field TIẾP THEO cần hỏi: "${nextMissingField}" — hãy đặt câu hỏi cho field này trong "reply"`
      : `Đã đủ thông tin — reply = "Mình tổng kết đơn cho bạn nhé!"`,
  ]

  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        {
          role: "user",
          content: `CONTEXT:\n${contextLines.join("\n")}\n\nTIN NHẮN: "${userMessage}"\n\nJSON:`,
        },
      ],
      max_tokens: 512,
      temperature: 0.1,
      response_format: { type: "json_object" },
    })

    const raw    = res.choices[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(raw) as Partial<ExtractResult>

    return {
      intent: parsed.intent ?? null,
      data:   (parsed.data ?? {}) as Partial<CollectedData>,
      reply:  parsed.reply ?? FALLBACK_REPLY,
    }
  } catch (err) {
    console.warn("[extractor] Groq error, using regex fallback:", (err as Error).message?.slice(0, 80))
    return regexFallback(userMessage)
  }
}

// Fallback đơn giản bằng regex khi Groq lỗi
function regexFallback(text: string): ExtractResult {
  const extracted: Partial<CollectedData> = {}

  // SĐT: 10 số bắt đầu 0 hoặc 84
  const phoneMatch = text.match(/(?:^|[\s,;])(\+?84|0)([\d]{8,9})/)
  if (phoneMatch) {
    const digits = (phoneMatch[1].replace("+", "") + phoneMatch[2]).replace(/^84/, "0")
    if (digits.length === 10) extracted.phone = digits
  }

  // Số lượng + tên món đơn giản: "2 cơm gà"
  const itemMatch = text.match(/(\d+)\s+([\wÀ-ỹ\s]{2,30})/)
  if (itemMatch) {
    const qty  = parseInt(itemMatch[1])
    const name = itemMatch[2].trim()
    if (qty > 0 && qty <= 99 && name.length >= 2) {
      extracted.items = [{ name, qty, price: 0 }]
    }
  }

  return { intent: null, data: extracted, reply: FALLBACK_REPLY }
}
