"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

const fmt  = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtS = (n: number) => n >= 1_000_000 ? (n/1_000_000).toFixed(1)+"M" : n >= 1000 ? (n/1000).toFixed(0)+"k" : n.toString()

function getLast7Labels() {
  const days = ["CN","T2","T3","T4","T5","T6","T7"]
  return Array.from({length:7},(_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i))
    return { label: days[d.getDay()], iso: d.toISOString().split("T")[0] }
  })
}

interface WeeklyRow  { day: string; rev: number; driverComm: number; shopComm: number }
interface DriverComm { id: string; name: string; trips: number; shipTotal: number; commission: number }
interface ShopComm   { id: string; name: string; orders: number; subtotal: number; commission: number; rate: number }

export default function AdminFinancePage() {
  const supabase = createClient()
  const [period, setPeriod] = useState<"day"|"week"|"month">("week")
  const [loading, setLoading] = useState(true)

  const [totalRevenue,     setTotalRevenue]     = useState(0)
  const [totalDriverComm,  setTotalDriverComm]  = useState(0)
  const [totalShopComm,    setTotalShopComm]    = useState(0)
  const [totalOrders,      setTotalOrders]      = useState(0)
  const [avgOrderValue,    setAvgOrderValue]    = useState(0)

  const [weeklyData,  setWeeklyData]  = useState<WeeklyRow[]>([])
  const [driverComms, setDriverComms] = useState<DriverComm[]>([])
  const [shopComms,   setShopComms]   = useState<ShopComm[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const now        = new Date()
    const today      = new Date(now); today.setHours(0,0,0,0)
    const sevenAgo   = new Date(now); sevenAgo.setDate(sevenAgo.getDate()-6); sevenAgo.setHours(0,0,0,0)
    const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodStart = period === "day" ? today : period === "week" ? sevenAgo : firstMonth

    const { data: rawOrders } = await supabase
      .from("orders")
      .select("id, total_amount, subtotal, ship_fee, driver_id, driver_commission_amount, shop_id, created_at, shops!shop_id(name, commission_rate)")
      .gte("created_at", periodStart.toISOString())
      .neq("status", "cancelled")

    const orders = rawOrders ?? []

    const shopOf = (o: typeof orders[0]) => {
      const s = Array.isArray(o.shops) ? o.shops[0] : o.shops as { name?: string; commission_rate?: number } | null
      return s
    }

    const rev        = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
    const driverComm = orders.reduce((s, o) => s + (o.driver_commission_amount ?? 0), 0)
    const shopComm   = orders.reduce((s, o) => s + Math.round((o.subtotal ?? 0) * ((shopOf(o)?.commission_rate ?? 0) / 100)), 0)

    setTotalRevenue(rev)
    setTotalDriverComm(Math.round(driverComm))
    setTotalShopComm(Math.round(shopComm))
    setTotalOrders(orders.length)
    setAvgOrderValue(orders.length > 0 ? Math.round(rev / orders.length) : 0)

    // Biểu đồ 7 ngày
    const last7 = getLast7Labels()
    setWeeklyData(last7.map(({ label, iso }) => {
      const dayOrders = orders.filter(o => o.created_at.startsWith(iso))
      return {
        day:        label,
        rev:        dayOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0),
        driverComm: dayOrders.reduce((s, o) => s + (o.driver_commission_amount ?? 0), 0),
        shopComm:   dayOrders.reduce((s, o) => s + Math.round((o.subtotal ?? 0) * ((shopOf(o)?.commission_rate ?? 0) / 100)), 0),
      }
    }))

    // Hoa hồng theo tài xế
    const driverIds = [...new Set(orders.filter(o => o.driver_id).map(o => o.driver_id as string))]
    const { data: profiles } = driverIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", driverIds)
      : { data: [] }
    const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name ?? "Tài xế"]))

    const drvAgg: Record<string, { trips: number; shipTotal: number; commission: number }> = {}
    orders.filter(o => o.driver_id).forEach(o => {
      const did = o.driver_id as string
      if (!drvAgg[did]) drvAgg[did] = { trips: 0, shipTotal: 0, commission: 0 }
      drvAgg[did].trips++
      drvAgg[did].shipTotal  += o.ship_fee ?? 0
      drvAgg[did].commission += o.driver_commission_amount ?? 0
    })
    setDriverComms(
      Object.entries(drvAgg)
        .map(([id, v]) => ({ id, name: nameMap[id] ?? "Tài xế", ...v }))
        .sort((a, b) => b.commission - a.commission)
    )

    // Hoa hồng theo quán
    const shopAgg: Record<string, ShopComm> = {}
    orders.forEach(o => {
      const sh = shopOf(o)
      if (!sh || !o.shop_id) return
      if (!shopAgg[o.shop_id]) shopAgg[o.shop_id] = { id: o.shop_id, name: sh.name ?? "Quán", orders: 0, subtotal: 0, commission: 0, rate: sh.commission_rate ?? 0 }
      shopAgg[o.shop_id].orders++
      shopAgg[o.shop_id].subtotal   += o.subtotal ?? 0
      shopAgg[o.shop_id].commission += Math.round((o.subtotal ?? 0) * ((sh.commission_rate ?? 0) / 100))
    })
    setShopComms(Object.values(shopAgg).sort((a, b) => b.commission - a.commission))

    setLoading(false)
  }, [period, supabase])

  useEffect(() => { load() }, [load])

  const maxRev        = Math.max(...weeklyData.map(d => d.rev), 1)
  const totalDrvComm  = driverComms.reduce((s, d) => s + d.commission, 0)
  const totalDrvTrips = driverComms.reduce((s, d) => s + d.trips, 0)
  const totalDrvShip  = driverComms.reduce((s, d) => s + d.shipTotal, 0)
  const totalShopOrd  = shopComms.reduce((s, m) => s + m.orders, 0)
  const totalShopSub  = shopComms.reduce((s, m) => s + m.subtotal, 0)
  const totalShopC    = shopComms.reduce((s, m) => s + m.commission, 0)

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        .kpi-card { animation: fadeUp 0.4s ease both; }
        .kpi-card:hover { transform: translateY(-2px); border-color: rgba(255,107,0,0.35) !important; transition: all 0.2s; }
        .table-row:hover { background: rgba(255,255,255,0.04) !important; }
      `}</style>
      <AdminShell
        pageTitle="💰 Tài chính"
        pageSubtitle="Doanh thu · Hoa hồng tài xế · Rút tiền"
        actions={
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {(["day","week","month"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ padding:"6px 14px", borderRadius:8, background: period===p ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: period===p ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: period===p ? "#FF8C00" : "#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend", fontWeight: period===p ? 700 : 400 }}>
                {p==="day" ? "Hôm nay" : p==="week" ? "7 ngày" : "Tháng này"}
              </button>
            ))}
            {loading && <div style={{ width:16, height:16, borderRadius:"50%", border:"2px solid rgba(255,107,0,0.2)", borderTop:"2px solid #FF6B00", animation:"spin 0.8s linear infinite" }} />}
          </div>
        }
      >
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", height:"100%" }}>

          {/* KPI */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:20 }}>
            {[
              { icon:"💵", label:"Doanh thu GMV",      value:fmtS(totalRevenue)+"đ",    sub: period==="day"?"Hôm nay":period==="week"?"7 ngày":"Tháng này", color:"#3ecf6e" },
              { icon:"📦", label:"Tổng đơn",            value:totalOrders+" đơn",         sub:"Không bị hủy",                color:"#4a8ff5" },
              { icon:"🛵", label:"HH từ tài xế",        value:fmtS(totalDriverComm)+"đ", sub:"Phí ship × % tài xế",         color:"#FF8C00" },
              { icon:"🏪", label:"HH từ quán",          value:fmtS(totalShopComm)+"đ",   sub:"Subtotal × % hoa hồng quán",  color:"#b464ff" },
              { icon:"💰", label:"Tổng thu app",        value:fmtS(totalDriverComm + totalShopComm)+"đ", sub:"HH tài xế + HH quán", color:"#FFB347" },
            ].map((k, i) => (
              <div key={k.label} className="kpi-card" style={{ animationDelay:`${i*0.06}s`, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ fontSize:24 }}>{k.icon}</div>
                  <span style={{ padding:"2px 8px", borderRadius:6, background:`${k.color}18`, color:k.color, fontSize:10, fontWeight:700 }}>live</span>
                </div>
                <div style={{ color:"#f0eaff", fontSize:16, fontWeight:800, marginBottom:4 }}>{k.value}</div>
                <div style={{ color:"#6a5a40", fontSize:10 }}>{k.label}</div>
                <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Chart + Withdrawals */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:16, marginBottom:20 }}>

            {/* Revenue Chart */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>Biểu đồ doanh thu 7 ngày</div>
                <div style={{ display:"flex", gap:14 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:5, color:"#6a5a40", fontSize:10 }}>
                    <span style={{ width:10, height:3, background:"#FF8C00", borderRadius:2, display:"inline-block" }} />Doanh thu
                  </span>
                  <span style={{ display:"flex", alignItems:"center", gap:5, color:"#6a5a40", fontSize:10 }}>
                    <span style={{ width:10, height:3, background:"#3ecf6e", borderRadius:2, display:"inline-block" }} />HH tài xế
                  </span>
                  <span style={{ display:"flex", alignItems:"center", gap:5, color:"#6a5a40", fontSize:10 }}>
                    <span style={{ width:10, height:3, background:"#b464ff", borderRadius:2, display:"inline-block" }} />HH quán
                  </span>
                </div>
              </div>
              {weeklyData.length === 0 ? (
                <div style={{ height:150, display:"flex", alignItems:"center", justifyContent:"center", color:"#6a5a40", fontSize:11 }}>Chưa có dữ liệu</div>
              ) : (
                <div style={{ display:"flex", alignItems:"flex-end", gap:10, height:150 }}>
                  {weeklyData.map(d => (
                    <div key={d.day} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, height:"100%" }}>
                      <div style={{ flex:1, width:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end", position:"relative" }}>
                        <div style={{ position:"absolute", bottom:0, left:0, right:0, display:"flex", flexDirection:"column", gap:1 }}>
                          <div style={{ width:"100%", height:`${(d.shopComm/maxRev)*100}%`, background:"rgba(180,100,255,0.65)", borderRadius:"3px 3px 0 0", minHeight:d.shopComm>0?3:0 }} />
                          <div style={{ width:"100%", height:`${(d.driverComm/maxRev)*100}%`, background:"rgba(62,207,110,0.65)", borderRadius:"3px 3px 0 0", minHeight:d.driverComm>0?3:0 }} />
                          <div style={{ width:"100%", height:`${((d.rev-d.driverComm-d.shopComm)/maxRev)*100}%`, background:"rgba(255,140,0,0.7)", borderRadius:"3px 3px 0 0", minHeight:d.rev>0?3:0 }} />
                        </div>
                      </div>
                      <div style={{ color:"#6a5a40", fontSize:9 }}>{d.day}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginTop:16, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                {[
                  { label:"Doanh thu GMV",  value: fmt(weeklyData.reduce((s,d)=>s+d.rev,0)) },
                  { label:"HH từ tài xế",   value: fmt(weeklyData.reduce((s,d)=>s+d.driverComm,0)) },
                  { label:"HH từ quán",      value: fmt(weeklyData.reduce((s,d)=>s+d.shopComm,0)) },
                  { label:"Tổng thu app",    value: fmt(weeklyData.reduce((s,d)=>s+d.driverComm+d.shopComm,0)) },
                ].map(item => (
                  <div key={item.label} style={{ textAlign:"center" }}>
                    <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>{item.value}</div>
                    <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top quán theo hoa hồng */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px", display:"flex", flexDirection:"column" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>Top quán · HH cao nhất</div>
                <span style={{ padding:"2px 8px", borderRadius:6, background:"rgba(180,100,255,0.12)", color:"#b464ff", fontSize:10, fontWeight:700 }}>{shopComms.length} quán</span>
              </div>
              {shopComms.length === 0 ? (
                <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#6a5a40", fontSize:11 }}>Chưa có dữ liệu</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  {shopComms.slice(0, 6).map(m => (
                    <div key={m.id} className="table-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 8px", borderRadius:10, transition:"background 0.15s" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                        <div style={{ width:32, height:32, borderRadius:9, background:"rgba(180,100,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🏪</div>
                        <div>
                          <div style={{ color:"#f0eaff", fontSize:11, fontWeight:600, maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.name}</div>
                          <div style={{ color:"#6a5a40", fontSize:9 }}>{m.orders} đơn · {m.rate}%</div>
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ color:"#b464ff", fontSize:12, fontWeight:700 }}>{fmt(m.commission)}</div>
                        <div style={{ color:"#6a5a40", fontSize:9 }}>{fmt(m.subtotal)} subtotal</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {shopComms.length > 0 && (
                <div style={{ marginTop:10, padding:"10px 12px", background:"rgba(180,100,255,0.07)", borderRadius:10, border:"1px solid rgba(180,100,255,0.18)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ color:"#6a5a40", fontSize:10 }}>Tổng HH từ quán</span>
                  <span style={{ color:"#b464ff", fontSize:13, fontWeight:800 }}>{fmt(totalShopC)}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2 bảng chi tiết */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

            {/* Driver commission table */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>🛵 Hoa hồng từ tài xế</div>
                <div style={{ color:"#6a5a40", fontSize:10 }}>{driverComms.length} tài xế</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1.8fr 60px 110px 110px", padding:"8px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                {["Tài xế","Chuyến","Phí ship","HH nộp app"].map(h => (
                  <span key={h} style={{ color:"#6a5a40", fontSize:10, fontWeight:600 }}>{h}</span>
                ))}
              </div>
              {driverComms.length === 0 ? (
                <div style={{ padding:"20px", textAlign:"center", color:"#6a5a40", fontSize:11 }}>Chưa có dữ liệu</div>
              ) : (
                <>
                  {driverComms.map(d => (
                    <div key={d.id} className="table-row" style={{ display:"grid", gridTemplateColumns:"1.8fr 60px 110px 110px", padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)", alignItems:"center", transition:"background 0.15s" }}>
                      <span style={{ color:"#f0eaff", fontSize:11, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.name}</span>
                      <span style={{ color:"#b0956a", fontSize:11 }}>{d.trips}</span>
                      <span style={{ color:"#f0eaff", fontSize:11 }}>{fmt(d.shipTotal)}</span>
                      <span style={{ color:"#3ecf6e", fontSize:11, fontWeight:700 }}>{fmt(d.commission)}</span>
                    </div>
                  ))}
                  <div style={{ padding:"10px 16px", display:"grid", gridTemplateColumns:"1.8fr 60px 110px 110px", alignItems:"center", borderTop:"1px solid rgba(255,107,0,0.1)", background:"rgba(255,107,0,0.03)" }}>
                    <span style={{ color:"#6a5a40", fontSize:10 }}>Tổng</span>
                    <span style={{ color:"#b0956a", fontSize:11 }}>{totalDrvTrips}</span>
                    <span style={{ color:"#f0eaff", fontSize:11 }}>{fmt(totalDrvShip)}</span>
                    <span style={{ color:"#3ecf6e", fontSize:12, fontWeight:800 }}>{fmt(totalDrvComm)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Shop commission table */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>🏪 Hoa hồng từ quán</div>
                <div style={{ color:"#6a5a40", fontSize:10 }}>{shopComms.length} quán</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1.8fr 50px 110px 110px", padding:"8px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                {["Cửa hàng","Tỉ lệ","Subtotal","HH thu được"].map(h => (
                  <span key={h} style={{ color:"#6a5a40", fontSize:10, fontWeight:600 }}>{h}</span>
                ))}
              </div>
              {shopComms.length === 0 ? (
                <div style={{ padding:"20px", textAlign:"center", color:"#6a5a40", fontSize:11 }}>Chưa có dữ liệu</div>
              ) : (
                <>
                  {shopComms.map(m => (
                    <div key={m.id} className="table-row" style={{ display:"grid", gridTemplateColumns:"1.8fr 50px 110px 110px", padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)", alignItems:"center", transition:"background 0.15s" }}>
                      <span style={{ color:"#f0eaff", fontSize:11, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.name}</span>
                      <span style={{ color:"#FF8C00", fontSize:11, fontWeight:700 }}>{m.rate}%</span>
                      <span style={{ color:"#f0eaff", fontSize:11 }}>{fmt(m.subtotal)}</span>
                      <span style={{ color:"#b464ff", fontSize:11, fontWeight:700 }}>{fmt(m.commission)}</span>
                    </div>
                  ))}
                  <div style={{ padding:"10px 16px", display:"grid", gridTemplateColumns:"1.8fr 50px 110px 110px", alignItems:"center", borderTop:"1px solid rgba(255,107,0,0.1)", background:"rgba(255,107,0,0.03)" }}>
                    <span style={{ color:"#6a5a40", fontSize:10 }}>Tổng</span>
                    <span style={{ color:"#6a5a40", fontSize:11 }}>—</span>
                    <span style={{ color:"#f0eaff", fontSize:11 }}>{fmt(totalShopSub)}</span>
                    <span style={{ color:"#b464ff", fontSize:12, fontWeight:800 }}>{fmt(totalShopC)}</span>
                  </div>
                </>
              )}
            </div>

          </div>

        </div>
      </AdminShell>
    </>
  )
}
