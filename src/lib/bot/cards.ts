import { createClient as createSupabaseClient } from "@supabase/supabase-js"

function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface FBButton {
  type: "postback" | "web_url"
  title: string
  payload?: string
  url?: string
}

export interface FBCard {
  title: string
  subtitle: string
  image_url?: string
  buttons: FBButton[]
}

// Quick reply chip — hiện dưới tin nhắn, user tap thay vì gõ
export interface QuickReply {
  content_type: "text" | "location"
  title?: string    // chỉ dùng cho text (max 20 chars)
  payload?: string  // chỉ dùng cho text
  image_url?: string
}

export interface CardResponse {
  type: "cards"
  intro: string
  elements: FBCard[]
  totalOpen?: number
  page?: number
}

// Text + quick reply chips bên dưới (tự biến mất sau khi tap)
export interface TextResponse {
  type: "text"
  content: string
  quick_replies?: QuickReply[]
}

// Button Template — 1-3 nút to dưới tin nhắn (không tự biến mất)
export interface ButtonTemplateResponse {
  type: "button_template"
  text: string
  buttons: FBButton[]
}

export interface WebviewButtonResponse {
  type: "webview_button"
  text: string
  buttonTitle: string
  url: string
}

export interface TextWithWebviewResponse {
  type: "text_with_webview"
  content: string
  buttonTitle: string
  url: string
  quick_replies?: QuickReply[]
}

// Receipt Template — hóa đơn đẹp cho đơn đồ ăn thành công
export interface ReceiptElement {
  title:    string
  quantity: number
  price:    number    // VND
  subtitle?: string
  image_url?: string
}

export interface ReceiptTemplateResponse {
  type:           "receipt_template"
  recipient_name: string
  order_number:   string
  payment_method: string
  elements:       ReceiptElement[]
  subtotal:       number
  shipping_cost:  number
  total_cost:     number
  delivery_address?: string
  timestamp?:     number
}

export type BotResponse =
  | CardResponse
  | TextResponse
  | ButtonTemplateResponse
  | ReceiptTemplateResponse
  | WebviewButtonResponse
  | TextWithWebviewResponse

// ─── Quick reply presets ────────────────────────────────────────────────────────

export const QR_SERVICE_MENU: QuickReply[] = [
  { content_type: "text", title: "🍜 Đồ ăn",  payload: "SERVICE:food" },
  { content_type: "text", title: "📦 Giao hộ", payload: "SERVICE:deliver_for_me" },
  { content_type: "text", title: "🛒 Mua hộ",  payload: "SERVICE:buy_for_me" },
  { content_type: "text", title: "🛵 Xe ôm",   payload: "SERVICE:motorbike" },
  { content_type: "text", title: "🚕 Taxi",     payload: "SERVICE:taxi" },
]

export const QR_LOCATION: QuickReply[] = [
  { content_type: "location" },
  { content_type: "text", title: "✏️ Tôi tự nhập", payload: "TYPE_ADDRESS" },
]

export const QR_CONFIRM_CANCEL: QuickReply[] = [
  { content_type: "text", title: "✅ Đúng rồi",  payload: "LOC_CONFIRMED" },
  { content_type: "text", title: "📍 Sửa lại",   payload: "LOC_RETRY" },
]

export const QR_PAYMENT: QuickReply[] = [
  { content_type: "text", title: "💵 Tiền mặt",     payload: "PAYMENT:cash" },
  { content_type: "text", title: "🏦 Chuyển khoản", payload: "PAYMENT:bank_transfer" },
  { content_type: "text", title: "💙 MoMo",          payload: "PAYMENT:momo" },
]

export const QR_ORDER_ACTION: QuickReply[] = [
  { content_type: "text", title: "🔄 Đặt thêm", payload: "NEW_ORDER" },
  { content_type: "text", title: "📞 Hỗ trợ",   payload: "ESCALATE" },
]

export const QR_RESUME: QuickReply[] = [
  { content_type: "text", title: "▶️ Tiếp tục", payload: "CONTINUE_SESSION" },
  { content_type: "text", title: "🆕 Đặt mới",  payload: "NEW_ORDER" },
]

// Nút confirm to hơn — dùng cho tóm tắt đơn hàng
export function makeConfirmButtons(intent: string): FBButton[] {
  return [
    { type: "postback", title: "✅ Xác nhận đặt", payload: "CONFIRM_ORDER" },
    { type: "postback", title: "✏️ Sửa lại",       payload: "EDIT_ORDER" },
  ]
}

export async function buildShopCards(keyword: string, page = 0): Promise<CardResponse | null> {
  const supabase = createClient()
  const PAGE_SIZE = 2  // mỗi lần show 2 quán

  // Thử tìm với full keyword trước, sau đó fallback từng từ
  let products = null
  const tries = [keyword, ...keyword.split(/\s+/).filter(w => w.length >= 2)]

  for (const kw of tries) {
    const { data } = await supabase
      .from("products")
      .select("shop_id, name, price")
      .ilike("name", `%${kw}%`)
      .eq("is_available", true)
      .order("sold_count", { ascending: false })
      .limit(50)
    if (data && data.length > 0) { products = data; break }
  }

  if (!products || products.length === 0) return null

  const shopIds = [...new Set(products.map(p => p.shop_id))]

  const { data: shops } = await supabase
    .from("shops")
    .select("id, name, cover_image_url, logo_url, is_open, category, slug")
    .in("id", shopIds)
    .eq("status", "approved")
    .eq("is_open", true)
    .limit(20)

  if (!shops || shops.length === 0) return null

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dakgo.com"

  const elements: FBCard[] = shops.map(shop => {
    const shopProducts = products
      .filter(p => p.shop_id === shop.id)
      .slice(0, 3)

    const itemLines = shopProducts
      .map(p => `• ${p.name} — ${(p.price / 1000).toFixed(0)}k`)
      .join("\n")

    const extraCount = products.filter(p => p.shop_id === shop.id).length - 3
    const subtitle = extraCount > 0
      ? `${itemLines}\n• +${extraCount} món khác`
      : itemLines

    const shopUrl = shop.slug
      ? `${APP_URL}/s/${shop.slug}`
      : `${APP_URL}/shop/${shop.id}`

    return {
      title: shop.name,
      subtitle: subtitle || "Xem menu tại quán",
      image_url: shop.cover_image_url ?? shop.logo_url ?? undefined,
      buttons: [
        { type: "postback" as const, title: "🛵 Đặt ngay", payload: `ORDER_SHOP:${shop.id}:${encodeURIComponent(shop.name)}` },
        { type: "web_url" as const,  title: "🏪 Vào quán",  url: shopUrl },
      ],
    }
  })

  const openCount = shops.filter(s => s.is_open).length
  if (elements.length === 0) {
    return {
      type: "cards",
      intro: `😔 Hiện tất cả quán có "${keyword}" đang đóng cửa rồi bạn ơi.\nBạn muốn đặt trước cho lần sau không?`,
      elements: [],
    }
  }

  // Phân trang: mỗi lần show PAGE_SIZE quán
  const paged = elements.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalOpen = elements.length
  const hasMore = (page + 1) * PAGE_SIZE < totalOpen

  let intro = ""
  if (page === 0) {
    intro = totalOpen === 1
      ? `🍽️ Mình tìm được 1 quán đang mở có "${keyword}" bạn nhé!`
      : `🍽️ Mình tìm được ${totalOpen} quán đang mở có "${keyword}"!\nĐây là ${paged.length} quán gần nhất:`
  } else {
    intro = `📋 Thêm ${paged.length} quán nữa bạn nhé:`
  }

  if (hasMore) {
    intro += `\n\n💬 Nhắn "xem thêm" để mình gợi ý thêm quán khác!`
  }

  return { type: "cards", intro, elements: paged, totalOpen, page }
}
