// Layer 10: Action Layer — chat-first, replies ngắn, confidence-based routing
import type { Action, Intent, SessionContext, ConfidenceScore, ProductSearchResult, ShopSearchResult } from '../types'
import type { ValidationResult } from './validator'
import type { MissingField }     from './missing'
import { formatPrice }           from '@/lib/utils'
import { isAutoCheckout, isConfirmMode } from './confidence'

export interface ActionDecision {
  action:       Action
  extraActions: Action[]
  reply:        string
  quickReplies: string[]
}

export interface ActionInput {
  intent:         Intent
  aiIntent:       string | null
  ctx:            SessionContext
  confidence:     ConfidenceScore
  validation:     ValidationResult
  missingField:   MissingField
  productResults: ProductSearchResult[]
  shopResults:    ShopSearchResult[]
  offTopic:       boolean
  isCompetitor?:  boolean
}

export function decideAction(inp: ActionInput): ActionDecision {
  const { intent, ctx, confidence, validation, missingField, productResults, shopResults, offTopic, isCompetitor } = inp

  // ── Competitor mention ────────────────────────────────────────────────────────
  if (isCompetitor) {
    return {
      action:       { type: 'SHOW_SHOP', payload: { shops: shopResults.slice(0, 3) } },
      extraActions: [],
      reply:        'DakGo giao tại Krông Pắc, nhanh và giá tốt hơn 🍜 Gõ tên món là đặt được ngay!',
      quickReplies: [],
    }
  }

  // ── Off-topic ────────────────────────────────────────────────────────────────
  if (offTopic) {
    return {
      action:       { type: 'HUMAN_HANDOFF' },
      extraActions: [],
      reply:        'Mình chỉ hỗ trợ đặt đồ ăn và dịch vụ giao hàng tại Krông Pắc thôi nhé',
      quickReplies: [],
    }
  }

  // ── GREET ────────────────────────────────────────────────────────────────────
  if (intent === 'GREET') {
    return {
      action:       { type: 'SHOW_SHOP', payload: { shops: shopResults.slice(0, 3) } },
      extraActions: [],
      reply:        'Trợ lý DakGo đây! Gõ tên món, địa chỉ hoặc dịch vụ cần là mình lo ngay 🏍️',
      quickReplies: [],
    }
  }

  // ── CANCEL ───────────────────────────────────────────────────────────────────
  if (intent === 'CANCEL') {
    return {
      action:       { type: 'HUMAN_HANDOFF' },
      extraActions: [],
      reply:        'Đã hủy. Muốn đặt lại thì gõ tên món nhé!',
      quickReplies: [],
    }
  }

  // ── MODIFY_CART ───────────────────────────────────────────────────────────────
  if (intent === 'MODIFY_CART') {
    return {
      action:       { type: 'SHOW_PRODUCTS', payload: { products: productResults.slice(0, 6) } },
      extraActions: [],
      reply:        ctx.items.length > 0
        ? `Đang có: ${buildItemSummary(ctx)} — gõ món muốn sửa/thêm/bỏ`
        : 'Giỏ đang trống, gõ tên món muốn đặt',
      quickReplies: [],
    }
  }

  // ── CONFIRM_ORDER — user bấm xác nhận ────────────────────────────────────────
  if (intent === 'CONFIRM_ORDER' && ctx.items.length > 0) {
    if (ctx.address) {
      const total = ctx.items.reduce((s, i) => s + i.price * i.quantity, 0)
      return {
        action: {
          type: 'CHECKOUT',
          payload: { items: ctx.items, address: ctx.address, phone: ctx.phone, total },
        },
        extraActions: [],
        reply:        '',
        quickReplies: [],
      }
    }
    return {
      action:       { type: 'ASK_LOCATION' },
      extraActions: [],
      reply:        'Giao đến đâu? 📍',
      quickReplies: ['📍 Vị trí của tôi'],
    }
  }

  // ── FIND_SHOP / Browse menu ───────────────────────────────────────────────────
  if (intent === 'FIND_SHOP') {
    // Đã biết quán → show menu của quán đó
    if (ctx.shopId && productResults.length > 0) {
      return {
        action:       { type: 'SHOW_PRODUCTS', payload: { products: productResults.slice(0, 12) } },
        extraActions: [],
        reply:        `Menu ${ctx.shopName ?? 'quán'} — gõ tên món muốn đặt:`,
        quickReplies: [],
      }
    }
    // Chưa biết quán → show danh sách quán
    const shops = shopResults.slice(0, 5)
    return {
      action:       { type: 'SHOW_SHOP', payload: { shops } },
      extraActions: [],
      reply:        shops.length > 0
        ? `${shops.length} quán đang mở — chọn quán để xem menu:`
        : 'Chưa có quán nào mở, thử lại sau nhé!',
      quickReplies: [],
    }
  }

  // ── Shop đóng cửa ─────────────────────────────────────────────────────────────
  if (ctx.shopId && !validation.shopIsOpen) {
    return {
      action:       { type: 'SHOW_SHOP', payload: { shops: shopResults.slice(0, 3) } },
      extraActions: [],
      reply:        `${validation.shopName ?? 'Quán này'} đang đóng 😔 Chọn quán khác không?`,
      quickReplies: [],
    }
  }

  // ── Có items → AUTO CHECKOUT (confidence ≥ 0.88) ─────────────────────────────
  if (ctx.items.length > 0 && isAutoCheckout(ctx, confidence)) {
    const total = ctx.items.reduce((s, i) => s + i.price * i.quantity, 0)
    return {
      action: {
        type: 'CHECKOUT',
        payload: { items: ctx.items, address: ctx.address, phone: ctx.phone, total, mode: 'auto' },
      },
      extraActions: [],
      reply:        '',
      quickReplies: [],
    }
  }

  // ── Có items → CONFIRM CARD (confidence 0.65–0.87) ────────────────────────────
  if (ctx.items.length > 0 && isConfirmMode(ctx, confidence)) {
    const total = ctx.items.reduce((s, i) => s + i.price * i.quantity, 0)
    return {
      action: {
        type: 'SHOW_ORDER_CARD',
        payload: { items: ctx.items, address: ctx.address, phone: ctx.phone, shopName: ctx.shopName, total, mode: 'confirm' },
      },
      extraActions: [],
      reply:        'Kiểm tra lại đơn nhé:',
      quickReplies: [],
    }
  }

  // ── Chưa có món nhưng đã chọn quán → show menu ─────────────────────────────
  if (ctx.items.length === 0 && ctx.shopId && productResults.length > 0) {
    return {
      action:       { type: 'SHOW_PRODUCTS', payload: { products: productResults.slice(0, 8) } },
      extraActions: [],
      reply:        `Menu ${ctx.shopName ?? 'quán'} — tap "+" để thêm:`,
      quickReplies: [],
    }
  }

  // ── Chưa có món + search result → show products ──────────────────────────────
  if (ctx.items.length === 0 && productResults.length > 0) {
    return {
      action:       { type: 'SHOW_PRODUCTS', payload: { products: productResults.slice(0, 6) } },
      extraActions: [],
      reply:        'Tìm được mấy món này:',
      quickReplies: [],
    }
  }

  // ── Chưa có món + không tìm thấy ─────────────────────────────────────────────
  if (ctx.items.length === 0) {
    return {
      action:       { type: 'SHOW_SHOP', payload: { shops: shopResults.slice(0, 5) } },
      extraActions: [],
      reply:        shopResults.length > 0
        ? 'Gõ tên món muốn ăn — ví dụ "2 tô phở bò" hoặc "1 cơm gà":'
        : 'Chưa có quán nào mở lúc này, thử lại sau nhé!',
      quickReplies: [],
    }
  }

  // ── Thiếu địa chỉ ─────────────────────────────────────────────────────────────
  if (missingField === 'address') {
    return {
      action:       { type: 'ASK_LOCATION' },
      extraActions: [],
      reply:        `${buildItemSummary(ctx)} — giao đến địa chỉ nào?`,
      quickReplies: ['📍 Vị trí của tôi'],
    }
  }

  // ── Validation issue ──────────────────────────────────────────────────────────
  if (!validation.valid && validation.issues.length > 0) {
    return {
      action:       { type: 'SHOW_PRODUCTS', payload: {} },
      extraActions: [],
      reply:        validation.issues[0] + ' — gõ tên món khác để tìm quán khác nhé',
      quickReplies: [],
    }
  }

  // ── Ready to checkout ─────────────────────────────────────────────────────────
  if (missingField === null && ctx.items.length > 0) {
    const total = ctx.items.reduce((s, i) => s + i.price * i.quantity, 0)
    return {
      action: {
        type: 'CHECKOUT',
        payload: { items: ctx.items, address: ctx.address, phone: ctx.phone, total },
      },
      extraActions: [],
      reply:        '',
      quickReplies: [],
    }
  }

  // ── Fallback: ADD_TO_CART ────────────────────────────────────────────────────
  return {
    action:       { type: 'ADD_TO_CART', payload: { items: ctx.items } },
    extraActions: [],
    reply:        'Thêm vào giỏ rồi! Giao đến đâu? 📍',
    quickReplies: ['📍 Vị trí của tôi'],
  }
}

function buildItemSummary(ctx: SessionContext): string {
  const preview = ctx.items.slice(0, 2).map(i => `${i.quantity} ${i.productName}`).join(', ')
  return ctx.items.length > 2 ? `${preview} +${ctx.items.length - 2} món` : preview
}
