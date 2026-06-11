"use client"

// ============================================================
// src/app/(customer)/page.tsx
// Trang ch?  12 Sections ?y ? theo mockup d approved
// S0  HomeHeader        GPS Radar + Bell + Avatar
// S1  AIGreeting        Cho theo gi? + AI g?i 
// S2  SearchBar         Tm ki?m + Filter
// S3  LiveStatusBanner  on dang giao (hi?n c di?u ki?n)
// S4  FlashSaleBanner   Banner khuy?n mi + countdown
// S5  ServiceGrid       4 d?ch v? nhanh
// S6  VoucherStrip      Voucher s?p h?t h?n
// S7  CategoryCarousel  L?c lo?i mn an
// S8  PromoSection      Khuy?n mi hm nay
// S9  NearbyShops       Qun g?n b?n
// S10 BestSellers       Bn ch?y tu?n ny
// S11 LoyaltyPoints     i?m tch luy
// S12 ReorderSection    ?t l?i nhanh
// + BottomNav floating capsule
// ============================================================

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useCartStore } from "@/store/cartStore"
import { useLocationStore } from "@/store/locationStore"
import { createClient } from "@/lib/supabase/client"
import { SHOP_CATEGORIES, getCategoryByValue, normalizeCategoryValue } from "@/lib/categories"
import Badge from "@/components/ui/Badge"
import NotifDot from "@/components/ui/NotifDot"

// --- Types -------------------------------------------------
type ShopRow    = { id: string; name: string; is_open: boolean; rating_avg: number | null; address: string; logo_url: string | null; location: { type: string; coordinates: [number, number] } | null; opening_hours: { open?: string; close?: string } | null; category?: string; categories?: string[] | null }
type ProductRow = { id: string; name: string; price: number; original_price?: number | null; sold_count: number; shop_id: string; image_url: string | null; shops: { name: string; is_open?: boolean; status?: string; opening_hours?: { open?: string; close?: string } | null } | { name: string; is_open?: boolean; status?: string; opening_hours?: { open?: string; close?: string } | null }[] | null; all_day?: boolean | null; start_hour?: string | null; end_hour?: string | null }
type OrderRow   = { id: string; shop_id: string; total_amount: number; shops: { name: string } | { name: string }[] | null; order_items: { name: string }[] }
type VoucherRow = { id: string; code: string; title: string; discount_type: string; discount_value: number; valid_to: string; shop_id: string | null; min_order: number | null }

function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
type LiveOrderRow = { id: string; status: string; shops: { name: string } | { name: string }[] | null; _href?: string; _type?: "food" | "ride" | "errand" }
type RecoRow    = { id: string; name: string; price: number; original_price: number | null; image_url: string | null; sold_count: number; shop_id: string; shop_name: string; order_count: number }
type BannerRow  = { id: string; title: string; subtitle: string | null; image_url: string | null; link_url: string | null; sort_order: number }
type NewMenuRow = { id: string; name: string; price: number; image_url: string | null; shop_id: string; created_at: string; shops: { name: string } | null; all_day?: boolean | null; start_hour?: string | null; end_hour?: string | null }

// Danh m?c hi?n th? trn trang ch?  l?y t? SHOP_CATEGORIES (b? "Khc")
const HOME_CATS = SHOP_CATEGORIES.filter(c => c.value !== "khac")

// --- Khng cn mock data  dng Supabase th?t -------------


// --- Helpers ------------------------------------------------
function shopInHoursFromHours(oh: { open?: string; close?: string } | null | undefined): boolean {
  if (!oh?.open || !oh?.close) return true  // khng c gi? ? khng gi?i h?n
  const now = new Date()
  const vnMin = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes()
  const [oph, opm] = oh.open.split(":").map(Number)
  const [clh, clm] = oh.close.split(":").map(Number)
  const o = (oph ?? 0) * 60 + (opm ?? 0)
  const c = (clh ?? 0) * 60 + (clm ?? 0)
  return c > o ? vnMin >= o && vnMin < c : vnMin >= o || vnMin < c
}

function isShopOpen(p: ProductRow): boolean {
  const s = Array.isArray(p.shops) ? p.shops[0] : p.shops
  if (!s) return false
  if (s.status !== "approved") return false
  return shopInHoursFromHours(s.opening_hours)
}

// Tnh qun c dang trong gi? m? c?a khng (mi gi? VN UTC+7)
function isShopInHours(shop: ShopRow): boolean {
  if (!shop.is_open) return false
  const oh = shop.opening_hours
  if (!oh) return true
  const now    = new Date()
  const vnMin  = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes()
  const toMin  = (t: string) => { const [h,m] = t.split(":").map(Number); return (h??0)*60+(m??0) }
  const inSlot = (from: string, to: string) => {
    const o = toMin(from), c = toMin(to)
    return c > o ? vnMin >= o && vnMin < c : vnMin >= o || vnMin < c
  }
  // Format m?i: DayHours[]  m?i ngy c slots ring
  if (Array.isArray(oh)) {
    const vnDate  = new Date(now.getTime() + 7 * 3600 * 1000)
    const dayNames = ["Ch? nh?t","Th? 2","Th? 3","Th? 4","Th? 5","Th? 6","Th? 7"]
    const today   = dayNames[vnDate.getUTCDay()]
    const entry   = (oh as Array<{day:string;open:boolean;slots:{from:string;to:string}[]}>).find(d => d.day === today)
    if (!entry?.open) return false
    return entry.slots.some(s => inSlot(s.from, s.to))
  }
  // Format cu: { open: "HH:mm", close: "HH:mm" }
  const old = oh as { open?: string; close?: string }
  if (!old.open || !old.close) return true
  return inSlot(old.open, old.close)
}

// Gi? m? c?a ti?p theo d? hi?n th? "M? lc HH:mm"
function nextOpenLabel(shop: ShopRow): string {
  const oh = shop.opening_hours
  if (oh?.open) return `M? lc ${oh.open}`
  return "ang dng c?a"
}

function isProductInTime(p: { all_day?: boolean | null; start_hour?: string | null; end_hour?: string | null }): boolean {
  if (p.all_day !== false) return true
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = (p.start_hour ?? "00:00").split(":").map(Number)
  const [eh, em] = (p.end_hour   ?? "23:59").split(":").map(Number)
  const start = sh * 60 + sm, end = eh * 60 + em
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end
}

const fmt  = (n: number) => n.toLocaleString("vi-VN") + "d"
const RANK_ICON = ["??","??","??"]

function getWeatherTip(code: number, temp: number, hour: number): string {
  if (code >= 95) return "?? Bo ging dang d?n! ? nh an ton, order ngay v? thi!"
  if (code >= 80) return "??? ang c mua ro  d?t d? an giao v?, kh?i u?t!"
  if (code >= 51) return "? Tr?i mua r?i, d?ng ra ngoi  order v? nh ?m cng hon!"
  if (code >= 45) return "??? Suong m dy, h?n ch? di chuy?n  d?t v? nh nh!"
  if (temp >= 35) return `??? Nng ${Math.round(temp)}C r?i! Sinh t?, nu?c p l?nh gi?i nhi?t ngay!`
  if (temp >= 30) return `?? Tr?i ${Math.round(temp)}C  tr d, tr s?a d cho mt nh!`
  if (temp <= 20) return `?? Mt ${Math.round(temp)}C  bn b, ph? nng h?p th?i ti?t l?m!`
  if (hour < 10) return "? Sng mt, u?ng c ph hay an bnh m nng nh!"
  if (hour < 12) return "? G?n trua r?i, d?t com tru?c d? khng ch? lu!"
  if (hour < 14) return "?? Gi? com trua  d?t ngay k?o h?t su?t nh!"
  if (hour < 18) return "?? Chi?u mt, u?ng g cho t?nh ngu?i di no!"
  return "?? T?i r?i, bn b hay cho an l ngon nh?t!"
}

// --- Sub-components -----------------------------------------

function SectionHeader({ title, more, href }: { title:string; more?:string; href?:string }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"0 16px", marginBottom:8 }}>
      <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:600 }}>{title}</div>
      {more && (
        <a href={href ?? "#"} style={{ color:"#FF8C00", fontSize: 11,
          textDecoration:"none", fontWeight:500 }}>{more}</a>
      )}
    </div>
  )
}

function HScroll({ children, px=16 }: { children:React.ReactNode; px?:number }) {
  return (
    <div style={{
      display:"flex", gap:8, overflowX:"auto", paddingLeft:px, paddingRight:px,
      paddingBottom:2, marginBottom:14,
      scrollbarWidth:"none", WebkitOverflowScrolling:"touch",
    } as React.CSSProperties}>
      {children}
    </div>
  )
}

// ------------------------------------------------------------
export default function HomePage() {

  const router        = useRouter()
  const addItem       = useCartStore(s => s.addItem)
  const clearAndAdd   = useCartStore(s => s.clearAndAdd)
  const storeShopId   = useCartStore(s => s.shopId)
  const storeShopName = useCartStore(s => s.items[0]?.shop ?? "")
  const cartCount     = useCartStore(s => s.totalQty())
  const supabase      = createClient()

  type PendingItem = { id:string; name:string; price:number; shop:string; shopId:string }

  const [activeMealTime,  setActiveMealTime]  = useState(0)
  const [nearbyFilter,    setNearbyFilter]    = useState<string>("all")
  const [savedVoucherIds, setSavedVoucherIds] = useState<string[]>([])
  const [bannerIdx,     setBannerIdx]     = useState(0)
  const [countdown,     setCountdown]     = useState({ h:0, m:0, s:0 })
  const [activeTab,     setActiveTab]     = useState("home")
  const [conflictItem,  setConflictItem]  = useState<PendingItem | null>(null)
  const [weatherTip,    setWeatherTip]    = useState<string | null>(null)

  // ?c d?a ch? t? locationStore (d du?c GpsInit trong layout l?y s?n)
  const locationData = useLocationStore()
  const location = locationData.address || "Phu?c An, Krng P?c"
  const containerRef = useRef<HTMLDivElement>(null)
  const cartIconRef  = useRef<HTMLDivElement>(null)

  // --- Real data state ---------------------------------------
  const [userName,      setUserName]      = useState("b?n")
  const [notifCount,    setNotifCount]    = useState(0)
  const [liveOrders,    setLiveOrders]    = useState<LiveOrderRow[]>([])
  const [liveIdx,       setLiveIdx]       = useState(0)
  const [vouchers,      setVouchers]      = useState<VoucherRow[]>([])
  const [nearbyShops,   setNearbyShops]   = useState<ShopRow[]>([])
  const [bestSellers,   setBestSellers]   = useState<ProductRow[]>([])
  const [reorders,      setReorders]      = useState<OrderRow[]>([])
  const [promos,        setPromos]        = useState<ProductRow[]>([])
  const [recos,         setRecos]         = useState<RecoRow[]>([])
  const [favoriteIds,   setFavoriteIds]   = useState<string[]>([])
  const [favoriteShops, setFavoriteShops] = useState<ShopRow[]>([])
  const [adminBanners,   setAdminBanners]   = useState<BannerRow[]>([])
  const [comboShopIds,   setComboShopIds]   = useState<Set<string>>(new Set())
  const [adminBannerIdx, setAdminBannerIdx] = useState(0)
  const [newMenuItems,   setNewMenuItems]   = useState<NewMenuRow[]>([])
  const [searchSuggest,  setSearchSuggest]  = useState<ProductRow[]>([])

  // --- Fetch real data from Supabase ------------------------
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Profile (user name)
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).single()
      if (profile?.full_name) setUserName(profile.full_name.split(" ").pop() ?? profile.full_name)

      // Unread notification count
      const { count } = await supabase
        .from("notifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("is_read", false)
      setNotifCount(count ?? 0)

      // Live orders: don d? an dang x? l
      const { data: liveFood } = await supabase
        .from("orders")
        .select("id, status, shops(name)")
        .eq("customer_id", user.id)
        .in("status", ["pending","accepted","preparing","ready","delivering"])
        .order("created_at", { ascending: false })
        .limit(5)

      // Live rides (xe m / taxi dang tm xe / dang di)
      const { data: liveRides } = await supabase
        .from("rides")
        .select("id, status, vehicle_type")
        .eq("customer_id", user.id)
        .in("status", ["searching","accepted","delivering"])
        .order("created_at", { ascending: false })
        .limit(3)

      // Live errands (giao h? / mua h? dang x? l)
      const { data: liveErrands } = await supabase
        .from("errands")
        .select("id, status, type")
        .eq("customer_id", user.id)
        .in("status", ["pending","accepted","delivering"])
        .order("created_at", { ascending: false })
        .limit(3)

      const ridesMapped = (liveRides ?? []).map(r => ({
        id: r.id,
        status: r.status === "searching" ? "pending" : r.status,
        shops: { name: r.vehicle_type === "motorbike" ? "?? Xe m" : r.vehicle_type === "car_7" ? "?? Taxi 7 ch?" : "?? Taxi 4 ch?" },
        _href: "/orders",
        _type: "ride" as const,
      }))
      const errandsMapped = (liveErrands ?? []).map(e => ({
        id: e.id,
        status: e.status === "pending" ? "pending" : e.status,
        shops: { name: e.type === "buy_for_me" ? "?? Mua h?" : "?? Giao h?" },
        _href: "/orders",
        _type: "errand" as const,
      }))

      setLiveOrders([...(liveFood ?? []), ...ridesMapped, ...errandsMapped] as LiveOrderRow[])

      // Vouchers
      const { data: voucherData } = await supabase
        .from("vouchers")
        .select("id,code,title,discount_type,discount_value,valid_to,shop_id,min_order")
        .eq("is_active", true)
        .gt("valid_to", new Date().toISOString())
        .order("valid_to", { ascending: true })
        .limit(6)
      setVouchers((voucherData ?? []) as VoucherRow[])

      // Nearby shops: fetch c? dng l?n m?, tnh gi? client-side
      const { data: shopData } = await supabase
        .from("shops")
        .select("id,name,is_open,rating_avg,address,logo_url,location,opening_hours,category,categories")
        .eq("status", "approved")
        .order("rating_avg", { ascending: false })
        .limit(30)
      // Sort: dang m? ln tru?c, dng xu?ng du?i
      const sorted = (shopData ?? [] as ShopRow[]).sort((a, b) => {
        const aOpen = isShopInHours(a as ShopRow) ? 1 : 0
        const bOpen = isShopInHours(b as ShopRow) ? 1 : 0
        return bOpen - aOpen
      })
      setNearbyShops(sorted as ShopRow[])

      // Combo vouchers dang active  dnh d?u qun no c combo
      if (shopData && shopData.length > 0) {
        const shopIds = (shopData as ShopRow[]).map(s => s.id)
        const now = new Date().toISOString()
        const { data: comboData } = await supabase
          .from("vouchers")
          .select("shop_id")
          .eq("is_active", true)
          .eq("is_combo", true)
          .gte("valid_to", now)
          .in("shop_id", shopIds)
        if (comboData) setComboShopIds(new Set(comboData.map((v: { shop_id: string }) => v.shop_id)))
      }

      // Best sellers  top bn ch?y, khng l?c theo gi? (sold_count >= 0)
      const { data: bsData } = await supabase
        .from("products")
        .select("id,name,price,sold_count,shop_id,image_url,shops!inner(name,is_open,status,opening_hours),all_day,start_hour,end_hour")
        .eq("is_available", true)
        .eq("shops.status", "approved")
        .order("sold_count", { ascending: false })
        .limit(20)
      setBestSellers(((bsData ?? []) as ProductRow[]).filter(p => isShopOpen(p)).slice(0, 8))

      // Promos  s?n ph?m c gi khuy?n mi (original_price > price)
      const { data: promoData } = await supabase
        .from("products")
        .select("id,name,price,original_price,sold_count,shop_id,image_url,shops!inner(name,is_open,status,opening_hours),all_day,start_hour,end_hour")
        .eq("is_available", true)
        .eq("shops.status", "approved")
        .not("original_price", "is", null)
        .order("sold_count", { ascending: false })
        .limit(20)
      // Fallback: n?u khng c s?n ph?m KM, l?y s?n ph?m bn ch?y nh?t
      const promoFiltered = ((promoData ?? []) as ProductRow[]).filter(p => isShopOpen(p))
      if (promoFiltered.length > 0) {
        setPromos(promoFiltered.slice(0, 8))
      } else {
        // fallback: top s?n ph?m t? qun dang m?
        const { data: fallbackPromo } = await supabase
          .from("products")
          .select("id,name,price,original_price,sold_count,shop_id,image_url,shops!inner(name,is_open,status,opening_hours),all_day,start_hour,end_hour")
          .eq("is_available", true)
          .eq("shops.status", "approved")
          .order("sold_count", { ascending: false })
          .limit(20)
        setPromos(((fallbackPromo ?? []) as ProductRow[]).filter(p => isShopOpen(p)).slice(0, 8))
      }

      // Admin banners
      const { data: bannerData } = await supabase
        .from("banners")
        .select("id,title,subtitle,image_url,link_url,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(5)
      setAdminBanners((bannerData ?? []) as BannerRow[])

      // V?a ln menu  qun dang m?, trong khung gi? bn
      const { data: newMenuData } = await supabase
        .from("products")
        .select("id,name,price,image_url,shop_id,shops!inner(name,is_open,status,opening_hours),created_at,all_day,start_hour,end_hour")
        .eq("is_available", true)
        .eq("shops.status", "approved")
        .order("created_at", { ascending: false })
        .limit(30)
      setNewMenuItems(((newMenuData ?? []) as unknown as NewMenuRow[]).filter(p => isShopOpen(p as unknown as ProductRow) && isProductInTime(p)).slice(0, 10))

      // Reorders (last 5 delivered orders for this user)
      const { data: orderData } = await supabase
        .from("orders")
        .select("id,shop_id,total_amount,shops(name),order_items(name)")
        .eq("customer_id", user.id)
        .eq("status", "delivered")
        .order("created_at", { ascending: false })
        .limit(5)
      setReorders((orderData ?? []) as OrderRow[])

      // Smart recommendations via RPC (falls back gracefully if not deployed)
      const { data: recoData } = await supabase.rpc("get_recommendations", { uid: user.id, lim: 10 })
      if (recoData && Array.isArray(recoData) && recoData.length > 0) {
        setRecos(recoData as RecoRow[])
      } else {
        // Fallback: top products from shops the user ordered from
        const { data: histShops } = await supabase
          .from("orders")
          .select("shop_id")
          .eq("customer_id", user.id)
          .eq("status", "delivered")
          .order("created_at", { ascending: false })
          .limit(8)
        const shopIds = [...new Set((histShops ?? []).map(o => o.shop_id as string))]
        if (shopIds.length > 0) {
          const { data: recFallback } = await supabase
            .from("products")
            .select("id, name, price, original_price, image_url, sold_count, shop_id, shops!inner(name,is_open,status,opening_hours), all_day, start_hour, end_hour")
            .in("shop_id", shopIds)
            .eq("is_available", true)
            .eq("shops.is_open", true)
            .eq("shops.status", "approved")
            .order("sold_count", { ascending: false })
            .limit(25)
          setRecos((recFallback ?? []).filter(p => isShopOpen(p as ProductRow) && isProductInTime(p)).slice(0, 10).map(p => {
            const sn = Array.isArray(p.shops) ? (p.shops[0] as { name: string })?.name : (p.shops as { name: string } | null)?.name
            return { id: p.id, name: p.name, price: p.price, original_price: p.original_price,
              image_url: p.image_url, sold_count: p.sold_count, shop_id: p.shop_id,
              shop_name: sn ?? "", order_count: 1 }
          }))
        }
      }
    }
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load favorites from localStorage + fetch shop data
  useEffect(() => {
    try {
      const saved = localStorage.getItem("favorite_shop_ids")
      const ids: string[] = saved ? JSON.parse(saved) : []
      setFavoriteIds(ids)
      if (ids.length === 0) return
      supabase.from("shops")
        .select("id,name,is_open,rating_avg,address,logo_url")
        .in("id", ids)
        .then(({ data }) => { if (data) setFavoriteShops(data as ShopRow[]) })
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Search-based suggestions from gn_search_history
  useEffect(() => {
    async function loadSearchSuggestions() {
      try {
        const history: string[] = JSON.parse(localStorage.getItem("gn_search_history") ?? "[]")
        if (history.length === 0) return
        const terms = history.slice(0, 3)
        const filter = terms.map(t => `name.ilike.%${t}%`).join(",")
        const { data } = await supabase
          .from("products")
          .select("id,name,price,sold_count,shop_id,shops(name)")
          .eq("is_available", true)
          .or(filter)
          .limit(8)
        if (data?.length) setSearchSuggest(data as ProductRow[])
      } catch { /* ignore */ }
    }
    loadSearchSuggestions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Admin banner auto-slide
  useEffect(() => {
    if (adminBanners.length <= 1) return
    const t = setInterval(() => setAdminBannerIdx(i => (i + 1) % adminBanners.length), 4000)
    return () => clearInterval(t)
  }, [adminBanners])

  const toggleFavorite = (shopId: string) => {
    setFavoriteIds(prev => {
      const next = prev.includes(shopId) ? prev.filter(x => x !== shopId) : [...prev, shopId]
      try { localStorage.setItem("favorite_shop_ids", JSON.stringify(next)) } catch { /* ignore */ }
      if (!prev.includes(shopId)) {
        const shop = nearbyShops.find(s => s.id === shopId)
        if (shop) setFavoriteShops(fs => fs.find(s => s.id === shopId) ? fs : [...fs, shop])
      } else {
        setFavoriteShops(fs => fs.filter(s => s.id !== shopId))
      }
      return next
    })
  }

  // Weather tip  dng t?a d? t? locationStore (GPS d du?c layout l?y s?n)
  useEffect(() => {
    const { lat, lng } = useLocationStore.getState()
    if (!lat || !lng) return
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`)
      .then(r => r.json())
      .then((wData: { current?: { temperature_2m: number; weather_code: number } }) => {
        const code = wData.current?.weather_code ?? 0
        const temp = wData.current?.temperature_2m ?? 28
        setWeatherTip(getWeatherTip(code, temp, new Date().getHours()))
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationData.ready])

  // Banner auto-slide  cycle through real vouchers
  useEffect(() => {
    if (vouchers.length <= 1) return
    const t = setInterval(() => setBannerIdx(i => (i + 1) % vouchers.length), 3500)
    return () => clearInterval(t)
  }, [vouchers])

  // Countdown  computed from current deal's valid_to
  useEffect(() => {
    if (!vouchers.length) return
    const update = () => {
      const deal = vouchers[bannerIdx % vouchers.length]
      if (!deal) return
      const diff = Math.max(0, new Date(deal.valid_to).getTime() - Date.now())
      const totalSecs = Math.floor(diff / 1000)
      setCountdown({
        h: Math.floor(totalSecs / 3600),
        m: Math.floor((totalSecs % 3600) / 60),
        s: totalSecs % 60,
      })
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [vouchers, bannerIdx])

  // Live orders carousel auto-cycle
  useEffect(() => {
    if (liveOrders.length <= 1) return
    const t = setInterval(() => setLiveIdx(i => (i + 1) % liveOrders.length), 3000)
    return () => clearInterval(t)
  }, [liveOrders])

  // Particle effect
  const spawnParticle = (btnEl: HTMLElement) => {
    const container = containerRef.current
    const cartIcon  = cartIconRef.current
    if (!container || !cartIcon) return
    const cR  = container.getBoundingClientRect()
    const sR  = btnEl.getBoundingClientRect()
    const tR  = cartIcon.getBoundingClientRect()
    const sx  = sR.left - cR.left + sR.width/2
    const sy  = sR.top  - cR.top  + sR.height/2
    const tx  = tR.left - cR.left + tR.width/2
    const ty  = tR.top  - cR.top  + tR.height/2
    for (let i=0; i<6; i++) {
      setTimeout(() => {
        const p   = document.createElement("div")
        const ox  = (Math.random()-.5)*16
        const oy  = (Math.random()-.5)*16
        p.style.cssText = `position:absolute;pointer-events:none;z-index:9999;
          width:7px;height:7px;border-radius:50%;
          background:#FF8C00;box-shadow:0 0 6px #FF6B00;
          left:${sx+ox}px;top:${sy+oy}px;`
        container.appendChild(p)
        let t = 0
        const dx=tx-(sx+ox), dy=ty-(sy+oy)
        const iv = setInterval(()=>{
          t+=0.055; if(t>=1){clearInterval(iv);p.remove();return}
          const e = t<.5?2*t*t:-1+(4-2*t)*t
          p.style.left=`${sx+ox+dx*e}px`
          p.style.top=`${sy+oy+dy*e-Math.sin(t*Math.PI)*50}px`
          p.style.opacity=`${1-t*.8}`
          p.style.transform=`scale(${1-t*.4})`
        },16)
      }, i*45)
    }
  }

  const handleAdd = (
    btnEl: HTMLElement | null,
    item: PendingItem
  ) => {
    if (storeShopId && storeShopId !== item.shopId) {
      setConflictItem(item)
      return
    }
    if (btnEl) spawnParticle(btnEl)
    addItem(item)
  }

  const confirmReplace = () => {
    if (!conflictItem) return
    clearAndAdd(conflictItem)
    setConflictItem(null)
  }

  const greet = () => {
    const h = new Date().getHours()
    if (h < 12) return "Bu?i sng t?t lnh"
    if (h < 18) return "Bu?i chi?u t?t lnh"
    return "Bu?i t?i t?t lnh"
  }

  const aiTip = () => {
    const h = new Date().getHours()
    if (h < 10) return "? Sng mt, u?ng c ph hay an bnh m nng nh!"
    if (h < 12) return "? G?n trua r?i, d?t com tru?c d? khng ch? lu!"
    if (h < 14) return "?? N?ng nng, b? sung nu?c  tr s?a ho?c sinh t??"
    if (h < 18) return "?? Bu?i chi?u, an nh? ho?c u?ng tr s?a di!"
    return "?? T?i r?i, bn b hay cho an l ngon nh?t!"
  }

  const padZ = (n:number) => String(n).padStart(2,"0")

  // ----------------------------------------------------------
  return (
    <>
      <style>{`
                *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body { background:#080806; font-family:'Lexend',sans-serif; height:100%; overflow:hidden; }
        ::-webkit-scrollbar { display:none; }
        * { -ms-overflow-style:none; scrollbar-width:none; }

        @keyframes radarPulse { 0%{opacity:.7;transform:scale(.3)} 100%{opacity:0;transform:scale(1)} }
        @keyframes shimmer    { 0%{left:-60%} 100%{left:120%} }
        @keyframes logoShine  { 0%{left:-100%} 100%{left:150%} }
        @keyframes pulse      { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cartBounce { 0%,100%{transform:translateY(0)} 35%{transform:translateY(-6px)} 65%{transform:translateY(-2px)} }

        .shop-card:hover  { transform:translateY(-1px); transition:all .2s; }
        .promo-card:hover { transform:translateY(-2px) scale(1.01); transition:all .2s; }
        .svc-card:hover   { border-color:rgba(255,107,0,0.3)!important; transition:border-color .2s; }
        .reorder-btn:hover{ background:rgba(255,107,0,0.15)!important; }
      `}</style>

      {/* -- ROOT -- */}
      <div ref={containerRef} style={{
        position:"fixed", inset:0, background:"#080806",
        display:"flex", flexDirection:"column", overflow:"hidden",
        fontFamily:"'Lexend',sans-serif",
      }}>


        {/* -- SCROLLABLE BODY -- */}
        <div style={{ flex:1, overflowY:"auto", overflowX:"hidden",
          paddingTop:"env(safe-area-inset-top, 0px)",
          paddingBottom:80, WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* --------------------------------------
              S0  HomeHeader
          -------------------------------------- */}
          <div style={{ padding:"8px 16px 6px", display:"flex",
            justifyContent:"space-between", alignItems:"center" }}>
            {/* GPS + location */}
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              {/* Radar */}
              <div style={{ position:"relative", width:16, height:16, flexShrink:0 }}>
                <div style={{ position:"absolute", width:5, height:5, background:"#FF6B00",
                  borderRadius:"50%", top:5.5, left:5.5,
                  boxShadow:"0 0 5px #FF6B00" }} />
                {[{w:10,t:3,l:3,d:"0s"},{w:16,t:0,l:0,d:".7s"}].map((r,i)=>(
                  <div key={i} style={{ position:"absolute", width:r.w, height:r.w,
                    borderRadius:"50%", border:"1px solid #FF6B00", opacity:0,
                    top:r.t, left:r.l,
                    animation:`radarPulse 2s ${r.d} infinite` }} />
                ))}
              </div>
              <div>
                <div style={{ color:"#6a5a40", fontSize: 11 }}>V? tr c?a b?n</div>
                <div onClick={() => router.push("/addresses")}
                  style={{ color:"#f8f0e0", fontSize:12, fontWeight:600, cursor:"pointer",
                    display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {location}
                  </span>
                  <span style={{ color:"#FF8C00", fontSize:10 }}>?</span>
                </div>
              </div>
            </div>
            {/* Bell + Avatar */}
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <a href="/notifications" style={{ position:"relative", textDecoration:"none" }}>
                <div style={{ width:32, height:32, borderRadius:"50%",
                  background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:15 }}>??</div>
                <NotifDot count={notifCount} />
              </a>
              <a href="/profile" style={{ textDecoration:"none" }}>
                <div style={{ width:32, height:32, borderRadius:10,
                  background:"rgba(255,107,0,0.12)", border:"1px solid rgba(255,107,0,0.25)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>
                  ??
                </div>
              </a>
            </div>
          </div>

          {/* --------------------------------------
              S1  AIGreeting
          -------------------------------------- */}
          <div style={{ padding:"2px 16px 12px" }}>
            <div style={{ color:"#6a5a40", fontSize:10, marginBottom:2 }}>
              {greet()}, {userName} ??
            </div>
            <div style={{ fontSize:18, fontWeight:700, lineHeight:1.2, marginBottom:8 }}>
              Hm nay b?n{" "}
              <span style={{
                background:"linear-gradient(135deg,#FF6B00,#FF8C00,#FFB347)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                backgroundClip:"text",
              }}>mu?n d?t g?</span>
            </div>
            {/* AI tip card */}
            <div style={{
              display:"flex", alignItems:"center", gap:8,
              background:"rgba(180,100,255,0.07)",
              border:"1px solid rgba(180,100,255,0.2)",
              borderRadius:10, padding:"7px 11px",
            }}>
              <span style={{ fontSize:14 }}>??</span>
              <div style={{ color:"#b464ff", fontSize: 11, lineHeight:1.4, flex:1 }}>
                <strong style={{ color:"#c87aff" }}>G?i  AI:</strong>{" "}
                {weatherTip ?? aiTip()}
              </div>
              <span style={{ color:"rgba(180,100,255,0.5)", fontSize:12 }}></span>
            </div>
          </div>

          {/* --------------------------------------
              S2  SearchBar
          -------------------------------------- */}
          <div style={{ margin:"0 16px 12px",
            background:"rgba(255,255,255,0.07)",
            backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:13, padding:"9px 13px",
            display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ color:"#6a5a40", fontSize:15 }}>??</span>
            <input readOnly placeholder="Tm mn an, c?a hng, d?ch v?..."
              onClick={() => { window.location.href="/search" }}
              style={{ flex:1, background:"transparent", border:"none", outline:"none",
                color:"#6a5a40", fontSize:11, fontFamily:"Lexend", cursor:"pointer" }} />
            <a href="/search?filter=open" style={{ textDecoration:"none" }}>
              <div style={{ width:26, height:26, borderRadius:8,
                background:"rgba(255,107,0,0.10)", border:"1px solid rgba(255,107,0,0.25)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>
                ??
              </div>
            </a>
          </div>

          {/* --------------------------------------
              S3  LiveStatusBanner (carousel da don)
          -------------------------------------- */}
          <AnimatePresence>
            {liveOrders.length > 0 && (
              <motion.div key="live-banner-wrap"
                initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-8 }}
                style={{ margin:"0 16px 12px" }}>

                {/* Header row n?u c nhi?u don */}
                {liveOrders.length > 1 && (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%",
                        background:"#3ecf6e", boxShadow:"0 0 5px #3ecf6e",
                        animation:"pulse 1.5s infinite" }} />
                      <span style={{ color:"#3ecf6e", fontSize: 11, fontWeight:600 }}>
                        {liveOrders.length} don dang x? l
                      </span>
                    </div>
                    {/* Dots */}
                    <div style={{ display:"flex", gap:4 }}>
                      {liveOrders.map((_,i) => (
                        <div key={i} onClick={() => setLiveIdx(i)}
                          style={{
                            width: liveIdx===i ? 16 : 5, height:5, borderRadius:3, cursor:"pointer",
                            background: liveIdx===i ? "#3ecf6e" : "rgba(62,207,110,0.2)",
                            transition:"all .3s",
                            boxShadow: liveIdx===i ? "0 0 4px #3ecf6e" : "none",
                          }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Carousel track */}
                <div style={{ overflow:"hidden", borderRadius:14 }}>
                  <div style={{
                    display:"flex",
                    transform:`translateX(${-liveIdx * 100}%)`,
                    transition:"transform 0.4s cubic-bezier(0.4,0,0.2,1)",
                    willChange:"transform",
                  }}>
                    {liveOrders.map(order => {
                      const shopName = (order.shops as {name:string}|null)?.name ?? "Qun dang chu?n b?"
                      const isRide   = order._type === "ride"
                      const isErrand = order._type === "errand"
                      const statusLabel = isRide
                        ? (order.status === "pending" ? "ang tm ti x?..." :
                           order.status === "accepted" ? "Ti x? dang d?n" :
                           order.status === "delivering" ? "ang trn du?ng" : "ang x? l")
                        : isErrand
                        ? (order.status === "pending" ? "ang tm ti x?..." :
                           order.status === "accepted" ? "Ti x? dang x? l" :
                           order.status === "delivering" ? "ang giao" : "ang x? l")
                        : (order.status === "pending"    ? "Ch? qun xc nh?n" :
                           order.status === "accepted" || order.status === "preparing" ? " xc nh?n  ang lm" :
                           order.status === "ready"      ? "ang tm ti x?" :
                           order.status === "delivering" ? "ang giao hng" : "ang x? l")
                      const statusColor =
                        order.status === "delivering" ? "#FF8C00" :
                        order.status === "ready"      ? "#FFB347" : "#3ecf6e"
                      const statusBg =
                        order.status === "delivering" ? "linear-gradient(135deg,#1a0d00,#2d1a00)" :
                        order.status === "ready"      ? "linear-gradient(135deg,#1a1000,#2d2000)" :
                        "linear-gradient(135deg,#0f1a08,#152010)"
                      const statusBorder =
                        order.status === "delivering" ? "rgba(255,140,0,0.3)" :
                        order.status === "ready"      ? "rgba(255,179,71,0.3)" :
                        "rgba(62,207,110,0.25)"
                      return (
                        <a key={order.id} href="/orders"
                          style={{ textDecoration:"none", width:"100%", flexShrink:0 }}>
                          <div style={{
                            background: statusBg,
                            border:`1px solid ${statusBorder}`,
                            borderRadius:14, padding:"10px 13px",
                            display:"flex", alignItems:"center", gap:10,
                            position:"relative", overflow:"hidden",
                          }}>
                            <div style={{ position:"absolute", right:-10, top:-10, width:70, height:70,
                              background:`radial-gradient(circle,${statusColor}33 0%,transparent 65%)` }} />
                            <span style={{ fontSize:20, position:"relative", zIndex:1 }}>
                              {order.status === "delivering" ? "??" :
                               order.status === "ready"      ? "??" :
                               order.status === "pending"    ? "?" : "?????"}
                            </span>
                            <div style={{ flex:1, position:"relative", zIndex:1 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                                <div style={{ width:6, height:6, borderRadius:"50%",
                                  background:statusColor, boxShadow:`0 0 5px ${statusColor}`,
                                  animation:"pulse 1.5s infinite" }} />
                                <span style={{ color:statusColor, fontSize: 11, fontWeight:600 }}>
                                  {statusLabel}
                                </span>
                              </div>
                              <div style={{ color:"#f8f0e0", fontSize:11, fontWeight:600, marginTop:2 }}>
                                {shopName}  #{order.id.slice(0,8).toUpperCase()}
                              </div>
                              <div style={{ color:"rgba(255,255,255,0.35)", fontSize: 11, marginTop:1 }}>
                                Nh?n d? theo di don hng
                              </div>
                            </div>
                            <div style={{
                              background:`${statusColor}1a`,
                              border:`1px solid ${statusColor}44`,
                              borderRadius:8, padding:"4px 9px",
                              color:statusColor, fontSize: 11, fontWeight:600,
                              position:"relative", zIndex:1, flexShrink:0,
                            }}>Xem ?</div>
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* --------------------------------------
              S4  FlashSaleBanner / AdminBanner / InviteFriend
          -------------------------------------- */}
          {vouchers.length > 0 ? (() => {
            const DEAL_EMOJI: Record<string, string> = { percent:"??", fixed:"??", freeship:"??" }
            const deal = vouchers[bannerIdx % vouchers.length]
            const dealEmoji   = DEAL_EMOJI[deal.discount_type] ?? "?"
            const dealTitle   = deal.title
            const dealSubLine = deal.discount_type === "percent"  ? `Gi?m ${deal.discount_value}%  p d?ng ngay`
              : deal.discount_type === "fixed"    ? `Gi?m ${fmt(deal.discount_value)}  ?t ngay`
              : "Mi?n ph giao hng  on t? b?t k?"
            return (
              <div style={{ margin:"0 16px 8px" }}>
                <div style={{
                  aspectRatio:"2/1", borderRadius:16, overflow:"hidden",
                  border:"1px solid rgba(255,107,0,0.35)",
                  position:"relative",
                  background:"linear-gradient(135deg,#1a0d00,#2d1500,#0d0900)",
                }}>
                  <div style={{ position:"absolute", top:-30, right:-20, width:200, height:200,
                    background:"radial-gradient(circle,rgba(255,107,0,0.32) 0%,transparent 65%)" }} />
                  <div style={{ position:"absolute", bottom:-20, left:10, width:120, height:120,
                    background:"radial-gradient(circle,rgba(255,179,71,0.12) 0%,transparent 65%)" }} />
                  <div style={{ position:"absolute", top:0, left:"-100%", width:"50%", height:"100%",
                    background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)",
                    animation:"logoShine 3.5s infinite" }} />
                  <div style={{ position:"relative", zIndex:1, padding:"20px 20px" }}>
                    <div style={{ display:"inline-block",
                      background:"linear-gradient(135deg,#FF6B00,#FF8C00,#FFB347)",
                      borderRadius:8, padding:"3px 11px", marginBottom:8,
                      color:"#000", fontSize:10, fontWeight:700, letterSpacing:.4 }}>
                      ? FLASH SALE  {padZ(countdown.h)}h {padZ(countdown.m)}p {padZ(countdown.s)}s
                    </div>
                    <div style={{ color:"#fff", fontSize:18, fontWeight:700, lineHeight:1.25, maxWidth:"62%", wordBreak:"break-word" }}>
                      {dealTitle}
                    </div>
                    <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginTop:5 }}>
                      {dealSubLine}
                    </div>
                    <div onClick={() => router.push(deal?.shop_id ? `/shop/${deal.shop_id}` : "/vouchers")}
                      style={{ display:"inline-block", marginTop:10, cursor:"pointer",
                        background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)",
                        borderRadius:8, padding:"5px 14px", color:"#fff", fontSize:11, fontWeight:600 }}>
                      ?t ngay ?
                    </div>
                  </div>
                  <div style={{ position:"absolute", right:18, top:"50%", transform:"translateY(-50%)",
                    fontSize:72, zIndex:1, filter:"drop-shadow(0 0 18px rgba(255,107,0,0.5))" }}>
                    {dealEmoji}
                  </div>
                </div>
                <div style={{ display:"flex", gap:4, justifyContent:"center", padding:"7px 0 8px" }}>
                  {vouchers.map((_,i) => (
                    <div key={i} onClick={() => setBannerIdx(i)} style={{
                      width:bannerIdx===i?18:5, height:5, borderRadius:3, cursor:"pointer",
                      background:bannerIdx===i?"#FF6B00":"rgba(255,255,255,0.08)",
                      transition:"all .3s", boxShadow:bannerIdx===i?"0 0 5px #FF6B00":"none",
                    }} />
                  ))}
                </div>
              </div>
            )
          })() : adminBanners.length > 0 ? (
            <div style={{ margin:"0 16px 8px" }}>
              <div style={{ aspectRatio:"2/1", borderRadius:16, overflow:"hidden",
                border:"1px solid rgba(255,255,255,0.12)", position:"relative",
                cursor:"pointer", background:"#0d1a2d" }}
                onClick={() => { const b = adminBanners[adminBannerIdx]; if (b?.link_url) router.push(b.link_url) }}>
                {adminBanners[adminBannerIdx]?.image_url ? (
                  <Image src={adminBanners[adminBannerIdx].image_url!} alt={adminBanners[adminBannerIdx].title}
                    fill sizes="100vw" style={{ objectFit:"cover" }} />
                ) : (
                  <div style={{ width:"100%", height:"100%",
                    background:"linear-gradient(135deg,#0d1a2d,#1a2d40)",
                    display:"flex", alignItems:"center", padding:"24px 20px" }}>
                    <div>
                      <div style={{ color:"#fff", fontSize:18, fontWeight:700, marginBottom:6 }}>
                        {adminBanners[adminBannerIdx]?.title}
                      </div>
                      {adminBanners[adminBannerIdx]?.subtitle && (
                        <div style={{ color:"rgba(255,255,255,0.55)", fontSize:12 }}>
                          {adminBanners[adminBannerIdx].subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {adminBanners.length > 1 && (
                <div style={{ display:"flex", gap:4, justifyContent:"center", padding:"7px 0 8px" }}>
                  {adminBanners.map((_,i) => (
                    <div key={i} onClick={() => setAdminBannerIdx(i)} style={{
                      width:adminBannerIdx===i?18:5, height:5, borderRadius:3, cursor:"pointer",
                      background:adminBannerIdx===i?"#4a8ff5":"rgba(255,255,255,0.08)", transition:"all .3s",
                    }} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ height: 8 }} />
          )}

          {/* --------------------------------------
              S4.5  M?i b?n b (lun hi?n th?)
          -------------------------------------- */}
          <div style={{ margin:"0 16px 14px" }}>
              <div style={{ height:110, borderRadius:16, overflow:"hidden",
                border:"1px solid rgba(62,207,110,0.3)", position:"relative",
                background:"linear-gradient(135deg,#081a10,#0d2d18,#081510)", cursor:"pointer" }}
                onClick={() => router.push("/invite")}>
                <div style={{ position:"absolute", top:-20, right:-15, width:130, height:130,
                  background:"radial-gradient(circle,rgba(62,207,110,0.25) 0%,transparent 65%)" }} />
                <div style={{ position:"relative", zIndex:1, padding:"13px 15px" }}>
                  <div style={{ display:"inline-block",
                    background:"linear-gradient(135deg,#3ecf6e,#27ae60)",
                    borderRadius:8, padding:"2px 9px", marginBottom:5,
                    color:"#000", fontSize: 11, fontWeight:700, letterSpacing:.4 }}>
                    ?? M?I B?N B
                  </div>
                  <div style={{ color:"#fff", fontSize:13, fontWeight:700, lineHeight:1.3, maxWidth:"62%", wordBreak:"break-word" }}>
                    M?i b?n b, nh?n 5.000 XU!
                  </div>
                  <div style={{ color:"rgba(255,255,255,0.45)", fontSize: 11, marginTop:3 }}>
                    C? hai nh?n 5.000 xu  on d?u t? 50.000d
                  </div>
                  <div style={{ display:"inline-block", marginTop:6,
                    background:"rgba(62,207,110,0.15)", border:"1px solid rgba(62,207,110,0.35)",
                    borderRadius:6, padding:"3px 9px", color:"#3ecf6e", fontSize: 11, fontWeight:600 }}>
                    Chia s? ngay ?
                  </div>
                </div>
                <div style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)",
                  fontSize:52, zIndex:1, filter:"drop-shadow(0 0 14px rgba(62,207,110,0.4))" }}>??</div>
              </div>
          </div>

          {/* --------------------------------------
              S5  ServiceGrid (4 d?ch v? nhanh)
          -------------------------------------- */}
          <SectionHeader title="D?ch v? nhanh" />
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(4,1fr)",
            gap:7, padding:"0 16px", marginBottom:14,
          }}>
            {[
              { icon:"??", label:"Giao h?",  href:"/giao-ho", bg:"rgba(255,107,0,0.12)",  ic:"#FF8C00", badge:"HOT" },
              { icon:"??", label:"Mua h?",   href:"/mua-ho",  bg:"rgba(62,207,110,0.10)", ic:"#3ecf6e", badge:"" },
              { icon:"??", label:"Xe m",    href:"/xe-om",   bg:"rgba(74,143,245,0.10)", ic:"#4a8ff5", badge:"" },
              { icon:"??", label:"Taxi",     href:"/taxi",    bg:"rgba(180,100,255,0.10)",ic:"#b464ff", badge:"" },
            ].map((s,i) => (
              <a key={i} href={s.href} style={{ textDecoration:"none" }}>
                <div className="svc-card" style={{
                  background:"rgba(255,255,255,0.04)",
                  backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:14, padding:"10px 4px",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                  position:"relative",
                }}>
                  {s.badge && (
                    <div style={{ position:"absolute", top:-3, right:4 }}>
                      <Badge layer={1} variant="hot" size="sm" label={s.badge} />
                    </div>
                  )}
                  <div style={{ width:38, height:38, borderRadius:11,
                    background:s.bg, display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:20, color:s.ic }}>
                    {s.icon}
                  </div>
                  <span style={{ color:"#b0956a", fontSize: 11, textAlign:"center",
                    fontWeight:500, lineHeight:1.3 }}>{s.label}</span>
                </div>
              </a>
            ))}
          </div>

          {/* --------------------------------------
              S6  Voucher (khm ph t?t c?)
          -------------------------------------- */}
          <SectionHeader title="??? Voucher" more="Xem t?t c? ?" href="/vouchers" />
          {vouchers.length === 0 ? (
            <div style={{ margin:"0 16px 14px",
              background:"rgba(255,107,0,0.04)",
              border:"1.5px dashed rgba(255,107,0,0.2)",
              borderRadius:16, padding:"20px 16px",
              display:"flex", flexDirection:"column", alignItems:"center", gap:10,
            }}>
              <div style={{ position:"relative" }}>
                <div style={{ fontSize:44, lineHeight:1,
                  filter:"drop-shadow(0 0 12px rgba(255,179,71,0.3))" }}>???</div>
                <motion.div
                  animate={{ scale:[1,1.15,1], opacity:[0.5,1,0.5] }}
                  transition={{ duration:2.5, repeat:Infinity, ease:"easeInOut" }}
                  style={{ position:"absolute", inset:-8, borderRadius:"50%",
                    background:"radial-gradient(circle,rgba(255,179,71,0.12) 0%,transparent 70%)" }} />
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:700, marginBottom:5 }}>
                  Chua c voucher no
                </div>
                <div style={{ color:"#6a5a40", fontSize:10, lineHeight:1.7 }}>
                  ?t don d?u tin d? nh?n ngay<br/>
                  <span style={{ color:"#FFB347", fontWeight:600 }}>uu di h?p d?n t? Giao Nhanh!</span>
                </div>
              </div>
              <a href="/nearby-shops" style={{ textDecoration:"none" }}>
                <div style={{ background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.25)",
                  borderRadius:10, padding:"7px 18px",
                  color:"#FF8C00", fontSize:10, fontWeight:700 }}>
                  Khm ph qun ngay ?
                </div>
              </a>
            </div>
          ) : (
            <HScroll>
              {vouchers.map(v => {
                const saved = savedVoucherIds.includes(v.id)
                const isShop = !!v.shop_id
                const expDate = new Date(v.valid_to)
                const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / 86400000)
                const urgent = daysLeft <= 1
                const expiryLabel = daysLeft <= 0 ? "H?t h?n HM NAY!" : daysLeft === 1 ? "Cn 1 ngy" : `Cn ${daysLeft} ngy`
                const valueLabel = v.discount_type === "percent" ? `-${v.discount_value}%`
                  : v.discount_type === "freeship" ? "Free ship"
                  : `-${v.discount_value.toLocaleString("vi-VN")}d`
                return (
                  <div key={v.id} style={{
                    minWidth:162, flexShrink:0,
                    background: isShop ? "rgba(74,143,245,0.07)" : "rgba(255,107,0,0.07)",
                    backdropFilter:"blur(10px)",
                    border: `1px solid ${isShop ? "rgba(74,143,245,0.22)" : "rgba(255,107,0,0.2)"}`,
                    borderRadius:12, padding:"9px 11px",
                    display:"flex", flexDirection:"column", gap:7,
                    position:"relative", overflow:"hidden",
                  }}>
                    <div style={{ position:"absolute", top:0, left:"-80%", width:"40%", height:"100%",
                      background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)",
                      animation:"shimmer 3s infinite" }} />
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:32, height:32, borderRadius:9,
                        background: isShop ? "rgba(74,143,245,0.12)" : "rgba(255,107,0,0.12)",
                        border: `1px solid ${isShop ? "rgba(74,143,245,0.25)" : "rgba(255,107,0,0.25)"}`,
                        display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                        {isShop ? "??" : "??"}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color: isShop ? "#4a8ff5" : "#FF8C00", fontSize:12, fontWeight:700 }}>{valueLabel}</div>
                        <div style={{ color:"#b0956a", fontSize: 11, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.title}</div>
                      </div>
                    </div>
                    {/* Min spend progress bar */}
                    {v.min_order && v.min_order > 0 && (
                      <div style={{ marginBottom:6 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize: 10, color:"#6a5a40" }}>?t t?</span>
                          <span style={{ fontSize: 10, color: isShop ? "#4a8ff5" : "#FF8C00", fontWeight:700 }}>
                            {v.min_order.toLocaleString("vi-VN")}d
                          </span>
                        </div>
                        <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:"0%", borderRadius:2,
                            background: isShop ? "#4a8ff5" : "#FF8C00" }} />
                        </div>
                      </div>
                    )}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ fontSize: 10, color: urgent ? "#ff4040" : "rgba(255,107,0,0.45)", fontWeight: urgent ? 700 : 400 }}>
                        {urgent ? "? " : ""}{expiryLabel}
                      </div>
                      <button type="button"
                        onClick={() => setSavedVoucherIds(prev =>
                          saved ? prev.filter(x => x !== v.id) : [...prev, v.id]
                        )}
                        style={{
                          height:20, padding:"0 7px", borderRadius:6, border:"none",
                          cursor:"pointer", fontSize: 11, fontWeight:700, fontFamily:"Lexend",
                          background: saved ? "rgba(62,207,110,0.15)" : "rgba(255,107,0,0.15)",
                          color: saved ? "#3ecf6e" : "#FF8C00", transition:"all .2s",
                        }}>
                        {saved ? "?  luu" : "?? Luu"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </HScroll>
          )}

          {/* --------------------------------------
              S7  Danh m?c theo lo?i mn
          -------------------------------------- */}
          <SectionHeader title="Danh m?c" more="T?t c? ?" href="/danh-muc" />
          <div style={{ overflowX:"auto", display:"flex", gap:8, padding:"0 16px 4px", marginBottom:10,
            scrollbarWidth:"none", msOverflowStyle:"none" }}>
            {HOME_CATS.map((m, i) => (
              <motion.button key={m.value}
                initial={{ opacity:0, scale:.9 }} animate={{ opacity:1, scale:1 }}
                transition={{ delay: i * 0.04 }}
                whileTap={{ scale:.93 }}
                onClick={() => router.push(`/danh-muc/${m.value}`)}
                style={{
                  flexShrink:0,
                  background: m.color,
                  border:`1px solid ${m.color.replace(/[\d.]+\)$/, "0.4)")}`,
                  borderRadius:14, padding:"10px 12px",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:5,
                  cursor:"pointer", minWidth:72,
                }}>
                <div style={{
                  width:44, height:44, borderRadius:13,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:24, background:"rgba(0,0,0,0.15)",
                }}>
                  {m.emoji}
                </div>
                <div style={{
                  fontSize:9, fontWeight:700, color:"#f8f0e0",
                  textAlign:"center", lineHeight:1.3,
                  maxWidth:68, wordBreak:"keep-all",
                }}>
                  {m.label}
                </div>
              </motion.button>
            ))}
          </div>

          {/* --------------------------------------
              S8  PromoSection
          -------------------------------------- */}
          {promos.length > 0 && (<>
          <SectionHeader title="?? Khuy?n mi hm nay" more="Xem t?t c? ?" href="/promo-items" />
            <HScroll>
            {promos.map(p => {
              const shopName = (p.shops as {name:string}|null)?.name ?? ""
              const discountPct = p.original_price && p.original_price > p.price
                ? Math.round((1 - p.price / p.original_price) * 100) : 0
              return (
                <a key={p.id} href={`/shop/${p.shop_id}`} style={{ textDecoration:"none" }}>
                <div className="promo-card" style={{
                  minWidth:120, flexShrink:0,
                  background:"rgba(255,255,255,0.04)", backdropFilter:"blur(10px)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:14, overflow:"hidden", cursor:"pointer",
                }}>
                  <div style={{ height:74, display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:32, position:"relative",
                    background:"rgba(255,107,0,0.04)", overflow:"hidden" }}>
                    {p.image_url
                      ? <Image src={p.image_url} alt={p.name} fill sizes="120px" style={{ objectFit:"cover" }} />
                      : <span style={{ zIndex:1 }}>???</span>}
                    {discountPct > 0 && (
                      <div style={{ position:"absolute", top:5, left:5, zIndex:2 }}>
                        <Badge layer={2} variant="discount" size="sm" label={`-${discountPct}%`} />
                      </div>
                    )}
                    {discountPct === 0 && p.sold_count > 0 && (
                      <div style={{ position:"absolute", top:5, left:5, zIndex:2 }}>
                        <Badge layer={1} variant="hot" size="sm" />
                      </div>
                    )}
                  </div>
                  <div style={{ padding:"7px 9px 8px" }}>
                    <div style={{ color:"#f8f0e0", fontSize:10, fontWeight:600,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
                    <div style={{ color:"#6a5a40", fontSize:9, marginTop:1,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{shopName}</div>
                    <div style={{ marginTop:3 }}>
                      <span style={{ background:"linear-gradient(135deg,#FF6B00,#FFB347)",
                        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                        backgroundClip:"text", fontSize:11, fontWeight:700 }}>{fmt(p.price)}</span>
                      {p.original_price && p.original_price > p.price && (
                        <span style={{ color:"#6a5a40", fontSize:9, textDecoration:"line-through", marginLeft:4 }}>
                          {fmt(p.original_price)}
                        </span>
                      )}
                    </div>
                    <div style={{ display:"flex", alignItems:"center",
                      justifyContent:"space-between", marginTop:4 }}>
                      <span style={{ color:"#6a5a40", fontSize:9 }}>?? {p.sold_count} d bn</span>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); handleAdd(e.currentTarget as HTMLElement, { id:p.id, name:p.name, price:p.price, shop:shopName, shopId:p.shop_id }) }}
                        style={{ width:22, height:22, borderRadius:7,
                          background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
                          border:"none", color:"#fff", fontSize:14, fontWeight:700,
                          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                          boxShadow:"0 2px 6px rgba(255,107,0,0.4)", flexShrink:0 }}>+</button>
                    </div>
                  </div>
                </div>
                </a>
              )
            })}
            </HScroll>
          </>)}

          {/* --------------------------------------
              S8.5  C?a hng yu thch
          -------------------------------------- */}
          {favoriteShops.length > 0 && (
            <>
              <SectionHeader title="?? C?a hng yu thch" />
              <HScroll>
                {favoriteShops.map(s => (
                  <a key={s.id} href={`/shop/${s.id}`} style={{ textDecoration:"none", flexShrink:0 }}>
                    <div style={{
                      width:140, background:"rgba(255,255,255,0.05)", backdropFilter:"blur(10px)",
                      border:"1px solid rgba(255,107,0,0.18)", borderRadius:14, overflow:"hidden",
                    }}>
                      <div style={{ height:64, background:"rgba(255,107,0,0.06)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:36, position:"relative" }}>
                        {s.logo_url
                          ? <Image src={s.logo_url} alt={s.name} fill sizes="64px" style={{ objectFit:"cover" }} />
                          : "??"}
                        <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(s.id) }}
                          style={{ position:"absolute", top:5, right:5, width:24, height:24, borderRadius:7,
                            background:"rgba(255,64,64,0.15)", border:"1px solid rgba(255,64,64,0.3)",
                            color:"#ff6060", fontSize:12, cursor:"pointer", display:"flex",
                            alignItems:"center", justifyContent:"center" }}>??</button>
                      </div>
                      <div style={{ padding:"8px 9px" }}>
                        <div style={{ color:"#f8f0e0", fontSize:10.5, fontWeight:600,
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.name}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                          <Badge layer={3} variant={s.is_open ? "open" : "closed"} size="sm" label={s.is_open ? "M?" : "ng"} />
                          <span style={{ color:"#6a5a40", fontSize: 11 }}> ? {s.rating_avg?.toFixed(1) ?? "M?i"}</span>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </HScroll>
            </>
          )}

          {/* --------------------------------------
              S9  NearbyShops
          -------------------------------------- */}
          <SectionHeader title="?? Qun g?n b?n" more="Xem t?t c? ?" href="/nearby-shops" />

          {/* Filter chips  danh m?c c qun */}
          {(() => {
            const usedCats = [...new Set(nearbyShops.flatMap(s => {
              const cats = Array.isArray(s.categories) && s.categories.length > 0 ? s.categories : s.category ? [s.category] : []
              return cats.map((v: string) => normalizeCategoryValue(v))
            }))].filter(v => v !== "khac")
            if (usedCats.length === 0) return null
            return (
              <div style={{ overflowX:"auto", display:"flex", gap:6, padding:"0 16px 10px",
                scrollbarWidth:"none", msOverflowStyle:"none" }}>
                <button onClick={() => setNearbyFilter("all")}
                  style={{ flexShrink:0, padding:"5px 12px", borderRadius:20, cursor:"pointer",
                    fontFamily:"Lexend", fontSize:10, fontWeight:600,
                    background: nearbyFilter==="all" ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)",
                    border: nearbyFilter==="all" ? "1px solid rgba(255,107,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: nearbyFilter==="all" ? "#FF8C00" : "#6a5a40", transition:"all .15s" }}>
                  T?t c?
                </button>
                {usedCats.map(v => {
                  const cat = getCategoryByValue(v)
                  const active = nearbyFilter === v
                  return (
                    <button key={v} onClick={() => setNearbyFilter(active ? "all" : v)}
                      style={{ flexShrink:0, padding:"5px 12px", borderRadius:20, cursor:"pointer",
                        fontFamily:"Lexend", fontSize:10, fontWeight:600,
                        background: active ? cat.color : "rgba(255,255,255,0.05)",
                        border: active ? `1px solid ${cat.color.replace(/[\d.]+\)$/, "0.5)")}` : "1px solid rgba(255,255,255,0.08)",
                        color: active ? "#f8f0e0" : "#6a5a40", transition:"all .15s",
                        display:"flex", alignItems:"center", gap:4 }}>
                      {cat.emoji} {cat.label.split("  ")[0]}
                    </button>
                  )
                })}
              </div>
            )
          })()}

          {(() => {
            const filteredShops = nearbyFilter === "all" ? nearbyShops : nearbyShops.filter(s => {
              const cats = Array.isArray(s.categories) && s.categories.length > 0 ? s.categories : s.category ? [s.category] : []
              return (cats.map((v: string) => normalizeCategoryValue(v)) as string[]).includes(nearbyFilter)
            })
            return (
          <div style={{ padding:"0 16px", display:"flex", flexDirection:"column",
            gap:9, marginBottom:14 }}>
            {filteredShops.length === 0 ? (
              <div style={{ textAlign:"center", padding:"20px 0", color:"#6a5a40", fontSize:11 }}>
                Chua c qun no{nearbyFilter !== "all" ? " trong danh m?c ny" : " trong khu v?c"}
              </div>
            ) : filteredShops.map(s => {
              const isFav    = favoriteIds.includes(s.id)
              const uLat     = locationData.lat, uLng = locationData.lng
              const coords   = s.location?.coordinates  // GeoJSON: [lng, lat]
              const dist     = (uLat && uLng && coords)
                ? distKm(uLat, uLng, coords[1], coords[0])
                : null
              const distLabel = dist != null
                ? dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`
                : null
              const rating   = s.rating_avg?.toFixed(1) ?? null
              const shopOpen = isShopInHours(s)
              return (
              <div key={s.id} style={{ position:"relative", opacity: shopOpen ? 1 : 0.55 }}>
                {/* Qun dng: ch?n click, hi?n toast */}
                {!shopOpen && (
                  <div onClick={() => {
                    const el = document.getElementById(`closed-toast-${s.id}`)
                    if (el) { el.style.opacity="1"; setTimeout(() => { el.style.opacity="0" }, 2000) }
                  }}
                  style={{ position:"absolute", inset:0, zIndex:2, cursor:"not-allowed", borderRadius:14 }} />
                )}
                {/* Toast dng c?a */}
                {!shopOpen && (
                  <div id={`closed-toast-${s.id}`} style={{
                    position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
                    background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)",
                    borderRadius:10, padding:"8px 14px", zIndex:3, whiteSpace:"nowrap",
                    color:"#f8f0e0", fontSize:11, fontWeight:700, pointerEvents:"none",
                    opacity:0, transition:"opacity 0.2s",
                  }}>
                    ?? {nextOpenLabel(s)}
                  </div>
                )}
                <a href={shopOpen ? `/shop/${s.id}` : "#"} onClick={e => !shopOpen && e.preventDefault()} style={{ textDecoration:"none" }}>
                  <div className="shop-card" style={{
                    background:"rgba(255,255,255,0.06)", backdropFilter:"blur(10px)",
                    border:`1px solid ${isFav ? "rgba(255,64,64,0.25)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius:14, padding:"11px 12px",
                    display:"flex", alignItems:"center", gap:11, cursor:"pointer",
                  }}>
                    {/* Logo */}
                    <div style={{ width:56, height:56, borderRadius:13, flexShrink:0, position:"relative",
                      background:"rgba(255,107,0,0.07)", border:"1px solid rgba(255,255,255,0.08)",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, overflow:"hidden" }}>
                      {s.logo_url
                        ? <Image src={s.logo_url} alt={s.name} fill sizes="56px" style={{ objectFit:"cover" }} />
                        : "??"}
                      {/* Closed overlay */}
                      {!shopOpen && (
                        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.52)",
                          display:"flex", alignItems:"center", justifyContent:"center", borderRadius:13 }}>
                          <span style={{ fontSize:16 }}>??</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      {/* Tn qun */}
                      <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                        marginBottom:5 }}>
                        {s.name}
                      </div>

                      {/* ? rating + ?? km + tr?ng thi  cng 1 hng */}
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        {/* Stars */}
                        {rating && <Badge layer={2} variant="rating" size="sm" label={rating} />}
                        {/* Distance */}
                        {distLabel && <Badge layer={2} variant="distance" size="sm" label={distLabel} />}
                        {/* Open/closed */}
                        {shopOpen
                          ? <Badge layer={3} variant="open" size="sm" label="ang m?" />
                          : <Badge layer={3} variant="closed" size="sm" label={nextOpenLabel(s)} icon={false} />
                        }
                        {/* Combo badge */}
                        {comboShopIds.has(s.id) && <Badge layer={2} variant="has-combo" size="sm" />}
                      </div>
                    </div>
                  </div>
                </a>

                {/* Favourite ?? */}
                <button onClick={e => { e.preventDefault(); toggleFavorite(s.id) }}
                  style={{ position:"absolute", top:11, right:11, width:28, height:28,
                    borderRadius:8, border:"none",
                    background: isFav ? "rgba(255,64,64,0.15)" : "rgba(255,255,255,0.06)",
                    color: isFav ? "#ff4040" : "#6a5a40", fontSize:14, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all .2s", zIndex:1 }}>
                  {isFav ? "??" : "??"}
                </button>
              </div>
            )})}
          </div>
            )
          })()}

          {/* --------------------------------------
              S9.5  V?a ln menu (s?n ph?m m?i nh?t)
          -------------------------------------- */}
          {newMenuItems.length > 0 && (
            <>
              <SectionHeader title="?? V?a ln menu" more="Xem thm ?" href="/search?sort=newest" />
              <HScroll>
                {newMenuItems.map(p => {
                  const shopName = (p.shops as {name:string}|null)?.name ?? ""
                  return (
                    <a key={p.id} href={`/shop/${p.shop_id}`}
                      style={{ textDecoration:"none", flexShrink:0, width:110,
                        display:"flex", flexDirection:"column",
                        background:"rgba(255,255,255,0.04)",
                        border:"1px solid rgba(62,207,110,0.15)",
                        borderRadius:13, overflow:"hidden" }}>
                      {p.image_url ? (
                        <Image src={p.image_url} alt={p.name} width={110} height={78} style={{ objectFit:"cover", display:"block" }} />
                      ) : (
                        <div style={{ width:110, height:78,
                          background:"linear-gradient(135deg,rgba(62,207,110,0.07),rgba(62,207,110,0.03))",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:30, position:"relative" }}>
                          ???
                          <div style={{ position:"absolute", top:5, left:5,
                            background:"rgba(62,207,110,0.85)", color:"#000",
                            fontSize: 10, fontWeight:700, padding:"2px 5px", borderRadius:5 }}>M?I</div>
                        </div>
                      )}
                      <div style={{ padding:"7px 8px 8px" }}>
                        <div style={{ color:"#f8f0e0", fontSize:10.5, fontWeight:600,
                          lineHeight:1.3, marginBottom:3,
                          display:"-webkit-box", WebkitLineClamp:2,
                          WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                          {p.name}
                        </div>
                        <div style={{ color:"#6a5a40", fontSize: 11, marginBottom:4,
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {shopName}
                        </div>
                        <div style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",
                          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                          backgroundClip:"text", fontSize:11, fontWeight:700 }}>
                          {fmt(p.price)}
                        </div>
                      </div>
                    </a>
                  )
                })}
              </HScroll>
            </>
          )}

          {/* --------------------------------------
              S9.6  Mn an g?i  (theo l?ch s? tm ki?m)
          -------------------------------------- */}
          {searchSuggest.length > 0 && (
            <>
              <SectionHeader title="?? Mn an g?i " more="Tm ki?m ?" href="/search" />
              <HScroll>
                {searchSuggest.map(p => {
                  const shopName = (p.shops as {name:string}|null)?.name ?? ""
                  return (
                    <div key={p.id} className="promo-card" style={{
                      minWidth:120, flexShrink:0,
                      background:"rgba(255,255,255,0.04)", backdropFilter:"blur(10px)",
                      border:"1px solid rgba(180,100,255,0.15)",
                      borderRadius:14, overflow:"hidden", cursor:"pointer",
                    }}>
                      <div style={{ height:74, display:"flex", alignItems:"center",
                        justifyContent:"center", fontSize:32, position:"relative",
                        background:"rgba(180,100,255,0.04)" }}>
                        <div style={{ position:"absolute", inset:0,
                          background:"radial-gradient(circle at 50% 65%,rgba(180,100,255,0.1) 0%,transparent 65%)" }} />
                        ???
                      </div>
                      <div style={{ padding:"7px 9px 8px" }}>
                        <div style={{ color:"#f8f0e0", fontSize:10, fontWeight:600,
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
                        <div style={{ color:"#6a5a40", fontSize: 11, marginTop:1,
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{shopName}</div>
                        <div style={{ background:"linear-gradient(135deg,#FF6B00,#FFB347)",
                          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                          backgroundClip:"text", fontSize:11, fontWeight:700, marginTop:3 }}>{fmt(p.price)}</div>
                        <div style={{ display:"flex", alignItems:"center",
                          justifyContent:"space-between", marginTop:4 }}>
                          <span style={{ color:"#6a5a40", fontSize: 10 }}>?? {p.sold_count} d bn</span>
                          <button
                            onClick={e => { e.preventDefault(); e.stopPropagation();
                              handleAdd(e.currentTarget as HTMLElement,
                                { id:p.id, name:p.name, price:p.price, shop:shopName, shopId:p.shop_id }) }}
                            style={{ width:22, height:22, borderRadius:7,
                              background:"linear-gradient(135deg,#b464ff,#8a40cc)",
                              border:"none", color:"#fff", fontSize:14, fontWeight:700,
                              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                              boxShadow:"0 2px 6px rgba(180,100,255,0.4)", flexShrink:0 }}>+</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </HScroll>
            </>
          )}

          {/* --------------------------------------
              S10a  Smart Recommendations
          -------------------------------------- */}
          {recos.length > 0 && (
            <>
              <SectionHeader title="? G?i  cho b?n" more="Xem thm ?" href="/search" />
              <HScroll>
                {recos.map(p => (
                  <a key={p.id} href={`/shop/${p.shop_id}`}
                    style={{ textDecoration:"none", flexShrink:0,
                      width:110, display:"flex", flexDirection:"column",
                      background:"rgba(255,255,255,0.04)",
                      border:"1px solid rgba(255,107,0,0.12)",
                      borderRadius:13, overflow:"hidden" }}>
                    {p.image_url ? (
                      <Image src={p.image_url} alt={p.name} width={110} height={78} style={{ objectFit:"cover", display:"block" }} />
                    ) : (
                      <div style={{ width:110, height:78,
                        background:"linear-gradient(135deg,rgba(255,107,0,0.07),rgba(255,179,71,0.04))",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:30 }}>???</div>
                    )}
                    <div style={{ padding:"7px 8px 8px" }}>
                      <div style={{ color:"#f8f0e0", fontSize:10.5, fontWeight:600,
                        lineHeight:1.3, marginBottom:3,
                        display:"-webkit-box", WebkitLineClamp:2,
                        WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                        {p.name}
                      </div>
                      <div style={{ color:"#6a5a40", fontSize: 11, marginBottom:4,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {p.shop_name}
                      </div>
                      <div style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",
                        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                        backgroundClip:"text", fontSize:11, fontWeight:700 }}>
                        {fmt(p.price)}
                      </div>
                    </div>
                  </a>
                ))}
              </HScroll>
            </>
          )}

          {/* --------------------------------------
              S10  BestSellers
          -------------------------------------- */}
          {bestSellers.length > 0 && (<>
          <SectionHeader title="?? Bn ch?y tu?n ny" more="Xem t?t c? ?" href="/bestsellers" />
            <HScroll>
              {bestSellers.map((b, idx) => {
                const rank = idx + 1
                const shopName = (b.shops as {name:string}|null)?.name ?? ""
                return (
                  <div key={b.id} style={{
                    minWidth:110, flexShrink:0,
                    background:"rgba(255,255,255,0.05)", backdropFilter:"blur(10px)",
                    border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:13, overflow:"hidden", cursor:"pointer",
                  }}>
                    <div style={{ height:80, display:"flex", alignItems:"center",
                      justifyContent:"center", fontSize:34, position:"relative",
                      background:"rgba(255,255,255,0.02)", overflow:"hidden" }}>
                      {b.image_url
                        ? <Image src={b.image_url} alt={b.name} fill sizes="130px" style={{ objectFit:"cover" }} />
                        : <>
                            <div style={{ position:"absolute", inset:0,
                              background:"radial-gradient(circle at 50% 60%,rgba(255,107,0,0.09) 0%,transparent 65%)" }} />
                            <span style={{ position:"relative", zIndex:1 }}>???</span>
                          </>
                      }
                      <div style={{ position:"absolute", top:6, left:6,
                        width:20, height:20, borderRadius:6,
                        background: rank<=3 ? "rgba(255,215,0,0.15)" : "rgba(255,107,0,0.1)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:10, fontWeight:800,
                        color: rank===1 ? "#FFD700" : rank===2 ? "#C0C0C0" : rank===3 ? "#CD7F32" : "#FF8C00" }}>
                        {rank <= 3 ? RANK_ICON[rank-1] : rank}
                      </div>
                    </div>
                    <div style={{ padding:"7px 9px 8px" }}>
                      <div style={{ color:"#f8f0e0", fontSize: 11, fontWeight:600,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.name}</div>
                      <div style={{ color:"#6a5a40", fontSize: 11, marginTop:1,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{shopName}</div>
                      <div style={{ color:"#3ecf6e", fontSize: 10, fontWeight:600, marginTop:3 }}>
                        ?? {b.sold_count.toLocaleString("vi-VN")} d bn
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between",
                        alignItems:"center", marginTop:4 }}>
                        <div style={{ background:"linear-gradient(135deg,#FF6B00,#FFB347)",
                          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                          backgroundClip:"text", fontSize:11, fontWeight:700 }}>
                          {fmt(b.price)}
                        </div>
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); handleAdd(e.currentTarget as HTMLElement, { id:b.id, name:b.name, price:b.price, shop:shopName, shopId:b.shop_id }) }}
                          style={{ width:22, height:22, borderRadius:7,
                            background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
                            border:"none", color:"#fff", fontSize:14, fontWeight:700,
                            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                            boxShadow:"0 2px 6px rgba(255,107,0,0.4)", flexShrink:0 }}>+</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </HScroll>
          </>)}

          {/* S11  LoyaltyPoints removed: di?m ch? hi?n th? trong Profile c nhn */}

          {/* S11  C?a hng yu thch: s? hi?n khi c b?ng favorites */}

          {/* --------------------------------------
              S12  ReorderSection
          -------------------------------------- */}
          <SectionHeader title="?? ?t l?i nhanh" more="L?ch s? ?" href="/orders" />
          {reorders.length === 0 ? (
            <div style={{ padding:"0 16px 14px" }}>
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px dashed rgba(255,255,255,0.07)",
                borderRadius:12, padding:"16px", textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:6 }}>???</div>
                <div style={{ color:"#6a5a40", fontSize:10 }}>?t don d?u tin d? th?y<br/>l?ch s? d?t l?i nhanh ? dy</div>
              </div>
            </div>
          ) : (
            <HScroll>
              {reorders.map(r => {
                const shopName = (r.shops as {name:string}|null)?.name ?? "Qun"
                const firstItem = (r.order_items as {name:string}[])?.[0]?.name ?? "on hng"
                return (
                  <div key={r.id} style={{
                    minWidth:132, flexShrink:0,
                    background:"rgba(255,255,255,0.04)", backdropFilter:"blur(10px)",
                    border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:12, padding:"10px 11px", cursor:"pointer",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7 }}>
                      <span style={{ fontSize:20 }}>??</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:"#f8f0e0", fontSize: 11, fontWeight:600,
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {firstItem}
                        </div>
                        <div style={{ color:"#6a5a40", fontSize: 11, marginTop:1,
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {shopName}
                        </div>
                      </div>
                    </div>
                    <a href={`/shop/${r.shop_id}`} style={{ textDecoration:"none" }}>
                      <div className="reorder-btn" style={{
                        width:"100%", height:28, borderRadius:8, border:"1px solid rgba(255,107,0,0.25)",
                        background:"rgba(255,107,0,0.08)",
                        color:"#FF8C00", fontSize: 11, fontWeight:600,
                        cursor:"pointer", fontFamily:"Lexend",
                        display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                        transition:"background .15s",
                      }}>
                        ?? ?t l?i  {Math.round(r.total_amount/1000)}k
                      </div>
                    </a>
                  </div>
                )
              })}
            </HScroll>
          )}

          <div style={{ height:8 }} />

        </div>

        {/* --------------------------------------
            FLOATING BOTTOM NAV (Capsule)
        -------------------------------------- */}
        <div style={{
          position:"absolute", bottom:"max(16px,env(safe-area-inset-bottom))",left:14, right:14, height:56,
          background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
          WebkitBackdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)",
          borderRadius:9999,
          display:"flex", alignItems:"center", justifyContent:"space-around",
          padding:"0 6px", zIndex:50,
          boxShadow:"0 0 20px rgba(255,107,0,0.1)",
        }}>
          {[
            { icon:"??", label:"Trang ch?", key:"home",     href:"/"         },
            { icon:"??", label:"on hng",  key:"orders",   href:"/orders"   },
            { icon:"??", label:"Gi? hng",  key:"cart",     href:"/cart",  cart:true },
            { icon:"??", label:"Ci d?t",   key:"settings", href:"/settings" },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => { setActiveTab(tab.key); router.push(tab.href) }}
              style={{ background:"transparent", border:"none", padding:0, cursor:"pointer" }}>
              <div style={{
                display:"flex", flexDirection:"column", alignItems:"center", gap:2,
                padding:"5px 11px", borderRadius:18,
                background: activeTab===tab.key ? "rgba(255,107,0,0.12)" : "transparent",
                position:"relative",
                transform: activeTab===tab.key ? "translateY(-2px)" : "translateY(0)",
                transition:"all .2s",
              }}>
                {tab.cart && (
                  <div ref={cartIconRef} style={{ position:"absolute", inset:0 }} />
                )}
                <span style={{ fontSize:19,
                  filter: activeTab===tab.key
                    ? "drop-shadow(0 0 4px rgba(255,107,0,0.6))"
                    : "none" }}>
                  {tab.icon}
                </span>
                <span style={{
                  fontSize: 10,
                  color: activeTab===tab.key ? "#FF8C00" : "#6a5a40",
                  fontWeight: activeTab===tab.key ? 600 : 400,
                }}>
                  {tab.label}
                </span>
                {/* Cart badge */}
                {tab.cart && cartCount > 0 && (
                  <div style={{
                    position:"absolute", top:1, right:5,
                    width:14, height:14, borderRadius:"50%",
                    background:"#ff4040", border:"1.5px solid #080806",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:"#fff", fontSize: 10, fontWeight:700,
                    animation:"cartBounce .4s ease",
                  }}>{cartCount}</div>
                )}
                {/* Active halo */}
                {activeTab===tab.key && (
                  <div style={{
                    position:"absolute", bottom:-2,
                    width:28, height:3, borderRadius:2,
                    background:"radial-gradient(ellipse,rgba(255,107,0,0.9) 0%,transparent 70%)",
                    filter:"blur(1px)",
                  }} />
                )}
              </div>
            </button>
          ))}
        </div>

      </div>

      {/* -- Conflict Modal  d?i qun -- */}
      <AnimatePresence>
        {conflictItem && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:"fixed", inset:0, zIndex:200,
              background:"rgba(0,0,0,0.72)", backdropFilter:"blur(6px)",
              display:"flex", alignItems:"flex-end", justifyContent:"center",
              padding:"0 16px 40px" }}
            onClick={() => setConflictItem(null)}>
            <motion.div
              initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:80, opacity:0 }}
              transition={{ type:"spring", damping:22, stiffness:260 }}
              onClick={e => e.stopPropagation()}
              style={{ background:"#151210", border:"1px solid rgba(255,107,0,0.28)",
                borderRadius:22, padding:"22px 18px 18px", width:"100%", maxWidth:420 }}>
              <div style={{ fontSize:32, textAlign:"center", marginBottom:8 }}>??</div>
              <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700,
                textAlign:"center", marginBottom:10 }}>
                Thay d?i qun?
              </div>
              <div style={{ color:"#b0956a", fontSize:12, textAlign:"center",
                lineHeight:1.7, marginBottom:20 }}>
                Gi? hng dang c mn t?{" "}
                <span style={{ color:"#FF8C00", fontWeight:700 }}>{storeShopName}</span>.
                <br />Thm mn m?i s? <strong style={{ color:"#ff6060" }}>xa gi? hng hi?n t?i</strong>.
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button
                  onClick={() => setConflictItem(null)}
                  style={{ flex:1, height:48, borderRadius:13,
                    border:"1px solid rgba(255,255,255,0.1)",
                    background:"rgba(255,255,255,0.06)",
                    color:"#b0956a", fontSize:13, fontWeight:600,
                    cursor:"pointer", fontFamily:"Lexend" }}>
                  Gi? gi? cu
                </button>
                <button
                  onClick={confirmReplace}
                  style={{ flex:1, height:48, borderRadius:13, border:"none",
                    background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
                    color:"#fff", fontSize:13, fontWeight:700,
                    cursor:"pointer", fontFamily:"Lexend",
                    boxShadow:"0 4px 16px rgba(255,107,0,0.4)" }}>
                  Xa &amp; thm m?i
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
