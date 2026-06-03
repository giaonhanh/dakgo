"use client"

// src/app/(customer)/order-success/page.tsx

import { useEffect, useState, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const CONF_COLORS = ["#FF6B00","#FF8C00","#FFB347","#3ecf6e","#4a8ff5","#b464ff","#ff4040","#f5c542"]

function Confetti() {
  const pieces = Array.from({ length: 32 }, (_, i) => ({
    id: i, color: CONF_COLORS[i % CONF_COLORS.length],
    left: Math.random() * 100, delay: Math.random() * 1.6,
    dur: 2.2 + Math.random() * 2.2, size: 4 + Math.random() * 4, rot: Math.random() * 360,
  }))
  return (
    <div style={{ position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0 }}>
      {pieces.map(p => (
        <motion.div key={p.id}
          style={{ position:"absolute",width:p.size,height:p.size,
            borderRadius:p.size < 5 ? "50%" : 1,background:p.color,
            left:`${p.left}%`,top:"-8px",rotate:p.rot }}
          animate={{ y:["0vh","110vh"],rotate:[p.rot,p.rot+360],opacity:[1,0.3] }}
          transition={{ duration:p.dur,delay:p.delay,ease:"linear",repeat:Infinity }} />
      ))}
    </div>
  )
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function ETABar({ etaMin }: { etaMin: number }) {
  const [remaining, setRemaining] = useState(etaMin * 60)
  useEffect(() => {
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  const min = Math.floor(remaining / 60)
  const sec = remaining % 60
  const pct = ((etaMin * 60 - remaining) / (etaMin * 60)) * 100
  return (
    <div style={{ background:"rgba(255,107,0,0.07)",border:"1px solid rgba(255,107,0,0.2)",borderRadius:13,padding:"12px 14px" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
        <div style={{ color:"#6a5a40",fontSize: 11 }}>⏱️ Thời gian giao dự kiến</div>
        <div style={{ color:"#FF8C00",fontSize:18,fontWeight:800,fontVariantNumeric:"tabular-nums" }}>
          {min.toString().padStart(2,"0")}:{sec.toString().padStart(2,"0")}
        </div>
      </div>
      <div style={{ height:4,borderRadius:2,background:"rgba(255,255,255,0.08)",overflow:"hidden" }}>
        <motion.div style={{ height:"100%",borderRadius:2,background:"linear-gradient(90deg,#FF6B00,#FFB347)" }}
          animate={{ width:`${pct}%` }} transition={{ duration:1,ease:"linear" }} />
      </div>
      <div style={{ display:"flex",justifyContent:"space-between",marginTop:5 }}>
        <span style={{ color:"#6a5a40",fontSize: 11 }}>Đặt hàng</span>
        <span style={{ color:"#6a5a40",fontSize: 11 }}>Đã giao</span>
      </div>
    </div>
  )
}

function OrderSuccessContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId")

  const [orderData, setOrderData] = useState<{
    id: string; shopName: string; shopEmoji: string; total: number
    items: { name: string; qty: number; emoji: string }[]
    driver: { name: string; rating: number; plate: string; phone: string } | null
    address: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    if (!orderId) { setLoading(false); return }
    async function load() {
      const { data: order } = await supabase
        .from("orders")
        .select(`
          id, total_amount, delivery_address, driver_id,
          shops(name),
          order_items(name, qty)
        `)
        .eq("id", orderId)
        .single()

      if (!order) { setLoading(false); return }

      const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops
      const items = (order.order_items ?? []) as { name: string; qty: number }[]

      let driver = null
      if (order.driver_id) {
        const { data: d } = await supabase
          .from("drivers").select("license_plate, rating_avg").eq("id", order.driver_id).single()
        const { data: p } = await supabase
          .from("profiles").select("full_name, phone").eq("id", order.driver_id).single()
        if (d) {
          driver = {
            name: p?.full_name ?? "Tài xế",
            phone: p?.phone ?? "",
            rating: Number(d.rating_avg ?? 5),
            plate: d.license_plate ?? "",
          }
        }
      }

      setOrderData({
        id: order.id,
        shopName: shop?.name ?? "Cửa hàng",
        shopEmoji: "🍽️",
        total: order.total_amount,
        items: items.map(i => ({ name: i.name, qty: i.qty, emoji: "🍽️" })),
        driver,
        address: order.delivery_address,
      })
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  if (loading) {
    return (
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",
        alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10 }}>
        <div style={{ width:32,height:32,borderRadius:"50%",
          border:"2px solid rgba(255,107,0,0.2)",borderTopColor:"#FF8C00",
          animation:"sucSpin .8s linear infinite" }} />
        <div style={{ color:"#6a5a40",fontSize:11 }}>Đang tải...</div>
        <style>{`@keyframes sucSpin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!orderData) {
    return (
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",
        alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12 }}>
        <span style={{ fontSize:48 }}>✅</span>
        <div style={{ color:"#f8f0e0",fontSize:18,fontWeight:700 }}>Đặt hàng thành công!</div>
        <div style={{ color:"#6a5a40",fontSize:11 }}>Đơn hàng đang được xử lý</div>
        <a href="/orders" style={{ marginTop:8,padding:"10px 24px",borderRadius:12,
          background:"linear-gradient(90deg,#FF6B00,#FF8C00)",color:"#fff",
          fontSize:12,fontWeight:700,textDecoration:"none" }}>
          📋 Xem đơn hàng
        </a>
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
        @keyframes sucShim{0%{left:-60%}100%{left:120%}}
        @keyframes sucGlow{0%,100%{box-shadow:0 0 16px rgba(255,107,0,0.4)}50%{box-shadow:0 0 36px rgba(255,107,0,0.7)}}
      `}</style>

      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>
        <Confetti />

        <div style={{ flex:1,overflowY:"auto",padding:"0 14px 100px",position:"relative",zIndex:1,
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* Hero */}
          <div style={{ textAlign:"center",padding:"52px 0 24px" }}>
            <motion.div initial={{ scale:0,rotate:-30 }} animate={{ scale:1,rotate:0 }}
              transition={{ type:"spring",damping:10,stiffness:150,delay:.15 }}
              style={{ display:"inline-flex",marginBottom:16 }}>
              <div style={{ width:88,height:88,borderRadius:24,
                background:"linear-gradient(135deg,rgba(255,107,0,0.15),rgba(255,179,71,0.1))",
                border:"1px solid rgba(255,107,0,0.35)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:42,
                animation:"sucGlow 2s ease-in-out infinite" }}>✅</div>
            </motion.div>
            <motion.div initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:.35 }}>
              <div style={{ color:"#f8f0e0",fontSize:22,fontWeight:800,marginBottom:6 }}>Đặt hàng thành công!</div>
              <div style={{ color:"#6a5a40",fontSize:11,marginBottom:12 }}>
                {orderData.shopEmoji} {orderData.shopName}
              </div>
              <div style={{ display:"inline-flex",alignItems:"center",gap:8,
                background:"rgba(255,107,0,0.08)",border:"1px solid rgba(255,107,0,0.25)",
                borderRadius:10,padding:"6px 16px" }}>
                <span style={{ color:"#6a5a40",fontSize: 11 }}>Mã đơn</span>
                <span style={{ color:"#FF8C00",fontSize:14,fontWeight:800,letterSpacing:1 }}>
                  #{orderData.id.slice(0,8).toUpperCase()}
                </span>
              </div>
            </motion.div>
          </div>

          {/* ETA */}
          <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }}
            transition={{ delay:.5 }} style={{ marginBottom:10 }}>
            <ETABar etaMin={20} />
          </motion.div>

          {/* Driver */}
          {orderData.driver && (
            <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }}
              transition={{ delay:.65 }}
              style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:13,padding:"12px 14px",marginBottom:10 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:44,height:44,borderRadius:12,flexShrink:0,
                  background:"rgba(255,107,0,0.1)",border:"1px solid rgba(255,107,0,0.2)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>🛵</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:"#6a5a40",fontSize: 11,marginBottom:2 }}>Tài xế của bạn</div>
                  <div style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>{orderData.driver.name}</div>
                  <div style={{ color:"#6a5a40",fontSize: 11,marginTop:1 }}>
                    ⭐ {orderData.driver.rating} · {orderData.driver.plate}
                  </div>
                </div>
                {orderData.driver.phone && (
                  <a href={`tel:${orderData.driver.phone}`}
                    style={{ width:40,height:40,borderRadius:11,
                      background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.25)",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      textDecoration:"none",fontSize:18,flexShrink:0 }}>📞</a>
                )}
              </div>
            </motion.div>
          )}

          {/* Địa chỉ */}
          <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }}
            transition={{ delay:.75 }}
            style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:13,padding:"11px 14px",marginBottom:10 }}>
            <div style={{ display:"flex",gap:9,alignItems:"flex-start" }}>
              <span style={{ fontSize:16,marginTop:1 }}>📍</span>
              <div>
                <div style={{ color:"#6a5a40",fontSize: 11,marginBottom:3 }}>Địa chỉ giao hàng</div>
                <div style={{ color:"#b0956a",fontSize:11 }}>{orderData.address}</div>
              </div>
            </div>
          </motion.div>

          {/* Chi tiết đơn */}
          <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }}
            transition={{ delay:.85 }}
            style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:13,marginBottom:12,overflow:"hidden" }}>
            <button onClick={() => setShowDetail(d => !d)}
              style={{ width:"100%",padding:"11px 14px",background:"none",border:"none",cursor:"pointer",
                display:"flex",alignItems:"center",gap:8,fontFamily:"Lexend" }}>
              <span style={{ fontSize:14 }}>🧾</span>
              <span style={{ color:"#f8f0e0",fontSize:11.5,fontWeight:700,flex:1,textAlign:"left" }}>Chi tiết đơn hàng</span>
              <span style={{ color:"#FF8C00",fontSize:13,transform:showDetail?"rotate(180deg)":"rotate(0)",
                transition:"transform .2s",display:"block" }}>▾</span>
            </button>
            <AnimatePresence>
              {showDetail && (
                <motion.div initial={{ height:0 }} animate={{ height:"auto" }}
                  exit={{ height:0 }} style={{ overflow:"hidden" }}>
                  <div style={{ padding:"0 14px 12px",borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                    {orderData.items.map((item, i) => (
                      <div key={i} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",
                        borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ color:"#b0956a",fontSize:10 }}>
                          {item.emoji} {item.name} ×{item.qty}
                        </span>
                      </div>
                    ))}
                    <div style={{ display:"flex",justifyContent:"space-between",paddingTop:10,marginTop:4,
                      borderTop:"1px solid rgba(255,255,255,0.07)" }}>
                      <span style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>Tổng cộng</span>
                      <span style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",
                        WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                        backgroundClip:"text",fontSize:14,fontWeight:800 }}>
                        {fmt(orderData.total)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Action buttons */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,
          background:"rgba(8,8,6,0.97)",backdropFilter:"blur(20px)",
          borderTop:"1px solid rgba(255,255,255,0.07)",
          padding:"12px 14px 28px",zIndex:10,display:"flex",gap:8 }}>
          <a href={`/tracking/${orderData.id}`} style={{ flex:2,textDecoration:"none" }}>
            <div style={{ height:50,borderRadius:13,
              background:"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              boxShadow:"0 4px 24px rgba(255,107,0,0.45)",position:"relative",overflow:"hidden",cursor:"pointer" }}>
              <div style={{ position:"absolute",top:0,left:"-60%",width:"35%",height:"100%",
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                animation:"sucShim 2.5s infinite" }} />
              <span style={{ fontSize:18,position:"relative",zIndex:1 }}>🗺️</span>
              <span style={{ color:"#fff",fontSize:13,fontWeight:800,position:"relative",zIndex:1 }}>Theo dõi đơn</span>
            </div>
          </a>
          <a href="/" style={{ flex:1,textDecoration:"none" }}>
            <div style={{ height:50,borderRadius:13,background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.1)",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,cursor:"pointer" }}>
              <span style={{ fontSize:20 }}>🏠</span>
              <span style={{ color:"#6a5a40",fontSize: 11 }}>Trang chủ</span>
            </div>
          </a>
        </div>
      </div>
    </>
  )
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",
        alignItems:"center",justifyContent:"center" }}>
        <div style={{ color:"#6a5a40",fontSize:12 }}>Đang tải...</div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  )
}
