"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import Badge from "@/components/ui/Badge"

interface BestProduct {
  rank:    number
  id:      string
  shopId:  string
  name:    string
  shopName: string
  price:   number
  sold:    number
  imageUrl: string | null
}

const RANK_ICON = ["🥇", "🥈", "🥉"]
const fmt       = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function BestsellersPage() {
  const router = useRouter()
  const [items, setItems] = useState<BestProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: rows } = await supabase
        .from("products")
        .select("id, name, price, sold_count, image_url, shop_id, shops!shop_id(name)")
        .eq("is_available", true)
        .gt("sold_count", 0)
        .order("sold_count", { ascending: false })
        .limit(10)

      if (!rows) { setLoading(false); return }

      setItems(rows.map((r, i) => {
        const shop = r.shops as unknown as { name: string } | null
        return {
          rank:     i + 1,
          id:       r.id,
          shopId:   r.shop_id,
          name:     r.name,
          shopName: shop?.name ?? "—",
          price:    r.price,
          sold:     r.sold_count ?? 0,
          imageUrl: r.image_url ?? null,
        }
      }))

      setLoading(false)
    }
    load()
  }, [])

  const maxSold = items[0]?.sold ?? 1

  return (
    <div style={{ minHeight: "100dvh", background: "#080806", fontFamily: "'Lexend',sans-serif", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(8,8,6,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,107,0,0.15)", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
        <button type="button" onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8f0e0", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div>
          <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 700 }}>🏆 Bán chạy tuần này</div>
          <div style={{ color: "#6a5a40", fontSize: 10 }}>Xếp hạng theo số lượng đã bán</div>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 12 }}>Đang tải...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
            <div style={{ color: "#6a5a40", fontSize: 12 }}>Chưa có dữ liệu bán hàng</div>
          </div>
        ) : items.map((b, idx) => (
          <motion.div key={b.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.15) }}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 13, cursor: "pointer" }}
            onClick={() => router.push(`/shop/${b.shopId}`)}>

            {/* Rank badge */}
            <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: b.rank <= 3 ? "rgba(255,215,0,0.12)" : "rgba(255,107,0,0.08)", border: b.rank <= 3 ? "1px solid rgba(255,215,0,0.3)" : "1px solid rgba(255,107,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: b.rank <= 3 ? 18 : 13, fontWeight: 800, color: b.rank===1?"#FFD700":b.rank===2?"#C0C0C0":b.rank===3?"#CD7F32":"#FF8C00" }}>
              {b.rank <= 3 ? RANK_ICON[b.rank - 1] : `#${b.rank}`}
            </div>

            {/* Image */}
            <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: "rgba(255,107,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, overflow: "hidden" }}>
              {b.imageUrl
                ? <img src={b.imageUrl} alt={b.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span>🍽️</span>
              }
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
              <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 2 }}>{b.shopName}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                <span style={{ background: "linear-gradient(135deg,#FF6B00,#FFB347)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontSize: 13, fontWeight: 700 }}>{fmt(b.price)}</span>
                <Badge layer={2} variant="sold-count" size="sm" label={`${b.sold.toLocaleString("vi-VN")} đã bán`} />
              </div>
            </div>

            {/* Bar */}
            <div style={{ width: 48, flexShrink: 0 }}>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: b.rank===1?"linear-gradient(90deg,#FFD700,#FFB347)":b.rank===2?"linear-gradient(90deg,#C0C0C0,#a0a0a0)":b.rank===3?"linear-gradient(90deg,#CD7F32,#a05a1a)":"linear-gradient(90deg,#FF6B00,#FF8C00)", width: `${Math.round(b.sold / maxSold * 100)}%`, transition: "width .6s ease" }} />
              </div>
              <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 3, textAlign: "right" }}>{Math.round(b.sold / maxSold * 100)}% max</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
