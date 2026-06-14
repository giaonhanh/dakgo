"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { SHOP_CATEGORIES, getCategoryByValue, normalizeCategoryValue } from "@/lib/categories"
import { useCartStore } from "@/store/cartStore"
import { useLocationStore } from "@/store/locationStore"
import Badge from "@/components/ui/Badge"

type DayHoursEntry = { day: string; open: boolean; slots: { from: string; to: string }[] }

interface Shop {
  id: string; name: string; address: string
  isOpen: boolean; rating: number
  logoUrl: string | null
  lat: number | null; lng: number | null
  distanceKm: number | null
  category: string; categories: string[]
}

function checkOpeningHours(oh: unknown, fallback = true): boolean {
  if (!oh) return fallback
  const now = new Date()
  const vnMin = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes()
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0) }
  const inSlot = (f: string, t: string) => { const o = toMin(f), c = toMin(t); return c > o ? vnMin >= o && vnMin < c : vnMin >= o || vnMin < c }
  if (Array.isArray(oh)) {
    const dayNames = ["Chủ nhật","Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"]
    const today = dayNames[new Date(now.getTime() + 7 * 3600000).getUTCDay()]
    const entry = (oh as DayHoursEntry[]).find(d => d.day === today)
    if (!entry?.open || !entry.slots.length) return false
    return entry.slots.some(s => inSlot(s.from, s.to))
  }
  const old = oh as { open?: string; close?: string }
  if (!old.open || !old.close) return fallback
  return inSlot(old.open, old.close)
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`
}

export default function NearbyShopsPage() {
  const router   = useRouter()
  const { items } = useCartStore()
  const totalQty  = items.reduce((s, i) => s + i.qty, 0)
  const { lat: userLat, lng: userLng } = useLocationStore()

  const [shops,     setShops]     = useState<Shop[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [sortBy,    setSortBy]    = useState<"distance" | "rating" | "open">("open")

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("shops")
      .select("id, name, address, is_open, opening_hours, rating_avg, logo_url, lat, lng, category, categories")
      .eq("status", "approved")
      .order("rating_avg", { ascending: false })
      .limit(80)
      .then(({ data }) => {
        const mapped: Shop[] = (data ?? []).map(r => {
          const rawCats: string[] = Array.isArray(r.categories) && r.categories.length > 0 ? r.categories : r.category ? [r.category] : []
          const dbOpen = r.is_open ?? false
          const isOpen = dbOpen && checkOpeningHours(r.opening_hours, true)
          return {
            id: r.id, name: r.name, address: r.address ?? "",
            isOpen,
            rating: r.rating_avg ?? 0,
            logoUrl: r.logo_url ?? null,
            lat: (r as { lat?: number | null }).lat ?? null,
            lng: (r as { lng?: number | null }).lng ?? null,
            distanceKm: null,
            category: normalizeCategoryValue(r.category ?? "khac"),
            categories: rawCats.map((v: string) => normalizeCategoryValue(v)),
          }
        })
        setShops(mapped)
        setLoading(false)
      })
  }, [])

  // Danh mục có quán
  const usedCats = useMemo(() => {
    const set = new Set<string>()
    shops.forEach(s => s.categories.forEach(v => { if (v !== "khac") set.add(v) }))
    return SHOP_CATEGORIES.filter(c => set.has(c.value))
  }, [shops])

  const getDist = (s: Shop) => {
    if (!userLat || !userLng || !s.lat || !s.lng) return null
    return haversineKm(userLat, userLng, s.lat, s.lng)
  }

  const filtered = useMemo(() => {
    const byTab = activeTab === "all"
      ? shops
      : shops.filter(s => (s.categories as string[]).includes(activeTab))

    return [...byTab].sort((a, b) => {
      if (sortBy === "open") {
        if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1
        const dA = getDist(a), dB = getDist(b)
        if (dA !== null && dB !== null) return dA - dB
        return b.rating - a.rating
      }
      if (sortBy === "rating") return b.rating - a.rating
      if (sortBy === "distance") {
        const dA = getDist(a) ?? 9999
        const dB = getDist(b) ?? 9999
        return dA - dB
      }
      return b.rating - a.rating
    })
  }, [shops, activeTab, sortBy, userLat, userLng]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeCat = activeTab !== "all" ? getCategoryByValue(activeTab) : null

  return (
    <div style={{ minHeight:"100dvh", background:"#080806", fontFamily:"'Lexend',sans-serif",
      paddingBottom:"calc(80px + env(safe-area-inset-bottom,0px))" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}`}</style>

      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:20,
        background:"rgba(8,8,6,0.97)", backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(255,107,0,0.15)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12,
          padding:"calc(env(safe-area-inset-top,0px) + 12px) 16px 8px" }}>
          <button onClick={() => router.back()}
            style={{ width:36, height:36, borderRadius:10,
              background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
              color:"#f8f0e0", fontSize:16, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center" }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>📍 Quán gần bạn</div>
            <div style={{ color:"#6a5a40", fontSize:10 }}>
              {loading ? "Đang tải..." : `${filtered.length} quán${activeCat ? ` · ${activeCat.label}` : ""}`}
            </div>
          </div>
          <button onClick={() => router.push("/search")}
            style={{ width:36, height:36, borderRadius:10,
              background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
              color:"#f8f0e0", fontSize:16, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center" }}>🔍</button>
        </div>

        {/* Category tabs */}
        <div style={{ display:"flex", gap:6, padding:"0 16px 8px", overflowX:"auto", scrollbarWidth:"none" }}>
          <button onClick={() => setActiveTab("all")}
            style={{ flexShrink:0, padding:"5px 12px", borderRadius:20, cursor:"pointer",
              fontFamily:"Lexend", fontSize:10, fontWeight:600,
              background: activeTab==="all" ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)",
              border: activeTab==="all" ? "1px solid rgba(255,107,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: activeTab==="all" ? "#FF8C00" : "#6a5a40", transition:"all .15s" }}>
            Tất cả · {shops.length}
          </button>
          {usedCats.map(cat => {
            const active = activeTab === cat.value
            const count = shops.filter(s => (s.categories as string[]).includes(cat.value)).length
            return (
              <button key={cat.value} onClick={() => setActiveTab(active ? "all" : cat.value)}
                style={{ flexShrink:0, padding:"5px 12px", borderRadius:20, cursor:"pointer",
                  fontFamily:"Lexend", fontSize:10, fontWeight:600,
                  background: active ? cat.color : "rgba(255,255,255,0.05)",
                  border: active ? `1px solid ${cat.color.replace(/[\d.]+\)$/, "0.5)")}` : "1px solid rgba(255,255,255,0.08)",
                  color: active ? "#f8f0e0" : "#6a5a40", transition:"all .15s",
                  display:"flex", alignItems:"center", gap:4 }}>
                {cat.emoji} {cat.label.split(" · ")[0]} · {count}
              </button>
            )
          })}
        </div>

        {/* Sort row */}
        <div style={{ display:"flex", gap:6, padding:"0 16px 10px" }}>
          {([
            { key:"open",     label:"🟢 Đang mở trước" },
            { key:"rating",   label:"⭐ Đánh giá cao"  },
            { key:"distance", label:"📍 Gần nhất"      },
          ] as const).map(opt => (
            <button key={opt.key} onClick={() => setSortBy(opt.key)}
              style={{ padding:"4px 10px", borderRadius:14, cursor:"pointer",
                fontFamily:"Lexend", fontSize:9, fontWeight:600,
                background: sortBy===opt.key ? "rgba(255,107,0,0.12)" : "transparent",
                border: sortBy===opt.key ? "1px solid rgba(255,107,0,0.3)" : "1px solid rgba(255,255,255,0.06)",
                color: sortBy===opt.key ? "#FF8C00" : "#6a5a40", transition:"all .15s" }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shop list */}
      <div style={{ padding:"10px 16px 0", display:"flex", flexDirection:"column", gap:10 }}>
        {loading ? (
          [0,1,2,3].map(i => (
            <div key={i} style={{ height:80, borderRadius:16,
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)" }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:40, marginBottom:10 }}>{activeCat?.emoji ?? "🏪"}</div>
            <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:600, marginBottom:4 }}>Chưa có quán nào</div>
            <div style={{ color:"#6a5a40", fontSize:11 }}>
              {activeTab !== "all" ? `Không có quán "${activeCat?.label}" trong khu vực` : "Chưa có quán nào được duyệt"}
            </div>
          </div>
        ) : filtered.map((s, idx) => {
          const cat = getCategoryByValue(s.category)
          return (
            <motion.div key={s.id}
              initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: Math.min(idx * 0.035, 0.25) }}>
              <a href={s.isOpen ? `/shop/${s.id}` : "#"}
                onClick={e => !s.isOpen && e.preventDefault()}
                style={{ textDecoration:"none" }}>
                <div style={{
                  background: s.isOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                  border:"1px solid rgba(255,255,255,0.08)", borderRadius:16,
                  padding:"6px 10px", opacity: s.isOpen ? 1 : 0.6,
                  display:"flex", alignItems:"center", gap:12,
                }}>
                  {/* Logo */}
                  <div style={{ width:70, height:70, borderRadius:"50%", flexShrink:0,
                    background: cat.color, border:"1px solid rgba(255,255,255,0.08)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:30, position:"relative", overflow:"hidden" }}>
                    {s.logoUrl
                      ? <img src={s.logoUrl} alt={s.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : cat.emoji}
                    {!s.isOpen && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(8,8,6,0.65)",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <Badge layer={3} variant="closed" size="sm" label="Đóng" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                      <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", flex:1 }}>
                        {s.name}
                      </div>
                      <Badge layer={3} variant={s.isOpen ? "open" : "closed"} size="sm" label={s.isOpen ? "Mở" : "Đóng"} />
                    </div>
                    <div style={{ color:"#6a5a40", fontSize:10,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:4 }}>
                      {s.address}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      {s.rating > 0 && (
                        <Badge layer={2} variant="rating" size="sm" label={s.rating.toFixed(1)} />
                      )}
                      {getDist(s) !== null && (
                        <Badge layer={2} variant="distance" size="sm" label={formatDist(getDist(s)!)} />
                      )}
                      {/* Category tags */}
                      {s.categories.slice(0, 2).map(v => {
                        const c = getCategoryByValue(v)
                        return (
                          <span key={v} style={{ background: c.color, borderRadius:6,
                            padding:"2px 6px", color:"#f8f0e0", fontSize:9, fontWeight:600 }}>
                            {c.emoji} {c.label.split(" · ")[0]}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ color:"#6a5a40", fontSize:18, flexShrink:0 }}>›</div>
                </div>
              </a>
            </motion.div>
          )
        })}
      </div>

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:"max(16px,env(safe-area-inset-bottom))", left:14, right:14, height:56,
        background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
        border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999,
        display:"flex", alignItems:"center", justifyContent:"space-around",
        padding:"0 6px", zIndex:50, boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
        {[
          { icon:"🏠", label:"Trang chủ", href:"/" },
          { icon:"📋", label:"Đơn hàng",  href:"/orders" },
          { icon:"🛒", label:"Giỏ hàng",  href:"/cart", badge: totalQty },
          { icon:"⚙️", label:"Cài đặt",   href:"/settings" },
        ].map(tab => (
          <a key={tab.href} href={tab.href}
            style={{ textDecoration:"none", display:"flex", flexDirection:"column",
              alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18, position:"relative" }}>
            <span style={{ fontSize:19 }}>{tab.icon}</span>
            {"badge" in tab && tab.badge > 0 && (
              <div style={{ position:"absolute", top:1, right:6,
                width:14, height:14, borderRadius:99, background:"#ff4040", color:"#fff",
                fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {tab.badge > 9 ? "9+" : tab.badge}
              </div>
            )}
            <span style={{ fontSize:10, color:"#6a5a40" }}>{tab.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
