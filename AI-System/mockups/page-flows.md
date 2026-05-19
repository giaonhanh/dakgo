# PAGE FLOWS — Giao Nhanh
> Luồng điều hướng giữa các trang (ASCII mockup)

## Customer Flow — Đặt đồ ăn
```
/login
  ↓ (OTP success)
/ (Home)
  ├─→ /shop/{id} (tap quán)
  │     ↓ (thêm vào giỏ)
  │   /cart
  │     ↓ (đặt hàng)
  │   /checkout
  │     ↓ (xác nhận)
  │   /order-success
  │     ↓ (theo dõi)
  │   /tracking/{orderId}
  │
  ├─→ /ride (đặt xe)
  ├─→ /errand (mua hộ)
  ├─→ /orders (lịch sử)
  ├─→ /profile
  └─→ /cart (bottom nav)
```

## Customer Flow — Đặt xe
```
/ (Home) → ServiceGrid [Xe ôm | Taxi]
  ↓
/ride
  ├─ Tab: Xe ôm | Taxi
  ├─ Input: Điểm đón (Nominatim geocode)
  ├─ Input: Điểm đến
  ├─ Map preview (Leaflet)
  ├─ Giá ước tính: calcFare(distance, type)
  └─ [Đặt xe] → POST /api/rides → /tracking/{rideId}
```

## Customer Flow — Mua hộ
```
/ (Home) → ServiceGrid [Mua hộ]
  ↓
/errand
  ├─ Type: [Mua hộ] | [Giao hộ]
  ├─ Điểm lấy hàng
  ├─ Điểm giao
  ├─ [Mua hộ]: textarea danh sách đồ + ước giá
  ├─ [Giao hộ]: mô tả kiện hàng + ảnh upload
  ├─ Ghi chú + phương thức TT
  └─ [Xác nhận] → POST /api/errands → /tracking/{errandId}
```

## Driver Flow
```
/driver (Dashboard)
  ├─ Toggle: Online / Offline
  ├─ Map full-screen (vị trí hiện tại)
  ├─ OrderPopup (khi có đơn):
  │   ├─ Countdown 15s
  │   ├─ [Nhận đơn] | [Bỏ qua]
  │   └─ Nhận → /driver/navigate/{orderId}
  ├─ /driver/navigate/{id}: map + direction
  ├─ /driver/confirm-delivery/{id}: chụp ảnh + OTP
  └─ /driver/earnings: thu nhập + biểu đồ
```

## Merchant Flow
```
/merchant (Dashboard)
  ├─ Đơn đang chờ (real-time badge đỏ)
  ├─ [Nhận đơn] → status: preparing
  ├─ [Sẵn sàng] → status: ready (âm thanh báo)
  ├─ /merchant/menu: CRUD sản phẩm
  ├─ /merchant/revenue: doanh thu + biểu đồ
  └─ /merchant/promotions: tạo flash sale
```

---

## Screen sizes reference
```
375×667  — iPhone SE (minimum support)
390×844  — iPhone 14 (primary target)
428×926  — iPhone 14 Plus
768×1024 — iPad (merchant dashboard)
1280×800 — Desktop (admin only)
```

## Bottom Nav visibility
```
Show on: tất cả trang customer EXCEPT /login, /order-success
Height: 56px (h-14) + safe-area-inset-bottom
Content padding: pb-[calc(56px+env(safe-area-inset-bottom)+16px)]
```
