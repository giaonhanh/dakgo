# API ROUTES CONTEXT — Giao Nhanh
> Reference nhanh cho tất cả API endpoints

## Auth
Middleware handle auth — không cần token trong header khi call từ browser.
Server-side: dùng `createServerClient` với cookies.

## Orders
```
POST /api/orders
  Body: { shop_id, items: [{product_id, quantity, note}], delivery_address, delivery_lat, delivery_lng, payment_method, voucher_id? }
  Returns: { order_id, total_amount, estimated_delivery_at }

GET  /api/orders/{id}
  Returns: Order with items, shop, driver

POST /api/orders/{id}/cancel
  Body: { reason }
  Returns: { success }
```

## Rides
```
POST /api/rides
  Body: { vehicle_type, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, payment_method }
  Returns: { ride_id, estimated_fare, driver? }
```

## Errands (Mua hộ / Giao hộ)
```
POST /api/errands
  Body: { type: "buy_for_me"|"deliver_for_me", pickup_address, delivery_address, items_description?, service_fee, payment_method }
  Returns: { errand_id }
```

## Shops
```
GET /api/shops/nearby?lat={}&lng={}&radius={km}
  Returns: Shop[] sorted by distance
```

## Payment
```
POST /api/payment/vietqr
  Body: { order_id, amount }
  Returns: { qr_image_url, payment_url }

POST /api/payment/webhook
  Headers: { x-signature }
  Body: provider-specific webhook payload
```

## Dispatch
```
POST /api/dispatch
  Body: { order_id }
  Finds nearest driver → sends push → creates assignment
```

## Notifications
```
POST /api/notify/send
  Body: { user_id, title, body, data? }
  Sends FCM push + saves to DB
```

## Error format chuẩn
```typescript
// Mọi API trả về format này khi lỗi:
{ error: string, code?: string }

// Ví dụ:
{ error: "Shop không tồn tại", code: "SHOP_NOT_FOUND" }
{ error: "Đơn hàng đã bị hủy", code: "ORDER_CANCELLED" }
```

## Response format chuẩn
```typescript
// Success:
{ data: T, message?: string }

// Paginated:
{ data: T[], total: number, page: number, limit: number }
```
