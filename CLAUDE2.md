# CLAUDE2.md — Giao Nhanh PWA (Phần 3/3)
> Tiếp theo từ CLAUDE1.md.
> File này: **Thiết kế giao diện Order Display** — đã được duyệt, KHÔNG tự ý thay đổi.
> Mọi sửa đổi giao diện đơn hàng PHẢI tham chiếu file này và hỏi trước khi thực hiện.

---

## MỤC LỤC

- [Design Tokens — Order Display](#design-tokens--order-display)
- [ItemBreakdown Type](#itembreakdown-type)
- [Customer — Trang đơn hàng](#customer--trang-đơn-hàng-customerorderspagesx)
- [Merchant — Expanded order card](#merchant--expanded-order-card-merchantpagesx)
- [Driver — Navigate page](#driver--navigate-page-drivernavigeorderidpagesx)
- [Quy tắc bất biến](#quy-tắc-bất-biến)

---

## Design Tokens — Order Display

> Các giá trị màu sắc, kích thước sau là chuẩn cho TẤT CẢ giao diện đơn hàng.
> Không được tự ý thay đổi kể cả khi refactor.

```
── Cấu trúc item ──────────────────────────────────────────
Số thứ tự badge:  20×20 circle
  bg:     rgba(255,107,0,0.15)
  border: 1px solid rgba(255,107,0,0.30)
  color:  #FF8C00
  font:   800

Tên món (cấp 1):  color #f8f0e0, fontWeight 700
Số lượng:         color #6a5a40
Giá gốc/món:      color #b0956a

── Options (cấp 2 — thụt 12–16px) ────────────────────────
Size row:         color #4a8ff5  | prefix "▸" (customer/merchant) hoặc "↳ Size:" (driver)
Topping row:      color #3ecf6e  | prefix "+" (customer/merchant) hoặc "↳" + color #b464ff (driver)
  Badge chip (khi không có giá): bg rgba(color,0.08-0.12), border rgba(color,0.2-0.25)

── Ghi chú (cấp 2) ────────────────────────────────────────
Ghi chú item:
  bg:     rgba(245,197,66,0.08)
  border: 1px solid rgba(245,197,66,0.20)
  color:  #f5c542
  prefix: 📝

Ghi chú đơn (footer):
  bg:     rgba(245,197,66,0.04)
  color:  #b0956a  ← màu nhạt hơn item note
  prefix: 📝

── Thành tiền ─────────────────────────────────────────────
Label:       color #b0956a, fontSize 11
Value:       color #FF8C00, fontWeight 800

Tổng cộng:   gradient bg-clip-text: linear-gradient(135deg,#FF6B00,#FFB347)
             fontWeight 700, fontSize 14

── Trạng thái thanh toán ──────────────────────────────────
Đã thanh toán:    color #3ecf6e   | text "✅ Đã thanh toán"
Đã trả bằng xu:   color #3ecf6e   | text "✅ Đã trả bằng xu"
Chưa thanh toán:  color #ff6060   | text "💵 Chưa thanh toán"
Chờ chuyển khoản: color #FFB347   | text "⏳ Chờ chuyển khoản"
Còn phải trả:     color #ff6060   | fontWeight 700

── Xu (trong bảng thanh toán) ─────────────────────────────
🪙 Xu Giao Nhanh:  color #FFB347 (trừ vào total)
🎁 Xu thưởng:      color #FFB347 (trừ vào total)
Voucher giảm:      color #3ecf6e (trừ vào total)
Hoa hồng / phí:   color #ff6060

── Container chung ─────────────────────────────────────────
Item list wrapper:  bg rgba(255,255,255,0.03), border rgba(255,255,255,0.05-0.06), borderRadius 10
Options sub-box:    bg rgba(255,255,255,0.02-0.03), border rgba(255,255,255,0.06-0.07), borderRadius 8
Payment box:        bg rgba(255,255,255,0.02), border rgba(255,255,255,0.05-0.07), borderRadius 10

Divider ngang:      1px solid rgba(255,255,255,0.04-0.07)
Section label:      color #6a5a40, fontSize 8–8.5px, fontWeight 700, textTransform uppercase, letterSpacing 0.5–0.6
```

---

## ItemBreakdown Type

> Chuẩn dùng trong `src/app/(customer)/orders/page.tsx` và `src/app/(merchant)/merchant/page.tsx`.
> File `src/app/(driver)/driver/navigate/[orderId]/page.tsx` dùng `ItemOptions` (tên khác, cấu trúc tương tự).

```typescript
// Dùng ở Customer + Merchant (field "breakdown" trong order_items)
interface ItemBreakdown {
  basePrice:  number              // Giá món gốc (không size, không topping)
  sizeLabel?: string              // Tên size, VD: "Lớn", "Size L"
  sizeDiff?:  number              // Phụ phí chọn size (0 nếu không tính thêm)
  toppings?:  { name: string; price: number }[]  // Danh sách topping
}

// Dùng ở Driver navigate (field "options" trong order_items — migration 20260615_order_items_options.sql)
interface ItemOptions {
  size?:     { name: string; price: number }
  toppings?: { name: string; price: number }[]
}

// Item type đầy đủ
interface OrderItem {
  name:      string
  qty:       number
  price:     number           // Đơn giá (đã bao gồm size + toppings)
  subtotal:  number           // price × qty
  note?:     string
  breakdown?: ItemBreakdown   // Customer / Merchant
  options?:   ItemOptions     // Driver navigate
}
```

> **Khi nào có breakdown:** Khi customer chọn size hoặc topping tại cart. Nếu không có tùy chọn, `breakdown` = null và chỉ hiện tên + giá đơn thuần.
> **Fallback:** Dùng `parseItemName(item.name)` để parse size/topping từ tên nếu breakdown null.

---

## Customer — Trang đơn hàng (`/customer/orders/page.tsx`)

### Cấu trúc expanded order card (theo thứ tự từ trên xuống)

```
[1] Section: Chi tiết món  ← CHỈ hiển thị cho serviceType = food | errand_buy | errand_deliver
    KHÔNG hiển thị cho ride_motorbike | ride_car | ride_car_4 | ride_car_7

[2] Section: Thông tin thanh toán  ← Luôn hiển thị

[3] Section: Thông tin giao hàng  ← CHỈ cho food | errand
    (Xe ôm/taxi không có phần này)

[4] Ảnh gói hàng (nếu errand + có ảnh)

[5] Đánh giá inline (nếu completed + chưa đánh giá)
```

### [1] Chi tiết món

```
Container: bg rgba(255,255,255,0.03) | border rgba(255,255,255,0.05) | borderRadius 10 | overflow hidden

Mỗi item:
  padding: 10px 12px
  borderBottom: "1px solid rgba(255,255,255,0.04)" (trừ item cuối)

  ─ Dòng 1: [Badge số] [Tên món] [×qty]
      Badge: w20 h20 circle | bg rgba(255,107,0,0.15) | border rgba(255,107,0,0.3) | color #FF8C00 | fw800 | fs11
      Tên:   color #f8f0e0 | fs 11.5 | fw700 | flex:1
      Qty:   color #6a5a40 | fs11

  ─ [Options box] — CHỈ hiển thị khi có size hoặc topping
      bg rgba(255,255,255,0.02) | border rgba(255,255,255,0.06) | borderRadius 8 | marginBottom 6

      KHI CÓ breakdown data (hasBd = true):
        Giá gốc:      label #6a5a40 | value #b0956a fw600   ← fs11
        ▸ Size X:     color #4a8ff5 | +Xđ #4a8ff5 fw600     ← chỉ nếu sizeDiff > 0
        + Topping:    color #3ecf6e | +Xđ #3ecf6e fw600

      KHI CHỈ PARSE TỪ TÊN (hasBd = false):
        ▸ Size X:     color #4a8ff5 | "đã tính" #6a5a40
        + Topping:    color #3ecf6e | "đã tính" #6a5a40

  ─ Thành tiền:
      label: "Thành tiền (×N)" — color #b0956a | fs11
      value: formatPrice(price × qty) — color #FF8C00 | fs12 | fw800

  ─ Ghi chú món (nếu có):
      bg rgba(245,197,66,0.08) | border rgba(245,197,66,0.2) | borderRadius 7
      color #f5c542 | fs11 | flex gap5
      prefix: 📝 (fw700, flexShrink:0)

Footer: Ghi chú đơn (order.note nếu có)
  bg rgba(245,197,66,0.04) | border-top rgba(255,255,255,0.04)
  color #b0956a | fs11
  prefix: 📝
```

### [2] Thông tin thanh toán

```
Container: bg rgba(255,255,255,0.02) | border rgba(255,255,255,0.05) | borderRadius 10 | padding 8px 10px

Rows (chỉ render nếu value > 0):
  Tiền hàng / Cước phí xe  — color #b0956a
  Phí giao hàng            — color #b0956a   (ẩn nếu = 0)
  Voucher giảm             — color #3ecf6e   (prefix "−", ẩn nếu = 0)
  🪙 Xu Giao Nhanh         — color #FFB347   (prefix "−", ẩn nếu = 0)
  🎁 Xu thưởng             — color #FFB347   (prefix "−", ẩn nếu = 0)

Divider: height 1px | bg rgba(255,255,255,0.07) | margin 6px 0

Tổng cộng:
  label: "Tổng cộng" — color #f8f0e0 | fs11 | fw600
  value: gradient bg-clip-text linear-gradient(135deg,#FF6B00,#FFB347) | fs14 | fw700

Còn phải trả (chỉ khi cashPayable > 0 && paymentStatus !== "paid"):
  label: "Còn phải trả" — color #6a5a40 | fs11
  value: formatPrice(cashPayable) — color #ff6060 | fs11 | fw700

Footer row:
  left:  order.payMethod — color #6a5a40 | fs11
  right: statusText — color theo trạng thái | fs11 | fw600
```

---

## Merchant — Expanded order card (`/merchant/page.tsx`)

### Cấu trúc expanded order

```
[1] Thông tin khách hàng + driver (nếu có)

[2] Chi tiết đơn hàng

[3] Thông tin thanh toán (merchant view — khác customer view)

[4] Dispatch indicator (nếu đang preparing/accepted)

[5] Action buttons (Từ chối | Bắt đầu làm | Đã xong...)
```

### [2] Chi tiết đơn hàng (merchant view)

```
Container: bg rgba(255,255,255,0.03) | border rgba(255,255,255,0.06) | borderRadius 10 | overflow hidden

Mỗi item: padding 10px 12px

  ─ Dòng 1: [Badge số] [Tên món] [Giá gốc]
      Badge:   w20 h20 | bg rgba(255,107,0,0.15) | border rgba(255,107,0,0.3) | color #FF8C00 | fw800 | fs9
      Tên:     color #f8f0e0 | fs12 | fw700 | flex:1
      Giá gốc: color #b0956a | fs10 | fw600   ← bd?.basePrice ?? item.price

  ─ [Options box] — CHỈ nếu có size/topping
      bg rgba(255,255,255,0.03) | border rgba(255,255,255,0.07) | borderRadius 8

      KHI CÓ breakdown:
        ▸ Size X:    color #4a8ff5 | fs9 | +Xđ fw700      ← chỉ nếu sizeDiff > 0
        + Topping:   color #3ecf6e | fs9 | +Xđ fw700

      KHI KHÔNG có breakdown (parse từ tên):
        ▸ Size chip: badge style | bg rgba(74,143,245,0.12) | border rgba(74,143,245,0.25) | color #4a8ff5
        + Topping chip: bg rgba(62,207,110,0.08) | border rgba(62,207,110,0.2) | color #3ecf6e

  ─ Bảng giá per-item:
      bg rgba(255,255,255,0.02) | border rgba(255,255,255,0.06) | borderRadius 8
      Thành tiền:  "đơn giá sau option" — label #6a5a40 | value #b0956a fw600 | fs9.5
      Số lượng:    ×N — label #6a5a40 | value #f8f0e0 fw700 | fs11
      Tổng tiền:   label #b0956a fw600 | value #FF8C00 fw800 | fs12  ← DÒNG QUAN TRỌNG

  ─ Ghi chú item (nếu có):
      bg rgba(245,197,66,0.08) | border rgba(245,197,66,0.2) | borderRadius 7
      color #f5c542 | fs9 | flex gap5
      prefix: "📝 Ghi chú:"

Footer: Ghi chú đơn (order.note)
  bg rgba(245,197,66,0.04) | border-top rgba(255,255,255,0.04)
  color #b0956a | fs9
  prefix: 📝
```

### [3] Thông tin thanh toán (merchant view)

> ⚠️ KHÁC HOÀN TOÀN với customer view. Merchant chỉ cần biết:
> **Chi tiết món + tổng tiền hàng + hoa hồng app + số tiền nhận từ tài xế.**
> **KHÔNG hiển thị:** phí giao hàng, xu khách, phương thức thanh toán online.
> Lý do: quán chỉ nhận tiền mặt từ tài xế, không quan tâm cách khách trả.

```
Container: bg rgba(0,0,0,0.2) | border rgba(255,255,255,0.07) | borderRadius 10 | padding 10px 12px

Rows (chỉ render nếu có giá trị):
  Tiền hàng (subtotal)     — color #f8f0e0 | prefix ""      ← tổng tiền các món
  Hoa hồng app X%          — color #ff6060 | prefix "−"     ← computed: subtotal × commRate
  🎫 Voucher quán giảm     — color #FFB347 | prefix "−"     ← CHỈ khi discountAmount > 0

  (KHÔNG có: phụ phí giao hàng, xu khách, phương thức TT)
  (Voucher toàn hệ thống của admin: KHÔNG hiển thị — quán không chịu chi phí đó)

Footer (border-top green rgba(62,207,110,0.3)):
  left:
    title: "✓ Tài xế trả quán" — color #3ecf6e | fs10.5 | fw800
    sub:   "💵 Tài xế trả tiền mặt khi lấy hàng" — color #6a5a40 | fs8
  right:
    netReceive = subtotal − commission − discountAmount — color #3ecf6e | fs16 | fw800
```

---

## Driver — Navigate page (`/driver/navigate/[orderId]/page.tsx`)

### Pickup phase — bên trong blue shop card

```
Shop card:
  bg rgba(74,143,245,0.07) | border rgba(74,143,245,0.22) | borderRadius 14 | padding 12px 14px

  Header chip: color #4a8ff5 | fs9 | fw700 | uppercase | "🏪 Đến lấy hàng tại"
  Shop name:   color #f8f0e0 | fs14 | fw700
  Shop addr:   color #6a5a40 | fs9.5
```

#### [A] Item list box

```
Container: bg rgba(255,255,255,0.02) | border rgba(255,255,255,0.06) | borderRadius 10 | padding 8px 11px

Header: "Đơn #XXXX · N món" — color #6a5a40 | fs8.5 | fw700 | uppercase | letterSpacing .5

Mỗi item: padding 6px 0 | borderBottom rgba(255,255,255,0.04)

  ─ Dòng 1: [i+1. Tên món] [×N · subtotal]
      Tên:      color #f8f0e0 | fs10.5 | fw700 | flex:1
      ×N·giá:  color #FF8C00 | fs10 | fw700

  ─ Giá/món (dưới tên, thụt 12px):
      color #6a5a40 | fs8.5

  ─ Size (nếu có options.size) — thụt 16px:
      "↳ Size: [tên]"  — color #4a8ff5 | fs9
      "+Xđ"            — color #4a8ff5 | fs9   (chỉ nếu price > 0)

  ─ Toppings (nếu có options.toppings) — thụt 16px:
      "↳ [tên topping]" — color #b464ff | fs9   ← MÀU TÍM (khác merchant/customer)
      "+Xđ"             — color #b464ff | fs9

  ─ Ghi chú (nếu có) — thụt 12px:
      "📝 [text]" — color #f5c542 | fs9 | flex gap:4
```

> ⚠️ **Driver dùng màu tím `#b464ff` cho topping** (không phải `#3ecf6e` như customer/merchant).
> Lý do: driver cần phân biệt rõ size (xanh) vs topping (tím) trong điều kiện ánh sáng kém khi lái xe.

#### [B] Payment table box

```
Container: bg rgba(255,255,255,0.02) | border rgba(255,255,255,0.06) | borderRadius 10 | padding 8px 11px

Header: "Thông tin thanh toán" — color #6a5a40 | fs8.5 | fw700 | uppercase

Rows:
  Tiền hàng (subtotal)          — color #b0956a | fs9
  Voucher giảm                  — color #3ecf6e | fs9    (prefix "−", ẩn nếu = 0)
  Phí ship                      — color #b0956a | fs9
  ─── divider sau dòng phí ship ─────────────────────────
  Trả cho quán (tiền mặt)       — color #FF8C00 | fs9 | fw BOLD ← DÒNG QUAN TRỌNG NHẤT
  HH quán X% — đã trừ ví        — color #ff6060 | fs9
  HH tài xế — đã trừ ví         — color #ff6060 | fs9

Divider: height 1px | bg rgba(255,255,255,0.07)

Footer row:
  left: phương thức TT — color #b0956a | fs9
  right (tùy trường hợp):
    Paid online:              "✅ Đã TT"               — color #3ecf6e | fw700
    All xu:                   "✅ Toàn bộ bằng xu"     — color #3ecf6e | fw700
    Xu + tiền mặt:            🪙 Xu: Xđ (#FFB347)
                              💵 Thu: Xđ (#ff6060 fw700)
    Tiền mặt hoàn toàn:      "💵 Thu: Xđ"             — color #ff6060 | fw700
```

### Delivery phase — thu tiền section

```
Container: bg rgba(255,255,255,0.02) | border rgba(255,255,255,0.07) | borderRadius 12 | padding 10px 12px

Header: "Thu tiền" — color #6a5a40 | fs8.5 | fw700 | uppercase

Cards layout: flex gap:8

Card trái — THU TIỀN MẶT:
  Khi chưa thu:   bg rgba(255,107,0,0.09) | border rgba(255,107,0,0.25)
                  label: "Thu tiền mặt" — color #6a5a40 | fs8
                  value: formatPrice(cashCollect) — color #FF8C00 | fs17 | fw800
  Khi đã TT:      bg rgba(62,207,110,0.07) | border rgba(62,207,110,0.22)
                  label: "Đã TT online" hoặc "Đã TT bằng xu" — color #6a5a40
                  value: "✅ Xong" — color #3ecf6e | fs17 | fw800

Card phải — XU ĐÃ TRỪ (chỉ hiện khi totalXu > 0):
  bg rgba(245,197,66,0.07) | border rgba(245,197,66,0.2)
  label: "🪙 Xu đã trừ" — color #6a5a40 | fs8
  value: formatPrice(totalXu) — color #FFB347 | fs17 | fw800
```

---

## Quy tắc bất biến

> Những điều TUYỆT ĐỐI KHÔNG thay đổi khi phát triển thêm:

```
1. Bảng màu option hierarchy:
   - Size:    #4a8ff5 (xanh dương) — nhất quán ở cả 3 vai trò
   - Topping: #3ecf6e (xanh lá) ở Customer/Merchant
              #b464ff (tím)     ở Driver — DO YÊU CẦU UX đặc biệt, không được đổi
   - Note:    #f5c542 (vàng) — nhất quán ở cả 3 vai trò

2. Thứ tự rows trong bảng thanh toán customer (không đảo):
   Tiền hàng → Phí ship → Voucher → Xu GN → Xu thưởng → [divider] → Tổng → Còn lại → PT/Status

3. Thứ tự rows merchant (không đảo, KHÔNG thêm ngoài danh sách):
   Tiền hàng → Hoa hồng app → Voucher quán (nếu có) → [divider green] → Tài xế trả quán
   ← KHÔNG được thêm: phí ship, xu, phương thức TT
   ← Voucher admin toàn hệ thống KHÔNG hiển thị với merchant

4. Thứ tự rows driver payment table (không đảo):
   Tiền hàng → Voucher → Phí ship → [divider] → Trả quán → HH quán → HH tài xế → [divider] → Thu

5. Font size hierarchy trong item list:
   Tên món:  10.5–12px
   Sub-opts: 9–11px
   Ghi chú:  9–11px
   Muted:    8–9px

6. "Thành tiền" / "Tổng tiền" cuối mỗi item = #FF8C00, fontWeight 800 — không được dùng màu khác

7. Gradient tổng đơn = linear-gradient(135deg,#FF6B00,#FFB347) bg-clip-text — KHÔNG dùng text màu thuần

8. Merchant KHÔNG thấy: xu khách, phí ship, voucher, phương thức TT, payment_status
   Driver KHÔNG thấy xu bonus tách riêng (chỉ thấy tổng = xuUsed + xuBonusUsed gộp)
   Customer thấy xu tách riêng: 🪙 Xu GN + 🎁 Xu thưởng
```

---

> Xem thêm: **CLAUDE.md** (Design System tổng thể) · **CLAUDE1.md** (Luồng nghiệp vụ, API) · **CLAUDE2.md** (file này)
