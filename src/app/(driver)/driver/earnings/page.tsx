"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

const DAY_LABELS = ["CN","T2","T3","T4","T5","T6","T7"]

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

const TYPE_ICON: Record<string, string> = { food:"🍜", errand:"🛍️", ride:"🛵" }
const TYPE_COLOR: Record<string, string> = { food:"255,140,0", errand:"62,207,110", ride:"74,143,245" }

interface WeekDay { day: string; amount: number; trips: number }
interface Trip { id: string; from: string; to: string; time: string; amount: number; type: string }

export default function DriverEarningsPage() {
  const supabase = createClient()
  const [period, setPeriod] = useState<"today"|"week"|"month">("today")
  const [weekly, setWeekly] = useState<WeekDay[]>(
    DAY_LABELS.map(d => ({ day: d, amount: 0, trips: 0 }))
  )
  const [trips, setTrips] = useState<Trip[]>([])
  const [earnings, setEarnings] = useState({ today: 0, week: 0, month: 0 })
  const [tripCount, setTripCount] = useState({ today: 0, week: 0, month: 0 })
  const [driverRating, setDriverRating] = useState<number | null>(null)
  const [completionRate, setCompletionRate] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const now = new Date()
      const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0)
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 6); startOfWeek.setHours(0,0,0,0)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Driver rating and completion rate
      const { data: driverRow } = await supabase
        .from("drivers")
        .select("rating_avg, total_trips")
        .eq("id", user.id)
        .single()
      if (driverRow) setDriverRating(Number(driverRow.rating_avg ?? 5))

      // All month orders (delivered + cancelled) to compute completion rate
      const { data: allMonthOrders } = await supabase
        .from("orders")
        .select("id, status")
        .eq("driver_id", user.id)
        .gte("created_at", startOfMonth.toISOString())
      if (allMonthOrders && allMonthOrders.length > 0) {
        const delivered = allMonthOrders.filter(o => o.status === "delivered").length
        setCompletionRate(Math.round((delivered / allMonthOrders.length) * 100))
      }

      // Loc va sap xep theo delivered_at (luc giao xong), khong phai created_at
      // (luc khach dat) - don dat thang truoc nhung giao thang nay van phai
      // tinh vao thu nhap thang nay, va nguoc lai.
      const { data: orders } = await supabase
        .from("orders")
        .select("id, ship_fee, status, delivery_address, delivered_at, shop_id, shops!inner(commission_rate)")
        .eq("driver_id", user.id)
        .eq("status", "delivered")
        .gte("delivered_at", startOfMonth.toISOString())
        .order("delivered_at", { ascending: false })

      if (!orders) return

      type OrderRow = typeof orders[number]
      const netFee = (o: OrderRow) => {
        const fee = o.ship_fee ?? 0
        const shops = o.shops as { commission_rate?: number } | { commission_rate?: number }[] | null
        const shop = Array.isArray(shops) ? shops[0] : shops
        const commRate = Number(shop?.commission_rate ?? 15)
        return Math.round(fee * (1 - commRate / 100))
      }

      const todayRevenue = orders.filter(o => o.delivered_at && new Date(o.delivered_at) >= startOfDay).reduce((s, o) => s + netFee(o), 0)
      const weekRevenue  = orders.filter(o => o.delivered_at && new Date(o.delivered_at) >= startOfWeek).reduce((s, o) => s + netFee(o), 0)
      const monthRevenue = orders.reduce((s, o) => s + netFee(o), 0)
      const todayTrips   = orders.filter(o => o.delivered_at && new Date(o.delivered_at) >= startOfDay).length
      const weekTrips    = orders.filter(o => o.delivered_at && new Date(o.delivered_at) >= startOfWeek).length

      setEarnings({ today: todayRevenue, week: weekRevenue, month: monthRevenue })
      setTripCount({ today: todayTrips, week: weekTrips, month: orders.length })

      // Build weekly chart (last 7 days)
      const weekMap: Record<string, WeekDay> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(now.getDate() - i)
        const label = DAY_LABELS[d.getDay()]
        const key = d.toDateString()
        weekMap[key] = { day: label, amount: 0, trips: 0 }
      }
      for (const o of orders) {
        if (!o.delivered_at) continue
        const key = new Date(o.delivered_at).toDateString()
        if (weekMap[key]) {
          weekMap[key].amount += netFee(o)
          weekMap[key].trips++
        }
      }
      setWeekly(Object.values(weekMap))

      // Recent trips
      setTrips(orders.slice(0, 10).map(o => ({
        id: o.id.slice(0, 6).toUpperCase(),
        from: "Cửa hàng",
        to: o.delivery_address ?? "—",
        time: o.delivered_at ? new Date(o.delivered_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—",
        amount: netFee(o),
        type: "food",
      })))
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const maxAmt = Math.max(...weekly.map(d => d.amount), 1)

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
      `}</style>
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"calc(env(safe-area-inset-top) + 16px) 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
            <a href="/driver" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Thu nhập</div>
              <div style={{ color:"#6a5a40",fontSize:9 }}>Thống kê & lịch sử chuyến</div>
            </div>
          </div>
          <div style={{ display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:10,padding:2,gap:2 }}>
            {(["today","week","month"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ flex:1,height:32,borderRadius:8,background:period===p?"rgba(255,107,0,0.15)":"transparent",border:period===p?"1px solid rgba(255,107,0,0.3)":"1px solid transparent",cursor:"pointer",color:period===p?"#FF8C00":"#6a5a40",fontSize:10,fontWeight:period===p?700:500,fontFamily:"Lexend",transition:"all .2s" }}>
                {p==="today"?"Hôm nay":p==="week"?"Tuần này":"Tháng này"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px",paddingBottom:"calc(20px + env(safe-area-inset-bottom))" }}>

          {/* Big number */}
          <div style={{ textAlign:"center",padding:"24px 0",background:"rgba(255,107,0,0.05)",border:"1px solid rgba(255,107,0,0.15)",borderRadius:16,marginBottom:12 }}>
            <div style={{ color:"#6a5a40",fontSize:9,marginBottom:6 }}>
              {period==="today"?"Thu nhập hôm nay":period==="week"?"Thu nhập tuần này":"Thu nhập tháng này"}
            </div>
            <div style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontSize:32,fontWeight:800,marginBottom:12 }}>
              {fmt(earnings[period] ?? 0)}
            </div>
            <div style={{ display:"flex",justifyContent:"center",gap:20 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>{tripCount[period]}</div>
                <div style={{ color:"#6a5a40",fontSize:8 }}>Chuyến</div>
              </div>
              <div style={{ width:1,background:"rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>⭐ {driverRating?.toFixed(1) ?? "—"}</div>
                <div style={{ color:"#6a5a40",fontSize:8 }}>Đánh giá TB</div>
              </div>
              <div style={{ width:1,background:"rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>{completionRate !== null ? `${completionRate}%` : "—"}</div>
                <div style={{ color:"#6a5a40",fontSize:8 }}>Hoàn thành</div>
              </div>
            </div>
          </div>

          {/* Bar chart */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:12 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:14 }}>📊 Thu nhập theo ngày (tuần này)</div>
            <div style={{ display:"flex",gap:5,alignItems:"flex-end",height:80 }}>
              {weekly.map((d, i) => {
                const h = Math.max(4, Math.round((d.amount / maxAmt) * 72))
                const isToday = i === weekly.length - 1
                return (
                  <div key={i} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                    <div style={{ width:"100%",height:h,borderRadius:"4px 4px 0 0",background:isToday?"linear-gradient(180deg,#FF6B00,#FF8C00)":"rgba(255,107,0,0.2)",transition:"height .3s" }} />
                    <div style={{ color:isToday?"#FF8C00":"#6a5a40",fontSize:8,fontWeight:isToday?700:400 }}>{d.day}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color:"#6a5a40",fontSize:8 }}>Thấp: {fmt(Math.min(...weekly.map(d=>d.amount), 0))}</span>
              <span style={{ color:"#FF8C00",fontSize:8,fontWeight:700 }}>Cao: {fmt(maxAmt)}</span>
            </div>
          </div>

          {/* Trip list */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,overflow:"hidden" }}>
            <div style={{ padding:"14px 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700 }}>🧾 Chuyến gần đây</div>
            </div>
            {trips.length === 0
              ? <div style={{ padding:"24px 14px",textAlign:"center",color:"#6a5a40",fontSize:11 }}>Chưa có chuyến nào</div>
              : trips.map((trip, i) => (
              <div key={trip.id} style={{ padding:"10px 14px",borderBottom:i<trips.length-1?"1px solid rgba(255,255,255,0.04)":"none",display:"flex",gap:10,alignItems:"center" }}>
                <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,background:`rgba(${TYPE_COLOR[trip.type] ?? "255,140,0"},0.1)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>
                  {TYPE_ICON[trip.type] ?? "🛵"}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ color:"#f8f0e0",fontSize:10.5,fontWeight:600,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{trip.from}</div>
                  <div style={{ color:"#6a5a40",fontSize:9 }}>→ {trip.to} · {trip.time}</div>
                </div>
                <div style={{ color:"#3ecf6e",fontSize:12,fontWeight:700,flexShrink:0 }}>+{fmt(trip.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
