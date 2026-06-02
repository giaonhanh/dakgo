"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

interface Shop {
  id:       string
  name:     string
  category: string
  address:  string
  isOpen:   boolean
  rating:   number
  imageUrl: string | null
  logoUrl:  string | null
  status:   string
}

function catEmoji(cat: string): string {
  const c = cat.toLowerCase()
  if (c.includes("bún") || c.includes("phở")) return "🍜"
  if (c.includes("gà")) return "🍗"
  if (c.includes("cơm")) return "🍱"
  if (c.includes("cà phê") || c.includes("cafe")) return "☕"
  if (c.includes("trà sữa") || c.includes("trà")) return "🧋"
  if (c.includes("bánh")) return "🥐"
  if (c.includes("pizza")) return "🍕"
  if (c.includes("burger") || c.includes("fast food")) return "🍔"
  if (c.includes("kem")) return "🍦"
  if (c.includes("salad") || c.includes("chay")) return "🥗"
  if (c.includes("uống") || c.includes("nước")) return "🥤"
  if (c.includes("hải sản") || c.includes("tôm") || c.includes("cua")) return "🦐"
  if (c.includes("lẩu")) return "🫕"
  if (c.includes("nướng") || c.includes("bbq")) return "🔥"
  if (c.includes("cháo") || c.includes("súp")) return "🥣"
  if (c.includes("bánh mì")) return "🥖"
  if (c.includes("đồ ăn") || c.includes("ăn vặt")) return "🍢"
  return "🏪"
}

export default function NearbyShopsPage() {
  const router = useRouter()
  const [shops, setShops]           = useState<Shop[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeCategory, setActiveCategory] = useState("Tất cả")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: rows } = await supabase
        .from("shops")
        .select("id, name, category, address, is_open, rating_avg, cover_image_url, logo_url, status")
        .eq("status", "approved")
        .order("rating_avg", { ascending: false })
        .limit(60)

      if (!rows) { setLoading(false); return }

      setShops(rows.map(r => ({
        id:       r.id,
        name:     r.name,
        category: r.category ?? "",
        address:  r.address ?? "",
        isOpen:   r.is_open ?? false,
        rating:   r.rating_avg ?? 0,
        imageUrl: r.cover_image_url ?? null,
        logoUrl:  r.logo_url ?? null,
        status:   r.status,
      })))

      setLoading(false)
    }
    load()
  }, [])

  // Build category index from real data
  const categories = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of shops) {
      const cat = s.category.trim()
      if (cat) counts[cat] = (counts[cat] ?? 0) + 1
    }
    // Sort by count desc
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ cat, count, emoji: catEmoji(cat) }))
  }, [shops])

  const filtered = useMemo(() => {
    if (activeCategory === "Tất cả") return shops
    return shops.filter(s => s.category === activeCategory)
  }, [shops, activeCategory])

  const activeCount = activeCategory === "Tất cả" ? shops.length : filtered.length

  return (
    <div style={{ minHeight: "100dvh", background: "#080806", fontFamily: "'Lexend',sans-serif", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(8,8,6,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,107,0,0.15)", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
        <button type="button" onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8f0e0", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 700 }}>📍 Quán gần bạn</div>
          <div style={{ color: "#6a5a40", fontSize: 10 }}>
            {loading ? "Đang tải..." : `${shops.length} quán · ${categories.length} danh mục`}
          </div>
        </div>
        <button type="button" onClick={() => router.push("/search")} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8f0e0", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🔍</button>
      </div>

      {/* Category index */}
      {!loading && categories.length > 0 && (
        <div>
          {/* Section label */}
          <div style={{ padding: "10px 16px 6px", color: "#6a5a40", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Mục lục danh mục</div>

          {/* Horizontal scroll chips */}
          <div style={{ display: "flex", gap: 7, padding: "0 16px 10px", overflowX: "auto", scrollbarWidth: "none" }}>
            {/* Tất cả chip */}
            {(() => {
              const on = activeCategory === "Tất cả"
              return (
                <button
                  key="all"
                  type="button"
                  onClick={() => setActiveCategory("Tất cả")}
                  style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 20, background: on ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)", border: on ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: on ? "#FF8C00" : "#6a5a40", fontSize: 10, fontWeight: on ? 700 : 400, cursor: "pointer", fontFamily: "Lexend" }}
                >
                  <span style={{ fontSize: 13 }}>🗂️</span>
                  <span>Tất cả</span>
                  <span style={{ background: on ? "rgba(255,107,0,0.2)" : "rgba(255,255,255,0.08)", borderRadius: 10, padding: "1px 5px", fontSize: 9 }}>{shops.length}</span>
                </button>
              )
            })()}

            {/* Category chips */}
            {categories.map(({ cat, count, emoji }) => {
              const on = activeCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 20, background: on ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)", border: on ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: on ? "#FF8C00" : "#6a5a40", fontSize: 10, fontWeight: on ? 700 : 400, cursor: "pointer", fontFamily: "Lexend" }}
                >
                  <span style={{ fontSize: 13 }}>{emoji}</span>
                  <span>{cat}</span>
                  <span style={{ background: on ? "rgba(255,107,0,0.2)" : "rgba(255,255,255,0.08)", borderRadius: 10, padding: "1px 5px", fontSize: 9 }}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Divider + count */}
          <div style={{ margin: "0 16px 8px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ color: "#6a5a40", fontSize: 11 }}>
              {activeCount} quán{activeCategory !== "Tất cả" ? ` · ${activeCategory}` : ""}
            </div>
            {activeCategory !== "Tất cả" && (
              <button type="button" onClick={() => setActiveCategory("Tất cả")} style={{ background: "none", border: "none", color: "#FF8C00", fontSize: 10, cursor: "pointer", fontFamily: "Lexend" }}>
                Xem tất cả ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "11px 12px", display: "flex", gap: 11, alignItems: "center" }}>
                <div style={{ width: 58, height: 58, borderRadius: 14, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.06)", width: "60%" }} />
                  <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.04)", width: "40%" }} />
                </div>
              </div>
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏚️</div>
            <div style={{ color: "#6a5a40", fontSize: 12 }}>Không có quán nào trong danh mục này</div>
          </div>
        ) : filtered.map((s, idx) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.2) }}>
            <a href={`/shop/${s.id}`} style={{ textDecoration: "none" }}>
              <div style={{ background: s.isOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "11px 12px", display: "flex", alignItems: "center", gap: 11, opacity: s.isOpen ? 1 : 0.65 }}>

                {/* Logo / emoji */}
                <div style={{ width: 58, height: 58, borderRadius: 14, flexShrink: 0, background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, position: "relative", overflow: "hidden" }}>
                  {s.logoUrl
                    ? <img src={s.logoUrl} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span>{catEmoji(s.category)}</span>
                  }
                  {!s.isOpen && (
                    <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "rgba(8,8,6,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#ff6060", fontSize: 9, fontWeight: 800, background: "rgba(255,64,64,0.18)", padding: "2px 6px", borderRadius: 5, border: "1px solid rgba(255,64,64,0.3)" }}>Đóng</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
                    <div style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>{s.name}</div>
                    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 3, background: s.isOpen ? "rgba(62,207,110,0.12)" : "rgba(255,64,64,0.1)", border: `1px solid ${s.isOpen ? "rgba(62,207,110,0.3)" : "rgba(255,64,64,0.25)"}`, borderRadius: 5, padding: "1px 6px" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.isOpen ? "#3ecf6e" : "#ff6060", boxShadow: s.isOpen ? "0 0 4px #3ecf6e" : "none" }} />
                      <span style={{ color: s.isOpen ? "#3ecf6e" : "#ff6060", fontSize: 9, fontWeight: 700 }}>{s.isOpen ? "Mở" : "Đóng"}</span>
                    </div>
                  </div>

                  <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.address}</div>

                  <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                    <span style={{ background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)", color: "#FF8C00", fontSize: 9, borderRadius: 5, padding: "2px 6px" }}>
                      {catEmoji(s.category)} {s.category}
                    </span>
                  </div>

                  {s.rating > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                      <span style={{ color: "#FFB347", fontSize: 11 }}>★ {s.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Right arrow */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#FF6B00,#FF8C00)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, boxShadow: "0 2px 8px rgba(255,107,0,0.35)" }}>›</div>
                </div>

              </div>
            </a>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
