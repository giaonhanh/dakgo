"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

const PROMO_ITEMS = [
  { id:8,  emoji:"☕", name:"Cà phê sữa đá",   shop:"Cà Phê PA",      shopId:"ca-phe-pa",      price:15000, oldPrice:22000, disc:32, star:4.6, km:0.4, eta: 8, cat:"drink" },
  { id:2,  emoji:"🥤", name:"Trà sữa size L",  shop:"Ding Tea",       shopId:"ding-tea",       price:28000, oldPrice:35000, disc:20, star:4.8, km:0.5, eta:10, cat:"drink" },
  { id:4,  emoji:"🍗", name:"Gà rán giòn",     shop:"Gà Vàng PA",     shopId:"ga-vang-pa",     price:28000, oldPrice:40000, disc:30, star:4.6, km:0.6, eta:15, cat:"food"  },
  { id:1,  emoji:"🍜", name:"Bún bò Huế",      shop:"Quán Bà Lan",    shopId:"quan-ba-lan",    price:34000, oldPrice:45000, disc:25, star:4.9, km:0.8, eta:20, cat:"food"  },
  { id:7,  emoji:"🧋", name:"Trà đào cam sả",  shop:"Ding Tea",       shopId:"ding-tea",       price:22000, oldPrice:30000, disc:27, star:4.8, km:0.5, eta:10, cat:"drink" },
  { id:3,  emoji:"🍱", name:"Cơm văn phòng",   shop:"Cơm Nhà Bếp",    shopId:"com-nha-bep",    price:38000, oldPrice:45000, disc:15, star:4.7, km:1.2, eta:25, cat:"food"  },
  { id:5,  emoji:"🍔", name:"Burger phô mai",  shop:"Burger House",   shopId:"burger-house",   price:45000, oldPrice:55000, disc:18, star:4.5, km:2.1, eta:30, cat:"food"  },
  { id:6,  emoji:"🍕", name:"Pizza mini 4 vị", shop:"Pizza House PA", shopId:"pizza-house-pa", price:45000, oldPrice:65000, disc:31, star:4.4, km:3.0, eta:40, cat:"food"  },
]

const FILTERS = ["Tất cả", "Giảm nhiều nhất", "Gần nhất", "Đồ ăn", "Đồ uống"]

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function PromoItemsPage() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState("Tất cả")

  const displayed = (() => {
    let list = [...PROMO_ITEMS]
    if (activeFilter === "Giảm nhiều nhất") return list.sort((a, b) => b.disc - a.disc)
    if (activeFilter === "Gần nhất")        return list.sort((a, b) => a.km - b.km)
    if (activeFilter === "Đồ ăn")           return list.filter(p => p.cat === "food").sort((a, b) => a.km - b.km)
    if (activeFilter === "Đồ uống")         return list.filter(p => p.cat === "drink").sort((a, b) => a.km - b.km)
    return list.sort((a, b) => a.km - b.km) // Tất cả — gần nhất trước
  })()

  return (
    <div style={{
      minHeight:"100dvh", background:"#080806",
      fontFamily:"'Lexend',sans-serif",
      paddingTop:"env(safe-area-inset-top, 0px)",
      paddingBottom:"calc(24px + env(safe-area-inset-bottom, 0px))",
    }}>
      {/* Header */}
      <div style={{
        position:"sticky", top:0, zIndex:20,
        background:"rgba(8,8,6,0.95)", backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(255,107,0,0.15)",
        display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
      }}>
        <button type="button" onClick={() => router.back()} style={{
          width:34, height:34, borderRadius:10,
          background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
          color:"#f8f0e0", fontSize:16, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>←</button>
        <div>
          <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>🔥 Khuyến mãi hôm nay</div>
          <div style={{ color:"#6a5a40", fontSize:11 }}>{displayed.length} món đang giảm giá</div>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display:"flex", gap:7, padding:"10px 16px",
        overflowX:"auto", scrollbarWidth:"none" }}>
        {FILTERS.map(f => {
          const on = activeFilter === f
          return (
            <button key={f} type="button" onClick={() => setActiveFilter(f)} style={{
              flexShrink:0, padding:"5px 13px", borderRadius:20,
              background: on ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)",
              border: on ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)",
              color: on ? "#FF8C00" : "#6a5a40",
              fontSize:11, fontWeight: on ? 600 : 400, cursor:"pointer",
              fontFamily:"Lexend",
            }}>{f}</button>
          )
        })}
      </div>

      {/* List */}
      <div style={{ padding:"4px 16px 0", display:"flex", flexDirection:"column", gap:10 }}>
        {displayed.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🍽️</div>
            <div style={{ color:"#6a5a40", fontSize:12 }}>Không tìm thấy món phù hợp</div>
          </div>
        ) : displayed.map((p, idx) => (
          <motion.div
            key={p.id}
            initial={{ opacity:0, y:12 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay: Math.min(idx * 0.025, 0.15) }}
            style={{
              background:"rgba(255,255,255,0.05)",
              border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:16, overflow:"hidden", cursor:"pointer",
              display:"flex",
            }}
            onClick={() => router.push(`/shop/${p.shopId}`)}
          >
            {/* Emoji image area */}
            <div style={{
              width:80, flexShrink:0,
              background:"rgba(255,107,0,0.04)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:36, position:"relative",
            }}>
              {p.emoji}
              <div style={{
                position:"absolute", top:6, left:6,
                background:"#ff4040", color:"#fff",
                fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:5,
              }}>-{p.disc}%</div>
            </div>
            {/* Info */}
            <div style={{ flex:1, padding:"11px 12px" }}>
              <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:600 }}>{p.name}</div>
              <div style={{ color:"#6a5a40", fontSize:11, marginTop:2 }}>{p.shop}</div>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                <span style={{ color:"#FFB347", fontSize:11 }}>★ {p.star}</span>
                <span style={{ color:"#4a5040" }}>·</span>
                <span style={{ color:"#b0956a", fontSize:11 }}>📍 {p.km}km</span>
                <span style={{ color:"#4a5040" }}>·</span>
                <span style={{ color:"#b0956a", fontSize:11 }}>⏱ {p.eta} phút</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                <span style={{
                  background:"linear-gradient(135deg,#FF6B00,#FFB347)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                  backgroundClip:"text", fontSize:15, fontWeight:700,
                }}>{fmt(p.price)}</span>
                <span style={{ color:"rgba(255,255,255,0.25)", fontSize:11,
                  textDecoration:"line-through" }}>{fmt(p.oldPrice)}</span>
              </div>
            </div>
            {/* CTA */}
            <div style={{
              display:"flex", alignItems:"center", justifyContent:"center",
              padding:"0 14px", flexShrink:0,
            }}>
              <div style={{
                width:44, height:44, borderRadius:10,
                background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"#fff", fontSize:22, fontWeight:700,
                boxShadow:"0 4px 12px rgba(255,107,0,0.4)",
              }}>+</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
