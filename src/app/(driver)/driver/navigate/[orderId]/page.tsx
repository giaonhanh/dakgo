"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ChatDrawer } from "@/components/chat/ChatDrawer"
import { getRouteKm } from "@/lib/vietmapRoute"
import { OrderItemList, type ItemBreakdown } from "@/components/ui/OrderItemList"
import type { NavMapHandle } from "@/components/map/NavMap"

const NavMap = dynamic(() => import("@/components/map/NavMap"), {
  ssr: false,
  loading: () => (
    <div style={{ width:"100%", height:MAP_HEIGHT,
      background:"#07090e", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#6a5a40", fontSize:10 }}>Đang tải bản đồ...</div>
    </div>
  ),
})

const MAP_HEIGHT = 225
const DEFAULT_LAT = 12.6521
const DEFAULT_LNG = 108.5073

type Phase = "pickup" | "delivery"

interface OrderItem {
  name:      string
  qty:       number
  price:     number
  subtotal:  number
  note?:     string
  breakdown?: ItemBreakdown | null
}

interface OrderInfo {
  id:               string
  fullId:           string
  shopName:         string
  shopAddr:         string
  shopLat:          number
  shopLng:          number
  shopPhone:        string
  custName:         string
  custAddr:         string
  custNote:         string
  custLat:          number
  custLng:          number
  custPhone:        string
  items:            OrderItem[]
  total:            number
  subtotal:         number
  payShop:          number   // tiền trả quán = subtotal - shopCommission
  shopCommission:   number   // hoa hồng quán (đã trừ từ ví tài xế)
  driverCommission: number   // hoa hồng tài xế (đã trừ từ ví)
  xuUsed:           number
  xuBonusUsed:      number
  discount:         number
  payment:          string
  paymentRaw:       string
  paymentStatus:    string
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

/** Tạo URL mở Google Maps navigation — Google tự dùng GPS hiện tại làm điểm xuất phát */
function googleNavUrl(destLat: number, destLng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`
}

function useSpeed() {
  const [speed, setSpeed] = useState<number | null>(null)
  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      pos => setSpeed(pos.coords.speed !== null ? Math.round(pos.coords.speed * 3.6) : null),
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])
  return speed
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color:"#6a5a40", fontSize:8.5, fontWeight:700,
      textTransform:"uppercase", letterSpacing:.6, marginBottom:7 }}>
      {children}
    </div>
  )
}

function DirectionPill({ phase, order, distKm }: { phase: Phase; order: OrderInfo; distKm: number | null }) {
  const isPickup = phase === "pickup"
  const color    = isPickup ? "#FF8C00" : "#3ecf6e"
  const bg       = isPickup ? "rgba(255,107,0,0.10)" : "rgba(62,207,110,0.08)"
  const bd       = isPickup ? "rgba(255,107,0,0.25)" : "rgba(62,207,110,0.22)"
  const arrowBg  = isPickup ? "#FF6B00" : "#3ecf6e"
  const arrowClr = isPickup ? "#fff" : "#080806"
  const dir      = isPickup ? "↑" : "↖"
  const dist     = isPickup ? "Đến lấy hàng" : "Giao đến khách"
  const kmLabel  = distKm !== null && distKm >= 0 ? `~${distKm.toFixed(1)}km` : "—"

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10,
      background:bg, border:`1px solid ${bd}`,
      borderRadius:13, padding:"8px 12px", marginBottom:10 }}>
      <div style={{ width:34, height:34, borderRadius:9, flexShrink:0,
        background:arrowBg, display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:18, color:arrowClr, fontWeight:700 }}>{dir}</div>
      <div style={{ flex:1 }}>
        <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700 }}>{dist}</div>
        <div style={{ color:"#6a5a40", fontSize:9.5, marginTop:1 }}>
          {isPickup ? order.shopAddr : order.custAddr}
        </div>
      </div>
      <div style={{ textAlign:"right" }}>
        <div style={{ color, fontSize:12, fontWeight:700 }}>{kmLabel}</div>
        <div style={{ color:"#6a5a40", fontSize:8 }}>còn lại</div>
      </div>
    </div>
  )
}


function ActionRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display:"flex", gap:8, marginBottom:10 }}>{children}</div>
}

function IconBtn({ icon, color, bg, bd, onClick }: {
  icon:string; color:string; bg:string; bd:string; onClick?:()=>void
}) {
  return (
    <button onClick={onClick} style={{ width:42, height:42, borderRadius:11,
      border:`1px solid ${bd}`, background:bg, cursor:"pointer",
      display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
      {icon}
    </button>
  )
}

function NavStartBtn({ destLat, destLng, label, color }: {
  destLat: number; destLng: number; label: string; color: "orange" | "green"
}) {
  const bg     = color === "green" ? "linear-gradient(90deg,#1a8c50,#3ecf6e)" : "linear-gradient(90deg,#FF6B00,#FF8C00)"
  const shadow = color === "green" ? "0 4px 14px rgba(62,207,110,0.35)" : "0 4px 14px rgba(255,107,0,0.35)"
  const url    = googleNavUrl(destLat, destLng)

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ flex:2, textDecoration:"none" }}>
      <button style={{ width:"100%", height:42, borderRadius:11, border:"none",
        background:bg, color:"#fff", fontSize:10.5, fontWeight:700, fontFamily:"Lexend",
        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        gap:6, boxShadow:shadow }}>
        🗺️ {label}
      </button>
    </a>
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

function PickupPhase({ onDone, onCall, onChat, fireToast, order, distKm }: {
  onDone:()=>void; onCall:()=>void; onChat:()=>void;
  fireToast:(m:string)=>void; order: OrderInfo; distKm: number | null
}) {
  void fireToast
  return (
    <motion.div key="pickup"
      initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
      exit={{ opacity:0, x:-20 }} transition={{ duration:.22 }}>

      <DirectionPill phase="pickup" order={order} distKm={distKm} />

      <div style={{ background:"rgba(74,143,245,0.07)",
        border:"1px solid rgba(74,143,245,0.22)",
        borderRadius:14, padding:"12px 14px", marginBottom:10 }}>
        <div style={{ color:"#4a8ff5", fontSize:9, fontWeight:700,
          textTransform:"uppercase", letterSpacing:.5, marginBottom:9 }}>
          🏪 Đến lấy hàng tại
        </div>
        <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:700, marginBottom:3 }}>
          {order.shopName}
        </div>
        <div style={{ color:"#6a5a40", fontSize:9.5, marginBottom:11 }}>
          📍 {order.shopAddr}
        </div>

        {/* Chi tiết món ăn */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ color:"#6a5a40", fontSize:8.5, fontWeight:700,
            textTransform:"uppercase", letterSpacing:.5, marginBottom:7 }}>
            Đơn #{order.id} · {order.items.length} món
          </div>
          <OrderItemList items={order.items} />
        </div>

        {/* Bảng thanh toán cho tài xế */}
        <div style={{ background:"rgba(255,255,255,0.02)",
          border:"1px solid rgba(255,255,255,0.06)",
          borderRadius:10, padding:"8px 11px", marginBottom:10 }}>
          <div style={{ color:"#6a5a40", fontSize:8.5, fontWeight:700,
            textTransform:"uppercase", letterSpacing:.5, marginBottom:7 }}>
            Thông tin thanh toán
          </div>
          {[
            { label:"Tiền hàng (subtotal)",      val: order.subtotal,         c:"#b0956a", bold:false },
            order.discount > 0
              ? { label:"Voucher giảm",           val:-order.discount,        c:"#3ecf6e", bold:false }
              : null,
            { label:"Phí ship",                   val: order.total - order.subtotal + order.discount, c:"#b0956a", bold:false },
            { label:"Trả cho quán (tiền mặt)",    val: order.payShop,         c:"#FF8C00", bold:true  },
            { label:`HH quán (${order.shopCommission > 0 ? Math.round(order.shopCommission * 100 / (order.subtotal || 1)) : "?"}%) — đã trừ ví`, val: order.shopCommission, c:"#ff6060", bold:false },
            { label:"HH tài xế — đã trừ ví",     val: order.driverCommission, c:"#ff6060", bold:false },
          ].filter((r): r is { label:string; val:number; c:string; bold:boolean } => r !== null)
           .map((r, ri) => (
            <div key={ri} style={{ display:"flex", justifyContent:"space-between",
              padding:"3px 0",
              borderBottom: ri === 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
              paddingBottom: ri === 2 ? 5 : undefined,
              marginBottom: ri === 2 ? 2 : undefined,
            }}>
              <span style={{ color:"#6a5a40", fontSize:9 }}>{r.label}</span>
              <span style={{ color: r.c, fontSize:9, fontWeight: r.bold ? 700 : 500 }}>
                {r.val < 0 ? "−" : ""}{fmt(Math.abs(r.val))}
              </span>
            </div>
          ))}
          <div style={{ height:1, background:"rgba(255,255,255,0.07)", margin:"5px 0" }} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ color:"#b0956a", fontSize:9 }}>{order.payment}</span>
            {(() => {
              const totalXu = order.xuUsed + order.xuBonusUsed
              const cashPay = Math.max(0, order.total - totalXu)
              if (order.paymentStatus === "paid") return <span style={{ color:"#3ecf6e", fontSize:9, fontWeight:700 }}>✅ Đã TT</span>
              if (totalXu > 0 && cashPay === 0) return <span style={{ color:"#3ecf6e", fontSize:9, fontWeight:700 }}>✅ Toàn bộ bằng xu</span>
              if (totalXu > 0) return (
                <div style={{ textAlign:"right" }}>
                  <div style={{ color:"#FFB347", fontSize:9 }}>🪙 Xu: {fmt(totalXu)}</div>
                  <div style={{ color:"#ff6060", fontSize:9, fontWeight:700 }}>💵 Thu: {fmt(cashPay)}</div>
                </div>
              )
              return <span style={{ color:"#ff6060", fontSize:9, fontWeight:700 }}>💵 Thu: {fmt(order.total)}</span>
            })()}
          </div>
        </div>
      </div>

      <ActionRow>
        <NavStartBtn destLat={order.shopLat} destLng={order.shopLng}
          label="Bắt đầu đi" color="orange" />
        <IconBtn icon="📞" color="#3ecf6e"
          bg="rgba(62,207,110,0.08)" bd="rgba(62,207,110,0.25)"
          onClick={onCall} />
        <IconBtn icon="💬" color="#6a5a40"
          bg="rgba(255,255,255,0.05)" bd="rgba(255,255,255,0.1)"
          onClick={onChat} />
      </ActionRow>

      <CTA color="green" icon="✓" label="Đã đến quán · Lấy hàng xong" onClick={onDone} />
    </motion.div>
  )
}

function DeliveryPhase({ onDone, onCall, onChat, paymentPaid, order, distKm }: {
  onDone:()=>void; onCall:()=>void; onChat:()=>void;
  paymentPaid:boolean; order: OrderInfo; distKm: number | null
}) {
  return (
    <motion.div key="delivery"
      initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
      exit={{ opacity:0, x:-20 }} transition={{ duration:.22 }}>

      <DirectionPill phase="delivery" order={order} distKm={distKm} />

      <div style={{ background:"rgba(62,207,110,0.07)",
        border:"1px solid rgba(62,207,110,0.22)",
        borderRadius:14, padding:"12px 14px", marginBottom:10 }}>
        <div style={{ color:"#3ecf6e", fontSize:9, fontWeight:700,
          textTransform:"uppercase", letterSpacing:.5, marginBottom:9 }}>
          👤 Giao đến khách
        </div>
        <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:700, marginBottom:3 }}>
          {order.custName}
        </div>

        <div style={{ display:"flex", gap:8, padding:"6px 0",
          borderBottom:"1px solid rgba(255,255,255,0.05)", marginBottom:6 }}>
          <span style={{ fontSize:13, flexShrink:0 }}>📍</span>
          <div>
            <div style={{ color:"#6a5a40", fontSize:8.5 }}>Địa chỉ</div>
            <div style={{ color:"#b0956a", fontSize:10.5, marginTop:1 }}>{order.custAddr}</div>
          </div>
        </div>

        {order.custNote && (
          <div style={{ display:"flex", gap:8, padding:"6px 0",
            borderBottom:"1px solid rgba(255,255,255,0.05)", marginBottom:6 }}>
            <span style={{ fontSize:13, flexShrink:0 }}>📝</span>
            <div>
              <div style={{ color:"#6a5a40", fontSize:8.5 }}>Ghi chú</div>
              <div style={{ color:"#f5c542", fontSize:10.5, marginTop:1 }}>{order.custNote}</div>
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:8, padding:"6px 0 0", alignItems:"center" }}>
          <span style={{ fontSize:13, flexShrink:0 }}>💳</span>
          <div style={{ flex:1 }}>
            <div style={{ color:"#6a5a40", fontSize:8.5 }}>Thanh toán</div>
            <div style={{ color:"#b0956a", fontSize:10.5, marginTop:1 }}>{order.payment}</div>
          </div>
          {paymentPaid && (
            <div style={{ display:"flex", alignItems:"center", gap:4,
              background:"rgba(62,207,110,0.12)", border:"1px solid rgba(62,207,110,0.35)",
              borderRadius:20, padding:"3px 10px", flexShrink:0 }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"#3ecf6e" }} />
              <span style={{ color:"#3ecf6e", fontSize:9, fontWeight:700 }}>Đã TT</span>
            </div>
          )}
        </div>
      </div>

      {/* Tóm tắt thu tiền */}
      {(() => {
        const totalXu = order.xuUsed + order.xuBonusUsed
        const cashCollect = Math.max(0, order.total - totalXu)
        const alreadyPaid = order.paymentStatus === "paid" || paymentPaid
        return (
          <div style={{ background:"rgba(255,255,255,0.02)",
            border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:12, padding:"10px 12px", marginBottom:10 }}>
            <div style={{ color:"#6a5a40", fontSize:8.5, fontWeight:700,
              textTransform:"uppercase", letterSpacing:.5, marginBottom:7 }}>
              Thu tiền
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <div style={{ flex:1, background: cashCollect > 0 && !alreadyPaid
                  ? "rgba(255,107,0,0.09)" : "rgba(62,207,110,0.07)",
                border: `1px solid ${cashCollect > 0 && !alreadyPaid
                  ? "rgba(255,107,0,0.25)" : "rgba(62,207,110,0.22)"}`,
                borderRadius:10, padding:"8px 11px" }}>
                <div style={{ color:"#6a5a40", fontSize:8 }}>
                  {alreadyPaid ? "Đã TT online" : cashCollect === 0 ? "Đã TT bằng xu" : "Thu tiền mặt"}
                </div>
                <div style={{ color: cashCollect > 0 && !alreadyPaid ? "#FF8C00" : "#3ecf6e",
                  fontSize:17, fontWeight:800, lineHeight:1.2, marginTop:2 }}>
                  {alreadyPaid || cashCollect === 0 ? "✅ Xong" : fmt(cashCollect)}
                </div>
              </div>
              {totalXu > 0 && (
                <div style={{ flex:1, background:"rgba(245,197,66,0.07)",
                  border:"1px solid rgba(245,197,66,0.2)",
                  borderRadius:10, padding:"8px 11px" }}>
                  <div style={{ color:"#6a5a40", fontSize:8 }}>🪙 Xu đã trừ</div>
                  <div style={{ color:"#FFB347", fontSize:17, fontWeight:800, lineHeight:1.2, marginTop:2 }}>
                    {fmt(totalXu)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <div style={{ marginBottom:10 }}>
        <SectionLabel>Nhắn nhanh cho khách</SectionLabel>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["Đang đến, 3 phút nữa","Kẹt xe, trễ 5 phút","Đang ở cổng, ra lấy hàng"].map(m => (
            <div key={m} style={{ padding:"5px 11px", borderRadius:20, cursor:"pointer",
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
              color:"#b0956a", fontSize:9.5 }}>{m}</div>
          ))}
        </div>
      </div>

      <ActionRow>
        <NavStartBtn destLat={order.custLat} destLng={order.custLng}
          label="Bắt đầu đi" color="green" />
        <IconBtn icon="📞" color="#FF8C00"
          bg="rgba(255,107,0,0.08)" bd="rgba(255,107,0,0.25)"
          onClick={onCall} />
        <IconBtn icon="💬" color="#6a5a40"
          bg="rgba(255,255,255,0.05)" bd="rgba(255,255,255,0.1)"
          onClick={onChat} />
      </ActionRow>

      <CTA color="orange" icon="📷" label="Đã đến nơi · Chụp ảnh xác nhận" onClick={onDone} />
    </motion.div>
  )
}

export default function DriverNavigatePage() {
  const { orderId } = useParams<{ orderId: string }>()
  const supabase    = createClient()

  const [order,         setOrder]         = useState<OrderInfo | null>(null)
  const [phase,         setPhase]         = useState<Phase>("pickup")
  const [toast,         setToast]         = useState("")
  const [paymentPaid,   setPaymentPaid]   = useState(false)
  const [showChat,      setShowChat]      = useState(false)
  const [currentUserId, setCurrentUserId] = useState("")
  const [driverLat,     setDriverLat]     = useState(DEFAULT_LAT)
  const [driverLng,     setDriverLng]     = useState(DEFAULT_LNG)
  const [distKm,        setDistKm]        = useState<number | null>(null)
  const speed = useSpeed()

  // Ref giữ vị trí GPS thật — tránh closure stale trong useEffect
  const driverPosRef    = useRef({ lat: DEFAULT_LAT, lng: DEFAULT_LNG })
  // Tránh tính lại khoảng cách quá thường xuyên (chỉ khi di chuyển >50m)
  const lastCalcPos     = useRef({ lat: 0, lng: 0 })
  // Ref cho NavMap để gọi flyToDriver
  const navMapRef       = useRef<NavMapHandle>(null)
  // Ref cho broadcast channel GPS
  const broadcastRef    = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fireToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(""), 2400)
  }

  // Tính khoảng cách thật từ vị trí hiện tại đến mục tiêu
  const calcDist = async (dLat: number, dLng: number, ord: OrderInfo, ph: Phase) => {
    const target = ph === "pickup"
      ? { lat: ord.shopLat, lng: ord.shopLng }
      : { lat: ord.custLat, lng: ord.custLng }
    if (!target.lat || !target.lng) return
    try {
      const km = await getRouteKm(dLat, dLng, target.lat, target.lng)
      setDistKm(km)
    } catch { /* giữ giá trị cũ */ }
  }

  // Cleanup overflow:hidden khi rời trang
  useEffect(() => {
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = ""
      document.body.style.overflow = ""
    }
  }, [])

  useEffect(() => {
    let watchId: number | null = null

    // Tạo broadcast channel một lần, giữ ref để cleanup đúng cách
    if (orderId) {
      broadcastRef.current = supabase.channel(`driver-location:${orderId}`)
      broadcastRef.current.subscribe()
    }

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        pos => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          setDriverLat(lat)
          setDriverLng(lng)
          driverPosRef.current = { lat, lng }

          // Broadcast vị trí tài xế để tracking page cập nhật realtime
          if (broadcastRef.current) {
            broadcastRef.current.send({
              type: "broadcast",
              event: "location",
              payload: { lat, lng, orderId },
            }).catch(() => {})
          }

          // Chỉ tính lại khoảng cách khi di chuyển >0.05 độ (~55m)
          const moved = Math.abs(lat - lastCalcPos.current.lat) > 0.0005
            || Math.abs(lng - lastCalcPos.current.lng) > 0.0005
          if (moved) {
            lastCalcPos.current = { lat, lng }
            setOrder(prev => { if (prev) calcDist(lat, lng, prev, phase); return prev })
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
      )
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })

    async function load() {
      if (!orderId) return
      // Query cột lõi riêng — nếu các cột phụ (hoa hồng/xu/voucher) bị lỗi
      // (vd. thiếu cột trên DB) thì vẫn không làm sập toàn bộ trang.
      const { data: o, error: coreErr } = await supabase
        .from("orders")
        .select(`id, shop_id, customer_id, delivery_address, delivery_lat, delivery_lng,
          ship_fee, subtotal, total_amount, pay_method, payment_status, note`)
        .eq("id", orderId)
        .single()

      if (coreErr || !o) { console.error("[Driver] load order error:", coreErr); return }

      const [{ data: shop }, { data: customer }, extraRes, itemsRes] = await Promise.all([
        supabase.from("shops").select("name, address, commission_rate, phone, lat, lng").eq("id", o.shop_id).single(),
        supabase.from("profiles").select("full_name, phone").eq("id", o.customer_id).single(),
        supabase.from("orders")
          .select("discount_amount, xu_used, xu_bonus_used, driver_commission_amount, shop_commission_amount")
          .eq("id", orderId).single(),
        supabase.from("order_items").select("name, qty, price, subtotal, note, options").eq("order_id", orderId),
      ])

      const extra            = (extraRes.data ?? {}) as Record<string, unknown>
      const orderItems       = itemsRes.data ?? []
      const shopCommission   = Number(extra.shop_commission_amount   ?? 0)
      const driverCommission = Number(extra.driver_commission_amount ?? 0)
      const sub              = Number((o as Record<string, unknown>).subtotal                 ?? 0)
      const shopLat          = (shop as { lat?: number } | null)?.lat ?? 0
      const shopLng          = (shop as { lng?: number } | null)?.lng ?? 0

      const ord: OrderInfo = {
        id:               o.id.slice(0, 8).toUpperCase(),
        fullId:           o.id,
        shopName:         shop?.name ?? "Cửa hàng",
        shopAddr:         shop?.address ?? "—",
        shopLat,
        shopLng,
        shopPhone:        (shop as { phone?: string } | null)?.phone ?? "",
        custName:         customer?.full_name ?? "Khách hàng",
        custAddr:         o.delivery_address ?? "—",
        custNote:         o.note ?? "",
        custLat:          (o.delivery_lat as number | null) ?? 0,
        custLng:          (o.delivery_lng as number | null) ?? 0,
        custPhone:        (customer as { phone?: string } | null)?.phone ?? "",
        items:            (orderItems ?? []).map((i: { name: string; qty: number; price: number; subtotal: number; note?: string; options?: ItemBreakdown | null }) => ({
          name:      i.name,
          qty:       i.qty ?? 1,
          price:     i.price,
          subtotal:  i.subtotal ?? (i.price * (i.qty ?? 1)),
          note:      i.note,
          breakdown: i.options ?? null,
        })),
        total:            Number(o.total_amount ?? 0),
        subtotal:         sub,
        payShop:          Math.max(0, sub - shopCommission),
        shopCommission,
        driverCommission,
        xuUsed:           Number(extra.xu_used       ?? 0),
        xuBonusUsed:      Number(extra.xu_bonus_used ?? 0),
        discount:         Number(extra.discount_amount ?? 0),
        payment:          o.pay_method === "cash" ? "Tiền mặt" : "Chuyển khoản",
        paymentRaw:       String(o.pay_method ?? "cash"),
        paymentStatus:    String((o as Record<string, unknown>).payment_status ?? "pending"),
      }
      setOrder(ord)

      const pos = driverPosRef.current
      const hasRealGps = pos.lat !== DEFAULT_LAT || pos.lng !== DEFAULT_LNG
      if (hasRealGps) await calcDist(pos.lat, pos.lng, ord, "pickup")
    }
    load()

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      if (broadcastRef.current) {
        supabase.removeChannel(broadcastRef.current)
        broadcastRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  // Tính lại khi đổi phase
  useEffect(() => {
    if (order) calcDist(driverLat, driverLng, order, phase)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Realtime — payment status
  useEffect(() => {
    if (!orderId) return
    const ch = supabase.channel(`order-payment:${orderId}`)
      .on("broadcast", { event: "payment_status" }, ({ payload }) => {
        if (payload.status === "paid") {
          setPaymentPaid(true)
          fireToast("💳 Khách đã thanh toán VietQR!")
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const targetLat   = phase === "pickup" ? (order?.shopLat ?? DEFAULT_LAT) : (order?.custLat ?? DEFAULT_LAT)
  const targetLng   = phase === "pickup" ? (order?.shopLng ?? DEFAULT_LNG) : (order?.custLng ?? DEFAULT_LNG)
  const etaMin      = distKm !== null && distKm > 0 ? Math.round(distKm / 0.4) : null
  const etaColor    = phase === "pickup" ? "#FF8C00" : "#3ecf6e"
  const etaLabel    = phase === "pickup" ? "đến quán" : "đến nơi"
  const statusLabel = phase === "pickup" ? "Đến lấy hàng" : "Đang giao"
  const statusColor = phase === "pickup" ? "#FF8C00" : "#3ecf6e"

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        @keyframes navPulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes navShim {0%{left:-60%}100%{left:120%}}
      `}</style>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-14}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-14}}
            style={{ position:"fixed", top:44, left:"50%", transform:"translateX(-50%)",
              zIndex:999, whiteSpace:"nowrap",
              background:"rgba(62,207,110,0.15)", border:"1px solid rgba(62,207,110,0.35)",
              borderRadius:12, padding:"7px 18px",
              color:"#3ecf6e", fontSize:11, fontWeight:600, backdropFilter:"blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position:"fixed", inset:0, background:"#080806",
        display:"flex", flexDirection:"column", fontFamily:"'Lexend',sans-serif" }}>

        {/* MAP */}
        <div style={{ flexShrink:0, position:"relative" }}>
          <NavMap ref={navMapRef} driverLat={driverLat} driverLng={driverLng}
            targetLat={targetLat} targetLng={targetLng}
            phase={phase} height={MAP_HEIGHT} />

          {/* Speed */}
          <div style={{ position:"absolute", bottom:10, left:10, zIndex:10,
            background:"rgba(8,8,6,0.9)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:10, padding:"5px 10px", textAlign:"center", backdropFilter:"blur(8px)" }}>
            <div style={{ color:"#f8f0e0", fontSize:20, fontWeight:800, lineHeight:1 }}>
              {speed !== null ? speed : "—"}
            </div>
            <div style={{ color:"#6a5a40", fontSize:8 }}>km/h</div>
          </div>

          {/* ETA */}
          <div style={{ position:"absolute", top:10, right:10, zIndex:10,
            background:"rgba(8,8,6,0.9)", border:`1px solid ${etaColor}40`,
            borderRadius:10, padding:"5px 11px", textAlign:"center", backdropFilter:"blur(8px)" }}>
            <div style={{ color:etaColor, fontSize:20, fontWeight:800, lineHeight:1 }}>
              {etaMin !== null ? `${etaMin}` : "—"}
            </div>
            <div style={{ color:"#6a5a40", fontSize:8 }}>{etaLabel}</div>
          </div>

          {/* Re-center button */}
          <div onClick={() => navMapRef.current?.flyToDriver(driverLat, driverLng)}
            style={{ position:"absolute", top:10, left:10, zIndex:10,
            width:34, height:34, borderRadius:9,
            background:"rgba(8,8,6,0.88)", border:"1px solid rgba(255,255,255,0.1)",
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", backdropFilter:"blur(8px)", fontSize:16 }}>🎯</div>

          {/* Status badge */}
          <div style={{ position:"absolute", bottom:10, right:10, zIndex:10,
            display:"flex", alignItems:"center", gap:5,
            background:`${statusColor}18`, border:`1px solid ${statusColor}40`,
            borderRadius:8, padding:"4px 9px", backdropFilter:"blur(8px)" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:statusColor,
              boxShadow:`0 0 5px ${statusColor}`, animation:"navPulse 1.5s infinite" }} />
            <span style={{ color:statusColor, fontSize:10, fontWeight:600 }}>{statusLabel}</span>
          </div>

          {/* Step indicator */}
          <div style={{ position:"absolute", top:10, left:"50%", transform:"translateX(-50%)", zIndex:10,
            display:"flex", alignItems:"center", gap:5,
            background:"rgba(8,8,6,0.88)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:20, padding:"4px 12px", backdropFilter:"blur(8px)" }}>
            {(["pickup","delivery"] as Phase[]).map((p, i) => (
              <div key={p} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:18, height:18, borderRadius:"50%",
                  background: phase === p ? "#FF6B00" :
                               (phase === "delivery" && p === "pickup") ? "#3ecf6e" :
                               "rgba(255,255,255,0.1)",
                  border:`1px solid ${phase===p?"#FF6B00":"rgba(255,255,255,0.15)"}`,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:8, fontWeight:700,
                    color: phase===p ? "#fff" : (phase==="delivery"&&p==="pickup") ? "#080806" : "#6a5a40" }}>
                    {(phase==="delivery"&&p==="pickup") ? "✓" : i+1}
                  </span>
                </div>
                {i === 0 && <div style={{ width:16, height:1,
                  background: phase==="delivery" ? "#3ecf6e" : "rgba(255,255,255,0.15)" }} />}
              </div>
            ))}
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 16px",
          paddingBottom:"calc(88px + env(safe-area-inset-bottom))",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {!order ? (
            <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
              <div style={{ color:"#6a5a40", fontSize:11 }}>Đang tải đơn hàng...</div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {phase === "pickup" ? (
                <PickupPhase
                  onDone={async () => {
                    setPhase("delivery")
                    setDistKm(null)
                    fireToast("Đã lấy hàng → bắt đầu giao!")
                    if (orderId) {
                      await supabase.from("orders").update({
                        status: "delivering",
                        picked_up_at: new Date().toISOString(),
                      }).eq("id", orderId)
                    }
                  }}
                  onCall={() => { if (order.shopPhone) window.location.href = `tel:${order.shopPhone}`; else fireToast("Không có số điện thoại quán") }}
                  onChat={() => setShowChat(true)}
                  fireToast={fireToast}
                  order={order}
                  distKm={distKm}
                />
              ) : (
                <DeliveryPhase
                  onDone={() => { window.location.href = `/driver/confirm/${orderId}` }}
                  onCall={() => { if (order.custPhone) window.location.href = `tel:${order.custPhone}`; else fireToast("Không có số điện thoại khách") }}
                  onChat={() => setShowChat(true)}
                  paymentPaid={paymentPaid}
                  order={order}
                  distKm={distKm}
                />
              )}
            </AnimatePresence>
          )}
        </div>

        {/* BOTTOM NAV */}
        <div style={{ position:"absolute", bottom:"calc(16px + env(safe-area-inset-bottom))", left:14, right:14, height:56,
          background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999,
          display:"flex", alignItems:"center", justifyContent:"space-around",
          padding:"0 6px", zIndex:50, boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            { icon:"🏠", label:"Dashboard", href:"/driver",          active:false },
            { icon:"🗺️", label:"Bản đồ",   href:"#",                active:true  },
            { icon:"💰", label:"Thu nhập",  href:"/driver/earnings", active:false },
            { icon:"🤝", label:"Hồ sơ",    href:"/driver/profile",  active:false },
          ].map(tab => (
            <a key={tab.label} href={tab.href}
              style={{ textDecoration:"none", display:"flex", flexDirection:"column",
                alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18,
                background: tab.active ? "rgba(255,107,0,0.12)" : "transparent",
                transform: tab.active ? "translateY(-2px)" : "translateY(0)",
                transition:"all .2s", position:"relative" }}>
              <span style={{ fontSize:18,
                filter: tab.active ? "drop-shadow(0 0 4px rgba(255,107,0,0.6))" : "none" }}>
                {tab.icon}
              </span>
              <span style={{ fontSize:7.5, color: tab.active ? "#FF8C00" : "#6a5a40",
                fontWeight: tab.active ? 600 : 400 }}>{tab.label}</span>
              {tab.active && (
                <div style={{ position:"absolute", bottom:-2, width:28, height:3, borderRadius:2,
                  background:"radial-gradient(ellipse,rgba(255,107,0,0.9) 0%,transparent 70%)",
                  filter:"blur(1px)" }} />
              )}
            </a>
          ))}
        </div>
      </div>

      <ChatDrawer
        orderId={orderId ?? ""}
        currentUserId={currentUserId}
        currentRole="driver"
        partnerName={order?.custName ?? "Khách hàng"}
        isOpen={showChat}
        onClose={() => setShowChat(false)}
      />
    </>
  )
}
