"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import AddressPicker from "@/components/map/AddressPicker"
import { createClient } from "@/lib/supabase/client"
import type { AddressPickerResult } from "@/types"

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calcFee(km: number): number {
  if (km <= 2)       return 15000
  if (km <= 5)       return 15000 + Math.round((km - 2) * 3500)
  if (km <= 10)      return 15000 + 10500 + Math.round((km - 5) * 3000)
  return 15000 + 10500 + 15000 + Math.round((km - 10) * 2500)
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 800
        const scale = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement("canvas")
        canvas.width  = img.width  * scale
        canvas.height = img.height * scale
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", 0.72))
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function GiaoHoPage() {
  const router   = useRouter()
  const supabase = createClient()
  const photoRef = useRef<HTMLInputElement>(null)

  // Địa chỉ
  const [pickup,        setPickup]        = useState("")
  const [delivery,      setDelivery]      = useState("")
  const [pickupCoord,   setPickupCoord]   = useState<{ lat: number; lng: number } | null>(null)
  const [deliveryCoord, setDeliveryCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [mapMode,       setMapMode]       = useState<null | "pickup" | "delivery">(null)

  // Người gửi — pre-fill từ profile
  const [senderName,     setSenderName]     = useState("")
  const [senderPhone,    setSenderPhone]    = useState("")
  const [senderEditable, setSenderEditable] = useState(false)

  // Khoảng cách & phí
  const [distanceKm, setDistanceKm] = useState<number | null>(null)

  // Người nhận
  const [recipientName,  setRecipientName]  = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")

  // Gói hàng
  const [pkgDesc, setPkgDesc] = useState("")
  const [weight,  setWeight]  = useState<"nhe" | "vua" | "nang">("nhe")
  const [note,    setNote]    = useState("")

  // Ảnh gói hàng
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoBase64,  setPhotoBase64]  = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [toast,   setToast]   = useState("")

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500) }

  const WEIGHTS = [
    { key: "nhe",  label: "< 3kg",   emoji: "📦", surcharge: 0     },
    { key: "vua",  label: "3–10kg",  emoji: "📫", surcharge: 5000  },
    { key: "nang", label: "> 10kg",  emoji: "🗃️", surcharge: 15000 },
  ] as const

  const weightSurcharge = WEIGHTS.find(w => w.key === weight)?.surcharge ?? 0
  const baseFee    = distanceKm !== null ? calcFee(distanceKm) : 15000
  const serviceFee = baseFee + weightSurcharge

  // Load user profile để pre-fill người gửi
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from("profiles").select("full_name, phone").eq("id", user.id).single()
        .then(({ data }) => {
          if (data?.full_name) setSenderName(data.full_name)
          if (data?.phone)     setSenderPhone(data.phone)
        })
    })
  }, [])

  // Tính khoảng cách khi có đủ 2 toạ độ
  useEffect(() => {
    if (pickupCoord && deliveryCoord) {
      const km = haversineKm(pickupCoord.lat, pickupCoord.lng, deliveryCoord.lat, deliveryCoord.lng)
      setDistanceKm(Math.round(km * 10) / 10)
    } else {
      setDistanceKm(null)
    }
  }, [pickupCoord, deliveryCoord])

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await compressImage(file)
    setPhotoPreview(b64)
    setPhotoBase64(b64)
  }

  const handleSubmit = async () => {
    if (!senderName.trim())    { fireToast("Vui lòng nhập tên người gửi"); return }
    if (!senderPhone.trim())   { fireToast("Vui lòng nhập SĐT người gửi"); return }
    if (!pickup.trim())        { fireToast("Vui lòng nhập địa chỉ lấy hàng"); return }
    if (!recipientName.trim()) { fireToast("Vui lòng nhập tên người nhận"); return }
    if (!recipientPhone.trim()){ fireToast("Vui lòng nhập SĐT người nhận"); return }
    if (!delivery.trim())      { fireToast("Vui lòng nhập địa chỉ giao đến"); return }
    if (!pkgDesc.trim())       { fireToast("Vui lòng mô tả gói hàng"); return }
    if (!photoBase64)          { fireToast("Vui lòng chụp ảnh gói hàng"); return }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { fireToast("Vui lòng đăng nhập"); setLoading(false); return }

      const { error } = await supabase.from("errands").insert({
        customer_id:          user.id,
        type:                 "deliver_for_me",
        status:               "pending",
        pickup_address:       pickup,
        pickup_lat:           pickupCoord?.lat ?? 12.683,
        pickup_lng:           pickupCoord?.lng ?? 108.483,
        delivery_address:     delivery,
        delivery_lat:         deliveryCoord?.lat ?? 12.683,
        delivery_lng:         deliveryCoord?.lng ?? 108.483,
        package_description:  pkgDesc,
        note:                 note || null,
        service_fee:          serviceFee,
        payment_method:       "cash",
        sender_name:          senderName,
        sender_phone:         senderPhone,
        recipient_name:       recipientName,
        recipient_phone:      recipientPhone,
        package_photo_url:    photoBase64,
      })
      if (error) { fireToast("Lỗi: " + (error?.message ?? "Không thể đặt dịch vụ")); setLoading(false); return }
      fireToast("✅ Đặt giao hộ thành công! Đang tìm tài xế...")
      setTimeout(() => router.push("/orders"), 2000)
    } catch {
      fireToast("Có lỗi xảy ra, vui lòng thử lại")
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
    padding: "10px 12px", color: "#f8f0e0", fontSize: 12,
    fontFamily: "Lexend", outline: "none",
  }
  const labelStyle: React.CSSProperties = { color: "#6a5a40", fontSize: 9, marginBottom: 5, fontWeight: 600 }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        textarea,input{outline:none;font-family:'Lexend',sans-serif}
        input::placeholder,textarea::placeholder{color:#4a3a28}
        @keyframes ghShim{0%{left:-60%}100%{left:120%}}
      `}</style>

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
                justifyContent:"center",fontSize:18,cursor:"pointer",flexShrink:0 }}>←</button>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>📦 Giao hộ</div>
              <div style={{ color:"#6a5a40",fontSize:9,marginTop:1 }}>Tài xế lấy và giao hàng nhanh cho bạn</div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px 140px" }}>

          {/* ── Người gửi ── */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
              <div style={{ color:"#FF8C00",fontSize:10,fontWeight:700 }}>👤 Người gửi (bạn)</div>
              {!senderEditable && (senderName || senderPhone) && (
                <button onClick={() => setSenderEditable(true)}
                  style={{ background:"rgba(255,107,0,0.1)",border:"1px solid rgba(255,107,0,0.3)",
                    borderRadius:8,padding:"3px 10px",color:"#FF8C00",fontSize:9,fontWeight:600,
                    cursor:"pointer",fontFamily:"Lexend" }}>Đổi</button>
              )}
            </div>
            {!senderEditable && (senderName || senderPhone) ? (
              <div style={{ display:"flex",alignItems:"center",gap:10,
                background:"rgba(255,107,0,0.06)",borderRadius:10,padding:"10px 12px" }}>
                <span style={{ fontSize:22 }}>👤</span>
                <div>
                  <div style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>{senderName}</div>
                  <div style={{ color:"#b0956a",fontSize:10 }}>{senderPhone}</div>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex",gap:8,marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={labelStyle}>Họ tên *</div>
                  <input value={senderName} onChange={e=>setSenderName(e.target.value)}
                    placeholder="Nguyễn Văn A" style={inputStyle} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={labelStyle}>Số điện thoại *</div>
                  <input value={senderPhone} onChange={e=>setSenderPhone(e.target.value)}
                    placeholder="0901..." type="tel" style={inputStyle} />
                </div>
              </div>
            )}
            {/* Địa chỉ lấy hàng */}
            <div style={labelStyle}>Địa chỉ lấy hàng *</div>
            <div style={{ display:"flex",gap:8 }}>
              <input value={pickup} onChange={e=>setPickup(e.target.value)}
                placeholder="Số nhà, tên đường, phường/xã..."
                style={{ ...inputStyle, flex:1 }} />
              <button onClick={() => setMapMode("pickup")}
                style={{ width:44,height:44,borderRadius:10,border:"1px solid rgba(255,107,0,0.25)",
                  background:"rgba(255,107,0,0.08)",flexShrink:0,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>📍</button>
            </div>
          </div>

          {/* ── Người nhận ── */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#3ecf6e",fontSize:10,fontWeight:700,marginBottom:10 }}>📬 Thông tin người nhận</div>
            <div style={{ display:"flex",gap:8,marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <div style={labelStyle}>Họ tên *</div>
                <input value={recipientName} onChange={e=>setRecipientName(e.target.value)}
                  placeholder="Trần Thị B" style={inputStyle} />
              </div>
              <div style={{ flex:1 }}>
                <div style={labelStyle}>Số điện thoại *</div>
                <input value={recipientPhone} onChange={e=>setRecipientPhone(e.target.value)}
                  placeholder="0901..." type="tel" style={inputStyle} />
              </div>
            </div>
            {/* Địa chỉ giao đến */}
            <div style={labelStyle}>Địa chỉ giao đến *</div>
            <div style={{ display:"flex",gap:8 }}>
              <input value={delivery} onChange={e=>setDelivery(e.target.value)}
                placeholder="Số nhà, tên đường, phường/xã..."
                style={{ ...inputStyle, flex:1 }} />
              <button onClick={() => setMapMode("delivery")}
                style={{ width:44,height:44,borderRadius:10,border:"1px solid rgba(62,207,110,0.25)",
                  background:"rgba(62,207,110,0.06)",flexShrink:0,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>🗺️</button>
            </div>
          </div>

          {/* ── Cân nặng ── */}
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
                    {w.surcharge > 0 ? `+${fmt(w.surcharge)}` : "Không phụ thu"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Mô tả gói hàng ── */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:8 }}>📝 Mô tả gói hàng *</div>
            <textarea value={pkgDesc} onChange={e=>setPkgDesc(e.target.value)}
              placeholder="VD: 1 túi quần áo khoảng 2kg, 1 hộp bánh không dễ vỡ..."
              rows={3} style={{ width:"100%",background:"none",border:"none",
                color:"#b0956a",fontSize:11,resize:"none",lineHeight:1.7 }} />
          </div>

          {/* ── Ảnh gói hàng (bắt buộc) ── */}
          <div style={{ background:"rgba(255,255,255,0.04)",
            border:`1px solid ${photoPreview ? "rgba(62,207,110,0.3)" : "rgba(255,107,0,0.25)"}`,
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
              <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700 }}>📷 Ảnh gói hàng *</div>
              {!photoPreview && (
                <span style={{ background:"rgba(255,107,0,0.12)",border:"1px solid rgba(255,107,0,0.3)",
                  borderRadius:6,padding:"2px 8px",color:"#FF8C00",fontSize:8,fontWeight:600 }}>Bắt buộc</span>
              )}
            </div>

            <input ref={photoRef} type="file" accept="image/*" capture="environment"
              onChange={handlePhoto} style={{ display:"none" }} />

            {photoPreview ? (
              <div style={{ position:"relative" }}>
                <img src={photoPreview} alt="Gói hàng"
                  style={{ width:"100%",maxHeight:200,objectFit:"cover",borderRadius:10 }} />
                <button onClick={() => { setPhotoPreview(null); setPhotoBase64(null); if(photoRef.current) photoRef.current.value="" }}
                  style={{ position:"absolute",top:8,right:8,width:28,height:28,borderRadius:8,
                    background:"rgba(0,0,0,0.65)",border:"none",color:"#fff",fontSize:14,
                    cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
                <div style={{ position:"absolute",bottom:8,left:8,
                  background:"rgba(62,207,110,0.85)",borderRadius:6,padding:"3px 8px",
                  color:"#fff",fontSize:9,fontWeight:600 }}>✓ Đã chụp ảnh</div>
              </div>
            ) : (
              <motion.button whileTap={{ scale:0.97 }} onClick={() => photoRef.current?.click()}
                style={{ width:"100%",height:100,borderRadius:12,cursor:"pointer",
                  background:"rgba(255,107,0,0.04)",
                  border:"2px dashed rgba(255,107,0,0.25)",
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6 }}>
                <span style={{ fontSize:32 }}>📷</span>
                <span style={{ color:"#FF8C00",fontSize:10,fontWeight:600 }}>Chụp / chọn ảnh gói hàng</span>
                <span style={{ color:"#6a5a40",fontSize:8.5 }}>Giúp tài xế nhận dạng chính xác</span>
              </motion.button>
            )}
          </div>

          {/* ── Ghi chú ── */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:8 }}>📋 Ghi chú cho tài xế</div>
            <textarea value={note} onChange={e=>setNote(e.target.value)}
              placeholder="VD: Gọi trước 5 phút, hàng dễ vỡ cần nhẹ tay..."
              rows={2} style={{ width:"100%",background:"none",border:"none",
                color:"#b0956a",fontSize:11,resize:"none",lineHeight:1.7 }} />
          </div>

          {/* ── Chi phí ── */}
          <div style={{ background:"rgba(255,107,0,0.06)",border:"1px solid rgba(255,107,0,0.18)",
            borderRadius:14,padding:14 }}>
            <div style={{ color:"#FF8C00",fontSize:10,fontWeight:700,marginBottom:10 }}>💰 Chi phí dự kiến</div>
            {distanceKm === null ? (
              <div style={{ color:"#6a5a40",fontSize:9,textAlign:"center",padding:"6px 0" }}>
                📍 Chọn địa chỉ lấy & giao trên bản đồ để tính phí chính xác
              </div>
            ) : (
              <>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                  <span style={{ color:"#6a5a40",fontSize:10 }}>Khoảng cách</span>
                  <span style={{ color:"#b0956a",fontSize:10,fontWeight:600 }}>{distanceKm.toFixed(1)} km</span>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                  <span style={{ color:"#6a5a40",fontSize:10 }}>Phí vận chuyển ({distanceKm.toFixed(1)}km)</span>
                  <span style={{ color:"#b0956a",fontSize:10,fontWeight:600 }}>{fmt(baseFee)}</span>
                </div>
                {weightSurcharge > 0 && (
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                    <span style={{ color:"#6a5a40",fontSize:10 }}>Phụ thu cân nặng ({WEIGHTS.find(w=>w.key===weight)?.label})</span>
                    <span style={{ color:"#b0956a",fontSize:10,fontWeight:600 }}>+{fmt(weightSurcharge)}</span>
                  </div>
                )}
              </>
            )}
            <div style={{ height:1,background:"rgba(255,255,255,0.06)",margin:"8px 0" }} />
            <div style={{ display:"flex",justifyContent:"space-between" }}>
              <span style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>
                {distanceKm === null ? "Tối thiểu" : "Tổng"}</span>
              <span style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                backgroundClip:"text",fontSize:14,fontWeight:800 }}>{fmt(serviceFee)}</span>
            </div>
            <div style={{ color:"#4a3a28",fontSize:8,marginTop:6 }}>
              Bảng giá: 2km đầu 15.000đ · 2–5km: +3.500đ/km · 5–10km: +3.000đ/km · &gt;10km: +2.500đ/km
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
