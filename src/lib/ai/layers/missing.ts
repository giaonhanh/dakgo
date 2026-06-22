// Layer 8: Missing Information Engine
// Phone là OPTIONAL — chỉ hỏi items → address là bắt buộc để checkout
import type { SessionContext } from '../types'

export type MissingField = 'items' | 'address' | null
// Lưu ý: 'phone' đã được bỏ khỏi required fields.
// Phone được thu thập opportunistically (nếu user cung cấp) nhưng không block checkout.

export function getNextMissingField(ctx: SessionContext): MissingField {
  if (ctx.items.length === 0) return 'items'
  if (!ctx.address)           return 'address'
  return null   // Đủ để checkout — phone là bonus
}
