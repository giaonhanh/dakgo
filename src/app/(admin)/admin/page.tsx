"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

interface DashOrder {
  id: string
  status: string
  total_amount: number
  shopName: string
  customerName: string
  created_at: string
}

interface Kpi {
  todayRevenue: number
  todayOrders: number
  driversOnline: number
  openShops: number
  monthRevenue: number
  pendingDrivers: number
  pendingShops: number
  blacklistCount: number
  cancelledToday: number
  deliveredToday: number
}

function getLast7Days() {
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
  const result: { day: string; today: boolean }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    result.push({ day: days[d.getDay()], today: i === 0 })
  }
  return result
}

const CHART_BARS = getLast7Days()

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  delivering: { label: "Đang giao",    color: "#FF8C00", bg: "rgba(255,140,0,0.12)",  border: "rgba(255,107,0,0.3)"   },
  delivered:  { label: "Hoàn thành",   color: "#3ecf6e", bg: "rgba(62,207,110,0.10)", border: "rgba(62,207,110,0.25)" },
  cancelled:  { label: "Đã hủy",       color: "#ff4040", bg: "rgba(255,64,64,0.10)",  border: "rgba(255,64,64,0.25)"  },
  pending:    { label: "Chờ xác nhận", color: "#4a8ff5", bg: "rgba(74,143,245,0.10)", border: "rgba(74,143,245,0.25)" },
  accepted:   { label: "Đã nhận",      color: "#FFB347", bg: "rgba(255,179,71,0.10)", border: "rgba(255,179,71,0.25)" },
  preparing:  { label: "Đang nấu",     color: "#4a8ff5", bg: "rgba(74,143,245,0.10)", border: "rgba(74,143,245,0.25)" },
  ready:      { label: "Sẵn sàng",     color: "#3ecf6e", bg: "rgba(62,207,110,0.10)", border: "rgba(62,207,110,0.25)" },
}


const fmtShort = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1000 ? (n / 1000).toFixed(0) + "k" : n.toString()

const timeAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return "vừa xong"
  if (diff < 60) return `${diff} phút trước`
  return `${Math.floor(diff / 60)} giờ trước`
}


export default function AdminDashboard() {
  const [orders, setOrders] = useState<DashOrder[]>([])
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [kpi, setKpi] = useState<Kpi>({
    todayRevenue: 0, todayOrders: 0, driversOnline: 0, openShops: 0,
    monthRevenue: 0, pendingDrivers: 0, pendingShops: 0, blacklistCount: 0,
    cancelledToday: 0, deliveredToday: 0,
  })
  const [weeklyRevData, setWeeklyRevData]   = useState<number[]>([0,0,0,0,0,0,0])
  const [hourlyOrders, setHourlyOrders]     = useState<{h:string;v:number}[]>([])
  const [topShops, setTopShops]             = useState<{name:string;orders:number;revenue:number;rating:number}[]>([])
  const [activityItems, setActivityItems]   = useState<{icon:string;text:string;time:string;color:string}[]>([])

  const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

      const [
        { data: rawOrders },
        { data: todayRows },
        { data: monthRows },
        { data: driverRows },
        { data: shopRows },
        { data: pendDrv },
        { data: pendShop },
        { data: blackRows },
      ] = await Promise.all([
        supabase.from("orders")
          .select("id, status, total_amount, customer_id, created_at, shops!shop_id(name)")
          .order("created_at", { ascending: false }).limit(8),
        supabase.from("orders").select("total_amount, status").gte("created_at", today.toISOString()),
        supabase.from("orders").select("total_amount, status").gte("created_at", firstOfMonth.toISOString()),
        supabase.from("drivers").select("id").eq("status", "online"),
        supabase.from("shops").select("id").eq("is_open", true).eq("status", "approved"),
        supabase.from("drivers").select("id").eq("is_approved", false),
        supabase.from("shops").select("id").eq("status", "pending"),
        supabase.from("blacklist").select("id"),
      ])

      const todayRevenue = (todayRows ?? []).filter(o => o.status !== "cancelled").reduce((s, o) => s + (o.total_amount ?? 0), 0)
      const monthRevenue = (monthRows ?? []).filter(o => o.status !== "cancelled").reduce((s, o) => s + (o.total_amount ?? 0), 0)
      const cancelledToday = (todayRows ?? []).filter(o => o.status === "cancelled").length
      const deliveredToday = (todayRows ?? []).filter(o => o.status === "delivered").length

      setKpi({
        todayRevenue, todayOrders: (todayRows ?? []).length,
        driversOnline: driverRows?.length ?? 0,
        openShops: shopRows?.length ?? 0,
        monthRevenue,
        pendingDrivers: pendDrv?.length ?? 0,
        pendingShops: pendShop?.length ?? 0,
        blacklistCount: blackRows?.length ?? 0,
        cancelledToday, deliveredToday,
      })

      if (rawOrders && rawOrders.length > 0) {
        const custIds = rawOrders.map(o => o.customer_id).filter(Boolean)
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", custIds)
        const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name ?? "Khách hàng"]))
        setOrders(rawOrders.map(o => {
          const shops = o.shops as unknown
          const shopName = Array.isArray(shops) ? (shops[0] as { name: string })?.name ?? "—" : (shops as { name: string } | null)?.name ?? "—"
          return { id: o.id, status: o.status, total_amount: o.total_amount, shopName, customerName: profileMap[o.customer_id] ?? "Khách hàng", created_at: o.created_at }
        }))
      }
      // Weekly revenue (last 7 days)
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); sevenDaysAgo.setHours(0,0,0,0)
      const { data: weekOrders } = await supabase.from("orders")
        .select("created_at, total_amount")
        .gte("created_at", sevenDaysAgo.toISOString())
        .neq("status", "cancelled")
      const last7 = Array.from({length:7}, (_,i) => { const d = new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().split("T")[0] })
      const dayRevMap: Record<string,number> = {}
      last7.forEach(d => { dayRevMap[d] = 0 })
      ;(weekOrders ?? []).forEach(o => { const day = o.created_at.split("T")[0]; if (day in dayRevMap) dayRevMap[day] += o.total_amount ?? 0 })
      setWeeklyRevData(last7.map(d => dayRevMap[d]))

      // Hourly order count (today, hours 6-17)
      const { data: hourOrders } = await supabase.from("orders")
        .select("created_at").gte("created_at", today.toISOString())
      const hourMap: Record<number,number> = {}
      for (let h = 6; h <= 17; h++) hourMap[h] = 0
      ;(hourOrders ?? []).forEach(o => { const h = new Date(o.created_at).getHours(); if (h in hourMap) hourMap[h]++ })
      const maxH = Math.max(...Object.values(hourMap), 1)
      setHourlyOrders(Array.from({length:12},(_,i)=>i+6).map(h => ({ h:`${h}h`, v: Math.round((hourMap[h]/maxH)*100) })))

      // Top shops today
      const { data: shopOrders } = await supabase.from("orders")
        .select("shop_id, total_amount, shops!shop_id(name, rating_avg)")
        .gte("created_at", today.toISOString())
        .neq("status", "cancelled")
      const shopAgg: Record<string,{name:string;orders:number;revenue:number;rating:number}> = {}
      ;(shopOrders ?? []).forEach(o => {
        const s = Array.isArray(o.shops) ? o.shops[0] : o.shops as {name:string;rating_avg:number}|null
        if (!s || !o.shop_id) return
        if (!shopAgg[o.shop_id]) shopAgg[o.shop_id] = {name:s.name,orders:0,revenue:0,rating:s.rating_avg??5}
        shopAgg[o.shop_id].orders++; shopAgg[o.shop_id].revenue += o.total_amount??0
      })
      setTopShops(Object.values(shopAgg).sort((a,b)=>b.orders-a.orders).slice(0,4))

      // Activity: recent cancelled orders + recent pending drivers/shops
      const { data: cancelOrders } = await supabase.from("orders")
        .select("id, status, created_at, shops!shop_id(name)")
        .in("status", ["cancelled","delivered"])
        .order("created_at", { ascending: false }).limit(4)
      const acts: {icon:string;text:string;time:string;color:string}[] = []
      ;(cancelOrders ?? []).forEach(o => {
        const sn = Array.isArray(o.shops)?(o.shops[0] as {name:string})?.name:(o.shops as {name:string}|null)?.name ?? "—"
        if (o.status === "cancelled") acts.push({ icon:"⚠️", text:`Đơn #${o.id.slice(0,5).toUpperCase()} bị hủy · ${sn}`, time:timeAgo(o.created_at), color:"#ff4040" })
        else acts.push({ icon:"✅", text:`Đơn #${o.id.slice(0,5).toUpperCase()} giao thành công · ${sn}`, time:timeAgo(o.created_at), color:"#3ecf6e" })
      })
      if (pendShop && pendShop.length > 0) acts.push({ icon:"🏪", text:`${pendShop.length} cửa hàng đang chờ duyệt`, time:"", color:"#FF8C00" })
      if (pendDrv  && pendDrv.length  > 0) acts.push({ icon:"🏍️", text:`${pendDrv.length} tài xế đang chờ duyệt`, time:"", color:"#4a8ff5" })
      setActivityItems(acts.slice(0,6))

      setLastRefresh(new Date())
    }
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [])

  const successRate = kpi.todayOrders > 0 ? Math.round((kpi.deliveredToday / kpi.todayOrders) * 100) : 0

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #06050a; font-family: 'Lexend', sans-serif; height: 100%; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,107,0,0.3); border-radius: 2px; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        @keyframes shimmer  { 0% { left:-60%; } 100% { left:120%; } }
        @keyframes spin     { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        .kpi-card { animation: fadeUp 0.4s ease both; transition: all 0.2s; }
        .kpi-card:hover { transform: translateY(-2px) scale(1.01); }
        .order-row:hover { background: rgba(255,255,255,0.04) !important; }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; color: #FF8C00 !important; }
        .quick-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
        a { text-decoration: none; }
      `}</style>

      <AdminShell
        pageTitle="🏠 Tổng quan hệ thống"
        pageSubtitle="DakGo · Krông Pắc · Tự động làm mới mỗi 30s"
        actions={
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ padding:"5px 12px", borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", color:"#6a5a40", fontSize:9 }}>
              📍 Krông Pắc · {new Date().toLocaleDateString("vi-VN", { weekday:"short", day:"2-digit", month:"2-digit" })}
            </div>
            <div style={{ position:"relative", cursor:"pointer" }}>
              <div style={{ width:34, height:34, borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🔔</div>
              {(kpi.pendingDrivers + kpi.pendingShops) > 0 && (
                <div style={{ position:"absolute", top:-3, right:-3, minWidth:14, height:14, borderRadius:7, background:"#ff4040", border:"2px solid #06050a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, fontWeight:800, color:"#fff", padding:"0 2px" }}>
                  {kpi.pendingDrivers + kpi.pendingShops}
                </div>
              )}
            </div>
            <a href="/admin/settings">
              <div style={{ width:34, height:34, borderRadius:10, background:"rgba(180,100,255,0.12)", border:"1px solid rgba(180,100,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, cursor:"pointer" }}>👤</div>
            </a>
          </div>
        }
      >
        <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:14, height:"100%" }}>

            {/* KPI Grid — 4 cols top, 4 cols bottom */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
              {[
                { icon:"💰", label:"Doanh thu hôm nay",   value: fmtShort(kpi.todayRevenue) + "đ", sub:`Tháng: ${fmtShort(kpi.monthRevenue)}đ`,      c:"#FF8C00", bg:"rgba(255,107,0,0.07)",   bd:"rgba(255,107,0,0.2)",   delay:"0s"    },
                { icon:"📦", label:"Đơn hàng hôm nay",    value: kpi.todayOrders.toString(),        sub:`✅ ${kpi.deliveredToday} · ❌ ${kpi.cancelledToday}`, c:"#3ecf6e", bg:"rgba(62,207,110,0.06)",  bd:"rgba(62,207,110,0.18)", delay:"0.05s" },
                { icon:"🏍️",label:"Tài xế online",        value: kpi.driversOnline.toString(),      sub:"Đang trực tuyến",                              c:"#4a8ff5", bg:"rgba(74,143,245,0.07)",  bd:"rgba(74,143,245,0.2)",  delay:"0.1s"  },
                { icon:"🏪", label:"Quán đang mở",         value: kpi.openShops.toString(),          sub:"Đang hoạt động",                               c:"#FFB347", bg:"rgba(255,179,71,0.07)",  bd:"rgba(255,179,71,0.2)",  delay:"0.15s" },
                { icon:"⚠️", label:"Tài xế chờ duyệt",    value: kpi.pendingDrivers.toString(),     sub:"Cần xem xét",                                 c:"#ff4040", bg:"rgba(255,64,64,0.07)",   bd:"rgba(255,64,64,0.2)",   delay:"0.2s"  },
                { icon:"🏪", label:"Quán chờ duyệt",       value: kpi.pendingShops.toString(),       sub:"Cần xem xét",                                 c:"#f5c542", bg:"rgba(245,197,66,0.07)",  bd:"rgba(245,197,66,0.2)",  delay:"0.25s" },
                { icon:"📈", label:"Tỉ lệ thành công",     value: successRate + "%",                  sub:"Đơn hoàn thành hôm nay",                       c:"#3ecf6e", bg:"rgba(62,207,110,0.06)",  bd:"rgba(62,207,110,0.18)", delay:"0.3s"  },
                { icon:"🚫", label:"Tài khoản bị khóa",    value: kpi.blacklistCount.toString(),     sub:"Blacklist",                                    c:"#ff4040", bg:"rgba(255,64,64,0.07)",   bd:"rgba(255,64,64,0.2)",   delay:"0.35s" },
              ].map((k, i) => (
                <div key={i} className="kpi-card" style={{ background:k.bg, border:`1px solid ${k.bd}`, borderRadius:14, padding:"13px 14px", animationDelay:k.delay, cursor:"default", position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%", background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)", animation:"shimmer 3s infinite", pointerEvents:"none" }} />
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ width:30, height:30, borderRadius:9, background:k.bg, border:`1px solid ${k.bd}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>{k.icon}</div>
                    <span style={{ fontSize:8, fontWeight:700, padding:"2px 6px", background:k.bg, border:`1px solid ${k.bd}`, borderRadius:4, color:k.c }}>↑ live</span>
                  </div>
                  <div style={{ color:k.c, fontSize:24, fontWeight:800, lineHeight:1, marginBottom:3 }}>{k.value}</div>
                  <div style={{ color:"rgba(240,234,255,0.7)", fontSize:10, fontWeight:500, marginBottom:2 }}>{k.label}</div>
                  <div style={{ color:"#6a5a40", fontSize:9 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:12 }}>
              {/* Revenue line chart */}
              <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div>
                    <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>📈 Doanh thu 7 ngày</div>
                    <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>Tổng doanh thu từng ngày trong tuần</div>
                  </div>
                  <div style={{ color:"#FF8C00", fontSize:9, fontWeight:600, background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.25)", borderRadius:6, padding:"3px 9px" }}>7 ngày ▾</div>
                </div>
                {/* SVG chart */}
                <div style={{ position:"relative", height:90, marginBottom:8 }}>
                  {[25, 50, 75].map(p => <div key={p} style={{ position:"absolute", left:0, right:0, top:`${100-p}%`, height:1, background:"rgba(255,255,255,0.04)" }} />)}
                  <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%" }} viewBox="0 0 420 90" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF8C00" stopOpacity="0.35"/>
                        <stop offset="100%" stopColor="#FF8C00" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    {(() => {
                      const maxRev = Math.max(...weeklyRevData, 1)
                      const pts = weeklyRevData.map((v, i) => `${(i / 6) * 420},${90 - (v / maxRev) * 80}`)
                      const path = "M" + pts.join(" L")
                      return (
                        <>
                          <path d={path} stroke="#FF8C00" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d={path + ` L420,90 L0,90 Z`} fill="url(#revGrad)"/>
                          {weeklyRevData.map((v, i) => (
                            <circle key={i} cx={(i/6)*420} cy={90-(v/maxRev)*80} r={i===6?5:3} fill={i===6?"#FF6B00":"rgba(255,140,0,0.5)"} stroke={i===6?"rgba(255,107,0,0.3)":""} strokeWidth={i===6?4:0}/>
                          ))}
                        </>
                      )
                    })()}
                  </svg>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  {CHART_BARS.map((b, i) => (
                    <div key={b.day} style={{ textAlign:"center" }}>
                      <div style={{ fontSize:8, color: b.today ? "#FF8C00" : "#6a5a40", fontWeight: b.today ? 700 : 400 }}>{b.day}</div>
                      <div style={{ fontSize:7, color: b.today ? "#FF8C00" : "#6a5a40", marginTop:1, opacity:0.7 }}>{fmtShort(weeklyRevData[i] ?? 0)}đ</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hourly orders bar chart */}
              <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div>
                    <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>📊 Đơn theo giờ</div>
                    <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>Hôm nay</div>
                  </div>
                  <div style={{ color:"#b464ff", fontSize:9, fontWeight:600, background:"rgba(180,100,255,0.1)", border:"1px solid rgba(180,100,255,0.25)", borderRadius:6, padding:"3px 9px" }}>Hôm nay ▾</div>
                </div>
                <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:80, marginBottom:8 }}>
                  {hourlyOrders.length === 0
                    ? <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#6a5a40", fontSize:9 }}>Chưa có đơn hôm nay</div>
                    : hourlyOrders.map((b, i) => {
                        const isPeak = b.v >= 80
                        return (
                          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", height:"100%" }}>
                            <div style={{ flex:1, display:"flex", alignItems:"flex-end", width:"100%" }}>
                              <div style={{ width:"100%", height:`${Math.max(b.v, 4)}%`, borderRadius:"3px 3px 0 0", background: isPeak ? "linear-gradient(180deg,#b464ff,rgba(180,100,255,0.3))" : "rgba(180,100,255,0.2)", boxShadow: isPeak ? "0 0 8px rgba(180,100,255,0.5)" : "none", transition:"all 0.2s" }} />
                            </div>
                          </div>
                        )
                      })
                  }
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  {hourlyOrders.map((b, i) => (
                    <div key={i} style={{ flex:1, textAlign:"center", fontSize:7, color: b.v>=80 ? "#b464ff" : "#6a5a40" }}>{b.h}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Orders + Activity + Top Shops */}
            <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 1fr", gap:12 }}>

              {/* Recent Orders */}
              <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>🔔 Đơn hàng gần đây</div>
                  <a href="/admin/orders" style={{ color:"#FF8C00", fontSize:9, fontWeight:600 }}>Xem tất cả →</a>
                </div>
                {/* Header */}
                <div style={{ display:"grid", gridTemplateColumns:"54px 1fr 70px 55px", gap:6, padding:"5px 6px", borderBottom:"1px solid rgba(255,255,255,0.06)", marginBottom:4 }}>
                  {["Mã đơn","Khách / Quán","Tiền","TT"].map(h => (
                    <div key={h} style={{ color:"#6a5a40", fontSize:8, textTransform:"uppercase", letterSpacing:0.5 }}>{h}</div>
                  ))}
                </div>
                {orders.length === 0 ? (
                  <div style={{ padding:"24px 0", textAlign:"center", color:"#6a5a40", fontSize:11 }}>Chưa có đơn hàng</div>
                ) : orders.map(o => {
                  const s = STATUS_MAP[o.status] ?? STATUS_MAP["pending"]
                  return (
                    <a key={o.id} href="/admin/orders">
                      <div className="order-row" style={{ display:"grid", gridTemplateColumns:"54px 1fr 70px 55px", gap:6, padding:"7px 6px", borderBottom:"1px solid rgba(255,255,255,0.03)", borderRadius:8, cursor:"pointer", transition:"background 0.15s" }}>
                        <div style={{ color:"#b464ff", fontSize:9, fontWeight:700 }}>#{o.id.slice(0,5).toUpperCase()}</div>
                        <div>
                          <div style={{ color:"#f0eaff", fontSize:9, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{o.customerName}</div>
                          <div style={{ color:"#6a5a40", fontSize:8, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{o.shopName}</div>
                        </div>
                        <div style={{ color:"#FF8C00", fontSize:9, fontWeight:700 }}>{fmt(o.total_amount)}</div>
                        <div><span style={{ fontSize:7, fontWeight:700, padding:"2px 5px", borderRadius:4, border:`1px solid ${s.border}`, background:s.bg, color:s.color, whiteSpace:"nowrap" }}>{s.label}</span></div>
                      </div>
                    </a>
                  )
                })}
              </div>

              {/* Activity Log */}
              <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700, marginBottom:12 }}>⚡ Hoạt động gần đây</div>
                <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                  {activityItems.length === 0
                    ? <div style={{ color:"#6a5a40", fontSize:10, textAlign:"center", padding:"16px 0" }}>Chưa có hoạt động</div>
                    : activityItems.map((a, i) => (
                    <div key={i} style={{ display:"flex", gap:10, padding:"9px 0", borderBottom: i < activityItems.length-1 ? "1px solid rgba(255,255,255,0.04)" : "none", alignItems:"flex-start" }}>
                      <div style={{ width:26, height:26, borderRadius:8, background:`rgba(${a.color === "#3ecf6e" ? "62,207,110" : a.color === "#ff4040" ? "255,64,64" : a.color === "#FF8C00" ? "255,107,0" : a.color === "#4a8ff5" ? "74,143,245" : "245,197,66"},0.1)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>{a.icon}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:"#f0eaff", fontSize:9.5, fontWeight:500, lineHeight:1.4 }}>{a.text}</div>
                        <div style={{ color:"#6a5a40", fontSize:8, marginTop:2 }}>{a.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Shops */}
              <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>🏆 Top cửa hàng</div>
                  <div style={{ color:"#6a5a40", fontSize:8 }}>Hôm nay</div>
                </div>
                {topShops.length === 0
                  ? <div style={{ color:"#6a5a40", fontSize:10, textAlign:"center", padding:"16px 0" }}>Chưa có đơn hôm nay</div>
                  : topShops.map((shop, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom: i < topShops.length-1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <div style={{ width:22, height:22, borderRadius:7, background: i===0?"rgba(245,197,66,0.15)": i===1?"rgba(180,180,180,0.1)": i===2?"rgba(180,100,0,0.1)":"rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, flexShrink:0, fontWeight:800, color: i===0?"#f5c542":i===1?"#aaa":i===2?"#cd7f32":"#6a5a40" }}>
                      {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:"#f0eaff", fontSize:10, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{shop.name}</div>
                      <div style={{ color:"#6a5a40", fontSize:8 }}>{shop.orders} đơn · ⭐ {shop.rating.toFixed(1)}</div>
                    </div>
                    <div style={{ color:"#FF8C00", fontSize:9, fontWeight:700, flexShrink:0 }}>{fmtShort(shop.revenue)}đ</div>
                  </div>
                ))}

                {/* Mini progress bars */}
                <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color:"#6a5a40", fontSize:8, marginBottom:8 }}>Phân bố trạng thái đơn hôm nay</div>
                  {[
                    { label:"Hoàn thành", pct: successRate, color:"#3ecf6e" },
                    { label:"Đang giao",  pct: kpi.todayOrders > 0 ? Math.round(((kpi.todayOrders - kpi.deliveredToday - kpi.cancelledToday) / kpi.todayOrders) * 100) : 0, color:"#FF8C00" },
                    { label:"Đã hủy",    pct: kpi.todayOrders > 0 ? Math.round((kpi.cancelledToday / kpi.todayOrders) * 100) : 0, color:"#ff4040" },
                  ].map(row => (
                    <div key={row.label} style={{ marginBottom:6 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ color:"#6a5a40", fontSize:8 }}>{row.label}</span>
                        <span style={{ color:row.color, fontSize:8, fontWeight:700 }}>{row.pct}%</span>
                      </div>
                      <div style={{ height:4, borderRadius:2, background:"rgba(255,255,255,0.06)" }}>
                        <div style={{ height:"100%", width:`${row.pct}%`, borderRadius:2, background:row.color, boxShadow:`0 0 6px ${row.color}` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"13px 16px" }}>
              <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700, marginBottom:10 }}>⚡ Thao tác nhanh</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[
                  { label:"✅ Phê duyệt",          href:"/admin/approvals",     c:"#3ecf6e", bg:"rgba(62,207,110,0.08)",   bd:"rgba(62,207,110,0.22)",   badge: kpi.pendingDrivers + kpi.pendingShops },
                  { label:"📦 Quản lý đơn",        href:"/admin/orders",        c:"#4a8ff5", bg:"rgba(74,143,245,0.08)",   bd:"rgba(74,143,245,0.22)",   badge: 0 },
                  { label:"⚖️ Tranh chấp",          href:"/admin/disputes",      c:"#ff4040", bg:"rgba(255,64,64,0.08)",    bd:"rgba(255,64,64,0.22)",    badge: 0 },
                  { label:"📣 Gửi thông báo",       href:"/admin/notifications", c:"#b464ff", bg:"rgba(180,100,255,0.08)",  bd:"rgba(180,100,255,0.22)",  badge: 0 },
                  { label:"💰 Tài chính",           href:"/admin/finance",       c:"#f5c542", bg:"rgba(245,197,66,0.08)",   bd:"rgba(245,197,66,0.22)",   badge: 0 },
                  { label:"🏷️ Khuyến mãi",          href:"/admin/promotions",    c:"#FF8C00", bg:"rgba(255,107,0,0.08)",    bd:"rgba(255,107,0,0.22)",    badge: 0 },
                  { label:"⚙️ Cài đặt hệ thống",   href:"/admin/settings",      c:"#6a5a40", bg:"rgba(255,255,255,0.04)", bd:"rgba(255,255,255,0.08)",  badge: 0 },
                ].map((a, i) => (
                  <a key={i} href={a.href} className="quick-btn" style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:10, background:a.bg, border:`1px solid ${a.bd}`, color:a.c, fontSize:11, fontWeight:600, cursor:"pointer", transition:"all 0.2s", textDecoration:"none" }}>
                    {a.label}
                    {a.badge > 0 && (
                      <span style={{ background:"#ff4040", color:"#fff", borderRadius:"50%", width:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:800 }}>{a.badge}</span>
                    )}
                  </a>
                ))}
              </div>
            </div>

            {/* System Health Footer */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"11px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                <div style={{ color:"#f0eaff", fontSize:11, fontWeight:700 }}>🔧 Trạng thái dịch vụ</div>
                {[
                  { name:"Supabase DB",  ok:true  },
                  { name:"Auth",         ok:true  },
                  { name:"Realtime",     ok:true  },
                  { name:"Firebase FCM", ok:true  },
                  { name:"ESMS OTP",     ok:true  },
                  { name:"Vercel Edge",  ok:true  },
                ].map(s => (
                  <div key={s.name} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background: s.ok ? "#3ecf6e" : "#ff4040", boxShadow: s.ok ? "0 0 5px #3ecf6e" : "0 0 5px #ff4040" }} />
                    <span style={{ color: s.ok ? "#3ecf6e" : "#ff4040", fontSize:9, fontWeight:600 }}>{s.name}</span>
                  </div>
                ))}
                <div style={{ color:"#6a5a40", fontSize:8 }}>Tự động làm mới mỗi 30s · {lastRefresh.toLocaleTimeString("vi-VN")}</div>
              </div>
            </div>

        </div>
      </AdminShell>
    </>
  )
}
