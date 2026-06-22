// Layer 4: Fuzzy Search — pg_trgm via Supabase RPC
import { createClient } from '@supabase/supabase-js'
import type { ProductSearchResult, ShopSearchResult } from '../types'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function fuzzySearchProducts(query: string): Promise<ProductSearchResult[]> {
  const supabase = sb()

  // Try pg_trgm RPC first
  const { data: rpc } = await supabase.rpc('search_products_fuzzy', {
    query,
    min_similarity: 0.12,
  })

  if (rpc && rpc.length > 0) {
    return rpc.map((r: {
      id: string; name: string; price: number; shop_id: string
      shop_name: string; is_open: boolean; image_url: string | null; similarity: number
    }) => ({
      id:         r.id,
      name:       r.name,
      price:      r.price,
      shopId:     r.shop_id,
      shopName:   r.shop_name,
      isOpen:     r.is_open,
      imageUrl:   r.image_url,
      similarity: r.similarity,
    }))
  }

  // Fallback: ilike
  const { data } = await supabase
    .from('products')
    .select('id, name, price, image_url, shop_id, shops!inner(name, is_open, status)')
    .ilike('name', `%${query}%`)
    .eq('is_available', true)
    .eq('shops.status', 'approved')
    .limit(8)

  type RawProduct = {
    id: string; name: string; price: number; image_url: string | null; shop_id: string
    shops: { name: string; is_open: boolean }
  }
  return ((data ?? []) as unknown as RawProduct[]).map(p => ({
    id:         p.id,
    name:       p.name,
    price:      p.price,
    shopId:     p.shop_id,
    shopName:   p.shops.name,
    isOpen:     p.shops.is_open,
    imageUrl:   p.image_url,
    similarity: 0.4,
  }))
}

export async function fuzzySearchShops(query: string): Promise<ShopSearchResult[]> {
  const supabase = sb()

  const { data: rpc } = await supabase.rpc('search_shops_fuzzy', { query, min_similarity: 0.12 })
  if (rpc && rpc.length > 0) return rpc.map(mapShop)

  const { data } = await supabase
    .from('shops')
    .select('id, name, category, is_open, cover_image_url, logo_url, rating_avg')
    .ilike('name', `%${query}%`)
    .eq('status', 'approved')
    .limit(5)

  return (data ?? []).map(s => mapShop({ ...s, similarity: 0.4 }))
}

export async function getOpenShops(category?: string): Promise<ShopSearchResult[]> {
  const supabase = sb()
  let q = supabase
    .from('shops')
    .select('id, name, category, is_open, cover_image_url, logo_url, rating_avg')
    .eq('status', 'approved')
    .eq('is_open', true)
    .order('rating_avg', { ascending: false })
    .limit(8)

  if (category) q = q.eq('category', category)

  const { data } = await q
  return (data ?? []).map(s => mapShop({ ...s, similarity: 1 }))
}

function mapShop(s: {
  id: string; name: string; category: string; is_open: boolean
  cover_image_url: string | null; logo_url: string | null
  rating_avg: number; similarity: number
}): ShopSearchResult {
  return {
    id:            s.id,
    name:          s.name,
    category:      s.category,
    isOpen:        s.is_open,
    coverImageUrl: s.cover_image_url,
    logoUrl:       s.logo_url,
    ratingAvg:     s.rating_avg,
    similarity:    s.similarity,
  }
}
