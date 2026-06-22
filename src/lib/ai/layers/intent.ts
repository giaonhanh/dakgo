// Layer 3: Intent Classifier (rule-based, không dùng AI)
import type { Intent, PipelineInput } from '../types'

const PATTERNS: Array<{ intent: Intent; regexes: RegExp[] }> = [
  {
    intent: 'ORDER_FOOD',
    regexes: [
      /\b(đặt|order|mua|thêm|lấy|cho (tôi|mình|em))\b/i,
      /\b(muốn (ăn|uống|order))\b/i,
      /\d+\s*(phần|tô|ly|hộp|cái|gói|chai|suất|bịch)/i,
    ],
  },
  {
    intent: 'FIND_SHOP',
    regexes: [
      /(quán|shop|cửa hàng)\s*(nào|gần|đang mở|hay)/i,
      /gợi ý|recommend|ngon nhất|gần đây|đang mở/i,
      /có (quán|chỗ) nào/i,
    ],
  },
  {
    intent: 'TRACK_ORDER',
    regexes: [
      /(đơn|order)\s*(của|tôi|mình)\s*(đâu|rồi|chưa|sao)/i,
      /tài xế (đâu|ở đâu|bao giờ)/i,
      /theo dõi|tracking|bao giờ tới/i,
    ],
  },
  {
    intent: 'MODIFY_CART',
    regexes: [
      /bỏ (ra|đi)|xóa|hủy món/i,
      /sửa (lại|đơn)|thay (đổi|bằng)/i,
      /ít hơn|nhiều hơn|không lấy/i,
    ],
  },
  {
    intent: 'CANCEL',
    regexes: [
      /^(thôi|hủy|không (đặt|mua|cần)|cancel|stop)(\s|$)/i,
      /đặt lại từ đầu|làm lại từ đầu/i,
    ],
  },
  {
    intent: 'GREET',
    regexes: [
      /^(xin chào|chào|hi|hello|hey|alo|hế lô)(\s|$|[!?])/i,
      /^(mình cần|giúp (mình|tôi)|hỗ trợ)(\s|$)/i,
    ],
  },
]

export function classifyIntent(input: PipelineInput): Intent {
  const msg = input.message

  for (const { intent, regexes } of PATTERNS) {
    if (regexes.some(r => r.test(msg))) return intent
  }

  // Ngữ cảnh: đã có món trong giỏ → nghiêng về ORDER
  if (input.session.context.items.length > 0) return 'ORDER_FOOD'

  return 'UNKNOWN'
}
