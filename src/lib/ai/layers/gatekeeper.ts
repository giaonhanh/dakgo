// Layer 2: Gatekeeper — lọc nội dung không phù hợp

const HARD_BLOCK: RegExp[] = [
  /súng|vũ khí|ma tuý|ma túy|thuốc lắc|heroin|cocaine/i,
  /\b(hack|exploit|xss|sql\s*inject|script\s*inject)\b/i,
  /biểu tình|đảo chính|lật đổ/i,
  /khiêu dâm|sex\b|porn/i,
]

// Off-topic rõ ràng → redirect nhẹ nhàng
const OFF_TOPIC: RegExp[] = [
  /thời tiết|dự báo|nhiệt độ/i,
  /bóng đá|kết quả bóng|tỉ số/i,
  /chứng khoán|bitcoin|crypto|tiền ảo|coin\b/i,
  /tin tức|báo đài|thời sự/i,
  /xem phim|netflix|youtube/i,
  /học bài|bài tập|toán|lý|hóa/i,
  /game\b|chơi game|liên quân|lol\b/i,
]

// Đối thủ cạnh tranh → trả lời thân thiện thay vì block
const COMPETITOR: RegExp[] = [
  /\bgrab\b/i,
  /\bshopeefood\b|shopee\s*food/i,
  /\bbefood\b|be\s*food/i,
  /\bnow\s*food\b|gofood/i,
]

export function checkGatekeeper(message: string): {
  blocked:     boolean
  offTopic:    boolean
  isCompetitor: boolean
  blockMsg?:   string
} {
  const msg = message.toLowerCase()

  for (const p of HARD_BLOCK) {
    if (p.test(msg)) {
      return {
        blocked:      true,
        offTopic:     false,
        isCompetitor: false,
        blockMsg:     'Mình chỉ hỗ trợ đặt đồ ăn và giao hàng thôi nhé! 🙏',
      }
    }
  }

  for (const p of COMPETITOR) {
    if (p.test(msg)) {
      return {
        blocked:      false,
        offTopic:     false,
        isCompetitor: true,
      }
    }
  }

  for (const p of OFF_TOPIC) {
    if (p.test(msg)) {
      return { blocked: false, offTopic: true, isCompetitor: false }
    }
  }

  return { blocked: false, offTopic: false, isCompetitor: false }
}
