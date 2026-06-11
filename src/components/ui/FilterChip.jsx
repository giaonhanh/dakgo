/**
 * FilterChip — BADGE_SYSTEM_SPEC.md Phase 4
 * Toggle chip dùng cho filter bars (danh-muc, nearby-shops, vouchers…)
 */

import { IconCheck } from "@tabler/icons-react"

export default function FilterChip({ label, active = false, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            3,
        height:         "var(--badge-height-md, 22px)",
        padding:        `var(--badge-py-md, 3px) var(--badge-px-md, 9px)`,
        borderRadius:   "var(--badge-radius, 9999px)",
        border:         `1px solid ${active ? "var(--badge-filter-active-border)" : "var(--badge-filter-inactive-border)"}`,
        background:     active ? "var(--badge-filter-active-bg)" : "var(--badge-filter-inactive-bg)",
        color:          active ? "var(--badge-filter-active-text)" : "var(--badge-filter-inactive-text)",
        fontSize:       "var(--badge-font-md, 11px)",
        fontWeight:     "var(--badge-font-weight, 500)",
        fontFamily:     "'Lexend', sans-serif",
        lineHeight:     1,
        whiteSpace:     "nowrap",
        flexShrink:     0,
        cursor:         "pointer",
        transition:     "background 0.15s, border-color 0.15s, color 0.15s",
        outline:        "none",
      }}
    >
      {active && <IconCheck size={12} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
      <span>{label}</span>
    </button>
  )
}
