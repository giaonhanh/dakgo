"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

interface PromoProduct {
  id: string
  name: string
  shopId: string
  shopName: string
  price: number
  oldPrice: number
  disc: number
  imageUrl: string | null
  cat: string
}

const FILTERS = ["Tất cả", "Giảm nhiều nhất", "Gần nhất", "Đồ ăn", "Đồ uống"]
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

const CAT_DRINK = ["Đồ uống", "Cà phê", "Trà sữa", "Nước ép", "Sinh tố"]

export default function PromoItemsPage() {
  const router = useRouter()
  const [items, setItems] = useState<PromoProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState("Tất cả")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: rows } = await supabase
        .from("products")
        .select("id, name, price, original_price, image_url, category, shop_id, shops!shop_id(name, category)")
        .not("original_price", "is", null)
        .gt("original_price", 0)
        .eq("is_available", true)
        .order("sold_count", { ascending: false })
        .limit(30)

      if (!rows) { setLoading(false); return }

      setItems(rows.map(r => {
        const shop = r.shops as unknown as { name: string; category: string } | null
        const old = r.original_price as number
        const disc = old > r.price ? Math.round((1 - r.price / old) * 100) : 0
        return {
          id:       r.id,
          name:     r.name,
          shopId:   r.shop_id,
          shopName: shop?.name ?? "—",
          price:    r.price,
          oldPrice: old,
          disc,
          imageUrl: r.image_url ?? null,
          cat:      (r.category ?? shop?.category ?? "").toLowerCase(),
        }
      }).filter(p => p.disc > 0))

      setLoading(false)
    }
    load()
  }, [])

  const displayed = (() => {
    let list = [...items]
    if (activeFilter === "Giảm nhiều nhất") return list.sort((a, b) => b.disc - a.disc)
    if (activeFilter === "Đồ ăn")           return list.filter(p => !CAT_DRINK.some(c => p.cat.includes(c.toLowerCase())))
    if (activeFilter === "Đồ uống")         return list.filter(p => CAT_DRINK.some(c => p.cat.includes(c.toLowerCase())))
    return list
  })()

  return (
    <div style={{ minHeight: "100dvh", background: "#080806", fontFamily: "'Lexend',sans-serif", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(8,8,6,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,107,0,0.15)", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
        <button type="button" onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8f0e0", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div>
          <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 700 }}>🔥 Khuyến mãi hôm nay</div>
          <div style={{ color: "#6a5a40", fontSize: 11 }}>
            {loading ? "Đang tải..." : `${displayed.length} món đang giảm giá`}
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 7, padding: "10px 16px", overflowX: "auto", scrollbarWidth: "none" }}>
        {FILTERS.map(f => {
          const on = activeFilter === f
          return (
            <button key={f} type="button" onClick={() => setActiveFilter(f)} style={{ flexShrink: 0, padding: "5px 13px", borderRadius: 20, background: on ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)", border: on ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: on ? "#FF8C00" : "#6a5a40", fontSize: 11, fontWeight: on ? 600 : 400, cursor: "pointer", fontFamily: "Lexend" }}>{f}</button>
          )
        })}
      </div>

      {/* List */}
      <div style={{ padding: "4px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 12 }}>Đang tải khuyến mãi...</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div>
            <div style={{ color: "#6a5a40", fontSize: 12 }}>Hiện chưa có khuyến mãi nào</div>
          </div>
        ) : displayed.map((p, idx) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.025, 0.15) }}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden", cursor: "pointer", display: "flex" }}
            onClick={() => router.push(`/shop/${p.shopId}`)}>
            {/* Image area */}
            <div style={{ width: 80, flexShrink: 0, background: "rgba(255,107,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, position: "relative", overflow: "hidden" }}>
              {p.imageUrl
                ? <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span>🍽️</span>
              }
              <div style={{ position: "absolute", top: 6, left: 6, background: "#ff4040", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5 }}>-{p.disc}%</div>
            </div>
            {/* Info */}
            <div style={{ flex: 1, padding: "11px 12px" }}>
              <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 2 }}>{p.shopName}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ background: "linear-gradient(135deg,#FF6B00,#FFB347)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontSize: 15, fontWeight: 700 }}>{fmt(p.price)}</span>
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textDecoration: "line-through" }}>{fmt(p.oldPrice)}</span>
              </div>
            </div>
            {/* CTA */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 14px", flexShrink: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "linear-gradient(135deg,#FF6B00,#FF8C00)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 700, boxShadow: "0 4px 12px rgba(255,107,0,0.4)" }}>+</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
