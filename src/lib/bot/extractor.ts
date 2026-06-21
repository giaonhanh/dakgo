/**
 * Layer 1+3: Intent detection + Entity extraction
 * Groq ONLY cho NLP — không xử lý business logic
 * Nhận thêm chatHistory (5 tin nhắn gần nhất) để hiểu ngữ cảnh đại từ/references
 */
import Groq from "groq-sdk"
import type { CollectedData } from "./session"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

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
  "data": { ...chỉ field MỚI hoặc CẬP NHẬT từ tin nhắn... },
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
- items: array [{name, qty, price}]
  - qty: số lượng CUỐI CÙNG người dùng muốn (0 = xóa hẳn món, dương = đặt bằng đó)
  - Ví dụ: "bớt 1 cơm" với qty cũ=2 → qty=1; "bỏ ly trà sữa" → qty=0; "thêm 1 cơm" → qty=qty_cũ+1
  - price: integer VND (30k→30000, 0 nếu không rõ)
- estimated_items_cost: integer VND (200k→200000)
- Địa chỉ: giữ nguyên text người dùng nhập
- KHÔNG đoán mò, KHÔNG bịa field không được đề cập

CONTEXT REFERENCES (dùng lịch sử hội thoại để giải mã):
- "đó luôn / như vậy" → copy địa chỉ vừa nhắc trước đó
- "số tôi / số mình" → SĐT vừa đề cập trong hội thoại
- "quán đó / quán vừa rồi" → shop vừa được nhắc
- "thêm 1 nữa" → thêm 1 vào món vừa được nhắc đến
- "món kia / cái đó" → món đang thảo luận trong context

CORRECTION DETECTION:
- "đổi địa chỉ thành X / sửa thành X" → cập nhật field delivery_address hoặc pickup_address
- "đổi số thành X / sửa số thành X" → cập nhật phone
- "bỏ / xóa / không lấy" + tên món → qty=0 cho món đó

REPLY RULES:
- Hỏi đúng 1 field còn thiếu được chỉ định trong context
- Tự nhiên như nhân viên thật, ngắn (1-2 dòng), không lặp thông tin đã biết
- Dùng emoji phù hợp
- Nếu đã đủ info → reply = "Mình tổng kết đơn cho bạn nhé!"

TIẾNG ĐỊA PHƯƠNG KRÔNG PẮC:
- "dùm/giúp" = nhờ làm hộ; "tui/tao" = tôi; "nha/nhé" = đồng ý
- "ghé" = tạt vào; "BMT" = Buôn Ma Thuột
- "Ea Kly/Ea Yông/Ea Ô/Ea Ktur" = tên xã trong huyện Krông Pắc`

export interface ExtractResult {
  intent: string | null
  data: Partial<CollectedData>
  reply: string
}

export type ChatTurn = { role: "user" | "model"; parts: string }

const FALLBACK_REPLY = "Bạn cho mình biết thêm nhé! 😊"

export async function extractAndReply(
  userMessage: string,
  currentIntent: string | null,
  collectedData: CollectedData,
  nextMissingField: string | null,
  chatHistory?: ChatTurn[],
): Promise<ExtractResult> {
  const contextLines = [
    `Intent hiện tại: ${currentIntent ?? "chưa xác định"}`,
    `Data đã thu thập: ${JSON.stringify(collectedData)}`,
    nextMissingField
      ? `Field TIẾP THEO cần hỏi: "${nextMissingField}" — hãy đặt câu hỏi cho field này trong "reply"`
      : `Đã đủ thông tin — reply = "Mình tổng kết đơn cho bạn nhé!"`,
  ]

  // Xây dựng messages: system + history + current
  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: EXTRACT_SYSTEM },
  ]

  // Thêm 5 lượt hội thoại gần nhất để bot hiểu ngữ cảnh đại từ
  if (chatHistory?.length) {
    for (const turn of chatHistory.slice(-10)) {
      messages.push({
        role:    turn.role === "model" ? "assistant" : "user",
        content: turn.parts,
      })
    }
  }

  // Tin nhắn cuối: context + câu cần extract
  messages.push({
    role:    "user",
    content: `CONTEXT:\n${contextLines.join("\n")}\n\nTIN NHẮN MỚI NHẤT: "${userMessage}"\n\nJSON:`,
  })

  try {
    const res = await groq.chat.completions.create({
      model:           "llama-3.1-8b-instant",
      messages,
      max_tokens:      512,
      temperature:     0.1,
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
    console.warn("[extractor] Groq error, regex fallback:", (err as Error).message?.slice(0, 80))
    return regexFallback(userMessage)
  }
}

function regexFallback(text: string): ExtractResult {
  const extracted: Partial<CollectedData> = {}

  const phoneMatch = text.match(/(?:^|[\s,;])(\+?84|0)([\d]{8,9})/)
  if (phoneMatch) {
    const digits = (phoneMatch[1].replace("+", "") + phoneMatch[2]).replace(/^84/, "0")
    if (digits.length === 10) extracted.phone = digits
  }

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
