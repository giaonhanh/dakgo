// Layer 3: Intent Classifier (rule-based, không dùng AI — phải nhanh < 1ms)
import type { Intent, PipelineInput } from '../types'

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

  // ── Find shop ────────────────────────────────────────────────────────────────
  {
    intent: 'FIND_SHOP',
    regexes: [
      /(quán|shop|cửa hàng|nhà hàng)\s*(nào|gần|đang mở|hay|ngon|tốt)/i,
      /gợi ý|recommend|ngon nhất|gần đây|đang mở/i,
      /có (quán|chỗ|nơi) nào/i,
      /xem quán|danh sách quán/i,
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
    ],
  },
]

// ── Phone number pattern (dùng để detect context response) ────────────────────
const PHONE_PATTERN = /^(0|\+84)[0-9\s\-\.]{8,11}$/

// ── Address-like pattern ───────────────────────────────────────────────────────
const ADDRESS_PATTERN = /\b(đường|phố|ngõ|hẻm|thôn|xóm|khu|số|ngách|tổ|kp\b|chợ|gần|cạnh|trước|sau|cổng)\b/i

export function classifyIntent(input: PipelineInput): Intent {
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
