// Layer 6: Confidence Layer
import type { ConfidenceScore, SessionContext } from '../types'

export function calculateConfidence(ctx: SessionContext): ConfidenceScore {
  const hasItems         = ctx.items.length > 0
  const allResolved      = hasItems && ctx.items.every(i => i.productId.length > 0)
  const avgConf          = hasItems
    ? ctx.items.reduce((s, i) => s + i.confidence, 0) / ctx.items.length
    : 0

  const breakdown = {
    hasItems:      hasItems    ? 0.20 : 0,
    itemsResolved: allResolved ? 0.20 * avgConf : avgConf * 0.10,
    hasShop:       ctx.shopId  ? 0.15 : 0,
    hasAddress:    ctx.address ? 0.30 : 0,
    hasPhone:      ctx.phone   ? 0.15 : 0,
  }

  return {
    total:     Math.min(1, Object.values(breakdown).reduce((a, b) => a + b, 0)),
    breakdown,
  }
}

export function isReadyToCheckout(ctx: SessionContext): boolean {
  return (
    ctx.items.length > 0 &&
    ctx.items.every(i => i.productId.length > 0) &&
    ctx.shopId   !== null &&
    ctx.address  !== null
    // phone optional for first release
  )
}
