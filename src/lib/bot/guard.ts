const COMPETITOR_NAMES = [
  "grab", "shopee", "be app", "gojek", "baemin", "loship",
  "now.vn", "foody", "goviet", "fastgo", "xanh sm", "ahamove",
  "giao hang nhanh", "ghn", "j&t", "viettel post", "ninja van",
]

const OFF_TOPIC_SIGNALS = [
  "thời tiết", "bóng đá", "chứng khoán", "tình yêu", "chatgpt",
  "học", "lập trình", "chính trị", "covid", "tin tức",
  "youtube", "tiktok", "game", "phim", "nhạc", "giải trí",
  "toán", "văn", "bài tập", "dịch thuật", "viết hộ",
]

const ALLOWED_INTENTS = [
  "đặt", "order", "giao", "ship", "giá", "phí", "quán",
  "món", "ăn", "mua", "xe ôm", "taxi", "hủy", "theo dõi",
  "đơn", "tiền", "thanh toán", "địa chỉ", "khu vực", "giờ",
  "mở cửa", "khuyến mãi", "voucher", "hỗ trợ", "tư vấn",
  "bao lâu", "mấy giờ", "ở đâu", "như thế nào", "cách",
  "nhận", "lấy", "trả", "hoàn", "báo", "liên hệ", "gọi",
]

export type GuardResult =
  | { pass: true }
  | { pass: false; reason: "competitor" | "off_topic" | "unrelated"; reply: string }

export function guard(text: string): GuardResult {
  const lower = text.toLowerCase()

  const mentionedCompetitor = COMPETITOR_NAMES.find(c => lower.includes(c))
  if (mentionedCompetitor) {
    return {
      pass: false,
      reason: "competitor",
      reply:
        "Mình chỉ hỗ trợ dịch vụ DakGo tại Phước An thôi bạn nhé 😊\n" +
        "Bạn cần giao hàng, mua hộ hay đặt xe không? Mình giúp ngay!",
    }
  }

  const isOffTopic = OFF_TOPIC_SIGNALS.some(s => lower.includes(s))
  if (isOffTopic) {
    return {
      pass: false,
      reason: "off_topic",
      reply:
        "Mình là Nhân viên CSKH DakGo, chỉ hỗ trợ các dịch vụ sau bạn nhé:\n\n" +
        "🛵 Giao hàng tận nơi\n" +
        "🛒 Mua hộ đi chợ\n" +
        "🚕 Đặt xe ôm / taxi\n\n" +
        "Bạn cần dịch vụ nào mình hỗ trợ ngay! 😄",
    }
  }

  const isRelevant = ALLOWED_INTENTS.some(k => lower.includes(k))
  if (!isRelevant && text.length > 30) {
    return {
      pass: false,
      reason: "unrelated",
      reply:
        "Bạn ơi, mình chưa hiểu rõ câu hỏi này lắm 😅\n" +
        "Bạn đang cần:\n" +
        "• Đặt đồ ăn / giao hàng?\n" +
        "• Mua hộ đi chợ?\n" +
        "• Đặt xe ôm / taxi?\n\n" +
        "Nhắn cụ thể giúp mình hỗ trợ nhanh hơn nhé!",
    }
  }

  return { pass: true }
}

export function sanitizeReply(text: string): string {
  const competitors = [
    "grab", "shopee food", "baemin", "be app", "gojek", "loship", "ahamove",
  ]
  let out = text
  for (const c of competitors) {
    out = out.replace(new RegExp(c, "gi"), "dịch vụ khác")
  }
  return out
}
