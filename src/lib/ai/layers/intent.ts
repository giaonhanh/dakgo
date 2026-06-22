// Layer 3: Intent Classifier (rule-based, không dùng AI — phải nhanh < 1ms)
import type { Intent, PipelineInput } from '../types'

// Câu hỏi thông tin thường gặp → trả lời nhanh không cần DB
const FAQ_PATTERNS: Array<{ key: string; regexes: RegExp[] }> = [
  {
    key: 'delivery_fee',
    regexes: [/ship (phí|giá|bao nhiêu)|phí (giao|ship|vận chuyển)|giao hàng (bao nhiêu|mất phí|tính phí)/i],
  },
  {
    key: 'delivery_time',
    regexes: [/giao (bao lâu|lâu không|nhanh không|trong bao lâu|mất bao lâu)/i, /bao lâu (giao|tới|đến)/i],
  },
  {
    key: 'price_query',
    regexes: [/giá (bao nhiêu|là bao|như thế nào|cả|thế nào)\??/i, /bao nhiêu tiền|mất bao nhiêu tiền/i],
  },
  {
    key: 'open_hours',
    regexes: [/(còn|đang) (mở|bán|hoạt động) (không|chưa)\??/i, /giờ (này|mấy giờ|bây giờ).*(mở|bán)/i, /mấy giờ (mở|đóng|bán)/i],
  },
  {
    key: 'service_area',
    regexes: [/(giao|phục vụ|hoạt động).*(đâu|ở đâu|khu vực nào|xã nào|vùng nào)/i, /có giao (đến|tới|ở)\b/i],
  },
  {
    key: 'payment',
    regexes: [/thanh toán (bằng|qua|thế nào|cách nào)|trả (tiền|bằng) (gì|cách)/i, /có (nhận|chấp nhận) (chuyển khoản|tiền mặt|momo|zalo)/i],
  },
]

export function detectFaq(message: string): string | null {
  for (const { key, regexes } of FAQ_PATTERNS) {
    if (regexes.some(r => r.test(message))) return key
  }
  return null
}

// Detect category từ câu hỏi để filter quán
export function detectCategoryFromMessage(message: string): string | null {
  const map: Array<[RegExp, string]> = [
    [/\b(cơm|cơm gà|cơm tấm|cơm rang)\b/i,                       'com'],
    [/\b(bún|bún bò|bún thịt|bun)\b/i,                            'bun'],
    [/\b(phở|pho)\b/i,                                             'pho'],
    [/\b(cà phê|cafe|coffee|ca phe)\b/i,                           'ca-phe'],
    [/\b(lẩu)\b/i,                                                 'lau'],
    [/\b(mỳ|mì|mỳ cay|mì cay|my cay)\b/i,                        'mi'],
    [/\b(bánh mì|banh mi)\b/i,                                     'banh-mi'],
    [/\b(gà rán|gà chiên|ga ran)\b/i,                              'ga-ran'],
    [/\b(trà sữa|tra sua|bubble tea|trà)\b/i,                      'tra-sua'],
    [/\b(nước|đồ uống|nước uống|nước ngọt|nước mát|giải khát|do uong)\b/i, 'do-uong'],
  ]
  for (const [re, cat] of map) {
    if (re.test(message)) return cat
  }
  return null
}

// Detect "gần tôi/đây/ở đây" → cần GPS
export function needsLocation(message: string): boolean {
  return /gần (tôi|đây|chỗ (tôi|này|mình)|vị trí)|quanh đây|xung quanh|ở đây|chỗ này|tại đây/i.test(message)
}

const PATTERNS: Array<{ intent: Intent; regexes: RegExp[] }> = [
  // ── Confirm order (phải check TRƯỚC ORDER_FOOD) ──────────────────────────────
  {
    intent: 'CONFIRM_ORDER',
    regexes: [
      /^✅\s*(đặt ngay|xác nhận|đồng ý|ok)$/i,
      /^(đặt ngay|xác nhận đặt|đồng ý đặt|đặt luôn|ok đặt)$/i,
      /^(oke|okey|okay)\s*(đặt|luôn)?$/i,
    ],
  },

  // ── Cancel / reset ───────────────────────────────────────────────────────────
  {
    intent: 'CANCEL',
    regexes: [
      /^(thôi|hủy|không (đặt|mua|cần|lấy)|cancel|stop)(\s|$|[!?])/i,
      /^hủy\s*(đơn|hết|tất|toàn bộ)?(\s|$)/i,
      /đặt lại từ đầu|làm lại từ đầu|bắt đầu lại/i,
    ],
  },

  // ── Track order ──────────────────────────────────────────────────────────────
  {
    intent: 'TRACK_ORDER',
    regexes: [
      /(đơn|order)\s*(của|tôi|mình)\s*(đâu|rồi|chưa|sao)/i,
      /tài xế (đâu|ở đâu|bao giờ)/i,
      /theo dõi|tracking|bao giờ tới|bao lâu/i,
    ],
  },

  // ── Modify cart ──────────────────────────────────────────────────────────────
  {
    intent: 'MODIFY_CART',
    regexes: [
      /bỏ (ra|đi|món)|xóa (món|đi)|hủy món/i,
      /sửa (lại|đơn)|thay (đổi|bằng|thế)/i,
      /ít hơn|nhiều hơn|không lấy (món|cái)/i,
      /đổi (sang|thành|món)/i,
    ],
  },

  // ── Find shop / Browse menu ───────────────────────────────────────────────────
  {
    intent: 'FIND_SHOP',
    regexes: [
      // Tìm quán
      /(quán|shop|cửa hàng|nhà hàng)\s*(nào|gần|đang mở|hay|ngon|tốt)/i,
      /gợi ý|recommend|ngon nhất|gần đây|đang mở/i,
      /có (quán|chỗ|nơi) nào/i,
      /xem quán|danh sách quán/i,
      // Dịch vụ giao đồ ăn (gõ tên dịch vụ = muốn dùng dịch vụ)
      /giao (đồ ăn|do an|thức ăn|đồ)/i,
      // Hỏi menu / có gì ngon — flex hơn: "có [bất kỳ] gì"
      /có\s+\S*\s*(gì|không|ngon)/i,
      /menu|thực đơn|xem món|món gì|đồ gì/i,
      /hôm nay (có|bán) gì/i,
      /ngon (không|gì|lắm|vậy)/i,
      // Còn [loại món/đồ] không
      /(còn|hết)\s+\w+\s*(không|chưa)/i,
      // Đồ uống / nước
      /(đồ uống|nước uống|nước ngọt|nước mát|giải khát)/i,
      // Ở đây / chỗ này có gì
      /(ở đây|chỗ này|tại đây)\s+(có|bán)/i,
    ],
  },

  // ── Order food — patterns explicit ──────────────────────────────────────────
  {
    intent: 'ORDER_FOOD',
    regexes: [
      // Động từ đặt hàng
      /\b(đặt|order|mua|thêm|lấy|cho (tôi|mình|em|con))\b/i,
      /\b(muốn (ăn|uống|order|đặt))\b/i,
      // "đặt lại" theo sau bởi tên món = đặt mới
      /^đặt lại\s+\w/i,
      // Số lượng + đơn vị
      /\d+\s*(phần|tô|ly|hộp|cái|gói|chai|suất|bịch|dĩa|đĩa|tô|bát|khẩu phần)/i,
      // Format "Tên — 35k" từ quick reply
      /^.+\s*[–—-]\s*\d+k$/i,
      // Số lượng đơn giản: "2 phở", "3 cơm" — số + tên không có đơn vị
      /^\d+\s+[^\d\s]{2,}/,
    ],
  },

  // ── Greet ────────────────────────────────────────────────────────────────────
  {
    intent: 'GREET',
    regexes: [
      /^(xin chào|chào|hi|hello|hey|alo|hế lô)(\s|$|[!?])/i,
      /^(mình cần|giúp (mình|tôi)|hỗ trợ)(\s|$)/i,
      // Gõ tên dịch vụ đứng một mình = muốn dùng dịch vụ đó
      /^(giao hàng|xe ôm|taxi|mua hộ|giao hộ)(\s|$|[!?])/i,
    ],
  },
]

// ── Phone number pattern (dùng để detect context response) ────────────────────
const PHONE_PATTERN = /^(0|\+84)[0-9\s\-\.]{8,11}$/

// ── Address-like pattern ───────────────────────────────────────────────────────
const ADDRESS_PATTERN = /\b(đường|phố|ngõ|hẻm|thôn|xóm|khu|số|ngách|tổ|kp\b|chợ|gần|cạnh|trước|sau|cổng)\b/i

export function classifyIntent(input: PipelineInput): Intent {
  // FAQ check trước — tránh bị override bởi các pattern khác
  if (detectFaq(input.message)) return 'FAQ'
  const msg = input.message.trim()
  const ctx = input.session.context

  // ── Context-aware shortcuts (trả lời câu hỏi của bot) ────────────────────────
  if (ctx.lastAskField === 'address') {
    // Bot vừa hỏi địa chỉ — bất kỳ câu trả lời không phải cancel = ORDER continuation
    if (!PATTERNS.find(p => p.intent === 'CANCEL')?.regexes.some(r => r.test(msg))) {
      return 'ORDER_FOOD'
    }
  }

  if (ctx.lastAskField === 'phone') {
    // Bot vừa hỏi SĐT — số điện thoại hoặc "bỏ qua" = ORDER continuation
    if (PHONE_PATTERN.test(msg) || /bỏ qua|skip|không có|chưa có/i.test(msg)) {
      return 'ORDER_FOOD'
    }
  }

  // ── Pattern matching ──────────────────────────────────────────────────────────
  for (const { intent, regexes } of PATTERNS) {
    if (regexes.some(r => r.test(msg))) return intent
  }

  // ── Implicit address (user tự gõ địa chỉ khi đang chờ) ──────────────────────
  if (ctx.items.length > 0 && !ctx.address && ADDRESS_PATTERN.test(msg)) {
    return 'ORDER_FOOD'
  }

  // ── Implicit phone ────────────────────────────────────────────────────────────
  if (ctx.items.length > 0 && ctx.address && PHONE_PATTERN.test(msg)) {
    return 'ORDER_FOOD'
  }

  // ── Ngữ cảnh: đã có món → mọi input tiếp theo nghiêng về ORDER ────────────────
  if (ctx.items.length > 0) return 'ORDER_FOOD'

  return 'UNKNOWN'
}
