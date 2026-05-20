"use client"

import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

const BEST_SELLERS = [
  { rank:1,  shopId:"bun-bo-hue-ngon",  emoji:"🍜", name:"Bún bò đặc biệt",   shop:"Bún Bò Huế Ngon", price:45000, sold:890, km:0.8 },
  { rank:2,  shopId:"ding-tea",         emoji:"🥤", name:"Trà sữa trân châu", shop:"Ding Tea",        price:35000, sold:742, km:0.5 },
  { rank:3,  shopId:"ga-vang-pa",       emoji:"🍗", name:"Gà rán giòn cay",   shop:"Gà Vàng PA",      price:38000, sold:601, km:0.6 },
  { rank:4,  shopId:"bun-bo-hue-ngon",  emoji:"🦑", name:"Chả chiên giòn",    shop:"Bún Bò Huế Ngon", price:15000, sold:488, km:0.8 },
  { rank:5,  shopId:"burger-house",     emoji:"🍔", name:"Burger phô mai",    shop:"Burger House",    price:45000, sold:321, km:2.1 },
  { rank:6,  shopId:"com-nha-bep",      emoji:"🍱", name:"Cơm văn phòng",     shop:"Cơm Nhà Bếp",    price:35000, sold:298, km:1.2 },
  { rank:7,  shopId:"healthy-bowl",     emoji:"🥗", name:"Salad rau củ",      shop:"Healthy Bowl",    price:28000, sold:215, km:1.8 },
  { rank:8,  shopId:"pizza-house-pa",   emoji:"🍕", name:"Pizza mini 4 vị",   shop:"Pizza House PA",  price:55000, sold:187, km:3.0 },
  { rank:9,  shopId:"ice-cream-pa",     emoji:"🍦", name:"Kem tươi Ý",        shop:"Ice Cream PA",    price:22000, sold:164, km:0.9 },
  { rank:10, shopId:"ca-phe-phuoc-an",  emoji:"☕", name:"Cà phê sữa đá",    shop:"Cà Phê Phước An", price:18000, sold:143, km:0.4 },
]

const RANK_ICON = ["🥇","🥈","🥉"]
const fmt       = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function BestsellersPage() {
  const router = useRouter()
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
          <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>🏆 Bán chạy tuần này</div>
          <div style={{ color:"#6a5a40", fontSize:10 }}>Xếp hạng theo số lượng bán giảm dần</div>
        </div>
      </div>

      {/* List */}
      <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
        {BEST_SELLERS.map((b, idx) => (
          <motion.div
            key={b.rank}
            initial={{ opacity:0, y:12 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay: Math.min(idx * 0.04, 0.15) }}
            style={{
              background:"rgba(255,255,255,0.05)",
              border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:16, padding:"12px 14px",
              display:"flex", alignItems:"center", gap:13, cursor:"pointer",
            }}
            onClick={() => router.push(`/shop/${b.shopId}`)}
          >
            {/* Rank badge */}
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0,
              background: b.rank <= 3 ? "rgba(255,215,0,0.12)" : "rgba(255,107,0,0.08)",
              border: b.rank <= 3 ? "1px solid rgba(255,215,0,0.3)" : "1px solid rgba(255,107,0,0.15)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize: b.rank <= 3 ? 18 : 13,
              fontWeight:800,
              color: b.rank===1?"#FFD700": b.rank===2?"#C0C0C0": b.rank===3?"#CD7F32": "#FF8C00",
            }}>
              {b.rank <= 3 ? RANK_ICON[b.rank-1] : `#${b.rank}`}
            </div>

            {/* Emoji */}
            <div style={{
              width:46, height:46, borderRadius:12, flexShrink:0,
              background:"rgba(255,107,0,0.06)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:26,
            }}>{b.emoji}</div>

            {/* Info */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:600,
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {b.name}
              </div>
              <div style={{ color:"#6a5a40", fontSize:10, marginTop:2 }}>{b.shop} · {b.km}km</div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:5 }}>
                <span style={{
                  background:"linear-gradient(135deg,#FF6B00,#FFB347)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                  backgroundClip:"text", fontSize:13, fontWeight:700,
                }}>{fmt(b.price)}</span>
                <span style={{
                  background:"rgba(62,207,110,0.1)", border:"1px solid rgba(62,207,110,0.2)",
                  borderRadius:5, padding:"1px 7px",
                  color:"#3ecf6e", fontSize:9, fontWeight:600,
                }}>🔥 {b.sold.toLocaleString("vi-VN")} đã bán</span>
              </div>
            </div>

            {/* Bar sold relative */}
            <div style={{ width:48, flexShrink:0 }}>
              <div style={{
                height:4, borderRadius:2,
                background:"rgba(255,255,255,0.06)",
                overflow:"hidden",
              }}>
                <div style={{
                  height:"100%", borderRadius:2,
                  background: b.rank===1?"linear-gradient(90deg,#FFD700,#FFB347)":
                               b.rank===2?"linear-gradient(90deg,#C0C0C0,#a0a0a0)":
                               b.rank===3?"linear-gradient(90deg,#CD7F32,#a05a1a)":
                                          "linear-gradient(90deg,#FF6B00,#FF8C00)",
                  width:`${Math.round(b.sold / BEST_SELLERS[0].sold * 100)}%`,
                  transition:"width .6s ease",
                }} />
              </div>
              <div style={{ color:"#6a5a40", fontSize:7.5, marginTop:3, textAlign:"right" }}>
                {Math.round(b.sold / BEST_SELLERS[0].sold * 100)}% max
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
