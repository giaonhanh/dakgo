"use client"

// src/app/(driver)/navigate/[orderId]/page.tsx
// Điều hướng giao hàng — Pha 1 & 2
// Pha 1: Đến lấy hàng tại quán (route cam đứt nét)
// Pha 2: Giao đến khách (route xanh liền)
// Pha 3 & 4: xem file driver-confirm/page.tsx

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import { createBrowserClient } from "@supabase/ssr"

// ─── Leaflet map — no SSR ──────────────────────────────────
const NavMap = dynamic(() => import("@/components/map/NavMap"), {
  ssr: false,
  loading: () => (
    <div style={{ width:"100%", height:MAP_HEIGHT,
      background:"#07090e",
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#6a5a40", fontSize:10 }}>Đang tải bản đồ...</div>
    </div>
  ),
})

// ─── Constants ────────────────────────────────────────────
const MAP_HEIGHT = 225

// ─── Types ────────────────────────────────────────────────
type Phase = "pickup" | "delivery"

interface OrderInfo {
  id:       string
  shopName: string
  shopAddr: string
  shopLat:  number
  shopLng:  number
  shopKm:   number
  shopEta:  number
  custName: string
  custAddr: string
  custNote: string
  custLat:  number
  custLng:  number
  custKm:   number
  custEta:  number
  items:    { name: string; qty: number; emoji: string }[]
  total:    number
  earning:  number
  payment:  string
}

// ─── Mock — thay bằng fetch theo orderId ──────────────────
const ORDER: OrderInfo = {
  id:       "GN2851",
  shopName: "Bún Bò Huế Ngon",
  shopAddr: "147 Trần Phú, Phước An",
  shopLat:  12.6855,
  shopLng:  108.4825,
  shopKm:   0.9,
  shopEta:  5,
  custName: "Nguyễn Minh Tuấn",
  custAddr: "22 Lê Hồng Phong, Phước An",
  custNote: "Để trước cổng, gọi trước 2 phút",
  custLat:  12.6808,
  custLng:  108.4772,
  custKm:   3.2,
  custEta:  18,
  items: [
    { name:"Bún bò đặc biệt", qty:2, emoji:"🍜" },
    { name:"Chả chiên giòn",  qty:3, emoji:"🍡" },
  ],
  total:   159000,
  earning:  28000,
  payment: "Tiền mặt",
}

// Vị trí giả lập của tài xế (thực tế dùng Geolocation API)
const DRIVER_LAT = 12.6840
const DRIVER_LNG = 108.4848

// ─── Helpers ──────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function useSpeed() {
  const [speed, setSpeed] = useState(22)
  useEffect(() => {
    const t = setInterval(() => setSpeed(Math.round(14 + Math.random() * 24)), 4000)
    return () => clearInterval(t)
  }, [])
  return speed
}

// ─── Sub components ───────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color:"#6a5a40", fontSize:8.5, fontWeight:700,
      textTransform:"uppercase", letterSpacing:.6, marginBottom:7 }}>
      {children}
    </div>
  )
}

function DirectionPill({ phase }: { phase: Phase }) {
  const isPickup = phase === "pickup"
  const color  = isPickup ? "#FF8C00" : "#3ecf6e"
  const bg     = isPickup ? "rgba(255,107,0,0.10)" : "rgba(62,207,110,0.08)"
  const bd     = isPickup ? "rgba(255,107,0,0.25)" : "rgba(62,207,110,0.22)"
  const arrowBg    = isPickup ? "#FF6B00" : "#3ecf6e"
  const arrowColor = isPickup ? "#fff" : "#080806"
  const dir    = isPickup ? "↑" : "↖"
  const dist   = isPickup ? "Đi thẳng 350m" : "Rẽ trái 200m"
  const street = isPickup ? "rẽ phải vào đường Trần Phú" : "vào đường Lê Hồng Phong"
  const km     = isPickup ? `${ORDER.shopKm}km` : `${ORDER.custKm}km`

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10,
      background:bg, border:`1px solid ${bd}`,
      borderRadius:13, padding:"8px 12px", marginBottom:10 }}>
      <div style={{ width:34, height:34, borderRadius:9, flexShrink:0,
        background:arrowBg, display:"flex",
        alignItems:"center", justifyContent:"center",
        fontSize:18, color:arrowColor, fontWeight:700 }}>
        {dir}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700 }}>{dist}</div>
        <div style={{ color:"#6a5a40", fontSize:9.5, marginTop:1 }}>{street}</div>
      </div>
      <div style={{ textAlign:"right" }}>
        <div style={{ color, fontSize:12, fontWeight:700 }}>{km}</div>
        <div style={{ color:"#6a5a40", fontSize:8 }}>còn lại</div>
      </div>
    </div>
  )
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display:"flex", gap:8, marginBottom:10 }}>{children}</div>
}

function IconBtn({ icon, color, bg, bd, onClick }: {
  icon: string; color: string; bg: string; bd: string; onClick?: () => void
}) {
  return (
    <button onClick={onClick} style={{ width:42, height:42, borderRadius:11,
      border:`1px solid ${bd}`, background:bg, cursor:"pointer",
      display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
      {icon}
    </button>
  )
}

function MapBtn({ icon, color, bg, bd, label, flex=2, onClick }: {
  icon:string; color:string; bg:string; bd:string;
  label:string; flex?:number; onClick?:()=>void
}) {
  return (
    <button onClick={onClick} style={{ flex, height:42, borderRadius:11,
      border:`1px solid ${bd}`, background:bg, cursor:"pointer",
      display:"flex", alignItems:"center", justifyContent:"center", gap:6,
      color, fontSize:10.5, fontWeight:700, fontFamily:"Lexend" }}>
      {icon} {label}
    </button>
  )
}

function CTA({ label, color="orange", icon, onClick }: {
  label:string; color?:"orange"|"green"; icon?:string; onClick:()=>void
}) {
  const bg = color === "green"
    ? "linear-gradient(90deg,#1a8c50,#3ecf6e)"
    : "linear-gradient(90deg,#FF6B00,#FF8C00)"
  const shadow = color === "green"
    ? "0 4px 16px rgba(62,207,110,0.3)"
    : "0 4px 16px rgba(255,107,0,0.35)"

  return (
    <button onClick={onClick} style={{ width:"100%", height:50, borderRadius:13,
      border:"none", background:bg, color:"#fff",
      fontSize:13, fontWeight:700, fontFamily:"Lexend", cursor:"pointer",
      position:"relative", overflow:"hidden", boxShadow:shadow,
      display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
      <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
        background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)",
        animation:"navShim 2.5s infinite" }} />
      {icon && <span style={{ fontSize:18, position:"relative", zIndex:1 }}>{icon}</span>}
      <span style={{ position:"relative", zIndex:1 }}>{label}</span>
    </button>
  )
}

// ─── Phase 1 content ──────────────────────────────────────
function PickupPhase({ onDone, onCall, onChat, fireToast }: {
  onDone:()=>void; onCall:()=>void; onChat:()=>void; fireToast:(m:string)=>void
}) {
  void fireToast
  return (
    <motion.div key="pickup"
      initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
      exit={{ opacity:0, x:-20 }} transition={{ duration:.22 }}>

      <DirectionPill phase="pickup" />

      {/* Shop info */}
      <div style={{ background:"rgba(74,143,245,0.07)",
        border:"1px solid rgba(74,143,245,0.22)",
        borderRadius:14, padding:"12px 14px", marginBottom:10 }}>
        <div style={{ color:"#4a8ff5", fontSize:9, fontWeight:700,
          textTransform:"uppercase", letterSpacing:.5, marginBottom:9 }}>
          🏪 Đến lấy hàng tại
        </div>
        <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:700, marginBottom:3 }}>
          {ORDER.shopName}
        </div>
        <div style={{ color:"#6a5a40", fontSize:9.5, marginBottom:11 }}>
          📍 {ORDER.shopAddr}
        </div>

        {/* Items */}
        <div style={{ background:"rgba(255,255,255,0.03)",
          border:"1px solid rgba(255,255,255,0.06)",
          borderRadius:10, padding:"8px 11px", marginBottom:10 }}>
          <div style={{ color:"#6a5a40", fontSize:8.5, fontWeight:600,
            marginBottom:6 }}>Đơn #{ORDER.id} · {ORDER.items.length} món</div>
          {ORDER.items.map((it, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between",
              padding:"4px 0",
              borderBottom: i < ORDER.items.length - 1
                ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span style={{ color:"#b0956a", fontSize:10 }}>
                {it.emoji} {it.name}
              </span>
              <span style={{ color:"#6a5a40", fontSize:9.5 }}>×{it.qty}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display:"flex", gap:8 }}>
          {[
            { label:"Khoảng cách", val:`${ORDER.shopKm}km`, color:"#4a8ff5" },
            { label:"Thời gian ETA", val:`~${ORDER.shopEta} phút`, color:"#4a8ff5" },
            { label:"Tiền công", val:fmt(ORDER.earning), color:"#FF8C00" },
          ].map(s => (
            <div key={s.label} style={{ flex:1, background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.06)",
              borderRadius:9, padding:"6px 9px", textAlign:"center" }}>
              <div style={{ color:"#6a5a40", fontSize:8 }}>{s.label}</div>
              <div style={{ color:s.color, fontSize:11, fontWeight:700, marginTop:2 }}>
                {s.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <ActionRow>
        <a href={`https://maps.google.com/?q=${ORDER.shopLat},${ORDER.shopLng}`}
          style={{ flex:2, textDecoration:"none" }}>
          <MapBtn icon="🗺️" label="Google Maps" flex={1} color="#fff"
            bg="linear-gradient(90deg,#FF6B00,#FF8C00)"
            bd="transparent"
            onClick={()=>{}} />
        </a>
        <IconBtn icon="📞" color="#3ecf6e"
          bg="rgba(62,207,110,0.08)" bd="rgba(62,207,110,0.25)"
          onClick={onCall} />
        <IconBtn icon="💬" color="#6a5a40"
          bg="rgba(255,255,255,0.05)" bd="rgba(255,255,255,0.1)"
          onClick={onChat} />
      </ActionRow>

      <CTA color="green" icon="✓"
        label="Đã đến quán · Lấy hàng xong"
        onClick={onDone} />
    </motion.div>
  )
}

// ─── Phase 2 content ──────────────────────────────────────
function DeliveryPhase({ onDone, onCall, onChat, paymentPaid }: {
  onDone:()=>void; onCall:()=>void; onChat:()=>void; paymentPaid:boolean
}) {
  return (
    <motion.div key="delivery"
      initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
      exit={{ opacity:0, x:-20 }} transition={{ duration:.22 }}>

      <DirectionPill phase="delivery" />

      {/* Customer info */}
      <div style={{ background:"rgba(62,207,110,0.07)",
        border:"1px solid rgba(62,207,110,0.22)",
        borderRadius:14, padding:"12px 14px", marginBottom:10 }}>
        <div style={{ color:"#3ecf6e", fontSize:9, fontWeight:700,
          textTransform:"uppercase", letterSpacing:.5, marginBottom:9 }}>
          👤 Giao đến khách
        </div>
        <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:700, marginBottom:3 }}>
          {ORDER.custName}
        </div>

        {/* Address + note */}
        <div style={{ display:"flex", gap:8, padding:"6px 0",
          borderBottom:"1px solid rgba(255,255,255,0.05)", marginBottom:6 }}>
          <span style={{ fontSize:13, flexShrink:0 }}>📍</span>
          <div>
            <div style={{ color:"#6a5a40", fontSize:8.5 }}>Địa chỉ</div>
            <div style={{ color:"#b0956a", fontSize:10.5, marginTop:1 }}>
              {ORDER.custAddr}
            </div>
          </div>
        </div>

        {ORDER.custNote && (
          <div style={{ display:"flex", gap:8, padding:"6px 0",
            borderBottom:"1px solid rgba(255,255,255,0.05)", marginBottom:6 }}>
            <span style={{ fontSize:13, flexShrink:0 }}>📝</span>
            <div>
              <div style={{ color:"#6a5a40", fontSize:8.5 }}>Ghi chú</div>
              <div style={{ color:"#f5c542", fontSize:10.5, marginTop:1 }}>
                {ORDER.custNote}
              </div>
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:8, padding:"6px 0 0",
          alignItems:"center" }}>
          <span style={{ fontSize:13, flexShrink:0 }}>💳</span>
          <div style={{ flex:1 }}>
            <div style={{ color:"#6a5a40", fontSize:8.5 }}>Thanh toán</div>
            <div style={{ color:"#b0956a", fontSize:10.5, marginTop:1 }}>
              {ORDER.payment}
            </div>
          </div>
          {/* Badge "Đã TT" khi khách thanh toán VietQR */}
          {paymentPaid && (
            <div style={{ display:"flex", alignItems:"center", gap:4,
              background:"rgba(62,207,110,0.12)",
              border:"1px solid rgba(62,207,110,0.35)",
              borderRadius:20, padding:"3px 10px",
              flexShrink:0 }}>
              <div style={{ width:5, height:5, borderRadius:"50%",
                background:"#3ecf6e" }} />
              <span style={{ color:"#3ecf6e", fontSize:9, fontWeight:700 }}>
                Đã TT
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Fare cards */}
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <div style={{ flex:1, background:"rgba(255,107,0,0.07)",
          border:"1px solid rgba(255,107,0,0.2)",
          borderRadius:12, padding:"10px 12px" }}>
          <div style={{ color:"#6a5a40", fontSize:9, marginBottom:4 }}>Khách trả</div>
          <div style={{ color:"#FF8C00", fontSize:17, fontWeight:800, lineHeight:1 }}>
            {fmt(ORDER.total)}
          </div>
        </div>
        <div style={{ flex:1, background:"rgba(62,207,110,0.07)",
          border:"1px solid rgba(62,207,110,0.2)",
          borderRadius:12, padding:"10px 12px" }}>
          <div style={{ color:"#6a5a40", fontSize:9, marginBottom:4 }}>Tiền công</div>
          <div style={{ color:"#3ecf6e", fontSize:17, fontWeight:800, lineHeight:1 }}>
            {fmt(ORDER.earning)}
          </div>
        </div>
      </div>

      {/* Quick message chips */}
      <div style={{ marginBottom:10 }}>
        <SectionLabel>Nhắn nhanh cho khách</SectionLabel>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["Đang đến, 3 phút nữa","Kẹt xe, trễ 5 phút","Đang ở cổng, ra lấy hàng"].map(m => (
            <div key={m} style={{ padding:"5px 11px", borderRadius:20, cursor:"pointer",
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.08)",
              color:"#b0956a", fontSize:9.5 }}>
              {m}
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <ActionRow>
        <a href={`https://maps.google.com/?q=${ORDER.custLat},${ORDER.custLng}`}
          style={{ flex:2, textDecoration:"none" }}>
          <MapBtn icon="🗺️" label="Dẫn đường" flex={1} color="#fff"
            bg="linear-gradient(90deg,#1a8c50,#3ecf6e)"
            bd="transparent"
            onClick={()=>{}} />
        </a>
        <IconBtn icon="📞" color="#FF8C00"
          bg="rgba(255,107,0,0.08)" bd="rgba(255,107,0,0.25)"
          onClick={onCall} />
        <IconBtn icon="💬" color="#6a5a40"
          bg="rgba(255,255,255,0.05)" bd="rgba(255,255,255,0.1)"
          onClick={onChat} />
      </ActionRow>

      <CTA color="orange" icon="📷"
        label="Đã đến nơi · Chụp ảnh xác nhận"
        onClick={onDone} />
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────
export default function DriverNavigatePage() {
  const [phase,         setPhase]         = useState<Phase>("pickup")
  const [toast,         setToast]         = useState("")
  const [paymentPaid,   setPaymentPaid]   = useState(false)
  const speed = useSpeed()

  const fireToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(""), 2400)
  }

  // Subscribe Realtime — nhận thông báo khi khách TT VietQR thành công
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const ch = supabase.channel(`order-${ORDER.id}`)
      .on("broadcast", { event: "payment_status" }, ({ payload }) => {
        if (payload.status === "paid") {
          setPaymentPaid(true)
          fireToast("💳 Khách đã thanh toán VietQR!")
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const targetLat = phase === "pickup" ? ORDER.shopLat : ORDER.custLat
  const targetLng = phase === "pickup" ? ORDER.shopLng : ORDER.custLng
  const etaMin    = phase === "pickup" ? ORDER.shopEta : ORDER.custEta
  const etaColor  = phase === "pickup" ? "#FF8C00" : "#3ecf6e"
  const etaLabel  = phase === "pickup" ? "đến quán" : "đến nơi"
  const statusLabel = phase === "pickup" ? "Đến lấy hàng" : "Đang giao"
  const statusColor = phase === "pickup" ? "#FF8C00" : "#3ecf6e"

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%;overflow:hidden}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        @keyframes navPulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes navShim {0%{left:-60%}100%{left:120%}}
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-14}} animate={{opacity:1,y:0}}
            exit={{opacity:0,y:-14}}
            style={{ position:"fixed", top:44, left:"50%", transform:"translateX(-50%)",
              zIndex:999, whiteSpace:"nowrap",
              background:"rgba(62,207,110,0.15)",
              border:"1px solid rgba(62,207,110,0.35)",
              borderRadius:12, padding:"7px 18px",
              color:"#3ecf6e", fontSize:11, fontWeight:600,
              backdropFilter:"blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position:"fixed", inset:0, background:"#080806",
        display:"flex", flexDirection:"column",
        fontFamily:"'Lexend',sans-serif" }}>

        {/* ── MAP SECTION ── */}
        <div style={{ flexShrink:0, position:"relative" }}>
          <NavMap
            driverLat={DRIVER_LAT}
            driverLng={DRIVER_LNG}
            targetLat={targetLat}
            targetLng={targetLng}
            phase={phase}
            height={MAP_HEIGHT} />

          {/* Speed badge */}
          <div style={{ position:"absolute", bottom:10, left:10, zIndex:10,
            background:"rgba(8,8,6,0.9)",
            border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:10, padding:"5px 10px", textAlign:"center",
            backdropFilter:"blur(8px)" }}>
            <div style={{ color:"#f8f0e0", fontSize:20, fontWeight:800, lineHeight:1 }}>
              {speed}
            </div>
            <div style={{ color:"#6a5a40", fontSize:8 }}>km/h</div>
          </div>

          {/* ETA badge */}
          <div style={{ position:"absolute", top:10, right:10, zIndex:10,
            background:"rgba(8,8,6,0.9)",
            border:`1px solid ${etaColor}40`,
            borderRadius:10, padding:"5px 11px", textAlign:"center",
            backdropFilter:"blur(8px)" }}>
            <div style={{ color:etaColor, fontSize:20, fontWeight:800, lineHeight:1 }}>
              {etaMin}&apos;
            </div>
            <div style={{ color:"#6a5a40", fontSize:8 }}>{etaLabel}</div>
          </div>

          {/* Recenter */}
          <div style={{ position:"absolute", top:10, left:10, zIndex:10,
            width:34, height:34, borderRadius:9,
            background:"rgba(8,8,6,0.88)",
            border:"1px solid rgba(255,255,255,0.1)",
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", backdropFilter:"blur(8px)", fontSize:16 }}>
            🎯
          </div>

          {/* Status badge bottom-right */}
          <div style={{ position:"absolute", bottom:10, right:10, zIndex:10,
            display:"flex", alignItems:"center", gap:5,
            background:`${statusColor}18`,
            border:`1px solid ${statusColor}40`,
            borderRadius:8, padding:"4px 9px",
            backdropFilter:"blur(8px)" }}>
            <div style={{ width:6, height:6, borderRadius:"50%",
              background:statusColor,
              boxShadow:`0 0 5px ${statusColor}`,
              animation:"navPulse 1.5s infinite" }} />
            <span style={{ color:statusColor, fontSize:10, fontWeight:600 }}>
              {statusLabel}
            </span>
          </div>

          {/* Phase step indicator */}
          <div style={{ position:"absolute", top:10, left:"50%",
            transform:"translateX(-50%)", zIndex:10,
            display:"flex", alignItems:"center", gap:5,
            background:"rgba(8,8,6,0.88)",
            border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:20, padding:"4px 12px",
            backdropFilter:"blur(8px)" }}>
            {(["pickup","delivery"] as Phase[]).map((p, i) => (
              <div key={p} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:18, height:18, borderRadius:"50%",
                  background: phase === p ? "#FF6B00" :
                               (phase === "delivery" && p === "pickup") ? "#3ecf6e" :
                               "rgba(255,255,255,0.1)",
                  border:`1px solid ${phase===p?"#FF6B00":"rgba(255,255,255,0.15)"}`,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:8, fontWeight:700,
                    color: phase === p ? "#fff" :
                           (phase === "delivery" && p === "pickup") ? "#080806" :
                           "#6a5a40" }}>
                    {(phase === "delivery" && p === "pickup") ? "✓" : i + 1}
                  </span>
                </div>
                {i === 0 && (
                  <div style={{ width:16, height:1,
                    background: phase === "delivery"
                      ? "#3ecf6e" : "rgba(255,255,255,0.15)" }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 16px 88px",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          <AnimatePresence mode="wait">
            {phase === "pickup" ? (
              <PickupPhase
                onDone={() => { setPhase("delivery"); fireToast("Đã lấy hàng → bắt đầu giao!") }}
                onCall={() => fireToast("Đang gọi cho quán...")}
                onChat={() => fireToast("Mở chat...")}
                fireToast={fireToast}
              />
            ) : (
              <DeliveryPhase
                onDone={() => { window.location.href = `/driver/confirm/${ORDER.id}` }}
                onCall={() => fireToast("Đang gọi cho khách...")}
                onChat={() => fireToast("Mở chat với khách...")}
                paymentPaid={paymentPaid}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ── BOTTOM NAV ── */}
        <div style={{ position:"absolute", bottom:16, left:14, right:14, height:56,
          background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
          WebkitBackdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999,
          display:"flex", alignItems:"center", justifyContent:"space-around",
          padding:"0 6px", zIndex:50,
          boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            { icon:"🏠",  label:"Dashboard", href:"/driver",           active:false },
            { icon:"🗺️",  label:"Bản đồ",    href:"#",                 active:true  },
            { icon:"💰",  label:"Thu nhập",   href:"/driver/earnings",  active:false },
            { icon:"🤝",  label:"Hồ sơ",      href:"/driver/profile",   active:false },
          ].map(tab => (
            <a key={tab.label} href={tab.href}
              style={{ textDecoration:"none", display:"flex", flexDirection:"column",
                alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18,
                background: tab.active ? "rgba(255,107,0,0.12)" : "transparent",
                transform: tab.active ? "translateY(-2px)" : "translateY(0)",
                transition:"all .2s", position:"relative" }}>
              <span style={{ fontSize:18,
                filter: tab.active
                  ? "drop-shadow(0 0 4px rgba(255,107,0,0.6))" : "none" }}>
                {tab.icon}
              </span>
              <span style={{ fontSize:7.5,
                color: tab.active ? "#FF8C00" : "#6a5a40",
                fontWeight: tab.active ? 600 : 400 }}>
                {tab.label}
              </span>
              {tab.active && (
                <div style={{ position:"absolute", bottom:-2, width:28, height:3,
                  borderRadius:2,
                  background:"radial-gradient(ellipse,rgba(255,107,0,0.9) 0%,transparent 70%)",
                  filter:"blur(1px)" }} />
              )}
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
