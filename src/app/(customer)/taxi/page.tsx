"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { formatPrice } from "@/lib/utils"
import AddressPicker from "@/components/map/AddressPicker"
import { createClient } from "@/lib/supabase/client"
import { getRouteKm, reverseGeocodeStructured } from "@/lib/vietmapRoute"
import type { AddressPickerResult } from "@/types"

type CarType = "4cho" | "7cho"

const CARS: Record<CarType, { emoji: string; label: string; sub: string; seats: number }> = {
  "4cho": { emoji:"🚕", label:"Sedan 4 chỗ", sub:"Tiết kiệm · Phổ biến", seats:4 },
  "7cho": { emoji:"🚙", label:"SUV / 7 chỗ",  sub:"Rộng rãi · Gia đình",  seats:7 },
}

function calcFare(baseFare: number, perKm: number, km: number, perKmOver30 = perKm): number {
  const base = Math.min(Math.max(0, km - 1), 29)
  const over = Math.max(0, km - 30)
  return Math.round((baseFare + base * perKm + over * perKmOver30) / 1000) * 1000
}

function isNightTime(start: string, end: string): boolean {
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const s = sh * 60 + sm, e = eh * 60 + em
  return s > e ? (cur >= s || cur <= e) : (cur >= s && cur <= e)
}

function isServiceOpen(open: string, close: string, allDay: boolean): boolean {
  if (allDay) return true
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [oh, om] = open.split(":").map(Number)
  const [ch, cm] = close.split(":").map(Number)
  return cur >= oh * 60 + om && cur <= ch * 60 + cm
}


export default function TaxiPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [carType,     setCarType]     = useState<CarType>("4cho")
  const [pickup,      setPickup]      = useState("")
  const [pickupLoading, setPickupLoading] = useState(true)
  const [dest,        setDest]        = useState("")
  const [mapMode,     setMapMode]     = useState<null | "pickup" | "dest">(null)
  const [pickupCoord, setPickupCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [destCoord,   setDestCoord]   = useState<{ lat: number; lng: number } | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [toast,       setToast]       = useState("")

  // Taxi pricing từ admin settings
  const [taxi4, setTaxi4] = useState({ baseFare: 15000, perKm: 12000, perKmOver30: 10000, commissionRate: 10 })
  const [taxi7, setTaxi7] = useState({ baseFare: 20000, perKm: 15000, perKmOver30: 12000, commissionRate: 10 })
  const [taxiNight, setTaxiNight] = useState({ enabled: false, start: "22:00", end: "05:00", type: "percent" as "percent"|"per_km"|"flat", value: 20 })
  const [fixedRoutes, setFixedRoutes] = useState<{ id:string; from:string; to:string; oneWay:number; twoWay:number; note:string }[]>([])
  const [taxiWaiting, setTaxiWaiting] = useState({ freeMinutes: 90, extraHourFee: 50000, doubleAfterHours: 3 })

  // Service toggles & hours
  const [taxi4Enabled, setTaxi4Enabled] = useState(true)
  const [taxi7Enabled, setTaxi7Enabled] = useState(true)
  const [taxi4Msg,     setTaxi4Msg]     = useState("Dịch vụ taxi 4 chỗ tạm ngừng phục vụ.")
  const [taxi7Msg,     setTaxi7Msg]     = useState("Dịch vụ taxi 7 chỗ tạm ngừng phục vụ.")
  const [taxiOpen,     setTaxiOpen]     = useState(true)   // dựa vào service_hours
  const [onlineCount,      setOnlineCount]      = useState<number | null>(null)
  const [distanceKm,       setDistanceKm]       = useState<number>(0)
  const [selectedFixedId,  setSelectedFixedId]  = useState<string | null>(null)
  const [fixedDirection,   setFixedDirection]   = useState<"oneWay"|"twoWay">("oneWay")
  const [showFixedRoutes,  setShowFixedRoutes]  = useState(false)
  const [customerName,  setCustomerName]  = useState("")
  const [customerPhone, setCustomerPhone] = useState("")

  // Auto-detect GPS pickup khi vào trang
  useEffect(() => {
    if (!navigator.geolocation) { setPickupLoading(false); setPickup("Phước An, Krông Pắc"); return }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords
        setPickupCoord({ lat, lng })
        reverseGeocodeStructured(lat, lng).then(({ address }) => {
          setPickup(address)
          setPickupLoading(false)
        })
      },
      () => { setPickup("Phước An, Krông Pắc"); setPickupLoading(false) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tính khoảng cách thực theo cung đường từ VietMap
  useEffect(() => {
    if (!pickupCoord || !destCoord) { setDistanceKm(0); return }
    let cancelled = false
    getRouteKm(pickupCoord.lat, pickupCoord.lng, destCoord.lat, destCoord.lng).then(km => {
      if (!cancelled) setDistanceKm(parseFloat(km.toFixed(1)))
    })
    return () => { cancelled = true }
  }, [pickupCoord, destCoord])

  useEffect(() => {
    const supabase = createClient()
    // Load profile
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").select("full_name,phone").eq("id", user.id).single()
          .then(({ data }) => {
            if (data?.full_name) setCustomerName(data.full_name)
            if (data?.phone)     setCustomerPhone(data.phone)
          })
      }
    })

    Promise.all([
      supabase.from("app_settings").select("value").eq("key","taxi_pricing").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key","service_toggles").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key","service_hours").maybeSingle(),
      supabase.from("drivers").select("id", { count: "exact", head: true }).eq("status", "online").eq("vehicle_type", "car"),
    ]).then(([txRes, toggleRes, hoursRes, driverRes]) => {
      // Taxi pricing mới
      const tp = txRes.data?.value as Record<string, unknown> | null
      if (tp?.taxi4) setTaxi4(p => ({ ...p, ...(tp.taxi4 as typeof p) }))
      if (tp?.taxi7) setTaxi7(p => ({ ...p, ...(tp.taxi7 as typeof p) }))
      if (tp?.nightSurcharge) setTaxiNight(tp.nightSurcharge as typeof taxiNight)
      if (tp?.fixedRoutes)    setFixedRoutes(tp.fixedRoutes as typeof fixedRoutes)
      if (tp?.waiting)        setTaxiWaiting(tp.waiting as typeof taxiWaiting)

      // Service toggles
      const toggles = toggleRes.data?.value as Record<string, { enabled?: boolean; customerMsg?: string }> | null
      if (toggles?.taxi_4cho?.enabled === false) {
        setTaxi4Enabled(false)
        if (toggles.taxi_4cho.customerMsg) setTaxi4Msg(toggles.taxi_4cho.customerMsg)
      }
      if (toggles?.taxi_7cho?.enabled === false) {
        setTaxi7Enabled(false)
        if (toggles.taxi_7cho.customerMsg) setTaxi7Msg(toggles.taxi_7cho.customerMsg)
      }

      // Service hours
      const sh = hoursRes.data?.value as Record<string, { open:string; close:string; allDay:boolean }> | null
      const txHours = sh?.taxi ?? { open:"00:00", close:"23:59", allDay:true }
      setTaxiOpen(isServiceOpen(txHours.open, txHours.close, txHours.allDay))

      setOnlineCount(driverRes.count ?? 0)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500) }
  const car         = CARS[carType]
  const estimatedKm = distanceKm > 0 ? distanceKm : (dest ? 1 : 0)
  const isNight     = taxiNight.enabled && isNightTime(taxiNight.start, taxiNight.end)

  function applyNight(fare: number, km = 1): number {
    if (!isNight) return fare
    if (taxiNight.type === "percent") return Math.round(fare * (1 + taxiNight.value / 100) / 1000) * 1000
    if (taxiNight.type === "per_km")  return Math.round((fare + km * taxiNight.value) / 1000) * 1000
    return Math.round((fare + taxiNight.value) / 1000) * 1000 // flat
  }

  const v = carType === "7cho" ? taxi7 : taxi4
  const baseFareDisplay = applyNight(v.baseFare)
  const selectedRoute   = fixedRoutes.find(r => r.id === selectedFixedId) ?? null
  const fixedPrice      = selectedRoute ? selectedRoute[fixedDirection] : null
  const estimatedPrice  = fixedPrice ?? (dest ? applyNight(calcFare(v.baseFare, v.perKm, Math.max(estimatedKm, 1), v.perKmOver30)) : 0)

  const handleBook = async () => {
    if (!dest.trim())         { fireToast("Vui lòng nhập điểm đến"); return }
    if (!customerName.trim()) { fireToast("Vui lòng nhập họ tên"); return }
    if (!customerPhone.trim()){ fireToast("Vui lòng nhập số điện thoại"); return }
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
        vehicle_type:    carType === "7cho" ? "car_7" : "car_4",
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
        customer_name:   customerName || null,
        customer_phone:  customerPhone || null,
      })
      if (error) { fireToast("Lỗi: " + (error?.message ?? "Không thể đặt xe")); setLoading(false); return }
      fireToast(`✅ Đang tìm ${car.label} cho bạn...`)
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
        @keyframes txShim{0%{left:-60%}100%{left:120%}}
        @keyframes txPulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}
            style={{ position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 60px)",
              left:"50%",transform:"translateX(-50%)",zIndex:999,whiteSpace:"nowrap",
              background:"rgba(180,100,255,0.15)",border:"1px solid rgba(180,100,255,0.35)",
              borderRadius:12,padding:"7px 16px",color:"#b464ff",fontSize:11,fontWeight:600,
              backdropFilter:"blur(10px)" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ position:"fixed",top:0,left:0,right:0,zIndex:40,
        padding:"calc(env(safe-area-inset-top,0px) + 12px) 16px 14px",
        background:"rgba(8,8,6,0.97)",backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(180,100,255,0.15)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <button onClick={() => router.back()}
            style={{ width:40,height:40,borderRadius:12,background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:18,cursor:"pointer",flexShrink:0 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>🚕 Đặt taxi</div>
            <div style={{ color:"#6a5a40",fontSize: 11,marginTop:1 }}>Thoải mái · An toàn · Điều hoà mát lạnh</div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:5,
            background:"rgba(180,100,255,0.1)",border:"1px solid rgba(180,100,255,0.25)",
            borderRadius:20,padding:"4px 10px" }}>
            <div style={{ width:6,height:6,borderRadius:"50%",background:"#b464ff",
              animation:"txPulse 2s infinite" }} />
            <span style={{ color:"#b464ff",fontSize: 11,fontWeight:700 }}>{onlineCount !== null ? `${onlineCount} xe online` : "Đang tải..."}</span>
          </div>
        </div>
      </div>

      <div style={{ minHeight:"100dvh",background:"#080806",
        paddingTop:"calc(env(safe-area-inset-top,0px) + 68px)",
        paddingBottom:"calc(env(safe-area-inset-bottom,0px) + 120px)" }}>
        <div style={{ maxWidth:480,margin:"0 auto",padding:"16px 16px 0" }}>

          {/* Banner ngoài giờ hoạt động */}
          {!taxiOpen && (
            <div style={{ background:"rgba(255,64,64,0.08)",border:"1px solid rgba(255,64,64,0.25)",borderRadius:12,
              padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ fontSize:16 }}>🕐</span>
              <span style={{ color:"#ff8080",fontSize:12,fontWeight:600 }}>Dịch vụ taxi hiện ngoài giờ hoạt động</span>
            </div>
          )}

          {/* Banner cước đêm */}
          {isNight && (
            <div style={{ background:"rgba(144,128,192,0.1)",border:"1px solid rgba(144,128,192,0.3)",borderRadius:12,
              padding:"8px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ fontSize:14 }}>🌙</span>
              <span style={{ color:"#b090e0",fontSize:11,fontWeight:600 }}>
                Cước đêm khuya ({taxiNight.start}–{taxiNight.end})
                {taxiNight.type === "percent" ? ` +${taxiNight.value}%` : taxiNight.type === "per_km" ? ` +${taxiNight.value.toLocaleString("vi-VN")}đ/km` : ` +${taxiNight.value.toLocaleString("vi-VN")}đ/chuyến`}
              </span>
            </div>
          )}

          {/* Chọn loại xe */}
          <div style={{ display:"flex",gap:10,marginBottom:14 }}>
            {(Object.entries(CARS) as [CarType, typeof CARS[CarType]][]).map(([key, c]) => {
              const isDisabled = key === "4cho" ? !taxi4Enabled : !taxi7Enabled
              const cfg = key === "7cho" ? taxi7 : taxi4
              return (
                <motion.button key={key} whileTap={{ scale: isDisabled ? 1 : 0.97 }}
                  onClick={() => { if (!isDisabled) setCarType(key) }}
                  style={{ flex:1,padding:"14px 10px",borderRadius:16,cursor:isDisabled?"not-allowed":"pointer",textAlign:"left",
                    background:isDisabled?"rgba(255,255,255,0.02)":carType===key?"rgba(180,100,255,0.1)":"rgba(255,255,255,0.04)",
                    border:`1px solid ${isDisabled?"rgba(255,64,64,0.2)":carType===key?"rgba(180,100,255,0.4)":"rgba(255,255,255,0.07)"}`,
                    boxShadow:carType===key&&!isDisabled?"0 4px 20px rgba(180,100,255,0.15)":"none",
                    fontFamily:"Lexend",position:"relative",overflow:"hidden",opacity:isDisabled?0.5:1 }}>
                  {isDisabled && (
                    <div style={{ position:"absolute",top:6,right:6,background:"rgba(255,64,64,0.15)",border:"1px solid rgba(255,64,64,0.3)",borderRadius:6,padding:"2px 6px",fontSize: 11,fontWeight:700,color:"#ff4040" }}>Tạm đóng</div>
                  )}
                  {!isDisabled && carType===key && (
                    <div style={{ position:"absolute",top:8,right:8,width:16,height:16,borderRadius:"50%",
                      background:"#b464ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize: 11 }}>✓</div>
                  )}
                  <div style={{ fontSize:28,marginBottom:6 }}>{c.emoji}</div>
                  <div style={{ color:isDisabled?"#6a5a40":carType===key?"#b464ff":"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:2 }}>
                    {c.label}
                  </div>
                  <div style={{ color:"#6a5a40",fontSize: 11,marginBottom:6 }}>{isDisabled ? (key === "4cho" ? taxi4Msg : taxi7Msg) : c.sub}</div>
                  {!isDisabled && (
                    <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                      <span style={{ color:carType===key?"#b464ff":"#6a5a40",fontSize: 11,fontWeight:700 }}>
                        Từ {formatPrice(applyNight(cfg.baseFare))}
                      </span>
                      <span style={{ color:"#4a3a28",fontSize: 11 }}>· {c.seats} chỗ</span>
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>

          {/* Hero price card */}
          <div style={{ borderRadius:20,overflow:"hidden",marginBottom:14,
            background:"linear-gradient(135deg,#0f0a1a,#160d28,#0a0614)",
            border:"1px solid rgba(180,100,255,0.2)",
            boxShadow:"0 8px 40px rgba(180,100,255,0.08)" }}>
            <div style={{ padding:"14px 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
              <div>
                <div style={{ color:"rgba(180,100,255,0.7)",fontSize: 11,fontWeight:700,letterSpacing:.8,marginBottom:4 }}>
                  {car.emoji} {car.label.toUpperCase()}
                </div>
                <div style={{ color:"#f8f0e0",fontSize:13,fontWeight:700,lineHeight:1.4 }}>
                  {dest ? "Cước ước tính" : "Giá cước"}<br/>
                  <span style={{ background:"linear-gradient(90deg,#b464ff,#d49aff)",
                    WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                    backgroundClip:"text",fontSize:22,fontWeight:900 }}>
                    {dest ? formatPrice(estimatedPrice) : `Từ ${formatPrice(baseFareDisplay)}`}
                  </span>
                </div>
                {dest && estimatedKm > 0 && (
                  <div style={{ color:"#6a5a40",fontSize: 11,marginTop:4 }}>
                    ~{estimatedKm}km · {Math.round(estimatedKm * 2 + 8)}–{Math.round(estimatedKm * 3 + 12)} phút
                    {distanceKm === 0 && <span style={{ color:"#4a5a40" }}> (ước tính)</span>}
                  </div>
                )}
              </div>
              <div style={{ fontSize:48,lineHeight:1 }}>{car.emoji}</div>
            </div>
            <div style={{ display:"flex",gap:0,borderTop:"1px solid rgba(180,100,255,0.1)" }}>
              {[[`${formatPrice(baseFareDisplay)}`, "Giá mở cửa"],[`+${formatPrice(isNight && taxiNight.type==="per_km" ? v.perKm + taxiNight.value : v.perKm)}/km`,"Mỗi km tiếp"],["~5 phút","Thời gian đến"]].map(([val,lab],i) => (
                <div key={i} style={{ flex:1,padding:"8px 0",textAlign:"center",
                  borderLeft:i>0?"1px solid rgba(180,100,255,0.08)":"none" }}>
                  <div style={{ color:"#b464ff",fontSize: 11,fontWeight:700 }}>{val}</div>
                  <div style={{ color:"#6a5a40",fontSize: 11,marginTop:2 }}>{lab}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Route preview */}
          {(pickupCoord || destCoord) && (
            <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}
              style={{ borderRadius:14,padding:14,marginBottom:12,
                background:"rgba(180,100,255,0.05)",border:"1px solid rgba(180,100,255,0.2)" }}>
              <div style={{ color:"rgba(180,100,255,0.7)",fontSize: 11,fontWeight:700,letterSpacing:.8,marginBottom:8 }}>
                🗺️ TUYẾN ĐƯỜNG
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",flexShrink:0,
                    background:"#3ecf6e",boxShadow:"0 0 6px #3ecf6e" }} />
                  <span style={{ color:"#f8f0e0",fontSize:10.5,flex:1 }}>{pickup}</span>
                </div>
                <div style={{ width:1,height:10,background:"rgba(255,255,255,0.08)",marginLeft:3.5 }} />
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:8,height:8,borderRadius:2,flexShrink:0,
                    background:"#b464ff",boxShadow:"0 0 6px #b464ff" }} />
                  <span style={{ color:destCoord?"#f8f0e0":"#6a5a40",fontSize:10.5,flex:1 }}>
                    {dest || "Chưa chọn điểm đến"}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Form nhập địa chỉ (luôn hiện) ── */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(180,100,255,0.18)",
            borderRadius:16,padding:14,marginBottom:12 }}>

            {/* Label section */}
            <div style={{ color:"#6a5a40",fontSize:9,fontWeight:700,letterSpacing:.8,marginBottom:10 }}>
              NHẬP ĐỊA CHỈ CỦA BẠN
            </div>

            {/* Điểm đón */}
            <div style={{ marginBottom:12 }}>
              <div style={{ color:"#3ecf6e",fontSize:10,fontWeight:700,marginBottom:5,display:"flex",alignItems:"center",gap:5 }}>
                <div style={{ width:7,height:7,borderRadius:"50%",background:"#3ecf6e",boxShadow:"0 0 5px #3ecf6e" }} />
                ĐIỂM ĐÓN KHÁCH
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <input value={pickup} onChange={e=>{setPickup(e.target.value);setSelectedFixedId(null)}}
                  style={{ flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(62,207,110,0.2)",
                    borderRadius:10,padding:"9px 12px",color:"#f8f0e0",fontSize:12,caretColor:"#3ecf6e",fontFamily:"Lexend" }}
                  placeholder={pickupLoading ? "Đang lấy vị trí của bạn..." : "Nhập địa chỉ đón..."} />
                <button onClick={() => setMapMode("pickup")}
                  style={{ width:42,height:42,borderRadius:10,border:"1px solid rgba(62,207,110,0.2)",cursor:"pointer",
                    background:"rgba(62,207,110,0.08)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>📍</button>
              </div>
            </div>

            <div style={{ height:1,background:"rgba(180,100,255,0.08)",marginBottom:12 }} />

            {/* Điểm đến */}
            <div>
              <div style={{ color:"#b464ff",fontSize:10,fontWeight:700,marginBottom:5,display:"flex",alignItems:"center",gap:5 }}>
                <div style={{ width:7,height:7,borderRadius:2,background:"#b464ff",boxShadow:"0 0 5px #b464ff" }} />
                ĐIỂM ĐẾN
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <input value={dest} onChange={e=>{setDest(e.target.value);setSelectedFixedId(null)}}
                  style={{ flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(180,100,255,0.2)",
                    borderRadius:10,padding:"9px 12px",color:"#f8f0e0",fontSize:12,caretColor:"#b464ff",fontFamily:"Lexend" }}
                  placeholder="Bạn muốn đến đâu?" />
                <button onClick={() => setMapMode("dest")}
                  style={{ width:42,height:42,borderRadius:10,border:"1px solid rgba(180,100,255,0.2)",cursor:"pointer",
                    background:"rgba(180,100,255,0.08)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🗺️</button>
              </div>
            </div>
          </div>

          {/* ── Chuyến cố định — toggle ── */}
          {fixedRoutes.filter(r => r.from && r.to).length > 0 && (
            <div style={{ marginBottom:12 }}>
              <button
                onClick={() => { setShowFixedRoutes(p => !p); if (showFixedRoutes) { setSelectedFixedId(null); setDest("") } }}
                style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"10px 14px", borderRadius:12, cursor:"pointer", fontFamily:"Lexend",
                  background: showFixedRoutes ? "rgba(180,100,255,0.1)" : "rgba(255,255,255,0.04)",
                  border:`1px solid ${showFixedRoutes ? "rgba(180,100,255,0.35)" : "rgba(255,255,255,0.1)"}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:15 }}>📍</span>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ color: showFixedRoutes ? "#d49aff" : "#f8f0e0", fontSize:12, fontWeight:700 }}>Chuyến trọn gói</div>
                    <div style={{ color:"#6a5a40", fontSize:10 }}>Giá cố định theo tuyến, không tính km</div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  {showFixedRoutes && selectedFixedId && (
                    <span style={{ background:"rgba(180,100,255,0.2)", border:"1px solid rgba(180,100,255,0.4)",
                      borderRadius:6, padding:"2px 7px", color:"#d49aff", fontSize:10, fontWeight:700 }}>Đã chọn</span>
                  )}
                  <span style={{ color:"#6a5a40", fontSize:16 }}>{showFixedRoutes ? "▲" : "▼"}</span>
                </div>
              </button>
              {showFixedRoutes && <div style={{ display:"flex",flexDirection:"column",gap:6,marginTop:8 }}>
                {fixedRoutes.filter(r => r.from && r.to).map(r => {
                  const isSelected = selectedFixedId === r.id
                  return (
                    <div key={r.id}>
                      {/* Card chọn tuyến */}
                      <div
                        onClick={() => {
                          if (isSelected) { setSelectedFixedId(null) }
                          else { setSelectedFixedId(r.id); setPickup(r.from); setDest(r.to) }
                        }}
                        style={{ background: isSelected ? "rgba(180,100,255,0.12)" : "rgba(255,255,255,0.03)",
                          border:`1px solid ${isSelected ? "rgba(180,100,255,0.45)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius:12,padding:"11px 14px",cursor:"pointer",
                          display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:2 }}>
                            {isSelected && <span style={{ fontSize:11 }}>✓</span>}
                            <span style={{ color: isSelected ? "#d49aff" : "#f8f0e0",fontSize:12,fontWeight:700 }}>
                              {r.from} → {r.to}
                            </span>
                          </div>
                          {r.note && <div style={{ color:"#6a5a40",fontSize:10 }}>{r.note}</div>}
                          <div style={{ color:"#6a5a40",fontSize:10,marginTop:2 }}>
                            Giá trọn gói · Chạm để chọn tuyến này
                          </div>
                        </div>
                        <div style={{ textAlign:"right",flexShrink:0,marginLeft:12 }}>
                          <div style={{ color:"#b464ff",fontSize:14,fontWeight:800 }}>{r.oneWay.toLocaleString("vi-VN")}đ</div>
                          <div style={{ color:"#6a5a40",fontSize:10 }}>1 chiều</div>
                        </div>
                      </div>

                      {/* Panel chọn chiều — chỉ hiện khi được chọn */}
                      {isSelected && (
                        <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}}
                          style={{ background:"rgba(180,100,255,0.07)",border:"1px solid rgba(180,100,255,0.25)",
                            borderRadius:"0 0 12px 12px",borderTop:"none",padding:"10px 14px",marginTop:-2 }}>
                          <div style={{ color:"#b464ff",fontSize:10,fontWeight:700,marginBottom:8 }}>CHỌN CHIỀU ĐI</div>
                          <div style={{ display:"flex",gap:8 }}>
                            <button onClick={()=>setFixedDirection("oneWay")}
                              style={{ flex:1,padding:"8px 0",borderRadius:9,cursor:"pointer",fontFamily:"Lexend",
                                fontSize:11,fontWeight:700,
                                background: fixedDirection==="oneWay" ? "rgba(180,100,255,0.2)" : "rgba(255,255,255,0.04)",
                                border:`1px solid ${fixedDirection==="oneWay" ? "rgba(180,100,255,0.5)" : "rgba(255,255,255,0.1)"}`,
                                color: fixedDirection==="oneWay" ? "#d49aff" : "#6a5a40" }}>
                              ➡️ 1 chiều<br/>
                              <span style={{ fontSize:13 }}>{r.oneWay.toLocaleString("vi-VN")}đ</span>
                            </button>
                            <button onClick={()=>setFixedDirection("twoWay")}
                              style={{ flex:1,padding:"8px 0",borderRadius:9,cursor:"pointer",fontFamily:"Lexend",
                                fontSize:11,fontWeight:700,
                                background: fixedDirection==="twoWay" ? "rgba(180,100,255,0.2)" : "rgba(255,255,255,0.04)",
                                border:`1px solid ${fixedDirection==="twoWay" ? "rgba(180,100,255,0.5)" : "rgba(255,255,255,0.1)"}`,
                                color: fixedDirection==="twoWay" ? "#d49aff" : "#6a5a40" }}>
                              🔄 2 chiều<br/>
                              <span style={{ fontSize:13 }}>{r.twoWay.toLocaleString("vi-VN")}đ</span>
                            </button>
                          </div>
                          {/* Chính sách thời gian chờ */}
                          <div style={{ marginTop:10, borderTop:"1px solid rgba(180,100,255,0.15)", paddingTop:10 }}>
                            <div style={{ color:"#b464ff",fontSize:10,fontWeight:700,marginBottom:7 }}>⏱️ CHÍNH SÁCH THỜI GIAN CHỜ</div>
                            <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                              {[
                                { icon:"✅", label:`Miễn phí chờ`, desc:`${taxiWaiting.freeMinutes} phút đầu`, color:"#3ecf6e" },
                                { icon:"💰", label:`Chờ thêm mỗi giờ`, desc:`+${taxiWaiting.extraHourFee.toLocaleString("vi-VN")}đ/giờ`, color:"#FFB347" },
                                { icon:"🔴", label:`Quá ${taxiWaiting.doubleAfterHours} giờ tổng`, desc:"Tính thành 2 chuyến", color:"#ff6060" },
                              ].map((row,i) => (
                                <div key={i} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
                                  background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"6px 10px" }}>
                                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                                    <span style={{ fontSize:12 }}>{row.icon}</span>
                                    <span style={{ color:"#a0a0b0",fontSize:10 }}>{row.label}</span>
                                  </div>
                                  <span style={{ color:row.color,fontSize:11,fontWeight:700 }}>{row.desc}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ color:"rgba(180,100,255,0.5)",fontSize:9.5,marginTop:8,textAlign:"center",lineHeight:1.5 }}>
                              Giá cố định · Tài xế xác nhận trước khi đón
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )
                })}
              </div>}
            </div>
          )}

          {/* Ước tính giá / Giá cố định */}
          <AnimatePresence>
            {(dest || selectedRoute) && (
              <motion.div initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                style={{ background: selectedRoute ? "rgba(180,100,255,0.1)" : "rgba(180,100,255,0.08)",
                  border:`1px solid ${selectedRoute ? "rgba(180,100,255,0.35)" : "rgba(180,100,255,0.2)"}`,
                  borderRadius:14,padding:14,marginBottom:12 }}>
                {selectedRoute ? (
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div>
                      <div style={{ color:"#b464ff",fontSize:10,fontWeight:700,marginBottom:2 }}>
                        💰 GIÁ TRỌN GÓI — {fixedDirection === "oneWay" ? "1 chiều" : "2 chiều"}
                      </div>
                      <div style={{ color:"#d49aff",fontSize:26,fontWeight:900,lineHeight:1 }}>
                        {formatPrice(estimatedPrice)}
                      </div>
                      <div style={{ color:"#6a5a40",fontSize:10,marginTop:3 }}>
                        {selectedRoute.from} → {selectedRoute.to} · Giá cố định
                      </div>
                    </div>
                    <button onClick={()=>{setSelectedFixedId(null);setDest("")}}
                      style={{ background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
                        borderRadius:8,padding:"5px 10px",cursor:"pointer",color:"#6a5a40",fontSize:10,fontFamily:"Lexend" }}>
                      Huỷ
                    </button>
                  </div>
                ) : (
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <div style={{ color:"#6a5a40",fontSize:10,marginBottom:2 }}>Ước tính cước (tính theo km)</div>
                    <div style={{ color:"#b464ff",fontSize:22,fontWeight:900,lineHeight:1 }}>
                      {formatPrice(estimatedPrice)}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#6a5a40",fontSize:10,marginBottom:2 }}>Khoảng cách</div>
                    <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>
                      {distanceKm > 0 ? `${distanceKm} km` : "≥1 km"}
                    </div>
                    {estimatedKm > 0 && (
                      <div style={{ color:"#6a5a40",fontSize:10,marginTop:2 }}>
                        {Math.round(estimatedKm * 2 + 8)}–{Math.round(estimatedKm * 3 + 12)} phút
                      </div>
                    )}
                  </div>
                </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Thông tin người đặt */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(180,100,255,0.15)",
            borderRadius:14,padding:"12px 14px",marginBottom:12 }}>
            <div style={{ color:"#6a5a40",fontSize:9,fontWeight:700,letterSpacing:.8,marginBottom:10 }}>
              👤 THÔNG TIN NGƯỜI ĐẶT — Tài xế dùng để liên hệ bạn
            </div>
            <div style={{ display:"flex",gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ color:"#6a5a40",fontSize:9,marginBottom:4 }}>Họ tên</div>
                <input value={customerName} onChange={e=>setCustomerName(e.target.value)}
                  placeholder="Nhập họ tên..."
                  style={{ width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(180,100,255,0.2)",
                    borderRadius:9,padding:"8px 10px",color:"#f8f0e0",fontSize:12,fontFamily:"Lexend",boxSizing:"border-box" as const }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:"#6a5a40",fontSize:9,marginBottom:4 }}>Số điện thoại</div>
                <input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)}
                  placeholder="Số điện thoại..."
                  inputMode="tel"
                  style={{ width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(180,100,255,0.2)",
                    borderRadius:9,padding:"8px 10px",color:"#f8f0e0",fontSize:12,fontFamily:"Lexend",boxSizing:"border-box" as const }} />
              </div>
            </div>
          </div>

          {/* Features */}
          <div style={{ display:"flex",gap:8 }}>
            {["❄️ Điều hoà","🔒 Tài xế xác minh","💬 Chat app"].map((t,i) => (
              <div key={i} style={{ flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
                borderRadius:10,padding:"7px 4px",textAlign:"center",color:"#6a5a40",fontSize: 10,lineHeight:1.5 }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ position:"fixed",bottom:0,left:0,right:0,
        background:"rgba(8,8,6,0.97)",backdropFilter:"blur(20px)",
        borderTop:"1px solid rgba(180,100,255,0.12)",
        padding:"12px 16px calc(env(safe-area-inset-bottom,0px) + 16px)",zIndex:40 }}>
        <motion.button whileTap={{ scale:0.97 }}
          disabled={!dest || loading} onClick={handleBook}
          style={{ width:"100%",height:52,borderRadius:14,border:"none",fontFamily:"Lexend",
            fontSize:14,fontWeight:800,cursor:!dest||loading?"default":"pointer",
            background:dest&&!loading?"linear-gradient(135deg,#7c3aed,#b464ff,#c084fc)":"rgba(255,255,255,0.06)",
            color:dest&&!loading?"#fff":"#6a5a40",
            boxShadow:dest&&!loading?"0 4px 24px rgba(180,100,255,0.4)":"none",
            position:"relative",overflow:"hidden" }}>
          {dest && !loading && (
            <div style={{ position:"absolute",top:0,left:"-60%",width:"35%",height:"100%",
              background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
              animation:"txShim 2.5s infinite" }} />
          )}
          <span style={{ position:"relative",zIndex:1 }}>
            {loading ? `Đang tìm ${car.label}...` : `${car.emoji} Đặt taxi ngay`}
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
