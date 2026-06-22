// Layer 10: Action Layer — quyết định hành động tiếp theo
import type {
  Action, Intent, SessionContext, ConfidenceScore,
  ProductSearchResult, ShopSearchResult,
} from '../types'
import type { ValidationResult } from './validator'
import type { MissingField }     from './missing'
import { formatPrice }           from '@/lib/utils'

export interface ActionDecision {
  action:       Action
  extraActions: Action[]
  reply:        string
  quickReplies: string[]
}

export interface ActionInput {
  intent:          Intent
  aiIntent:        string | null
  ctx:             SessionContext
  confidence:      ConfidenceScore
  validation:      ValidationResult
  missingField:    MissingField
  productResults:  ProductSearchResult[]
  shopResults:     ShopSearchResult[]
  offTopic:        boolean
}

export function decideAction(inp: ActionInput): ActionDecision {
  const { intent, ctx, validation, missingField, productResults, shopResults, offTopic } = inp

  // Off-topic redirect
  if (offTopic) {
    return {
      action:       { type: 'SHOW_PRODUCTS', payload: { products: [] } },
      extraActions: [],
      reply:        'Câu đó ngoài tầm mình rồi 😅 Mình chỉ hỗ trợ đặt đồ ăn và giao hàng thôi nhé! Bạn muốn đặt gì không?',
      quickReplies: ['🍜 Xem quán', '📦 Giao hộ', '🛵 Xe ôm'],
    }
  }

  // GREET
  if (intent === 'GREET') {
    return {
      action:       { type: 'SHOW_PRODUCTS', payload: { products: [] } },
      extraActions: [],
      reply:        'Chào bạn! Mình là DakGo AI 🤖\nBạn muốn đặt đồ ăn, giao hộ hay đặt xe ôm?',
      quickReplies: ['🍜 Đặt đồ ăn', '📦 Giao hộ', '🛵 Xe ôm', '🚕 Taxi'],
    }
  }

  // CANCEL
  if (intent === 'CANCEL') {
    return {
      action:       { type: 'HUMAN_HANDOFF' },
      extraActions: [],
      reply:        'OK mình hủy rồi nhé! Lần sau cần gì cứ nhắn mình. 😊',
      quickReplies: ['🍜 Đặt đồ ăn', '📦 Giao hộ'],
    }
  }

  // FIND_SHOP — không có items, chỉ tìm quán
  if (intent === 'FIND_SHOP' && ctx.items.length === 0) {
    const shops = shopResults.slice(0, 4)
    return {
      action:       { type: 'SHOW_SHOP', payload: { shops } },
      extraActions: [],
      reply:        shops.length > 0
        ? `Mình tìm được ${shopResults.length} quán đang mở! Chọn quán bạn thích:`
        : 'Hiện chưa có quán nào đang mở. Bạn thử lại sau nhé!',
      quickReplies: shops.map(s => s.name),
    }
  }

  // Shop đóng cửa
  if (ctx.shopId && !validation.shopIsOpen) {
    return {
      action:       { type: 'SHOW_SHOP', payload: { shops: shopResults.slice(0, 3) } },
      extraActions: [],
      reply:        `${validation.shopName ?? 'Quán này'} đang đóng cửa rồi! 😔\nBạn muốn xem quán khác không?`,
      quickReplies: shopResults.slice(0, 3).map(s => s.name),
    }
  }

  // Chưa có món → show product gợi ý
  if (ctx.items.length === 0) {
    if (productResults.length > 0) {
      return {
        action:       { type: 'SHOW_PRODUCTS', payload: { products: productResults.slice(0, 4) } },
        extraActions: [],
        reply:        'Mình tìm được mấy món này, bạn xem có ưng không?',
        quickReplies: productResults.slice(0, 4).map(p => `${p.name} — ${(p.price/1000).toFixed(0)}k`),
      }
    }
    return {
      action:       { type: 'SHOW_PRODUCTS', payload: { products: [] } },
      extraActions: [],
      reply:        'Bạn muốn đặt gì? Nhắn tên món hoặc xem quán gần đây nhé 😋',
      quickReplies: ['🍜 Xem quán gần đây', '🍱 Cơm hộp', '🧋 Trà sữa', '🔥 Lẩu/Nướng'],
    }
  }

  // Thiếu địa chỉ
  if (missingField === 'address') {
    return {
      action:       { type: 'ASK_LOCATION' },
      extraActions: [{ type: 'ADD_TO_CART', payload: { items: ctx.items } }],
      reply:        buildCartSummary(ctx) + '\n\nGiao đến đâu bạn? Nhắn địa chỉ hoặc ghim vị trí nhé:',
      quickReplies: ['📍 Ghim vị trí'],
    }
  }

  // Thiếu phone
  if (missingField === 'phone') {
    return {
      action:       { type: 'ASK_PHONE' },
      extraActions: [],
      reply:        'Gần xong rồi! Số điện thoại để tài xế liên hệ là gì bạn? 📞',
      quickReplies: [],
    }
  }

  // Validation issues
  if (!validation.valid && validation.issues.length > 0) {
    return {
      action:       { type: 'SHOW_PRODUCTS', payload: {} },
      extraActions: [],
      reply:        `⚠️ ${validation.issues[0]}`,
      quickReplies: ['🔄 Chọn quán khác', '❓ Liên hệ hỗ trợ'],
    }
  }

  // Ready to checkout
  if (missingField === null && ctx.items.length > 0) {
    const total = ctx.items.reduce((s, i) => s + i.price * i.quantity, 0)
    return {
      action:       {
        type: 'CHECKOUT',
        payload: { items: ctx.items, address: ctx.address, phone: ctx.phone, total },
      },
      extraActions: [],
      reply:        [
        '🎊 Xác nhận đơn hàng:',
        ...ctx.items.map(i => `• ${i.quantity}x ${i.productName} — ${formatPrice(i.price * i.quantity)}`),
        `📍 ${ctx.address}`,
        ctx.phone ? `📞 ${ctx.phone}` : '',
        `\nTổng: ${formatPrice(total)} + phí ship`,
        '\nXác nhận đặt không?',
      ].filter(Boolean).join('\n'),
      quickReplies: ['✅ Đặt ngay', '✏️ Sửa đơn', '❌ Hủy'],
    }
  }

  // ADD_TO_CART fallback
  return {
    action:       { type: 'ADD_TO_CART', payload: { items: ctx.items } },
    extraActions: [],
    reply:        'Đã thêm vào giỏ! Bạn muốn đặt thêm gì nữa không?',
    quickReplies: ['✅ Chốt đơn', '➕ Thêm món', '🗑️ Xem giỏ hàng'],
  }
}

function buildCartSummary(ctx: SessionContext): string {
  const lines = ctx.items
    .slice(0, 3)
    .map(i => `• ${i.quantity}x ${i.productName} — ${formatPrice(i.price)}`)
  if (ctx.items.length > 3) lines.push(`• +${ctx.items.length - 3} món khác`)
  return `🛒 Giỏ hàng:\n${lines.join('\n')}`
}
