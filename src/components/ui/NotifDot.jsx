/**
 * NotifDot — BADGE_SYSTEM_SPEC.md Phase 5
 * Dot badge đặt góc trên phải icon (position absolute).
 * Parent phải có position: relative.
 */

export default function NotifDot({ count = 0, className = "" }) {
  if (!count || count <= 0) return null

  const display  = count >= 100 ? "99+" : String(count)
  const isHigh   = count >= 100
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
        borderRadius:   "var(--badge-radius, 9999px)",
        background:     isHigh ? "var(--badge-notif-bg-hi, #FF6B1A)" : "var(--badge-notif-bg, #ff4040)",
        color:          "var(--badge-notif-text, #ffffff)",
        fontSize:       9,
        fontWeight:     700,
        fontFamily:     "'Lexend', sans-serif",
        lineHeight:     1,
        border:         "1.5px solid #080806",
        boxSizing:      "border-box",
      }}
    >
      {display}
    </span>
  )
}
