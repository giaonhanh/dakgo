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

const EXTRACT_SYSTEM = `Bạn là nhân viên CSKH thông minh của DakGo — ứng dụng giao hàng tại thị trấn Phước An, huyện Krông Pắc, tỉnh Đắk Lắk.
Nhiệm vụ: Đọc tin nhắn tiếng Việt (bao gồm viết tắt, sai chính tả, tiếng địa phương Tây Nguyên) → trích xuất thông tin → trả về JSON.
KHÔNG giải thích, KHÔNG markdown, CHỈ JSON thuần.

═══ FORMAT OUTPUT ═══
{
  "intent": "food_order|deliver_for_me|buy_for_me|motorbike|taxi|taxi7|null",
  "data": { ...chỉ field ĐƯỢC ĐỀ CẬP trong tin nhắn... },
  "reply": "phản hồi ngắn, tự nhiên, tiếng Việt"
}

═══ NHẬN DIỆN INTENT ═══

food_order — Đặt đồ ăn / giao đồ ăn:
  Từ khóa: cơm, bún, phở, hủ tiếu, bánh mì, cháo, gà, bò, heo, cá, rau, trà sữa, nước, sinh tố, pizza, burger, lẩu, món, ăn, đặt, order, ship đồ ăn, giao cơm, giao đồ, lấy đồ, mang về
  Ngầm định: Nếu tin nhắn CHỈ là tên món ăn + số lượng mà không có context khác → food_order
  Ví dụ: "2 tô bún bò", "cho tao hộp cơm sườn", "1 ly trà sữa trân châu", "gà rán 3 miếng"

motorbike — Xe ôm:
  Từ khóa: xe ôm, chở, đón, chạy, chạy xe, chở tui, đưa, đón tui, chở đi, grab xe ôm, xe 2 bánh
  Ví dụ: "chạy cho tui ra chợ", "cho xe ôm đến đón", "chở tui đi bệnh viện", "ơi cho xe đón tui"

taxi — Taxi 4 chỗ:
  Từ khóa: taxi, xe taxi, xe hơi, xe 4 chỗ, xe 5 chỗ, ô tô, đặt taxi, book xe, gọi xe hơi
  Ví dụ: "đặt taxi đi sân bay", "gọi xe 4 chỗ", "cần taxi gấp"

taxi7 — Taxi 7 chỗ:
  Từ khóa: 7 chỗ, xe 7 chỗ, xe gia đình, taxi 7, innova, fortuner, xe lớn, đi cả gia đình
  Ví dụ: "thuê xe 7 chỗ đi BMT", "cần xe 7 cho cả nhà"

deliver_for_me — Giao hộ:
  Từ khóa: giao hộ, gửi hộ, chuyển hộ, ship đồ, giao đồ, giao hàng hộ, mang hộ, giao giúp, chuyển giúp, giao tới, ship tới, giao cho người khác
  Ví dụ: "giao hộ tui cái này tới nhà chị", "ship đồ cho người nhà", "gửi hộ tui gói đồ"

buy_for_me — Mua hộ:
  Từ khóa: mua hộ, mua giúp, ghé mua, đi mua, mua dùm, lấy hộ, ghé lấy, mua cho, đi chợ hộ, mua đồ hộ
  Ví dụ: "mua hộ tui ít rau", "ghé chợ lấy cho tui mấy thứ", "mua dùm tui thuốc"

═══ TRÍCH XUẤT DỮ LIỆU ═══

SỐ ĐIỆN THOẠI (phone / sender_phone / receiver_phone):
  - Chuẩn hóa về 10 số, bắt đầu bằng 0
  - 84xxxxxxxx → 0xxxxxxxx; +84xxxxxxxx → 0xxxxxxxx
  - 035.447.4474 → 0354474474 (bỏ dấu chấm/gạch)
  - 035 447 4474 → 0354474474 (bỏ dấu cách)
  - "số tui là 035..." → phone field
  - KHÔNG nhầm địa chỉ thành phone, KHÔNG nhầm phone thành địa chỉ

ĐỊA CHỈ (delivery_address / pickup_address / dropoff_address):
  - Giữ nguyên text người dùng nhập, không chỉnh sửa
  - Các landmark phổ biến ở Phước An: Chợ Phước An, UBND huyện Krông Pắc, Bệnh viện huyện, Trường THCS Phước An, Trường THPT Phước An, Ngân hàng Agribank, Nhà thờ Phước An, Cổng chào Phước An
  - "gần chợ" → "gần Chợ Phước An, Phước An"
  - "bệnh viện huyện" → "Bệnh viện huyện Krông Pắc, Phước An"
  - "trường cấp 2 / THCS" → "Trường THCS Phước An"
  - Các xã lân cận: Ea Kly, Ea Yông, Ea Ô, Ea Ktur, Tân Tiến, Phước An, Ea Phê, Ea Uy, Krông Búk
  - "BMT / Ban Mê / Buôn Ma Thuột" → "Buôn Ma Thuột, Đắk Lắk"
  - "sân bay" → "Sân bay Buôn Ma Thuột (BMT)"

MÓN ĂN (items): array [{name: string, qty: number, price: number}]
  - qty là số lượng ĐỂ ĐẶT (không phải delta)
    + "thêm 1 cơm nữa" → dùng context: qty hiện tại + 1
    + "bớt 1 ly" → qty hiện tại - 1 (min 0)
    + "bỏ trà sữa" / "không lấy trà sữa" → qty = 0 (xóa)
    + "2 tô" → qty = 2
  - price: integer VND (30k=30000, 2 trăm=200000, 1.5k=1500, 0 nếu không biết)
  - Tên món giữ nguyên theo user nhập: "tô bún bò đặc biệt", "cơm tấm sườn bì"

GIÁ TRỊ TIỀN (estimated_items_cost):
  - "khoảng 200k" → 200000
  - "tầm 2 trăm" → 200000
  - "150.000" → 150000
  - "1 triệu" → 1000000
  - "1tr5" → 1500000

PHƯƠNG THỨC THANH TOÁN (payment_method):
  - "tiền mặt / tiền tươi / trả trực tiếp" → "cash"
  - "chuyển khoản / ck / banking / bank" → "bank_transfer"
  - "momo / zalo pay / zalopay / vnpay" → tương ứng

GHI CHÚ (note):
  - "ít cay / không cay / nhiều đá / ít đường / không hành" → ghi vào note
  - "gọi trước khi đến" / "nhắn tin khi đến" → ghi vào note
  - "đừng bấm chuông" / "giao nhẹ nhàng" → ghi vào note

═══ ĐỌC HIỂU NGỮ CẢNH ═══

Đại từ chỉ định (dùng lịch sử hội thoại để giải mã):
  - "đó luôn / chỗ đó / ở đó" → địa chỉ vừa được nhắc trong hội thoại
  - "số của tui / số mình / số tao" → SĐT đã cung cấp trước đó
  - "quán đó / tiệm đó / chỗ đó" → tên quán vừa nhắc
  - "như vậy đó / tương tự" → lặp lại thông tin vừa xác nhận
  - "thêm 1 cái nữa / thêm 1 phần" → tăng qty món vừa nhắc lên 1
  - "món kia / cái đó" → món đang thảo luận gần nhất

Chỉnh sửa thông tin:
  - "không phải, tui muốn X" → cập nhật field vừa hỏi
  - "đổi thành X / sửa thành X / thay bằng X" → cập nhật field
  - "ý tui là X / tui nói X" → cập nhật field
  - "sai rồi, X mới đúng" → cập nhật field

═══ NGUYÊN TẮC KHÔNG GHI ĐÈ ═══
  - Field đã có trong "Data đã thu thập" → KHÔNG set lại trừ khi user rõ ràng muốn sửa
  - Tin nhắn chỉ là SĐT → chỉ set phone, không set gì khác
  - Tin nhắn chỉ là địa chỉ → chỉ set địa chỉ đúng field, không set phone
  - Khi không chắc → bỏ qua field đó, đừng đoán

═══ TỪ NGỮ ĐỊA PHƯƠNG TÂY NGUYÊN ═══
  tui / tau / mình / tao   = tôi (người nói)
  bạn / mày / ông / bà    = người nghe
  dùm / giùm / giúp       = hộ / thay mặt
  nha / nhé / nghen       = đồng ý / yêu cầu nhẹ
  ghé / tạt               = đi qua / vào
  lấy / lấy cho           = mua / lấy hộ
  thôi / được / ok / dc   = chấp nhận / xác nhận
  bển / đó / chỗ đó       = ở đó / tại đó
  ra / vô / lên / xuống   = hướng di chuyển (ra = ra ngoài/ra phố, vô = vào trong)
  chợ                     = Chợ Phước An (nếu không nói rõ)
  bệnh viện               = Bệnh viện huyện Krông Pắc
  BMT / Ban Mê            = Buôn Ma Thuột
  Ea Kly / Ea Yông / Ea Ô = các xã thuộc huyện Krông Pắc

═══ VÍ DỤ THỰC TẾ ═══

User: "cho tao 2 tô bún bò"
→ {"intent":"food_order","data":{"items":[{"name":"bún bò","qty":2,"price":0}]},"reply":"Bạn muốn giao đến địa chỉ nào? 📍"}

User: "chạy cho tui ra chợ"
→ {"intent":"motorbike","data":{"dropoff_address":"Chợ Phước An, Phước An"},"reply":"Bạn đang ở đâu để mình đến đón? 📍"}

User: "035.447.4474"
→ {"intent":null,"data":{"phone":"0354474474"},"reply":"..."}

User: "khoảng 200k" (khi đang hỏi estimated_items_cost)
→ {"intent":null,"data":{"estimated_items_cost":200000},"reply":"..."}

User: "giao hộ tui tới nhà chị Lan ở 55 Nguyễn Chí Thanh"
→ {"intent":"deliver_for_me","data":{"delivery_address":"55 Nguyễn Chí Thanh, Phước An","receiver_name":"chị Lan"},"reply":"..."}

User: "đặt taxi đi sân bay"
→ {"intent":"taxi","data":{"dropoff_address":"Sân bay Buôn Ma Thuột (BMT)"},"reply":"Bạn đang ở đâu để mình đón? 📍"}

User: "ít cay nha, không hành"
→ {"intent":null,"data":{"note":"ít cay, không hành"},"reply":"..."}

User: "bỏ ly trà sữa đi" (khi items đã có trà sữa qty=2)
→ {"intent":null,"data":{"items":[{"name":"trà sữa","qty":0,"price":0}]},"reply":"..."}

User: "đổi địa chỉ thành 100 Lê Duẩn"
→ {"intent":null,"data":{"delivery_address":"100 Lê Duẩn, Phước An"},"reply":"..."}

═══ REPLY RULES ═══
  - 1-2 dòng, tự nhiên như nhân viên thật
  - Hỏi đúng 1 field tiếp theo (field được chỉ định trong context)
  - KHÔNG lặp lại thông tin đã có
  - Khi đủ thông tin → reply = "Mình tổng kết đơn cho bạn nhé!"
  - Khi đặt taxi/xe ôm: KHÔNG dùng từ "giao hàng", dùng "đón" / "đưa đi"
  - Khi đặt đồ ăn: dùng "giao đến", "ship tới"
  - Khi mua hộ/giao hộ: dùng "lấy hàng", "giao hàng"
  - Emoji phù hợp nhưng không lạm dụng`

export interface ExtractResult {
  intent: string | null
  data: Partial<CollectedData>
  reply: string
}

export type ChatTurn = { role: "user" | "model"; parts: string }

const FALLBACK_REPLY = "Bạn cho mình biết thêm nhé! 😊"

const PHONE_RE = /^(\+?84|0)\d{8,9}$/

// Loại bỏ dữ liệu sai kiểu mà Groq đôi khi trả về
function sanitizeExtracted(
  data: Partial<CollectedData>,
  existing: CollectedData,
): Partial<CollectedData> {
  const out = { ...data }

  // Địa chỉ không được là số điện thoại
  const addrFields = ["delivery_address", "pickup_address", "dropoff_address"] as const
  for (const f of addrFields) {
    const v = out[f]
    if (typeof v === "string" && PHONE_RE.test(v.replace(/\s/g, ""))) {
      delete out[f]
    }
  }

  // Không ghi đè địa chỉ đã có trừ khi rõ ràng là sửa
  for (const f of addrFields) {
    if (existing[f] && out[f] && out[f] === data[f]) {
      // Chỉ cho ghi đè nếu địa chỉ mới khác hẳn (>10 chars khác)
      const cur = String(existing[f])
      const nw  = String(out[f])
      if (nw.length < 10 || nw === cur) delete out[f]
    }
  }

  // SĐT không được là địa chỉ (> 20 chars)
  const phoneFields = ["phone", "sender_phone", "receiver_phone"] as const
  for (const f of phoneFields) {
    const v = out[f]
    if (typeof v === "string" && v.replace(/\s/g, "").length > 15) {
      delete out[f]
    }
  }

  return out
}

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

    const rawData = (parsed.data ?? {}) as Partial<CollectedData>
    // Sanity check: loại bỏ field vô lý từ Groq
    const sanitized = sanitizeExtracted(rawData, collectedData)

    return {
      intent: parsed.intent ?? null,
      data:   sanitized,
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
