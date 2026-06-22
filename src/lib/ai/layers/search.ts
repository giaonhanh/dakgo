// Layer 4: Fuzzy Search — pg_trgm via Supabase RPC
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { ProductSearchResult, ShopSearchResult } from '../types'

// ── Singleton client (tránh tạo mới mỗi call trong serverless) ────────────────
let _client: SupabaseClient | null = null
function sb(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

// Ngưỡng similarity: 0.18 — loại bỏ nhiễu, vẫn đủ nhạy cho từ ngắn tiếng Việt
const MIN_SIMILARITY = 0.18

export async function fuzzySearchProducts(query: string, shopId?: string): Promise<ProductSearchResult[]> {
  const supabase = sb()

  // pg_trgm RPC
  const { data: rpc } = await supabase.rpc('search_products_fuzzy', {
    query,
    min_similarity: MIN_SIMILARITY,
  })

  if (rpc && rpc.length > 0) {
    let results = rpc.map(mapProduct)
    // Nếu có shopId, ưu tiên sản phẩm của quán đó lên đầu
    if (shopId) {
      results = [
        ...results.filter(r => r.shopId === shopId),
        ...results.filter(r => r.shopId !== shopId),
      ]
    }
    return results.slice(0, 8)
  }

  // Fallback: ilike
  let q = supabase
    .from('products')
    .select('id, name, price, image_url, shop_id, shops!inner(name, is_open, status)')
    .ilike('name', `%${query}%`)
    .eq('is_available', true)
    .eq('shops.status', 'approved')
    .limit(8)

  if (shopId) q = (q as typeof q).eq('shop_id', shopId)

  const { data } = await q
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

  const { data: rpc } = await supabase.rpc('search_shops_fuzzy', {
    query,
    min_similarity: MIN_SIMILARITY,
  })
  if (rpc && rpc.length > 0) return rpc.map(mapShop).slice(0, 6)

  const { data } = await supabase
    .from('shops')
    .select('id, name, category, is_open, cover_image_url, logo_url, rating_avg')
    .ilike('name', `%${query}%`)
    .eq('status', 'approved')
    .limit(6)

  return (data ?? []).map(s => mapShop({ ...s, similarity: 0.4 }))
}

// Mapping keyword/slug → Supabase category values + từ khoá nhận diện tiếng Việt
const CATEGORY_KEYWORDS: Record<string, { dbValues: string[]; keywords: string[] }> = {
  'com':      { dbValues: ['Cơm', 'Cơm hộp', 'Cơm tấm'], keywords: ['cơm', 'com', 'cơm gà', 'cơm tấm', 'cơm rang'] },
  'bun':      { dbValues: ['Bún', 'Bún bò', 'Bún riêu'], keywords: ['bún', 'bun', 'bún bò', 'bún riêu'] },
  'pho':      { dbValues: ['Phở'],                        keywords: ['phở', 'pho'] },
  'ca-phe':   { dbValues: ['Cà phê', 'Đồ uống'],         keywords: ['cà phê', 'cafe', 'coffee', 'ca phe', 'ca-phe'] },
  'tra-sua':  { dbValues: ['Trà sữa', 'Đồ uống'],        keywords: ['trà sữa', 'tra sua', 'bubble tea', 'trà'] },
  'do-uong':  { dbValues: ['Đồ uống', 'Trà sữa', 'Cà phê', 'Nước giải khát'],
                keywords: ['đồ uống', 'nước', 'nước ngọt', 'nước mát', 'uống', 'giải khát', 'do uong', 'do-uong'] },
  'banh-mi':  { dbValues: ['Bánh mì'],                    keywords: ['bánh mì', 'banh mi'] },
  'lau':      { dbValues: ['Lẩu', 'Nướng', 'Lẩu nướng'], keywords: ['lẩu', 'nướng', 'lau'] },
  'ga-ran':   { dbValues: ['Gà rán', 'Gà', 'Đồ chiên'],  keywords: ['gà rán', 'gà chiên', 'ga ran', 'ga-ran'] },
  'mi':       { dbValues: ['Mỳ', 'Mì'],                   keywords: ['mỳ', 'mì', 'mỳ cay', 'mì cay', 'my cay'] },
}

function detectCategory(query: string): string | undefined {
  const q = query.toLowerCase()
  for (const [, { dbValues, keywords }] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => q.includes(k)) || dbValues.some(c => q.includes(c.toLowerCase()))) {
      return dbValues[0]   // trả về giá trị DB (category đầu tiên)
    }
  }
}

export async function getOpenShops(query?: string): Promise<ShopSearchResult[]> {
  const supabase  = sb()
  const category  = query ? detectCategory(query) : undefined

  let q = supabase
    .from('shops')
    .select('id, name, category, is_open, cover_image_url, logo_url, rating_avg')
    .eq('status', 'approved')
    .eq('is_open', true)
    .order('rating_avg', { ascending: false })
    .limit(8)

  if (category) q = (q as typeof q).eq('category', category)

  const { data } = await q
  return (data ?? []).map(s => mapShop({ ...s, similarity: 1 }))
}

export async function getShopProducts(shopId: string, limit = 12): Promise<ProductSearchResult[]> {
  const supabase = sb()
  const { data } = await supabase
    .from('products')
    .select('id, name, price, image_url, shop_id, shops!inner(name, is_open)')
    .eq('shop_id', shopId)
    .eq('is_available', true)
    .order('sold_count', { ascending: false })
    .limit(limit)

  type Row = {
    id: string; name: string; price: number; image_url: string | null
    shop_id: string; shops: { name: string; is_open: boolean }
  }
  return ((data ?? []) as unknown as Row[]).map(p => ({
    id:         p.id,
    name:       p.name,
    price:      p.price,
    shopId:     p.shop_id,
    shopName:   p.shops.name,
    isOpen:     p.shops.is_open,
    imageUrl:   p.image_url,
    similarity: 1,
  }))
}

function mapProduct(r: {
  id: string; name: string; price: number; shop_id: string
  shop_name: string; is_open: boolean; image_url: string | null; similarity: number
}): ProductSearchResult {
  return {
    id:         r.id,
    name:       r.name,
    price:      r.price,
    shopId:     r.shop_id,
    shopName:   r.shop_name,
    isOpen:     r.is_open,
    imageUrl:   r.image_url,
    similarity: r.similarity,
  }
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
