// Detect khi khách muốn tìm quán / đặt đồ ăn → hiện card
const FOOD_TRIGGERS = [
  'đặt', 'mua', 'order', 'giao',
  'cơm', 'bún', 'phở', 'bánh', 'gà', 'bò', 'heo', 'cá', 'mì', 'xôi',
  'ăn', 'đói', 'đồ ăn', 'quán', 'món', 'tìm', 'gợi ý', 'có gì',
  'còn quán', 'quán nào', 'bán gì', 'menu',
]

export function extractFoodKeyword(text: string): string | null {
  const lower = text.toLowerCase()

  // Không phải intent tìm quán nếu đang cung cấp thông tin (SĐT, địa chỉ, ok...)
  const infoPatterns = [/^\d{9,11}$/, /^(ok|oke|đúng|rồi|được|vâng|dạ|đồng ý)/i]
  if (infoPatterns.some(p => p.test(lower.trim()))) return null

  const matched = FOOD_TRIGGERS.find(k => lower.includes(k))
  if (!matched) return null

  // Trích keyword cụ thể hơn từ câu
  const specificMatches = lower.match(/(cơm|bún|phở|bánh|gà|bò|heo|cá|mì|xôi|pizza|burger|cháo|lẩu|nướng)/g)
  return specificMatches?.[0] ?? matched
}
