/**
 * Mask số điện thoại để hiển thị — giữ 3 đầu + 3 cuối, che giữa.
 * Dùng trong display text, KHÔNG dùng trong href="tel:..." (cần số đầy đủ để gọi).
 *
 * 0901234567  → 090****567
 * +84901234567 → +849****567
 * Số không đủ 7 ký tự → trả về nguyên (không mask)
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return ""
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 7) return phone
  const prefix = phone.startsWith("+") ? "+" : ""
  const d = digits
  return `${prefix}${d.slice(0, 3)}****${d.slice(-3)}`
}
