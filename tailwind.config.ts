import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary:  "var(--bg-tertiary)",
        },
        acc: {
          DEFAULT: "var(--acc)",
          mid:     "var(--acc-mid)",
          light:   "var(--acc-light)",
        },
        brand: {
          green:  "var(--green)",
          red:    "var(--red)",
          blue:   "var(--blue)",
          purple: "var(--purple)",
          yellow: "var(--yellow)",
        },
        text: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted:     "var(--text-muted)",
        },
        // ── Badge tokens v2.0 (BADGE_SYSTEM_SPEC.md Phase 2) ──
        badge: {
          // Layer 1 — Tonal
          fireBg:      "var(--badge-fire-bg)",     fireText:      "var(--badge-fire-text)",
          newBg:       "var(--badge-new-bg)",      newText:       "var(--badge-new-text)",
          hotBg:       "var(--badge-hot-bg)",      hotText:       "var(--badge-hot-text)",
          saleBg:      "var(--badge-sale-bg)",     saleText:      "var(--badge-sale-text)",
          comboBg:     "var(--badge-combo-bg)",    comboText:     "var(--badge-combo-text)",
          partnerBg:   "var(--badge-partner-bg)",  partnerText:   "var(--badge-partner-text)",
          proxyBg:     "var(--badge-proxy-bg)",    proxyText:     "var(--badge-proxy-text)",
          spicy1Bg:    "var(--badge-spicy1-bg)",   spicy1Text:    "var(--badge-spicy1-text)",
          spicy2Bg:    "var(--badge-spicy2-bg)",   spicy2Text:    "var(--badge-spicy2-text)",
          spicy3Bg:    "var(--badge-spicy3-bg)",   spicy3Text:    "var(--badge-spicy3-text)",
          rank1Bg:     "var(--badge-rank1-bg)",    rank1Text:     "var(--badge-rank1-text)",
          rank2Bg:     "var(--badge-rank2-bg)",    rank2Text:     "var(--badge-rank2-text)",
          rank3Bg:     "var(--badge-rank3-bg)",    rank3Text:     "var(--badge-rank3-text)",
          ranknBg:     "var(--badge-rankn-bg)",    ranknText:     "var(--badge-rankn-text)",
          bronzeBg:    "var(--badge-bronze-bg)",   bronzeText:    "var(--badge-bronze-text)",
          silverBg:    "var(--badge-silver-bg)",   silverText:    "var(--badge-silver-text)",
          goldBg:      "var(--badge-gold-bg)",     goldText:      "var(--badge-gold-text)",
          platinumBg:  "var(--badge-platinum-bg)", platinumText:  "var(--badge-platinum-text)",
          // Layer 2 — Ghost (text + border only, bg transparent)
          discountText:"var(--badge-discount-text)", discountBdr: "var(--badge-discount-bdr)",
          ratingText:  "var(--badge-rating-text)",   ratingBdr:   "var(--badge-rating-bdr)",
          distText:    "var(--badge-dist-text)",      distBdr:     "var(--badge-dist-bdr)",
          vouText:     "var(--badge-vou-text)",       vouBdr:      "var(--badge-vou-bdr)",
          hcText:      "var(--badge-hc-text)",        hcBdr:       "var(--badge-hc-bdr)",
          soldctText:  "var(--badge-soldct-text)",    soldctBdr:   "var(--badge-soldct-bdr)",
          soldoutText: "var(--badge-soldout-text)",   soldoutBdr:  "var(--badge-soldout-bdr)",
          urgentText:  "var(--badge-urgent-text)",    urgentBdr:   "var(--badge-urgent-bdr)",
          lowuseText:  "var(--badge-lowuse-text)",    lowuseBdr:   "var(--badge-lowuse-bdr)",
          // Layer 3 — Status
          openBg:    "var(--badge-open-bg)",    openText:    "var(--badge-open-text)",    openBdr:    "var(--badge-open-bdr)",
          closedBg:  "var(--badge-closed-bg)",  closedText:  "var(--badge-closed-text)",  closedBdr:  "var(--badge-closed-bdr)",
          goingBg:   "var(--badge-going-bg)",   goingText:   "var(--badge-going-text)",   goingBdr:   "var(--badge-going-bdr)",
          pendingBg: "var(--badge-pending-bg)", pendingText: "var(--badge-pending-text)", pendingBdr: "var(--badge-pending-bdr)",
          doneBg:    "var(--badge-done-bg)",    doneText:    "var(--badge-done-text)",    doneBdr:    "var(--badge-done-bdr)",
          cancelBg:  "var(--badge-cancel-bg)",  cancelText:  "var(--badge-cancel-text)",  cancelBdr:  "var(--badge-cancel-bdr)",
        },
        // ── Notif dot ──────────────────────────────────────────
        notif: {
          dotBg:    "var(--notif-dot-bg)",
          cartBg:   "var(--cart-dot-bg)",
        },
        // ── Filter chip ────────────────────────────────────────
        chip: {
          onBg:    "var(--chip-on-bg)",   onText:    "var(--chip-on-text)",   onBdr:    "var(--chip-on-bdr)",
          offBg:   "var(--chip-off-bg)",  offText:   "var(--chip-off-text)",  offBdr:   "var(--chip-off-bdr)",
        },
        // ── Voucher panels ─────────────────────────────────────
        vou: {
          pctPanel:   "var(--vou-pct-panel)",   pctAccent:   "var(--vou-pct-accent)",
          cashPanel:  "var(--vou-cash-panel)",  cashAccent:  "var(--vou-cash-accent)",
          shipPanel:  "var(--vou-ship-panel)",  shipAccent:  "var(--vou-ship-accent)",
          comboPanel: "var(--vou-combo-panel)", comboAccent: "var(--vou-combo-accent)",
        },
        // ── Vtag ───────────────────────────────────────────────
        vtag: {
          oBg:     "var(--vtag-o-bg)",     oText:     "var(--vtag-o-text)",     oBdr:     "var(--vtag-o-bdr)",
          gBg:     "var(--vtag-g-bg)",     gText:     "var(--vtag-g-text)",     gBdr:     "var(--vtag-g-bdr)",
          bBg:     "var(--vtag-b-bg)",     bText:     "var(--vtag-b-text)",     bBdr:     "var(--vtag-b-bdr)",
          pBg:     "var(--vtag-p-bg)",     pText:     "var(--vtag-p-text)",     pBdr:     "var(--vtag-p-bdr)",
          rBg:     "var(--vtag-r-bg)",     rText:     "var(--vtag-r-text)",     rBdr:     "var(--vtag-r-bdr)",
          mutedBg: "var(--vtag-muted-bg)", mutedText: "var(--vtag-muted-text)", mutedBdr: "var(--vtag-muted-bdr)",
        },
      },
      fontFamily: {
        sans: ["Lexend", "Inter", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        acc:    "0 4px 20px rgba(255,107,0,0.4)",
        "acc-sm": "0 2px 10px rgba(255,107,0,0.3)",
      },
    },
  },
  plugins: [],
}

export default config
