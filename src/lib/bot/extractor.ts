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
  Chuẩn hóa về 10 chữ số, bắt đầu bằng 0.

  Đầu số VN hợp lệ (tính đến 2025):
    Viettel:      032, 033, 034, 035, 036, 037, 038, 039 · 086, 096, 097, 098
    Mobifone:     070, 076, 077, 078, 079 · 089, 090, 093
    Vinaphone:    081, 082, 083, 084, 085 · 091, 094
    Vietnamobile: 052, 056, 058 · 092
    Gmobile:      059 · 099
    Reddi:        055
    ITelecom:     099

  Chuyển đổi đầu số 11 chữ số cũ (pre-2018) → 10 số mới:
    01200→070, 01201→079, 01202→077, 01205→076, 01206→078, 01208→078, 01209→089
    0162→032, 0163→033, 0164→034, 0165→035, 0166→036, 0167→037, 0168→038, 0169→039
    0186→056, 0188→058, 0199→059, 0120→070, 0121→079, 0122→077, 0126→076, 0128→078

  Định dạng phổ biến:
    0354474474 (liền)
    035 447 4474 (cách nhau)
    035.447.4474 (chấm)
    035-447-4474 (gạch)
    +84 35 447 4474 (+84 không có số 0)
    84 354474474 (84 có số 0 hoặc không)
    "số tui là 035..." → phone field

  KHÔNG nhầm địa chỉ thành phone, KHÔNG nhầm phone thành địa chỉ

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

// Đầu số VN hợp lệ (cập nhật 2025)
const VN_PREFIXES = new Set([
  // Viettel 10 số
  "032","033","034","035","036","037","038","039","086","096","097","098",
  // Mobifone 10 số
  "070","076","077","078","079","089","090","093",
  // Vinaphone 10 số
  "081","082","083","084","085","091","094",
  // Vietnamobile / Reddi
  "052","055","056","058","092",
  // Gmobile / ITelecom
  "059","099",
])

// Map đầu số cũ 11 chữ số → 10 chữ số
const OLD_PREFIX_MAP: Record<string, string> = {
  "01200":"070","01201":"079","01202":"077","01205":"076","01206":"078","01208":"078","01209":"089",
  "0162":"032","0163":"033","0164":"034","0165":"035","0166":"036","0167":"037","0168":"038","0169":"039",
  "0186":"056","0188":"058","0199":"059",
}

/** Chuẩn hóa số điện thoại VN → 10 chữ số hoặc null nếu không hợp lệ */
export function normalizePhone(raw: string): string | null {
  // Bỏ hết ký tự không phải số (dấu chấm, gạch, cách, ngoặc)
  let digits = raw.replace(/[\s.\-()]/g, "")

  // +84 / 84 → 0
  if (digits.startsWith("+84")) digits = "0" + digits.slice(3)
  else if (digits.startsWith("84") && digits.length === 11) digits = "0" + digits.slice(2)

  // Đổi đầu số cũ 11 chữ số → 10 chữ số
  for (const [old, nw] of Object.entries(OLD_PREFIX_MAP)) {
    if (digits.startsWith(old) && digits.length === old.length + (11 - old.length)) {
      digits = nw + digits.slice(old.length)
      break
    }
  }

  // Kết quả phải đúng 10 chữ số và đầu số hợp lệ
  if (digits.length !== 10) return null
  const prefix3 = digits.slice(0, 3)
  if (!VN_PREFIXES.has(prefix3)) return null
  return digits
}

const PHONE_RE = /^0(3[2-9]|5[2568-9]|7[06-9]|8[1-9]|9[0-9])\d{7}$/

// Loại bỏ dữ liệu sai kiểu mà Groq đôi khi trả về
function sanitizeExtracted(
  data: Partial<CollectedData>,
  existing: CollectedData,
): Partial<CollectedData> {
  const out = { ...data }

  // Chuẩn hóa số điện thoại từ Groq (có thể trả về format lạ)
  const phoneFields2 = ["phone", "sender_phone", "receiver_phone"] as const
  for (const f of phoneFields2) {
    const v = out[f]
    if (typeof v === "string") {
      const normalized = normalizePhone(v)
      if (normalized) out[f] = normalized
      else delete out[f]  // Không hợp lệ → bỏ qua
    }
  }

  // Địa chỉ không được là số điện thoại
  const addrFields = ["delivery_address", "pickup_address", "dropoff_address"] as const
  for (const f of addrFields) {
    const v = out[f]
    if (typeof v === "string" && normalizePhone(v) !== null) {
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
  const t = text.trim()

  // Nhận diện số điện thoại — tất cả format phổ biến
  const phonePatterns = [
    // +84 hoặc 84 trước
    /(?:\+84|84)\s*[-.]?\s*(\d[\d\s.\-]{8,11})/,
    // 0 + 9 chữ số (thêm 0 ở đầu)
    /(0[3-9]\d[\s.\-]?\d{3,4}[\s.\-]?\d{4})/,
    // Đầu số 11 chữ số cũ
    /(01[2-9]\d{9})/,
  ]
  for (const re of phonePatterns) {
    const m = t.match(re)
    if (m) {
      const norm = normalizePhone(m[1] ?? m[0])
      if (norm) { extracted.phone = norm; break }
    }
  }

  // Nhận diện giá tiền (khi hỏi estimated_items_cost)
  const priceMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(k|ngàn|nghìn|tr|triệu|đ|đồng)/i)
  if (priceMatch && !extracted.phone) {
    const num   = parseFloat(priceMatch[1].replace(",", "."))
    const unit  = priceMatch[2].toLowerCase()
    let   vnd   = 0
    if (unit === "k" || unit === "ngàn" || unit === "nghìn") vnd = num * 1000
    else if (unit === "tr" || unit === "triệu") vnd = num * 1_000_000
    else vnd = num
    if (vnd > 0 && vnd < 100_000_000) extracted.estimated_items_cost = Math.round(vnd)
  }

  // Nhận diện món ăn + số lượng
  const itemMatch = t.match(/(\d+)\s+([\wÀ-ỹ][^\d,\n]{1,30})/)
  if (itemMatch) {
    const qty  = parseInt(itemMatch[1])
    const name = itemMatch[2].trim()
    if (qty > 0 && qty <= 99 && name.length >= 2 && !extracted.phone) {
      extracted.items = [{ name, qty, price: 0 }]
    }
  }

  return { intent: null, data: extracted, reply: FALLBACK_REPLY }
}
