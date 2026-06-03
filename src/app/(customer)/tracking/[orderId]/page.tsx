"use client"

// src/app/(customer)/tracking/[orderId]/page.tsx

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ChatDrawer } from "@/components/chat/ChatDrawer"

const LiveTrackMap = dynamic(() => import("@/components/map/LiveTrackMap"), {
  ssr: false,
  loading: () => (
    <div style={{ width:"100%",height:MAP_H,background:"#07090e",
      display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8 }}>
      <div style={{ width:28,height:28,borderRadius:"50%",
        border:"2px solid rgba(255,107,0,0.2)",borderTopColor:"#FF8C00",
        animation:"trSpin .8s linear infinite" }} />
      <div style={{ color:"#6a5a40",fontSize:10 }}>Đang tải bản đồ...</div>
    </div>
  ),
})

const MAP_H = 260

type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "delivering" | "delivered"

interface StatusStep {
  key:   OrderStatus
  label: string
  icon:  string
  desc:  string
}

const STEPS: StatusStep[] = [
  { key:"accepted",   label:"Đã xác nhận · Đang làm",  icon:"👨‍🍳", desc:"Quán đã nhận và đang chuẩn bị" },
  { key:"ready",      label:"Đang tìm tài xế",          icon:"🔍", desc:"Món xong, đang điều phối tài xế" },
  { key:"delivering", label:"Đang giao",                 icon:"🛵", desc:"Tài xế đang trên đường" },
  { key:"delivered",  label:"Đã giao",                  icon:"🎉", desc:"Giao thành công!" },
]

// preparing hiển thị cùng bước với accepted
const STATUS_ORDER: OrderStatus[] = ["accepted","ready","delivering","delivered"]
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function useCountdown(initMin: number) {
  const [secs, setSecs] = useState(initMin * 60)
  useEffect(() => {
    if (initMin <= 0) return
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [initMin])
  return { min: Math.floor(secs / 60), sec: secs % 60 }
}

// ─── Default coords (Phước An) khi chưa có GPS tài xế ────
const DEFAULT_LAT = 12.6830
const DEFAULT_LNG = 108.4800

export default function TrackingPage() {
  const supabase = createClient()
  const { orderId } = useParams<{ orderId: string }>()

  const [orderData,     setOrderData]     = useState<{
    id: string; shopName: string; shopEmoji: string; destAddr: string
    destLat: number; destLng: number; total: number; etaMin: number
    items: { name: string; emoji: string }[]
    paymentMethod: string; paymentStatus?: string
  } | null>(null)
  const [driverData,    setDriverData]    = useState<{
    name: string; phone: string; rating: number; trips: number; plate: string
  } | null>(null)
  const [status,        setStatus]        = useState<OrderStatus>("preparing")
  const [driverPos,     setDriverPos]     = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG })
  const [loading,       setLoading]       = useState(true)
  const [showCancel,    setShowCancel]    = useState(false)
  const [showContact,   setShowContact]   = useState(false)
  const [cancelLocked,  setCancelLocked]  = useState(false)
  const [orderCreatedAt, setOrderCreatedAt] = useState<string | null>(null)
  const [cancelSecsLeft, setCancelSecsLeft] = useState(0)
  const [showChat,      setShowChat]      = useState(false)
  const [currentUserId, setCurrentUserId] = useState("")
  const [toast,         setToast]         = useState("")
  const [mapExpanded,   setMapExpanded]   = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<"pending"|"paid">("pending")

  const fireToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(""), 2200)
  }, [])

  // ── Fetch order data ──────────────────────────────────────
  useEffect(() => {
    if (!orderId) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const { data: order } = await supabase
        .from("orders")
        .select(`
          id, status, created_at, delivery_address, delivery_lat, delivery_lng,
          total_amount, pay_method, driver_id,
          shops(name),
          order_items(name, qty)
        `)
        .eq("id", orderId)
        .single()

      if (!order) { setLoading(false); return }
      setOrderCreatedAt(order.created_at)

      // Kiểm tra cancel_locked
      const { data: prof } = await supabase.from("profiles").select("cancel_locked").eq("id", user.id).maybeSingle()
      if (prof?.cancel_locked) setCancelLocked(true)

      const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops
      const items = (order.order_items ?? []) as { name: string; qty: number }[]

      setOrderData({
        id: order.id,
        shopName: shop?.name ?? "Cửa hàng",
        shopEmoji: "🍽️",
        destAddr: order.delivery_address,
        destLat: order.delivery_lat ?? DEFAULT_LAT,
        destLng: order.delivery_lng ?? DEFAULT_LNG,
        total: order.total_amount,
        etaMin: 20,
        items: items.map(i => ({ name: `${i.name} ×${i.qty}`, emoji: "🍽️" })),
        paymentMethod: order.pay_method,
      })
      const rawSt = order.status === "preparing" ? "accepted" : order.status
      const st = rawSt as OrderStatus
      setStatus(st)
      if (order.pay_method !== "cash" && st === "delivered") setPaymentStatus("paid")

      // Fetch driver
      if (order.driver_id) {
        const { data: driver } = await supabase
          .from("drivers")
          .select("id, license_plate, rating_avg, total_trips, location")
          .eq("id", order.driver_id)
          .single()
        if (driver) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("id", order.driver_id)
            .single()
          setDriverData({
            name: profile?.full_name ?? "Tài xế",
            phone: profile?.phone ?? "",
            rating: Number(driver.rating_avg ?? 5),
            trips: driver.total_trips ?? 0,
            plate: driver.license_plate ?? "",
          })
          // Parse driver location if available
          if (driver.location) {
            try {
              const loc = typeof driver.location === "string"
                ? JSON.parse(driver.location)
                : driver.location
              if (loc?.coordinates) {
                setDriverPos({ lat: loc.coordinates[1], lng: loc.coordinates[0] })
              }
            } catch { /* ignore parse error */ }
          }
        }
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  // ── Realtime: order status + driver location ──────────────
  useEffect(() => {
    if (!orderId) return

    const orderCh = supabase
      .channel(`order-status:${orderId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "orders",
        filter: `id=eq.${orderId}`
      }, (payload) => {
        const raw = payload.new.status === "preparing" ? "accepted" : payload.new.status
        setStatus(raw as OrderStatus)
        if ((payload.new as { pay_method?: string; status?: string }).pay_method !== "cash"
            && (payload.new as { status?: string }).status === "delivered") {
          setPaymentStatus("paid")
        }
      })
      .subscribe()

    const locationCh = supabase
      .channel(`driver-location:${orderId}`)
      .on("broadcast", { event: "location" }, ({ payload }) => {
        if (payload.lat && payload.lng) {
          setDriverPos({ lat: payload.lat, lng: payload.lng })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(orderCh)
      supabase.removeChannel(locationCh)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const { min, sec } = useCountdown(orderData?.etaMin ?? 20)
  const currentIdx   = STATUS_ORDER.indexOf(status)
  const isDelivered  = status === "delivered"

  // 30s countdown
  useEffect(() => {
    if (!orderCreatedAt) return
    const update = () => {
      const elapsed = Math.floor((Date.now() - new Date(orderCreatedAt).getTime()) / 1000)
      setCancelSecsLeft(Math.max(0, 30 - elapsed))
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [orderCreatedAt])

  const canSelfCancel   = status === "pending" && cancelSecsLeft > 0 && !cancelLocked
  const needAdminCancel = !isDelivered && !canSelfCancel

  const handleCancel = async () => {
    if (!orderId || !currentUserId) return
    if (cancelLocked) { fireToast("Tài khoản bị khóa hủy đơn · Liên hệ admin!"); return }
    if (cancelSecsLeft <= 0) { fireToast("Đã hết 30 giây cho phép hủy!"); return }
    const { error } = await supabase.from("orders").update({
      status: "cancelled",
      cancel_reason: "Khách hàng hủy",
      cancelled_at: new Date().toISOString(),
    }).eq("id", orderId)
    if (error) { fireToast("Không thể hủy đơn. Thử lại sau."); return }

    await supabase.from("cancel_logs").insert({ order_id: orderId, user_id: currentUserId, role: "customer", reason: "Khách hàng hủy" })

    const since3d = new Date(Date.now() - 3 * 86400_000).toISOString()
    const { count } = await supabase.from("cancel_logs").select("*", { count: "exact", head: true })
      .eq("user_id", currentUserId).eq("role", "customer").gte("cancelled_at", since3d)
    const total = count ?? 0
    if (total >= 4) {
      await supabase.from("profiles").update({ cancel_locked: true, cancel_locked_at: new Date().toISOString(), cancel_locked_reason: "Hủy đơn quá nhiều lần" }).eq("id", currentUserId)
      setCancelLocked(true)
    }

    setStatus("delivered")
    fireToast(total >= 4 ? "⚠️ Tài khoản bị khóa hủy đơn · Liên hệ admin" : "Đã hủy đơn hàng")
    setShowCancel(false)
    setTimeout(() => { window.location.href = "/orders" }, 1200)
  }

  if (loading) {
    return (
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",
        alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10 }}>
        <div style={{ width:32,height:32,borderRadius:"50%",
          border:"2px solid rgba(255,107,0,0.2)",borderTopColor:"#FF8C00",
          animation:"trSpin .8s linear infinite" }} />
        <div style={{ color:"#6a5a40",fontSize:11 }}>Đang tải đơn hàng...</div>
        <style>{`@keyframes trSpin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!orderData) {
    return (
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",
        alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10 }}>
        <span style={{ fontSize:40 }}>😕</span>
        <div style={{ color:"#6a5a40",fontSize:12 }}>Không tìm thấy đơn hàng</div>
        <a href="/orders" style={{ color:"#FF8C00",fontSize:11,textDecoration:"none" }}>← Quay lại đơn hàng</a>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%;overflow:hidden}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        @keyframes trSpin{to{transform:rotate(360deg)}}
        @keyframes trPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.85)}}
        @keyframes trShim{0%{left:-60%}100%{left:120%}}
      `}</style>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}
            style={{ position:"fixed",top:50,left:"50%",transform:"translateX(-50%)",zIndex:999,
              whiteSpace:"nowrap",background:"rgba(62,207,110,0.15)",
              border:"1px solid rgba(62,207,110,0.35)",borderRadius:12,
              padding:"7px 16px",color:"#3ecf6e",fontSize:11,fontWeight:600,backdropFilter:"blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Admin modal */}
      <AnimatePresence>
        {showContact && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,0.7)",
              backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end" }}
            onClick={() => setShowContact(false)}>
            <motion.div initial={{y:200}} animate={{y:0}} exit={{y:200}}
              transition={{ type:"spring",damping:22 }}
              onClick={e => e.stopPropagation()}
              style={{ width:"100%",background:"#111009",border:"1px solid rgba(255,107,0,0.15)",
                borderRadius:"20px 20px 0 0",padding:"20px 16px 40px" }}>
              <div style={{ width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",margin:"0 auto 18px" }} />
              <div style={{ fontSize:20,textAlign:"center",marginBottom:6 }}>🛡️</div>
              <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700,textAlign:"center",marginBottom:4 }}>
                Liên hệ quản trị viên
              </div>
              <div style={{ color:"#6a5a40",fontSize:10.5,textAlign:"center",lineHeight:1.6,marginBottom:20 }}>
                Đơn đang được chuẩn bị — chỉ admin có thể hủy.
              </div>
              <div style={{ background:"rgba(255,107,0,0.07)",border:"1px solid rgba(255,107,0,0.2)",
                borderRadius:10,padding:"8px 14px",marginBottom:16,
                display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ color:"#6a5a40",fontSize:11 }}>Mã đơn</span>
                <span style={{ color:"#FF8C00",fontSize:12,fontWeight:700 }}>
                  #{orderData.id.slice(0,8).toUpperCase()}
                </span>
              </div>
              <a href="tel:0905000000"
                style={{ display:"flex",alignItems:"center",gap:12,
                  background:"rgba(62,207,110,0.07)",border:"1px solid rgba(62,207,110,0.2)",
                  borderRadius:13,padding:"13px 16px",marginBottom:20,textDecoration:"none" }}>
                <div style={{ width:38,height:38,borderRadius:10,background:"rgba(62,207,110,0.15)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>📞</div>
                <div>
                  <div style={{ color:"#f8f0e0",fontSize:13,fontWeight:700 }}>Gọi điện trực tiếp</div>
                  <div style={{ color:"#6a5a40",fontSize:10.5,marginTop:2 }}>0905 000 000</div>
                </div>
                <span style={{ color:"#6a5a40",fontSize:16,marginLeft:"auto" }}>›</span>
              </a>
              <button onClick={() => setShowContact(false)}
                style={{ width:"100%",height:44,borderRadius:12,border:"none",
                  background:"rgba(255,255,255,0.06)",color:"#b0956a",fontSize:12,fontWeight:600,
                  fontFamily:"Lexend",cursor:"pointer" }}>
                Đóng
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel modal */}
      <AnimatePresence>
        {showCancel && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,0.7)",
              backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end" }}>
            <motion.div initial={{y:200}} animate={{y:0}} exit={{y:200}}
              transition={{ type:"spring",damping:22 }}
              style={{ width:"100%",background:"#111009",border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:"20px 20px 0 0",padding:"20px 16px 36px" }}>
              <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700,marginBottom:6 }}>Hủy đơn hàng?</div>
              <div style={{ color:"#6a5a40",fontSize:10.5,lineHeight:1.6,marginBottom:18 }}>
                Quán chưa bắt đầu chuẩn bị. Bạn có thể hủy miễn phí lúc này.
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={() => setShowCancel(false)}
                  style={{ flex:1,height:46,borderRadius:12,border:"none",background:"rgba(255,255,255,0.07)",
                    color:"#b0956a",fontSize:12,fontWeight:600,fontFamily:"Lexend",cursor:"pointer" }}>
                  Giữ đơn
                </button>
                <button onClick={handleCancel}
                  style={{ flex:1,height:46,borderRadius:12,border:"none",background:"rgba(255,64,64,0.15)",
                    color:"#ff6060",fontSize:12,fontWeight:700,fontFamily:"Lexend",cursor:"pointer" }}>
                  Xác nhận hủy
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column" }}>

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)",backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          padding:"calc(env(safe-area-inset-top,0px) + 12px) 16px 12px",flexShrink:0,zIndex:40 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <a href="/orders" style={{ width:32,height:32,borderRadius:9,
              background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:14,textDecoration:"none",color:"#f8f0e0" }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:15,fontWeight:700 }}>Theo dõi đơn hàng</div>
              <div style={{ color:"#6a5a40",fontSize:9,marginTop:1 }}>
                #{orderData.id.slice(0,8).toUpperCase()} · {orderData.shopEmoji} {orderData.shopName}
              </div>
            </div>
            {!isDelivered && (
              <div style={{ display:"flex",alignItems:"center",gap:5,
                background:"rgba(255,107,0,0.1)",border:"1px solid rgba(255,107,0,0.25)",
                borderRadius:20,padding:"4px 10px" }}>
                <div style={{ width:6,height:6,borderRadius:"50%",
                  background:"#FF6B00",animation:"trPulse 1.5s infinite" }} />
                <span style={{ color:"#FF8C00",fontSize:9,fontWeight:700 }}>LIVE</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable */}
        <div style={{ flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* Map */}
          <div style={{ position:"relative",flexShrink:0 }}>
            <LiveTrackMap
              driverLat={driverPos.lat}
              driverLng={driverPos.lng}
              destLat={orderData.destLat}
              destLng={orderData.destLng}
              height={mapExpanded ? 380 : MAP_H} />

            <button onClick={() => setMapExpanded(e => !e)}
              style={{ position:"absolute",bottom:10,right:10,zIndex:20,
                background:"rgba(8,8,6,0.88)",backdropFilter:"blur(8px)",
                border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,padding:"5px 9px",
                color:"#b0956a",fontSize:9.5,fontWeight:600,fontFamily:"Lexend",cursor:"pointer" }}>
              {mapExpanded ? "⬆ Thu nhỏ" : "⬇ Mở rộng"}
            </button>

            {!isDelivered && (
              <div style={{ position:"absolute",top:10,left:"50%",transform:"translateX(-50%)",zIndex:20,
                background:"rgba(8,8,6,0.9)",backdropFilter:"blur(10px)",
                border:"1px solid rgba(255,107,0,0.3)",borderRadius:20,padding:"5px 16px",
                display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ color:"#FF8C00",fontSize:18,fontWeight:800,fontVariantNumeric:"tabular-nums" }}>
                  {min}:{sec.toString().padStart(2,"0")}
                </span>
                <span style={{ color:"#6a5a40",fontSize:9 }}>còn lại</span>
              </div>
            )}
          </div>

          <div style={{ padding:"10px 14px 100px" }}>

            {/* Status timeline */}
            <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:14,padding:"13px 14px",marginBottom:10 }}>
              {STEPS.map((step, i) => {
                const done    = i < currentIdx
                const current = i === currentIdx
                const pending = i > currentIdx
                const isLast  = i === STEPS.length - 1
                return (
                  <div key={step.key} style={{ display:"flex",gap:12,alignItems:"flex-start",
                    paddingBottom: isLast ? 0 : 14,position:"relative" }}>
                    {!isLast && (
                      <div style={{ position:"absolute",left:16,top:32,width:2,height:"calc(100% - 14px)",
                        background: done ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.06)" }} />
                    )}
                    <div style={{ width:34,height:34,borderRadius:10,flexShrink:0,
                      background: done ? "rgba(255,107,0,0.15)" : current ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                      border:`1px solid ${done ? "rgba(255,107,0,0.4)" : current ? "rgba(255,107,0,0.35)" : "rgba(255,255,255,0.07)"}`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
                      animation: current ? "trPulse 1.8s ease-in-out infinite" : "none",position:"relative",zIndex:1 }}>
                      {done ? "✓" : step.icon}
                    </div>
                    <div style={{ flex:1,paddingTop:6 }}>
                      <div style={{ color: pending ? "#6a5a40" : "#f8f0e0",
                        fontSize:11.5,fontWeight: current ? 700 : 500,marginBottom:2 }}>
                        {step.label}
                        {current && !isDelivered && (
                          <span style={{ marginLeft:7,background:"rgba(255,107,0,0.12)",
                            color:"#FF8C00",fontSize:7.5,fontWeight:700,padding:"1px 6px",borderRadius:4 }}>
                            ĐANG XỬ LÝ
                          </span>
                        )}
                      </div>
                      <div style={{ color:"#6a5a40",fontSize:9 }}>{step.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Driver card */}
            <AnimatePresence>
              {!isDelivered && driverData && (
                <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
                  style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:14,padding:"12px 14px",marginBottom:10 }}>
                  <div>
                    <div style={{ color:"#6a5a40",fontSize:8,fontWeight:700,
                      textTransform:"uppercase",letterSpacing:0.5,marginBottom:8 }}>
                      🛵 Tài xế của bạn
                    </div>
                    {/* Row 1: Avatar + tên + nút gọi + chat */}
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                      <div style={{ width:40,height:40,borderRadius:11,flexShrink:0,
                        background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.25)",
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>🛵</div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ color:"#f8f0e0",fontSize:13,fontWeight:700,lineHeight:1.2 }}>
                          {driverData.name}
                        </div>
                        <div style={{ display:"flex",gap:6,alignItems:"center",marginTop:3 }}>
                          {driverData.plate && (
                            <span style={{ color:"#3ecf6e",fontSize:9,fontWeight:700,
                              background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.2)",
                              padding:"1px 7px",borderRadius:5 }}>{driverData.plate}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                        {driverData.phone && (
                          <a href={`tel:${driverData.phone}`}
                            style={{ width:36,height:36,borderRadius:10,
                              background:"rgba(62,207,110,0.12)",border:"1px solid rgba(62,207,110,0.3)",
                              display:"flex",alignItems:"center",justifyContent:"center",
                              textDecoration:"none",fontSize:17 }}>📞</a>
                        )}
                        <button onClick={() => setShowChat(true)}
                          style={{ width:36,height:36,borderRadius:10,
                            background:"rgba(255,107,0,0.08)",border:"1px solid rgba(255,107,0,0.25)",
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:17,cursor:"pointer" }}>💬</button>
                      </div>
                    </div>
                    {/* Row 2: Số điện thoại + nút gọi text */}
                    {driverData.phone && (
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
                        padding:"7px 10px",borderRadius:8,
                        background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)" }}>
                        <span style={{ color:"#b0956a",fontSize:10.5,fontWeight:600 }}>
                          📱 {driverData.phone}
                        </span>
                        <a href={`tel:${driverData.phone}`}
                          style={{ padding:"4px 12px",borderRadius:7,
                            background:"rgba(62,207,110,0.12)",border:"1px solid rgba(62,207,110,0.3)",
                            color:"#3ecf6e",fontSize:9.5,fontWeight:700,textDecoration:"none" }}>
                          Gọi ngay
                        </a>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Order mini summary */}
            <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:14,padding:"12px 14px",marginBottom:10 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9 }}>
                <div style={{ color:"#f8f0e0",fontSize:11.5,fontWeight:700 }}>
                  {orderData.shopEmoji} {orderData.shopName}
                </div>
                <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4 }}>
                  <div style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",
                    WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                    backgroundClip:"text",fontSize:13,fontWeight:800 }}>
                    {fmt(orderData.total)}
                  </div>
                  <AnimatePresence>
                    {paymentStatus === "paid" ? (
                      <motion.div key="paid" initial={{opacity:0,scale:.8}} animate={{opacity:1,scale:1}}
                        style={{ display:"flex",alignItems:"center",gap:4,
                          background:"rgba(62,207,110,0.12)",border:"1px solid rgba(62,207,110,0.3)",
                          borderRadius:6,padding:"2px 8px" }}>
                        <div style={{ width:5,height:5,borderRadius:"50%",background:"#3ecf6e" }} />
                        <span style={{ color:"#3ecf6e",fontSize:8.5,fontWeight:700 }}>Đã thanh toán</span>
                      </motion.div>
                    ) : (
                      <motion.div key="pending"
                        style={{ display:"flex",alignItems:"center",gap:4,
                          background:"rgba(255,107,0,0.08)",border:"1px solid rgba(255,107,0,0.18)",
                          borderRadius:6,padding:"2px 8px" }}>
                        <span style={{ color:"#b0956a",fontSize:8.5,fontWeight:500 }}>💵 Tiền mặt</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              {orderData.items.map((item, i) => (
                <div key={i} style={{ color:"#6a5a40",fontSize:9.5,padding:"3px 0" }}>
                  {item.emoji} {item.name}
                </div>
              ))}
              <div style={{ marginTop:9,paddingTop:9,borderTop:"1px solid rgba(255,255,255,0.06)",
                display:"flex",gap:7,alignItems:"center" }}>
                <span style={{ fontSize:12 }}>📍</span>
                <div style={{ color:"#6a5a40",fontSize:9.5,flex:1 }}>{orderData.destAddr}</div>
              </div>
            </div>

            {/* Success CTA */}
            <AnimatePresence>
              {isDelivered && (
                <motion.div initial={{opacity:0,scale:.95}} animate={{opacity:1,scale:1}}
                  style={{ textAlign:"center",marginBottom:16 }}>
                  <div style={{ color:"#3ecf6e",fontSize:20,fontWeight:800,marginBottom:8 }}>
                    🎉 Đã giao thành công!
                  </div>
                  <a href={`/review/${orderData.id}`}
                    style={{ display:"inline-block",textDecoration:"none",
                      background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
                      color:"#fff",borderRadius:12,padding:"11px 28px",
                      fontSize:12,fontWeight:700,boxShadow:"0 4px 20px rgba(255,107,0,0.4)" }}>
                    ⭐ Đánh giá đơn hàng
                  </a>
                </motion.div>
              )}
            </AnimatePresence>

            {canSelfCancel && (
              <button onClick={() => setShowCancel(true)}
                style={{ width:"100%",height:38,borderRadius:11,cursor:"pointer",
                  background:"transparent",border:"1px solid rgba(255,64,64,0.2)",
                  color:"#ff6060",fontSize:10.5,fontWeight:600,fontFamily:"Lexend" }}>
                Hủy đơn hàng
              </button>
            )}
            {needAdminCancel && (
              <button onClick={() => setShowContact(true)}
                style={{ width:"100%",height:38,borderRadius:11,cursor:"pointer",
                  background:"rgba(255,107,0,0.07)",border:"1px solid rgba(255,107,0,0.25)",
                  color:"#FF8C00",fontSize:10.5,fontWeight:600,fontFamily:"Lexend",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                <span>🛡️</span> Liên hệ quản trị viên
              </button>
            )}
          </div>
        </div>

        {/* Bottom Nav */}
        <div style={{ position:"absolute",bottom:"max(16px,env(safe-area-inset-bottom))",left:14,right:14,height:56,
          background:"rgba(8,8,6,0.92)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)",borderRadius:9999,
          display:"flex",alignItems:"center",justifyContent:"space-around",
          padding:"0 6px",zIndex:50,boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            { icon:"🏠",label:"Trang chủ",href:"/",        active:false },
            { icon:"📋",label:"Đơn hàng", href:"/orders",  active:false },
            { icon:"🗺️",label:"Theo dõi", href:"#",        active:true  },
            { icon:"⚙️",label:"Cài đặt",  href:"/profile",active:false },
          ].map(tab => (
            <a key={tab.label} href={tab.href}
              style={{ textDecoration:"none",display:"flex",flexDirection:"column",
                alignItems:"center",gap:2,padding:"5px 11px",borderRadius:18,
                background:tab.active?"rgba(255,107,0,0.12)":"transparent",
                transform:tab.active?"translateY(-2px)":"translateY(0)",
                transition:"all .2s",position:"relative" }}>
              <span style={{ fontSize:18,filter:tab.active?"drop-shadow(0 0 4px rgba(255,107,0,0.6))":"none" }}>
                {tab.icon}
              </span>
              <span style={{ fontSize:7.5,color:tab.active?"#FF8C00":"#6a5a40",fontWeight:tab.active?600:400 }}>
                {tab.label}
              </span>
              {tab.active && (
                <div style={{ position:"absolute",bottom:-2,width:28,height:3,borderRadius:2,
                  background:"radial-gradient(ellipse,rgba(255,107,0,0.9) 0%,transparent 70%)",filter:"blur(1px)" }} />
              )}
            </a>
          ))}
        </div>
      </div>

      {/* Chat drawer — customer ↔ driver */}
      <ChatDrawer
        orderId={orderId}
        currentUserId={currentUserId}
        currentRole="customer"
        partnerName={driverData?.name ?? "Tài xế"}
        isOpen={showChat}
        onClose={() => setShowChat(false)}
      />
    </>
  )
}
