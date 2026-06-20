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
}

export interface TextResponse {
  type: "text"
  content: string
}

export type BotResponse = CardResponse | TextResponse

export async function buildShopCards(keyword: string): Promise<CardResponse | null> {
  const supabase = createClient()

  // Tìm quán đang mở có sản phẩm khớp keyword
  const { data: products } = await supabase
    .from("products")
    .select("shop_id, name, price")
    .ilike("name", `%${keyword}%`)
    .eq("is_available", true)
    .order("sold_count", { ascending: false })
    .limit(30)

  if (!products || products.length === 0) return null

  const shopIds = [...new Set(products.map(p => p.shop_id))]

  const { data: shops } = await supabase
    .from("shops")
    .select("id, name, cover_image_url, logo_url, is_open, category")
    .in("id", shopIds)
    .eq("status", "approved")
    .order("is_open", { ascending: false }) // mở trước, đóng sau
    .limit(5)

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
        ? [{ type: "postback" as const, title: "🛵 Đặt ngay", payload: `ORDER_SHOP:${shop.id}:${shop.name}` }]
        : [{ type: "postback" as const, title: "📋 Xem menu", payload: `VIEW_MENU:${shop.id}:${shop.name}` }],
    }
  })

  const openCount = shops.filter(s => s.is_open).length
  const intro = openCount > 0
    ? `🍽️ Mình tìm được ${openCount} quán đang mở có "${keyword}" bạn nhé!`
    : `😔 Hiện các quán có "${keyword}" đang đóng cửa. Bạn xem thử menu để đặt trước nhé!`

  return { type: "cards", intro, elements }
}
