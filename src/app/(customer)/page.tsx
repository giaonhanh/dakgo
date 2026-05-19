"use client"

// ============================================================
// src/app/(customer)/page.tsx
// Trang chủ — 12 Sections Đầy Đủ theo mockup đã approved
// S0  HomeHeader       — GPS Radar + Bell + Avatar
// S1  AIGreeting       — Chào theo giờ + AI gợi ý
// S2  SearchBar        — Tìm kiếm + Filter
// S3  LiveStatusBanner — Đơn đang giao (hiện có điều kiện)
// S4  FlashSaleBanner  — Banner khuyến mãi + countdown
// S5  ServiceGrid      — 4 dịch vụ nhanh
// S6  VoucherStrip     — Voucher sắp hết hạn
// S7  CategoryCarousel — Lọc loại món ăn
// S8  PromoSection     — Khuyến mãi hôm nay
// S9  NearbyShops      — Quán gần bạn
// S10 BestSellers      — Bán chạy tuần này
// S11 LoyaltyPoints    — Điểm tích lũy
// S12 ReorderSection   — Đặt lại nhanh
// + BottomNav floating capsule
// ============================================================

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/store/cartStore"

// ─── Mock data (thay bằng Supabase fetch) ──────────────────
const USER_NAME   = "Minh Tuấn"
const NOTIF_COUNT = 3
const LIVE_ORDER  = { id: "GN2851", shopName: "Bún Bò Huế Ngon", eta: 3 }
const HAS_LIVE    = true

const ALL_VOUCHERS = [
  { id:1, type:"app",  icon:"🎉", code:"WELCOME25", value:"-25%",      label:"Toàn bộ đơn hàng", expiry:"Hết hạn HÔM NAY!", urgent:true  },
  { id:2, type:"app",  icon:"🚚", code:"FREESHIP",  value:"Free ship", label:"Đơn từ 50.000đ",   expiry:"Còn 3 ngày",       urgent:false },
  { id:3, type:"shop", icon:"🍜", code:"SHOP10",    value:"-10%",      label:"Bún bò Huế Ngon",  expiry:"Còn 5 ngày",       urgent:false },
  { id:4, type:"shop", icon:"🥤", code:"GNSHOP",    value:"-5.000đ",   label:"Ding Tea PA",      expiry:"Còn 7 ngày",       urgent:false },
]

const MEAL_TIMES = [
  { icon:"☀️",  label:"Buổi Sáng", value:"morning"  },
  { icon:"🌤️", label:"Buổi Trưa", value:"lunch"    },
  { icon:"🌙",  label:"Buổi Tối",  value:"dinner"   },
  { icon:"🥤",  label:"Nước",      value:"drinks"   },
  { icon:"🍺",  label:"Món Nhậu",  value:"drinking" },
  { icon:"🍿",  label:"Ăn Vặt",   value:"snack"    },
]

function getDefaultMealTime() {
  const h = new Date().getHours()
  if (h >= 5  && h < 10) return 0 // Sáng
  if (h >= 10 && h < 14) return 1 // Trưa
  if (h >= 14 && h < 18) return 3 // Nước (chiều)
  if (h >= 18 && h < 23) return 2 // Tối
  return 4                         // Nhậu (khuya)
}

const PROMOS = [
  { id:1, emoji:"🍜", name:"Bún bò Huế",       shop:"Quán Bà Lan",   price:34000, oldPrice:45000, disc:25, star:4.9, km:1.2 },
  { id:2, emoji:"🥤", name:"Trà sữa size L",    shop:"Ding Tea",      price:28000, oldPrice:35000, disc:20, star:4.8, km:0.8 },
  { id:3, emoji:"🍱", name:"Cơm văn phòng",     shop:"Cơm Nhà Bếp",   price:38000, oldPrice:45000, disc:15, star:4.7, km:1.5 },
  { id:4, emoji:"🍗", name:"Gà rán giòn",       shop:"Gà Vàng PA",    price:28000, oldPrice:40000, disc:30, star:4.6, km:0.6 },
  { id:5, emoji:"🍔", name:"Burger phô mai",    shop:"Burger House",  price:45000, oldPrice:55000, disc:18, star:4.5, km:2.1 },
]

const NEARBY_SHOPS = [
  { id:1, emoji:"🍜", name:"Quán Bún Bò Huế Ngon", tags:["🔥 Bán chạy","Bún · Phở"],    star:4.9, km:0.8, eta:20, disc:25, freeShip:true  },
  { id:2, emoji:"🥤", name:"Trà Sữa Ding Tea PA",   tags:["Đồ uống","Trà sữa"],          star:4.8, km:0.5, eta:10, disc:20, freeShip:true  },
  { id:3, emoji:"🍱", name:"Cơm Nhà Bếp Phước An",  tags:["Cơm hộp","Bình dân"],         star:4.7, km:1.2, eta:25, disc:0,  freeShip:false },
  { id:4, emoji:"🍗", name:"Gà Vàng Phước An",       tags:["🆕 Mới","Gà rán"],            star:4.6, km:0.6, eta:15, disc:30, freeShip:true  },
]

const BEST_SELLERS = [
  { rank:1, emoji:"🍜", name:"Bún bò đặc biệt",  shop:"Bún Bò Huế Ngon", price:45000, sold:890  },
  { rank:2, emoji:"🥤", name:"Trà sữa trân châu", shop:"Ding Tea",        price:35000, sold:742  },
  { rank:3, emoji:"🍗", name:"Gà rán giòn cay",   shop:"Gà Vàng PA",     price:38000, sold:601  },
  { rank:4, emoji:"🦑", name:"Chả chiên giòn",    shop:"Bún Bò Huế Ngon",price:15000, sold:488  },
  { rank:5, emoji:"🍔", name:"Burger phô mai",    shop:"Burger House",    price:45000, sold:321  },
]

const REORDERS = [
  { id:1, emoji:"🍜", name:"Bún bò đặc biệt x2", shop:"Bún Bò Huế Ngon", price:90 },
  { id:2, emoji:"🥤", name:"Trà sữa size L x1",   shop:"Ding Tea",        price:35 },
  { id:3, emoji:"🛵", name:"Xe ôm · Chợ → Nhà",    shop:"3.2km · 25.000đ", price:25 },
]


// ─── Helpers ────────────────────────────────────────────────
const fmt  = (n: number) => n.toLocaleString("vi-VN") + "đ"
const RANK_ICON = ["🥇","🥈","🥉"]

// ─── Sub-components ─────────────────────────────────────────

function SectionHeader({ title, more, href }: { title:string; more?:string; href?:string }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"0 16px", marginBottom:8 }}>
      <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:600 }}>{title}</div>
      {more && (
        <a href={href ?? "#"} style={{ color:"#FF8C00", fontSize:9.5,
          textDecoration:"none", fontWeight:500 }}>{more}</a>
      )}
    </div>
  )
}

function HScroll({ children, px=16 }: { children:React.ReactNode; px?:number }) {
  return (
    <div style={{
      display:"flex", gap:8, overflowX:"auto", paddingLeft:px, paddingRight:px,
      paddingBottom:2, marginBottom:14,
      scrollbarWidth:"none", WebkitOverflowScrolling:"touch",
    } as React.CSSProperties}>
      {children}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
export default function HomePage() {

  const router        = useRouter()
  const addItem       = useCartStore(s => s.addItem)
  const clearAndAdd   = useCartStore(s => s.clearAndAdd)
  const storeShopId   = useCartStore(s => s.shopId)
  const storeShopName = useCartStore(s => s.items[0]?.shop ?? "")
  const cartCount     = useCartStore(s => s.totalQty())

  type PendingItem = { id:string; name:string; price:number; shop:string; shopId:string }

  const [activeMealTime,  setActiveMealTime]  = useState(getDefaultMealTime)
  const [savedVoucherIds, setSavedVoucherIds] = useState<number[]>([])
  const [bannerIdx,     setBannerIdx]     = useState(0)
  const [countdown,     setCountdown]     = useState({ h:2, m:15, s:0 })
  const [activeTab,     setActiveTab]     = useState("home")
  const [conflictItem,  setConflictItem]  = useState<PendingItem | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cartIconRef  = useRef<HTMLDivElement>(null)

  // Banner auto-slide
  useEffect(() => {
    const t = setInterval(() => setBannerIdx(i => (i+1)%3), 3500)
    return () => clearInterval(t)
  }, [])

  // Countdown flash sale
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => {
        let { h, m, s } = c
        s--
        if (s < 0) { s = 59; m-- }
        if (m < 0) { m = 59; h-- }
        if (h < 0) { h = 0; m = 0; s = 0 }
        return { h, m, s }
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // Particle effect
  const spawnParticle = (btnEl: HTMLElement) => {
    const container = containerRef.current
    const cartIcon  = cartIconRef.current
    if (!container || !cartIcon) return
    const cR  = container.getBoundingClientRect()
    const sR  = btnEl.getBoundingClientRect()
    const tR  = cartIcon.getBoundingClientRect()
    const sx  = sR.left - cR.left + sR.width/2
    const sy  = sR.top  - cR.top  + sR.height/2
    const tx  = tR.left - cR.left + tR.width/2
    const ty  = tR.top  - cR.top  + tR.height/2
    for (let i=0; i<6; i++) {
      setTimeout(() => {
        const p   = document.createElement("div")
        const ox  = (Math.random()-.5)*16
        const oy  = (Math.random()-.5)*16
        p.style.cssText = `position:absolute;pointer-events:none;z-index:9999;
          width:7px;height:7px;border-radius:50%;
          background:#FF8C00;box-shadow:0 0 6px #FF6B00;
          left:${sx+ox}px;top:${sy+oy}px;`
        container.appendChild(p)
        let t = 0
        const dx=tx-(sx+ox), dy=ty-(sy+oy)
        const iv = setInterval(()=>{
          t+=0.055; if(t>=1){clearInterval(iv);p.remove();return}
          const e = t<.5?2*t*t:-1+(4-2*t)*t
          p.style.left=`${sx+ox+dx*e}px`
          p.style.top=`${sy+oy+dy*e-Math.sin(t*Math.PI)*50}px`
          p.style.opacity=`${1-t*.8}`
          p.style.transform=`scale(${1-t*.4})`
        },16)
      }, i*45)
    }
  }

  const handleAdd = (
    btnEl: HTMLElement | null,
    item: PendingItem
  ) => {
    if (storeShopId && storeShopId !== item.shopId) {
      setConflictItem(item)
      return
    }
    if (btnEl) spawnParticle(btnEl)
    addItem(item)
  }

  const confirmReplace = () => {
    if (!conflictItem) return
    clearAndAdd(conflictItem)
    setConflictItem(null)
  }

  const greet = () => {
    const h = new Date().getHours()
    if (h < 12) return "Buổi sáng tốt lành"
    if (h < 18) return "Buổi chiều tốt lành"
    return "Buổi tối tốt lành"
  }

  const aiTip = () => {
    const h = new Date().getHours()
    if (h < 10) return "☕ Sáng mát, uống cà phê hay ăn bánh mì nóng nhé!"
    if (h < 12) return "⏰ Gần trưa rồi, đặt cơm trước để không chờ lâu!"
    if (h < 14) return "☀️ Nắng nóng, bổ sung nước — trà sữa hoặc sinh tố?"
    if (h < 18) return "🤤 Buổi chiều, ăn nhẹ hoặc uống trà sữa đi!"
    return "🌙 Tối rồi, bún bò hay cháo ăn là ngon nhất!"
  }

  const padZ = (n:number) => String(n).padStart(2,"0")

  // ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
                *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body { background:#080806; font-family:'Lexend',sans-serif; height:100%; overflow:hidden; }
        ::-webkit-scrollbar { display:none; }
        * { -ms-overflow-style:none; scrollbar-width:none; }

        @keyframes radarPulse { 0%{opacity:.7;transform:scale(.3)} 100%{opacity:0;transform:scale(1)} }
        @keyframes shimmer    { 0%{left:-60%} 100%{left:120%} }
        @keyframes logoShine  { 0%{left:-100%} 100%{left:150%} }
        @keyframes pulse      { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cartBounce { 0%,100%{transform:translateY(0)} 35%{transform:translateY(-6px)} 65%{transform:translateY(-2px)} }

        .shop-card:hover  { transform:translateY(-1px); transition:all .2s; }
        .promo-card:hover { transform:translateY(-2px) scale(1.01); transition:all .2s; }
        .svc-card:hover   { border-color:rgba(255,107,0,0.3)!important; transition:border-color .2s; }
        .reorder-btn:hover{ background:rgba(255,107,0,0.15)!important; }
      `}</style>

      {/* ── ROOT ── */}
      <div ref={containerRef} style={{
        position:"fixed", inset:0, background:"#080806",
        display:"flex", flexDirection:"column", overflow:"hidden",
        fontFamily:"'Lexend',sans-serif",
      }}>


        {/* ── SCROLLABLE BODY ── */}
        <div style={{ flex:1, overflowY:"auto", overflowX:"hidden",
          paddingBottom:80, WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* ──────────────────────────────────────
              S0 — HomeHeader
          ────────────────────────────────────── */}
          <div style={{ padding:"8px 16px 6px", display:"flex",
            justifyContent:"space-between", alignItems:"center" }}>
            {/* GPS + location */}
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              {/* Radar */}
              <div style={{ position:"relative", width:16, height:16, flexShrink:0 }}>
                <div style={{ position:"absolute", width:5, height:5, background:"#FF6B00",
                  borderRadius:"50%", top:5.5, left:5.5,
                  boxShadow:"0 0 5px #FF6B00" }} />
                {[{w:10,t:3,l:3,d:"0s"},{w:16,t:0,l:0,d:".7s"}].map((r,i)=>(
                  <div key={i} style={{ position:"absolute", width:r.w, height:r.w,
                    borderRadius:"50%", border:"1px solid #FF6B00", opacity:0,
                    top:r.t, left:r.l,
                    animation:`radarPulse 2s ${r.d} infinite` }} />
                ))}
              </div>
              <div>
                <div style={{ color:"#6a5a40", fontSize:9 }}>Vị trí của bạn</div>
                <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:600 }}>
                  Phước An, Krông Pắc ▾
                </div>
              </div>
            </div>
            {/* Bell + Avatar */}
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <a href="/notifications" style={{ position:"relative", textDecoration:"none" }}>
                <div style={{ width:32, height:32, borderRadius:"50%",
                  background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:15 }}>🔔</div>
                {NOTIF_COUNT > 0 && (
                  <div style={{ position:"absolute", top:3, right:3,
                    width:14, height:14, borderRadius:"50%",
                    background:"#ff4040", border:"1.5px solid #080806",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:"#fff", fontSize:7, fontWeight:700,
                    boxShadow:"0 0 4px #ff4040", animation:"pulse 1.5s infinite" }}>
                    {NOTIF_COUNT}
                  </div>
                )}
              </a>
              <a href="/profile" style={{ textDecoration:"none" }}>
                <div style={{ width:32, height:32, borderRadius:10,
                  background:"rgba(255,107,0,0.12)", border:"1px solid rgba(255,107,0,0.25)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>
                  👤
                </div>
              </a>
            </div>
          </div>

          {/* ──────────────────────────────────────
              S1 — AIGreeting
          ────────────────────────────────────── */}
          <div style={{ padding:"2px 16px 12px" }}>
            <div style={{ color:"#6a5a40", fontSize:10, marginBottom:2 }}>
              {greet()}, {USER_NAME} 👋
            </div>
            <div style={{ fontSize:18, fontWeight:700, lineHeight:1.2, marginBottom:8 }}>
              Hôm nay bạn{" "}
              <span style={{
                background:"linear-gradient(135deg,#FF6B00,#FF8C00,#FFB347)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                backgroundClip:"text",
              }}>muốn ăn gì?</span>
            </div>
            {/* AI tip card */}
            <div style={{
              display:"flex", alignItems:"center", gap:8,
              background:"rgba(180,100,255,0.07)",
              border:"1px solid rgba(180,100,255,0.2)",
              borderRadius:10, padding:"7px 11px",
            }}>
              <span style={{ fontSize:14 }}>🤖</span>
              <div style={{ color:"#b464ff", fontSize:9, lineHeight:1.4, flex:1 }}>
                <strong style={{ color:"#c87aff" }}>Gợi ý AI:</strong> {aiTip()}
              </div>
              <span style={{ color:"rgba(180,100,255,0.5)", fontSize:12 }}>›</span>
            </div>
          </div>

          {/* ──────────────────────────────────────
              S2 — SearchBar
          ────────────────────────────────────── */}
          <div style={{ margin:"0 16px 12px",
            background:"rgba(255,255,255,0.07)",
            backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:13, padding:"9px 13px",
            display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ color:"#6a5a40", fontSize:15 }}>🔍</span>
            <input readOnly placeholder="Tìm món ăn, cửa hàng, dịch vụ..."
              onClick={() => { window.location.href="/search" }}
              style={{ flex:1, background:"transparent", border:"none", outline:"none",
                color:"#6a5a40", fontSize:11, fontFamily:"Lexend", cursor:"pointer" }} />
            <a href="/search?filter=open" style={{ textDecoration:"none" }}>
              <div style={{ width:26, height:26, borderRadius:8,
                background:"rgba(255,107,0,0.10)", border:"1px solid rgba(255,107,0,0.25)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>
                ⚙️
              </div>
            </a>
          </div>

          {/* ──────────────────────────────────────
              S3 — LiveStatusBanner (điều kiện)
          ────────────────────────────────────── */}
          <AnimatePresence>
            {HAS_LIVE && (
              <motion.a key="live-banner" href={`/tracking/${LIVE_ORDER.id}`}
                initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-8 }} style={{ textDecoration:"none" }}>
                <div style={{
                  margin:"0 16px 12px",
                  background:"linear-gradient(135deg,#0f1a08,#152010)",
                  border:"1px solid rgba(62,207,110,0.25)",
                  borderRadius:14, padding:"10px 13px",
                  display:"flex", alignItems:"center", gap:10,
                  position:"relative", overflow:"hidden",
                }}>
                  <div style={{ position:"absolute", right:-10, top:-10,
                    width:70, height:70,
                    background:"radial-gradient(circle,rgba(62,207,110,0.2) 0%,transparent 65%)" }} />
                  <span style={{ fontSize:20, position:"relative", zIndex:1 }}>🛵</span>
                  <div style={{ flex:1, position:"relative", zIndex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%",
                        background:"#3ecf6e", boxShadow:"0 0 5px #3ecf6e",
                        animation:"pulse 1.5s infinite" }} />
                      <span style={{ color:"#3ecf6e", fontSize:9, fontWeight:600 }}>Đơn đang giao</span>
                    </div>
                    <div style={{ color:"#f8f0e0", fontSize:11, fontWeight:600, marginTop:2 }}>
                      {LIVE_ORDER.shopName} · #{LIVE_ORDER.id}
                    </div>
                    <div style={{ color:"rgba(255,255,255,0.4)", fontSize:8.5, marginTop:1 }}>
                      Tài xế cách bạn ~500m · Còn {LIVE_ORDER.eta} phút
                    </div>
                  </div>
                  <div style={{
                    background:"rgba(62,207,110,0.12)",
                    border:"1px solid rgba(62,207,110,0.25)",
                    borderRadius:8, padding:"4px 9px",
                    color:"#3ecf6e", fontSize:9, fontWeight:600,
                    position:"relative", zIndex:1, flexShrink:0,
                  }}>Theo dõi →</div>
                </div>
              </motion.a>
            )}
          </AnimatePresence>

          {/* ──────────────────────────────────────
              S4 — FlashSaleBanner
          ────────────────────────────────────── */}
          <div style={{ margin:"0 16px 8px" }}>
            <div style={{
              height:110, borderRadius:16, overflow:"hidden",
              border:"1px solid rgba(255,107,0,0.35)",
              position:"relative",
              background:"linear-gradient(135deg,#1a0d00,#2d1500,#0d0900)",
            }}>
              {/* Glow */}
              <div style={{ position:"absolute", top:-20, right:-15,
                width:130, height:130,
                background:"radial-gradient(circle,rgba(255,107,0,0.32) 0%,transparent 65%)" }} />
              <div style={{ position:"absolute", bottom:-15, left:10,
                width:80, height:80,
                background:"radial-gradient(circle,rgba(255,179,71,0.12) 0%,transparent 65%)" }} />
              {/* Shine */}
              <div style={{ position:"absolute", top:0, left:"-100%", width:"50%", height:"100%",
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)",
                animation:"logoShine 3.5s infinite" }} />
              {/* Content */}
              <div style={{ position:"relative", zIndex:1, padding:"13px 15px" }}>
                <div style={{
                  display:"inline-block",
                  background:"linear-gradient(135deg,#FF6B00,#FF8C00,#FFB347)",
                  borderRadius:8, padding:"2px 9px", marginBottom:5,
                  color:"#000", fontSize:8, fontWeight:700, letterSpacing:.4,
                }}>
                  ⚡ FLASH SALE · {padZ(countdown.h)}h {padZ(countdown.m)}p {padZ(countdown.s)}s
                </div>
                <div style={{ color:"#fff", fontSize:14, fontWeight:700, lineHeight:1.25 }}>
                  Trà sữa Ding Tea<br/>Chỉ 15.000đ!
                </div>
                <div style={{ color:"rgba(255,255,255,0.4)", fontSize:9, marginTop:3 }}>
                  Giảm 57% · Miễn phí ship
                </div>
                <div style={{
                  display:"inline-block", marginTop:6,
                  background:"rgba(255,255,255,0.12)",
                  border:"1px solid rgba(255,255,255,0.2)",
                  borderRadius:6, padding:"3px 9px",
                  color:"#fff", fontSize:8.5, fontWeight:600,
                }}>Đặt ngay →</div>
              </div>
              {/* Big emoji */}
              <div style={{ position:"absolute", right:14, top:"50%",
                transform:"translateY(-50%)", fontSize:52, zIndex:1,
                filter:"drop-shadow(0 0 14px rgba(255,107,0,0.5))" }}>
                🧋
              </div>
            </div>
            {/* Dots */}
            <div style={{ display:"flex", gap:4, justifyContent:"center", padding:"7px 0 8px" }}>
              {[0,1,2].map(i=>(
                <div key={i} style={{
                  width: bannerIdx===i ? 18 : 5, height:5, borderRadius:3,
                  background: bannerIdx===i ? "#FF6B00" : "rgba(255,255,255,0.08)",
                  transition:"all .3s",
                  boxShadow: bannerIdx===i ? "0 0 5px #FF6B00" : "none",
                }} />
              ))}
            </div>
          </div>

          {/* ──────────────────────────────────────
              S5 — ServiceGrid (4 dịch vụ nhanh)
          ────────────────────────────────────── */}
          <SectionHeader title="Dịch vụ nhanh" />
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(4,1fr)",
            gap:7, padding:"0 16px", marginBottom:14,
          }}>
            {[
              { icon:"📦", label:"Giao hộ",  href:"/errand?type=deliver", bg:"rgba(255,107,0,0.12)",  ic:"#FF8C00", badge:"" },
              { icon:"🛒", label:"Mua hộ",   href:"/errand?type=buy",     bg:"rgba(62,207,110,0.10)", ic:"#3ecf6e", badge:"HOT" },
              { icon:"🛵", label:"Xe ôm",    href:"/ride?type=moto",      bg:"rgba(74,143,245,0.10)", ic:"#4a8ff5", badge:"" },
              { icon:"🚗", label:"Taxi",     href:"/ride?type=taxi",      bg:"rgba(180,100,255,0.10)",ic:"#b464ff", badge:"" },
            ].map((s,i) => (
              <a key={i} href={s.href} style={{ textDecoration:"none" }}>
                <div className="svc-card" style={{
                  background:"rgba(255,255,255,0.04)",
                  backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:14, padding:"10px 4px",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                  position:"relative",
                }}>
                  {s.badge && (
                    <div style={{ position:"absolute", top:-3, right:4,
                      background:"#ff4040", color:"#fff",
                      fontSize:6, fontWeight:700, padding:"1px 4px", borderRadius:4 }}>
                      {s.badge}
                    </div>
                  )}
                  <div style={{ width:38, height:38, borderRadius:11,
                    background:s.bg, display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:20, color:s.ic }}>
                    {s.icon}
                  </div>
                  <span style={{ color:"#b0956a", fontSize:8.5, textAlign:"center",
                    fontWeight:500, lineHeight:1.3 }}>{s.label}</span>
                </div>
              </a>
            ))}
          </div>

          {/* ──────────────────────────────────────
              S6 — Voucher (khám phá tất cả)
          ────────────────────────────────────── */}
          <SectionHeader title="🎟️ Voucher" more="Xem tất cả →" href="/vouchers" />
          <HScroll>
            {ALL_VOUCHERS.map(v => {
              const saved = savedVoucherIds.includes(v.id)
              return (
                <div key={v.id} style={{
                  minWidth:162, flexShrink:0,
                  background: v.type === "shop" ? "rgba(74,143,245,0.07)" : "rgba(255,107,0,0.07)",
                  backdropFilter:"blur(10px)",
                  border: `1px solid ${v.type === "shop" ? "rgba(74,143,245,0.22)" : "rgba(255,107,0,0.2)"}`,
                  borderRadius:12, padding:"9px 11px",
                  display:"flex", flexDirection:"column", gap:7,
                  position:"relative", overflow:"hidden",
                }}>
                  <div style={{ position:"absolute", top:0, left:"-80%", width:"40%", height:"100%",
                    background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)",
                    animation:"shimmer 3s infinite" }} />
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:32, height:32, borderRadius:9,
                      background: v.type === "shop" ? "rgba(74,143,245,0.12)" : "rgba(255,107,0,0.12)",
                      border: `1px solid ${v.type === "shop" ? "rgba(74,143,245,0.25)" : "rgba(255,107,0,0.25)"}`,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                      {v.icon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color: v.type === "shop" ? "#4a8ff5" : "#FF8C00", fontSize:12, fontWeight:700 }}>{v.value}</div>
                      <div style={{ color:"#b0956a", fontSize:8, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.label}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ fontSize:7.5,
                      color: v.urgent ? "#ff4040" : "rgba(255,107,0,0.45)",
                      fontWeight: v.urgent ? 700 : 400 }}>
                      {v.urgent ? "⏰ " : ""}{v.expiry}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSavedVoucherIds(prev =>
                        saved ? prev.filter(x => x !== v.id) : [...prev, v.id]
                      )}
                      style={{
                        height:20, padding:"0 7px", borderRadius:6, border:"none",
                        cursor:"pointer", fontSize:8, fontWeight:700, fontFamily:"Lexend",
                        background: saved ? "rgba(62,207,110,0.15)" : "rgba(255,107,0,0.15)",
                        color: saved ? "#3ecf6e" : "#FF8C00",
                        transition:"all .2s",
                      }}>
                      {saved ? "✓ Đã lưu" : "🔖 Lưu"}
                    </button>
                  </div>
                </div>
              )
            })}
          </HScroll>

          {/* ──────────────────────────────────────
              S7 — MealTimeFilter
          ────────────────────────────────────── */}
          <SectionHeader title="Bạn muốn ăn gì?" />
          <HScroll>
            {MEAL_TIMES.map((m,i) => {
              const active = activeMealTime === i
              return (
                <div key={i} onClick={() => setActiveMealTime(i)}
                  style={{
                    display:"flex", flexDirection:"column", alignItems:"center",
                    gap:5, flexShrink:0, cursor:"pointer",
                  }}>
                  <div style={{
                    width:54, height:54, borderRadius:16,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:24,
                    background: active ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.05)",
                    border: active ? "1.5px solid rgba(255,107,0,0.45)" : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: active ? "0 0 12px rgba(255,107,0,0.22)" : "none",
                    transition:"all .2s",
                  }}>
                    {m.icon}
                  </div>
                  <div style={{
                    fontSize:8, fontWeight: active ? 700 : 400,
                    color: active ? "#FF8C00" : "#6a5a40",
                    whiteSpace:"nowrap",
                  }}>
                    {m.label}
                  </div>
                </div>
              )
            })}
          </HScroll>

          {/* ──────────────────────────────────────
              S8 — PromoSection
          ────────────────────────────────────── */}
          <SectionHeader title="🔥 Khuyến mãi hôm nay" more="Xem tất cả →" href="/vouchers" />
          <HScroll>
            {PROMOS.map(p => (
              <div key={p.id} className="promo-card" style={{
                minWidth:120, flexShrink:0,
                background:"rgba(255,255,255,0.04)", backdropFilter:"blur(10px)",
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:14, overflow:"hidden", cursor:"pointer",
              }}>
                {/* Image area */}
                <div style={{ height:74, display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:32, position:"relative",
                  background:"rgba(255,107,0,0.04)" }}>
                  <div style={{ position:"absolute", inset:0,
                    background:"radial-gradient(circle at 50% 65%,rgba(255,107,0,0.1) 0%,transparent 65%)" }} />
                  {p.emoji}
                  <div style={{ position:"absolute", top:5, left:5,
                    background:"#ff4040", color:"#fff",
                    fontSize:7, fontWeight:700, padding:"2px 5px", borderRadius:5,
                    boxShadow:"0 0 6px rgba(255,64,64,0.35)" }}>
                    -{p.disc}%
                  </div>
                </div>
                {/* Info */}
                <div style={{ padding:"7px 9px 8px" }}>
                  <div style={{ color:"#f8f0e0", fontSize:10, fontWeight:600,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {p.name}
                  </div>
                  <div style={{ color:"#6a5a40", fontSize:8, marginTop:1,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {p.shop}
                  </div>
                  <div style={{
                    background:"linear-gradient(135deg,#FF6B00,#FFB347)",
                    WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                    backgroundClip:"text",
                    fontSize:11, fontWeight:700, marginTop:3,
                  }}>{fmt(p.price)}</div>
                  <div style={{ display:"flex", alignItems:"center",
                    justifyContent:"space-between", marginTop:4 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                      <span style={{ color:"#FFB347", fontSize:8 }}>★</span>
                      <span style={{ color:"#6a5a40", fontSize:7.5 }}>{p.star} · {p.km}km</span>
                    </div>
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); handleAdd(e.currentTarget as HTMLElement, { id:`promo-${p.id}`, name:p.name, price:p.price, shop:p.shop, shopId:p.shop }) }}
                      style={{ width:22, height:22, borderRadius:7,
                        background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
                        border:"none", color:"#fff", fontSize:14, fontWeight:700,
                        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                        boxShadow:"0 2px 6px rgba(255,107,0,0.4)", flexShrink:0 }}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </HScroll>

          {/* ──────────────────────────────────────
              S9 — NearbyShops
          ────────────────────────────────────── */}
          <SectionHeader title="📍 Quán gần bạn" more="Xem tất cả →" href="/search?filter=nearby" />
          <div style={{ padding:"0 16px", display:"flex", flexDirection:"column",
            gap:9, marginBottom:14 }}>
            {NEARBY_SHOPS.map(s => (
              <a key={s.id} href={`/shop/${s.id}`} style={{ textDecoration:"none" }}>
                <div className="shop-card" style={{
                  background:"rgba(255,255,255,0.06)", backdropFilter:"blur(10px)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:14, padding:"10px 11px",
                  display:"flex", alignItems:"center", gap:10, cursor:"pointer",
                }}>
                  <div style={{ width:54, height:54, borderRadius:12, flexShrink:0,
                    background:"rgba(255,107,0,0.07)", border:"1px solid rgba(255,255,255,0.08)",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:27 }}>
                    {s.emoji}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:"#f8f0e0", fontSize:11.5, fontWeight:600,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {s.name}
                    </div>
                    <div style={{ display:"flex", gap:5, marginTop:4, flexWrap:"wrap" }}>
                      {s.tags.map(t => (
                        <span key={t} style={{
                          background: t.startsWith("🔥") ? "rgba(255,64,64,0.1)" :
                                      t.startsWith("🆕") ? "rgba(62,207,110,0.08)" :
                                                           "rgba(255,255,255,0.04)",
                          border: t.startsWith("🔥") ? "1px solid rgba(255,64,64,0.2)" :
                                  t.startsWith("🆕") ? "1px solid rgba(62,207,110,0.2)" :
                                                       "1px solid rgba(255,255,255,0.06)",
                          color: t.startsWith("🔥") ? "#ff6060" :
                                 t.startsWith("🆕") ? "#3ecf6e" : "#6a5a40",
                          fontSize:7.5, borderRadius:5, padding:"2px 6px",
                        }}>{t}</span>
                      ))}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:5 }}>
                      <span style={{ color:"#FFB347", fontSize:9 }}>★</span>
                      <span style={{ color:"#b0956a", fontSize:8.5 }}>{s.star}</span>
                      <span style={{ color:"#4a5040", fontSize:9 }}>·</span>
                      <span style={{ color:"#b0956a", fontSize:8.5 }}>{s.km}km</span>
                      <span style={{ color:"#4a5040", fontSize:9 }}>·</span>
                      <span style={{ color:"#b0956a", fontSize:8.5 }}>{s.eta}–{s.eta+10} phút</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column",
                    alignItems:"flex-end", gap:5, flexShrink:0 }}>
                    {s.disc > 0 && (
                      <div style={{
                        background:"rgba(255,107,0,0.10)", border:"1px solid rgba(255,107,0,0.25)",
                        borderRadius:6, padding:"2px 7px",
                        color:"#FF8C00", fontSize:8, fontWeight:600 }}>
                        -{s.disc}%
                      </div>
                    )}
                    <div style={{
                      color: s.freeShip ? "#3ecf6e" : "#b0956a",
                      fontSize:8, fontWeight: s.freeShip ? 600 : 400 }}>
                      {s.freeShip ? "Free ship" : "Ship 8k"}
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* ──────────────────────────────────────
              S10 — BestSellers
          ────────────────────────────────────── */}
          <SectionHeader title="🏆 Bán chạy tuần này" more="Xem tất cả →" href="/search?sort=popular" />
          <HScroll>
            {BEST_SELLERS.map(b => (
              <div key={b.rank} style={{
                minWidth:110, flexShrink:0,
                background:"rgba(255,255,255,0.05)", backdropFilter:"blur(10px)",
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:13, overflow:"hidden", cursor:"pointer",
              }}>
                <div style={{ height:80, display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:34, position:"relative",
                  background:"rgba(255,255,255,0.02)" }}>
                  <div style={{ position:"absolute", inset:0,
                    background:"radial-gradient(circle at 50% 60%,rgba(255,107,0,0.09) 0%,transparent 65%)" }} />
                  {b.emoji}
                  <div style={{ position:"absolute", top:6, left:6,
                    width:20, height:20, borderRadius:6,
                    background: b.rank<=3 ? "rgba(255,215,0,0.15)" : "rgba(255,107,0,0.1)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:800,
                    color: b.rank===1 ? "#FFD700" : b.rank===2 ? "#C0C0C0" : b.rank===3 ? "#CD7F32" : "#FF8C00" }}>
                    {b.rank <= 3 ? RANK_ICON[b.rank-1] : b.rank}
                  </div>
                </div>
                <div style={{ padding:"7px 9px 8px" }}>
                  <div style={{ color:"#f8f0e0", fontSize:9.5, fontWeight:600,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {b.name}
                  </div>
                  <div style={{ color:"#6a5a40", fontSize:8, marginTop:1,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {b.shop}
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between",
                    alignItems:"center", marginTop:5 }}>
                    <div style={{
                      background:"linear-gradient(135deg,#FF6B00,#FFB347)",
                      WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                      backgroundClip:"text", fontSize:11, fontWeight:700 }}>
                      {fmt(b.price)}
                    </div>
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); handleAdd(e.currentTarget as HTMLElement, { id:`best-${b.rank}`, name:b.name, price:b.price, shop:b.shop, shopId:b.shop }) }}
                      style={{ width:22, height:22, borderRadius:7,
                        background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
                        border:"none", color:"#fff", fontSize:14, fontWeight:700,
                        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                        boxShadow:"0 2px 6px rgba(255,107,0,0.4)", flexShrink:0 }}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </HScroll>

          {/* S11 — LoyaltyPoints removed: điểm chỉ hiển thị trong Profile cá nhân */}

          {/* ──────────────────────────────────────
              S12 — ReorderSection
          ────────────────────────────────────── */}
          <SectionHeader title="🔄 Đặt lại nhanh" more="Lịch sử →" href="/orders" />
          <HScroll>
            {REORDERS.map(r => (
              <div key={r.id} style={{
                minWidth:132, flexShrink:0,
                background:"rgba(255,255,255,0.04)", backdropFilter:"blur(10px)",
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:12, padding:"10px 11px", cursor:"pointer",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7 }}>
                  <span style={{ fontSize:20 }}>{r.emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:"#f8f0e0", fontSize:9.5, fontWeight:600,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {r.name}
                    </div>
                    <div style={{ color:"#6a5a40", fontSize:8, marginTop:1,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {r.shop}
                    </div>
                  </div>
                </div>
                <button className="reorder-btn"
                  onClick={() => handleAdd(null, { id:`reorder-${r.id}`, name:r.name, price:r.price*1000, shop:r.shop, shopId:r.shop })}
                  style={{
                    width:"100%", height:28, borderRadius:8, border:"1px solid rgba(255,107,0,0.25)",
                    background:"rgba(255,107,0,0.08)",
                    color:"#FF8C00", fontSize:8.5, fontWeight:600,
                    cursor:"pointer", fontFamily:"Lexend",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                    transition:"background .15s",
                  }}>
                  🔄 Đặt lại · {r.price}k
                </button>
              </div>
            ))}
          </HScroll>

          <div style={{ height:8 }} />

        </div>

        {/* ──────────────────────────────────────
            FLOATING BOTTOM NAV (Capsule)
        ────────────────────────────────────── */}
        <div style={{
          position:"absolute", bottom:"max(16px,env(safe-area-inset-bottom))",left:14, right:14, height:56,
          background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
          WebkitBackdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)",
          borderRadius:9999,
          display:"flex", alignItems:"center", justifyContent:"space-around",
          padding:"0 6px", zIndex:50,
          boxShadow:"0 0 20px rgba(255,107,0,0.1)",
        }}>
          {[
            { icon:"🏠", label:"Trang chủ", key:"home",     href:"/"         },
            { icon:"📋", label:"Đơn hàng",  key:"orders",   href:"/orders"   },
            { icon:"🛒", label:"Giỏ hàng",  key:"cart",     href:"/cart",  cart:true },
            { icon:"⚙️", label:"Cài đặt",   key:"settings", href:"/settings" },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => { setActiveTab(tab.key); router.push(tab.href) }}
              style={{ background:"transparent", border:"none", padding:0, cursor:"pointer" }}>
              <div style={{
                display:"flex", flexDirection:"column", alignItems:"center", gap:2,
                padding:"5px 11px", borderRadius:18,
                background: activeTab===tab.key ? "rgba(255,107,0,0.12)" : "transparent",
                position:"relative",
                transform: activeTab===tab.key ? "translateY(-2px)" : "translateY(0)",
                transition:"all .2s",
              }}>
                {tab.cart && (
                  <div ref={cartIconRef} style={{ position:"absolute", inset:0 }} />
                )}
                <span style={{ fontSize:19,
                  filter: activeTab===tab.key
                    ? "drop-shadow(0 0 4px rgba(255,107,0,0.6))"
                    : "none" }}>
                  {tab.icon}
                </span>
                <span style={{
                  fontSize:7.5,
                  color: activeTab===tab.key ? "#FF8C00" : "#6a5a40",
                  fontWeight: activeTab===tab.key ? 600 : 400,
                }}>
                  {tab.label}
                </span>
                {/* Cart badge */}
                {tab.cart && cartCount > 0 && (
                  <div style={{
                    position:"absolute", top:1, right:5,
                    width:14, height:14, borderRadius:"50%",
                    background:"#ff4040", border:"1.5px solid #080806",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:"#fff", fontSize:7, fontWeight:700,
                    animation:"cartBounce .4s ease",
                  }}>{cartCount}</div>
                )}
                {/* Active halo */}
                {activeTab===tab.key && (
                  <div style={{
                    position:"absolute", bottom:-2,
                    width:28, height:3, borderRadius:2,
                    background:"radial-gradient(ellipse,rgba(255,107,0,0.9) 0%,transparent 70%)",
                    filter:"blur(1px)",
                  }} />
                )}
              </div>
            </button>
          ))}
        </div>

      </div>

      {/* ── Conflict Modal — đổi quán ── */}
      <AnimatePresence>
        {conflictItem && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:"fixed", inset:0, zIndex:200,
              background:"rgba(0,0,0,0.72)", backdropFilter:"blur(6px)",
              display:"flex", alignItems:"flex-end", justifyContent:"center",
              padding:"0 16px 40px" }}
            onClick={() => setConflictItem(null)}>
            <motion.div
              initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:80, opacity:0 }}
              transition={{ type:"spring", damping:22, stiffness:260 }}
              onClick={e => e.stopPropagation()}
              style={{ background:"#151210", border:"1px solid rgba(255,107,0,0.28)",
                borderRadius:22, padding:"22px 18px 18px", width:"100%", maxWidth:420 }}>
              <div style={{ fontSize:32, textAlign:"center", marginBottom:8 }}>🛒</div>
              <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700,
                textAlign:"center", marginBottom:10 }}>
                Thay đổi quán?
              </div>
              <div style={{ color:"#b0956a", fontSize:12, textAlign:"center",
                lineHeight:1.7, marginBottom:20 }}>
                Giỏ hàng đang có món từ{" "}
                <span style={{ color:"#FF8C00", fontWeight:700 }}>{storeShopName}</span>.
                <br />Thêm món mới sẽ <strong style={{ color:"#ff6060" }}>xóa giỏ hàng hiện tại</strong>.
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button
                  onClick={() => setConflictItem(null)}
                  style={{ flex:1, height:48, borderRadius:13,
                    border:"1px solid rgba(255,255,255,0.1)",
                    background:"rgba(255,255,255,0.06)",
                    color:"#b0956a", fontSize:13, fontWeight:600,
                    cursor:"pointer", fontFamily:"Lexend" }}>
                  Giữ giỏ cũ
                </button>
                <button
                  onClick={confirmReplace}
                  style={{ flex:1, height:48, borderRadius:13, border:"none",
                    background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
                    color:"#fff", fontSize:13, fontWeight:700,
                    cursor:"pointer", fontFamily:"Lexend",
                    boxShadow:"0 4px 16px rgba(255,107,0,0.4)" }}>
                  Xóa &amp; thêm mới
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
