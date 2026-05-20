"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

// Tất cả quán — sắp xếp km tăng dần (gần nhất trước)
const ALL_SHOPS = [
  {
    id:10, emoji:"☕", name:"Cà Phê Phước An",
    category:"Cà phê", tags:["🔥 Bán chạy","Cà phê"],
    star:4.6, km:0.4, eta:8,  disc:0,  freeShip:true,  isOpen:true,
    desc:"Cà phê sữa đá, bạc xỉu, cà phê muối",
  },
  {
    id:2,  emoji:"🧋", name:"Trà Sữa Ding Tea PA",
    category:"Đồ uống", tags:["🆕 Mới","Trà sữa"],
    star:4.8, km:0.5, eta:10, disc:20, freeShip:true,  isOpen:true,
    desc:"Trà sữa trân châu, trà đào cam sả, matcha",
  },
  {
    id:4,  emoji:"🍗", name:"Gà Vàng Phước An",
    category:"Gà rán", tags:["Gà rán","Ăn vặt"],
    star:4.6, km:0.6, eta:15, disc:30, freeShip:true,  isOpen:true,
    desc:"Gà rán giòn cay, gà chiên mắm tỏi, khoai tây",
  },
  {
    id:1,  emoji:"🍜", name:"Bún Bò Huế Ngon",
    category:"Bún · Phở", tags:["🔥 Bán chạy","Bún · Phở"],
    star:4.9, km:0.8, eta:20, disc:0,  freeShip:true,  isOpen:true,
    desc:"Bún bò đặc biệt, bún bò tái, chả chiên giòn",
  },
  {
    id:9,  emoji:"🍦", name:"Ice Cream PA",
    category:"Kem", tags:["Kem tươi","Tráng miệng"],
    star:4.5, km:0.9, eta:12, disc:0,  freeShip:false, isOpen:true,
    desc:"Kem Ý tươi, kem gelato, sinh tố bơ",
  },
  {
    id:3,  emoji:"🍱", name:"Cơm Nhà Bếp Phước An",
    category:"Cơm hộp", tags:["Cơm hộp","Bình dân"],
    star:4.7, km:1.2, eta:25, disc:0,  freeShip:false, isOpen:true,
    desc:"Cơm sườn, cơm gà, cơm văn phòng phần lớn",
  },
  {
    id:11, emoji:"🥐", name:"Bánh Mì Phước An",
    category:"Bánh mì", tags:["Bánh mì","Ăn sáng"],
    star:4.4, km:1.4, eta:18, disc:10, freeShip:false, isOpen:false,
    desc:"Bánh mì thịt, bánh mì trứng, bánh mì chả lụa",
  },
  {
    id:7,  emoji:"🥗", name:"Healthy Bowl PA",
    category:"Chay · Salad", tags:["Ăn healthy","Chay"],
    star:4.3, km:1.8, eta:22, disc:0,  freeShip:false, isOpen:true,
    desc:"Salad rau củ, smoothie bowl, cơm gạo lứt",
  },
  {
    id:5,  emoji:"🍔", name:"Burger House Phước An",
    category:"Burger", tags:["Fast food","Burger"],
    star:4.5, km:2.1, eta:30, disc:18, freeShip:false, isOpen:true,
    desc:"Burger phô mai, burger gà crispy, khoai chiên",
  },
  {
    id:12, emoji:"🌮", name:"Mì Ý Pasta PA",
    category:"Mì Ý", tags:["Mì Ý","Ẩm thực Tây"],
    star:4.2, km:2.6, eta:35, disc:0,  freeShip:false, isOpen:true,
    desc:"Mì ý sốt bò băm, pizza mini, salad Caesar",
  },
  {
    id:6,  emoji:"🍕", name:"Pizza House Phước An",
    category:"Pizza", tags:["Pizza","Fast food"],
    star:4.4, km:3.0, eta:40, disc:31, freeShip:false, isOpen:true,
    desc:"Pizza mini 4 vị, pizza bò BBQ, pizza hải sản",
  },
]

const FILTERS = ["Tất cả", "Đang mở", "Gần nhất", "Đồ ăn", "Đồ uống", "Đang khuyến mãi"]

export default function NearbyShopsPage() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState("Tất cả")

  const filtered = (() => {
    let list = [...ALL_SHOPS]
    if (activeFilter === "Đang mở")         return list.filter(s => s.isOpen)
    if (activeFilter === "Gần nhất")        return list.filter(s => s.isOpen).sort((a, b) => a.km - b.km)
    if (activeFilter === "Đồ ăn")           return list.filter(s => !["Đồ uống","Cà phê","Kem"].includes(s.category))
    if (activeFilter === "Đồ uống")         return list.filter(s => ["Đồ uống","Cà phê","Kem"].includes(s.category))
    if (activeFilter === "Đang khuyến mãi") return list.filter(s => s.disc > 0)
    return list // "Tất cả" — đã sắp theo km nên không cần sort thêm
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
        <div style={{ flex:1 }}>
          <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>📍 Quán gần bạn</div>
          <div style={{ color:"#6a5a40", fontSize:10 }}>
            Sắp xếp từ gần đến xa · {ALL_SHOPS.length} quán trong khu vực
          </div>
        </div>
        {/* Map icon */}
        <button type="button" onClick={() => router.push("/search?filter=nearby&view=map")}
          style={{
            width:34, height:34, borderRadius:10,
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
            color:"#f8f0e0", fontSize:16, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>🗺️</button>
      </div>

      {/* Filter chips */}
      <div style={{
        display:"flex", gap:7, padding:"10px 16px",
        overflowX:"auto", scrollbarWidth:"none",
      }}>
        {FILTERS.map(f => {
          const on = activeFilter === f
          return (
            <button key={f} type="button" onClick={() => setActiveFilter(f)} style={{
              flexShrink:0, padding:"5px 13px", borderRadius:20,
              background: on ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)",
              border: on ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)",
              color: on ? "#FF8C00" : "#6a5a40",
              fontSize:10, fontWeight: on ? 600 : 400, cursor:"pointer",
              fontFamily:"Lexend",
            }}>{f}</button>
          )
        })}
      </div>

      {/* Count */}
      <div style={{ padding:"0 16px 8px", color:"#6a5a40", fontSize:11 }}>
        {filtered.length} quán{activeFilter !== "Tất cả" ? ` · ${activeFilter.toLowerCase()}` : ""}
      </div>

      {/* List */}
      <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🏚️</div>
            <div style={{ color:"#6a5a40", fontSize:12 }}>Không tìm thấy quán nào</div>
          </div>
        ) : filtered.map((s, idx) => (
          <motion.div
            key={s.id}
            initial={{ opacity:0, y:12 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay: Math.min(idx * 0.04, 0.15) }}
          >
            <a href={`/shop/${s.id}`} style={{ textDecoration:"none" }}>
              <div style={{
                background: s.isOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:16, padding:"11px 12px",
                display:"flex", alignItems:"center", gap:11,
                opacity: s.isOpen ? 1 : 0.6,
              }}>

                {/* Emoji logo */}
                <div style={{
                  width:58, height:58, borderRadius:14, flexShrink:0,
                  background:"rgba(255,107,0,0.07)", border:"1px solid rgba(255,255,255,0.08)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:28, position:"relative",
                }}>
                  {s.emoji}
                  {!s.isOpen && (
                    <div style={{
                      position:"absolute", inset:0, borderRadius:14,
                      background:"rgba(8,8,6,0.65)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <span style={{
                        color:"#ff6060", fontSize:9, fontWeight:800,
                        background:"rgba(255,64,64,0.18)", padding:"2px 6px",
                        borderRadius:5, border:"1px solid rgba(255,64,64,0.3)",
                      }}>Đóng</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:1 }}>
                    <div style={{
                      color:"#f8f0e0", fontSize:12, fontWeight:700,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                      flex:1, minWidth:0,
                    }}>{s.name}</div>
                    {/* Status dot */}
                    <div style={{
                      flexShrink:0, display:"flex", alignItems:"center", gap:3,
                      background: s.isOpen ? "rgba(62,207,110,0.12)" : "rgba(255,64,64,0.1)",
                      border: `1px solid ${s.isOpen ? "rgba(62,207,110,0.3)" : "rgba(255,64,64,0.25)"}`,
                      borderRadius:5, padding:"1px 6px",
                    }}>
                      <div style={{
                        width:5, height:5, borderRadius:"50%",
                        background: s.isOpen ? "#3ecf6e" : "#ff6060",
                        boxShadow: s.isOpen ? "0 0 4px #3ecf6e" : "none",
                      }} />
                      <span style={{ color: s.isOpen ? "#3ecf6e" : "#ff6060", fontSize:9, fontWeight:700 }}>
                        {s.isOpen ? "Mở" : "Đóng"}
                      </span>
                    </div>
                  </div>

                  <div style={{ color:"#6a5a40", fontSize:9, marginTop:2,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {s.desc}
                  </div>

                  {/* Tags */}
                  <div style={{ display:"flex", gap:4, marginTop:5, flexWrap:"wrap" }}>
                    {s.tags.map(t => (
                      <span key={t} style={{
                        background: t.startsWith("🔥") ? "rgba(255,64,64,0.1)"
                                  : t.startsWith("🆕") ? "rgba(62,207,110,0.08)"
                                  :                      "rgba(255,255,255,0.04)",
                        border:     t.startsWith("🔥") ? "1px solid rgba(255,64,64,0.2)"
                                  : t.startsWith("🆕") ? "1px solid rgba(62,207,110,0.2)"
                                  :                      "1px solid rgba(255,255,255,0.06)",
                        color:      t.startsWith("🔥") ? "#ff6060"
                                  : t.startsWith("🆕") ? "#3ecf6e"
                                  :                      "#6a5a40",
                        fontSize:9, borderRadius:5, padding:"2px 6px",
                      }}>{t}</span>
                    ))}
                  </div>

                  {/* Star · km · eta */}
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                    <span style={{ color:"#FFB347", fontSize:11 }}>★ {s.star}</span>
                    <span style={{ color:"#4a5040" }}>·</span>
                    <span style={{ color:"#b0956a", fontSize:11 }}>📍 {s.km}km</span>
                    <span style={{ color:"#4a5040" }}>·</span>
                    <span style={{ color:"#b0956a", fontSize:11 }}>⏱ {s.eta}–{s.eta+10} phút</span>
                  </div>
                </div>

                {/* Right: badges + arrow */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
                  {s.disc > 0 && (
                    <div style={{
                      background:"rgba(255,64,64,0.12)", border:"1px solid rgba(255,64,64,0.3)",
                      borderRadius:6, padding:"2px 7px",
                      color:"#ff6060", fontSize:9, fontWeight:700,
                    }}>-{s.disc}%</div>
                  )}
                  <div style={{
                    color: s.freeShip ? "#3ecf6e" : "#6a5a40",
                    fontSize:9, fontWeight: s.freeShip ? 600 : 400,
                  }}>
                    {s.freeShip ? "Free ship" : "Ship 8k"}
                  </div>
                  <div style={{
                    width:28, height:28, borderRadius:8,
                    background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:"#fff", fontSize:14,
                    boxShadow:"0 2px 8px rgba(255,107,0,0.35)",
                  }}>›</div>
                </div>

              </div>
            </a>
          </motion.div>
        ))}
      </div>

    </div>
  )
}
