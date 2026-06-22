// Layer 6: Confidence Layer
import type { ConfidenceScore, SessionContext } from '../types'

// Phone là OPTIONAL — không đưa vào blocking logic
// Chỉ cần: items resolved + shop + address → có thể checkout
export function calculateConfidence(ctx: SessionContext, aiScore = 0): ConfidenceScore {
  const hasItems    = ctx.items.length > 0
  const allResolved = hasItems && ctx.items.every(i => i.productId.length > 0)
  const avgConf     = hasItems
    ? ctx.items.reduce((s, i) => s + i.confidence, 0) / ctx.items.length
    : 0

  const breakdown = {
    hasItems:      hasItems    ? 0.20 : 0,
    itemsResolved: allResolved ? 0.30 * avgConf : avgConf * 0.15,  // tăng trọng số
    hasShop:       ctx.shopId  ? 0.20 : 0,                          // tăng từ 0.15
    hasAddress:    ctx.address ? 0.30 : 0,                          // giữ nguyên
    hasPhone:      ctx.phone   ? 0.05 : 0,                          // giảm xuống 0.05 (optional bonus)
  }

  const contextScore = Math.min(1, Object.values(breakdown).reduce((a, b) => a + b, 0))
  // Blend: context 70% + AI score 30% (chỉ khi AI trả về confidence > 0)
  const total = aiScore > 0
    ? Math.min(1, contextScore * 0.70 + aiScore * 0.30)
    : contextScore

  return { total, aiScore, breakdown }
}

// ≥ 0.88 + đủ điều kiện → AUTO CHECKOUT (phone optional, không blocking)
// Max score không phone = 1.00 với weights mới → 0.88 hoàn toàn đạt được
export function isAutoCheckout(ctx: SessionContext, confidence: ConfidenceScore): boolean {
  return (
    ctx.items.length > 0 &&
    ctx.items.every(i => i.productId.length > 0) &&
    ctx.shopId   !== null &&
    ctx.address  !== null &&
    confidence.total >= 0.88
  )
}

// ≥ 0.65 → CONFIRM CARD (user xem lại trước khi chốt)
export function isConfirmMode(ctx: SessionContext, confidence: ConfidenceScore): boolean {
  return (
    ctx.items.length > 0 &&
    ctx.items.every(i => i.productId.length > 0) &&
    ctx.shopId  !== null &&
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
