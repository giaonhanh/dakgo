# CLAUDE1.md — Giao Nhanh PWA (Phần 2/2)
> Tiếp theo từ CLAUDE.md (Phần 1).
> File này: Giai đoạn 4-7 · API Routes · Realtime · PWA · Luồng nghiệp vụ · Checklist launch

---

## MỤC LỤC

- [Giai đoạn 4 — Tài xế](#giai-đoạn-4--tài-xế-tuần-78)
- [Giai đoạn 5 — Merchant](#giai-đoạn-5--merchant-tuần-89)
- [Giai đoạn 6 — Admin](#giai-đoạn-6--admin-tuần-910)
- [Giai đoạn 7 — Tích hợp & Hoàn thiện](#giai-đoạn-7--tích-hợp--hoàn-thiện-tuần-1112)
- [API Routes](#api-routes)
- [Realtime Channels](#realtime-channels)
- [PWA & Service Worker](#pwa--service-worker)
- [Luồng nghiệp vụ](#luồng-nghiệp-vụ-chi-tiết)
- [Checklist Launch](#checklist-trước-khi-launch)

---

## GIAI ĐOẠN 4 — Tài xế (Tuần 7–8)

### Checklist

```
□ 4.1  Register Page — form: CMND, bằng lái, biển số, ảnh xe (Supabase Storage), chờ admin duyệt
□ 4.2  Dashboard — toggle Online/Offline, bản đồ full-screen, stats hôm nay, thu nhập + progress bar
□ 4.3  OrderPopup — Framer Motion slide lên từ dưới, thông tin đơn, countdown 15s, Nhận/Từ chối
□ 4.4  Navigate Page — dynamic Leaflet route Quán→Khách, ETA, nút "Đã lấy hàng" / "Đã giao xong"
□ 4.5  Confirm Delivery — OTP input 4 số (khách đọc) HOẶC chụp ảnh (upload Storage)
□ 4.6  Earnings Page — Recharts bar chart 7 ngày, tổng tuần, lịch sử đơn
□ 4.7  Driver Profile — rating TB, huy hiệu, thông tin xe, cập nhật hồ sơ
```

### GPS tracking hook

```typescript
// src/hooks/useDriverLocation.ts
import { useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"

export function useDriverLocation(driverId: string, isOnline: boolean) {
  useEffect(() => {
    if (!isOnline) return
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const watchId = navigator.geolocation.watchPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        // Upsert vị trí vào DB
        await supabase.from("drivers").update({
          location: `POINT(${lng} ${lat})`,
          location_updated_at: new Date().toISOString(),
        }).eq("id", driverId)

        // Broadcast cho khách đang tracking và admin map
        supabase.channel("driver-locations:all").send({
          type: "broadcast",
          event: "location",
          payload: { driverId, lat, lng },
        })
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [driverId, isOnline])
}
```

### OrderPopup — Countdown 15 giây

```tsx
// src/components/driver/OrderPopup.tsx
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"

export function OrderPopup({ order, onAccept, onReject }) {
  const [countdown, setCountdown] = useState(15)

  useEffect(() => {
    if (countdown <= 0) { onReject(); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50
          bg-[rgba(10,9,7,0.97)] border-t border-[rgba(255,107,0,0.2)]
          rounded-t-[20px] p-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[var(--text-primary)] font-bold text-[14px]">
            🔔 Đơn hàng mới!
          </span>
          {/* Countdown ring */}
          <div className="w-[32px] h-[32px] rounded-full border-2 border-[#FF6B00]
            flex items-center justify-center text-[#FF6B00] font-bold text-[11px]">
            {countdown}
          </div>
        </div>

        {/* Order info */}
        <div className="bg-[rgba(255,255,255,0.04)] rounded-[12px] p-3 mb-3
          border border-[rgba(255,255,255,0.08)]">
          <div className="flex gap-2 mb-2 pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <span className="text-[10px]">🏪</span>
            <div>
              <div className="text-[var(--text-muted)] text-[8px]">Lấy hàng tại</div>
              <div className="text-[var(--text-primary)] text-[10px] font-semibold">
                {order.shop?.name}
              </div>
              <div className="text-[#FF8C00] text-[8px]">📍 {order.pickup_distance}km từ bạn</div>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-[10px]">📍</span>
            <div>
              <div className="text-[var(--text-muted)] text-[8px]">Giao đến</div>
              <div className="text-[var(--text-primary)] text-[10px] font-semibold">
                {order.delivery_address}
              </div>
            </div>
          </div>
        </div>

        {/* Fare */}
        <div className="flex items-center justify-between mb-3
          bg-[rgba(255,107,0,0.08)] rounded-[10px] p-3
          border border-[rgba(255,107,0,0.2)]">
          <div>
            <div className="text-[var(--text-muted)] text-[8px]">Tiền công</div>
            <div className="text-[#FF8C00] text-[16px] font-bold">
              {order.driver_fee?.toLocaleString("vi-VN")}đ
            </div>
            <div className="text-[var(--text-muted)] text-[8px]">
              ~{order.distance_km}km · ~{order.eta_minutes} phút
            </div>
          </div>
          <div className="text-right">
            <div className="text-[var(--text-muted)] text-[8px]">Thanh toán</div>
            <div className="text-[var(--green)] text-[11px] font-semibold">
              {order.payment_method === "cash" ? "Tiền mặt" : "Ví app"}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button onClick={onReject}
            className="flex-1 h-[36px] rounded-[10px]
              bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]
              text-[var(--text-muted)] text-[10px] font-semibold">
            Từ chối
          </button>
          <button onClick={onAccept}
            className="flex-[2] h-[36px] rounded-[10px] relative overflow-hidden
              bg-gradient-to-r from-[#FF6B00] to-[#FF8C00]
              text-white text-[11px] font-bold
              shadow-[0_3px_12px_rgba(255,107,0,0.35)]">
            <span className="absolute top-0 left-[-60%] w-[35%] h-full
              bg-gradient-to-r from-transparent via-white/20 to-transparent
              animate-[shimmer_2s_infinite]" />
            <span className="relative z-10">✓ Nhận đơn</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
```

### Auto-dispatch API

```typescript
// src/app/api/dispatch/route.ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  const { orderId } = await req.json()
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // Service role để bypass RLS
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  )

  const { data: order } = await supabase
    .from("orders").select("delivery_lat, delivery_lng").eq("id", orderId).single()

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 })

  const { data: driverId } = await supabase.rpc("find_nearest_driver", {
    order_lat: order.delivery_lat,
    order_lng: order.delivery_lng,
    max_distance_km: 5,
  })

  if (driverId) {
    await supabase.channel(`driver:${driverId}`).send({
      type: "broadcast", event: "new_order", payload: { orderId },
    })
    return Response.json({ dispatched: true, driverId })
  }

  return Response.json({ dispatched: false, message: "No driver available" })
}
```

---

## GIAI ĐOẠN 5 — Merchant (Tuần 8–9)

### Checklist

```
□ 5.1  Register Page — form: tên quán, địa chỉ (Leaflet map), giờ mở cửa, ảnh bìa, GPKD upload
□ 5.2  Dashboard — Supabase Realtime INSERT orders, âm thanh new-order.mp3,
         slide-in card (Framer Motion), tabs Mới/Đang làm/Xong, xác nhận 1 chạm
□ 5.3  Menu Management — CRUD product, toggle is_available, upload ảnh Storage, sort_order
□ 5.4  Revenue Page — Recharts BarChart tuần, top 3 món bán chạy, tổng tháng, export
□ 5.5  Shop Profile — sửa tên/mô tả/địa chỉ, giờ hoạt động từng ngày, toggle is_open
□ 5.6  Promotions — tạo voucher (flash sale / combo / % giảm theo giờ / freeship)
□ 5.7  Reviews — xem rating trung bình, danh sách phản hồi, trả lời comment
```

### Merchant Realtime — Âm thanh + Slide-in

```typescript
// src/app/(merchant)/page.tsx
"use client"
import { useEffect, useRef, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { motion, AnimatePresence } from "framer-motion"

export default function MerchantDashboard() {
  const [newOrders, setNewOrders] = useState([])
  const [needAudioPerm, setNeedAudioPerm] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const shopId = "..." // Lấy từ session

  useEffect(() => {
    audioRef.current = new Audio("/sounds/new-order.mp3")
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase
      .channel(`merchant:${shopId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "orders",
        filter: `shop_id=eq.${shopId}`,
      }, (payload) => {
        // Phát âm thanh
        audioRef.current?.play().catch(() => setNeedAudioPerm(true))
        // Rung thiết bị (mobile)
        navigator.vibrate?.([200, 100, 200])
        // Thêm vào list
        setNewOrders(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [shopId])

  return (
    <div>
      {/* Banner yêu cầu quyền âm thanh */}
      <AnimatePresence>
        {needAudioPerm && (
          <motion.button
            initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="w-full bg-[rgba(255,107,0,0.15)] border-b border-[var(--border)]
              py-2 text-[10px] text-[#FF8C00] text-center"
            onClick={() => { audioRef.current?.play(); setNeedAudioPerm(false) }}
          >
            🔔 Nhấn để bật âm thanh thông báo đơn mới
          </motion.button>
        )}
      </AnimatePresence>
      {/* ... rest of UI */}
    </div>
  )
}
```

---

## GIAI ĐOẠN 6 — Admin (Tuần 9–10)

### Checklist

```
□ 6.1  Layout — Sidebar navigation (collapse được), top bar, responsive
□ 6.2  KPI Dashboard — 4 cards (doanh thu/đơn/tài xế online/khách mới),
         Recharts LineChart doanh thu 7 ngày + BarChart đơn theo giờ trong ngày
□ 6.3  Live Map — Leaflet, tất cả tài xế real-time Supabase Realtime,
         cluster markers, heatmap khu vực nóng
□ 6.4  Driver Management — danh sách, filter, xem hồ sơ + giấy tờ, Approve/Reject, khoá/mở TK
□ 6.5  Merchant Management — danh sách, xem GPKD, duyệt/từ chối, edit commission_rate
□ 6.6  Orders Management — tất cả đơn, filter/search, xem chi tiết, can thiệp nếu cần
□ 6.7  Finance — doanh thu brutto/netto, hoa hồng, lịch giải ngân merchant/tài xế
□ 6.8  Disputes — khiếu nại, xem ảnh/note bằng chứng, quyết định hoàn tiền
□ 6.9  Notifications — soạn nội dung + chọn nhóm (all/customer/driver/merchant) + schedule
□ 6.10 System Settings — delivery_fee_per_km, commission %, khu vực hoạt động, giờ phục vụ
□ 6.11 User Management — danh sách khách, lịch sử đơn, điểm loyalty, khoá TK, blacklist
□ 6.12 Role Management — gán role Admin/Sub-admin/Support cho tài khoản
```

### Admin Live Map — Realtime tất cả tài xế

```typescript
// src/app/(admin)/map/MapClient.tsx  ← dynamic no-ssr
"use client"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"

const DARK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"

export default function AdminLiveMap() {
  const [drivers, setDrivers] = useState<Map<string, {lat:number;lng:number;name:string}>>(new Map())

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase.channel("driver-locations:all")
      .on("broadcast", { event: "location" }, ({ payload }) => {
        setDrivers(prev => new Map(prev).set(payload.driverId, {
          lat: payload.lat, lng: payload.lng, name: payload.name ?? "Tài xế"
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const PHUOC_AN_CENTER: [number, number] = [12.6833, 108.4833]

  return (
    <MapContainer center={PHUOC_AN_CENTER} zoom={14} style={{ height: "100%", width: "100%" }}>
      <TileLayer url={DARK_TILE} attribution="CartoDB" />
      {Array.from(drivers.entries()).map(([id, d]) => (
        <Marker key={id} position={[d.lat, d.lng]}>
          <Popup>{d.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
```

---

## GIAI ĐOẠN 7 — Tích hợp & Hoàn thiện (Tuần 11–12)

### Checklist

```
□ 7.1  VietQR — generate URL, test quét thực tế với banking app
□ 7.2  MoMo Business SDK — tích hợp, test sandbox, xử lý webhook /api/payment/webhook
□ 7.3  FCM Push Notification — test Android Chrome + iOS Safari (Web Push)
□ 7.4  PWA install prompt — hiển thị sau lần dùng thứ 2 (beforeinstallprompt event)
□ 7.5  Offline mode — cache trang chủ + thực đơn + asset, toast "Đang offline"
□ 7.6  Performance — Lighthouse PWA ≥ 90, bundle analyzer, tree-shaking Framer Motion
□ 7.7  Test 4G thực tế tại Phước An: Android + iPhone
□ 7.8  Beta test: 5+ tài xế + 3+ quán + 20+ khách thực tế
□ 7.9  Fix bug, optimize image (next/image + webp), lazy load
□ 7.10 Production deploy + Vercel Analytics + Supabase monitoring
```

### VietQR — Không cần API key

```typescript
// src/lib/utils.ts
export function generateVietQR(amount: number, orderId: string): string {
  const BANK_ID = "BIDV"              // Thay bằng ngân hàng thực
  const ACCOUNT = "1234567890"        // Thay bằng số TK thực
  const addInfo = encodeURIComponent(`GN${orderId.slice(0,8).toUpperCase()}`)
  return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT}-qr_only.png?amount=${amount}&addInfo=${addInfo}`
}
// Dùng thẻ <img src={generateVietQR(amount, orderId)} /> — không cần fetch
```

### next.config.ts — PWA Setup

```typescript
import withPWA from "next-pwa"
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "img.vietqr.io" },
    ],
    formats: ["image/webp", "image/avif"],
  },
}
export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: "NetworkFirst",
      options: { cacheName: "supabase-api", expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
    },
    {
      urlPattern: /^https:\/\/.*\.cartocdn\.com\/.*/i,
      handler: "CacheFirst",
      options: { cacheName: "map-tiles", expiration: { maxEntries: 500, maxAgeSeconds: 86400 } },
    },
  ],
})(nextConfig)
```

---

## API Routes

| Method | Endpoint | Mô tả | Auth cần |
|---|---|---|---|
| POST | `/api/orders` | Tạo đơn hàng + trigger dispatch | customer |
| PATCH | `/api/orders/[id]` | Cập nhật trạng thái đơn | driver/merchant/admin |
| POST | `/api/orders/[id]/cancel` | Hủy đơn + check blacklist trigger | customer |
| POST | `/api/rides` | Tạo đặt xe + dispatch | customer |
| POST | `/api/errands` | Tạo mua hộ/giao hộ | customer |
| GET | `/api/shops/nearby` | Quán gần theo PostGIS | customer |
| POST | `/api/dispatch` | Phân bổ đơn cho tài xế gần nhất | internal |
| POST | `/api/payment/vietqr` | Generate VietQR URL | customer |
| POST | `/api/payment/momo` | Khởi tạo MoMo payment | customer |
| POST | `/api/payment/webhook` | Callback xác nhận TT từ MoMo | external |
| POST | `/api/notify/send` | Gửi FCM push notification | admin/internal |
| POST | `/api/notify/register` | Đăng ký FCM token của device | any auth |

### Cấu trúc response chuẩn

```typescript
// Thành công
{ success: true, data: {...} }
// Lỗi
{ success: false, error: "Mô tả lỗi thân thiện", code: "ERROR_CODE" }
```

---

## Realtime Channels

```typescript
// Naming convention — channel ID rõ ràng, không conflict

"order:{orderId}"            // Trạng thái đơn → customer + merchant + driver
"driver-location:{orderId}"  // Vị trí tài xế đang giao → customer tracking
"driver-locations:all"       // Tất cả tài xế → admin live map
"merchant:{shopId}"          // Đơn mới INSERT → merchant dashboard
"driver:{driverId}"          // New order broadcast → driver popup
"admin-overview"             // KPI stats live → admin dashboard

// Pattern subscription:
const channel = supabase.channel("channel-name")
  .on("broadcast", { event: "event-name" }, ({ payload }) => {
    // handle payload
  })
  .on("postgres_changes", {
    event: "INSERT" | "UPDATE" | "DELETE",
    schema: "public",
    table: "table-name",
    filter: "column=eq.value",
  }, (payload) => {
    // handle change
  })
  .subscribe()

// Cleanup:
return () => { supabase.removeChannel(channel) }
```

---

## PWA & Service Worker

### public/sw-custom.js — Push Notification handler

```javascript
// Phần này next-pwa tự gen sw.js, nhưng cần thêm push handler
// Tạo public/sw-custom.js rồi config trong next-pwa

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Giao Nhanh", {
      body:    data.body,
      icon:    "/icon-192.png",
      badge:   "/icon-192.png",
      data:    data.data,
      vibrate: [200, 100, 200],
      tag:     data.tag ?? "default",
      renotify: true,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find(w => w.url.includes(url) && "focus" in w)
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
```

### hooks/usePushNotification.ts

> ✅ **Đã triển khai** — Dùng Web Push VAPID, không cần Firebase SDK.
> Subscription lưu vào bảng `push_subscriptions` (user_id, endpoint, p256dh, auth).
> Edge Function `send-push` đọc bảng này để gửi notification.

```typescript
// src/hooks/usePushNotification.ts  ← code thực tế đang dùng
"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function usePushNotification() {
  const [permission, setPermission] = useState<"default"|"granted"|"denied">(() => {
    if (typeof Notification === "undefined") return "default"
    return Notification.permission as "default"|"granted"|"denied"
  })

  const requestPermission = async (userId: string): Promise<boolean> => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return false

    const result = await Notification.requestPermission()
    setPermission(result as "default"|"granted"|"denied")
    if (result !== "granted") return false

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    const sub = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    })

    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    const supabase = createClient()
    await supabase.from("push_subscriptions").upsert({
      user_id: userId, endpoint: json.endpoint,
      p256dh: json.keys.p256dh, auth: json.keys.auth,
    }, { onConflict: "user_id" })
    return true
  }

  const unsubscribe = async (userId: string) => {
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
    const supabase = createClient()
    await supabase.from("push_subscriptions").delete().eq("user_id", userId)
  }

  return { permission, requestPermission, unsubscribe }
}

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0))) as unknown as ArrayBuffer
}
```

> **Env cần có:**
> - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — public key (để ở client)
> - `VAPID_PRIVATE_KEY` — private key (chỉ server/Edge Fn, KHÔNG public)
> - Sinh bằng: `npx web-push generate-vapid-keys`

### PWA Install Prompt

> ✅ **Đã triển khai** — `src/hooks/usePWAInstall.ts` + `src/components/pwa/InstallPrompt.tsx`
> Tích hợp vào `src/app/(customer)/layout.tsx`.

**Logic:**
- Lần 1: hiện full modal ngay — hướng dẫn cụ thể theo OS/trình duyệt
- Lần 2+: nếu chưa cài → hiện reminder bar nhỏ phía trên bottom nav
- Sau khi cài hoặc bấm "Đã cài xong" → không hiện lại

**Platform detection:**
| Platform | Hành động |
|---|---|
| Android Chrome | Native `beforeinstallprompt` → nút "Cài đặt ngay" |
| iOS Safari | Hướng dẫn 3 bước: Share → "Thêm vào Màn hình chính" → Thêm |
| iOS Chrome/Firefox | Thông báo dùng Safari |
| Desktop Chrome/Edge | Native `beforeinstallprompt` |

**Env không cần thêm gì cho install prompt** — chỉ dùng browser API.

**localStorage keys:**
- `pwa_visits` — đếm số lần vào app
- `pwa_dismissed` — đã bấm "Để sau"
- `pwa_installed` — đã xác nhận cài xong

---

## Luồng nghiệp vụ chi tiết

### 1. Đặt đồ ăn — End to End

```
Khách:
1. /shop/{shopId} → chọn món → nhấn "+" → spawnParticles() + cartStore.add()
2. CartBar xuất hiện phía trên BottomNav
3. → /cart: xem lại, tăng/giảm, ghi chú, nhập voucher
4. → /checkout: xác nhận địa chỉ (saved_addresses hoặc nhập + Nominatim)
   Chọn thời gian: Ngay / Hẹn giờ
   Chọn TT: Tiền mặt / VietQR / MoMo
5. Nhấn CTAButton → POST /api/orders → INSERT orders + order_items
6. API trigger POST /api/dispatch (background)
7. → /order-success: Confetti + #GNXXXX + ETA + nút "Theo dõi đơn"
8. → /tracking/{orderId}: Leaflet dark map, marker tài xế realtime

Tài xế:
1. Nhận broadcast channel "driver:{id}" → OrderPopup hiện ra (15s countdown)
2. Nhấn "Nhận đơn" → PATCH orders SET driver_id, status="accepted"
3. → /driver/navigate/{orderId}: Leaflet route đến quán
4. Nhấn "Đã lấy hàng" → PATCH status="delivering"
5. Route chuyển sang địa chỉ khách
6. Nhấn "Đã giao xong" → /driver/confirm-delivery/{orderId}
7. Nhập OTP (khách đọc) hoặc chụp ảnh → PATCH status="delivered"

Hệ thống:
- Trigger add_loyalty_points() → cộng điểm cho khách
- Cộng thu nhập vào ví tài xế
- UPDATE shop rating_avg nếu có review mới
```

### 2. Đặt xe ôm/Taxi — End to End

```
1. /ride → chọn tab Xe ôm/Taxi/Xe điện
2. Input điểm đón: GPS tự điền hoặc nhập + Nominatim geocode
3. Input điểm đến: nhập + Nominatim geocode
4. Bản đồ Leaflet vẽ route (OSRM) + tính distance
5. Hiện giá ước tính: calcFare(distKm, vehicleType)
6. Nhấn "Đặt xe ngay · {giá}" → POST /api/rides
7. API: INSERT rides + dispatch tài xế có vehicle_type phù hợp
8. Màn hình "Đang tìm tài xế": bản đồ + animated spinner
9. Tài xế nhận → Realtime UPDATE ride status="accepted"
10. Hiện info tài xế + route đang đến
11. Tài xế đến → status="arrived" + notification "Tài xế đã đến chỗ bạn"
12. Lên xe → status="in_progress"
13. Đến nơi → status="completed" + rating + thanh toán
```

### 3. Mua hộ/Giao hộ — End to End

```
1. /errand → chọn loại: Mua hộ / Giao hộ
2. Nhập địa chỉ lấy (chợ/cửa hàng) + địa chỉ giao đến
3. Mua hộ: nhập danh sách đồ cần mua (text, mỗi dòng 1 món + ước giá)
   Giao hộ: mô tả bưu kiện + chụp ảnh package
4. Ghi chú thêm cho tài xế
5. Hiển thị ước phí dịch vụ: 25.000đ
6. Nhấn "Tìm tài xế ngay" → POST /api/errands
7. Live status: 4 bước → Đã nhận → Đang mua → Đang giao → Hoàn thành
8. Tài xế hoàn thành → khách xác nhận tiền hàng thực tế
9. Tổng thanh toán = tiền hàng thực + phí dịch vụ
```

### 4. Hủy đơn & Blacklist

```
1. Khách chỉ hủy được khi status = "pending" (chưa tài xế nhận)
2. Nhấn "Hủy đơn" → Bottom Sheet với lý do:
   - Đặt nhầm / Thay đổi ý định / Tài xế đến lâu / Khác...
3. POST /api/orders/{id}/cancel với cancel_reason
4. Server PATCH: status="cancelled", cancelled_at, cancelled_by
5. DB Trigger check_cancel_blacklist() tự chạy:
   - Đếm số lần hủy trong 7 ngày
   - Nếu >= 3 → INSERT blacklist (auto_triggered=TRUE)
6. Push notification cho merchant + tài xế
7. Nếu đã thanh toán bằng ví → tạo refund transaction
8. Khách bị blacklist: không đặt được đơn, hiện toast "Tài khoản bị tạm khóa"
```

### 5. Merchant xử lý đơn

```
1. Merchant vào /merchant (tablet tại quán)
2. Bật is_open = TRUE
3. Realtime subscription nhận INSERT on orders
4. Âm thanh + rung + slide-in card Framer Motion
5. Nhấn "✓ Xác nhận" → UPDATE status="accepted", accepting_at
6. Đặt thời gian chuẩn bị: 15/20/30/45 phút
7. Chuẩn bị từng món, tick khi xong
8. Nhấn "Xong · Báo tài xế đến lấy" → UPDATE status="ready", ready_at
9. Tài xế đến → UPDATE status="delivering", picked_up_at
10. Sau delivered → tiền tự động cộng vào ví merchant
    (sau khi trừ commission_rate%)
```

---

## Checklist trước khi Launch

```
PERFORMANCE & PWA
□ Lighthouse PWA score >= 90 trên mobile Chrome
□ Test cài đặt: Android Chrome (Add to Home Screen) + iOS Safari
□ Test push notification khi app đóng hoàn toàn
□ Test offline: trang chủ + thực đơn load khi mất wifi
□ Test trên 4G thực tế tại Phước An (Android + iPhone)
□ Tất cả ảnh qua next/image + webp format
□ Bundle size < 300KB initial load

SECURITY
□ Supabase RLS: customer KHÔNG thấy đơn của người khác
□ Supabase RLS: tài xế KHÔNG thấy đơn không được phân
□ Middleware: tài xế KHÔNG vào được /admin, /merchant
□ Không có secrets trong client-side code
□ Env variables set đầy đủ trên Vercel (không commit .env)
□ API Routes validate input đầu vào

FUNCTIONAL
□ Test toàn bộ flow: đặt đồ ăn từ đầu đến cuối
□ Test đặt xe + mua hộ từ đầu đến cuối
□ Test hủy đơn + blacklist trigger (hủy 3 lần)
□ Test dispatch: tài xế gần nhất nhận đơn đúng
□ ESMS OTP hoạt động với số VN
□ VietQR QR code generate đúng số tiền, quét được
□ Bản đồ Leaflet render đúng, không lỗi SSR
□ Realtime: marker tài xế di chuyển đúng trên bản đồ

TYPESCRIPT & CODE
□ tsc --noEmit: không có TypeScript error
□ Không có console.error trong production build
□ Không dùng "any" ở bất kỳ đâu

BETA TEST
□ Ít nhất 5 tài xế thực tế đăng ký + nhận đơn thành công
□ Ít nhất 3 quán đăng ký + xử lý đơn thành công
□ Ít nhất 20 khách đặt hàng thực tế

POST-LAUNCH
□ Vercel Analytics theo dõi
□ Supabase Dashboard monitoring
□ Alerting khi có lỗi
□ Backup DB định kỳ (Supabase tự làm)
```
