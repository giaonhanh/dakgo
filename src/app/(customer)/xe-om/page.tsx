"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { formatPrice } from "@/lib/utils"
import AddressPicker from "@/components/map/AddressPicker"
import { createClient } from "@/lib/supabase/client"
import type { AddressPickerResult } from "@/types"

function calcFeeFromRows(km: number, rows: string[], extra: string): number {
  const kmInt = Math.ceil(Math.max(km, 1))
  let total = 0
  for (let i = 0; i < Math.min(kmInt, 10); i++) {
    let price = 0
    for (let j = i; j >= 0; j--) {
      if (rows[j] && rows[j] !== "") { price = parseInt(rows[j]) || 0; break }
    }
    total += price
  }
  if (kmInt > 10) total += (kmInt - 10) * (parseInt(extra) || 0)
  return total
}

function estimateKm(dest: string): number {
  if (!dest) return 0
  const seed = dest.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return parseFloat(((seed % 60 + 10) / 10).toFixed(1))
}

export default function XeOmPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [pickup,      setPickup]      = useState("Phước An, Krông Pắc")
  const [dest,        setDest]        = useState("")
  const [mapMode,     setMapMode]     = useState<null | "pickup" | "dest">(null)
  const [pickupCoord, setPickupCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [destCoord,   setDestCoord]   = useState<{ lat: number; lng: number } | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [toast,       setToast]       = useState("")

  const [pricingRows,    setPricingRows]    = useState<string[]>(["10000","8000","7000","6500","6000","5500","5000","4800","4600","4500"])
  const [pricingExtra,   setPricingExtra]   = useState("4000")
  const [serviceEnabled, setServiceEnabled] = useState(true)
  const [serviceMsg,     setServiceMsg]     = useState("Dịch vụ xe ôm tạm ngừng phục vụ. Vui lòng thử lại sau.")

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("app_settings").select("value").eq("key","pricing").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key","service_toggles").maybeSingle(),
    ]).then(([pricingRes, toggleRes]) => {
      const mb = (pricingRes.data?.value as Record<string, { rows?: string[]; extra?: string } | undefined> | null)?.motorbike
      if (mb?.rows) setPricingRows(mb.rows)
      if (mb?.extra) setPricingExtra(mb.extra)
      const toggles = toggleRes.data?.value as Record<string, { enabled?: boolean; customerMsg?: string }> | null
      if (toggles?.motorbike?.enabled === false) {
        setServiceEnabled(false)
        if (toggles.motorbike.customerMsg) setServiceMsg(toggles.motorbike.customerMsg)
      }
    })
  }, [])

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500) }
  const estimatedKm    = estimateKm(dest)
  const estimatedPrice = calcFeeFromRows(estimatedKm, pricingRows, pricingExtra)

  const handleBook = async () => {
    if (!dest.trim()) { fireToast("Vui lòng nhập điểm đến"); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { fireToast("Vui lòng đăng nhập để đặt xe"); setLoading(false); return }
      const pLat = pickupCoord?.lat ?? 12.683
      const pLng = pickupCoord?.lng ?? 108.483
      const dLat = destCoord?.lat ?? 12.683
      const dLng = destCoord?.lng ?? 108.483
      const { error } = await supabase.from("rides").insert({
        customer_id:     user.id,
        vehicle_type:    "motorbike",
        pickup_address:  pickup,
        pickup_lat:      pLat,
        pickup_lng:      pLng,
        dropoff_address: dest,
        dropoff_lat:     dLat,
        dropoff_lng:     dLng,
        distance_km:     estimatedKm,
        estimated_fare:  estimatedPrice,
        payment_method:  "cash",
        status:          "searching",
      })
      if (error) { fireToast("Lỗi: " + (error?.message ?? "Không thể đặt xe")); setLoading(false); return }
      fireToast("✅ Đang tìm xe ôm cho bạn...")
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
        input{outline:none;font-family:'Lexend',sans-serif}
        @keyframes xoShim{0%{left:-60%}100%{left:120%}}
        @keyframes xoPulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}
            style={{ position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 60px)",
              left:"50%",transform:"translateX(-50%)",zIndex:999,whiteSpace:"nowrap",
              background:"rgba(74,143,245,0.15)",border:"1px solid rgba(74,143,245,0.35)",
              borderRadius:12,padding:"7px 16px",color:"#4a8ff5",fontSize:11,fontWeight:600,
              backdropFilter:"blur(10px)" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tạm ngừng dịch vụ */}
      {!serviceEnabled && (
        <div style={{ position:"fixed", inset:0, zIndex:200, background:"#080806", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:24 }}>
          <div style={{ fontSize:56 }}>🛵</div>
          <div style={{ color:"#f8f0e0", fontSize:18, fontWeight:700, textAlign:"center" }}>Xe ôm tạm ngừng phục vụ</div>
          <div style={{ color:"#6a5a40", fontSize:12, textAlign:"center", lineHeight:1.6 }}>{serviceMsg}</div>
          <button onClick={() => router.back()} style={{ marginTop:8, padding:"12px 28px", borderRadius:14, background:"linear-gradient(135deg,#FF6B00,#FF8C00)", color:"#fff", fontSize:13, fontWeight:700, border:"none", cursor:"pointer" }}>← Quay lại</button>
        </div>
      )}

      {/* Header */}
      <div style={{ position:"fixed",top:0,left:0,right:0,zIndex:40,
        padding:"calc(env(safe-area-inset-top,0px) + 12px) 16px 14px",
        background:"rgba(8,8,6,0.97)",backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(74,143,245,0.15)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <button onClick={() => router.back()}
            style={{ width:40,height:40,borderRadius:12,background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:18,cursor:"pointer",flexShrink:0 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>🛵 Đặt xe ôm</div>
            <div style={{ color:"#6a5a40",fontSize:9,marginTop:1 }}>Nhanh · Linh hoạt · Giá tốt</div>
          </div>
          {/* Pulse badge */}
          <div style={{ display:"flex",alignItems:"center",gap:5,
            background:"rgba(74,143,245,0.1)",border:"1px solid rgba(74,143,245,0.25)",
            borderRadius:20,padding:"4px 10px" }}>
            <div style={{ width:6,height:6,borderRadius:"50%",background:"#4a8ff5",
              animation:"xoPulse 2s infinite" }} />
            <span style={{ color:"#4a8ff5",fontSize:9,fontWeight:700 }}>12 xe online</span>
          </div>
        </div>
      </div>

      <div style={{ minHeight:"100dvh",background:"#080806",
        paddingTop:"calc(env(safe-area-inset-top,0px) + 68px)",
        paddingBottom:"calc(env(safe-area-inset-bottom,0px) + 120px)" }}>
        <div style={{ maxWidth:480,margin:"0 auto",padding:"16px 16px 0" }}>

          {/* Hero card */}
          <div style={{ borderRadius:20,overflow:"hidden",marginBottom:16,
            background:"linear-gradient(135deg,#0a0f1a,#0d1428,#060b14)",
            border:"1px solid rgba(74,143,245,0.2)",
            boxShadow:"0 8px 40px rgba(74,143,245,0.1)" }}>
            <div style={{ padding:"16px 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
              <div>
                <div style={{ color:"rgba(74,143,245,0.7)",fontSize:9,fontWeight:700,letterSpacing:.8,marginBottom:4 }}>
                  🛵 XE ÔM — NHANH & TIỆN
                </div>
                <div style={{ color:"#f8f0e0",fontSize:13,fontWeight:700,lineHeight:1.4 }}>
                  Đặt ngay<br/>
                  <span style={{ background:"linear-gradient(90deg,#4a8ff5,#7ab3ff)",
                    WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                    backgroundClip:"text",fontSize:22,fontWeight:900 }}>
                    {dest ? formatPrice(estimatedPrice) : `Từ ${formatPrice(calcFeeFromRows(1, pricingRows, pricingExtra))}`}
                  </span>
                </div>
                {dest && (
                  <div style={{ color:"#6a5a40",fontSize:9,marginTop:4 }}>
                    ~{estimatedKm}km · {Math.round(estimatedKm * 3 + 5)}–{Math.round(estimatedKm * 4 + 8)} phút
                  </div>
                )}
              </div>
              <div style={{ fontSize:52,lineHeight:1 }}>🛵</div>
            </div>
            {/* Pricing info */}
            <div style={{ display:"flex",gap:0,borderTop:"1px solid rgba(74,143,245,0.1)" }}>
              {[["10.000đ","Giá mở cửa"],["4.500đ/km","Mỗi km tiếp"],["~3 phút","Có xe ngay"]].map(([val,lab],i) => (
                <div key={i} style={{ flex:1,padding:"8px 0",textAlign:"center",
                  borderLeft:i>0?"1px solid rgba(74,143,245,0.08)":"none" }}>
                  <div style={{ color:"#4a8ff5",fontSize:10,fontWeight:700 }}>{val}</div>
                  <div style={{ color:"#6a5a40",fontSize:8,marginTop:2 }}>{lab}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Route preview khi đã chọn điểm */}
          {(pickupCoord || destCoord) && (
            <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}
              style={{ borderRadius:14,padding:14,marginBottom:12,
                background:"rgba(74,143,245,0.05)",border:"1px solid rgba(74,143,245,0.2)" }}>
              <div style={{ color:"rgba(74,143,245,0.7)",fontSize:8.5,fontWeight:700,letterSpacing:.8,marginBottom:8 }}>
                🗺️ TUYẾN ĐƯỜNG
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",flexShrink:0,
                    background:"#3ecf6e",boxShadow:"0 0 6px #3ecf6e" }} />
                  <span style={{ color:pickupCoord?"#f8f0e0":"#6a5a40",fontSize:10.5,flex:1,lineHeight:1.4 }}>
                    {pickup || "Điểm đón"}
                  </span>
                </div>
                <div style={{ width:1,height:10,background:"rgba(255,255,255,0.08)",marginLeft:3.5 }} />
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:8,height:8,borderRadius:2,flexShrink:0,
                    background:"#4a8ff5",boxShadow:"0 0 6px #4a8ff5" }} />
                  <span style={{ color:destCoord?"#f8f0e0":"#6a5a40",fontSize:10.5,flex:1,lineHeight:1.4 }}>
                    {dest || "Điểm đến"}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Địa chỉ form */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(74,143,245,0.12)",
            borderRadius:16,padding:14,marginBottom:12 }}>

            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
              <div style={{ width:8,height:8,borderRadius:"50%",flexShrink:0,
                background:"#3ecf6e",boxShadow:"0 0 6px #3ecf6e" }} />
              <input value={pickup} onChange={e=>setPickup(e.target.value)}
                style={{ flex:1,background:"transparent",border:"none",color:"#f8f0e0",
                  fontSize:12,caretColor:"#4a8ff5" }}
                placeholder="Điểm đón..." />
              <button onClick={() => setMapMode("pickup")}
                style={{ width:44,height:44,borderRadius:10,border:"none",cursor:"pointer",
                  background:"rgba(62,207,110,0.12)",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>📍</button>
            </div>

            <div style={{ height:1,background:"rgba(74,143,245,0.1)",marginLeft:18,marginBottom:12 }} />

            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:8,height:8,borderRadius:2,flexShrink:0,
                background:"#4a8ff5",boxShadow:"0 0 6px #4a8ff5" }} />
              <input value={dest} onChange={e=>setDest(e.target.value)}
                style={{ flex:1,background:"transparent",border:"none",color:"#f8f0e0",
                  fontSize:12,caretColor:"#4a8ff5" }}
                placeholder="Bạn muốn đến đâu?" />
              <button onClick={() => setMapMode("dest")}
                style={{ width:44,height:44,borderRadius:10,border:"none",cursor:"pointer",
                  background:"rgba(74,143,245,0.12)",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🗺️</button>
            </div>
          </div>

          {/* Price breakdown khi có điểm đến */}
          <AnimatePresence>
            {dest && (
              <motion.div initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                style={{ background:"rgba(74,143,245,0.08)",border:"1px solid rgba(74,143,245,0.2)",
                  borderRadius:14,padding:14,marginBottom:12 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <div style={{ color:"#6a5a40",fontSize:9,marginBottom:2 }}>Ước tính cước</div>
                    <div style={{ color:"#4a8ff5",fontSize:22,fontWeight:900,lineHeight:1 }}>
                      {formatPrice(estimatedPrice)}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#6a5a40",fontSize:9,marginBottom:2 }}>Khoảng cách</div>
                    <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>{estimatedKm} km</div>
                    <div style={{ color:"#6a5a40",fontSize:8.5,marginTop:2 }}>
                      {Math.round(estimatedKm * 3 + 5)}–{Math.round(estimatedKm * 4 + 8)} phút
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tips */}
          <div style={{ display:"flex",gap:8,marginBottom:8 }}>
            {["🔒 Tài xế xác minh","💬 Chat trong app","⭐ Đánh giá sau chuyến"].map((t,i) => (
              <div key={i} style={{ flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
                borderRadius:10,padding:"7px 4px",textAlign:"center",color:"#6a5a40",fontSize:7.5,lineHeight:1.5 }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ position:"fixed",bottom:0,left:0,right:0,
        background:"rgba(8,8,6,0.97)",backdropFilter:"blur(20px)",
        borderTop:"1px solid rgba(74,143,245,0.12)",
        padding:"12px 16px calc(env(safe-area-inset-bottom,0px) + 16px)",zIndex:40 }}>
        <motion.button whileTap={{ scale: 0.97 }}
          disabled={!dest || loading} onClick={handleBook}
          style={{ width:"100%",height:52,borderRadius:14,border:"none",fontFamily:"Lexend",
            fontSize:14,fontWeight:800,cursor:!dest||loading?"default":"pointer",
            background:dest&&!loading?"linear-gradient(135deg,#2563eb,#4a8ff5,#60a5fa)":"rgba(255,255,255,0.06)",
            color:dest&&!loading?"#fff":"#6a5a40",
            boxShadow:dest&&!loading?"0 4px 24px rgba(74,143,245,0.4)":"none",
            position:"relative",overflow:"hidden" }}>
          {dest && !loading && (
            <div style={{ position:"absolute",top:0,left:"-60%",width:"35%",height:"100%",
              background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
              animation:"xoShim 2.5s infinite" }} />
          )}
          <span style={{ position:"relative",zIndex:1 }}>
            {loading ? "Đang tìm xe ôm..." : "🛵 Đặt xe ôm ngay"}
          </span>
        </motion.button>
      </div>

      {/* AddressPicker overlay */}
      {mapMode && (
        <div style={{ position:"fixed",inset:0,zIndex:300 }}>
          <AddressPicker height="100dvh"
            initialLat={mapMode==="pickup"?(pickupCoord?.lat??12.6455):(destCoord?.lat??12.6455)}
            initialLng={mapMode==="pickup"?(pickupCoord?.lng??108.2612):(destCoord?.lng??108.2612)}
            onClose={() => setMapMode(null)}
            onConfirm={(result: AddressPickerResult) => {
              if (mapMode === "pickup") { setPickup(result.address); setPickupCoord({ lat:result.lat,lng:result.lng }) }
              else { setDest(result.address); setDestCoord({ lat:result.lat,lng:result.lng }) }
              setMapMode(null)
            }}
          />
        </div>
      )}
    </>
  )
}
