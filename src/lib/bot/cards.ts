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

export interface CardResponse {
  type: "cards"
  intro: string
  elements: FBCard[]
  totalOpen?: number
  page?: number
}

export interface TextResponse {
  type: "text"
  content: string
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
}

export type BotResponse = CardResponse | TextResponse | WebviewButtonResponse | TextWithWebviewResponse

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
    .select("id, name, cover_image_url, logo_url, is_open, category")
    .in("id", shopIds)
    .eq("status", "approved")
    .eq("is_open", true)  // chỉ lấy quán đang mở
    .limit(20)

  if (!shops || shops.length === 0) return null

  const elements: FBCard[] = shops.map(shop => {
    const shopProducts = products
      .filter(p => p.shop_id === shop.id)
      .slice(0, 3)

    // Subtitle tối đa ~200 ký tự
    const itemLines = shopProducts
      .map(p => `• ${p.name} — ${(p.price / 1000).toFixed(0)}k`)
      .join("\n")

    const extraCount = products.filter(p => p.shop_id === shop.id).length - 3
    const subtitle = extraCount > 0
      ? `${itemLines}\n• +${extraCount} món khác`
      : itemLines

    const status = shop.is_open ? "" : " (Đang đóng cửa)"

    return {
      title: `${shop.name}${status}`,
      subtitle: subtitle || "Xem menu tại quán",
      image_url: shop.cover_image_url ?? shop.logo_url ?? undefined,
      buttons: shop.is_open
        ? [{ type: "postback" as const, title: "🛵 Đặt ngay", payload: `ORDER_SHOP:${shop.id}:${encodeURIComponent(shop.name)}` }]
        : [{ type: "postback" as const, title: "📋 Xem menu", payload: `VIEW_MENU:${shop.id}:${encodeURIComponent(shop.name)}` }],
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
