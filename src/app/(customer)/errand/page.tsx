"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import AddressPicker from "@/components/map/AddressPicker"
import { createClient } from "@/lib/supabase/client"
import type { AddressPickerResult } from "@/types"

type BuyItem = { id: number; name: string; qty: number; price: string }
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

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

function ErrandContent() {
  const params   = useSearchParams()
  const supabase = createClient()
  const [tab,     setTab]     = useState<"buy" | "deliver">(
    params.get("type") === "deliver" ? "deliver" : "buy"
  )
  const [pickup,       setPickup]       = useState("")
  const [delivery,     setDelivery]     = useState("")
  const [pickupCoord,  setPickupCoord]  = useState<{ lat: number; lng: number } | null>(null)
  const [deliveryCoord,setDeliveryCoord]= useState<{ lat: number; lng: number } | null>(null)
  const [items,        setItems]        = useState<BuyItem[]>([{ id: 1, name: "", qty: 1, price: "" }])
  const [note,         setNote]         = useState("")
  const [pkgDesc,      setPkgDesc]      = useState("")
  const [mapMode,      setMapMode]      = useState<null | "pickup" | "delivery">(null)
  const [loading,      setLoading]      = useState(false)
  const [toast,        setToast]        = useState("")

  const [errandRows,    setErrandRows]    = useState<string[]>(["20000","17000","14000","12000","11000","10000","9000","8500","8000","7500"])
  const [errandExtra,   setErrandExtra]   = useState("7000")
  const [delivPkgRows,  setDelivPkgRows]  = useState<string[]>(["18000","15000","12000","10000","9000","8500","8000","7500","7000","6500"])
  const [delivPkgExtra, setDelivPkgExtra] = useState("6000")
  const [distanceKm,    setDistanceKm]   = useState<number | null>(null)

  const [muaHoEnabled,  setMuaHoEnabled]  = useState(true)
  const [giaoHoEnabled, setGiaoHoEnabled] = useState(true)
  const [muaHoMsg,      setMuaHoMsg]      = useState("Dịch vụ mua hộ tạm ngừng phục vụ. Vui lòng thử lại sau.")
  const [giaoHoMsg,     setGiaoHoMsg]     = useState("Dịch vụ giao hộ tạm ngừng phục vụ. Vui lòng thử lại sau.")

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("app_settings").select("value").eq("key","pricing").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key","service_toggles").maybeSingle(),
    ]).then(([pricingRes, toggleRes]) => {
      const p = pricingRes.data?.value as Record<string, { rows?: string[]; extra?: string } | undefined> | null
      const er = p?.errand;  const dp = p?.delivery_pkg
      if (er?.rows) setErrandRows(er.rows)
      if (er?.extra) setErrandExtra(er.extra)
      if (dp?.rows) setDelivPkgRows(dp.rows)
      if (dp?.extra) setDelivPkgExtra(dp.extra)
      const toggles = toggleRes.data?.value as Record<string, { enabled?: boolean; customerMsg?: string }> | null
      if (toggles?.mua_ho?.enabled === false) {
        setMuaHoEnabled(false)
        if (toggles.mua_ho.customerMsg) setMuaHoMsg(toggles.mua_ho.customerMsg)
      }
      if (toggles?.giao_ho?.enabled === false) {
        setGiaoHoEnabled(false)
        if (toggles.giao_ho.customerMsg) setGiaoHoMsg(toggles.giao_ho.customerMsg)
      }
    })
  }, [])

  useEffect(() => {
    if (pickupCoord && deliveryCoord)
      setDistanceKm(haversineKm(pickupCoord.lat, pickupCoord.lng, deliveryCoord.lat, deliveryCoord.lng))
  }, [pickupCoord, deliveryCoord])

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200) }

  const handleSubmit = async () => {
    if (!pickup.trim())   { fireToast("Vui lòng nhập địa chỉ xuất phát"); return }
    if (!delivery.trim()) { fireToast("Vui lòng nhập địa chỉ giao đến"); return }
    if (tab === "buy") {
      const hasItem = items.some(i => i.name.trim())
      if (!hasItem) { fireToast("Vui lòng nhập ít nhất 1 món cần mua"); return }
    } else {
      if (!pkgDesc.trim()) { fireToast("Vui lòng mô tả gói hàng cần giao"); return }
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { fireToast("Vui lòng đăng nhập để đặt dịch vụ"); setLoading(false); return }

      const pLat = pickupCoord?.lat ?? 12.683
      const pLng = pickupCoord?.lng ?? 108.483
      const dLat = deliveryCoord?.lat ?? 12.683
      const dLng = deliveryCoord?.lng ?? 108.483

      const itemsDesc = tab === "buy"
        ? items.filter(i => i.name.trim()).map(i => `${i.name} x${i.qty}${i.price ? " ~" + i.price : ""}`).join(", ")
        : null

      const estimatedCost = tab === "buy"
        ? items.reduce((acc, i) => {
            const p = parseInt(i.price.replace(/[^0-9]/g, "")) || 0
            return acc + p * i.qty
          }, 0) || null
        : null

      const { error } = await supabase.from("errands").insert({
        customer_id:           user.id,
        type:                  tab === "buy" ? "buy_for_me" : "deliver_for_me",
        status:                "pending",
        pickup_address:        pickup,
        pickup_lat:            pLat,
        pickup_lng:            pLng,
        delivery_address:      delivery,
        delivery_lat:          dLat,
        delivery_lng:          dLng,
        items_description:     itemsDesc,
        estimated_items_cost:  estimatedCost,
        package_description:   tab === "deliver" ? pkgDesc : null,
        note:                  note || null,
        service_fee:           serviceFee,
        payment_method:        "cash",
      })

      if (error) { fireToast("Không thể đặt dịch vụ. Thử lại sau."); setLoading(false); return }
      fireToast("✅ Đặt dịch vụ thành công! Đang tìm tài xế...")
    } catch {
      fireToast("Có lỗi xảy ra, vui lòng thử lại")
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => setItems(p => [...p, { id: Date.now(), name: "", qty: 1, price: "" }])
  const removeItem = (id: number) => setItems(p => p.filter(i => i.id !== id))
  const updateItem = (id: number, field: keyof BuyItem, value: string | number) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i))

  const estimatedBudget = items.reduce((s, i) => s + parseInt(i.price.replace(/\D/g, "") || "0") * i.qty, 0)
  const serviceFee = tab === "buy"
    ? calcFeeFromRows(distanceKm ?? 2, errandRows, errandExtra)
    : calcFeeFromRows(distanceKm ?? 2, delivPkgRows, delivPkgExtra)

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        textarea,input{outline:none;font-family:'Lexend',sans-serif}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
        @keyframes erShim{0%{left:-60%}100%{left:120%}}
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 12px)",left:"50%",transform:"translateX(-50%)",
          zIndex:9999,whiteSpace:"nowrap",
          background:"rgba(255,107,0,0.15)",border:"1px solid rgba(255,107,0,0.35)",
          borderRadius:12,padding:"7px 16px",
          color:"#FF8C00",fontSize:11,fontWeight:600,backdropFilter:"blur(10px)",fontFamily:"Lexend",
        }}>
          {toast}
        </div>
      )}

      {/* Banner tạm ngừng theo tab */}
      {((tab === "buy" && !muaHoEnabled) || (tab === "deliver" && !giaoHoEnabled)) && (
        <div style={{ position:"fixed",inset:0,zIndex:200,background:"#080806",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:24 }}>
          <div style={{ fontSize:56 }}>{tab === "buy" ? "🛒" : "📦"}</div>
          <div style={{ color:"#f8f0e0",fontSize:18,fontWeight:700,textAlign:"center" }}>
            {tab === "buy" ? "Mua hộ" : "Giao hộ"} tạm ngừng phục vụ
          </div>
          <div style={{ color:"#6a5a40",fontSize:12,textAlign:"center",lineHeight:1.6 }}>
            {tab === "buy" ? muaHoMsg : giaoHoMsg}
          </div>
          <a href="/" style={{ marginTop:8,padding:"12px 28px",borderRadius:14,background:"linear-gradient(135deg,#FF6B00,#FF8C00)",color:"#fff",fontSize:13,fontWeight:700,textDecoration:"none" }}>← Quay lại</a>
        </div>
      )}

      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"calc(env(safe-area-inset-top,0px) + 12px) 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
            <a href="/" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Đặt dịch vụ</div>
              <div style={{ color:"#6a5a40",fontSize:9 }}>Mua hộ · Giao hộ tại Krông Pắc</div>
            </div>
          </div>
          <div style={{ display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:12,padding:3,gap:3 }}>
            {(["buy","deliver"] as const).map(t => {
              const isOff = t === "buy" ? !muaHoEnabled : !giaoHoEnabled
              return (
                <button key={t} onClick={() => setTab(t)}
                  style={{ flex:1,height:38,borderRadius:9,background:tab===t?"linear-gradient(90deg,#FF6B00,#FF8C00)":"transparent",border:"none",cursor:isOff?"not-allowed":"pointer",color:tab===t?"#fff":isOff?"#3a2a18":"#6a5a40",fontSize:12,fontWeight:tab===t?700:500,fontFamily:"Lexend",transition:"all .2s",opacity:isOff?0.5:1 }}>
                  {t === "buy" ? "🛍️ Mua hộ" : "📦 Giao hộ"}{isOff?" (Tạm đóng)":""}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px 120px" }}>

          {/* Address */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#6a5a40",fontSize:9,marginBottom:10,fontWeight:600 }}>ĐỊA CHỈ</div>
            <div style={{ display:"flex",gap:10,alignItems:"flex-start",marginBottom:10 }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:"#FF6B00",marginTop:6,flexShrink:0,boxShadow:"0 0 8px #FF6B00" }} />
              <div style={{ flex:1 }}>
                <div style={{ color:"#6a5a40",fontSize:9,marginBottom:4 }}>{tab==="buy"?"Đến cửa hàng / chợ":"Lấy hàng tại"}</div>
                <input value={pickup} onChange={e=>setPickup(e.target.value)} placeholder={tab==="buy"?"VD: Chợ Phước An...":"Địa chỉ lấy hàng..."} style={{ width:"100%",background:"none",border:"none",color:"#f8f0e0",fontSize:11.5,padding:0 }} />
              </div>
              <button onClick={() => setMapMode("pickup")}
                style={{ width:28,height:28,borderRadius:8,border:"none",cursor:"pointer",
                  background:"rgba(255,107,0,0.12)",flexShrink:0,marginTop:2,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:13 }}>
                📍
              </button>
            </div>
            <div style={{ height:1,background:"rgba(255,255,255,0.05)",margin:"8px 0 8px 18px" }} />
            <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
              <div style={{ width:8,height:8,borderRadius:2,background:"#3ecf6e",marginTop:6,flexShrink:0,boxShadow:"0 0 8px #3ecf6e" }} />
              <div style={{ flex:1 }}>
                <div style={{ color:"#6a5a40",fontSize:9,marginBottom:4 }}>Giao đến</div>
                <input value={delivery} onChange={e=>setDelivery(e.target.value)} placeholder="Địa chỉ nhận hàng của bạn..." style={{ width:"100%",background:"none",border:"none",color:"#f8f0e0",fontSize:11.5,padding:0 }} />
              </div>
              <button onClick={() => setMapMode("delivery")}
                style={{ width:28,height:28,borderRadius:8,border:"none",cursor:"pointer",
                  background:"rgba(62,207,110,0.12)",flexShrink:0,marginTop:2,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:13 }}>
                🗺️
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {tab === "buy" ? (
              <motion.div key="buy" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-8 }} transition={{ duration:.2 }}>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                    <div style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>🛒 Danh sách cần mua</div>
                    <button onClick={addItem} style={{ background:"rgba(255,107,0,0.1)",border:"1px solid rgba(255,107,0,0.25)",borderRadius:8,padding:"4px 10px",color:"#FF8C00",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Lexend" }}>+ Thêm</button>
                  </div>
                  {items.map((item, idx) => (
                    <div key={item.id} style={{ display:"flex",gap:7,marginBottom:8,alignItems:"center" }}>
                      <div style={{ width:20,height:20,borderRadius:6,background:"rgba(255,107,0,0.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#6a5a40",fontSize:9,flexShrink:0 }}>{idx+1}</div>
                      <input value={item.name} onChange={e=>updateItem(item.id,"name",e.target.value)} placeholder="Tên món / sản phẩm" style={{ flex:2,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"6px 10px",color:"#f8f0e0",fontSize:10 }} />
                      <input value={item.price} onChange={e=>updateItem(item.id,"price",e.target.value)} placeholder="~giá" style={{ width:68,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"6px 8px",color:"#FF8C00",fontSize:10 }} />
                      <div style={{ display:"flex",alignItems:"center",gap:3,flexShrink:0 }}>
                        <button onClick={()=>updateItem(item.id,"qty",Math.max(1,item.qty-1))} style={{ width:36,height:36,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#f8f0e0",fontSize:15,cursor:"pointer" }}>−</button>
                        <span style={{ color:"#f8f0e0",fontSize:11,width:18,textAlign:"center" }}>{item.qty}</span>
                        <button onClick={()=>updateItem(item.id,"qty",item.qty+1)} style={{ width:36,height:36,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#f8f0e0",fontSize:15,cursor:"pointer" }}>+</button>
                      </div>
                      {items.length > 1 && (
                        <button onClick={()=>removeItem(item.id)} style={{ width:24,height:24,borderRadius:6,background:"rgba(255,64,64,0.1)",border:"none",color:"#ff4040",fontSize:15,cursor:"pointer",flexShrink:0 }}>×</button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10 }}>
                  <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:8 }}>📝 Ghi chú thêm</div>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="VD: Mua loại chín, đừng lấy ngọt quá..." rows={3} style={{ width:"100%",background:"none",border:"none",color:"#b0956a",fontSize:10.5,resize:"none",lineHeight:1.6 }} />
                </div>
              </motion.div>
            ) : (
              <motion.div key="deliver" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-8 }} transition={{ duration:.2 }}>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10 }}>
                  <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:8 }}>📦 Mô tả gói hàng</div>
                  <textarea value={pkgDesc} onChange={e=>setPkgDesc(e.target.value)} placeholder="VD: 1 túi quần áo, khoảng 2kg, không cồng kềnh..." rows={3} style={{ width:"100%",background:"none",border:"none",color:"#b0956a",fontSize:10.5,resize:"none",lineHeight:1.6 }} />
                </div>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10,display:"flex",gap:12,alignItems:"center" }}>
                  <div style={{ width:56,height:56,borderRadius:12,background:"rgba(255,255,255,0.04)",border:"1px dashed rgba(255,255,255,0.15)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2 }}>
                    <span style={{ fontSize:20 }}>📷</span>
                    <span style={{ color:"#6a5a40",fontSize:7 }}>Ảnh</span>
                  </div>
                  <div>
                    <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:3 }}>Chụp ảnh gói hàng</div>
                    <div style={{ color:"#6a5a40",fontSize:9,lineHeight:1.5 }}>Giúp tài xế nhận dạng hàng dễ hơn</div>
                  </div>
                </div>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10 }}>
                  <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:8 }}>📝 Ghi chú cho tài xế</div>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="VD: Gọi trước khi đến, hàng dễ vỡ..." rows={3} style={{ width:"100%",background:"none",border:"none",color:"#b0956a",fontSize:10.5,resize:"none",lineHeight:1.6 }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Price estimate */}
          <div style={{ background:"rgba(255,107,0,0.07)",border:"1px solid rgba(255,107,0,0.2)",borderRadius:14,padding:14 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:10 }}>💰 Ước tính chi phí</div>
            {tab==="buy" && (
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                <span style={{ color:"#6a5a40",fontSize:10 }}>Chi phí hàng (ước tính)</span>
                <span style={{ color:"#b0956a",fontSize:10,fontWeight:600 }}>{estimatedBudget>0?fmt(estimatedBudget):"—"}</span>
              </div>
            )}
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
              <span style={{ color:"#6a5a40",fontSize:10 }}>
                {tab === "buy" ? "Phí mua hộ" : "Phí giao hộ"}{distanceKm ? ` (${distanceKm.toFixed(1)} km)` : ""}
              </span>
              <span style={{ color:"#b0956a",fontSize:10,fontWeight:600 }}>{fmt(serviceFee)}</span>
            </div>
            <div style={{ height:1,background:"rgba(255,255,255,0.06)",margin:"8px 0" }} />
            <div style={{ display:"flex",justifyContent:"space-between" }}>
              <span style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>Tổng ước tính</span>
              <span style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontSize:14,fontWeight:800 }}>{fmt(tab==="buy"?estimatedBudget+serviceFee:serviceFee)}</span>
            </div>
            <div style={{ color:"#6a5a40",fontSize:8.5,marginTop:6 }}>* Thanh toán thực tế dựa trên chi phí phát sinh thực tế</div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(8,8,6,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.07)",padding:"12px 16px calc(env(safe-area-inset-bottom,0px) + 16px)",zIndex:10 }}>
          <button
            onClick={loading ? undefined : handleSubmit}
            disabled={loading}
            style={{ width:"100%",height:52,borderRadius:14,
              background:loading?"rgba(255,255,255,0.08)":"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
              border:"none",cursor:loading?"default":"pointer",color:loading?"#6a5a40":"#fff",
              fontSize:14,fontWeight:800,fontFamily:"Lexend",
              boxShadow:loading?"none":"0 4px 24px rgba(255,107,0,0.45)",
              position:"relative",overflow:"hidden",
            }}>
            {!loading && (
              <div style={{ position:"absolute",top:0,left:"-60%",width:"35%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",animation:"erShim 2.5s infinite" }} />
            )}
            <span style={{ position:"relative",zIndex:1 }}>
              {loading ? "Đang đặt dịch vụ..." : tab==="buy"?"🛍️ Đặt mua hộ":"📦 Đặt giao hộ"}
            </span>
          </button>
        </div>
      </div>

      {/* AddressPicker fullscreen overlay */}
      {mapMode && (
        <div style={{ position:"fixed",inset:0,zIndex:300 }}>
          <AddressPicker
            height="100dvh"
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

export default function ErrandPage() {
  return (
    <Suspense>
      <ErrandContent />
    </Suspense>
  )
}
