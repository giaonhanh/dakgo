// Layer 8: Missing Information Engine
import type { SessionContext } from '../types'

export type MissingField = 'items' | 'address' | 'phone' | null

// Priority order: items → address → phone (phone optional after address)
export function getNextMissingField(ctx: SessionContext): MissingField {
  if (ctx.items.length === 0) return 'items'
  if (!ctx.address)           return 'address'
  if (!ctx.phone)             return 'phone'
  return null
}

export function buildAskMessage(
  field: MissingField,
  ctx:   SessionContext,
): { message: string; quickReplies: string[] } {
  switch (field) {
    case 'items':
      return {
        message:      'Bạn muốn đặt món gì? Cứ nói tự nhiên, ví dụ "2 tô phở bò" hoặc "1 ly trà sữa ít đường" nhé! 😋',
        quickReplies: ['🍜 Xem quán gần đây', '🍱 Cơm hộp', '🧋 Trà sữa', '🔥 Lẩu/Nướng'],
      }

    case 'address': {
      const itemSummary = ctx.items
        .slice(0, 2)
        .map(i => `${i.quantity}x ${i.productName}`)
        .join(', ')
      return {
        message:      `Đã có ${itemSummary}${ctx.items.length > 2 ? ` +${ctx.items.length - 2} món` : ''} trong giỏ! 🎉\n\nGiao đến địa chỉ nào bạn? Nhắn địa chỉ hoặc nhấn nút để ghim vị trí:`,
        quickReplies: ['📍 Ghim vị trí'],
      }
    }

    case 'phone':
      return {
        message:      'Gần xong rồi! Số điện thoại để tài xế liên hệ là gì bạn? 📞\n(VD: 0901 234 567)',
        quickReplies: [],
      }

    default:
      return {
        message:      'Bạn muốn mình giúp gì thêm không?',
        quickReplies: ['✅ Xác nhận đơn', '🛒 Xem giỏ hàng', '🔄 Đặt lại'],
      }
  }
}
