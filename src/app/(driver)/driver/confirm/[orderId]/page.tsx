"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Phase = "capture" | "preview" | "done"

interface OrderInfo {
  id:         string
  fullId:     string
  custName:   string
  custAddr:   string
  total:      number
  earning:    number
  payMethod:  string
}

interface TodayStats {
  orders:  number
  earning: number
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color:"#6a5a40", fontSize:8.5, fontWeight:700,
      textTransform:"uppercase", letterSpacing:.6, marginBottom:8 }}>
      {children}
    </div>
  )
}

function StatBox({ label, value, color="#b0956a" }: { label:string; value:string; color?:string }) {
  return (
    <div style={{ flex:1, background:"rgba(255,255,255,0.04)",
      border:"1px solid rgba(255,255,255,0.07)",
      borderRadius:11, padding:"9px 8px", textAlign:"center" }}>
      <div style={{ color:"#6a5a40", fontSize:8, marginBottom:3 }}>{label}</div>
      <div style={{ color, fontSize:12, fontWeight:700 }}>{value}</div>
    </div>
  )
}

function CTABtn({ label, onClick, color="orange", icon, disabled }: {
  label:string; onClick:()=>void;
  color?:"orange"|"green"|"gray"; icon?:string; disabled?:boolean
}) {
  const bg =
    disabled        ? "rgba(255,255,255,0.07)" :
    color==="green" ? "linear-gradient(90deg,#1a8c50,#3ecf6e)" :
    color==="gray"  ? "rgba(255,255,255,0.08)" :
                      "linear-gradient(90deg,#FF6B00,#FF8C00)"
  const shadow =
    !disabled && color !== "gray"
      ? color === "green" ? "0 4px 16px rgba(62,207,110,0.3)" : "0 4px 16px rgba(255,107,0,0.35)"
      : "none"
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width:"100%", height:50, borderRadius:13, border:"none",
        background:bg, color: disabled ? "#6a5a40" : "#fff",
        fontSize:13, fontWeight:700, fontFamily:"Lexend",
        cursor: disabled ? "not-allowed" : "pointer",
        position:"relative", overflow:"hidden",
        boxShadow:shadow, transition:"all .25s",
        display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
      {!disabled && color !== "gray" && (
        <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
          background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)",
          animation:"cfShim 2.5s infinite" }} />
      )}
      {icon && <span style={{ fontSize:18, position:"relative", zIndex:1 }}>{icon}</span>}
      <span style={{ position:"relative", zIndex:1 }}>{label}</span>
    </button>
  )
}

function CapturePhase({ onCapture }: { onCapture:(url:string, file:File)=>void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <motion.div key="capture"
      initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, y:-12 }} transition={{ duration:.22 }}>

      <div style={{ background:"rgba(255,107,0,0.07)", border:"1px solid rgba(255,107,0,0.22)",
        borderRadius:13, padding:"12px 14px", marginBottom:14,
        display:"flex", gap:10, alignItems:"flex-start" }}>
        <span style={{ fontSize:22, flexShrink:0 }}>📷</span>
        <div>
          <div style={{ color:"#FF8C00", fontSize:12, fontWeight:700, marginBottom:4 }}>
            Chụp ảnh xác nhận giao hàng
          </div>
          <div style={{ color:"#6a5a40", fontSize:9.5, lineHeight:1.6 }}>
            Chụp ảnh hàng đặt trước cửa hoặc trao tay khách. Ảnh sẽ được lưu làm bằng chứng.
          </div>
        </div>
      </div>

      <div onClick={() => fileRef.current?.click()}
        style={{ height:200, background:"#060808",
          border:"1.5px dashed rgba(255,107,0,0.2)",
          borderRadius:14, marginBottom:12, cursor:"pointer",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:8,
          position:"relative", overflow:"hidden" }}>
        {[
          { top:10,    left:10,   bt:true, bl:true  },
          { top:10,    right:10,  bt:true, br:true  },
          { bottom:10, left:10,   bb:true, bl:true  },
          { bottom:10, right:10,  bb:true, br:true  },
        ].map(({ bt, bl, br, bb, ...pos }, i) => (
          <div key={i} style={{ position:"absolute", width:16, height:16, ...pos,
            borderTopWidth: bt ? "2px" : 0, borderLeftWidth: bl ? "2px" : 0,
            borderRightWidth: br ? "2px" : 0, borderBottomWidth: bb ? "2px" : 0,
            borderStyle:"solid", borderColor:"rgba(255,107,0,0.5)", borderRadius:2 }} />
        ))}
        <div style={{ fontSize:48, opacity:.4 }}>📷</div>
        <div style={{ color:"#b0956a", fontSize:12, fontWeight:600 }}>Nhấn để chụp ảnh</div>
        <div style={{ color:"#6a5a40", fontSize:9.5 }}>Hướng camera vào hàng / cửa nhà khách</div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[{ icon:"☀️", label:"Đủ sáng" },{ icon:"📦", label:"Thấy rõ hàng" },{ icon:"📍", label:"Thấy địa chỉ" }].map(t => (
          <div key={t.label} style={{ flex:1, background:"rgba(255,255,255,0.03)",
            border:"1px solid rgba(255,255,255,0.06)",
            borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
            <div style={{ fontSize:16, marginBottom:3 }}>{t.icon}</div>
            <div style={{ color:"#6a5a40", fontSize:8.5 }}>{t.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
        <div onClick={() => fileRef.current?.click()}
          style={{ width:62, height:62, borderRadius:"50%", cursor:"pointer",
            background:"rgba(255,255,255,0.07)", border:"3px solid rgba(255,107,0,0.5)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 0 0 5px rgba(255,107,0,0.1)" }}>
          <div style={{ width:46, height:46, borderRadius:"50%",
            background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
            boxShadow:"0 3px 10px rgba(255,107,0,0.4)" }} />
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        onChange={e => { const f = e.target.files?.[0]; if (f) onCapture(URL.createObjectURL(f), f); e.target.value = "" }}
        style={{ display:"none" }} />
    </motion.div>
  )
}

function PreviewPhase({ photoUrl, custAddr, orderId, onRetake, onConfirm }: {
  photoUrl:string; custAddr:string; orderId:string; onRetake:()=>void; onConfirm:()=>void
}) {
  const now = new Date().toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" })
  return (
    <motion.div key="preview"
      initial={{ opacity:0, scale:.97 }} animate={{ opacity:1, scale:1 }}
      exit={{ opacity:0 }} transition={{ duration:.22 }}>

      <div style={{ position:"relative", marginBottom:10, borderRadius:14,
        overflow:"hidden", border:"1px solid rgba(62,207,110,0.25)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="Ảnh xác nhận"
          style={{ width:"100%", height:220, objectFit:"cover", display:"block" }} />
        <div style={{ position:"absolute", bottom:0, left:0, right:0,
          background:"linear-gradient(to top,rgba(0,0,0,0.75),transparent)",
          padding:"20px 12px 10px" }}>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:9 }}>📍 {custAddr}</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:8.5, marginTop:2 }}>
            🕐 {now} · Đơn #{orderId}
          </div>
        </div>
        <div style={{ position:"absolute", top:10, right:10,
          background:"rgba(62,207,110,0.15)", border:"1px solid rgba(62,207,110,0.35)",
          borderRadius:8, padding:"4px 9px", display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ color:"#3ecf6e", fontSize:11 }}>✓</span>
          <span style={{ color:"#3ecf6e", fontSize:9, fontWeight:600 }}>Ảnh OK</span>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <button onClick={onRetake}
          style={{ flex:1, height:42, borderRadius:11,
            border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)",
            color:"#6a5a40", fontSize:11, fontWeight:600, fontFamily:"Lexend", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          🔄 Chụp lại
        </button>
        <div style={{ flex:2, height:42, borderRadius:11,
          background:"rgba(62,207,110,0.1)", border:"1px solid rgba(62,207,110,0.28)",
          display:"flex", alignItems:"center", justifyContent:"center", gap:6,
          color:"#3ecf6e", fontSize:11, fontWeight:600 }}>
          ✓ Ảnh đã sẵn sàng
        </div>
      </div>

      <CTABtn color="orange" icon="✓" label="Xác nhận giao hàng thành công" onClick={onConfirm} />
    </motion.div>
  )
}

function DonePhase({ photoUrl, order, today }: {
  photoUrl:string; order: OrderInfo; today: TodayStats
}) {
  const now = new Date().toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" })
  return (
    <motion.div key="done"
      initial={{ opacity:0, scale:.96 }} animate={{ opacity:1, scale:1 }}
      transition={{ duration:.3 }}>

      <div style={{ textAlign:"center", padding:"16px 0 18px" }}>
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }}
          transition={{ type:"spring", damping:10, delay:.1 }}>
          <div style={{ width:80, height:80, borderRadius:22,
            background:"rgba(62,207,110,0.12)", border:"1px solid rgba(62,207,110,0.3)",
            margin:"0 auto 12px", display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:38, boxShadow:"0 0 24px rgba(62,207,110,0.2)" }}>✓</div>
        </motion.div>
        <div style={{ color:"#3ecf6e", fontSize:18, fontWeight:800, marginBottom:5 }}>
          Giao hàng thành công!
        </div>
        <div style={{ color:"#6a5a40", fontSize:10.5 }}>Đơn #{order.id} · {now}</div>
      </div>

      <div style={{ marginBottom:12 }}>
        <SLabel>Ảnh xác nhận giao hàng</SLabel>
        <div style={{ height:90, borderRadius:12, overflow:"hidden",
          border:"1px solid rgba(62,207,110,0.2)", position:"relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Ảnh xác nhận"
            style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", filter:"brightness(0.85)" }} />
          <div style={{ position:"absolute", top:7, right:7,
            background:"rgba(62,207,110,0.15)", border:"0.5px solid rgba(62,207,110,0.35)",
            borderRadius:7, padding:"3px 8px", display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ color:"#3ecf6e", fontSize:10 }}>✓</span>
            <span style={{ color:"#3ecf6e", fontSize:8, fontWeight:700 }}>Ảnh xác nhận</span>
          </div>
          <div style={{ position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(0,0,0,0.7),transparent)",
            padding:"14px 9px 5px" }}>
            <div style={{ color:"rgba(255,255,255,0.45)", fontSize:7.5 }}>
              {order.custAddr} · {now}
            </div>
          </div>
        </div>
      </div>

      <div style={{ background:"linear-gradient(135deg,#0a1a0d,#0f2414)",
        border:"1px solid rgba(62,207,110,0.25)",
        borderRadius:14, padding:"13px 14px", marginBottom:10,
        position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-20, right:-20, width:90, height:90,
          background:"radial-gradient(circle,rgba(62,207,110,0.15) 0%,transparent 65%)" }} />
        <div style={{ color:"rgba(62,207,110,0.55)", fontSize:9, marginBottom:5, position:"relative", zIndex:1 }}>
          Tiền công đơn này
        </div>
        <div style={{ fontSize:34, fontWeight:800, lineHeight:1, marginBottom:12,
          background:"linear-gradient(135deg,#3ecf6e,#5eeea0)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          backgroundClip:"text", position:"relative", zIndex:1 }}>
          +{fmt(order.earning)}
        </div>
        <div style={{ display:"flex", gap:8, position:"relative", zIndex:1 }}>
          <StatBox label="Khách trả" value={fmt(order.total)} color="#FF8C00" />
        </div>
      </div>

      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:14, padding:"12px 14px", marginBottom:12 }}>
        <SLabel>Thống kê hôm nay</SLabel>
        {[
          { label:"Tổng đơn hoàn thành", val:`${today.orders} đơn`, color:"#f8f0e0" },
          { label:"Thu nhập",            val:fmt(today.earning),     color:"#FF8C00" },
        ].map((row, i, arr) => (
          <div key={row.label} style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", padding:"7px 0",
            borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <span style={{ color:"#6a5a40", fontSize:10 }}>{row.label}</span>
            <span style={{ color:row.color, fontSize:11, fontWeight:700 }}>{row.val}</span>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
        <button onClick={() => { window.location.href = "/driver" }}
          style={{ flex:2, height:50, borderRadius:13, border:"none",
            background:"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
            color:"#fff", fontSize:12, fontWeight:700, fontFamily:"Lexend",
            cursor:"pointer", position:"relative", overflow:"hidden",
            boxShadow:"0 4px 16px rgba(255,107,0,0.35)",
            display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
            background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)",
            animation:"cfShim 2.5s infinite" }} />
          <span style={{ fontSize:18, position:"relative", zIndex:1 }}>🛵</span>
          <span style={{ position:"relative", zIndex:1 }}>Nhận đơn tiếp</span>
        </button>
        <button onClick={() => { window.location.href = "/driver/earnings" }}
          style={{ flex:1, height:50, borderRadius:13,
            border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)",
            color:"#6a5a40", fontSize:12, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
          💰
        </button>
      </div>

      <button onClick={async () => {
          const sb = createClient()
          const { data: { user } } = await sb.auth.getUser()
          if (user) await sb.from("drivers").update({ status: "offline" }).eq("id", user.id)
          window.location.href = "/driver"
        }}
        style={{ width:"100%", height:42, borderRadius:12,
          border:"1px solid rgba(255,64,64,0.2)", background:"rgba(255,64,64,0.07)",
          color:"#ff6060", fontSize:11, fontWeight:600, fontFamily:"Lexend", cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
        ⏸️ Chuyển sang nghỉ
      </button>
    </motion.div>
  )
}

export default function DriverConfirmPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router      = useRouter()
  const supabase    = createClient()

  const [order,     setOrder]     = useState<OrderInfo | null>(null)
  const [today,     setToday]     = useState<TodayStats>({ orders: 0, earning: 0 })
  const [phase,     setPhase]     = useState<Phase>("capture")
  const [photoUrl,  setPhotoUrl]  = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [toast,     setToast]     = useState("")
  const [saving,    setSaving]    = useState(false)

  const fireToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(""), 2400)
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
    async function load() {
      if (!orderId) return

      const { data: { user } } = await supabase.auth.getUser()

      const { data: o } = await supabase
        .from("orders")
        .select("id, customer_id, delivery_address, ship_fee, total_amount, driver_commission_amount, pay_method")
        .eq("id", orderId)
        .eq("driver_id", user?.id ?? "")
        .single()

      if (o) {
        // Dùng driver_commission_amount đã lưu — chính xác với per-driver rate
        const earning = Math.max(0, (o.ship_fee ?? 0) - (o.driver_commission_amount ?? 0))

        const { data: customer } = await supabase
          .from("profiles").select("full_name").eq("id", o.customer_id).single()

        setOrder({
          id:        o.id.slice(0, 8).toUpperCase(),
          fullId:    o.id,
          custName:  customer?.full_name ?? "Khách hàng",
          custAddr:  o.delivery_address ?? "—",
          total:     o.total_amount ?? 0,
          earning,
          payMethod: o.pay_method ?? "cash",
        })
      }

      // Today stats — dùng driver_commission_amount (không join shops)
      // Lọc theo delivered_at (lúc giao xong), không phải created_at (lúc đặt) —
      // đơn đặt hôm qua nhưng giao hôm nay vẫn phải tính vào "hôm nay"
      if (user) {
        const todayStart = new Date(); todayStart.setHours(0,0,0,0)
        const { data: delivered } = await supabase
          .from("orders")
          .select("ship_fee, driver_commission_amount")
          .eq("driver_id", user.id)
          .eq("status", "delivered")
          .gte("delivered_at", todayStart.toISOString())

        const todayEarning = (delivered ?? []).reduce((s, d) =>
          s + Math.max(0, (d.ship_fee ?? 0) - (d.driver_commission_amount ?? 0)), 0)

        setToday({ orders: (delivered ?? []).length, earning: todayEarning })
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const handleCapture = (url: string, file: File) => {
    setPhotoUrl(url)
    setPhotoFile(file)
    setPhase("preview")
  }

  const handleRetake = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(null)
    setPhotoFile(null)
    setPhase("capture")
  }

  const handleConfirm = async () => {
    if (!orderId || saving) return
    setSaving(true)

    // Verify auth trước khi làm bất cứ thứ gì
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Upload ảnh xác nhận
    let deliveryPhotoUrl: string | null = null
    if (photoFile) {
      const ext  = photoFile.name.split(".").pop() || "jpg"
      const path = `delivery-photos/${orderId}.${ext}`
      const { error: upErr } = await supabase.storage
        .from("delivery-photos")
        .upload(path, photoFile, { upsert: true })
      if (!upErr) {
        deliveryPhotoUrl = supabase.storage
          .from("delivery-photos")
          .getPublicUrl(path).data.publicUrl
      }
    }

    // Cập nhật ảnh xác nhận trước (nếu có)
    if (deliveryPhotoUrl) {
      await supabase.from("orders")
        .update({ delivery_photo_url: deliveryPhotoUrl })
        .eq("id", orderId)
    }

    // Bước 1: Luôn cập nhật status → delivered trước (trigger realtime cho merchant + khách)
    // Đơn tiền mặt: tài xế thu tiền ngay lúc giao -> đánh dấu payment_status = paid
    // luôn (trước đó không có bước nào set lại nên đơn COD giao xong vẫn hiện
    // "Chưa thanh toán" mãi).
    const { error: updateErr } = await supabase.from("orders").update({
      status:         "delivered",
      delivered_at:   new Date().toISOString(),
      ...(order?.payMethod === "cash" ? { payment_status: "paid" } : {}),
    }).eq("id", orderId)

    if (updateErr) {
      console.error("[confirm] update status=delivered error:", updateErr.code, updateErr.message, updateErr.details)
      setSaving(false)
      fireToast("❌ Không thể xác nhận giao hàng, vui lòng thử lại")
      return
    }

    // Bước 2: RPC xử lý hoa hồng quán + cộng ví tài xế (COD) — lỗi ví không block giao hàng
    type CompleteResult = { success?: boolean; error?: string; shop_commission_amount?: number; driver_earning?: number }
    const { data: result } = await supabase.rpc("complete_order_with_commission", {
      p_order_id:  orderId,
      p_driver_id: user.id,
    })
    const res = result as CompleteResult | null

    // Bước 3: Push notification + in-app cho khách
    fetch("/api/orders/notify-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, status: "delivered" }),
    }).catch(() => {})

    // Reload stats hôm nay
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { data: deliveredOrders } = await supabase
      .from("orders")
      .select("ship_fee, driver_commission_amount")
      .eq("driver_id", user.id)
      .eq("status", "delivered")
      .gte("delivered_at", todayStart.toISOString())

    const todayEarning = (deliveredOrders ?? []).reduce((s, d) =>
      s + Math.max(0, (d.ship_fee ?? 0) - (d.driver_commission_amount ?? 0)), 0)
    setToday({ orders: (deliveredOrders ?? []).length, earning: todayEarning })

    setSaving(false)
    if (res?.error) {
      fireToast("✅ Đã giao thành công! (lưu ý: lỗi xử lý hoa hồng)")
    } else {
      fireToast("✅ Đã xác nhận giao hàng thành công!")
    }
    setTimeout(() => setPhase("done"), 600)
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        @keyframes cfShim{0%{left:-60%}100%{left:120%}}
      `}</style>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-14}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-14}}
            style={{ position:"fixed", top:52, left:"50%", transform:"translateX(-50%)",
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

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)", backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          padding:"calc(env(safe-area-inset-top) + 12px) 16px 12px", flexShrink:0, zIndex:40 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {phase !== "done" ? (
              <button onClick={() => {
                if (phase === "preview") handleRetake()
                else window.history.back()
              }} style={{ width:32, height:32, borderRadius:9,
                border:"1px solid rgba(255,255,255,0.08)",
                background:"rgba(255,255,255,0.05)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:14, cursor:"pointer", color:"#f8f0e0" }}>←</button>
            ) : (
              <div style={{ width:32, height:32, borderRadius:9,
                background:"rgba(62,207,110,0.12)", border:"1px solid rgba(62,207,110,0.25)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>✓</div>
            )}

            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>
                {phase === "capture" ? "Xác nhận giao hàng" :
                 phase === "preview" ? "Kiểm tra ảnh" : "Giao hàng thành công"}
              </div>
              <div style={{ color:"#6a5a40", fontSize:9, marginTop:1 }}>
                {order
                  ? phase !== "done"
                    ? `Đơn #${order.id} · ${order.custName}`
                    : `Đơn #${order.id} đã hoàn tất`
                  : "Đang tải..."}
              </div>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:24, height:24, borderRadius:7,
                background: phase !== "capture" ? "rgba(62,207,110,0.15)" : "rgba(255,107,0,0.12)",
                border:`1px solid ${phase !== "capture" ? "rgba(62,207,110,0.3)" : "rgba(255,107,0,0.3)"}`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>
                {phase !== "capture" ? <span style={{ color:"#3ecf6e" }}>✓</span> : <span>📷</span>}
              </div>
              <div style={{ width:12, height:1,
                background: phase === "done" ? "rgba(62,207,110,0.4)" : "rgba(255,255,255,0.1)" }} />
              <div style={{ width:24, height:24, borderRadius:7,
                background: phase === "done" ? "rgba(62,207,110,0.15)" : "rgba(255,255,255,0.04)",
                border:`1px solid ${phase === "done" ? "rgba(62,207,110,0.3)" : "rgba(255,255,255,0.08)"}`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>
                <span style={{ color: phase === "done" ? "#3ecf6e" : "#6a5a40" }}>✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 16px",paddingBottom:"calc(88px + env(safe-area-inset-bottom))",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>
          <AnimatePresence mode="wait">
            {phase === "capture" && (
              <CapturePhase onCapture={handleCapture} />
            )}
            {phase === "preview" && photoUrl && (
              <PreviewPhase
                photoUrl={photoUrl}
                custAddr={order?.custAddr ?? ""}
                orderId={order?.id ?? ""}
                onRetake={handleRetake}
                onConfirm={handleConfirm} />
            )}
            {phase === "done" && photoUrl && order && (
              <DonePhase photoUrl={photoUrl} order={order} today={today} />
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Nav */}
        <div style={{ position:"absolute", bottom:16, left:14, right:14, height:56,
          background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999,
          display:"flex", alignItems:"center", justifyContent:"space-around",
          padding:"0 6px", zIndex:50, boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            { icon:"🏠", label:"Dashboard", href:"/driver"                   },
            { icon:"🗺️", label:"Bản đồ",   href:`/driver/navigate/${orderId}` },
            { icon:"💰", label:"Thu nhập",  href:"/driver/earnings"          },
            { icon:"🤝", label:"Hồ sơ",    href:"/driver/profile"           },
          ].map(tab => (
            <a key={tab.label} href={tab.href}
              style={{ textDecoration:"none", display:"flex", flexDirection:"column",
                alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18,
                transition:"all .2s" }}>
              <span style={{ fontSize:18 }}>{tab.icon}</span>
              <span style={{ fontSize:7.5, color:"#6a5a40" }}>{tab.label}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
