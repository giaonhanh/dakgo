"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import AddressPicker from "@/components/map/AddressPicker"
import { createClient } from "@/lib/supabase/client"
import type { AddressPickerResult } from "@/types"

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function GiaoHoPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [pickup,        setPickup]        = useState("")
  const [delivery,      setDelivery]      = useState("")
  const [pickupCoord,   setPickupCoord]   = useState<{ lat: number; lng: number } | null>(null)
  const [deliveryCoord, setDeliveryCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [pkgDesc,       setPkgDesc]       = useState("")
  const [weight,        setWeight]        = useState<"nhe" | "vua" | "nang">("nhe")
  const [note,          setNote]          = useState("")
  const [hasPhoto,      setHasPhoto]      = useState(false)
  const [mapMode,       setMapMode]       = useState<null | "pickup" | "delivery">(null)
  const [loading,       setLoading]       = useState(false)
  const [toast,         setToast]         = useState("")

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2300) }

  const WEIGHTS = [
    { key: "nhe",  label: "< 3kg",   emoji: "📦", fee: 20000 },
    { key: "vua",  label: "3–10kg",  emoji: "📫", fee: 25000 },
    { key: "nang", label: "> 10kg",  emoji: "🗃️", fee: 35000 },
  ] as const

  const serviceFee = WEIGHTS.find(w => w.key === weight)?.fee ?? 20000

  const handleSubmit = async () => {
    if (!pickup.trim())   { fireToast("Vui lòng nhập địa chỉ lấy hàng"); return }
    if (!delivery.trim()) { fireToast("Vui lòng nhập địa chỉ giao đến"); return }
    if (!pkgDesc.trim())  { fireToast("Vui lòng mô tả gói hàng cần giao"); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { fireToast("Vui lòng đăng nhập để đặt dịch vụ"); setLoading(false); return }
      const pLat = pickupCoord?.lat ?? 12.683
      const pLng = pickupCoord?.lng ?? 108.483
      const dLat = deliveryCoord?.lat ?? 12.683
      const dLng = deliveryCoord?.lng ?? 108.483
      const { error } = await supabase.from("errands").insert({
        customer_id:       user.id,
        type:              "deliver_for_me",
        status:            "pending",
        pickup_address:    pickup,
        pickup_lat:        pLat,
        pickup_lng:        pLng,
        delivery_address:  delivery,
        delivery_lat:      dLat,
        delivery_lng:      dLng,
        package_description: pkgDesc,
        note:              note || null,
        service_fee:       serviceFee,
        payment_method:    "cash",
      })
      if (error) { fireToast("Không thể đặt dịch vụ. Thử lại sau."); setLoading(false); return }
      fireToast("✅ Đặt giao hộ thành công! Đang tìm tài xế...")
      setTimeout(() => router.push("/orders"), 2000)
    } catch {
      fireToast("Có lỗi xảy ra, vui lòng thử lại")
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        textarea,input{outline:none;font-family:'Lexend',sans-serif}
        @keyframes ghShim{0%{left:-60%}100%{left:120%}}
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 12px)",left:"50%",
          transform:"translateX(-50%)",zIndex:9999,whiteSpace:"nowrap",
          background:"rgba(255,107,0,0.15)",border:"1px solid rgba(255,107,0,0.35)",
          borderRadius:12,padding:"7px 16px",color:"#FF8C00",fontSize:11,fontWeight:600,
          backdropFilter:"blur(10px)",fontFamily:"Lexend" }}>
          {toast}
        </div>
      )}

      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"calc(env(safe-area-inset-top,0px) + 12px) 16px 14px",
          background:"rgba(8,8,6,0.97)",backdropFilter:"blur(20px)",
          borderBottom:"1px solid rgba(255,107,0,0.12)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <button onClick={() => router.back()}
              style={{ width:40,height:40,borderRadius:12,background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:18,cursor:"pointer",flexShrink:0 }}>
              ←
            </button>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>📦 Giao hộ</div>
              <div style={{ color:"#6a5a40",fontSize:9,marginTop:1 }}>Tài xế lấy và giao hàng nhanh cho bạn</div>
            </div>
            <div style={{ background:"rgba(255,107,0,0.12)",border:"1px solid rgba(255,107,0,0.25)",
              borderRadius:8,padding:"3px 10px",color:"#FF8C00",fontSize:9,fontWeight:700 }}>
              ⚡ Nhanh
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px 140px" }}>

          {/* How it works */}
          <div style={{ display:"flex",gap:8,marginBottom:12,padding:"10px 12px",
            background:"rgba(255,107,0,0.05)",border:"1px solid rgba(255,107,0,0.12)",borderRadius:12 }}>
            {["📍 Chỉ điểm lấy","📦 Mô tả hàng","🛵 Tài xế giao đến"].map((s,i) => (
              <div key={i} style={{ flex:1,textAlign:"center",color:"#6a5a40",fontSize:8.5,lineHeight:1.5 }}>{s}</div>
            ))}
          </div>

          {/* Địa chỉ */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#6a5a40",fontSize:9,marginBottom:10,fontWeight:600,letterSpacing:.5 }}>ĐỊA CHỈ</div>

            <div style={{ display:"flex",gap:10,alignItems:"flex-start",marginBottom:10 }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:"#FF6B00",marginTop:6,
                flexShrink:0,boxShadow:"0 0 8px #FF6B00" }} />
              <div style={{ flex:1 }}>
                <div style={{ color:"#6a5a40",fontSize:8.5,marginBottom:3 }}>Lấy hàng tại</div>
                <input value={pickup} onChange={e=>setPickup(e.target.value)}
                  placeholder="Địa chỉ lấy hàng..."
                  style={{ width:"100%",background:"none",border:"none",color:"#f8f0e0",fontSize:11.5,padding:0 }} />
              </div>
              <button onClick={() => setMapMode("pickup")}
                style={{ width:40,height:40,borderRadius:10,border:"none",cursor:"pointer",
                  background:"rgba(255,107,0,0.12)",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>📍</button>
            </div>

            <div style={{ height:1,background:"rgba(255,255,255,0.05)",margin:"8px 0 8px 18px" }} />

            <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
              <div style={{ width:8,height:8,borderRadius:2,background:"#3ecf6e",marginTop:6,
                flexShrink:0,boxShadow:"0 0 8px #3ecf6e" }} />
              <div style={{ flex:1 }}>
                <div style={{ color:"#6a5a40",fontSize:8.5,marginBottom:3 }}>Giao đến</div>
                <input value={delivery} onChange={e=>setDelivery(e.target.value)}
                  placeholder="Địa chỉ người nhận..."
                  style={{ width:"100%",background:"none",border:"none",color:"#f8f0e0",fontSize:11.5,padding:0 }} />
              </div>
              <button onClick={() => setMapMode("delivery")}
                style={{ width:40,height:40,borderRadius:10,border:"none",cursor:"pointer",
                  background:"rgba(62,207,110,0.12)",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🗺️</button>
            </div>
          </div>

          {/* Cân nặng */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:10 }}>⚖️ Trọng lượng gói hàng</div>
            <div style={{ display:"flex",gap:8 }}>
              {WEIGHTS.map(w => (
                <button key={w.key} onClick={() => setWeight(w.key)}
                  style={{ flex:1,padding:"10px 6px",borderRadius:12,cursor:"pointer",textAlign:"center",
                    background:weight===w.key?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.03)",
                    border:`1px solid ${weight===w.key?"rgba(255,107,0,0.35)":"rgba(255,255,255,0.07)"}`,
                    fontFamily:"Lexend" }}>
                  <div style={{ fontSize:20,marginBottom:4 }}>{w.emoji}</div>
                  <div style={{ color:weight===w.key?"#FF8C00":"#6a5a40",fontSize:9,fontWeight:weight===w.key?700:400 }}>
                    {w.label}
                  </div>
                  <div style={{ color:weight===w.key?"#FF8C00":"#4a3a28",fontSize:8,marginTop:2 }}>
                    {fmt(w.fee)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mô tả gói hàng */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:8 }}>📝 Mô tả gói hàng</div>
            <textarea value={pkgDesc} onChange={e=>setPkgDesc(e.target.value)}
              placeholder="VD: 1 túi quần áo khoảng 2kg, 1 hộp bánh không dễ vỡ..."
              rows={3} style={{ width:"100%",background:"none",border:"none",
                color:"#b0956a",fontSize:10.5,resize:"none",lineHeight:1.7 }} />
          </div>

          {/* Ảnh gói hàng */}
          <motion.div whileTap={{ scale: 0.97 }} onClick={() => setHasPhoto(p => !p)}
            style={{ background:"rgba(255,255,255,0.04)",border:`1px solid ${hasPhoto?"rgba(62,207,110,0.3)":"rgba(255,255,255,0.08)"}`,
              borderRadius:14,padding:14,marginBottom:10,display:"flex",gap:12,alignItems:"center",cursor:"pointer" }}>
            <div style={{ width:56,height:56,borderRadius:12,
              background:hasPhoto?"rgba(62,207,110,0.1)":"rgba(255,255,255,0.04)",
              border:`1px ${hasPhoto?"solid rgba(62,207,110,0.3)":"dashed rgba(255,255,255,0.15)"}`,
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,flexShrink:0 }}>
              <span style={{ fontSize:22 }}>{hasPhoto ? "✅" : "📷"}</span>
              <span style={{ color:"#6a5a40",fontSize:7 }}>{hasPhoto ? "Đã chụp" : "Ảnh"}</span>
            </div>
            <div>
              <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:3 }}>
                {hasPhoto ? "Ảnh gói hàng đã thêm ✓" : "Chụp ảnh gói hàng"}
              </div>
              <div style={{ color:"#6a5a40",fontSize:9,lineHeight:1.5 }}>
                Giúp tài xế nhận dạng hàng chính xác hơn
              </div>
            </div>
          </motion.div>

          {/* Ghi chú */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:8 }}>📋 Ghi chú cho tài xế</div>
            <textarea value={note} onChange={e=>setNote(e.target.value)}
              placeholder="VD: Gọi trước 5 phút, hàng dễ vỡ cần nhẹ tay, người nhận tên Lan..."
              rows={3} style={{ width:"100%",background:"none",border:"none",
                color:"#b0956a",fontSize:10.5,resize:"none",lineHeight:1.7 }} />
          </div>

          {/* Chi phí */}
          <div style={{ background:"rgba(255,107,0,0.06)",border:"1px solid rgba(255,107,0,0.18)",
            borderRadius:14,padding:14 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:10 }}>💰 Chi phí dịch vụ</div>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:7 }}>
              <span style={{ color:"#6a5a40",fontSize:10 }}>Phí giao hộ ({WEIGHTS.find(w=>w.key===weight)?.label})</span>
              <span style={{ color:"#b0956a",fontSize:10,fontWeight:600 }}>{fmt(serviceFee)}</span>
            </div>
            <div style={{ height:1,background:"rgba(255,255,255,0.06)",margin:"8px 0" }} />
            <div style={{ display:"flex",justifyContent:"space-between" }}>
              <span style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>Tổng</span>
              <span style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                backgroundClip:"text",fontSize:14,fontWeight:800 }}>{fmt(serviceFee)}</span>
            </div>
            <div style={{ color:"#6a5a40",fontSize:8.5,marginTop:6 }}>
              * Phí tính theo trọng lượng thực tế khi giao
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(8,8,6,0.97)",
          backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,107,0,0.12)",
          padding:"12px 16px calc(env(safe-area-inset-bottom,0px) + 16px)",zIndex:10 }}>
          <button onClick={loading ? undefined : handleSubmit} disabled={loading}
            style={{ width:"100%",height:52,borderRadius:14,border:"none",
              cursor:loading?"default":"pointer",fontSize:14,fontWeight:800,fontFamily:"Lexend",
              background:loading?"rgba(255,255,255,0.08)":"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
              color:loading?"#6a5a40":"#fff",
              boxShadow:loading?"none":"0 4px 24px rgba(255,107,0,0.45)",
              position:"relative",overflow:"hidden" }}>
            {!loading && (
              <div style={{ position:"absolute",top:0,left:"-60%",width:"35%",height:"100%",
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                animation:"ghShim 2.5s infinite" }} />
            )}
            <span style={{ position:"relative",zIndex:1 }}>
              {loading ? "Đang đặt dịch vụ..." : "📦 Đặt giao hộ ngay"}
            </span>
          </button>
        </div>
      </div>

      {/* AddressPicker overlay */}
      {mapMode && (
        <div style={{ position:"fixed",inset:0,zIndex:300 }}>
          <AddressPicker height="100dvh"
            onClose={() => setMapMode(null)}
            onConfirm={(result: AddressPickerResult) => {
              if (mapMode === "pickup") {
                setPickup(result.address)
                setPickupCoord({ lat: result.lat, lng: result.lng })
              } else {
                setDelivery(result.address)
                setDeliveryCoord({ lat: result.lat, lng: result.lng })
              }
              setMapMode(null)
            }}
          />
        </div>
      )}
    </>
  )
}
