/**
 * VoucherStrip — BADGE_SYSTEM_SPEC.md v2.0 Phase 7
 * Compact horizontal strip cho checkout voucher picker.
 * Left accent bar 4px màu theo type. Selected state highlight.
 */

import { IconCheck, IconClock, IconChevronRight } from "@tabler/icons-react"

const ACCENT = {
  percent:  "var(--vou-pct-accent)",
  cash:     "var(--vou-cash-accent)",
  freeship: "var(--vou-ship-accent)",
  combo:    "var(--vou-combo-accent)",
}

const PANEL = {
  percent:  "var(--vou-pct-panel)",
  cash:     "var(--vou-cash-panel)",
  freeship: "var(--vou-ship-panel)",
  combo:    "var(--vou-combo-panel)",
}

const fmt     = (n) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
const fmtFull = (n) => n.toLocaleString("vi-VN") + "đ"

function shortValue(type, value, maxDiscount) {
  if (type === "percent")  return `Giảm ${value}%${maxDiscount ? ` tối đa ${fmt(maxDiscount)}` : ""}`
  if (type === "cash")     return `Giảm ${fmtFull(value)}`
  if (type === "freeship") return "Miễn phí vận chuyển"
  if (type === "combo")    return value > 0 ? `Combo tiết kiệm ${fmt(value)}` : "Ưu đãi Combo"
  return ""
}

function countdown(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return { label: "Hết hạn", urgent: true }
  const days = Math.floor(ms / 86400000)
  if (days > 1) return { label: `Còn ${days} ngày`, urgent: false }
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return { label: `Còn ${h}h${m > 0 ? ` ${m}m` : ""}`, urgent: true }
}

export default function VoucherStrip({
  voucher,
  selected = false,
  onSelect,
  disabled = false,
}) {
  const v      = voucher
  const accent = ACCENT[v.type] ?? ACCENT.percent
  const panel  = PANEL[v.type]  ?? PANEL.percent
  const cd     = countdown(v.expiresAt)
  const isExpired  = new Date(v.expiresAt).getTime() <= Date.now()
  const isDisabled = disabled || isExpired

  const borderColor = selected
    ? accent
    : "rgba(255,255,255,0.07)"

  const bgColor = selected
    ? `color-mix(in srgb, ${panel} 60%, transparent)`
    : "rgba(255,255,255,0.02)"

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => !isDisabled && onSelect?.(v.id)}
      style={{
        display:       "flex",
        alignItems:    "stretch",
        width:         "100%",
        borderRadius:  10,
        border:        `1px solid ${borderColor}`,
        background:    bgColor,
        overflow:      "hidden",
        cursor:        isDisabled ? "not-allowed" : "pointer",
        opacity:       isDisabled ? 0.45 : 1,
        textAlign:     "left",
        fontFamily:    "'Lexend', sans-serif",
        transition:    "border-color 0.15s, background 0.15s",
        outline:       selected ? `1.5px solid ${accent}` : "none",
        outlineOffset: -1,
        padding:       0,
      }}
    >
      {/* Left accent bar */}
      <div style={{ width: 4, flexShrink: 0, background: accent, borderRadius: "0" }} />

      {/* Content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "10px 12px", gap: 10, minWidth: 0 }}>

        {/* Value block */}
        <div style={{ flexShrink: 0, width: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: accent, fontSize: v.type === "freeship" ? 11 : 18, fontWeight: 800, lineHeight: 1 }}>
            {v.type === "percent"  && `${v.value}%`}
            {v.type === "cash"     && fmt(v.value)}
            {v.type === "freeship" && "Free"}
            {v.type === "combo"    && "Combo"}
          </div>
          {v.type === "cash" && (
            <div style={{ color: accent, fontSize: 8, opacity: 0.7, marginTop: 1 }}>đồng</div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#f0e8d8", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>
            {v.title}
          </div>
          <div style={{ color: "#5a4a30", fontSize: 9.5, marginBottom: 4 }}>
            {shortValue(v.type, v.value, v.maxDiscount)}
            {v.minOrder > 0 ? ` · Tối thiểu ${fmtFull(v.minOrder)}` : ""}
          </div>
          {/* Tags row */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 2,
              fontSize: 9, fontWeight: 600, color: cd.urgent ? "#ff8080" : "#5a4a30",
            }}>
              <IconClock size={8} strokeWidth={2.5} />
              {cd.label}
            </span>
            {v.totalUses > 0 && v.remainingUses / v.totalUses < 0.3 && (
              <span style={{ fontSize: 9, color: "#ff8080", fontWeight: 600 }}>
                · Còn {v.remainingUses} lượt
              </span>
            )}
          </div>
        </div>

        {/* Right — check or chevron */}
        <div style={{ flexShrink: 0 }}>
          {selected ? (
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: accent, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <IconCheck size={11} strokeWidth={3} color="#000" />
            </div>
          ) : (
            <IconChevronRight size={14} strokeWidth={2} color="rgba(255,255,255,0.2)" />
          )}
        </div>
      </div>
    </button>
  )
}
