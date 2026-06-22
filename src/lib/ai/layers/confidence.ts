// Layer 6: Confidence Layer
import type { ConfidenceScore, SessionContext } from '../types'

export function calculateConfidence(ctx: SessionContext, aiScore = 0): ConfidenceScore {
  const hasItems    = ctx.items.length > 0
  const allResolved = hasItems && ctx.items.every(i => i.productId.length > 0)
  const avgConf     = hasItems
    ? ctx.items.reduce((s, i) => s + i.confidence, 0) / ctx.items.length
    : 0

  const breakdown = {
    hasItems:      hasItems    ? 0.20 : 0,
    itemsResolved: allResolved ? 0.20 * avgConf : avgConf * 0.10,
    hasShop:       ctx.shopId  ? 0.15 : 0,
    hasAddress:    ctx.address ? 0.30 : 0,
    hasPhone:      ctx.phone   ? 0.15 : 0,
  }

  const contextScore = Math.min(1, Object.values(breakdown).reduce((a, b) => a + b, 0))
  // Blend context score (70%) với AI extraction confidence (30%)
  const total = aiScore > 0
    ? Math.min(1, contextScore * 0.70 + aiScore * 0.30)
    : contextScore

  return { total, aiScore, breakdown }
}

// ≥ 0.90 → auto checkout (đủ items + shop + address + độ chắc cao)
export function isAutoCheckout(ctx: SessionContext, confidence: ConfidenceScore): boolean {
  return (
    ctx.items.length > 0 &&
    ctx.items.every(i => i.productId.length > 0) &&
    ctx.shopId   !== null &&
    ctx.address  !== null &&
    confidence.total >= 0.88
  )
}

// ≥ 0.70 → show confirm card (cần user xác nhận)
export function isConfirmMode(ctx: SessionContext, confidence: ConfidenceScore): boolean {
  return (
    ctx.items.length > 0 &&
    ctx.items.every(i => i.productId.length > 0) &&
    ctx.shopId !== null &&
    ctx.address !== null &&
    confidence.total >= 0.65
  )
}

export function isReadyToCheckout(ctx: SessionContext): boolean {
  return (
    ctx.items.length > 0 &&
    ctx.items.every(i => i.productId.length > 0) &&
    ctx.shopId  !== null &&
    ctx.address !== null
  )
}
