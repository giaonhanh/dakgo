/**
 * VoucherCard — BADGE_SYSTEM_SPEC.md v2.0 Phase 6
 * Ticket layout với notch pseudo. Left panel màu theo type.
 */

import { IconTicket, IconClock, IconAlertTriangle, IconGift } from "@tabler/icons-react"

// ── Type config ───────────────────────────────────────────────
const TYPE_CFG = {
  percent:  { panelBg: "var(--vou-pct-panel)",   iconBg: "rgba(255,179,71,.15)",  accent: "var(--vou-pct-accent)",   progress: "#FF6B1A" },
  cash:     { panelBg: "var(--vou-cash-panel)",   iconBg: "rgba(62,207,110,.12)",  accent: "var(--vou-cash-accent)",  progress: "#3ecf6e" },
  freeship: { panelBg: "var(--vou-ship-panel)",   iconBg: "rgba(122,179,248,.12)", accent: "var(--vou-ship-accent)",  progress: "#7ab3f8" },
  combo:    { panelBg: "var(--vou-combo-panel)",  iconBg: "rgba(192,132,252,.12)", accent: "var(--vou-combo-accent)", progress: "#a855f7" },
}

// ── Format helpers ────────────────────────────────────────────
const fmt   = (n) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
const fmtFull = (n) => n.toLocaleString("vi-VN") + "đ"

function valueDisplay(type, value, maxDiscount) {
  if (type === "percent")  return { main: `${value}%`,  sub: maxDiscount ? `tối đa ${fmtFull(maxDiscount)}` : "giảm trực tiếp" }
  if (type === "cash")     return { main: fmt(value),   sub: "giảm thẳng" }
  if (type === "freeship") return { main: "Free",       sub: "ship toàn bộ" }
  if (type === "combo")    return { main: "Combo",      sub: value > 0 ? `tiết kiệm ${fmt(value)}` : "ưu đãi đặc biệt" }
  return { main: "", sub: "" }
}

function remainingMinutes(expiresAt) {
  return Math.max(0, (new Date(expiresAt).getTime() - Date.now()) / 60000)
}

function formatCountdown(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return "Đã hết hạn"
  const days = Math.floor(ms / 86400000)
  if (days > 0) return `Còn ${days} ngày`
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `Còn ${h}h ${String(m).padStart(2, "0")}m`
}

// ── Vtag helper ───────────────────────────────────────────────
function VTag({ color = "muted", children }) {
  const vars = {
    orange: { bg: "var(--vtag-o-bg)",    text: "var(--vtag-o-text)",    bdr: "var(--vtag-o-bdr)"    },
    green:  { bg: "var(--vtag-g-bg)",    text: "var(--vtag-g-text)",    bdr: "var(--vtag-g-bdr)"    },
    blue:   { bg: "var(--vtag-b-bg)",    text: "var(--vtag-b-text)",    bdr: "var(--vtag-b-bdr)"    },
    purple: { bg: "var(--vtag-p-bg)",    text: "var(--vtag-p-text)",    bdr: "var(--vtag-p-bdr)"    },
    red:    { bg: "var(--vtag-r-bg)",    text: "var(--vtag-r-text)",    bdr: "var(--vtag-r-bdr)"    },
    muted:  { bg: "var(--vtag-muted-bg)",text: "var(--vtag-muted-text)",bdr: "var(--vtag-muted-bdr)"},
  }
  const v = vars[color] ?? vars.muted
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "1px 6px", borderRadius: 4,
      background: v.bg, color: v.text, border: `1px solid ${v.bdr}`,
      fontSize: 9, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  )
}

// ── Main VoucherCard ──────────────────────────────────────────
export default function VoucherCard({
  voucher,
  onSave,
  onApply,
  onViewCombo,
  showProgress = true,
  showBottomBar = true,
}) {
  const v    = voucher
  const cfg  = TYPE_CFG[v.type] ?? TYPE_CFG.percent
  const val  = valueDisplay(v.type, v.value, v.maxDiscount)
  const mins = remainingMinutes(v.expiresAt)
  const isExpired   = mins <= 0
  const isUrgent    = mins > 0 && mins < 180
  const usageRatio  = v.totalUses > 0 ? v.remainingUses / v.totalUses : null
  const isLowUsage  = usageRatio !== null && usageRatio < 0.3
  const isExhausted = v.remainingUses <= 0 && v.totalUses > 0
  const disabled    = v.isApplied === false && (isExpired || isExhausted)

  // bottom bar message
  let bottomMsg = null
  let bottomColor = "#ff8080"
  if (isLowUsage && !isExpired) {
    bottomMsg = `Còn ${v.remainingUses}/${v.totalUses} lượt · Dùng nhanh kẻo hết`
  } else if (isUrgent) {
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    bottomMsg = `Hết hạn trong ${h}h ${m}m`
  }
  const showComboLink = v.type === "combo" && typeof onViewCombo === "function"

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", opacity: disabled ? 0.55 : 1, fontFamily: "'Lexend', sans-serif" }}>

      {/* Main ticket row */}
      <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", border: `1px solid ${v.isApplied ? cfg.progress + "60" : "rgba(255,255,255,0.07)"}`, borderBottom: (showBottomBar && (bottomMsg || showComboLink)) ? "none" : undefined, borderRadius: (showBottomBar && (bottomMsg || showComboLink)) ? "14px 14px 0 0" : 14 }}>

        {/* Left panel */}
        <div style={{ width: 82, flexShrink: 0, background: cfg.panelBg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 8px", gap: 4, position: "relative" }}>
          {/* Icon circle */}
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: cfg.iconBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 2 }}>
            {v.type === "freeship"
              ? <IconTicket size={16} strokeWidth={2} color={cfg.accent} />
              : v.type === "combo"
              ? <IconGift size={16} strokeWidth={2} color={cfg.accent} />
              : <IconTicket size={16} strokeWidth={2} color={cfg.accent} />}
          </div>
          {/* Value */}
          <div style={{ color: cfg.accent, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{val.main}</div>
          <div style={{ color: cfg.accent, fontSize: 8.5, fontWeight: 500, opacity: 0.8, textAlign: "center", lineHeight: 1.3 }}>{val.sub}</div>

          {/* Notch top */}
          <div style={{ position: "absolute", top: -6, right: -6, width: 12, height: 12, borderRadius: "50%", background: "#080806", zIndex: 2 }} />
          {/* Notch bottom */}
          <div style={{ position: "absolute", bottom: -6, right: -6, width: 12, height: 12, borderRadius: "50%", background: "#080806", zIndex: 2 }} />
          {/* Dashed divider */}
          <div style={{ position: "absolute", top: 6, bottom: 6, right: 0, borderRight: "1px dashed rgba(255,255,255,0.1)" }} />
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, padding: "12px 12px 10px 14px", minWidth: 0 }}>

          {/* Title row */}
          <div style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {v.title}
          </div>

          {/* Description / conditions */}
          <div style={{ color: "#6a5a40", fontSize: 10, lineHeight: 1.5, marginBottom: 7 }}>
            {v.description || (v.type !== "combo" && v.minOrder > 0 ? `Đơn tối thiểu ${fmtFull(v.minOrder)}` : "")}
            {v.scope && v.scope !== "all" ? ` · ${v.scope}` : ""}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 8 }} />

          {/* Tags + button row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            {/* Tags */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
              {/* Countdown */}
              {!isExpired && (
                <VTag color={isUrgent ? "red" : "muted"}>
                  <IconClock size={8} strokeWidth={2.5} style={{ marginRight: 2 }} />
                  {formatCountdown(v.expiresAt)}
                </VTag>
              )}
              {isExpired && <VTag color="red">Đã hết hạn</VTag>}
              {/* Usage */}
              {v.totalUses > 0 && (
                <VTag color={isLowUsage ? "red" : "muted"}>
                  {isLowUsage && <IconAlertTriangle size={8} strokeWidth={2.5} style={{ marginRight: 2 }} />}
                  Còn {v.remainingUses} lượt
                </VTag>
              )}
              {/* Applied state */}
              {v.isApplied && <VTag color="green">✓ Đang dùng</VTag>}
            </div>

            {/* Action button */}
            {v.isApplied ? (
              <button
                onClick={() => onApply(v.id)}
                style={{ ...btnStyle("ghost-green"), flexShrink: 0 }}
              >
                ✓ Đang dùng
              </button>
            ) : disabled ? null : (
              <button
                onClick={() => v.isSaved ? onApply(v.id) : onSave(v.id)}
                style={{ ...btnStyle(v.isSaved ? "ghost-green" : "primary"), flexShrink: 0 }}
              >
                {v.isSaved ? "Đã lưu" : "Lưu ngay"}
              </button>
            )}
          </div>

          {/* Progress bar — lượt dùng */}
          {showProgress && v.totalUses > 0 && !isExpired && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  background: cfg.progress,
                  width: `${Math.round((v.remainingUses / v.totalUses) * 100)}%`,
                  transition: "width .4s ease",
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      {showBottomBar && (bottomMsg || showComboLink) && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "5px 12px 5px 14px",
          background: v.type === "combo" ? "rgba(192,132,252,0.07)" : "rgba(255,128,128,0.07)",
          border: `1px solid ${v.type === "combo" ? "rgba(192,132,252,0.2)" : "rgba(255,128,128,0.18)"}`,
          borderTop: "none", borderRadius: "0 0 14px 14px",
        }}>
          {bottomMsg && (
            <span style={{ fontSize: 9.5, color: bottomColor, fontWeight: 600 }}>
              {bottomMsg}
            </span>
          )}
          {showComboLink && (
            <button
              onClick={onViewCombo}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Lexend', sans-serif", fontSize: 9.5, color: "var(--vou-combo-accent)", fontWeight: 700 }}
            >
              Xem món Combo →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Button style helper ───────────────────────────────────────
function btnStyle(variant) {
  const base = { border: "none", cursor: "pointer", borderRadius: 8, padding: "5px 12px", fontSize: 10.5, fontWeight: 700, fontFamily: "'Lexend', sans-serif", whiteSpace: "nowrap" }
  if (variant === "primary")     return { ...base, background: "#FF6B1A", color: "#fff", boxShadow: "0 2px 8px rgba(255,107,26,.35)" }
  if (variant === "ghost-green") return { ...base, background: "rgba(62,207,110,.1)", color: "#3ecf6e", border: "1px solid rgba(62,207,110,.3)" }
  return base
}
