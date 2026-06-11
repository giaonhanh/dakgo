# Badge & Voucher System — Full Spec v2.0
## PWA Dark Theme — Đặt đồ ăn · Xe ôm · Giao hàng · Taxi

> **Dành cho Claude Code:** Đọc TOÀN BỘ file trước khi viết bất kỳ dòng code nào.
> Thực hiện TUẦN TỰ từng Phase. Không bỏ qua. Không tự thêm màu hay variant ngoài spec.
> File này là nguồn sự thật duy nhất (single source of truth) cho toàn bộ badge và voucher.

---

## 1. Project Context

| Item | Value |
|---|---|
| App type | PWA — đặt đồ ăn, xe ôm, giao hàng, taxi |
| Theme | Dark-only — KHÔNG có light mode |
| Background app | #080806 |
| Stack | React + Tailwind CSS v3 |
| Icon library | Tabler Icons outline (@tabler/icons-react) — KHÔNG dùng emoji |
| Animation | CSS keyframes — KHÔNG dùng Framer Motion cho badge |

### File structure

```
src/
├── components/ui/
│   ├── Badge.jsx
│   ├── FilterChip.jsx
│   ├── NotifDot.jsx
│   ├── VoucherCard.jsx
│   ├── VoucherStrip.jsx
│   ├── VoucherNudgeBar.jsx
│   └── VoucherInlineHint.jsx
├── styles/
│   └── badge-tokens.css
└── tailwind.config.js
```

---

## 2. Design Tokens

```
Cam chính:   #FF6B1A / #FF6B00
Cam đậm:     #CC4A00 / #FF8C00
Cam nhạt:    #FFD4A8 / #FFB347
Nền tối:     #080806
Nâu tối:     #1F1209
Nâu text:    #6a5a40
Kem sáng:    #f8f0e0
Xanh lá:     #2ECC71 / #3ecf6e
```

Badge formula: bg = tông tối ~15% | text = tông sáng 70% | border = 1px solid α.3–.45
Không dùng gradient. Không solid đặc. border-radius: 9999px tất cả.

---

## 3. Badge System — 3-Layer Architecture

### Quy tắc cứng

| Rule | Value |
|---|---|
| border-radius | 9999px — ALL badges |
| border Layer 2+3 | 1px solid |
| font-size | 10px inline item, 11px standalone |
| font-weight | 500 |
| icon | 11–12px Tabler outline |
| icon gap | 3px |
| Max Layer 1/item | 2 |
| Layer 3/context | 1 (không mix với L1 cùng dòng) |
| Hết hàng | opacity 55% toàn item |
| KHÔNG | gradient, emoji, solid đặc |

---

### Layer 1 — Tonal (bg tối + text sáng, no border, padding 3px 8px)

| Variant | bg | text | Icon | Label |
|---|---|---|---|---|
| fire | #4a2000 | #ffb070 | ti-flame | Bán chạy |
| new | #0d3018 | #5ee898 | ti-sparkles | Mới ra |
| hot | #3a1010 | #ff9090 | ti-bolt | Hot |
| sale | #2d2000 | #ffd060 | ti-tag | Sale |
| combo | #1e0a38 | #d4a0ff | ti-gift | Combo |
| partner | #0a2010 | #5ee898 | ti-circle-check | Đối tác |
| proxy | #2d1100 | #ffb070 | ti-shopping-cart | Mua hộ |
| spicy-1 | #1a0800 | #ff9060 | ti-pepper | Cay nhẹ |
| spicy-2 | #2a0a00 | #ff6030 | ti-pepper | Cay vừa |
| spicy-3 | #3a0500 | #ff3010 | ti-pepper | Cay mạnh |
| rank-1 | #2d2000 | #FFD700 | ti-medal | #1 |
| rank-2 | #1a1a1a | #b0b8c1 | ti-medal | #2 |
| rank-3 | #1a0e05 | #cd9a5a | ti-medal | #3 |
| rank-n | #2d1100 | #FFB347 | none | #N (9px) |
| loyalty-bronze | #2a1800 | #d4956a | ti-medal | Bronze |
| loyalty-silver | #1e0a38 | #c084fc | ti-medal | Silver |
| loyalty-gold | #2d2000 | #f5c542 | ti-medal | Gold |
| loyalty-platinum | #0d1f3a | #90c4ff | ti-diamond | Platinum |

---

### Layer 2 — Ghost Border (transparent bg, 1px border, padding 2px 7px)

| Variant | text | border-color | Icon | Dùng cho |
|---|---|---|---|---|
| discount | #ff8080 | rgba(255,128,128,.45) | ti-tag | -X% |
| rating | #FFD700 | rgba(255,215,0,.4) | ti-star | Sao |
| distance | #7ab3f8 | rgba(122,179,248,.45) | ti-map-pin | Xkm |
| voucher-count | #FF8C00 | rgba(255,140,0,.45) | ti-ticket | X voucher |
| has-combo | #c084fc | rgba(192,132,252,.4) | ti-gift | Có Combo |
| sold-count | #3ecf6e | rgba(62,207,110,.45) | ti-flame | X đã bán |
| sold-out | #6a5a40 | rgba(255,255,255,.12) | ti-x | Hết hàng |
| expire-urgent | #ff8080 | rgba(255,128,128,.45) | ti-clock | Còn Xh (auto khi <3h) |
| low-usage | #ff8080 | rgba(255,128,128,.45) | ti-alert-triangle | Còn X lượt (auto khi <=5) |

---

### Layer 3 — Status Dot (bg tối + border + dot/icon, padding 2px 8px)

| Variant | bg | text | border | Indicator | Animation |
|---|---|---|---|---|---|
| open | #0a1808 | #3ecf6e | rgba(62,207,110,.3) | dot xanh 5px | blink 1.4s |
| closed | #1c0808 | #ff8080 | rgba(255,64,64,.3) | dot đỏ 5px | none |
| going | #0a152d | #7ab3f8 | rgba(122,179,248,.3) | ring xoay 9px | spin .8s |
| pending | #2d2000 | #FFB347 | rgba(255,179,71,.3) | ti-clock | none |
| done | #0a2010 | #3ecf6e | rgba(62,207,110,.3) | ti-check | none |
| cancelled | #1c0808 | #ff8080 | rgba(255,64,64,.3) | ti-x | none |

Animation CSS bắt buộc:
```css
@keyframes badge-blink { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes badge-spin  { to{transform:rotate(360deg)} }
@media (prefers-reduced-motion: reduce) {
  .badge-dot-live, .badge-ring-spin { animation: none; }
}
```

going icon theo serviceType: food/delivery=ti-bike | ride=ti-motorbike | taxi=ti-car

---

### Notification Dot (position absolute, không phải pill)

| Type | bg | text | font-size | Logic |
|---|---|---|---|---|
| notification (bell) | #ff4040 | #fff | 9px | count>=100 → "99+" |
| cart | #FF6B1A | #fff | 9px | count>=100 → "99+" |

---

### Filter Chip

| State | bg | text | border | Extra |
|---|---|---|---|---|
| active | rgba(255,107,0,.15) | #FF8C00 | .5px solid rgba(255,107,0,.4) | ti-check 10px |
| inactive | rgba(255,255,255,.04) | #a08060 | .5px solid rgba(255,255,255,.08) | — |

padding: 4px 10px | border-radius: 99px | font-size: 11px

---

## 4. Badge Component APIs

### Badge.jsx props
```
layer        required  1 | 2 | 3
variant      required  xem bảng từng layer
size         optional  'sm'(10px) | 'md'(11px) | 'lg'(12px)  default='md'
label        optional  override label mặc định
icon         optional  boolean, default true
pulse        optional  boolean, chỉ dùng layer 3 'open'
serviceType  optional  'food'|'delivery'|'ride'|'taxi' — chỉ layer 3 'going'
className    optional  string
```

### FilterChip.jsx props
```
label   required  string
active  required  boolean
onClick required  function
```

### NotifDot.jsx props
```
count  required  number
type   required  'notification' | 'cart'
```

---

## 5. Vị trí badge trong app

### Product item layout
```
[thumb: corner badge Combo/Sale]  [badges: tối đa 2x Layer 1]  [price]
                                  [item name]                   [add btn]
                                  [VoucherInlineHint — 9px cam]
```

### Shop card — thứ tự badge cố định
```
[L3: open/closed] [rating] [distance] [voucher-count] [has-combo]
```

### Trang quán — header
```
[avatar + verified dot] [shop name]
                        [L3: open/closed] [rating] [distance]
                        [partner pill L1] [X voucher L2]
```

### Order/trip card
```
[service icon]  [item name]
                [L3: pending | going | done | cancelled]
```

---

## 6. Voucher System — Full Spec

### 6.1 VoucherItem data model
```ts
interface VoucherItem {
  id:             string
  type:           'percent' | 'cash' | 'freeship' | 'combo'
  value:          number          // 30 (%) hoặc 20000 (đồng) hoặc 0 (freeship)
  maxDiscount?:   number          // cap tối đa, percent only
  minOrder:       number
  title:          string
  description:    string
  scope?:         'all'|'food'|'ride'|'delivery'|'shop'|'combo-items'
  expiresAt:      Date
  remainingUses:  number
  totalUses:      number
  isSaved:        boolean
  isApplied:      boolean
  shopId?:        string          // null = voucher toàn app
}
```

---

### 6.2 VoucherCard — Kho voucher (ticket layout)

Layout:
```
┌────────────┬────────────────────────────────────┐
│            │  [title]                            │
│  [icon]    │  [description / conditions]         │
│  [VALUE]   ├────────────────────────────────────┤
│  [unit]    │  [tags: expire · usage] [btn]       │
│  [max?]    │  [progress bar lượt dùng — nếu có] │
└────────────┴────────────────────────────────────┘
  [bottom bar: urgency message | action link]
```

Notch: pseudo-element circle 12px bg #080806 tại vị trí ngắt.

Màu theo type:
| type | panel-bg | icon-bg | icon-color | value-color | progress |
|---|---|---|---|---|---|
| percent | #2d1100 | rgba(255,179,71,.15) | #FFB347 | #FFB347 | #FF6B1A |
| cash | #0a2010 | rgba(62,207,110,.12) | #3ecf6e | #3ecf6e | #3ecf6e |
| freeship | #0a152d | rgba(122,179,248,.12) | #7ab3f8 | #7ab3f8 | #7ab3f8 |
| combo | #1e0a38 | rgba(192,132,252,.12) | #c084fc | #c084fc | #a855f7 |

Value hiển thị:
- percent: "30%" large + "tối đa" + "50.000đ" small
- cash: "20k" large + "giảm thẳng" small
- freeship: "Free" large + "ship" + "toàn bộ" small
- combo: "Combo" large + "tiết kiệm" + "-25k" small

Voucher tags (vtag — 9px, nhỏ hơn badge):
- vt-orange: rgba(255,140,0,.15) bg | #FFB347 text | rgba(255,140,0,.3) border
- vt-green:  rgba(62,207,110,.12) bg | #3ecf6e text | rgba(62,207,110,.25) border
- vt-blue:   rgba(122,179,248,.12) bg | #7ab3f8 text | rgba(122,179,248,.25) border
- vt-purple: rgba(192,132,252,.12) bg | #c084fc text | rgba(192,132,252,.25) border
- vt-red:    rgba(255,64,64,.12) bg | #ff8080 text | rgba(255,64,64,.25) border
- vt-muted:  rgba(255,255,255,.06) bg | #6a5a40 text | rgba(255,255,255,.1) border

Bottom bar hiển thị khi:
- remainingUses/totalUses < 0.3 → đỏ "#ff8080" text: "Còn X/Y lượt · Dùng nhanh kẻo hết"
- remainingMinutes < 180 → đỏ: "Hết hạn trong Xh Xm"
- combo type → tím "#c084fc" với link "Xem món Combo →"

Save button states:
- isSaved=false: bg #FF6B1A text #fff "Lưu ngay"
- isSaved=true: ghost xanh "Đã lưu"
- isApplied=true: ghost xanh "✓ Đang dùng"

Sort order màn hình kho:
1. isApplied=true lên đầu
2. remainingMinutes < 180 (urgency cao nhất)
3. remainingUses <= 5
4. Còn lại theo expiresAt tăng dần

VoucherCard props:
```
voucher       required  VoucherItem
onSave        required  (id: string) => void
onApply       required  (id: string) => void
onViewCombo   optional  () => void
showProgress  optional  boolean, default true
showBottomBar optional  boolean, default true
```

---

### 6.3 VoucherStrip — Trang quán

5 zone theo thứ tự từ trên xuống:

Zone A — Shop header:
```
[avatar + verified-dot]  [shop name]
                         [L3 open/closed] [rating] [distance]
                         [partner pill]   [X voucher L2 badge]
```

Zone B — Voucher strip:
```
Row header: [ti-ticket cam] "Voucher quán" [count pill] [Xem tất cả →]
Strip:      [svc-card] [svc-card] [svc-card] [svc-card]
```

Strip card layout (width 152px):
```
┌─┬──────────────────────────────┐
│█│  [value large]               │  ← accent bar 4px
│█│  [title — truncate 1 line]   │
│█│  [condition]  [apply button] │
├─┴──────────────────────────────┤
│ [icon] [expire/usage text]     │
└────────────────────────────────┘
```

Accent bar màu: percent=#FFB347 | cash=#3ecf6e | freeship=#7ab3f8 | combo=#c084fc

Strip card states:
- default:  border .5px solid rgba(255,255,255,.07)
- hover:    border-color rgba(255,107,0,.35)
- selected: border-color #FF6B1A, bg #1a0e04

Strip footer text:
- normal:  color #6a5a40
- urgent:  color #ff8080

Zone C — Nudge bar:
```
[icon type]  "Thêm Xk nữa → [reward]!"
             [sub: Đang có Xk · Cần Yk]
             [progress bar — màu theo type]
             [Xk / Yk]  [CTA button]
```

Zone D — Product list với inline hint dưới tên mỗi sản phẩm.

Zone E — Sticky bottom bar:
```
[ti-discount-2 cam]  "Đang áp dụng X"          [−Yđ badge xanh]  [Đặt hàng btn cam]
                     "+ Freeship sẵn · nhấn thêm"
```

VoucherStrip props:
```
vouchers   required  VoucherItem[]
cartTotal  required  number
appliedId  optional  string
onApply    required  (id: string) => void
onViewAll  optional  () => void
thresholds required  VoucherThreshold[]
```

---

### 6.4 VoucherNudgeBar — Threshold kích cầu

Data model:
```ts
interface VoucherThreshold {
  value:  number   // ngưỡng tối thiểu (đồng)
  type:   'freeship' | 'percent' | 'combo' | 'cash'
  label:  string   // "Freeship toàn bộ"
  reward: string   // text ngắn trong nudge
}
```

Logic: findNextThreshold = thresholds.find(t => cartTotal < t.value)

Màu theo type ưu đãi sắp mở:
| type | bar-color | card-bg | border-dim | border-bright |
|---|---|---|---|---|
| freeship | #7ab3f8 | rgba(10,21,45,.9) | rgba(122,179,248,.2) | rgba(122,179,248,.55) |
| percent | #FFB347 | rgba(26,18,0,.9) | rgba(255,179,71,.2) | rgba(255,179,71,.55) |
| combo | #a855f7 | rgba(18,8,32,.9) | rgba(168,85,247,.2) | rgba(168,85,247,.55) |
| cash | #3ecf6e | rgba(10,32,16,.9) | rgba(62,207,110,.2) | rgba(62,207,110,.55) |

Done state (đạt tất cả):
- bg #0a1808 | border rgba(62,207,110,.3) | animation: none
- icon ti-sparkles | text "#5ee898" | "Tất cả ưu đãi đã mở!"

Border pulse animation:
```css
@keyframes nudge-pulse {
  0%,100% { border-color: var(--nudge-border-dim); }
  50%      { border-color: var(--nudge-border-bright); }
}
```

Props:
```
cartTotal  required  number
thresholds required  VoucherThreshold[]
onAddMore  optional  () => void
onViewCombo optional () => void
```

---

### 6.5 VoucherInlineHint

3 state:
- applied: ti-ticket #FF8C00 + text #FF8C00 — "Voucher X → còn Yđ"
- nudge:   ti-ticket #FF8C00 + text #FF8C00 — "Thêm Xđ → mở [reward]"
- none:    ti-ticket #6a5a40 + text #6a5a40 — "Không có voucher áp dụng"

font-size: 9px | gap: 3px

Props:
```
type      required  'applied' | 'nudge' | 'none'
text      required  string
```

---

### 6.6 Smart Auto-picker (checkout)

Logic findBestVoucherCombo:
1. Lọc voucher: isSaved=true, minOrder <= cartTotal, scope phù hợp
2. Thử tất cả tổ hợp (tối đa stack 2 voucher)
3. Tính totalSavings mỗi combo
4. Chọn combo savings cao nhất
5. Return mảng 1–2 voucher

Banner hiển thị:
```
bg #1a2d14 | border rgba(62,207,110,.25) | radius 10px
[ti-sparkles xanh]  "Tìm được combo tiết kiệm nhất!"
                    "Giảm X% + Freeship = tiết kiệm Zđ"
                    "(thay vì Yđ nếu dùng riêng lẻ)"
                    [btn cam "Áp dụng combo này"]  [link muted "Tự chọn voucher"]
```

Stack display checkout:
```
bg #1F1209 | border rgba(255,107,0,.2) | radius 10px
[ti-discount-2 cam]  "2 voucher đang áp dụng"
                     "Combo tốt nhất được chọn tự động"
─────────────────────────────────────
[icon type]  [title voucher 1]     −Xđ (xanh)
[icon type]  [title voucher 2]     −Yđ (xanh)
─────────────────────────────────────
[ti-sparkles]  "Tổng tiết kiệm"   Zđ (xanh lớn)
```

KHÔNG auto-apply không hỏi. Luôn hiển thị banner để user xác nhận.

---

## 7. CSS Variables — badge-tokens.css (đầy đủ)

```css
:root {
  /* ── LAYER 1 TONAL ── */
  --badge-fire-bg:#4a2000; --badge-fire-text:#ffb070;
  --badge-new-bg:#0d3018; --badge-new-text:#5ee898;
  --badge-hot-bg:#3a1010; --badge-hot-text:#ff9090;
  --badge-sale-bg:#2d2000; --badge-sale-text:#ffd060;
  --badge-combo-bg:#1e0a38; --badge-combo-text:#d4a0ff;
  --badge-partner-bg:#0a2010; --badge-partner-text:#5ee898;
  --badge-proxy-bg:#2d1100; --badge-proxy-text:#ffb070;
  --badge-spicy1-bg:#1a0800; --badge-spicy1-text:#ff9060;
  --badge-spicy2-bg:#2a0a00; --badge-spicy2-text:#ff6030;
  --badge-spicy3-bg:#3a0500; --badge-spicy3-text:#ff3010;
  --badge-rank1-bg:#2d2000; --badge-rank1-text:#FFD700;
  --badge-rank2-bg:#1a1a1a; --badge-rank2-text:#b0b8c1;
  --badge-rank3-bg:#1a0e05; --badge-rank3-text:#cd9a5a;
  --badge-rankn-bg:#2d1100; --badge-rankn-text:#FFB347;
  --badge-bronze-bg:#2a1800; --badge-bronze-text:#d4956a;
  --badge-silver-bg:#1e0a38; --badge-silver-text:#c084fc;
  --badge-gold-bg:#2d2000; --badge-gold-text:#f5c542;
  --badge-platinum-bg:#0d1f3a; --badge-platinum-text:#90c4ff;

  /* ── LAYER 2 GHOST ── */
  --badge-discount-text:#ff8080; --badge-discount-bdr:rgba(255,128,128,.45);
  --badge-rating-text:#FFD700; --badge-rating-bdr:rgba(255,215,0,.4);
  --badge-dist-text:#7ab3f8; --badge-dist-bdr:rgba(122,179,248,.45);
  --badge-vou-text:#FF8C00; --badge-vou-bdr:rgba(255,140,0,.45);
  --badge-hc-text:#c084fc; --badge-hc-bdr:rgba(192,132,252,.4);
  --badge-soldct-text:#3ecf6e; --badge-soldct-bdr:rgba(62,207,110,.45);
  --badge-soldout-text:#6a5a40; --badge-soldout-bdr:rgba(255,255,255,.12);
  --badge-urgent-text:#ff8080; --badge-urgent-bdr:rgba(255,128,128,.45);

  /* ── LAYER 3 STATUS ── */
  --badge-open-bg:#0a1808; --badge-open-text:#3ecf6e; --badge-open-bdr:rgba(62,207,110,.3);
  --badge-closed-bg:#1c0808; --badge-closed-text:#ff8080; --badge-closed-bdr:rgba(255,64,64,.3);
  --badge-going-bg:#0a152d; --badge-going-text:#7ab3f8; --badge-going-bdr:rgba(122,179,248,.3);
  --badge-pending-bg:#2d2000; --badge-pending-text:#FFB347; --badge-pending-bdr:rgba(255,179,71,.3);
  --badge-done-bg:#0a2010; --badge-done-text:#3ecf6e; --badge-done-bdr:rgba(62,207,110,.3);
  --badge-cancel-bg:#1c0808; --badge-cancel-text:#ff8080; --badge-cancel-bdr:rgba(255,64,64,.3);

  /* ── NOTIF DOT ── */
  --notif-dot-bg:#ff4040;
  --cart-dot-bg:#FF6B1A;

  /* ── FILTER CHIP ── */
  --chip-on-bg:rgba(255,107,0,.15); --chip-on-text:#FF8C00; --chip-on-bdr:rgba(255,107,0,.4);
  --chip-off-bg:rgba(255,255,255,.04); --chip-off-text:#a08060; --chip-off-bdr:rgba(255,255,255,.08);

  /* ── VOUCHER TYPE ── */
  --vou-pct-panel:#2d1100; --vou-pct-accent:#FFB347;
  --vou-cash-panel:#0a2010; --vou-cash-accent:#3ecf6e;
  --vou-ship-panel:#0a152d; --vou-ship-accent:#7ab3f8;
  --vou-combo-panel:#1e0a38; --vou-combo-accent:#c084fc;

  /* ── VTAG (voucher tags nhỏ) ── */
  --vtag-o-bg:rgba(255,140,0,.15); --vtag-o-text:#FFB347; --vtag-o-bdr:rgba(255,140,0,.3);
  --vtag-g-bg:rgba(62,207,110,.12); --vtag-g-text:#3ecf6e; --vtag-g-bdr:rgba(62,207,110,.25);
  --vtag-b-bg:rgba(122,179,248,.12); --vtag-b-text:#7ab3f8; --vtag-b-bdr:rgba(122,179,248,.25);
  --vtag-p-bg:rgba(192,132,252,.12); --vtag-p-text:#c084fc; --vtag-p-bdr:rgba(192,132,252,.25);
  --vtag-r-bg:rgba(255,64,64,.12); --vtag-r-text:#ff8080; --vtag-r-bdr:rgba(255,64,64,.25);
  --vtag-muted-bg:rgba(255,255,255,.06); --vtag-muted-text:#6a5a40; --vtag-muted-bdr:rgba(255,255,255,.1);
}
```

---

## 8. Implementation Phases (Claude Code làm theo thứ tự này)

### Phase 1 — badge-tokens.css
Tạo file src/styles/badge-tokens.css với toàn bộ :root variables từ Section 7.
Import vào src/index.css.

### Phase 2 — tailwind.config.js extend
Map token → theme.extend.colors với prefix badge-* và vou-*.
Ví dụ: badgeFireBg: 'var(--badge-fire-bg)'

### Phase 3 — Badge.jsx
- Map layer + variant → styles object
- Layer 1: bg + text, no border
- Layer 2: transparent bg + text + border
- Layer 3: bg + text + border + dot/ring/icon render
- pulse prop → blink animation class
- serviceType prop → icon switching cho 'going'
- size prop → font-size

### Phase 4 — FilterChip.jsx
- active/inactive states
- ti-check icon khi active

### Phase 5 — NotifDot.jsx
- position absolute top-right
- count >= 100 → "99+"
- type notification → #ff4040, cart → #FF6B1A

### Phase 6 — VoucherCard.jsx
- Ticket layout với notch pseudo-element
- Left panel màu theo type
- icon + value display theo format từng type
- vtag components
- Progress bar lượt dùng
- Bottom urgency bar (conditional)
- 3 button states

### Phase 7 — VoucherStrip.jsx
- Strip header với count badge
- Strip card với left accent bar 4px
- 4 card visible, no overflow
- Active selected state

### Phase 8 — VoucherNudgeBar.jsx
- findNextThreshold logic
- Progress bar với dynamic color
- Pulse border animation
- Done state

### Phase 9 — VoucherInlineHint.jsx
- 3 states: applied / nudge / none
- 9px font, icon + text

### Phase 10 — SmartVoucherPicker (utils + UI)
- findBestVoucherCombo() utility function
- SmartPickerBanner component
- VoucherStackDisplay component cho checkout

### Phase 11 — Tích hợp màn hình
- ShopPage: 5 zone A-E đúng thứ tự
- VoucherWalletPage: filter tabs + sort + list
- CheckoutPage: smart picker banner + stack display + total savings

---

## 9. Rules — KHÔNG vi phạm

1. KHÔNG dùng gradient trên bất kỳ badge hoặc voucher component nào
2. KHÔNG dùng emoji — chỉ Tabler Icons outline
3. border-radius 9999px cho tất cả badge/pill
4. border 1px solid Layer 2 và 3 — không 0.5px không 2px
5. Silver loyalty = tím #c084fc — KHÔNG dùng xám (mất hút trên #080806)
6. Cart dot = cam #FF6B1A — khác notification dot đỏ #ff4040
7. Hết hàng = opacity 55% TOÀN item, không chỉ badge
8. Tối đa 2 badge Layer 1 per product item
9. Layer 3 chỉ 1/context — không mix với Layer 1 cùng dòng
10. prefers-reduced-motion bắt buộc cho blink và spin animation
11. KHÔNG auto-apply voucher — luôn hiển thị banner để user xác nhận
12. Hiển thị rõ minOrder và scope — không ẩn điều kiện
13. Combo type voucher có link "Xem món Combo" dẫn đến filter
14. sort kho voucher: applied → urgent → low-usage → expiresAt ASC

---

## 10. Checklist trước khi Done

- [ ] 18 Layer 1 variants đủ bg/text
- [ ] 9 Layer 2 variants đủ text/border
- [ ] 6 Layer 3 variants đủ bg/text/border + animation
- [ ] prefers-reduced-motion cho blink và spin
- [ ] NotifDot: 99+ logic, cart cam, notif đỏ
- [ ] FilterChip active có ti-check icon
- [ ] VoucherCard: 4 type màu panel khác nhau
- [ ] VoucherCard notch pseudo-element đúng
- [ ] VoucherCard bottom bar conditional hiển thị
- [ ] VoucherCard 3 button states
- [ ] VoucherStrip accent bar 4px màu theo type
- [ ] VoucherStrip selected state border cam
- [ ] NudgeBar tự tính next threshold
- [ ] NudgeBar đổi màu theo type sắp mở
- [ ] NudgeBar done state khi đạt tất cả
- [ ] InlineHint 3 states đúng màu
- [ ] SmartPicker KHÔNG auto-apply, có banner confirm
- [ ] Shop page Zone A→E đúng thứ tự
- [ ] Kho voucher sort đúng thứ tự
- [ ] 0 gradient trong toàn bộ badge/voucher codebase
