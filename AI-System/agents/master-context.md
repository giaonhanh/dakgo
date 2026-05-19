# MASTER CONTEXT — Giao Nhanh AI System
> Load file này đầu tiên trong mọi session. Giữ ngắn — tối đa 300 token.

## App
Food delivery PWA · Phước An, Krông Pắc
Services: Giao hàng | Mua hộ | Xe ôm | Taxi

## Stack
- Next.js 15 App Router · TypeScript strict
- Tailwind CSS v4 · Framer Motion v12
- Supabase (Auth + DB + Realtime + Storage)
- Zustand (cart/session/ui) · Leaflet + OSM

## Design tokens
```
--bg: #0D0907  --acc: #FF6B00  --text: #f8f0e0
--glass: rgba(255,255,255,0.04)  --border: rgba(255,107,0,0.20)
```

## Roles
customer → `/(customer)` | driver → `/(driver)` | merchant → `/(merchant)` | admin → `/(admin)`

## Rules (critical)
1. NO `any` · NO `@ts-ignore`
2. Colors: CSS vars ONLY
3. Maps: Leaflet + OSM (no Google Maps)
4. Money: INTEGER (VND), always `formatPrice()`
5. Supabase browser: `createBrowserClient` | server: `createServerClient`
6. Leaflet: ALWAYS `dynamic import ssr:false`

## Current phase
- Phase 1 (Foundation) ✅
- Phase 2 (Customer UI) 🔄 in progress
- Phase 3 (Customer V2) ⏳
- Phase 4+ (Driver/Merchant/Admin) ⏳

## Key files
- `CLAUDE.md` — full spec Phase 1-3
- `CLAUDE1.md` — Phase 4-7, API, Realtime
- `src/types/index.ts` — all TypeScript interfaces
- `src/lib/utils.ts` — formatPrice, cn, formatDistance
- `middleware.ts` — auth + role-based routing
