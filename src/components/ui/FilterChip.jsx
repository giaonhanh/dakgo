/**
 * FilterChip — BADGE_SYSTEM_SPEC.md v2.0 Phase 4
 * Toggle chip dùng cho filter bars.
 * active state: --chip-on-* + ti-check icon
 * inactive state: --chip-off-*
 */

import { IconCheck } from "@tabler/icons-react"

export default function FilterChip({ label, active = false, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={{
        display:       "inline-flex",
        alignItems:    "center",
        gap:           3,
        padding:       "4px 10px",
        borderRadius:  "99px",
        border:        `0.5px solid ${active ? "var(--chip-on-bdr)" : "var(--chip-off-bdr)"}`,
        background:    active ? "var(--chip-on-bg)"   : "var(--chip-off-bg)",
        color:         active ? "var(--chip-on-text)"  : "var(--chip-off-text)",
        fontSize:      "11px",
        fontWeight:    500,
        fontFamily:    "'Lexend', sans-serif",
        lineHeight:    1,
        whiteSpace:    "nowrap",
        flexShrink:    0,
        cursor:        "pointer",
        transition:    "background 0.15s, border-color 0.15s, color 0.15s",
        outline:       "none",
        userSelect:    "none",
      }}
    >
      {active && <IconCheck size={10} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
      <span>{label}</span>
    </button>
  )
}
