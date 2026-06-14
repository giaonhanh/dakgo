"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { calcDeliveryFee, calcDeliveryFeeFromPricing, haversineKm } from "@/lib/vietmapRoute"
import { useLocationStore } from "@/store/locationStore"

const supabase = createClient()

// --- Types ---
interface ShopResult {
  id:              string
  type:            "shop"
  name:            string
  category:        string
  logo_url:        string
  cover_image_url: string
  rating_avg:      number
  total_reviews:   number
  distance_km:     number
  delivery_fee:    number | null
  is_open:         boolean
  lat:             number | null
  lng:             number | null
  promo?:          string
}

interface ProductResult {
  id:          string
  type:        "product"
  name:        string
  shop_name:   string
  shop_id:     string
  image_url:   string
  price:       number
  original_price?: number
  rating:      number
  sold_count:  number
}

type SearchResult = ShopResult | ProductResult

const POPULAR_TAGS = ["🍜 Bún/Phở", "🧋 Đồ uống", "🍗 Gà rán", "🍱 Cơm hộp", "🧁 Bánh", "🍕 Pizza"]
const LS_KEY = "gn_search_history"
const MAX_HISTORY = 10

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") } catch { return [] }
}
function saveHistory(list: string[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)) } catch { /* noop */ }
}

const formatPrice = (n: number) => n.toLocaleString("vi-VN") + "đ"

// Types returned by search_catalog RPC
interface RpcProduct {
  id: string; name: string; price: number; original_price: number | null
  image_url: string | null; sold_count: number; shop_id: string; shop_name: string; score?: number
}
interface RpcShop {
  id: string; name: string; category?: string; logo_url: string | null
  cover_image_url?: string | null; total_reviews?: number
  lat?: number | null; lng?: number | null
  location?: { coordinates: [number, number] } | null
  rating_avg: number; is_open: boolean; score?: number
}
interface RpcResult { products: RpcProduct[] | null; shops: RpcShop[] | null }

let _pricingRows: string[] | null = null
let _pricingExtra = "3500"
async function loadPricing() {
  if (_pricingRows) return
  const { data } = await supabase.from("app_settings").select("value").eq("key", "pricing").maybeSingle()
  const food = (data?.value as Record<string, { rows?: string[]; extra?: string }> | null)?.food
  if (food?.rows) { _pricingRows = food.rows; _pricingExtra = food.extra ?? "3500" }
}

function shopDeliveryFee(lat: number | null, lng: number | null, userLat: number | null, userLng: number | null): number | null {
  if (!userLat || !userLng) return null           // thiếu GPS user → hiện "Cần GPS"
  if (!lat || !lng) return calcDeliveryFee(3)     // quán chưa có tọa độ → ước 3km (~20k)
  const km = haversineKm(userLat, userLng, lat, lng)
  if (_pricingRows) return calcDeliveryFeeFromPricing(km, _pricingRows, _pricingExtra)
  return calcDeliveryFee(km)
}

async function searchSupabase(query: string, userLat: number | null, userLng: number | null): Promise<SearchResult[]> {
  await loadPricing()
  const q = query.trim()
  if (!q) return []

  const { data: rpc, error } = await supabase.rpc("search_catalog", { query: q }) as
    { data: RpcResult | null; error: unknown }

  if (!error && rpc) {
    const shopResults: ShopResult[] = (rpc.shops ?? []).map(s => {
      const lat = s.lat ?? s.location?.coordinates?.[1] ?? null
      const lng = s.lng ?? s.location?.coordinates?.[0] ?? null
      return {
        id: s.id, type: "shop" as const,
        name: s.name, category: s.category ?? "",
        logo_url: s.logo_url ?? "",
        cover_image_url: s.cover_image_url ?? "",
        rating_avg: Number(s.rating_avg ?? 5),
        total_reviews: s.total_reviews ?? 0,
        distance_km: (lat && lng && userLat && userLng) ? haversineKm(userLat, userLng, lat, lng) : 0,
        delivery_fee: shopDeliveryFee(lat, lng, userLat, userLng),
        is_open: s.is_open, lat, lng,
      }
    })
    const productResults: ProductResult[] = (rpc.products ?? []).map(p => ({
      id: p.id, type: "product" as const,
      name: p.name, shop_name: p.shop_name ?? "", shop_id: p.shop_id,
      image_url: p.image_url ?? "", price: p.price,
      original_price: p.original_price ?? undefined,
      rating: 5, sold_count: p.sold_count ?? 0,
    }))
    return [...shopResults, ...productResults]
  }

  // Fallback: plain ILIKE queries
  const [{ data: shops }, { data: products }] = await Promise.all([
    supabase
      .from("shops")
      .select("id, name, logo_url, cover_image_url, rating_avg, total_reviews, is_open, lat, lng, location")
      .eq("status", "approved")
      .ilike("name", `%${q}%`)
      .limit(20),
    supabase
      .from("products")
      .select("id, name, price, original_price, image_url, sold_count, shop_id, shops(name)")
      .eq("is_available", true)
      .ilike("name", `%${q}%`)
      .limit(20),
  ])
  const shopResults: ShopResult[] = (shops ?? []).map(s => {
    const row = s as { lat?: number | null; lng?: number | null; location?: { coordinates: [number,number] } | null }
    const lat = row.lat ?? row.location?.coordinates?.[1] ?? null
    const lng = row.lng ?? row.location?.coordinates?.[0] ?? null
    return {
      id: s.id, type: "shop" as const,
      name: s.name, category: "",
      logo_url: s.logo_url ?? "",
      cover_image_url: (s as { cover_image_url?: string | null }).cover_image_url ?? "",
      rating_avg: Number(s.rating_avg ?? 5),
      total_reviews: (s as { total_reviews?: number }).total_reviews ?? 0,
      distance_km: (lat && lng && userLat && userLng) ? haversineKm(userLat, userLng, lat, lng) : 0,
      delivery_fee: shopDeliveryFee(lat, lng, userLat, userLng),
      is_open: s.is_open, lat, lng,
    }
  })
  const productResults: ProductResult[] = (products ?? []).map(p => {
    const shopName = Array.isArray(p.shops)
      ? (p.shops[0] as { name: string })?.name
      : (p.shops as { name: string } | null)?.name
    return {
      id: p.id, type: "product" as const,
      name: p.name, shop_name: shopName ?? "", shop_id: p.shop_id,
      image_url: p.image_url ?? "", price: p.price,
      original_price: p.original_price ?? undefined,
      rating: 5, sold_count: p.sold_count ?? 0,
    }
  })
  return [...shopResults, ...productResults]
}

type SortKey = "relevant" | "rating" | "distance" | "price_asc" | "price_desc"
type FilterState = {
  sort:         SortKey
  only_open:    boolean
  max_delivery: number | null
  min_rating:   number | null
  has_promo:    boolean
}

const DEFAULT_FILTER: FilterState = {
  sort: "relevant", only_open: false, max_delivery: null, min_rating: null, has_promo: false,
}

function SearchContent() {
  const router        = useRouter()
  const params        = useSearchParams()
  const inputRef      = useRef<HTMLInputElement>(null)

  const [query, setQuery]           = useState(params.get("q") ?? "")
  const [results, setResults]       = useState<SearchResult[]>([])
  const [loading, setLoading]       = useState(false)
  const { lat: userLat, lng: userLng, denied: gpsBlocked } = useLocationStore()

  const [showFilter, setShowFilter] = useState(params.get("filter") === "open")
  const [filter, setFilter]         = useState<FilterState>({
    ...DEFAULT_FILTER,
    only_open: params.get("filter") === "open",
  })
  const [activeTab, setActiveTab]   = useState<"all" | "shops" | "products">("all")
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const isNewest = params.get("sort") === "newest"

  useEffect(() => { setRecentSearches(loadHistory()) }, [])

  // Auto-load newest products khi vào từ "Vừa lên menu > Xem thêm"
  useEffect(() => {
    if (!isNewest || query) return
    setLoading(true)
    supabase
      .from("products")
      .select("id, name, price, original_price, image_url, sold_count, shop_id, shops!shop_id(name)")
      .eq("is_available", true)
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        const items: ProductResult[] = data.map(p => {
          const shop = (Array.isArray(p.shops) ? p.shops[0] : p.shops) as { name: string } | null
          return {
            id: p.id, type: "product" as const,
            name: p.name, shop_name: shop?.name ?? "",
            shop_id: p.shop_id, image_url: p.image_url ?? "",
            price: p.price, original_price: p.original_price ?? undefined,
            rating: 5, sold_count: p.sold_count ?? 0,
          }
        })
        setResults(items)
        setLoading(false)
      })
  }, [isNewest]) // eslint-disable-line react-hooks/exhaustive-deps

  const addToHistory = useCallback((q: string) => {
    const trimmed = q.trim().toLowerCase()
    if (!trimmed) return
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, MAX_HISTORY)
      saveHistory(updated)
      return updated
    })
  }, [])

  const removeFromHistory = useCallback((item: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== item)
      saveHistory(updated)
      return updated
    })
  }, [])

  const clearHistory = useCallback(() => {
    saveHistory([])
    setRecentSearches([])
  }, [])

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback((q: string) => {
    setLoading(true)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      const data = await searchSupabase(q, userLat, userLng)
      setResults(data)
      setLoading(false)
    }, 400)
  }, [userLat, userLng])

  useEffect(() => {
    if (query) doSearch(query)
    else { setResults([]); setLoading(false) }
  }, [query, doSearch])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = results.filter(r => {
    if (filter.only_open && r.type === "shop" && !(r as ShopResult).is_open) return false
    if (filter.min_rating !== null) {
      const rating = r.type === "shop" ? (r as ShopResult).rating_avg : (r as ProductResult).rating
      if (rating < filter.min_rating) return false
    }
    if (filter.has_promo && r.type === "shop" && !(r as ShopResult).promo) return false
    return true
  }).filter(r => {
    if (activeTab === "shops")    return r.type === "shop"
    if (activeTab === "products") return r.type === "product"
    return true
  }).sort((a, b) => {
    if (filter.sort === "rating") {
      const ra = a.type === "shop" ? (a as ShopResult).rating_avg : (a as ProductResult).rating
      const rb = b.type === "shop" ? (b as ShopResult).rating_avg : (b as ProductResult).rating
      return rb - ra
    }
    if (filter.sort === "distance" && a.type === "shop" && b.type === "shop") {
      return (a as ShopResult).distance_km - (b as ShopResult).distance_km
    }
    if (filter.sort === "price_asc" && a.type === "product" && b.type === "product") {
      return (a as ProductResult).price - (b as ProductResult).price
    }
    if (filter.sort === "price_desc" && a.type === "product" && b.type === "product") {
      return (b as ProductResult).price - (a as ProductResult).price
    }
    return 0
  })

  const shopCount    = filtered.filter(r => r.type === "shop").length
  const productCount = filtered.filter(r => r.type === "product").length
  const hasActiveFilter = filter.only_open || filter.min_rating !== null || filter.has_promo || filter.max_delivery !== null

  return (
    <>
      <style>{`
        * { -ms-overflow-style: none; scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      <div style={{
        position: "fixed", inset: 0, background: "#080806", zIndex: 60,
        display: "flex", flexDirection: "column", fontFamily: "'Lexend', sans-serif",
      }}>
        {/* Search header */}
        <div style={{ padding: "calc(env(safe-area-inset-top) + 12px) 16px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <button
              onClick={() => router.back()}
              style={{
                width: 38, height: 38, borderRadius: 11,
                background: "rgba(255,255,255,0.06)", border: "none",
                color: "#f8f0e0", fontSize: 18, cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Lexend', sans-serif",
              }}
            >←</button>

            {/* Search input */}
            <div style={{ flex: 1, position: "relative" }}>
              <span style={{
                position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
                fontSize: 16, pointerEvents: "none",
              }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && query.trim()) addToHistory(query) }}
                placeholder={isNewest ? "🆕 Món mới nhất — tìm thêm..." : "Tìm món ăn, cửa hàng..."}
                style={{
                  width: "100%", boxSizing: "border-box",
                  height: 42, padding: "0 36px 0 40px",
                  background: "rgba(255,255,255,0.07)", borderRadius: 12,
                  border: "1px solid rgba(255,107,0,0.3)",
                  color: "#f8f0e0", fontSize: 14, outline: "none",
                  fontFamily: "'Lexend', sans-serif",
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "#6a5a40",
                    fontSize: 14, cursor: "pointer", padding: 2,
                  }}
                >×</button>
              )}
            </div>

            {/* Filter button */}
            <button
              onClick={() => setShowFilter(p => !p)}
              style={{
                width: 38, height: 38, borderRadius: 11,
                background: hasActiveFilter ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.06)",
                border: hasActiveFilter ? "1px solid rgba(255,107,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: hasActiveFilter ? "#FF8C00" : "#b0956a",
                fontSize: 18, cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              } as React.CSSProperties}
            >⚙️</button>
          </div>

          {/* Banner GPS bị từ chối */}
          {gpsBlocked && (
            <div style={{ display:"flex", alignItems:"center", gap:10, margin:"0 0 10px",
              background:"rgba(255,107,0,0.08)", border:"1px solid rgba(255,107,0,0.25)",
              borderRadius:10, padding:"8px 12px" }}>
              <span style={{ fontSize:18 }}>📍</span>
              <div style={{ flex:1 }}>
                <div style={{ color:"#FF8C00", fontSize:11, fontWeight:700 }}>GPS bị chặn</div>
                <div style={{ color:"#b0956a", fontSize:10 }}>Vào Cài đặt trình duyệt → cấp quyền vị trí để xem phí ship</div>
              </div>
            </div>
          )}

          {/* Tabs */}
          {!isNewest && results.length > 0 && (
            <div style={{ display: "flex", gap: 8, paddingBottom: 12 }}>
              {([
                { key: "all",      label: `Tất cả (${filtered.length})` },
                { key: "shops",    label: `Quán (${shopCount})` },
                { key: "products", label: `Món (${productCount})` },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    height: 30, padding: "0 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    border: activeTab === t.key ? "1px solid rgba(255,107,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    background: activeTab === t.key ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                    color: activeTab === t.key ? "#FF8C00" : "#6a5a40",
                    fontFamily: "'Lexend', sans-serif",
                  }}
                >{t.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 88px" } as React.CSSProperties}>
          {/* Empty state */}
          {!query && (
            <>
              {/* Recent searches */}
              {recentSearches.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#6a5a40", fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>
                      Tìm kiếm gần đây
                    </p>
                    <button
                      onClick={clearHistory}
                      style={{
                        background: "none", border: "none", padding: 0,
                        color: "#FF6B00", fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: "'Lexend', sans-serif",
                      }}
                    >Xóa tất cả</button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {recentSearches.map(s => (
                      <div
                        key={s}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "7px 8px 7px 14px", borderRadius: 20,
                          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <button
                          onClick={() => setQuery(s)}
                          style={{
                            background: "none", border: "none", padding: 0,
                            color: "#b0956a", fontSize: 13, cursor: "pointer",
                            fontFamily: "'Lexend', sans-serif",
                          }}
                        >🕐 {s}</button>
                        <button
                          onClick={() => removeFromHistory(s)}
                          style={{
                            background: "rgba(255,255,255,0.08)", border: "none",
                            width: 18, height: 18, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#6a5a40", fontSize: 10, cursor: "pointer", flexShrink: 0,
                            lineHeight: 1,
                          }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular tags */}
              {!isNewest && <div>
                <p style={{ fontSize: 12, color: "#6a5a40", fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>
                  Phổ biến hôm nay
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {POPULAR_TAGS.map(t => (
                    <button
                      key={t}
                      onClick={() => setQuery(t.split(" ").slice(1).join(" "))}
                      style={{
                        padding: "7px 14px", borderRadius: 20,
                        background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.2)",
                        color: "#FF8C00", fontSize: 13, cursor: "pointer",
                        fontFamily: "'Lexend', sans-serif",
                      }}
                    >{t}</button>
                  ))}
                </div>
              </div>}
            </>
          )}

          {/* Loading */}
          {loading && (query || isNewest) && (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                border: "3px solid rgba(255,107,0,0.2)", borderTopColor: "#FF6B00",
                animation: "spin 0.8s linear infinite",
              }} />
            </div>
          )}

          {/* Results */}
          {!loading && (query || isNewest) && (
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div
                  key="no-results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ textAlign: "center", padding: "60px 20px" }}
                >
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                  <p style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                    Không tìm thấy &ldquo;{query}&rdquo;
                  </p>
                  <p style={{ color: "#6a5a40", fontSize: 13 }}>
                    Thử từ khóa khác hoặc xóa bộ lọc
                  </p>
                </motion.div>
              ) : (
                filtered.map((r, idx) => (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    {r.type === "shop"
                      ? <ShopCard shop={r as ShopResult} userLat={userLat} onClick={() => { addToHistory(query); router.push(`/shop/${r.id}`) }} />
                      : <ProductCard product={r as ProductResult} onClick={() => { addToHistory(query); router.push(`/shop/${(r as ProductResult).shop_id}`) }} />
                    }
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Bottom Nav */}
        <div style={{
          position: "fixed", bottom: "max(16px,env(safe-area-inset-bottom))", left: 14, right: 14, height: 56,
          background: "rgba(8,8,6,0.92)", backdropFilter: "blur(20px)",
          borderRadius: 9999, border: "1px solid rgba(255,107,0,0.2)",
          boxShadow: "0 0 20px rgba(255,107,0,0.1)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "space-around",
        }}>
          {([
            { icon: "🏠", label: "Trang chủ", href: "/",        active: false },
            { icon: "📋", label: "Đơn hàng",  href: "/orders",  active: false },
            { icon: "🛒", label: "Giỏ hàng",  href: "/cart",    active: false },
            { icon: "⚙️", label: "Cài đặt",   href: "/profile", active: false },
          ] as const).map(tab => (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              style={{
                flex: 1, height: "100%", background: "none", border: "none",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 2, cursor: "pointer", borderRadius: 9999,
                fontFamily: "'Lexend', sans-serif",
              }}
            >
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#6a5a40" }}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter Sheet */}
      <AnimatePresence>
        {showFilter && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFilter(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 180 }}
            />
            <FilterSheet
              filter={filter}
              onChange={setFilter}
              onClose={() => setShowFilter(false)}
              onReset={() => { setFilter(DEFAULT_FILTER); setShowFilter(false) }}
            />
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  )
}

// --- Shop Card ---
function ShopCard({ shop, onClick, userLat }: { shop: ShopResult; onClick: () => void; userLat: number | null }) {
  const etaMin = shop.distance_km > 0 ? Math.round(shop.distance_km * 3 + 5) : null
  return (
    <div onClick={onClick} style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, marginBottom: 10, cursor: "pointer", overflow: "hidden",
      opacity: shop.is_open ? 1 : 0.6,
    }}>
      {/* Ảnh bìa + Logo wrapper */}
      <div style={{ position: "relative" }}>
        {/* Ảnh bìa — tỷ lệ 2:1 */}
        <div style={{ position: "relative", width: "100%", paddingTop: "50%", background: "rgba(30,20,10,1)", overflow: "hidden" }}>
          {shop.cover_image_url
            ? <img src={shop.cover_image_url} alt={shop.name}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ position: "absolute", inset: 0,
                background: "linear-gradient(135deg,rgba(255,107,0,0.15),rgba(255,107,0,0.04))",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>🏪</div>
          }
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 48,
            background: "linear-gradient(to top,rgba(8,8,6,0.75),transparent)" }} />
          {!shop.is_open && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#b0956a", fontSize: 12, fontWeight: 700,
                background: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 6 }}>Đóng cửa</span>
            </div>
          )}
        </div>
        {/* Logo tròn — nằm ngoài overflow:hidden, đè lên đường viền ảnh/info */}
        <div style={{ position: "absolute", bottom: -18, left: 12, zIndex: 2,
          width: 52, height: 52, borderRadius: "50%", overflow: "hidden",
          border: "2.5px solid #080806", background: "rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
          {shop.logo_url
            ? <img src={shop.logo_url} alt={shop.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : "🏪"}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "24px 12px 12px 12px" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#f8f0e0", marginBottom: 6,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {shop.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#b0956a", flexWrap: "wrap" }}>
          <span>⭐ {shop.rating_avg.toFixed(1)}
            {shop.total_reviews > 0 && <span style={{ color: "#6a5a40" }}> ({shop.total_reviews})</span>}
          </span>
          {etaMin && <span>🕐 ~{etaMin} phút</span>}
          <span>{shop.delivery_fee === null
            ? <span style={{ color:"#6a5a40" }}>📍 Cần GPS</span>
            : shop.delivery_fee === 0
            ? <span style={{ color: "#3ecf6e" }}>🚚 Free ship</span>
            : `🛵 ${formatPrice(shop.delivery_fee)}`}
          </span>

        </div>
        {shop.promo && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#3ecf6e",
            background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.25)",
            borderRadius: 6, padding: "2px 8px", marginTop: 6, display: "inline-block",
          }}>🏷️ {shop.promo}</span>
        )}
      </div>
    </div>
  )
}

// --- Product Card ---
function ProductCard({ product, onClick }: { product: ProductResult; onClick: () => void }) {
  const discount = product.original_price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : 0
  return (
    <div onClick={onClick} style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, padding: "12px 14px", marginBottom: 10, cursor: "pointer",
      display: "flex", gap: 12, alignItems: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 12, flexShrink: 0,
        background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
        position: "relative", overflow: "hidden",
      }}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : "🍽️"}
        {discount > 0 && (
          <div style={{
            position: "absolute", top: -4, right: -4,
            background: "#ff4040", borderRadius: 6,
            fontSize: 11, fontWeight: 700, color: "#fff",
            padding: "2px 5px",
          }}>-{discount}%</div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 14, color: "#f8f0e0" }}>{product.name}</p>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6a5a40" }}>🏪 {product.shop_name}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            background: "linear-gradient(90deg,#FF6B00,#FFB347)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text", fontWeight: 700, fontSize: 14,
          } as React.CSSProperties}>
            {formatPrice(product.price)}
          </span>
          {product.original_price && (
            <span style={{ fontSize: 12, color: "#6a5a40", textDecoration: "line-through" }}>
              {formatPrice(product.original_price)}
            </span>
          )}
          <span style={{ fontSize: 11, color: "#6a5a40" }}>⭐ {product.rating} · {product.sold_count} bán</span>
        </div>
      </div>
    </div>
  )
}

// --- Filter Sheet ---
function FilterSheet({
  filter, onChange, onClose, onReset,
}: {
  filter: FilterState
  onChange: (f: FilterState) => void
  onClose: () => void
  onReset: () => void
}) {
  const [local, setLocal] = useState<FilterState>(filter)
  const update = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    setLocal(p => ({ ...p, [key]: val }))

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 190,
        background: "#0e0c09", borderRadius: "20px 20px 0 0",
        border: "1px solid rgba(255,107,0,0.2)", padding: "0 20px 32px",
        fontFamily: "'Lexend', sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f8f0e0" }}>Bộ lọc</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#6a5a40", fontSize: 20, cursor: "pointer" }}>×</button>
      </div>

      {/* Sort */}
      <p style={filterLabelStyle}>Sắp xếp</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {([
          { key: "relevant",   label: "Phù hợp nhất" },
          { key: "rating",     label: "Đánh giá cao" },
          { key: "distance",   label: "Gần nhất" },
          { key: "price_asc",  label: "Giá tăng dần" },
          { key: "price_desc", label: "Giá giảm dần" },
        ] as const).map(s => (
          <button
            key={s.key}
            onClick={() => update("sort", s.key)}
            style={{
              padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s",
              border: local.sort === s.key ? "1px solid rgba(255,107,0,0.4)" : "1px solid rgba(255,255,255,0.1)",
              background: local.sort === s.key ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
              color: local.sort === s.key ? "#FF8C00" : "#6a5a40",
              fontFamily: "'Lexend', sans-serif",
            }}
          >{s.label}</button>
        ))}
      </div>

      {/* Toggles */}
      <p style={filterLabelStyle}>Điều kiện</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        <FilterToggleRow label="Chỉ quán đang mở" value={local.only_open} onChange={v => update("only_open", v)} />
        <FilterToggleRow label="Đang có khuyến mãi" value={local.has_promo} onChange={v => update("has_promo", v)} />
      </div>

      {/* Min rating */}
      <p style={filterLabelStyle}>Đánh giá tối thiểu</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[null, 4, 4.5, 4.8].map(val => (
          <button
            key={String(val)}
            onClick={() => update("min_rating", val)}
            style={{
              flex: 1, height: 36, borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: "pointer",
              border: local.min_rating === val ? "1px solid rgba(255,107,0,0.4)" : "1px solid rgba(255,255,255,0.1)",
              background: local.min_rating === val ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
              color: local.min_rating === val ? "#FF8C00" : "#6a5a40",
              fontFamily: "'Lexend', sans-serif",
            }}
          >{val === null ? "Tất cả" : `⭐${val}+`}</button>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onReset}
          style={{
            flex: 1, height: 48, borderRadius: 14,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#b0956a", fontSize: 14, fontWeight: 600, cursor: "pointer",
            fontFamily: "'Lexend', sans-serif",
          }}
        >Đặt lại</button>
        <button
          onClick={() => { onChange(local); onClose() }}
          style={{
            flex: 2, height: 48, borderRadius: 14, border: "none",
            background: "linear-gradient(90deg,#FF6B00,#FFB347)",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            fontFamily: "'Lexend', sans-serif",
            boxShadow: "0 4px 16px rgba(255,107,0,0.3)",
          }}
        >Áp dụng</button>
      </div>
    </motion.div>
  )
}

const filterLabelStyle: React.CSSProperties = {
  fontSize: 11, color: "#6a5a40", fontWeight: 600, letterSpacing: 0.8,
  textTransform: "uppercase", marginBottom: 10,
}

function FilterToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 12px", background: "rgba(255,255,255,0.03)",
      borderRadius: 11, border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ fontSize: 14, color: "#f8f0e0" }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 26, borderRadius: 13, border: "none",
          background: value ? "#FF6B00" : "rgba(255,255,255,0.12)",
          cursor: "pointer", position: "relative", transition: "background 0.25s",
        }}
      >
        <motion.div
          animate={{ x: value ? 20 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{
            position: "absolute", top: 3, left: 0,
            width: 20, height: 20, borderRadius: "50%", background: "#fff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
        />
      </button>
    </div>
  )
}
