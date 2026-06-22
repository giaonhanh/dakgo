// Layer 0: Text Normalizer — chuẩn hóa input trước khi vào pipeline
// Grok đã hiểu tiếng Việt không dấu rất tốt, layer này chỉ cần chuẩn hóa ký tự thô

export function normalizeInput(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    // Viết tắt phổ biến
    .replace(/\bko\b/gi, 'không')
    .replace(/\bk\b/gi, 'không')
    .replace(/\bkh\b/gi, 'không')
    .replace(/\bdc\b/gi, 'được')
    .replace(/\bdi\b/gi, 'đi')
    .replace(/\bvs\b/gi, 'với')
    .replace(/\bmk\b/gi, 'mình')
    .replace(/\bbt\b/gi, 'bình thường')
    .replace(/\bsdt\b/gi, 'số điện thoại')
    .replace(/\bsd\b/gi, 'số điện thoại')
    .replace(/\bđt\b/gi, 'điện thoại')
    .replace(/\bship\b/gi, 'giao')
    .replace(/\bfree\b/gi, 'miễn phí')
    // Ký tự đặc biệt
    .replace(/[+&]/g, ' và ')
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
