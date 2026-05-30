"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import AddressPicker from "@/components/map/AddressPicker"
import { createClient } from "@/lib/supabase/client"
import type { AddressPickerResult } from "@/types"

type BuyItem = { id: number; name: string; qty: number; price: string }
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function MuaHoPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [pickup,        setPickup]        = useState("")
  const [delivery,      setDelivery]      = useState("")
  const [pickupCoord,   setPickupCoord]   = useState<{ lat: number; lng: number } | null>(null)
  const [deliveryCoord, setDeliveryCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [items,         setItems]         = useState<BuyItem[]>([{ id: 1, name: "", qty: 1, price: "" }])
  const [note,          setNote]          = useState("")
  const [mapMode,       setMapMode]       = useState<null | "pickup" | "delivery">(null)
  const [loading,       setLoading]       = useState(false)
  const [toast,         setToast]         = useState("")

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2300) }

  const addItem    = () => setItems(p => [...p, { id: Date.now(), name: "", qty: 1, price: "" }])
  const removeItem = (id: number) => setItems(p => p.filter(i => i.id !== id))
  const updateItem = (id: number, field: keyof BuyItem, value: string | number) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i))

  const estimatedBudget = items.reduce((s, i) => s + parseInt(i.price.replace(/\D/g, "") || "0") * i.qty, 0)
  const serviceFee = 25000

  const handleSubmit = async () => {
    if (!pickup.trim())   { fireToast("Vui lòng nhập địa chỉ cửa hàng / chợ"); return }
    if (!delivery.trim()) { fireToast("Vui lòng nhập địa chỉ giao đến"); return }
    if (!items.some(i => i.name.trim())) { fireToast("Vui lòng nhập ít nhất 1 món cần mua"); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { fireToast("Vui lòng đăng nhập để đặt dịch vụ"); setLoading(false); return }
      const pLat = pickupCoord?.lat ?? 12.683
      const pLng = pickupCoord?.lng ?? 108.483
      const dLat = deliveryCoord?.lat ?? 12.683
      const dLng = deliveryCoord?.lng ?? 108.483
      const itemsDesc = items.filter(i => i.name.trim())
        .map(i => `${i.name} x${i.qty}${i.price ? " ~" + i.price : ""}`).join(", ")
      const { error } = await supabase.from("errands").insert({
        customer_id:          user.id,
        type:                 "buy_for_me",
        status:               "pending",
        pickup_address:       pickup,
        pickup_lat:           pLat,
        pickup_lng:           pLng,
        delivery_address:     delivery,
        delivery_lat:         dLat,
        delivery_lng:         dLng,
        items_description:    itemsDesc,
        estimated_items_cost: estimatedBudget || null,
        note:                 note || null,
        service_fee:          serviceFee,
        payment_method:       "cash",
      })
      if (error) { fireToast("Lỗi: " + (error?.message ?? "Không thể đặt dịch vụ")); setLoading(false); return }
      fireToast("✅ Đặt mua hộ thành công! Đang tìm tài xế...")
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
        @keyframes mhShim{0%{left:-60%}100%{left:120%}}
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 12px)",left:"50%",
          transform:"translateX(-50%)",zIndex:9999,whiteSpace:"nowrap",
          background:"rgba(62,207,110,0.15)",border:"1px solid rgba(62,207,110,0.35)",
          borderRadius:12,padding:"7px 16px",color:"#3ecf6e",fontSize:11,fontWeight:600,
          backdropFilter:"blur(10px)",fontFamily:"Lexend" }}>
          {toast}
        </div>
      )}

      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"calc(env(safe-area-inset-top,0px) + 12px) 16px 14px",
          background:"rgba(8,8,6,0.97)",backdropFilter:"blur(20px)",
          borderBottom:"1px solid rgba(62,207,110,0.12)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <button onClick={() => router.back()}
              style={{ width:40,height:40,borderRadius:12,background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:18,cursor:"pointer",flexShrink:0 }}>
              ←
            </button>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>🛍️ Mua hộ</div>
              <div style={{ color:"#6a5a40",fontSize:9,marginTop:1 }}>Tài xế đi chợ / cửa hàng mua cho bạn</div>
            </div>
            <div style={{ background:"rgba(62,207,110,0.12)",border:"1px solid rgba(62,207,110,0.25)",
              borderRadius:8,padding:"3px 10px",color:"#3ecf6e",fontSize:9,fontWeight:700 }}>HOT 🔥</div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px 140px" }}>

          {/* How it works */}
          <div style={{ display:"flex",gap:8,marginBottom:12,padding:"10px 12px",
            background:"rgba(62,207,110,0.05)",border:"1px solid rgba(62,207,110,0.12)",borderRadius:12 }}>
            {["🏪 Chọn nơi mua","🛒 Liệt kê đồ","🛵 Tài xế mua & giao"].map((s,i) => (
              <div key={i} style={{ flex:1,textAlign:"center",color:"#6a5a40",fontSize:8.5,lineHeight:1.5 }}>{s}</div>
            ))}
          </div>

          {/* Địa chỉ */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#6a5a40",fontSize:9,marginBottom:10,fontWeight:600,letterSpacing:.5 }}>ĐỊA CHỈ</div>

            <div style={{ display:"flex",gap:10,alignItems:"flex-start",marginBottom:10 }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:"#3ecf6e",marginTop:6,
                flexShrink:0,boxShadow:"0 0 8px #3ecf6e" }} />
              <div style={{ flex:1 }}>
                <div style={{ color:"#6a5a40",fontSize:8.5,marginBottom:3 }}>Đến mua tại (chợ / cửa hàng)</div>
                <input value={pickup} onChange={e=>setPickup(e.target.value)}
                  placeholder="VD: Chợ Phước An, Siêu thị Go!..."
                  style={{ width:"100%",background:"none",border:"none",color:"#f8f0e0",fontSize:11.5,padding:0 }} />
              </div>
              <button onClick={() => setMapMode("pickup")}
                style={{ width:40,height:40,borderRadius:10,border:"none",cursor:"pointer",
                  background:"rgba(62,207,110,0.12)",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>📍</button>
            </div>

            <div style={{ height:1,background:"rgba(255,255,255,0.05)",margin:"8px 0 8px 18px" }} />

            <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
              <div style={{ width:8,height:8,borderRadius:2,background:"#FF6B00",marginTop:6,
                flexShrink:0,boxShadow:"0 0 8px #FF6B00" }} />
              <div style={{ flex:1 }}>
                <div style={{ color:"#6a5a40",fontSize:8.5,marginBottom:3 }}>Giao đến nhà bạn</div>
                <input value={delivery} onChange={e=>setDelivery(e.target.value)}
                  placeholder="Địa chỉ nhận hàng..."
                  style={{ width:"100%",background:"none",border:"none",color:"#f8f0e0",fontSize:11.5,padding:0 }} />
              </div>
              <button onClick={() => setMapMode("delivery")}
                style={{ width:40,height:40,borderRadius:10,border:"none",cursor:"pointer",
                  background:"rgba(255,107,0,0.12)",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🗺️</button>
            </div>
          </div>

          {/* Danh sách mua */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
              <div style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>🛒 Danh sách cần mua</div>
              <button onClick={addItem}
                style={{ background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.25)",
                  borderRadius:8,padding:"4px 10px",color:"#3ecf6e",fontSize:10,fontWeight:700,
                  cursor:"pointer",fontFamily:"Lexend" }}>+ Thêm</button>
            </div>
            {items.map((item, idx) => (
              <motion.div key={item.id} initial={{ opacity:0,y:6 }} animate={{ opacity:1,y:0 }}
                style={{ display:"flex",gap:6,marginBottom:8,alignItems:"center" }}>
                <div style={{ width:20,height:20,borderRadius:6,background:"rgba(62,207,110,0.1)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  color:"#3ecf6e",fontSize:9,flexShrink:0,fontWeight:700 }}>{idx+1}</div>
                <input value={item.name} onChange={e=>updateItem(item.id,"name",e.target.value)}
                  placeholder="Tên món / sản phẩm"
                  style={{ flex:2,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:8,padding:"7px 10px",color:"#f8f0e0",fontSize:10.5 }} />
                <input value={item.price} onChange={e=>updateItem(item.id,"price",e.target.value)}
                  placeholder="~giá"
                  style={{ width:66,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:8,padding:"7px 8px",color:"#3ecf6e",fontSize:10.5 }} />
                <div style={{ display:"flex",alignItems:"center",gap:2,flexShrink:0 }}>
                  <button onClick={()=>updateItem(item.id,"qty",Math.max(1,item.qty-1))}
                    style={{ width:36,height:36,borderRadius:8,background:"rgba(255,255,255,0.06)",
                      border:"none",color:"#f8f0e0",fontSize:16,cursor:"pointer" }}>−</button>
                  <span style={{ color:"#f8f0e0",fontSize:11,width:20,textAlign:"center" }}>{item.qty}</span>
                  <button onClick={()=>updateItem(item.id,"qty",item.qty+1)}
                    style={{ width:36,height:36,borderRadius:8,background:"rgba(255,255,255,0.06)",
                      border:"none",color:"#f8f0e0",fontSize:16,cursor:"pointer" }}>+</button>
                </div>
                {items.length > 1 && (
                  <button onClick={()=>removeItem(item.id)}
                    style={{ width:28,height:28,borderRadius:7,background:"rgba(255,64,64,0.1)",
                      border:"none",color:"#ff4040",fontSize:16,cursor:"pointer",flexShrink:0 }}>×</button>
                )}
              </motion.div>
            ))}
          </div>

          {/* Ghi chú */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:8 }}>📝 Ghi chú đặc biệt</div>
            <textarea value={note} onChange={e=>setNote(e.target.value)}
              placeholder="VD: Mua loại chín vừa, không lấy hàng ở quầy 3, cần gấp trước 11h..."
              rows={3} style={{ width:"100%",background:"none",border:"none",
                color:"#b0956a",fontSize:10.5,resize:"none",lineHeight:1.7 }} />
          </div>

          {/* Chi phí */}
          <div style={{ background:"rgba(62,207,110,0.06)",border:"1px solid rgba(62,207,110,0.18)",
            borderRadius:14,padding:14 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:10 }}>💰 Ước tính chi phí</div>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:7 }}>
              <span style={{ color:"#6a5a40",fontSize:10 }}>Chi phí hàng (ước tính)</span>
              <span style={{ color:"#b0956a",fontSize:10,fontWeight:600 }}>
                {estimatedBudget > 0 ? fmt(estimatedBudget) : "—"}
              </span>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:7 }}>
              <span style={{ color:"#6a5a40",fontSize:10 }}>Phí dịch vụ mua hộ</span>
              <span style={{ color:"#b0956a",fontSize:10,fontWeight:600 }}>{fmt(serviceFee)}</span>
            </div>
            <div style={{ height:1,background:"rgba(255,255,255,0.06)",margin:"8px 0" }} />
            <div style={{ display:"flex",justifyContent:"space-between" }}>
              <span style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>Tổng ước tính</span>
              <span style={{ background:"linear-gradient(90deg,#3ecf6e,#2ecc71)",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                backgroundClip:"text",fontSize:14,fontWeight:800 }}>
                {fmt(estimatedBudget + serviceFee)}
              </span>
            </div>
            <div style={{ color:"#6a5a40",fontSize:8.5,marginTop:6 }}>
              * Thanh toán thực tế theo hoá đơn mua hàng thực + phí dịch vụ
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(8,8,6,0.97)",
          backdropFilter:"blur(20px)",borderTop:"1px solid rgba(62,207,110,0.12)",
          padding:"12px 16px calc(env(safe-area-inset-bottom,0px) + 16px)",zIndex:10 }}>
          <button onClick={loading ? undefined : handleSubmit} disabled={loading}
            style={{ width:"100%",height:52,borderRadius:14,border:"none",
              cursor:loading?"default":"pointer",fontSize:14,fontWeight:800,fontFamily:"Lexend",
              background:loading?"rgba(255,255,255,0.08)":"linear-gradient(90deg,#2ecc71,#3ecf6e,#1abc9c)",
              color:loading?"#6a5a40":"#fff",
              boxShadow:loading?"none":"0 4px 24px rgba(62,207,110,0.35)",
              position:"relative",overflow:"hidden" }}>
            {!loading && (
              <div style={{ position:"absolute",top:0,left:"-60%",width:"35%",height:"100%",
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                animation:"mhShim 2.5s infinite" }} />
            )}
            <span style={{ position:"relative",zIndex:1 }}>
              {loading ? "Đang đặt dịch vụ..." : "🛍️ Đặt mua hộ ngay"}
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
