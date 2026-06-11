/**
 * Badge component — BADGE_SYSTEM_SPEC.md Phase 3
 * Dark-only. Pill shape (border-radius: 9999px). No gradients.
 */

import {
  IconTag,
  IconFlame,
  IconSparkles,
  IconTrendingUp,
  IconGift,
  IconClock,
  IconStar,
  IconMapPin,
  IconCircleCheck,
  IconShoppingCart,
  IconPercentage,
  IconTruck,
  IconAlertTriangle,
  IconMedal,
  IconDiamond,
  IconPepper,
  IconBike,
  IconCar,
  IconMotorbike,
  IconX,
  IconCheck,
} from "@tabler/icons-react"

// ── Icon map ────────────────────────────────────────────────
const ICON_MAP = {
  tag:           IconTag,
  flame:         IconFlame,
  sparkles:      IconSparkles,
  "trending-up": IconTrendingUp,
  gift:          IconGift,
  clock:         IconClock,
  star:          IconStar,
  "map-pin":     IconMapPin,
  "circle-check":IconCircleCheck,
  "shopping-cart":IconShoppingCart,
  percentage:    IconPercentage,
  cash:          IconTag,        // fallback — no cash icon in free tier
  truck:         IconTruck,
  "alert-triangle":IconAlertTriangle,
  medal:         IconMedal,
  diamond:       IconDiamond,
  pepper:        IconPepper,
  bike:          IconBike,
  car:           IconCar,
  motorbike:     IconMotorbike,
  x:             IconX,
  check:         IconCheck,
}

// ── Default label + icon per variant ────────────────────────
const BADGE_DEFAULTS = {
  discount:          { label: "-X%",          icon: "tag"            },
  hot:               { label: "Hot",           icon: "flame"          },
  sale:              { label: "Sale",          icon: "tag"            },
  new:               { label: "Mới",           icon: "sparkles"       },
  bestseller:        { label: "Bán chạy",      icon: "trending-up"    },
  combo:             { label: "Combo",         icon: "gift"           },
  open:              { label: "Đang mở",       icon: null, pulse: true },
  closed:            { label: "Đóng cửa",      icon: "clock"          },
  rating:            { label: "",              icon: "star"           },
  distance:          { label: "",              icon: "map-pin"        },
  "has-combo":       { label: "Có Combo",      icon: "gift"           },
  partner:           { label: "Đối tác",       icon: "circle-check"   },
  proxy:             { label: "Mua hộ",        icon: "shopping-cart"  },
  "voucher-percent": { label: "Giảm %",        icon: "percentage"     },
  "voucher-cash":    { label: "Giảm tiền",     icon: "cash"           },
  "voucher-ship":    { label: "Free ship",     icon: "truck"          },
  "voucher-combo":   { label: "Combo",         icon: "gift"           },
  "expire-urgent":   { label: "",              icon: "clock"          },
  "low-usage":       { label: "",              icon: "alert-triangle" },
  "rank-1":          { label: "#1",            icon: "medal"          },
  "rank-2":          { label: "#2",            icon: "medal"          },
  "rank-3":          { label: "#3",            icon: "medal"          },
  "rank-n":          { label: "",              icon: null             },
  "sold-count":      { label: "",              icon: "flame"          },
  bronze:            { label: "Bronze",        icon: "medal"          },
  silver:            { label: "Silver",        icon: "medal"          },
  gold:              { label: "Gold",          icon: "medal"          },
  platinum:          { label: "Platinum",      icon: "diamond"        },
  "spicy-1":         { label: "Cay nhẹ",       icon: "pepper"         },
  "spicy-2":         { label: "Cay vừa",       icon: "pepper"         },
  "spicy-3":         { label: "Cay mạnh",      icon: "pepper"         },
  "status-pending":  { label: "Chờ xác nhận",  icon: "clock"          },
  "status-going":    { label: "Đang giao",     icon: "bike"           },
  "status-done":     { label: "Hoàn thành",    icon: "circle-check"   },
  "status-cancelled":{ label: "Đã huỷ",        icon: "x"              },
}

// ── Variant → CSS variable names ────────────────────────────
const VARIANT_VARS = {
  discount:          ["--badge-discount-bg",           "--badge-discount-text",           "--badge-discount-border"           ],
  hot:               ["--badge-hot-bg",                "--badge-hot-text",                "--badge-hot-border"                ],
  sale:              ["--badge-sale-bg",               "--badge-sale-text",               "--badge-sale-border"               ],
  new:               ["--badge-new-bg",                "--badge-new-text",                "--badge-new-border"                ],
  bestseller:        ["--badge-bestseller-bg",         "--badge-bestseller-text",         "--badge-bestseller-border"         ],
  combo:             ["--badge-combo-bg",              "--badge-combo-text",              "--badge-combo-border"              ],
  open:              ["--badge-open-bg",               "--badge-open-text",               "--badge-open-border"               ],
  closed:            ["--badge-closed-bg",             "--badge-closed-text",             "--badge-closed-border"             ],
  rating:            ["--badge-rating-bg",             "--badge-rating-text",             "--badge-rating-border"             ],
  distance:          ["--badge-distance-bg",           "--badge-distance-text",           "--badge-distance-border"           ],
  "has-combo":       ["--badge-has-combo-bg",          "--badge-has-combo-text",          "--badge-has-combo-border"          ],
  partner:           ["--badge-partner-bg",            "--badge-partner-text",            "--badge-partner-border"            ],
  proxy:             ["--badge-proxy-bg",              "--badge-proxy-text",              "--badge-proxy-border"              ],
  "voucher-percent": ["--badge-voucher-percent-bg",    "--badge-voucher-percent-text",    "--badge-voucher-percent-border"    ],
  "voucher-cash":    ["--badge-voucher-cash-bg",       "--badge-voucher-cash-text",       "--badge-voucher-cash-border"       ],
  "voucher-ship":    ["--badge-voucher-ship-bg",       "--badge-voucher-ship-text",       "--badge-voucher-ship-border"       ],
  "voucher-combo":   ["--badge-voucher-combo-bg",      "--badge-voucher-combo-text",      "--badge-voucher-combo-border"      ],
  "expire-urgent":   ["--badge-expire-urgent-bg",      "--badge-expire-urgent-text",      "--badge-expire-urgent-border"      ],
  "low-usage":       ["--badge-low-usage-bg",          "--badge-low-usage-text",          "--badge-low-usage-border"          ],
  "rank-1":          ["--badge-rank-1-bg",             "--badge-rank-1-text",             "--badge-rank-1-border"             ],
  "rank-2":          ["--badge-rank-2-bg",             "--badge-rank-2-text",             "--badge-rank-2-border"             ],
  "rank-3":          ["--badge-rank-3-bg",             "--badge-rank-3-text",             "--badge-rank-3-border"             ],
  "rank-n":          ["--badge-rank-n-bg",             "--badge-rank-n-text",             "--badge-rank-n-border"             ],
  "sold-count":      ["--badge-sold-count-bg",         "--badge-sold-count-text",         "--badge-sold-count-border"         ],
  bronze:            ["--badge-bronze-bg",             "--badge-bronze-text",             "--badge-bronze-border"             ],
  silver:            ["--badge-silver-bg",             "--badge-silver-text",             "--badge-silver-border"             ],
  gold:              ["--badge-gold-bg",               "--badge-gold-text",               "--badge-gold-border"               ],
  platinum:          ["--badge-platinum-bg",           "--badge-platinum-text",           "--badge-platinum-border"           ],
  "spicy-1":         ["--badge-spicy-1-bg",            "--badge-spicy-1-text",            "--badge-spicy-1-border"            ],
  "spicy-2":         ["--badge-spicy-2-bg",            "--badge-spicy-2-text",            "--badge-spicy-2-border"            ],
  "spicy-3":         ["--badge-spicy-3-bg",            "--badge-spicy-3-text",            "--badge-spicy-3-border"            ],
  "status-pending":  ["--badge-status-pending-bg",     "--badge-status-pending-text",     "--badge-status-pending-border"     ],
  "status-going":    ["--badge-status-going-bg",       "--badge-status-going-text",       "--badge-status-going-border"       ],
  "status-done":     ["--badge-status-done-bg",        "--badge-status-done-text",        "--badge-status-done-border"        ],
  "status-cancelled":["--badge-status-cancelled-bg",   "--badge-status-cancelled-text",   "--badge-status-cancelled-border"   ],
}

// ── Size → padding / font / icon ────────────────────────────
const SIZE_MAP = {
  sm: { height: "18px", px: "7px",  py: "2px", font: "10px", icon: 11 },
  md: { height: "22px", px: "9px",  py: "3px", font: "11px", icon: 12 },
  lg: { height: "26px", px: "11px", py: "4px", font: "12px", icon: 14 },
}

// ── status-going icon by serviceType ─────────────────────────
function getGoingIcon(serviceType) {
  if (serviceType === "ride")    return IconMotorbike
  if (serviceType === "taxi")    return IconCar
  if (serviceType === "delivery") return IconTruck
  return IconBike // food (default)
}

// ── Main Badge component ─────────────────────────────────────
export default function Badge({
  variant,
  size = "md",
  icon = true,
  customIcon,
  pulse,
  label,
  count,
  serviceType,
  className = "",
}) {
  const defaults  = BADGE_DEFAULTS[variant] ?? { label: "", icon: null }
  const vars      = VARIANT_VARS[variant]
  const sz        = SIZE_MAP[size] ?? SIZE_MAP.md
  const showPulse = pulse ?? defaults.pulse ?? false

  // Resolve style from CSS variables
  const style = vars
    ? {
        backgroundColor: `var(${vars[0]})`,
        color:           `var(${vars[1]})`,
        border:          `1px solid var(${vars[2]})`,
      }
    : {}

  // Resolve icon component
  let IconComp = null
  if (icon) {
    const iconName = customIcon ?? (variant === "status-going" ? null : defaults.icon)
    if (variant === "status-going") {
      IconComp = getGoingIcon(serviceType)
    } else if (iconName && ICON_MAP[iconName]) {
      IconComp = ICON_MAP[iconName]
    }
  }

  // Resolve label
  const resolvedLabel = label !== undefined ? label : defaults.label

  return (
    <span
      className={className}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            "var(--badge-gap, 3px)",
        height:         sz.height,
        padding:        `${sz.py} ${sz.px}`,
        borderRadius:   "var(--badge-radius, 9999px)",
        fontSize:       sz.font,
        fontWeight:     "var(--badge-font-weight, 500)",
        fontFamily:     "'Lexend', sans-serif",
        lineHeight:     1,
        whiteSpace:     "nowrap",
        flexShrink:     0,
        ...style,
      }}
    >
      {/* Open dot */}
      {variant === "open" && (
        <span
          className={showPulse ? "badge-dot-pulse" : ""}
          style={{
            width:        5,
            height:       5,
            borderRadius: "50%",
            background:   `var(--badge-open-text)`,
            flexShrink:   0,
          }}
        />
      )}

      {/* Icon */}
      {IconComp && variant !== "open" && (
        <IconComp size={sz.icon} strokeWidth={2} style={{ flexShrink: 0 }} />
      )}

      {/* Label */}
      {resolvedLabel && <span>{resolvedLabel}</span>}
    </span>
  )
}

// ── Named export: FilterChip — see Phase 4 ───────────────────
export { default as FilterChip } from "./FilterChip.jsx"

// ── Named export: NotifDot — see Phase 5 ────────────────────
export { default as NotifDot } from "./NotifDot.jsx"
