/**
 * Badge component — BADGE_SYSTEM_SPEC.md v2.0 Phase 3
 * 3-layer architecture. Dark-only. border-radius: 9999px. No gradients.
 */

import {
  IconFlame, IconSparkles, IconBolt, IconTag, IconGift,
  IconCircleCheck, IconShoppingCart, IconPepper,
  IconMedal, IconDiamond,
  IconStar, IconMapPin, IconTicket, IconX, IconClock,
  IconAlertTriangle, IconCheck,
  IconBike, IconMotorbike, IconCar, IconTruck,
} from "@tabler/icons-react"

// ── Icon map ─────────────────────────────────────────────────
const ICONS = {
  flame:            IconFlame,
  sparkles:         IconSparkles,
  bolt:             IconBolt,
  tag:              IconTag,
  gift:             IconGift,
  "circle-check":   IconCircleCheck,
  "shopping-cart":  IconShoppingCart,
  pepper:           IconPepper,
  medal:            IconMedal,
  diamond:          IconDiamond,
  star:             IconStar,
  "map-pin":        IconMapPin,
  ticket:           IconTicket,
  x:                IconX,
  clock:            IconClock,
  "alert-triangle": IconAlertTriangle,
  check:            IconCheck,
  bike:             IconBike,
  motorbike:        IconMotorbike,
  car:              IconCar,
  truck:            IconTruck,
}

// ── Layer 1 — Tonal config ───────────────────────────────────
const L1 = {
  fire:     { bg: "var(--badge-fire-bg)",     text: "var(--badge-fire-text)",     icon: "flame",          label: "Bán chạy" },
  new:      { bg: "var(--badge-new-bg)",      text: "var(--badge-new-text)",      icon: "sparkles",       label: "Mới ra"   },
  hot:      { bg: "var(--badge-hot-bg)",      text: "var(--badge-hot-text)",      icon: "bolt",           label: "Hot"      },
  sale:     { bg: "var(--badge-sale-bg)",     text: "var(--badge-sale-text)",     icon: "tag",            label: "Sale"     },
  combo:    { bg: "var(--badge-combo-bg)",    text: "var(--badge-combo-text)",    icon: "gift",           label: "Combo"    },
  partner:  { bg: "var(--badge-partner-bg)",  text: "var(--badge-partner-text)",  icon: "circle-check",   label: "Đối tác"  },
  proxy:    { bg: "var(--badge-proxy-bg)",    text: "var(--badge-proxy-text)",    icon: "shopping-cart",  label: "Mua hộ"   },
  "spicy-1":{ bg: "var(--badge-spicy1-bg)",  text: "var(--badge-spicy1-text)",   icon: "pepper",         label: "Cay nhẹ"  },
  "spicy-2":{ bg: "var(--badge-spicy2-bg)",  text: "var(--badge-spicy2-text)",   icon: "pepper",         label: "Cay vừa"  },
  "spicy-3":{ bg: "var(--badge-spicy3-bg)",  text: "var(--badge-spicy3-text)",   icon: "pepper",         label: "Cay mạnh" },
  "rank-1": { bg: "var(--badge-rank1-bg)",   text: "var(--badge-rank1-text)",    icon: "medal",          label: "#1"       },
  "rank-2": { bg: "var(--badge-rank2-bg)",   text: "var(--badge-rank2-text)",    icon: "medal",          label: "#2"       },
  "rank-3": { bg: "var(--badge-rank3-bg)",   text: "var(--badge-rank3-text)",    icon: "medal",          label: "#3"       },
  "rank-n": { bg: "var(--badge-rankn-bg)",   text: "var(--badge-rankn-text)",    icon: null,             label: ""         },
  bronze:   { bg: "var(--badge-bronze-bg)",   text: "var(--badge-bronze-text)",   icon: "medal",          label: "Bronze"   },
  silver:   { bg: "var(--badge-silver-bg)",   text: "var(--badge-silver-text)",   icon: "medal",          label: "Silver"   },
  gold:     { bg: "var(--badge-gold-bg)",     text: "var(--badge-gold-text)",     icon: "medal",          label: "Gold"     },
  platinum: { bg: "var(--badge-platinum-bg)", text: "var(--badge-platinum-text)", icon: "diamond",        label: "Platinum" },
}

// ── Layer 2 — Ghost config ───────────────────────────────────
const L2 = {
  discount:      { text: "var(--badge-discount-text)", bdr: "var(--badge-discount-bdr)", icon: "tag",             label: "-X%"         },
  rating:        { text: "var(--badge-rating-text)",   bdr: "var(--badge-rating-bdr)",   icon: "star",            label: ""            },
  distance:      { text: "var(--badge-dist-text)",     bdr: "var(--badge-dist-bdr)",     icon: "map-pin",         label: ""            },
  "voucher-count":{ text: "var(--badge-vou-text)",     bdr: "var(--badge-vou-bdr)",      icon: "ticket",          label: ""            },
  "has-combo":   { text: "var(--badge-hc-text)",       bdr: "var(--badge-hc-bdr)",       icon: "gift",            label: "Có Combo"    },
  "sold-count":  { text: "var(--badge-soldct-text)",   bdr: "var(--badge-soldct-bdr)",   icon: "flame",           label: ""            },
  "sold-out":    { text: "var(--badge-soldout-text)",  bdr: "var(--badge-soldout-bdr)",  icon: "x",               label: "Hết hàng"    },
  "expire-urgent":{ text: "var(--badge-urgent-text)",  bdr: "var(--badge-urgent-bdr)",   icon: "clock",           label: ""            },
  "low-usage":   { text: "var(--badge-lowuse-text)",   bdr: "var(--badge-lowuse-bdr)",   icon: "alert-triangle",  label: ""            },
}

// ── Layer 3 — Status config ──────────────────────────────────
const L3 = {
  open:      { bg: "var(--badge-open-bg)",    text: "var(--badge-open-text)",    bdr: "var(--badge-open-bdr)",    indicator: "dot",   label: "Đang mở"      },
  closed:    { bg: "var(--badge-closed-bg)",  text: "var(--badge-closed-text)",  bdr: "var(--badge-closed-bdr)",  indicator: "dot",   label: "Đóng cửa"     },
  going:     { bg: "var(--badge-going-bg)",   text: "var(--badge-going-text)",   bdr: "var(--badge-going-bdr)",   indicator: "ring",  label: "Đang giao"    },
  pending:   { bg: "var(--badge-pending-bg)", text: "var(--badge-pending-text)", bdr: "var(--badge-pending-bdr)", indicator: "clock", label: "Chờ xác nhận" },
  done:      { bg: "var(--badge-done-bg)",    text: "var(--badge-done-text)",    bdr: "var(--badge-done-bdr)",    indicator: "check", label: "Hoàn thành"   },
  cancelled: { bg: "var(--badge-cancel-bg)",  text: "var(--badge-cancel-text)",  bdr: "var(--badge-cancel-bdr)",  indicator: "x",     label: "Đã huỷ"       },
}

// ── Size map ──────────────────────────────────────────────────
const SZ = {
  sm: { font: "var(--badge-font-sm)", icon: 11, px: "var(--badge-px-sm)", py: "var(--badge-py-sm)" },
  md: { font: "var(--badge-font-md)", icon: 12, px: "var(--badge-px-md)", py: "var(--badge-py-md)" },
  lg: { font: "var(--badge-font-lg)", icon: 14, px: "var(--badge-px-lg)", py: "var(--badge-py-lg)" },
}

// ── Going icon by serviceType ─────────────────────────────────
function goingIcon(serviceType) {
  if (serviceType === "ride")     return IconMotorbike
  if (serviceType === "taxi")     return IconCar
  if (serviceType === "delivery") return IconTruck
  return IconBike
}

// ── Base pill style ───────────────────────────────────────────
function pillStyle({ bg, text, bdr, px, py, font }) {
  return {
    display:        "inline-flex",
    alignItems:     "center",
    gap:            "var(--badge-gap, 3px)",
    padding:        `${py} ${px}`,
    borderRadius:   "var(--badge-radius, 9999px)",
    backgroundColor: bg ?? "transparent",
    color:           text,
    border:          bdr ? `1px solid ${bdr}` : "none",
    fontSize:        font,
    fontWeight:      "var(--badge-font-weight, 500)",
    fontFamily:      "'Lexend', sans-serif",
    lineHeight:      1,
    whiteSpace:      "nowrap",
    flexShrink:      0,
  }
}

// ── Main Badge component ──────────────────────────────────────
export default function Badge({
  layer,
  variant,
  size = "md",
  icon = true,
  label,
  pulse,
  serviceType,
  className = "",
}) {
  const sz = SZ[size] ?? SZ.md

  // ── Layer 1 ──────────────────────────────────────────────
  if (layer === 1) {
    const cfg = L1[variant]
    if (!cfg) return null
    const resolvedLabel = label !== undefined ? label : cfg.label
    const IconComp = icon && cfg.icon ? ICONS[cfg.icon] : null
    // rank-n: smaller font (9px), no icon
    const isRankN = variant === "rank-n"
    return (
      <span
        className={className}
        style={pillStyle({ bg: cfg.bg, text: cfg.text, bdr: null, px: "var(--badge-px-sm)", py: "var(--badge-py-sm)", font: isRankN ? "9px" : sz.font })}
      >
        {IconComp && <IconComp size={sz.icon} strokeWidth={2} style={{ flexShrink: 0 }} />}
        {resolvedLabel && <span>{resolvedLabel}</span>}
      </span>
    )
  }

  // ── Layer 2 ──────────────────────────────────────────────
  if (layer === 2) {
    const cfg = L2[variant]
    if (!cfg) return null
    const resolvedLabel = label !== undefined ? label : cfg.label
    const IconComp = icon && cfg.icon ? ICONS[cfg.icon] : null
    return (
      <span
        className={className}
        style={pillStyle({ bg: "transparent", text: cfg.text, bdr: cfg.bdr, px: "var(--badge-ghost-px, 7px)", py: "var(--badge-ghost-py, 2px)", font: sz.font })}
      >
        {IconComp && <IconComp size={sz.icon} strokeWidth={2} style={{ flexShrink: 0 }} />}
        {resolvedLabel && <span>{resolvedLabel}</span>}
      </span>
    )
  }

  // ── Layer 3 ──────────────────────────────────────────────
  if (layer === 3) {
    const cfg = L3[variant]
    if (!cfg) return null
    const resolvedLabel = label !== undefined ? label : cfg.label
    const showPulse = pulse ?? (variant === "open")

    let indicator = null

    if (cfg.indicator === "dot") {
      // 5px dot
      indicator = (
        <span
          className={showPulse ? "badge-dot-live" : ""}
          style={{
            display:      "inline-block",
            width:        5,
            height:       5,
            borderRadius: "50%",
            background:   cfg.text,
            flexShrink:   0,
          }}
        />
      )
    } else if (cfg.indicator === "ring") {
      // 9px spinning ring
      const GoingIcon = goingIcon(serviceType)
      indicator = (
        <span
          className="badge-ring-spin"
          style={{ display: "inline-flex", flexShrink: 0 }}
        >
          <GoingIcon size={sz.icon} strokeWidth={2} />
        </span>
      )
    } else {
      // icon indicators: clock / check / x
      const iconMap = { clock: IconClock, check: IconCheck, x: IconX }
      const IconComp = iconMap[cfg.indicator]
      if (IconComp) {
        indicator = <IconComp size={sz.icon} strokeWidth={2} style={{ flexShrink: 0 }} />
      }
    }

    return (
      <span
        className={className}
        style={pillStyle({ bg: cfg.bg, text: cfg.text, bdr: cfg.bdr, px: "var(--badge-px-md)", py: "var(--badge-py-md)", font: sz.font })}
      >
        {indicator}
        {resolvedLabel && <span>{resolvedLabel}</span>}
      </span>
    )
  }

  return null
}

// ── Named exports ─────────────────────────────────────────────
export { default as FilterChip } from "./FilterChip.jsx"
export { default as NotifDot   } from "./NotifDot.jsx"
