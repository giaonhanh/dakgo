/**
 * VoucherNudgeBar — BADGE_SYSTEM_SPEC.md v2.0 Phase 8
 * Hiển thị trong checkout: nudge mua thêm để đạt ngưỡng voucher.
 * States: hidden | nudge (progress + pulse) | done (đủ điều kiện)
 */

import { IconTicket, IconCheck, IconChevronRight } from "@tabler/icons-react"

const fmt     = (n) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
const fmtFull = (n) => n.toLocaleString("vi-VN") + "đ"

// ── findNextThreshold ─────────────────────────────────────────
// Trả về voucher có minOrder gần nhất mà cartTotal chưa đạt.
// Nếu tất cả đã đạt → trả về voucher tốt nhất (để show done state).
export function findNextThreshold(cartTotal, vouchers) {
  const now = Date.now()
  const available = (vouchers ?? []).filter((v) => {
    if (new Date(v.expiresAt).getTime() <= now) return false
    if (v.totalUses > 0 && v.remainingUses <= 0) return false
    return true
  })
  if (available.length === 0) return null

  // Vouchers chưa đạt ngưỡng, sort theo minOrder tăng dần
  const unreached = available
    .filter((v) => v.minOrder > cartTotal)
    .sort((a, b) => a.minOrder - b.minOrder)

  if (unreached.length > 0) return { voucher: unreached[0], reached: false }

  // Tất cả đã đạt → pick voucher tốt nhất (giá trị discount lớn nhất)
  const best = available.sort((a, b) => {
    const valA = a.type === "percent" ? (a.maxDiscount ?? a.value * 1000) : a.value
    const valB = b.type === "percent" ? (b.maxDiscount ?? b.value * 1000) : b.value
    return valB - valA
  })[0]
  return { voucher: best, reached: true }
}

function voucherLabel(v) {
  if (v.type === "percent")  return `giảm ${v.value}%${v.maxDiscount ? ` tối đa ${fmt(v.maxDiscount)}` : ""}`
  if (v.type === "cash")     return `giảm ${fmtFull(v.value)}`
  if (v.type === "freeship") return "miễn phí vận chuyển"
  if (v.type === "combo")    return `ưu đãi Combo${v.value > 0 ? ` -${fmt(v.value)}` : ""}`
  return "ưu đãi"
}

const ACCENT_VAR = {
  percent:  "var(--vou-pct-accent)",
  cash:     "var(--vou-cash-accent)",
  freeship: "var(--vou-ship-accent)",
  combo:    "var(--vou-combo-accent)",
}

// ── Component ─────────────────────────────────────────────────
export default function VoucherNudgeBar({
  cartTotal = 0,
  vouchers = [],
  onPickVoucher,
  appliedVoucherId,
  className = "",
}) {
  // Không hiển thị nếu đã áp dụng voucher
  if (appliedVoucherId) return null

  const result = findNextThreshold(cartTotal, vouchers)
  if (!result) return null

  const { voucher: v, reached } = result
  const accent  = ACCENT_VAR[v.type] ?? ACCENT_VAR.percent
  const progress = reached ? 1 : Math.min(cartTotal / v.minOrder, 0.999)
  const isNearlyThere = !reached && progress >= 0.7
  const remaining = v.minOrder - cartTotal

  return (
    <button
      type="button"
      onClick={onPickVoucher}
      className={`${className} ${isNearlyThere ? "nudge-pulse" : ""}`.trim()}
      style={{
        display:       "flex",
        flexDirection: "column",
        width:         "100%",
        gap:           7,
        padding:       "10px 12px",
        borderRadius:  12,
        border:        `1px solid ${reached ? "rgba(62,207,110,0.35)" : `color-mix(in srgb, ${accent} 25%, transparent)`}`,
        background:    reached ? "rgba(62,207,110,0.06)" : "rgba(255,255,255,0.03)",
        cursor:        "pointer",
        textAlign:     "left",
        fontFamily:    "'Lexend', sans-serif",
        outline:       "none",
        transition:    "border-color 0.15s",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
          {/* Icon */}
          <div style={{
            width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
            background: reached ? "rgba(62,207,110,0.15)" : `color-mix(in srgb, ${accent} 12%, transparent)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {reached
              ? <IconCheck size={12} strokeWidth={3} color="#3ecf6e" />
              : <IconTicket size={12} strokeWidth={2} color={accent} />}
          </div>

          {/* Message */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {reached ? (
              <span style={{ color: "#3ecf6e", fontSize: 11.5, fontWeight: 700 }}>
                Đủ điều kiện! Chọn voucher {voucherLabel(v)} ngay
              </span>
            ) : (
              <span style={{ color: "#c0a878", fontSize: 11, fontWeight: 600, lineHeight: 1.4 }}>
                Mua thêm{" "}
                <span style={{ color: accent, fontWeight: 800 }}>{fmtFull(remaining)}</span>
                {" "}để được{" "}
                <span style={{ color: accent }}>{voucherLabel(v)}</span>
              </span>
            )}
          </div>
        </div>

        <IconChevronRight size={14} strokeWidth={2} color={reached ? "#3ecf6e" : "rgba(255,255,255,0.25)"} style={{ flexShrink: 0 }} />
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{
          height:     "100%",
          borderRadius: 99,
          background: reached ? "#3ecf6e" : accent,
          width:      `${Math.round(progress * 100)}%`,
          transition: "width 0.4s ease",
          boxShadow:  isNearlyThere ? `0 0 6px ${accent}` : "none",
        }} />
      </div>

      {/* Progress label */}
      {!reached && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: -3 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
            {fmtFull(cartTotal)}
          </span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
            {fmtFull(v.minOrder)}
          </span>
        </div>
      )}
    </button>
  )
}
