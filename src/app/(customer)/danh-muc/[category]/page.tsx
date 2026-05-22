"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter, useParams } from "next/navigation"
import { formatPrice } from "@/lib/utils"

const CATEGORY_META: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  "buoi-sang": { icon:"☀️",  label:"Buổi sáng",  color:"#FFB347", bg:"rgba(255,179,71,0.08)",  border:"rgba(255,179,71,0.25)" },
  "buoi-trua": { icon:"🌤️", label:"Buổi trưa",  color:"#FF8C00", bg:"rgba(255,140,0,0.08)",   border:"rgba(255,140,0,0.25)"  },
  "buoi-toi":  { icon:"🌙",  label:"Buổi tối",   color:"#4a8ff5", bg:"rgba(74,143,245,0.08)",  border:"rgba(74,143,245,0.25)" },
  "nuoc-uong": { icon:"🧋",  label:"Nước uống",  color:"#3ecf6e", bg:"rgba(62,207,110,0.08)",  border:"rgba(62,207,110,0.25)" },
  "mon-nhau":  { icon:"🍺",  label:"Món nhậu",   color:"#b464ff", bg:"rgba(180,100,255,0.08)", border:"rgba(180,100,255,0.25)"},
  "an-vat":    { icon:"🍿",  label:"Ăn vặt",    color:"#ff6060", bg:"rgba(255,96,96,0.08)",   border:"rgba(255,96,96,0.25)"  },
}

const MOCK_ITEMS: Record<string, Array<{ id:number; emoji:string; name:string; shop:string; shopId:number; price:number; oldPrice?:number; star:number; km:number; sold:number }>> = {
  "buoi-sang": [
    { id:1, emoji:"🥖", name:"Bánh mì pate nóng",      shop:"Bánh Mì 24h",       shopId:10, price:18000, oldPrice:22000, star:4.8, km:0.4, sold:312 },
    { id:2, emoji:"☕", name:"Cà phê sữa đá",           shop:"Cà Phê Phước An",   shopId:11, price:22000, star:4.7, km:0.6, sold:280 },
    { id:3, emoji:"🥞", name:"Bánh mì trứng ốp la",     shop:"Bánh Mì 24h",       shopId:10, price:20000, star:4.6, km:0.4, sold:198 },
    { id:4, emoji:"🍵", name:"Cháo trắng heo",          shop:"Cháo Phước An",     shopId:12, price:25000, star:4.5, km:0.9, sold:145 },
    { id:5, emoji:"🥐", name:"Bánh ngọt buổi sáng",     shop:"Tiệm Bánh Ngọt PA", shopId:13, price:15000, star:4.4, km:1.1, sold:120 },
  ],
  "buoi-trua": [
    { id:6,  emoji:"🍱", name:"Cơm văn phòng đặc biệt", shop:"Cơm Nhà Bếp PA",  shopId:3, price:38000, oldPrice:45000, star:4.7, km:1.2, sold:421 },
    { id:7,  emoji:"🍜", name:"Bún bò đặc biệt",         shop:"Bún Bò Huế Ngon", shopId:1, price:45000, star:4.9, km:0.8, sold:890 },
    { id:8,  emoji:"🍗", name:"Gà rán giòn cay",         shop:"Gà Vàng PA",      shopId:4, price:38000, oldPrice:48000, star:4.6, km:0.6, sold:601 },
    { id:9,  emoji:"🥗", name:"Salad trộn tôm",          shop:"Cơm Nhà Bếp PA",  shopId:3, price:42000, star:4.5, km:1.2, sold:234 },
    { id:10, emoji:"🍛", name:"Cơm gà xé nước mắm",      shop:"Cơm Nhà Bếp PA",  shopId:3, price:40000, star:4.8, km:1.2, sold:356 },
  ],
  "buoi-toi": [
    { id:11, emoji:"🍜", name:"Bún bò Huế đêm",         shop:"Bún Bò Huế Ngon", shopId:1, price:45000, star:4.9, km:0.8, sold:567 },
    { id:12, emoji:"🍕", name:"Pizza phô mai",           shop:"Burger House",    shopId:5, price:89000, star:4.5, km:2.1, sold:312 },
    { id:13, emoji:"🍔", name:"Burger phô mai đặc biệt", shop:"Burger House",    shopId:5, price:65000, star:4.5, km:2.1, sold:278 },
    { id:14, emoji:"🍲", name:"Lẩu thái 2 người",        shop:"Quán Lẩu PA",     shopId:14, price:120000, star:4.8, km:1.5, sold:189 },
  ],
  "nuoc-uong": [
    { id:15, emoji:"🥤", name:"Trà sữa trân châu size L", shop:"Ding Tea PA",   shopId:2, price:35000, oldPrice:42000, star:4.8, km:0.5, sold:742 },
    { id:16, emoji:"🍋", name:"Sinh tố xoài nhiệt đới",  shop:"Trái Cây Tươi", shopId:15, price:28000, star:4.6, km:0.7, sold:445 },
    { id:17, emoji:"🧃", name:"Nước ép cam tươi",         shop:"Trái Cây Tươi", shopId:15, price:25000, star:4.7, km:0.7, sold:389 },
    { id:18, emoji:"🍵", name:"Trà đào cam sả",           shop:"Ding Tea PA",   shopId:2,  price:30000, star:4.8, km:0.5, sold:512 },
    { id:19, emoji:"☕", name:"Bạc xỉu đá",               shop:"Cà Phê PA",     shopId:11, price:22000, star:4.7, km:0.6, sold:367 },
  ],
  "mon-nhau": [
    { id:20, emoji:"🦑", name:"Chả mực chiên giòn",      shop:"Nhậu Phước An",  shopId:16, price:65000, star:4.7, km:1.3, sold:324 },
    { id:21, emoji:"🍗", name:"Gà nướng muối ớt",        shop:"Gà Vàng PA",     shopId:4,  price:95000, oldPrice:120000, star:4.8, km:0.6, sold:289 },
    { id:22, emoji:"🌮", name:"Nem nướng cuộn bánh tráng",shop:"Nhậu Phước An",  shopId:16, price:45000, star:4.6, km:1.3, sold:256 },
    { id:23, emoji:"🥜", name:"Đậu phộng rang muối",     shop:"Đồ Khô PA",      shopId:17, price:18000, star:4.5, km:0.9, sold:412 },
  ],
  "an-vat": [
    { id:24, emoji:"🍢", name:"Chả chiên giòn",           shop:"Bún Bò Huế Ngon",  shopId:1, price:15000, star:4.9, km:0.8, sold:488 },
    { id:25, emoji:"🧁", name:"Bánh cupcake kem tươi",    shop:"Tiệm Bánh Ngọt PA",shopId:13, price:22000, oldPrice:28000, star:4.6, km:1.1, sold:234 },
    { id:26, emoji:"🌽", name:"Bắp nướng bơ tỏi",        shop:"Đồ Vặt PA",        shopId:18, price:15000, star:4.7, km:0.5, sold:378 },
    { id:27, emoji:"🍡", name:"Bánh mochi nhân đậu đỏ",  shop:"Tiệm Bánh Ngọt PA",shopId:13, price:18000, star:4.5, km:1.1, sold:198 },
    { id:28, emoji:"🥚", name:"Trứng chiên phô mai",      shop:"Đồ Vặt PA",        shopId:18, price:12000, star:4.4, km:0.5, sold:312 },
  ],
}

export default function CategoryPage() {
  const router   = useRouter()
  const params   = useParams()
  const category = (params?.category as string) ?? ""
  const meta     = CATEGORY_META[category]
  const items    = MOCK_ITEMS[category] ?? []
  const [toast,  setToast] = useState("")
  const [sortBy, setSortBy] = useState<"popular" | "price_asc" | "price_desc">("popular")

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2000) }

  const sorted = [...items].sort((a, b) => {
    if (sortBy === "price_asc")  return a.price - b.price
    if (sortBy === "price_desc") return b.price - a.price
    return b.sold - a.sold
  })

  if (!meta) {
    return (
      <div style={{ minHeight:"100dvh", background:"#080806", display:"flex",
        flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
        <div style={{ fontSize:48 }}>🔍</div>
        <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:600 }}>Danh mục không tồn tại</div>
        <button onClick={() => router.back()}
          style={{ padding:"8px 20px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)",
            background:"rgba(255,255,255,0.06)", color:"#b0956a", fontSize:12, cursor:"pointer",
            fontFamily:"Lexend" }}>← Quay lại</button>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        @keyframes dmShim{0%{left:-60%}100%{left:120%}}
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}
            style={{ position:"fixed", top:"calc(env(safe-area-inset-top,0px) + 56px)",
              left:"50%", transform:"translateX(-50%)", zIndex:999, whiteSpace:"nowrap",
              background:"rgba(255,107,0,0.15)", border:"1px solid rgba(255,107,0,0.35)",
              borderRadius:12, padding:"7px 16px", color:"#FF8C00", fontSize:11, fontWeight:600,
              backdropFilter:"blur(10px)" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:40,
        padding:"calc(env(safe-area-inset-top,0px) + 12px) 16px 12px",
        background:"rgba(8,8,6,0.97)", backdropFilter:"blur(20px)",
        borderBottom:`1px solid ${meta.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => router.back()}
            style={{ width:40, height:40, borderRadius:12, background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:18, cursor:"pointer", flexShrink:0 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ color:"#f8f0e0", fontSize:16, fontWeight:800 }}>
              {meta.icon} {meta.label}
            </div>
            <div style={{ color:"#6a5a40", fontSize:9, marginTop:1 }}>
              {items.length} món · Phước An, Krông Pắc
            </div>
          </div>
          <div style={{ background:meta.bg, border:`1px solid ${meta.border}`,
            borderRadius:20, padding:"4px 10px",
            color:meta.color, fontSize:9, fontWeight:700 }}>
            {items.length} món
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ minHeight:"100dvh", background:"#080806",
        paddingTop:"calc(env(safe-area-inset-top,0px) + 72px)",
        paddingBottom:"calc(env(safe-area-inset-bottom,0px) + 80px)" }}>

        {/* Sort bar */}
        <div style={{ display:"flex", gap:7, padding:"12px 16px 10px", overflowX:"auto", scrollbarWidth:"none" }}>
          {([
            { key:"popular",    label:"🔥 Phổ biến"   },
            { key:"price_asc",  label:"💰 Giá thấp"   },
            { key:"price_desc", label:"💎 Giá cao"     },
          ] as const).map(opt => (
            <button key={opt.key} onClick={() => setSortBy(opt.key)}
              style={{ flexShrink:0, padding:"6px 13px", borderRadius:20, cursor:"pointer",
                fontFamily:"Lexend", fontSize:9.5, fontWeight:600,
                background: sortBy===opt.key ? meta.bg : "rgba(255,255,255,0.05)",
                border: sortBy===opt.key ? `1px solid ${meta.border}` : "1px solid rgba(255,255,255,0.08)",
                color: sortBy===opt.key ? meta.color : "#6a5a40",
                transition:"all .15s",
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Items */}
        <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:10 }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 0" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🍽️</div>
              <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:600, marginBottom:4 }}>
                Chưa có món ăn
              </div>
              <div style={{ color:"#6a5a40", fontSize:10 }}>
                Danh mục này đang được cập nhật
              </div>
            </div>
          ) : sorted.map((item, i) => (
            <motion.div key={item.id}
              initial={{ opacity:0, y:12 }}
              animate={{ opacity:1, y:0 }}
              transition={{ delay: i * 0.04 }}>
              <a href={`/shop/${item.shopId}`} style={{ textDecoration:"none" }}>
                <div style={{
                  background:"rgba(255,255,255,0.05)", backdropFilter:"blur(10px)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:16, padding:"11px 13px",
                  display:"flex", alignItems:"center", gap:12,
                  position:"relative", overflow:"hidden",
                }}>
                  {/* Image area */}
                  <div style={{ width:70, height:70, borderRadius:14, flexShrink:0,
                    background:meta.bg, border:`1px solid ${meta.border}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:34, position:"relative" }}>
                    {item.emoji}
                    {item.oldPrice && (
                      <div style={{ position:"absolute", top:-5, left:-5,
                        background:"#ff4040", color:"#fff",
                        fontSize:7, fontWeight:700, padding:"2px 5px", borderRadius:5,
                        boxShadow:"0 0 5px rgba(255,64,64,0.3)" }}>
                        -{Math.round((1-item.price/item.oldPrice)*100)}%
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700, marginBottom:3,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {item.name}
                    </div>
                    <div style={{ color:"#6a5a40", fontSize:9, marginBottom:5 }}>
                      🏪 {item.shop} · {item.km}km
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                        <span style={{ color:"#FFB347", fontSize:9 }}>★</span>
                        <span style={{ color:"#b0956a", fontSize:8.5 }}>{item.star}</span>
                      </div>
                      <span style={{ color:"rgba(255,255,255,0.1)", fontSize:9 }}>·</span>
                      <span style={{ color:"#3ecf6e", fontSize:8, fontWeight:600 }}>
                        🔥 {item.sold.toLocaleString("vi-VN")} đã bán
                      </span>
                    </div>
                    {/* Price */}
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                      <div style={{
                        background:"linear-gradient(135deg,#FF6B00,#FFB347)",
                        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                        backgroundClip:"text", fontSize:13, fontWeight:800,
                      }}>{formatPrice(item.price)}</div>
                      {item.oldPrice && (
                        <div style={{ color:"#4a5040", fontSize:9, textDecoration:"line-through" }}>
                          {formatPrice(item.oldPrice)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add button */}
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); fireToast("Đã thêm vào giỏ hàng!") }}
                    style={{ width:36, height:36, borderRadius:11, flexShrink:0,
                      background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
                      border:"none", color:"#fff", fontSize:20, fontWeight:700,
                      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                      boxShadow:"0 3px 10px rgba(255,107,0,0.4)", position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
                      background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)",
                      animation:"dmShim 2.5s infinite" }} />
                    <span style={{ position:"relative", zIndex:1 }}>+</span>
                  </button>
                </div>
              </a>
            </motion.div>
          ))}
        </div>
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
          { icon:"🛒", label:"Giỏ hàng",  href:"/cart" },
          { icon:"⚙️", label:"Cài đặt",   href:"/settings" },
        ].map(tab => (
          <a key={tab.href} href={tab.href}
            style={{ textDecoration:"none", display:"flex", flexDirection:"column",
              alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18 }}>
            <span style={{ fontSize:19 }}>{tab.icon}</span>
            <span style={{ fontSize:7.5, color:"#6a5a40" }}>{tab.label}</span>
          </a>
        ))}
      </div>
    </>
  )
}
