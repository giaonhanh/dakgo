# CLAUDE.md — Giao Nhanh PWA (Phần 1/2)
> **Nguồn sự thật duy nhất** — đọc kỹ trước khi code.
> Kết hợp: file CLAUDE.md gốc dự án + toàn bộ thiết kế UI/UX đã approved.
> File này: Tổng quan · Design System · Cấu trúc · Database · Types · Quy tắc · Giai đoạn 1-3
> Tiếp theo: CLAUDE1.md — Giai đoạn 4-7 · API · Realtime · PWA · Luồng nghiệp vụ

---

## MỤC LỤC

- [1. Tổng quan](#1-tổng-quan)
- [2. Design System](#2-design-system)
- [3. Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
- [4. Database Schema](#4-database-schema)
- [5. TypeScript Types](#5-typescript-types)
- [6. Quy tắc code](#6-quy-tắc-code-bắt-buộc)
- [Giai đoạn 1 — Nền tảng](#giai-đoạn-1--nền-tảng-kỹ-thuật-tuần-12)
- [Giai đoạn 2 — Khách hàng V1](#giai-đoạn-2--khách-hàng-v1-tuần-35)
- [Giai đoạn 3 — Khách hàng V2](#giai-đoạn-3--khách-hàng-v2-tuần-67)

---

## 1. Tổng quan

| Thuộc tính | Giá trị |
|---|---|
| **Tên** | Giao Nhanh |
| **Phạm vi** | Thị trấn Phước An, huyện Krông Pắc, Đắk Lắk |
| **Loại** | PWA — cài trực tiếp, không cần App Store |
| **Dịch vụ** | Giao hàng · Mua hộ · Xe ôm · Taxi |
| **Đối thủ** | Grab, ShopeeFood, BeFood (chưa phục vụ khu vực này) |
| **Lợi thế** | PWA nhẹ 4G · Mua hộ đi chợ · UI Premium · Vùng trắng |

### Stack kỹ thuật

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Framework | Next.js 15 App Router | SSR + CSR + API Routes + Middleware |
| Ngôn ngữ | TypeScript 5.x | strict mode, không dùng `any` |
| Styling | Tailwind CSS 3.x | mobile-first, utility-first |
| Animation | Framer Motion 11.x | particle, spring, confetti, layoutId |
| Backend | Supabase | PostgreSQL + Auth + Realtime + Storage + Edge Fn |
| PWA | next-pwa + Workbox | Service Worker, offline, push |
| Bản đồ | Leaflet + OpenStreetMap | KHÔNG dùng Google Maps |
| Biểu đồ | Recharts 2.x | doanh thu, thu nhập |
| State | Zustand 4.x | cart, session, UI state |
| Deploy | Vercel | Edge Cache + Analytics |
| Push | Web Push VAPID | Không cần Firebase — dùng Web Push API + VAPID key tự sinh, lưu subscription vào bảng `push_subscriptions` Supabase |
| SMS OTP | ESMS Việt Nam | rẻ hơn Twilio, hỗ trợ VN tốt |

### Bốn vai trò hệ thống

| Vai trò | Route | Thiết bị | Đặc điểm UI |
|---|---|---|---|
| Khách hàng | `/(customer)` | Mobile PWA | Mobile-first, 1 tay, tràn viền |
| Tài xế | `/(driver)` | Mobile PWA | Tối giản, bản đồ full-screen |
| Merchant | `/(merchant)` | Tablet/Mobile | Bảng đơn, âm thanh báo |
| Admin | `/(admin)` | Web Desktop | Dashboard, bảng dữ liệu |

> Middleware đọc `profiles.role` → redirect đúng dashboard sau login.

---

## 2. Design System

> ⚠️ UI đã được approved hoàn toàn. **KHÔNG thay đổi** bảng màu, font, hiệu ứng trừ khi có yêu cầu rõ ràng.

### 2.1 CSS Variables — dán vào `globals.css`

```css
:root {
  --bg-primary:    #080806;
  --bg-secondary:  #0e0c09;
  --bg-tertiary:   #151210;
  --acc:           #FF6B00;
  --acc-mid:       #FF8C00;
  --acc-light:     #FFB347;
  --glass:         rgba(255, 255, 255, 0.04);
  --glass-2:       rgba(255, 255, 255, 0.07);
  --glass-acc:     rgba(255, 107, 0, 0.07);
  --border:        rgba(255, 107, 0, 0.20);
  --border-2:      rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 107, 0, 0.35);
  --text-primary:   #f8f0e0;
  --text-secondary: #b0956a;
  --text-muted:     #6a5a40;
  --green:   #3ecf6e;
  --red:     #ff4040;
  --blue:    #4a8ff5;
  --purple:  #b464ff;
  --yellow:  #f5c542;
}

html, body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: "Lexend", sans-serif;
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
           env(safe-area-inset-bottom) env(safe-area-inset-left);
}
::-webkit-scrollbar { display: none; }
* { -ms-overflow-style: none; scrollbar-width: none; }

@keyframes shimmer    { 0% { left:-60%; } 100% { left:120%; } }
@keyframes radarPulse { 0% { opacity:.7; transform:scale(.3); } 100% { opacity:0; transform:scale(1); } }
@keyframes goldGlow   { 0%,100% { text-shadow:0 0 8px #FF6B00,0 0 20px #FF8C00; } 50% { text-shadow:0 0 20px #FF6B00,0 0 50px #FFB347; } }
@keyframes logoShine  { 0% { left:-80%; } 100% { left:120%; } }
```

### 2.2 tailwind.config.ts

```typescript
import type { Config } from "tailwindcss"
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:    { primary:"var(--bg-primary)", secondary:"var(--bg-secondary)", tertiary:"var(--bg-tertiary)" },
        acc:   { DEFAULT:"var(--acc)", mid:"var(--acc-mid)", light:"var(--acc-light)" },
        brand: { green:"var(--green)", red:"var(--red)", blue:"var(--blue)", purple:"var(--purple)" },
        text:  { primary:"var(--text-primary)", secondary:"var(--text-secondary)", muted:"var(--text-muted)" },
      },
      fontFamily: { sans: ["Lexend", "Inter", "sans-serif"] },
    },
  },
}
export default config
```

### 2.3 layout.tsx — Font + PWA Meta

```tsx
// src/app/layout.tsx
import { Lexend } from "next/font/google"
const lexend = Lexend({ subsets: ["latin", "vietnamese"], weight: ["300","400","500","600","700","800"] })

export const metadata = {
  title: "Giao Nhanh — Phước An",
  description: "Giao hàng · Mua hộ · Xe ôm · Taxi tại Phước An, Krông Pắc",
  manifest: "/manifest.json",
  themeColor: "#080806",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Giao Nhanh" },
  viewport: { width: "device-width", initialScale: 1, viewportFit: "cover" },
}
```

### 2.4 UI Components chuẩn

```tsx
// GlassCard — dùng cho tất cả card, modal, panel
export function GlassCard({ children, accent = false, strong = false, className = "" }) {
  return (
    <div className={`backdrop-blur-[12px] rounded-[14px] border
      ${strong ? "bg-[rgba(255,107,0,0.07)] border-[rgba(255,107,0,0.35)]"
      : accent  ? "bg-[rgba(255,107,0,0.07)] border-[rgba(255,107,0,0.20)]"
      :           "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)]"}
      ${className}`}>
      {children}
    </div>
  )
}

// CTAButton — nút cam chính, shimmer effect
export function CTAButton({ children, onClick, disabled, className = "" }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`relative overflow-hidden rounded-[14px] h-[48px]
        bg-gradient-to-r from-[#FF6B00] via-[#FF8C00] to-[#FFB347]
        text-white font-bold text-[13px] font-sans
        shadow-[0_4px_20px_rgba(255,107,0,0.4)]
        active:scale-[0.97] transition-transform
        disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
      <span className="absolute top-0 left-[-60%] w-[35%] h-full
        bg-gradient-to-r from-transparent via-white/20 to-transparent
        animate-[shimmer_2.5s_infinite] pointer-events-none" />
      <span className="relative z-10">{children}</span>
    </button>
  )
}

// Giá tiền — gradient cam clip text
// <span className="bg-gradient-to-r from-[#FF6B00] to-[#FFB347] bg-clip-text text-transparent font-bold">
//   {formatPrice(price)}
// </span>

// formatPrice trong utils.ts
export const formatPrice = (n: number) => n.toLocaleString("vi-VN") + "đ"
export const formatDistance = (km: number) => km < 1 ? `${Math.round(km*1000)}m` : `${km.toFixed(1)}km`
```

### 2.5 Hiệu ứng bắt buộc

#### A. Particle bay vào giỏ hàng (particle.ts)

```typescript
// src/lib/particle.ts
export function spawnParticles(src: HTMLElement, tgt: HTMLElement, container: HTMLElement) {
  const sR = src.getBoundingClientRect()
  const tR = tgt.getBoundingClientRect()
  const cR = container.getBoundingClientRect()
  const sx = sR.left - cR.left + sR.width  / 2
  const sy = sR.top  - cR.top  + sR.height / 2
  const tx = tR.left - cR.left + tR.width  / 2
  const ty = tR.top  - cR.top  + tR.height / 2

  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const p = document.createElement("div")
      const ox = (Math.random() - .5) * 16
      const oy = (Math.random() - .5) * 16
      p.style.cssText = `position:absolute;pointer-events:none;z-index:9999;
        width:7px;height:7px;border-radius:50%;
        background:#FF8C00;box-shadow:0 0 6px #FF6B00;
        left:${sx+ox}px;top:${sy+oy}px;`
      container.appendChild(p)
      let t = 0
      const dx = tx - (sx + ox), dy = ty - (sy + oy)
      const iv = setInterval(() => {
        t += 0.055
        if (t >= 1) { clearInterval(iv); p.remove(); return }
        const e = t < .5 ? 2*t*t : -1+(4-2*t)*t
        p.style.left      = `${sx + ox + dx * e}px`
        p.style.top       = `${sy + oy + dy * e - Math.sin(t * Math.PI) * 50}px`
        p.style.opacity   = `${1 - t * .8}`
        p.style.transform = `scale(${1 - t * .4})`
      }, 16)
    }, i * 45)
  }
}
```

#### B. Confetti — Order Success (Framer Motion)

```tsx
// src/components/animations/Confetti.tsx
import { motion } from "framer-motion"
const COLORS = ["#FF6B00","#FF8C00","#FFB347","#3ecf6e","#4a8ff5","#b464ff","#ff4040"]
export function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div key={i}
          className="absolute w-[5px] h-[5px] rounded-[1px]"
          style={{ background: COLORS[i % COLORS.length], left: `${Math.random() * 100}%` }}
          animate={{ y: ["0%","110%"], rotate: [0, 360], opacity: [1, 0] }}
          transition={{ duration: 2 + Math.random()*3, delay: Math.random()*2, ease: "linear" }}
        />
      ))}
    </div>
  )
}
```

#### C. Radar GPS

```tsx
// src/components/animations/RadarPulse.tsx
export function RadarPulse() {
  return (
    <div className="relative w-[16px] h-[16px]">
      <div className="absolute w-[5px] h-[5px] bg-[#FF6B00] rounded-full top-[5.5px] left-[5.5px]
        shadow-[0_0_5px_#FF6B00]" />
      {[0, 0.7].map((delay, i) => (
        <div key={i}
          className="absolute rounded-full border border-[#FF6B00] opacity-0"
          style={{
            width: i === 0 ? 10 : 16, height: i === 0 ? 10 : 16,
            top: i === 0 ? 3 : 0, left: i === 0 ? 3 : 0,
            animation: `radarPulse 2s ${delay}s infinite`,
          }} />
      ))}
    </div>
  )
}
```

#### D. Bottom Nav — Floating Capsule

```tsx
// src/components/navigation/BottomNav.tsx
// Spec:
// - fixed, bottom-4, left-[14px], right-[14px], height 56px
// - border-radius: 9999px (full capsule)
// - background: rgba(8,8,6,0.92), backdrop-blur: 20px
// - border: 1px solid rgba(255,107,0,0.2)
// - box-shadow: 0 0 20px rgba(255,107,0,0.1)
// - z-index: 50
// Tab active:
// - bg: rgba(255,107,0,0.1), icon: #FF6B00, translateY(-2px)
// - Halo: position absolute bottom-[-2px], w-[28px] h-[3px]
//         background: radial-gradient(ellipse, rgba(255,107,0,0.9) 0%, transparent 70%)
//         filter: blur(1px)
// - Dùng Framer Motion layoutId="active-indicator" để slide mượt
// 4 tabs: Home | Đơn hàng | Giỏ hàng (badge đỏ) | Cài đặt
```

---

## 3. Cấu trúc thư mục

```
giaonhanh/
├── public/
│   ├── manifest.json
│   ├── icon-192.png
│   ├── icon-512.png
│   └── sounds/new-order.mp3          # Âm thanh báo đơn mới cho merchant
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root: font Lexend, metadata, PWA meta
│   │   ├── globals.css               # CSS variables + @keyframes
│   │   │
│   │   ├── (auth)/
│   │   │   └── login/page.tsx        # Splash Screen + Login + Register
│   │   │
│   │   ├── (customer)/
│   │   │   ├── layout.tsx            # Có BottomNav
│   │   │   ├── page.tsx              # Trang chủ — 12 sections
│   │   │   ├── shop/[shopId]/page.tsx
│   │   │   ├── cart/page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   ├── order-success/page.tsx
│   │   │   ├── tracking/[orderId]/page.tsx
│   │   │   ├── orders/page.tsx       # Lịch sử đơn hàng
│   │   │   ├── ride/page.tsx         # Đặt xe ôm/Taxi
│   │   │   ├── errand/page.tsx       # Mua hộ/Giao hộ
│   │   │   ├── profile/page.tsx
│   │   │   ├── addresses/page.tsx
│   │   │   ├── search/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── review/[orderId]/page.tsx
│   │   │   ├── wallet/page.tsx       # V2
│   │   │   ├── vouchers/page.tsx     # V2
│   │   │   └── loyalty/page.tsx      # V2
│   │   │
│   │   ├── (driver)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # Dashboard online/offline + bản đồ
│   │   │   ├── navigate/[orderId]/page.tsx
│   │   │   ├── confirm-delivery/[orderId]/page.tsx
│   │   │   ├── earnings/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   └── register/page.tsx
│   │   │
│   │   ├── (merchant)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # Dashboard đơn hàng real-time
│   │   │   ├── menu/page.tsx
│   │   │   ├── revenue/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── promotions/page.tsx
│   │   │   └── register/page.tsx
│   │   │
│   │   ├── (admin)/
│   │   │   ├── layout.tsx            # Sidebar navigation
│   │   │   ├── page.tsx              # KPI Dashboard
│   │   │   ├── drivers/page.tsx
│   │   │   ├── merchants/page.tsx
│   │   │   ├── orders/page.tsx
│   │   │   ├── users/page.tsx
│   │   │   ├── finance/page.tsx
│   │   │   ├── map/page.tsx
│   │   │   ├── promotions/page.tsx
│   │   │   ├── disputes/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   └── settings/page.tsx
│   │   │
│   │   └── api/
│   │       ├── orders/route.ts
│   │       ├── orders/[id]/route.ts
│   │       ├── orders/[id]/cancel/route.ts
│   │       ├── rides/route.ts
│   │       ├── errands/route.ts
│   │       ├── dispatch/route.ts
│   │       ├── shops/nearby/route.ts
│   │       ├── payment/vietqr/route.ts
│   │       ├── payment/momo/route.ts
│   │       ├── payment/webhook/route.ts
│   │       └── notify/send/route.ts
│   │
│   ├── components/
│   │   ├── ui/                       # GlassCard, CTAButton, Input, Badge, Toast, Skeleton
│   │   ├── navigation/BottomNav.tsx
│   │   ├── animations/               # Confetti, GoldGlow, RadarPulse
│   │   ├── map/                      # LiveMap (dynamic no-ssr), DriverMarker, RouteLayer
│   │   ├── home/                     # 12 section components
│   │   │   ├── HomeHeader.tsx
│   │   │   ├── AIGreeting.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── LiveStatusBanner.tsx
│   │   │   ├── FlashSaleBanner.tsx
│   │   │   ├── ServiceGrid.tsx
│   │   │   ├── VoucherStrip.tsx
│   │   │   ├── CategoryCarousel.tsx
│   │   │   ├── PromoSection.tsx
│   │   │   ├── NearbyShops.tsx
│   │   │   ├── BestSellers.tsx
│   │   │   ├── LoyaltyPoints.tsx
│   │   │   └── ReorderSection.tsx
│   │   ├── shop/                     # ProductCard, ShopHeader, ProductGrid
│   │   ├── cart/                     # CartItem, CartSummary
│   │   └── driver/                   # OrderPopup (countdown 15s), EarningsChart
│   │
│   ├── lib/
│   │   ├── supabase/client.ts        # createBrowserClient
│   │   ├── supabase/server.ts        # createServerClient
│   │   ├── utils.ts                  # cn(), formatPrice(), formatDistance()
│   │   └── particle.ts              # spawnParticles()
│   │
│   ├── hooks/
│   │   ├── useCart.ts
│   │   ├── useGeolocation.ts
│   │   ├── useRealtime.ts
│   │   ├── useDriverLocation.ts      # watchPosition → upsert DB mỗi 5s
│   │   └── usePushNotification.ts
│   │
│   ├── stores/                       # Zustand
│   │   ├── cartStore.ts
│   │   ├── sessionStore.ts
│   │   └── uiStore.ts
│   │
│   └── types/index.ts                # Tất cả TypeScript interfaces
│
├── middleware.ts
├── next.config.ts
└── tailwind.config.ts
```

---

## 4. Database Schema

> ⚠️ **NGUỒN SỰ THẬT DUY NHẤT: `supabase/schema.sql`**
> Các snippet SQL trong phần này là tài liệu thiết kế ban đầu và có thể không khớp hoàn toàn với schema thực tế.
> Trước khi đọc các bảng bên dưới, hãy luôn kiểm tra `supabase/schema.sql`.
>
> **Những điểm khác biệt quan trọng so với schema thực:**
> - Bảng `vouchers`: KHÔNG có cột `created_by`; có `per_person_limit`, `is_combo`; `discount_type` hỗ trợ thêm `'combo'`
> - Bảng `orders`: KHÔNG có cột `voucher_id` (voucher tracking qua `voucher_usages`)
> - Bảng `voucher_usages`: có `id` riêng (UUID PK); dùng trigger `trg_voucher_usage_count` để tự tăng `used_count`
> - Migration file duy nhất cho DB đang chạy: `supabase/migrations/fix_schema_full.sql`

### 4.0 Extensions & Enums

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role      AS ENUM ("customer","driver","merchant","admin");
CREATE TYPE order_status   AS ENUM ("pending","accepted","preparing","ready","delivering","delivered","cancelled");
CREATE TYPE ride_status    AS ENUM ("searching","accepted","arrived","in_progress","completed","cancelled");
CREATE TYPE errand_type    AS ENUM ("buy_for_me","deliver_for_me");
CREATE TYPE errand_status  AS ENUM ("pending","accepted","shopping","delivering","delivered","cancelled");
CREATE TYPE driver_status  AS ENUM ("offline","online","busy");
CREATE TYPE payment_method AS ENUM ("cash","vietqr","momo","zalopay","wallet");
CREATE TYPE payment_status AS ENUM ("pending","paid","failed","refunded");
CREATE TYPE wallet_type    AS ENUM ("customer","driver","merchant");
CREATE TYPE tx_type        AS ENUM ("topup","payment","refund","commission","withdrawal");
CREATE TYPE shop_status    AS ENUM ("pending","approved","suspended");
CREATE TYPE notif_type     AS ENUM ("order","promo","system","ride");
CREATE TYPE tier_level     AS ENUM ("bronze","silver","gold","platinum");
```

### 4.1 profiles

```sql
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone      TEXT UNIQUE NOT NULL,
  full_name  TEXT,
  avatar_url TEXT,
  role       user_role NOT NULL DEFAULT "customer",
  fcm_token  TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, phone, full_name)
  VALUES (NEW.id, NEW.phone, NEW.raw_user_meta_data->>"full_name");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 4.2 saved_addresses

```sql
CREATE TABLE saved_addresses (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label      TEXT NOT NULL DEFAULT "Nhà",
  address    TEXT NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX one_default_per_user ON saved_addresses(user_id) WHERE is_default = TRUE;
```

### 4.3 drivers

```sql
CREATE TABLE drivers (
  id                  UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_type        TEXT NOT NULL,
  license_plate       TEXT NOT NULL,
  vehicle_model       TEXT,
  id_card_number      TEXT,
  license_number      TEXT,
  status              driver_status NOT NULL DEFAULT "offline",
  location            GEOGRAPHY(POINT,4326),
  location_updated_at TIMESTAMPTZ,
  rating_avg          NUMERIC(3,2) DEFAULT 5.00,
  total_trips         INTEGER DEFAULT 0,
  is_approved         BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at         TIMESTAMPTZ,
  approved_by         UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_drivers_location ON drivers USING GIST(location);
CREATE INDEX idx_drivers_online   ON drivers(status) WHERE status = "online";
```

### 4.4 shops

```sql
CREATE TABLE shops (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES profiles(id),
  name            TEXT NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  logo_url        TEXT,
  phone           TEXT,
  address         TEXT NOT NULL,
  location        GEOGRAPHY(POINT,4326),
  category        TEXT NOT NULL,
  opening_hours   JSONB,
  is_open         BOOLEAN NOT NULL DEFAULT FALSE,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  status          shop_status NOT NULL DEFAULT "pending",
  rating_avg      NUMERIC(3,2) DEFAULT 5.00,
  total_reviews   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shops_location ON shops USING GIST(location);
CREATE INDEX idx_shops_open     ON shops(status, is_open);
```

### 4.5 products

```sql
CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  image_url      TEXT,
  price          INTEGER NOT NULL,
  original_price INTEGER,
  category       TEXT,
  is_available   BOOLEAN NOT NULL DEFAULT TRUE,
  sold_count     INTEGER NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_shop    ON products(shop_id, is_available);
CREATE INDEX idx_products_popular ON products(shop_id, sold_count DESC);
```

### 4.6 orders

```sql
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id      UUID NOT NULL REFERENCES profiles(id),
  shop_id          UUID NOT NULL REFERENCES shops(id),
  driver_id        UUID REFERENCES drivers(id),
  status           order_status NOT NULL DEFAULT "pending",
  delivery_address TEXT NOT NULL,
  delivery_lat     DOUBLE PRECISION NOT NULL,
  delivery_lng     DOUBLE PRECISION NOT NULL,
  note             TEXT,
  subtotal         INTEGER NOT NULL,
  delivery_fee     INTEGER NOT NULL DEFAULT 15000,
  discount_amount  INTEGER NOT NULL DEFAULT 0,
  total_amount     INTEGER NOT NULL,
  payment_method   payment_method NOT NULL DEFAULT "cash",
  payment_status   payment_status NOT NULL DEFAULT "pending",
  voucher_id       UUID REFERENCES vouchers(id),
  cancelled_at     TIMESTAMPTZ,
  cancel_reason    TEXT,
  cancelled_by     UUID REFERENCES profiles(id),
  scheduled_at     TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  preparing_at     TIMESTAMPTZ,
  ready_at         TIMESTAMPTZ,
  picked_up_at     TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  estimated_delivery_at TIMESTAMPTZ,
  delivery_otp     TEXT,
  delivery_photo_url TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_driver   ON orders(driver_id, status);
CREATE INDEX idx_orders_shop     ON orders(shop_id, status);
```

### 4.7 order_items

```sql
CREATE TABLE order_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  name       TEXT NOT NULL,
  price      INTEGER NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1,
  subtotal   INTEGER NOT NULL,
  note       TEXT
);
CREATE INDEX idx_order_items ON order_items(order_id);
```

### 4.8 rides

```sql
CREATE TABLE rides (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID NOT NULL REFERENCES profiles(id),
  driver_id       UUID REFERENCES drivers(id),
  status          ride_status NOT NULL DEFAULT "searching",
  vehicle_type    TEXT NOT NULL,
  pickup_address  TEXT NOT NULL,
  pickup_lat      DOUBLE PRECISION NOT NULL,
  pickup_lng      DOUBLE PRECISION NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_lat     DOUBLE PRECISION NOT NULL,
  dropoff_lng     DOUBLE PRECISION NOT NULL,
  distance_km     NUMERIC(6,2),
  estimated_fare  INTEGER,
  final_fare      INTEGER,
  payment_method  payment_method NOT NULL DEFAULT "cash",
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,
  accepted_at     TIMESTAMPTZ,
  arrived_at      TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.9 errands (Mua hộ / Giao hộ)

```sql
CREATE TABLE errands (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id          UUID NOT NULL REFERENCES profiles(id),
  driver_id            UUID REFERENCES drivers(id),
  type                 errand_type NOT NULL,
  status               errand_status NOT NULL DEFAULT "pending",
  pickup_address       TEXT NOT NULL,
  pickup_lat           DOUBLE PRECISION NOT NULL,
  pickup_lng           DOUBLE PRECISION NOT NULL,
  delivery_address     TEXT NOT NULL,
  delivery_lat         DOUBLE PRECISION NOT NULL,
  delivery_lng         DOUBLE PRECISION NOT NULL,
  items_description    TEXT,
  estimated_items_cost INTEGER,
  package_description  TEXT,
  package_photo_url    TEXT,
  note                 TEXT,
  service_fee          INTEGER NOT NULL DEFAULT 25000,
  actual_items_cost    INTEGER,
  total_amount         INTEGER,
  payment_method       payment_method NOT NULL DEFAULT "cash",
  accepted_at          TIMESTAMPTZ,
  shopping_at          TIMESTAMPTZ,
  delivering_at        TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.10 wallets & transactions

```sql
CREATE TABLE wallets (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       wallet_type NOT NULL,
  balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, type)
);

CREATE TABLE transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id     UUID NOT NULL REFERENCES wallets(id),
  type          tx_type NOT NULL,
  amount        INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  ref_type      TEXT,
  ref_id        UUID,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tx_wallet ON transactions(wallet_id, created_at DESC);
```

### 4.11 vouchers & usages

> Schema thực tế — tham chiếu `supabase/schema.sql` để có full SQL.

```sql
CREATE TABLE vouchers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID REFERENCES shops(id) ON DELETE CASCADE,  -- NULL = toàn hệ thống (chỉ admin tạo)
  code             TEXT UNIQUE NOT NULL,
  title            TEXT,
  discount_type    TEXT NOT NULL DEFAULT 'percent'
                   CHECK (discount_type IN ('percent','fixed','freeship','combo')),
  discount_value   INT  NOT NULL DEFAULT 0,
  min_order        INT  NOT NULL DEFAULT 0,
  max_discount     INT,
  usage_limit      INT,            -- NULL = không giới hạn tổng lượt
  per_person_limit INT,            -- NULL = không giới hạn theo người
  used_count       INT  NOT NULL DEFAULT 0,  -- auto-increment qua trigger
  valid_from       TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to         TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  is_combo         BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  -- LƯU Ý: không có cột created_by
);

-- RLS:
-- vouchers_public_active: SELECT WHERE is_active = true (tất cả)
-- vouchers_shop_manage:   ALL WHERE shop_id IS NOT NULL AND owner_id = auth.uid() (merchant)
-- vouchers_admin_all:     ALL (admin)

CREATE TABLE voucher_usages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id),
  order_id   UUID REFERENCES orders(id),
  used_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Trigger trg_voucher_usage_count: auto tăng vouchers.used_count khi INSERT
);
```

> **Quan trọng khi INSERT voucher** (admin/merchant):
> - KHÔNG có `created_by` → bỏ qua field này
> - Dùng `per_person_limit` (không phải `per_user_limit`)
> - `valid_from`: truyền `"YYYY-MM-DDT00:00:00"` (không bỏ giờ)
> - `valid_to`: truyền `"YYYY-MM-DDT23:59:59"` (append giờ)
> - Merchant INSERT phải có `shop_id`; Admin global voucher KHÔNG có `shop_id` (NULL)

### 4.12 loyalty_points + trigger

```sql
CREATE TABLE loyalty_points (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES profiles(id) UNIQUE,
  total_points INTEGER NOT NULL DEFAULT 0,
  tier         tier_level NOT NULL DEFAULT "bronze",
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE point_transactions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id),
  points     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  ref_id     UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION add_loyalty_points() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = "delivered" AND OLD.status != "delivered" THEN
    INSERT INTO point_transactions (user_id, points, reason, ref_id)
    VALUES (NEW.customer_id, NEW.total_amount / 10000, "order_complete", NEW.id);
    INSERT INTO loyalty_points (user_id, total_points)
    VALUES (NEW.customer_id, NEW.total_amount / 10000)
    ON CONFLICT (user_id) DO UPDATE
    SET total_points = loyalty_points.total_points + EXCLUDED.total_points,
        updated_at   = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_loyalty
  AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION add_loyalty_points();
```

### 4.13 reviews, notifications, blacklist + trigger

```sql
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) UNIQUE,
  reviewer_id   UUID NOT NULL REFERENCES profiles(id),
  driver_id     UUID REFERENCES drivers(id),
  shop_id       UUID NOT NULL REFERENCES shops(id),
  driver_rating INTEGER CHECK (driver_rating BETWEEN 1 AND 5),
  food_rating   INTEGER CHECK (food_rating BETWEEN 1 AND 5),
  comment       TEXT,
  images        TEXT[],
  tip_amount    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       notif_type NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user   ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notif_unread ON notifications(user_id) WHERE is_read = FALSE;

CREATE TABLE blacklist (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES profiles(id) UNIQUE,
  reason         TEXT NOT NULL,
  auto_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  added_by       UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION check_cancel_blacklist() RETURNS TRIGGER AS $$
DECLARE cancel_count INTEGER;
BEGIN
  IF NEW.status = "cancelled" AND NEW.cancelled_by = NEW.customer_id THEN
    SELECT COUNT(*) INTO cancel_count FROM orders
    WHERE customer_id = NEW.customer_id AND status = "cancelled"
      AND cancelled_by = NEW.customer_id AND cancelled_at > NOW() - INTERVAL "7 days";
    IF cancel_count >= 3 THEN
      INSERT INTO blacklist (user_id, reason, auto_triggered)
      VALUES (NEW.customer_id, "Hủy đơn quá 3 lần trong tuần", TRUE)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_blacklist
  AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION check_cancel_blacklist();
```

### 4.14 RPC Functions

```sql
-- Tìm tài xế online gần nhất
CREATE OR REPLACE FUNCTION find_nearest_driver(
  order_lat DOUBLE PRECISION, order_lng DOUBLE PRECISION,
  max_distance_km DOUBLE PRECISION DEFAULT 5
) RETURNS UUID AS $$
  SELECT id FROM drivers
  WHERE status = "online" AND is_approved = TRUE
    AND ST_Distance(location, ST_Point(order_lng, order_lat)::geography) < max_distance_km * 1000
  ORDER BY ST_Distance(location, ST_Point(order_lng, order_lat)::geography)
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Quán gần nhất
CREATE OR REPLACE FUNCTION get_nearby_shops(
  user_lat DOUBLE PRECISION, user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10, limit_n INTEGER DEFAULT 20
) RETURNS TABLE (id UUID, name TEXT, category TEXT, rating_avg NUMERIC, is_open BOOLEAN, distance_km DOUBLE PRECISION) AS $$
  SELECT id, name, category, rating_avg, is_open,
    ROUND(ST_Distance(location, ST_Point(user_lng, user_lat)::geography)/1000.0, 1)
  FROM shops WHERE status = "approved"
    AND ST_Distance(location, ST_Point(user_lng, user_lat)::geography) < radius_km * 1000
  ORDER BY 6 LIMIT limit_n;
$$ LANGUAGE sql SECURITY DEFINER;
```

### 4.15 Row Level Security

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE errands ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own"    ON profiles USING (auth.uid() = id);
CREATE POLICY "profiles_admin"  ON profiles USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = "admin"));

CREATE POLICY "orders_customer" ON orders FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "orders_driver"   ON orders FOR SELECT USING (driver_id = auth.uid());
CREATE POLICY "orders_merchant" ON orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM shops WHERE id = orders.shop_id AND owner_id = auth.uid()));
CREATE POLICY "orders_admin"    ON orders FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = "admin"));

CREATE POLICY "wallets_own" ON wallets USING (user_id = auth.uid());
CREATE POLICY "notif_own"   ON notifications USING (user_id = auth.uid());
```

---

## 5. TypeScript Types

```typescript
// src/types/index.ts — copy toàn bộ, không định nghĩa type inline trong component

export type UserRole      = "customer" | "driver" | "merchant" | "admin"
export type OrderStatus   = "pending" | "accepted" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled"
export type RideStatus    = "searching" | "accepted" | "arrived" | "in_progress" | "completed" | "cancelled"
export type DriverStatus  = "offline" | "online" | "busy"
export type ErrandStatus  = "pending" | "accepted" | "shopping" | "delivering" | "delivered" | "cancelled"
export type PaymentMethod = "cash" | "vietqr" | "momo" | "zalopay" | "wallet"

export interface Profile {
  id: string; phone: string; full_name: string | null; avatar_url: string | null
  role: UserRole; fcm_token: string | null; is_active: boolean; created_at: string
}
export interface SavedAddress {
  id: string; user_id: string; label: string
  address: string; lat: number; lng: number; is_default: boolean
}
export interface Shop {
  id: string; owner_id: string; name: string; description: string | null
  cover_image_url: string | null; logo_url: string | null; address: string
  category: string; is_open: boolean; commission_rate: number
  status: "pending" | "approved" | "suspended"
  rating_avg: number; total_reviews: number; distance_km?: number
}
export interface Product {
  id: string; shop_id: string; name: string; description: string | null
  image_url: string | null; price: number; original_price: number | null
  category: string | null; is_available: boolean; sold_count: number
}
export interface CartItem { product: Product; quantity: number; note?: string }
export interface Order {
  id: string; customer_id: string; shop_id: string; driver_id: string | null
  status: OrderStatus; delivery_address: string; delivery_lat: number; delivery_lng: number
  note: string | null; subtotal: number; delivery_fee: number; discount_amount: number
  total_amount: number; payment_method: PaymentMethod
  payment_status: "pending" | "paid" | "failed" | "refunded"
  cancelled_at: string | null; cancel_reason: string | null
  delivered_at: string | null; estimated_delivery_at: string | null; created_at: string
  shop?: Shop; items?: OrderItem[]; driver?: Profile
}
export interface OrderItem {
  id: string; order_id: string; product_id: string
  name: string; price: number; quantity: number; subtotal: number; note: string | null
}
export interface Driver {
  id: string; vehicle_type: string; license_plate: string; status: DriverStatus
  location?: { lat: number; lng: number }
  rating_avg: number; total_trips: number; is_approved: boolean; profile?: Profile
}
export interface Ride {
  id: string; customer_id: string; driver_id: string | null; status: RideStatus
  vehicle_type: string; pickup_address: string; pickup_lat: number; pickup_lng: number
  dropoff_address: string; dropoff_lat: number; dropoff_lng: number
  distance_km: number | null; estimated_fare: number | null; final_fare: number | null; created_at: string
}
export interface Errand {
  id: string; customer_id: string; driver_id: string | null
  type: "buy_for_me" | "deliver_for_me"; status: ErrandStatus
  pickup_address: string; delivery_address: string
  items_description: string | null; estimated_items_cost: number | null
  service_fee: number; actual_items_cost: number | null; total_amount: number | null; created_at: string
}
export interface Notification {
  id: string; user_id: string; type: "order" | "promo" | "system" | "ride"
  title: string; body: string; data: Record<string, unknown> | null
  is_read: boolean; created_at: string
}
export interface Voucher {
  id: string; code: string; title: string
  discount_type: "percent" | "fixed" | "freeship"
  discount_value: number; min_order: number; max_discount: number | null
  valid_from: string; valid_to: string; shop_id: string | null; is_active: boolean
}
```

---

## 6. Quy tắc code bắt buộc

```
1.  TypeScript strict — KHÔNG dùng "any", KHÔNG dùng "@ts-ignore"
2.  Types — tất cả trong src/types/index.ts, không định nghĩa inline
3.  Màu sắc — CHỈ dùng CSS variable hoặc Tailwind token đã khai báo
4.  Animation — Framer Motion cho phức tạp; CSS @keyframes cho đơn giản (shimmer, pulse, radar)
5.  Images — luôn qua next/image với width + height explicit
6.  Supabase — browser: createBrowserClient | server: createServerClient
7.  Error — mọi Supabase call phải có try/catch + toast thông báo lỗi thân thiện
8.  State — Zustand cho cart/session/UI | Server Components cho data fetching
9.  Bản đồ — Google Maps API (@googlemaps/js-api-loader, version "weekly", language "vi", region "VN"). Dùng CartoDB dark tile làm fallback khi cần. AddressPicker dùng Google Maps + Places API (New) + Geocoding API.
10. Tiền — lưu INTEGER (VND), không DECIMAL/FLOAT
11. Ảnh upload — Supabase Storage, nén trước khi upload, webp format
12. Leaflet SSR — luôn dynamic import với ssr: false
13. Mobile-first — test 375px trước khi check desktop
14. Không commit .env — dùng Vercel environment variables
15. Giá tiền — luôn qua formatPrice() từ lib/utils.ts
16. API Routes — validate input, method rõ ràng, return JSON nhất quán
17. Error boundary — Suspense + error boundary cho tất cả page
```

---

## GIAI ĐOẠN 1 — Nền tảng kỹ thuật (Tuần 1–2)

> ⚠️ Không viết UI cho đến khi giai đoạn này hoàn thành.
> Làm sai ở đây = refactor toàn bộ sau.

### Checklist

```
□ 1.1  Khởi tạo Next.js 15 + TypeScript + Tailwind + Framer Motion
□ 1.2  Cấu hình tailwind.config.ts (Section 2.2)
□ 1.3  Viết globals.css: CSS variables + @keyframes (Section 2.1)
□ 1.4  Cài next-pwa + tạo public/manifest.json
□ 1.5  Tạo Supabase project — Region: Singapore (ap-southeast-1)
□ 1.6  Bật PostGIS + uuid-ossp extensions
□ 1.7  Chạy toàn bộ SQL Schema (Section 4.0 → 4.15) theo đúng thứ tự
□ 1.8  Bật RLS + tạo tất cả policies (Section 4.15)
□ 1.9  Cấu hình Supabase Auth: Phone OTP qua ESMS
□ 1.10 Tạo lib/supabase/client.ts (createBrowserClient)
□ 1.11 Tạo lib/supabase/server.ts (createServerClient)
□ 1.12 Viết middleware.ts (xem code bên dưới)
□ 1.13 Tạo src/types/index.ts đầy đủ (Section 5)
□ 1.14 Cài Leaflet + react-leaflet, test render bản đồ Phước An (no-ssr)
□ 1.15 Cài Zustand, tạo cartStore + sessionStore + uiStore
□ 1.16 Sinh VAPID key pair (web-push generate-vapid-keys), set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY vào Vercel env
□ 1.17 Test OTP với số điện thoại Việt Nam thật
□ 1.18 Deploy Vercel, set env variables, test middleware redirect
```

### middleware.ts — Code đầy đủ

```typescript
import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      get:    (n)     => request.cookies.get(n)?.value,
      set:    (n,v,o) => response.cookies.set(n,v,o),
      remove: (n,o)   => response.cookies.set(n,"",o),
    }}
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (session) {
    const { data: profile } = await supabase
      .from("profiles").select("role, is_active").eq("id", session.user.id).single()

    if (!profile?.is_active) {
      return NextResponse.redirect(new URL("/login?error=suspended", request.url))
    }

    const role = profile?.role

    if (pathname === "/" || pathname === "/login") {
      const dest = role === "driver" ? "/driver"
                 : role === "merchant" ? "/merchant"
                 : role === "admin" ? "/admin" : "/"
      if (dest !== pathname) return NextResponse.redirect(new URL(dest, request.url))
    }

    if (pathname.startsWith("/driver")   && role !== "driver"   && role !== "admin")
      return NextResponse.redirect(new URL("/", request.url))
    if (pathname.startsWith("/merchant") && role !== "merchant" && role !== "admin")
      return NextResponse.redirect(new URL("/", request.url))
    if (pathname.startsWith("/admin")    && role !== "admin")
      return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon-|manifest|sw\\.js).*)"],
}
```

### manifest.json

```json
{
  "name": "Giao Nhanh — Phước An",
  "short_name": "GiaoNhanh",
  "description": "Giao hàng · Mua hộ · Xe ôm · Taxi tại Phước An, Krông Pắc",
  "theme_color": "#080806",
  "background_color": "#080806",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "/",
  "scope": "/",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

---

## GIAI ĐOẠN 2 — Khách hàng V1 (Tuần 3–5)

> Build pixel-perfect theo Design System Section 2.

### Checklist

```
□ 2.1  UI Primitives: GlassCard, CTAButton (shimmer), Input (focus glow cam), Badge, Toast, Skeleton
□ 2.2  BottomNav — floating capsule, Halo active, cart badge bounce (Framer Motion)
□ 2.3  Animations: Confetti (Framer), GoldGlow (CSS), RadarPulse (CSS)
□ 2.4  lib/particle.ts — spawnParticles() (Section 2.5.A)
□ 2.5  Splash Screen — Gold Glow logo 3s, logoShine animation, auto-redirect /login
□ 2.6  Login Page — Glassmorphism form, OTP 6 số, Zalo OAuth button
□ 2.7  Home Page — 12 sections theo đúng thứ tự (spec bên dưới)
□ 2.8  Shop Page — hero ảnh + overlay gradient, info quán, filter category, ProductGrid
□ 2.9  ProductCard — next/image, giá gradient cam, sao, km, nút "+" → spawnParticles()
□ 2.10 Cart Page — CartItem (tăng/giảm, ghi chú), voucher input, địa chỉ, tổng tiền
□ 2.11 Checkout Page — địa chỉ, thời gian, phương thức TT, CTAButton shimmer
□ 2.12 Order Success — Confetti, mã #GNXXXX, ETA, nút "Theo dõi đơn"
□ 2.13 Live Tracking — dynamic Leaflet dark map, marker tài xế Supabase Realtime
□ 2.14 Đặt xe — tab Xe ôm/Taxi, Nominatim geocode, bản đồ preview, giá ước tính
□ 2.15 Mua hộ/Giao hộ — chọn loại, địa chỉ, list đồ cần mua, ghi chú, ước giá
□ 2.16 Lịch sử đơn — filter trạng thái, Đặt lại 1 chạm, nút Theo dõi
```

### Home Page — 12 sections spec

```
Thứ tự render ĐÚNG trong app/(customer)/page.tsx:

0. HomeHeader
   - RadarPulse component + "Phước An, Krông Pắc ▾"
   - Bell icon + badge đỏ số unread → /notifications
   - Avatar/icon → /profile

1. AIGreeting
   - Chào theo giờ: "Buổi sáng/chiều/tối tốt lành, {tên} 👋"
   - Heading: "Hôm nay bạn muốn ăn gì?" — gradient cam, font 700
   - Purple glass card nhỏ: "🤖 Gợi ý theo giờ / thời tiết"

2. SearchBar
   - GlassCard bg-glass-2, border-2
   - Icon search trái, icon filter phải → /search?filter=open
   - Placeholder: "Tìm món ăn, cửa hàng, dịch vụ..."

3. LiveStatusBanner  ← CHỈ render khi có đơn đang giao
   - background: gradient linear tối xanh lá
   - Dot pulse xanh lá + "Đơn đang giao · Còn ~X phút"
   - Tên đơn ngắn + nút "Theo dõi →" → /tracking/{orderId}
   - Dùng Supabase Realtime để subscribe

4. FlashSaleBanner
   - height: 104px, border-radius: 16px
   - background: linear-gradient(135deg, #1a0d00, #2d1500, #0d0900)
   - Glow cam phải trên + logoShine animation chạy qua
   - Badge "⚡ FLASH SALE · Còn Xh Xp" (gradient cam bg, text đen)
   - Text: tiêu đề + mô tả + nút CTA nhỏ
   - Emoji lớn bên phải (filter: drop-shadow cam)
   - 3-4 dots indicator bên dưới

5. ServiceGrid — 2×2 grid
   - Giao hộ:  ic-o bg rgba(255,107,0,0.12) icon #FF8C00
   - Mua hộ:   ic-g bg rgba(62,207,110,0.10) icon #3ecf6e
   - Xe ôm:    ic-b bg rgba(74,143,245,0.10) icon #4a8ff5
   - Taxi:     ic-p bg rgba(180,100,255,0.10) icon #b464ff
   - Mỗi card: GlassCard, icon 38px rounded-[11px], tên 8px bên dưới

6. VoucherStrip — overflow-x-auto, gap 7px
   - Mỗi voucher: glass-acc card, icon + giá trị + hạn dùng
   - "Hết hạn HÔM NAY!" → text đỏ nổi bật

7. CategoryCarousel — overflow-x-auto
   - 🍜 Bún/Phở · 🍗 Gà rán · 🥤 Đồ uống · 🍱 Cơm hộp · 🍕 Pizza · 🧁 Bánh
   - Active: bg rgba(255,107,0,0.10), border cam, shadow cam nhẹ

8. PromoSection — overflow-x-auto, gap 8px
   - Card min-width 120px: ảnh 72px, badge % đỏ position absolute
   - Tên món, tên quán, giá gradient cam, sao + km

9. NearbyShops — list dọc, gap 8px
   - Card full-width: logo 54px, tên, tags, rating/km/ETA
   - Badge "–X%" + "Free ship" hoặc "Ship Xk"

10. BestSellers — overflow-x-auto, gap 8px
    - Card 110px: rank badge 🥇🥈🥉, ảnh 78px, tên, quán, giá cam, sold count

11. LoyaltyPoints
    - GlassCard gradient tím tối: linear-gradient(135deg,#0d0a1a,#160d2a)
    - Điểm lớn font-800, tier badge tím, progress bar tím → gold
    - "Tích thêm X điểm để lên hạng Gold 🥇"

12. ReorderSection — overflow-x-auto, gap 7px
    - Card 130px: emoji + tên món ngắn + tên quán
    - Nút "🔄 Đặt lại · {giá}k" — glass-acc button
```

### Đặt xe — Tính giá & Geocode

```typescript
// Tính giá ước tính
function calcFare(distKm: number, type: string): number {
  const BASE = { motorbike: 10000, car: 15000, electric: 8000 }
  const PER  = { motorbike: 4500,  car: 8000,  electric: 3500 }
  return (BASE[type] ?? 10000) + Math.round(distKm * (PER[type] ?? 4500))
}
// Geocode địa chỉ → tọa độ: Nominatim API (miễn phí)
// GET https://nominatim.openstreetmap.org/search?q={address}&format=json&limit=1
// Tính route + distance: OSRM API (miễn phí)
// GET https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
```

### Live Tracking — Leaflet dark map

```typescript
// LUÔN dùng dynamic import cho Leaflet — không SSR
const LiveMapClient = dynamic(() => import("@/components/map/LiveMapClient"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-bg-secondary animate-pulse rounded-xl" />,
})

// Tile URL tối (không cần API key):
const DARK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"

// Supabase Realtime — cập nhật marker tài xế
useEffect(() => {
  const channel = supabase.channel(`driver-location:${orderId}`)
    .on("broadcast", { event: "location" }, ({ payload }) => {
      setDriverPos({ lat: payload.lat, lng: payload.lng })
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [orderId])
```

---

## GIAI ĐOẠN 3 — Khách hàng V2 (Tuần 6–7)

### Checklist

```
□ 3.1  Profile — avatar upload Supabase Storage, edit tên/SĐT, đổi MK 3 bước, cài đặt notif
□ 3.2  Saved Addresses — CRUD, 1 default, Leaflet mini chọn điểm, Nominatim geocode
□ 3.3  Search — full-text Postgres search + filter panel (giá, km, rating, đang KM, loại)
□ 3.4  Notification Center — danh sách, tab loại, mark all read, tap → đúng route
□ 3.5  Post-order Review — sao tài xế 1-5, sao món 1-5, ảnh upload Storage, text, tip
□ 3.6  Wallet V2 — số dư, nạp VietQR, lịch sử giao dịch, rút tiền
□ 3.7  Voucher Center V2 — tất cả mã, countdown, nhập mã tay
□ 3.8  Loyalty V2 — tier card gradient tím, lịch sử điểm, danh sách quà đổi
```

---

> Tiếp theo: xem **CLAUDE1.md** — Giai đoạn 4-7 · API Routes · Realtime · PWA · Luồng nghiệp vụ
