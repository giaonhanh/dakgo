// Layer 7: Business Validator
import { createClient } from '@supabase/supabase-js'
import type { SessionContext } from '../types'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface ValidationResult {
  valid:       boolean
  issues:      string[]
  shopIsOpen:  boolean
  shopName:    string | null
}

export async function validateOrder(ctx: SessionContext): Promise<ValidationResult> {
  if (!ctx.shopId || ctx.items.length === 0) {
    return { valid: false, issues: [], shopIsOpen: true, shopName: null }
  }

  const supabase = sb()
  const issues:   string[] = []
  let shopIsOpen            = true
  let shopName: string | null = ctx.shopName

  // Check shop
  const { data: shop } = await supabase
    .from('shops')
    .select('is_open, status, name')
    .eq('id', ctx.shopId)
    .single()

  if (!shop || shop.status !== 'approved') {
    issues.push('Quán này chưa hoạt động trên DakGo')
  } else {
    shopName = shop.name
    if (!shop.is_open) {
      issues.push(`${shop.name} đang đóng cửa rồi`)
      shopIsOpen = false
    }
  }

  // Check product availability
  const productIds = ctx.items.map(i => i.productId).filter(Boolean)
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, is_available')
      .in('id', productIds)

    for (const item of ctx.items) {
      const p = products?.find(x => x.id === item.productId)
      if (p && !p.is_available) issues.push(`${item.productName} hiện đã hết`)
    }
  }

  return {
    valid:      issues.length === 0,
    issues,
    shopIsOpen,
    shopName,
  }
}
