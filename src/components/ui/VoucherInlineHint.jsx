/**
 * VoucherInlineHint — BADGE_SYSTEM_SPEC.md v2.0 Phase 9
 * Inline hint 9px. 3 states: applied | nudge | none (returns null).
 * Dùng dưới subtotal hoặc inline trong cart summary.
 */

import { IconCheck, IconTag } from "@tabler/icons-react"

const fmt     = (n) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
const fmtFull = (n) => n.toLocaleString("vi-VN") + "đ"

function voucherShortLabel(v) {
  if (!v) return ""
  if (v.type === "percent")  return `−${v.value}%${v.maxDiscount ? ` (tối đa ${fmt(v.maxDiscount)})` : ""}`
  if (v.type === "cash")     return `−${fmtFull(v.value)}`
  if (v.type === "freeship") return "Free ship"
  if (v.type === "combo")    return v.value > 0 ? `Combo −${fmt(v.value)}` : "Combo"
  return ""
}

const ACCENT_VAR = {
  percent:  "var(--vou-pct-accent)",
  cash:     "var(--vou-cash-accent)",
  freeship: "var(--vou-ship-accent)",
  combo:    "var(--vou-combo-accent)",
}

// ── Component ─────────────────────────────────────────────────
export default function VoucherInlineHint({
  appliedVoucher,   // VoucherItem | null — voucher đang áp dụng
  nudgeVoucher,     // VoucherItem | null — voucher gần đạt ngưỡng
  cartTotal = 0,
  onClick,
  className = "",
}) {
  // State: applied
  if (appliedVoucher) {
    const accent = ACCENT_VAR[appliedVoucher.type] ?? ACCENT_VAR.percent
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        style={hintBtn()}
      >
        <IconCheck size={9} strokeWidth={3} color="#3ecf6e" style={{ flexShrink: 0 }} />
        <span style={{ color: "#3ecf6e", fontWeight: 700 }}>
          Voucher&nbsp;{voucherShortLabel(appliedVoucher)}
        </span>
        <span style={{ color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>đổi →</span>
      </button>
    )
  }

  // State: nudge
  if (nudgeVoucher) {
    const remaining = Math.max(0, nudgeVoucher.minOrder - cartTotal)
    const accent    = ACCENT_VAR[nudgeVoucher.type] ?? ACCENT_VAR.percent
    if (remaining <= 0) return null // đủ ngưỡng rồi — NudgeBar lo phần done
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        style={hintBtn()}
      >
        <IconTag size={9} strokeWidth={2.5} color={accent} style={{ flexShrink: 0 }} />
        <span style={{ color: "rgba(255,255,255,0.45)" }}>
          Thêm&nbsp;
          <span style={{ color: accent, fontWeight: 700 }}>{fmtFull(remaining)}</span>
          &nbsp;→ được {voucherShortLabel(nudgeVoucher)}
        </span>
      </button>
    )
  }

  // State: none
  return null
}

function hintBtn() {
  return {
    display:       "inline-flex",
    alignItems:    "center",
    gap:           4,
    padding:       "3px 8px 3px 6px",
    borderRadius:  6,
    background:    "rgba(255,255,255,0.04)",
    border:        "1px solid rgba(255,255,255,0.07)",
    cursor:        "pointer",
    fontFamily:    "'Lexend', sans-serif",
    fontSize:      9,
    fontWeight:    500,
    lineHeight:    1.4,
    outline:       "none",
    whiteSpace:    "nowrap",
  }
}
