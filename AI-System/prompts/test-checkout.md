# TEST CHECKOUT FLOW — Giao Nhanh
> Flow-based testing cho toàn bộ luồng đặt hàng customer

## Trigger
Dùng khi: sau khi sửa cart/checkout/order · trước release

## Context cần load
```
AI-System/agents/master-context.md
```

---

## HAPPY PATH — Luồng đặt hàng chuẩn

### Step 1: Chọn quán
```
URL: /shop/{shopId}
Check:
✓ Shop header load (logo, name, rating, km)
✓ Products filter theo category
✓ ProductCard: ảnh, tên, giá, nút "+"
✓ Nút "+" → spawnParticles() animation
✓ Cart badge bottom nav cập nhật (+1)
```

### Step 2: Giỏ hàng
```
URL: /cart
Check:
✓ CartItem: tên, giá, tăng/giảm qty, xóa item
✓ Ghi chú món (optional text field)
✓ Voucher input: nhập code → validate → apply discount
✓ Địa chỉ giao: default address hiện sẵn
✓ Subtotal, delivery fee (15,000đ), discount, TOTAL
✓ CTA "Đặt hàng" → /checkout
```

### Step 3: Checkout
```
URL: /checkout
Check:
✓ Review địa chỉ (có thể đổi)
✓ Thời gian giao (ASAP / hẹn giờ)
✓ Phương thức TT: cash | VietQR | MoMo
✓ Order summary: items list + totals
✓ CTA shimmer → POST /api/orders
✓ Loading state trong khi call API
```

### Step 4: Order Success
```
URL: /order-success
Check:
✓ Confetti animation 3s
✓ Mã đơn #GN{id}
✓ ETA hiển thị
✓ Nút "Theo dõi đơn" → /tracking/{orderId}
✓ Nút "Về trang chủ" → /
```

### Step 5: Live Tracking
```
URL: /tracking/{orderId}
Check:
✓ Leaflet dark map load (no SSR error)
✓ Driver marker hiển thị vị trí
✓ Status timeline: pending → accepted → delivering → delivered
✓ Supabase Realtime: location update live
✓ ETA countdown
```

---

## EDGE CASES

### Shop đóng cửa
```
Check:
✓ Badge "Đóng cửa" trên shop card
✓ Nút "+" bị disabled
✓ Toast: "Quán hiện đang đóng cửa"
```

### Giỏ hàng rỗng
```
Check:
✓ Empty state với illustration
✓ CTA "Khám phá quán ăn" → /
✓ Không thể qua /checkout trực tiếp
```

### Voucher không hợp lệ
```
Input: "ABCXYZ" (sai code)
Check:
✓ Error toast: "Mã giảm giá không hợp lệ"
✓ Không apply discount
✓ Input cleared
```

### Mất kết nối
```
Check:
✓ Toast: "Mất kết nối. Vui lòng thử lại."
✓ Retry button
✓ Cart data vẫn còn (Zustand persist)
```

---

## API Endpoints cần test
```
POST /api/orders          → tạo đơn
GET  /api/orders/{id}     → lấy đơn
POST /api/orders/{id}/cancel → hủy
GET  /api/shops/nearby    → danh sách quán
POST /api/payment/vietqr  → tạo QR
```

## Test commands (curl)
```bash
# Tạo đơn test
curl -X POST /api/orders \
  -H "Content-Type: application/json" \
  -d '{"shop_id":"...","items":[...],"delivery_address":"...","payment_method":"cash"}'

# Kiểm tra đơn
curl /api/orders/{id}
```
