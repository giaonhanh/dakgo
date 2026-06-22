// Layer 7: Business Validator
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { SessionContext } from '../types'

let _client: SupabaseClient | null = null
function sb(): SupabaseClient {
  if (!_client) _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  return _client
}

export interface ValidationResult {
  valid:      boolean
  issues:     string[]
  shopIsOpen: boolean
  shopName:   string | null
}

const SKIP_RESULT: ValidationResult = { valid: true, issues: [], shopIsOpen: true, shopName: null }

export async function validateOrder(ctx: SessionContext): Promise<ValidationResult> {
  if (!ctx.shopId || ctx.items.length === 0) return SKIP_RESULT

  const supabase = sb()
  const issues: string[] = []
  let shopIsOpen            = true
  let shopName: string | null = ctx.shopName

  // Parallel: check shop + products cùng lúc
  const productIds = ctx.items.map(i => i.productId).filter(Boolean)

  const [shopRes, productsRes] = await Promise.all([
    supabase
      .from('shops')
      .select('is_open, status, name')
      .eq('id', ctx.shopId)
      .single(),
    productIds.length > 0
      ? supabase
          .from('products')
          .select('id, name, is_available, price')
          .in('id', productIds)
      : Promise.resolve({ data: [] }),
  ])

  // Validate shop
  const shop = shopRes.data
  if (!shop || shop.status !== 'approved') {
    issues.push('Quán này chưa hoạt động trên DakGo')
  } else {
    shopName = shop.name
    if (!shop.is_open) {
      issues.push(`${shop.name} đang đóng cửa`)
      shopIsOpen = false
    }
  }

  // Validate products
  const products = (productsRes.data ?? []) as { id: string; name: string; is_available: boolean; price: number }[]
  for (const item of ctx.items) {
    const p = products.find(x => x.id === item.productId)
    if (p && !p.is_available) issues.push(`${item.productName} hiện đã hết`)
  }

  return { valid: issues.length === 0, issues, shopIsOpen, shopName }
}
