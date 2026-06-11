/**
 * SmartVoucherPicker — BADGE_SYSTEM_SPEC.md v2.0 Phase 10
 * findBestVoucherCombo() utility + banner gợi ý.
 * KHÔNG auto-apply — user phải bấm xác nhận.
 */

import { IconSparkles, IconChevronRight, IconX } from "@tabler/icons-react"

// ── Tính savings thực tế ──────────────────────────────────────
export function calcSavings(voucher, cartTotal, shippingFee = 0) {
  const v = voucher
  if (v.minOrder > cartTotal) return 0
  if (v.type === "percent") {
    const raw = cartTotal * (v.value / 100)
    return v.maxDiscount ? Math.min(raw, v.maxDiscount) : raw
  }
  if (v.type === "cash")     return Math.min(v.value, cartTotal)
  if (v.type === "freeship") return shippingFee
  if (v.type === "combo")    return v.value > 0 ? Math.min(v.value, cartTotal) : 0
  return 0
}

// ── findBestVoucherCombo ──────────────────────────────────────
// Trả về voucher cho savings cao nhất tại cartTotal hiện tại.
// Không trả về voucher đã apply hoặc hết hạn/hết lượt.
export function findBestVoucherCombo(cartTotal, vouchers, shippingFee = 0) {
  const now = Date.now()
  const eligible = (vouchers ?? []).filter((v) => {
    if (new Date(v.expiresAt).getTime() <= now) return false
    if (v.totalUses > 0 && v.remainingUses <= 0) return false
    if (v.minOrder > cartTotal) return false
    return true
  })
  if (eligible.length === 0) return null

  let best = null
  let bestSavings = 0
  for (const v of eligible) {
    const s = calcSavings(v, cartTotal, shippingFee)
    if (s > bestSavings) { bestSavings = s; best = v }
  }
  return best ? { voucher: best, savings: bestSavings } : null
}

// ── Format helpers ────────────────────────────────────────────
const fmtFull = (n) => n.toLocaleString("vi-VN") + "đ"
const fmt     = (n) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

function savingsLabel(voucher, savings) {
  if (savings > 0) return `Tiết kiệm ${fmtFull(Math.round(savings))}`
  if (voucher.type === "freeship") return "Miễn phí vận chuyển"
  return "Ưu đãi đặc biệt"
}

function voucherTypeLabel(v) {
  if (v.type === "percent")  return `Giảm ${v.value}%`
  if (v.type === "cash")     return `Giảm ${fmt(v.value)}`
  if (v.type === "freeship") return "Free ship"
  if (v.type === "combo")    return "Voucher Combo"
  return "Voucher"
}

const ACCENT_VAR = {
  percent:  "var(--vou-pct-accent)",
  cash:     "var(--vou-cash-accent)",
  freeship: "var(--vou-ship-accent)",
  combo:    "var(--vou-combo-accent)",
}

// ── SmartVoucherPicker Banner ─────────────────────────────────
export default function SmartVoucherPicker({
  cartTotal = 0,
  shippingFee = 0,
  vouchers = [],
  appliedVoucherId,
  onSuggest,       // (voucher: VoucherItem) => void — mở picker / highlight
  onDismiss,       // () => void — ẩn banner tạm thời
  className = "",
}) {
  // Không show nếu đã apply
  if (appliedVoucherId) return null

  const result = findBestVoucherCombo(cartTotal, vouchers, shippingFee)
  if (!result) return null

  const { voucher: v, savings } = result
  const accent = ACCENT_VAR[v.type] ?? ACCENT_VAR.percent

  return (
    <div
      className={className}
      style={{
        display:       "flex",
        alignItems:    "center",
        gap:           10,
        padding:       "10px 12px",
        borderRadius:  12,
        background:    `color-mix(in srgb, ${accent} 8%, rgba(0,0,0,0.3))`,
        border:        `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
        fontFamily:    "'Lexend', sans-serif",
      }}
    >
      {/* Sparkle icon */}
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        background: `color-mix(in srgb, ${accent} 15%, transparent)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <IconSparkles size={14} strokeWidth={2} color={accent} />
      </div>

      {/* Text block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#e8d8b8", marginBottom: 2 }}>
          Gợi ý tốt nhất cho đơn này
        </div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
          <span style={{ color: accent, fontWeight: 700 }}>{voucherTypeLabel(v)}</span>
          {" · "}
          <span style={{ color: "#d4b896" }}>{savingsLabel(v, savings)}</span>
        </div>
      </div>

      {/* CTA button — KHÔNG auto-apply, mở picker */}
      <button
        type="button"
        onClick={() => onSuggest?.(v)}
        style={{
          display:    "inline-flex",
          alignItems: "center",
          gap:        3,
          padding:    "6px 10px",
          borderRadius: 8,
          background: accent,
          border:     "none",
          cursor:     "pointer",
          fontFamily: "'Lexend', sans-serif",
          fontSize:   10,
          fontWeight: 700,
          color:      "#0a0500",
          flexShrink: 0,
          whiteSpace: "nowrap",
          boxShadow:  `0 2px 8px color-mix(in srgb, ${accent} 40%, transparent)`,
        }}
      >
        Dùng ngay
        <IconChevronRight size={10} strokeWidth={3} />
      </button>

      {/* Dismiss */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 2, display: "flex", alignItems: "center", flexShrink: 0,
          }}
        >
          <IconX size={12} strokeWidth={2.5} color="rgba(255,255,255,0.25)" />
        </button>
      )}
    </div>
  )
}
