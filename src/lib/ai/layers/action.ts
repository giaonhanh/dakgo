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
  message:        string
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
  faqKey?:        string
  wantsNearby?:   boolean
  category?:      string
}

// Slug → tên hiển thị tiếng Việt
const CATEGORY_LABELS: Record<string, string> = {
  'com':     'cơm', 'bun':    'bún',      'pho':    'phở',
  'ca-phe':  'cà phê', 'tra-sua': 'trà sữa', 'do-uong': 'đồ uống',
  'banh-mi': 'bánh mì', 'lau':    'lẩu',     'ga-ran':  'gà rán',
  'mi':      'mỳ',
}

// Câu trả lời FAQ cố định
const FAQ_REPLIES: Record<string, string> = {
  delivery_fee:  'Phí giao hàng cố định 15.000đ trong xã Krông Pắc. Đơn trên 150k miễn phí ship!',
  delivery_time: 'Thường giao trong 20–35 phút tùy khoảng cách và quán. Đơn đặt giờ cao điểm có thể lâu hơn chút.',
  price_query:   'Giá tuỳ từng món và quán. Gõ tên món để mình tìm giá cụ thể cho bạn nhé!',
  open_hours:    'Mình kiểm tra ngay cho bạn — các quán thường mở 6h–21h. Gõ tên quán muốn hỏi!',
  service_area:  'Mình phục vụ xã Krông Pắc và các xã lân cận: Ea Kly, Ea Yông, Ea Uy, Ea Tiêu. Gõ địa chỉ để mình kiểm tra nhé!',
  payment:       'Mình nhận: 💵 Tiền mặt · 📱 Chuyển khoản · 📲 MoMo · ZaloPay. Chọn khi thanh toán là được!',
}

export function decideAction(inp: ActionInput): ActionDecision {
  const { message, intent, ctx, confidence, validation, missingField, productResults, shopResults, offTopic, isCompetitor, faqKey, wantsNearby, category } = inp

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

  // ── FAQ — trả lời nhanh không cần DB ────────────────────────────────────────
  if (intent === 'FAQ' && faqKey) {
    const reply = FAQ_REPLIES[faqKey] ?? 'Mình chưa có thông tin đó, thử hỏi cụ thể hơn nhé!'
    return {
      action:       { type: 'SHOW_SHOP', payload: { shops: shopResults.slice(0, 3) } },
      extraActions: [],
      reply,
      quickReplies: [],
    }
  }

  // ── Cần vị trí GPS nhưng chưa có ────────────────────────────────────────────
  if (wantsNearby && !ctx.address) {
    const shops = shopResults.slice(0, 5)
    const categoryLabel = category ? ` ${category}` : ''
    return {
      action:       { type: 'ASK_LOCATION' },
      extraActions: shops.length > 0
        ? [{ type: 'SHOW_SHOP', payload: { shops } }]
        : [],
      reply:        shops.length > 0
        ? `Đang có ${shops.length} quán${categoryLabel} mở — chia sẻ vị trí để mình sắp xếp theo khoảng cách gần nhất:`
        : `Chia sẻ vị trí để mình tìm quán${categoryLabel} gần bạn nhất nhé:`,
      quickReplies: ['📍 Vị trí của tôi'],
    }
  }

  // ── GREET ────────────────────────────────────────────────────────────────────
  if (intent === 'GREET') {
    // User gõ tên dịch vụ cụ thể → hướng dẫn đúng dịch vụ đó
    if (/xe ôm/i.test(message)) {
      return { action: { type: 'SHOW_SHOP', payload: {} }, extraActions: [], quickReplies: [],
        reply: 'Đặt xe ôm — gõ địa chỉ đón và điểm đến nhé! Ví dụ: "đón 123 Lê Lợi đến chợ Krông Pắc"' }
    }
    if (/\btaxi\b/i.test(message)) {
      return { action: { type: 'SHOW_SHOP', payload: {} }, extraActions: [], quickReplies: [],
        reply: 'Đặt taxi — gõ điểm đón và điểm đến, mình báo giá ngay! Ví dụ: "taxi từ nhà tôi đến bệnh viện huyện"' }
    }
    if (/mua hộ/i.test(message)) {
      return { action: { type: 'SHOW_SHOP', payload: {} }, extraActions: [], quickReplies: [],
        reply: 'Mua hộ — gõ danh sách đồ cần mua và địa chỉ nhận, mình lo hết!' }
    }
    if (/giao hộ/i.test(message)) {
      return { action: { type: 'SHOW_SHOP', payload: {} }, extraActions: [], quickReplies: [],
        reply: 'Giao hộ — gõ địa chỉ lấy hàng và địa chỉ giao là xong!' }
    }
    if (/giao (hàng|đồ ăn|do an|thức ăn)/i.test(message)) {
      return {
        action:       { type: 'SHOW_SHOP', payload: { shops: shopResults.slice(0, 4) } },
        extraActions: [],
        reply:        'Giao đồ ăn — gõ tên món muốn ăn, mình tìm quán và giao đến tay! 🍜',
        quickReplies: [],
      }
    }
    // Chào đơn thuần → không hiện card, chỉ text
    return {
      action:       { type: 'SHOW_SHOP', payload: { shops: [] } },
      extraActions: [],
      reply:        'Trợ lý DakGo đây! Gõ tên món, địa chỉ hoặc dịch vụ cần là mình lo ngay 🍜',
      quickReplies: [],
    }
  }

  // ── SOCIAL — cảm ơn / khen / đói / không hiểu ───────────────────────────────
  if (intent === 'SOCIAL') {
    // Cảm ơn → thân thiện + mời tiếp tục
    if (/cảm ơn|cam on|thank|thanks|ty/i.test(message)) {
      return {
        action:       { type: 'SHOW_SHOP', payload: { shops: [] } },
        extraActions: [],
        reply:        'Không có chi! Lần sau muốn đặt cứ nhắn mình nhé 😊',
        quickReplies: [],
      }
    }
    // Đói bụng → gợi ý món
    if (/đói/i.test(message)) {
      return {
        action:       { type: 'SHOW_SHOP', payload: { shops: shopResults.slice(0, 4) } },
        extraActions: [],
        reply:        'Đói rồi à! Gõ tên món muốn ăn để mình tìm quán ngay 🍜',
        quickReplies: [],
      }
    }
    // Không hiểu / lỗi
    if (/không hiểu|hả|hở|lỗi|sao vậy/i.test(message)) {
      return {
        action:       { type: 'SHOW_SHOP', payload: { shops: [] } },
        extraActions: [],
        reply:        'Mình chưa hiểu ý bạn 😅 Thử gõ lại theo kiểu: "2 tô bún bò giao 123 Lê Lợi" nhé!',
        quickReplies: [],
      }
    }
    // Khen / tích cực
    return {
      action:       { type: 'SHOW_SHOP', payload: { shops: [] } },
      extraActions: [],
      reply:        'Vui quá! Muốn đặt thêm gì không? Gõ tên món là mình lo ngay 🍜',
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
          payload: { items: ctx.items, shopId: ctx.shopId, shopName: ctx.shopName, address: ctx.address, phone: ctx.phone, total },
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
    // Chưa biết quán → show danh sách quán (đã lọc theo category nếu có)
    const shops    = shopResults.slice(0, 5)
    const catVi    = category ? (CATEGORY_LABELS[category] ?? category) : ''
    const catLabel = catVi ? ` ${catVi}` : ''

    if (shops.length === 0) {
      // Không có quán nào → giải thích rõ lý do
      const noShopReply = catVi
        ? `Hiện các quán ${catVi} chưa mở hoặc ngoài giờ phục vụ 😔\nBạn thử lại sau hoặc hỏi món khác nhé!`
        : 'Hiện tất cả các quán đều chưa mở hoặc ngoài giờ phục vụ của DakGo 😔\nQuý khách thông cảm, thử lại sau nhé!'
      return {
        action:       { type: 'SHOW_SHOP', payload: { shops: [] } },
        extraActions: [],
        reply:        noShopReply,
        quickReplies: [],
      }
    }

    return {
      action:       { type: 'SHOW_SHOP', payload: { shops } },
      extraActions: [],
      reply:        `${shops.length} quán${catLabel} đang mở — chọn quán để xem menu:`,
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
        payload: { items: ctx.items, shopId: ctx.shopId, shopName: ctx.shopName, address: ctx.address, phone: ctx.phone, total, mode: 'auto' },
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
        payload: { items: ctx.items, shopId: ctx.shopId, shopName: ctx.shopName, address: ctx.address, phone: ctx.phone, total },
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
