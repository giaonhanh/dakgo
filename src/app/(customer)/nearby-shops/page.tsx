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
  if (c.includes("salad") || c.includes("chay")) return "🥗"
  if (c.includes("uống") || c.includes("nước")) return "🥤"
  if (c.includes("hải sản") || c.includes("tôm") || c.includes("cua")) return "🦐"
  if (c.includes("lẩu")) return "🫕"
  if (c.includes("nướng") || c.includes("bbq")) return "🔥"
  if (c.includes("cháo") || c.includes("súp")) return "🥣"
  if (c.includes("xôi")) return "🍚"
  if (c.includes("chè")) return "🍮"
  if (c.includes("nhậu") || c.includes("bia")) return "🍺"
  return "🏪"
}

const TABS: { key: string; label: string; emoji: string; keywords: string[] }[] = [
  {
    key: "all",
    label: "Tất cả",
    emoji: "🗂️",
    keywords: [],
  },
  {
    key: "sang",
    label: "Buổi sáng",
    emoji: "🌅",
    keywords: ["bún", "phở", "cháo", "bánh mì", "xôi", "hủ tiếu", "bánh cuốn", "dimsum", "cà phê", "cafe", "bánh bột", "mì quảng", "bột"],
  },
  {
    key: "trua",
    label: "Buổi trưa",
    emoji: "☀️",
    keywords: ["cơm", "bún", "phở", "mì", "hủ tiếu", "bánh mì", "cơm hộp", "cơm tấm", "bình dân", "cơm văn phòng"],
  },
  {
    key: "toi",
    label: "Buổi tối",
    emoji: "🌙",
    keywords: ["lẩu", "nướng", "hải sản", "bbq", "nhậu", "bia", "tôm", "cua", "mực", "bạch tuộc", "cơm chiều"],
  },
  {
    key: "nuoc",
    label: "Nước uống",
    emoji: "🥤",
    keywords: ["nước", "uống", "cà phê", "cafe", "trà", "sinh tố", "ép", "cocktail", "đồ uống", "trà sữa", "milk tea", "smoothie", "juice"],
  },
  {
    key: "nhau",
    label: "Món nhậu",
    emoji: "🍺",
    keywords: ["nhậu", "nướng", "lẩu", "hải sản", "bia", "mồi", "bbq", "tôm", "cua", "mực", "chân gà", "gà", "đồ nhậu"],
  },
  {
    key: "anvat",
    label: "Ăn vặt",
    emoji: "🍢",
    keywords: ["ăn vặt", "vặt", "chè", "bánh", "kem", "snack", "chân gà", "xiên que", "bắp", "khoai", "đồ ngọt", "tráng miệng", "dessert"],
  },
]

function shopMatchesTab(shop: Shop, tab: typeof TABS[number]): boolean {
  if (tab.key === "all") return true
  const c = shop.category.toLowerCase()
  return tab.keywords.some(kw => c.includes(kw))
}

export default function NearbyShopsPage() {
  const router = useRouter()
  const [shops, setShops]     = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

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
      })))
      setLoading(false)
    }
    load()
  }, [])

  const currentTab = TABS.find(t => t.key === activeTab) ?? TABS[0]

  const filtered = useMemo(
    () => shops.filter(s => shopMatchesTab(s, currentTab)),
    [shops, currentTab]
  )

  // count per tab for display
  const tabCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tab of TABS) {
      map[tab.key] = shops.filter(s => shopMatchesTab(s, tab)).length
    }
    return map
  }, [shops])

  return (
    <div style={{ minHeight: "100dvh", background: "#080806", fontFamily: "'Lexend',sans-serif", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>

      {/* Header */}
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

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 7, padding: "0 16px 10px", overflowX: "auto", scrollbarWidth: "none" }}>
          {TABS.map(tab => {
            const on = activeTab === tab.key
            const count = tabCounts[tab.key] ?? 0
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 11px",
                  borderRadius: 20,
                  background: on ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)",
                  border: on ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)",
                  color: on ? "#FF8C00" : "#6a5a40",
                  fontSize: 10,
                  fontWeight: on ? 700 : 400,
                  cursor: "pointer",
                  fontFamily: "Lexend",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 13 }}>{tab.emoji}</span>
                <span>{tab.label}</span>
                {!loading && (
                  <span style={{ background: on ? "rgba(255,107,0,0.2)" : "rgba(255,255,255,0.08)", borderRadius: 10, padding: "1px 5px", fontSize: 9 }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "10px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
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
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>{currentTab.emoji}</div>
            <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Chưa có quán nào</div>
            <div style={{ color: "#6a5a40", fontSize: 11 }}>Không tìm thấy quán phù hợp với "{currentTab.label}"</div>
          </div>
        ) : filtered.map((s, idx) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.2) }}>
            <a href={`/shop/${s.id}`} style={{ textDecoration: "none" }}>
              <div style={{ background: s.isOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "11px 12px", display: "flex", alignItems: "center", gap: 11, opacity: s.isOpen ? 1 : 0.65 }}>

                {/* Logo */}
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
                    <div style={{ marginTop: 5 }}>
                      <span style={{ color: "#FFB347", fontSize: 11 }}>★ {s.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Arrow */}
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
