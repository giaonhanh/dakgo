/**
 * NotifDot — BADGE_SYSTEM_SPEC.md v2.0 Phase 5
 * Position absolute dot đặt góc trên phải icon.
 * Parent phải có position: relative.
 * type "notification" → --notif-dot-bg (#ff4040)
 * type "cart"         → --cart-dot-bg  (#FF6B1A)
 */

export default function NotifDot({ count = 0, type = "notification", className = "" }) {
  if (!count || count <= 0) return null

  const display  = count >= 100 ? "99+" : String(count)
  const isHigh   = count >= 100
  const bg       = type === "cart" ? "var(--cart-dot-bg)" : "var(--notif-dot-bg)"
  const minWidth = isHigh ? 20 : 16

  return (
    <span
      className={className}
      style={{
        position:       "absolute",
        top:            -4,
        right:          -4,
        zIndex:         10,
        display:        "inline-flex",
        alignItems:     "center",
        justifyContent: "center",
        minWidth:       minWidth,
        height:         16,
        padding:        "0 3px",
        borderRadius:   "9999px",
        background:     bg,
        color:          "#ffffff",
        fontSize:       9,
        fontWeight:     700,
        fontFamily:     "'Lexend', sans-serif",
        lineHeight:     1,
        border:         "1.5px solid #080806",
        boxSizing:      "border-box",
        pointerEvents:  "none",
      }}
    >
      {display}
    </span>
  )
}
