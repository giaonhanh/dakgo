"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

interface Shop {
  id:         string
  name:       string
  category:   string
  address:    string
  isOpen:     boolean
  rating:     number
  logoUrl:    string | null
  lat:        number | null
  lng:        number | null
  distanceKm: number | null
}

interface ProductItem { name: string; price: number }
// shopId → catKey → ProductItem[]
type ProdMap = Record<string, Record<string, ProductItem[]>>

type GeoJSONPoint = { type: string; coordinates: number[] }

function extractCoords(loc: unknown): { lat: number; lng: number } | null {
  if (!loc || typeof loc !== "object") return null
  const geo = loc as Partial<GeoJSONPoint>
  if (!Array.isArray(geo.coordinates) || geo.coordinates.length < 2) return null
  const [lng, lat] = geo.coordinates
  if (typeof lng !== "number" || typeof lat !== "number") return null
  return { lat, lng }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`
}

function catEmoji(cat: string): string {
  const c = cat.toLowerCase()
  if (c.includes("bún") || c.includes("phở")) return "🍜"
  if (c.includes("gà")) return "🍗"
  if (c.includes("cơm")) return "🍱"
  if (c.includes("cà phê") || c.includes("cafe")) return "☕"
  if (c.includes("trà sữa") || c.includes("trà")) return "🧋"
  if (c.includes("bánh mì")) return "🥖"
  if (c.includes("bánh")) return "🥐"
  if (c.includes("pizza")) return "🍕"
  if (c.includes("burger") || c.includes("fast food")) return "🍔"
  if (c.includes("kem")) return "🍦"
  if (c.includes("chay")) return "🥗"
  if (c.includes("uống") || c.includes("nước")) return "🥤"
  if (c.includes("hải sản") || c.includes("tôm") || c.includes("cua")) return "🦐"
  if (c.includes("lẩu")) return "🫕"
  if (c.includes("nướng") || c.includes("bbq")) return "🔥"
  if (c.includes("cháo")) return "🥣"
  if (c.includes("xôi")) return "🍚"
  if (c.includes("chè")) return "🍮"
  if (c.includes("nhậu") || c.includes("bia")) return "🍺"
  return "🏪"
}

const TABS = [
  { key: "all",   label: "Tất cả",     emoji: "🗂️", catKeys: [] },
  { key: "sang",  label: "Buổi sáng",  emoji: "🌅", catKeys: ["buổi sáng", "sáng"] },
  { key: "trua",  label: "Buổi trưa",  emoji: "☀️", catKeys: ["buổi trưa", "trưa"] },
  { key: "toi",   label: "Buổi tối",   emoji: "🌙", catKeys: ["buổi tối", "tối"] },
  { key: "nuoc",  label: "Đồ uống",    emoji: "🥤", catKeys: ["nước uống", "đồ uống", "uống"] },
  { key: "nhau",  label: "Món nhậu",   emoji: "🍺", catKeys: ["món nhậu", "nhậu"] },
  { key: "anvat", label: "Ăn vặt",     emoji: "🍢", catKeys: ["ăn vặt", "vặt"] },
]

function getCatKey(category: string): string | null {
  const c = category.toLowerCase().trim()
  for (const tab of TABS) {
    if (tab.catKeys.length > 0 && tab.catKeys.some(k => c.includes(k))) return tab.key
  }
  return null
}

function shopMatchesTab(shopId: string, tabKey: string, tabCatKeys: string[], prodMap: ProdMap): boolean {
  if (tabCatKeys.length === 0) return true
  const shopProds = prodMap[shopId]
  if (!shopProds) return false
  return !!shopProds[tabKey]?.length
}

export default function NearbyShopsPage() {
  const router = useRouter()
  const [shops, setShops]     = useState<Shop[]>([])
  const [prodMap, setProdMap] = useState<ProdMap>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    const supabase = createClient()

    Promise.all([
      supabase
        .from("shops")
        .select("id, name, category, address, is_open, rating_avg, logo_url, status, location")
        .eq("status", "approved")
        .order("rating_avg", { ascending: false })
        .limit(60),
      supabase
        .from("products")
        .select("shop_id, category, name, price")
        .eq("is_available", true)
        .not("category", "is", null),
    ]).then(([shopsRes, prodsRes]) => {

      // Build prodMap: shopId → { tabKey → ProductItem[] }
      const map: ProdMap = {}
      for (const row of prodsRes.data ?? []) {
        if (!row.shop_id || !row.category || !row.name) continue
        const tabKey = getCatKey(row.category)
        if (!tabKey) continue
        if (!map[row.shop_id]) map[row.shop_id] = {}
        if (!map[row.shop_id][tabKey]) map[row.shop_id][tabKey] = []
        if (map[row.shop_id][tabKey].length < 4) {
          map[row.shop_id][tabKey].push({ name: row.name, price: row.price ?? 0 })
        }
      }
      setProdMap(map)

      const mapped: Shop[] = (shopsRes.data ?? []).map(r => {
        const coords = extractCoords(r.location)
        return {
          id:         r.id,
          name:       r.name,
          category:   r.category ?? "",
          address:    r.address ?? "",
          isOpen:     r.is_open ?? false,
          rating:     r.rating_avg ?? 0,
          logoUrl:    r.logo_url ?? null,
          lat:        coords?.lat ?? null,
          lng:        coords?.lng ?? null,
          distanceKm: null,
        }
      })
      setShops(mapped)
      setLoading(false)

      // Geolocation — chạy sau để không chặn render
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const { latitude: uLat, longitude: uLng } = pos.coords
            setShops(prev =>
              [...prev]
                .map(s => ({
                  ...s,
                  distanceKm: s.lat !== null && s.lng !== null
                    ? haversineKm(uLat, uLng, s.lat, s.lng) : null,
                }))
                .sort((a, b) => {
                  if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm
                  if (a.distanceKm !== null) return -1
                  if (b.distanceKm !== null) return 1
                  return b.rating - a.rating
                })
            )
          },
          () => {},
          { timeout: 8000, maximumAge: 60000 }
        )
      }
    })
  }, [])

  const currentTab = TABS.find(t => t.key === activeTab) ?? TABS[0]

  const filtered = useMemo(
    () => shops.filter(s => shopMatchesTab(s.id, currentTab.key, currentTab.catKeys, prodMap)),
    [shops, currentTab, prodMap]
  )

  const tabCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const tab of TABS) {
      m[tab.key] = shops.filter(s => shopMatchesTab(s.id, tab.key, tab.catKeys, prodMap)).length
    }
    return m
  }, [shops, prodMap])

  return (
    <div style={{ minHeight: "100dvh", background: "#080806", fontFamily: "'Lexend',sans-serif", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>

      {/* Sticky header + tabs */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(8,8,6,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,107,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 8px" }}>
          <button type="button" onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8f0e0", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 700 }}>📍 Quán gần bạn</div>
            <div style={{ color: "#6a5a40", fontSize: 10 }}>
              {loading ? "Đang tải..." : `${filtered.length} quán · ${currentTab.label}`}
            </div>
          </div>
          <button type="button" onClick={() => router.push("/search")} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8f0e0", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🔍</button>
        </div>

        {/* Tab chips */}
        <div style={{ display: "flex", gap: 7, padding: "0 16px 10px", overflowX: "auto", scrollbarWidth: "none" }}>
          {TABS.map(tab => {
            const on = activeTab === tab.key
            const count = tabCounts[tab.key] ?? 0
            return (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 20,
                  background: on ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)",
                  border: on ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)",
                  color: on ? "#FF8C00" : "#6a5a40", fontSize: 10, fontWeight: on ? 700 : 400,
                  cursor: "pointer", fontFamily: "Lexend", transition: "all 0.15s" }}>
                <span style={{ fontSize: 13 }}>{tab.emoji}</span>
                <span>{tab.label}</span>
                {!loading && (
                  <span style={{ background: on ? "rgba(255,107,0,0.2)" : "rgba(255,255,255,0.08)", borderRadius: 10, padding: "1px 5px", fontSize: 11 }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Shop list */}
      <div style={{ padding: "10px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "11px 12px", display: "flex", gap: 11, alignItems: "center" }}>
                <div style={{ width: 58, height: 58, borderRadius: 14, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.06)", width: "60%" }} />
                  <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.04)", width: "80%" }} />
                </div>
              </div>
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>{currentTab.emoji}</div>
            <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Chưa có quán nào</div>
            <div style={{ color: "#6a5a40", fontSize: 11 }}>Không tìm thấy quán có món "{currentTab.label}"</div>
          </div>
        ) : filtered.map((s, idx) => {
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.2) }}>
              <a href={`/shop/${s.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: s.isOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "11px 12px", opacity: s.isOpen ? 1 : 0.65 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 0 }}>

                    {/* Logo */}
                    <div style={{ width: 54, height: 54, borderRadius: 13, flexShrink: 0, background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, position: "relative", overflow: "hidden" }}>
                      {s.logoUrl
                        ? <img src={s.logoUrl} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span>{catEmoji(s.category)}</span>
                      }
                      {!s.isOpen && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(8,8,6,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: "#ff6060", fontSize: 11, fontWeight: 800, background: "rgba(255,64,64,0.18)", padding: "2px 5px", borderRadius: 4, border: "1px solid rgba(255,64,64,0.3)" }}>Đóng</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <div style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>{s.name}</div>
                        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 3, background: s.isOpen ? "rgba(62,207,110,0.12)" : "rgba(255,64,64,0.1)", border: `1px solid ${s.isOpen ? "rgba(62,207,110,0.3)" : "rgba(255,64,64,0.25)"}`, borderRadius: 5, padding: "1px 6px" }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.isOpen ? "#3ecf6e" : "#ff6060", boxShadow: s.isOpen ? "0 0 4px #3ecf6e" : "none" }} />
                          <span style={{ color: s.isOpen ? "#3ecf6e" : "#ff6060", fontSize: 11, fontWeight: 700 }}>{s.isOpen ? "Mở" : "Đóng"}</span>
                        </div>
                      </div>

                      <div style={{ color: "#6a5a40", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{s.address}</div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {s.rating > 0 && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(255,179,71,0.1)", border: "1px solid rgba(255,179,71,0.2)", borderRadius: 6, padding: "2px 7px" }}>
                            <span style={{ color: "#FFB347", fontSize: 10 }}>★</span>
                            <span style={{ color: "#FFB347", fontSize: 10, fontWeight: 700 }}>{s.rating.toFixed(1)}</span>
                          </span>
                        )}
                        {s.distanceKm !== null && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(74,143,245,0.08)", border: "1px solid rgba(74,143,245,0.2)", borderRadius: 6, padding: "2px 7px" }}>
                            <span style={{ fontSize: 11 }}>📍</span>
                            <span style={{ color: "#4a8ff5", fontSize: 10, fontWeight: 600 }}>{formatDist(s.distanceKm)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#FF6B00,#FF8C00)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, boxShadow: "0 2px 8px rgba(255,107,0,0.35)" }}>›</div>
                    </div>
                  </div>
                </div>
              </a>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
