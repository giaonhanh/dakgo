// Layer 2: Gatekeeper — lọc nội dung không phù hợp

const HARD_BLOCK: RegExp[] = [
  /súng|vũ khí|ma tuý|ma túy|thuốc lắc|heroin|cocaine/i,
  /\b(hack|exploit|xss|sql\s*inject|script\s*inject)\b/i,
  /biểu tình|đảo chính|lật đổ/i,
  /khiêu dâm|sex|porn/i,
]

const SOFT_REDIRECT: RegExp[] = [
  /thời tiết|dự báo thời tiết/i,
  /bóng đá|kết quả bóng/i,
  /chứng khoán|bitcoin|crypto|tiền ảo/i,
  /tin tức|báo đài/i,
]

export function checkGatekeeper(message: string): {
  blocked:    boolean
  offTopic:   boolean
  blockMsg?:  string
} {
  const msg = message.toLowerCase()

  for (const p of HARD_BLOCK) {
    if (p.test(msg)) {
      return {
        blocked:   true,
        offTopic:  false,
        blockMsg:  'Mình chỉ hỗ trợ đặt đồ ăn và dịch vụ giao hàng thôi nhé! 🙏',
      }
    }
  }

  for (const p of SOFT_REDIRECT) {
    if (p.test(msg)) {
      return { blocked: false, offTopic: true }
    }
  }

  return { blocked: false, offTopic: false }
}
