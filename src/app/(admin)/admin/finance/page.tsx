"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"


const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtS = (n: number) => n >= 1_000_000 ? (n/1_000_000).toFixed(1)+"M" : n >= 1000 ? (n/1000).toFixed(0)+"k" : n.toString()

function getLast7Labels() {
  const days = ["CN","T2","T3","T4","T5","T6","T7"]
  return Array.from({length:7},(_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i))
    return { label: days[d.getDay()], iso: d.toISOString().split("T")[0] }
  })
}

interface WeeklyRow { day: string; rev: number; comm: number }
interface MerchantRow { name: string; rate: number; orders: number; revenue: number; commission: number }
interface DriverRow { name: string; trips: number; earnings: number }

export default function AdminFinancePage() {
  const supabase = createClient()
  const [period, setPeriod]           = useState<"day"|"week"|"month">("week")
  const [loading, setLoading]         = useState(true)

  const [totalRevenue, setTotalRevenue]     = useState(0)
  const [totalCommission, setTotalCommission] = useState(0)
  const [totalOrders, setTotalOrders]       = useState(0)
  const [avgOrderValue, setAvgOrderValue]   = useState(0)
  const [pendingPayout, setPendingPayout]   = useState(0)

  const [weeklyData, setWeeklyData]         = useState<WeeklyRow[]>([])
  const [merchantComm, setMerchantComm]     = useState<MerchantRow[]>([])
  const [driverPayouts, setDriverPayouts]   = useState<DriverRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const today = new Date(now); today.setHours(0,0,0,0)
    const sevenAgo = new Date(now); sevenAgo.setDate(sevenAgo.getDate()-6); sevenAgo.setHours(0,0,0,0)
    const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodStart = period === "day" ? today : period === "week" ? sevenAgo : firstMonth

    // Period orders with shop commission_rate and driver_id
    const { data: periodOrders } = await supabase.from("orders")
      .select("id, subtotal, delivery_fee, driver_id, shop_id, created_at, shops!shop_id(name, commission_rate)")
      .gte("created_at", periodStart.toISOString())
      .neq("status", "cancelled")

    const orders = periodOrders ?? []
    const rev = orders.reduce((s,o) => s+(o.subtotal??0), 0)
    const comm = orders.reduce((s,o) => {
      const sh = Array.isArray(o.shops)?o.shops[0]:o.shops as {commission_rate?:number}|null
      return s + (o.subtotal??0)*((sh?.commission_rate??15)/100)
    }, 0)
    setTotalRevenue(rev); setTotalCommission(Math.round(comm))
    setTotalOrders(orders.length); setAvgOrderValue(orders.length > 0 ? Math.round(rev/orders.length) : 0)

    // Weekly chart (always last 7 days)
    const last7 = getLast7Labels()
    setWeeklyData(last7.map(({label, iso}) => {
      const dayOrders = orders.filter(o => o.created_at.startsWith(iso))
      const dayRev = dayOrders.reduce((s,o) => s+(o.subtotal??0), 0)
      const dayComm = dayOrders.reduce((s,o) => {
        const sh = Array.isArray(o.shops)?o.shops[0]:o.shops as {commission_rate?:number}|null
        return s + (o.subtotal??0)*((sh?.commission_rate??15)/100)
      }, 0)
      return { day: label, rev: dayRev, comm: Math.round(dayComm) }
    }))

    // Merchant commission table
    const shopAgg: Record<string,MerchantRow> = {}
    orders.forEach(o => {
      const sh = Array.isArray(o.shops)?o.shops[0]:o.shops as {name:string;commission_rate?:number}|null
      if (!sh || !o.shop_id) return
      if (!shopAgg[o.shop_id]) shopAgg[o.shop_id] = { name:sh.name??'—', rate:sh.commission_rate??15, orders:0, revenue:0, commission:0 }
      shopAgg[o.shop_id].orders++
      shopAgg[o.shop_id].revenue += o.subtotal??0
      shopAgg[o.shop_id].commission += Math.round((o.subtotal??0)*((sh.commission_rate??15)/100))
    })
    setMerchantComm(Object.values(shopAgg).sort((a,b)=>b.revenue-a.revenue))

    // Driver payouts from delivered orders
    const driverIds = [...new Set(orders.filter(o=>o.driver_id).map(o=>o.driver_id as string))]
    const { data: driverProfiles } = driverIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", driverIds)
      : { data: [] }
    const nameMap = Object.fromEntries((driverProfiles??[]).map(p=>[p.id, p.full_name??'Tài xế']))
    const drvAgg: Record<string,{trips:number;earnings:number}> = {}
    orders.filter(o=>o.driver_id).forEach(o => {
      const did = o.driver_id as string
      if (!drvAgg[did]) drvAgg[did] = {trips:0, earnings:0}
      drvAgg[did].trips++; drvAgg[did].earnings += o.delivery_fee??0
    })
    const payouts = Object.entries(drvAgg)
      .map(([id,v]) => ({ name: nameMap[id]??'Tài xế', trips:v.trips, earnings:v.earnings }))
      .sort((a,b)=>b.earnings-a.earnings).slice(0,5)
    setDriverPayouts(payouts)
    setPendingPayout(payouts.reduce((s,p)=>s+p.earnings,0))
    setLoading(false)
  }, [period, supabase])

  useEffect(() => { load() }, [load])

  const maxRev = Math.max(...weeklyData.map(d=>d.rev), 1)
  const totalMerchOrders = merchantComm.reduce((s,m)=>s+m.orders,0)
  const totalMerchRev    = merchantComm.reduce((s,m)=>s+m.revenue,0)
  const totalMerchComm   = merchantComm.reduce((s,m)=>s+m.commission,0)

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        .kpi-card { animation: fadeUp 0.4s ease both; }
        .kpi-card:hover { transform: translateY(-2px); border-color: rgba(255,107,0,0.35) !important; transition: all 0.2s; }
        .table-row:hover { background: rgba(255,255,255,0.04) !important; }
        a { text-decoration: none; }
      `}</style>
      <AdminShell
        pageTitle="💰 Tài chính"
        pageSubtitle="Doanh thu · Hoa hồng · Thanh toán tài xế"
        actions={
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {(["day","week","month"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ padding:"6px 14px", borderRadius:8, background: period===p ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: period===p ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: period===p ? "#FF8C00" : "#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend", fontWeight: period===p ? 700 : 400 }}>
                {p==="day"?"Hôm nay":p==="week"?"7 ngày":"Tháng này"}
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
                { icon:"💵", label:"Doanh thu", value:fmtS(totalRevenue)+"đ", sub: period==="day"?"Hôm nay":period==="week"?"7 ngày":"Tháng này", positive:true },
                { icon:"📈", label:"Tổng đơn",  value:totalOrders+" đơn",      sub:"Không bị hủy", positive:true },
                { icon:"🏷️", label:"Hoa hồng",  value:fmtS(totalCommission)+"đ", sub:`Avg ${merchantComm.length>0?(merchantComm.reduce((s,m)=>s+m.rate,0)/merchantComm.length).toFixed(0):15}%`, positive:true },
                { icon:"📊", label:"TB/đơn",    value:fmtS(avgOrderValue)+"đ", sub:"Giá trị trung bình", positive:null },
                { icon:"⏳", label:"Chờ TT tài xế",value:fmtS(pendingPayout)+"đ", sub:`${driverPayouts.length} tài xế`, positive:null },
              ].map((k, i) => (
                <div key={k.label} className="kpi-card" style={{ animationDelay:`${i*0.06}s`, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div style={{ fontSize:24 }}>{k.icon}</div>
                    <span style={{ padding:"2px 8px", borderRadius:6, background: k.positive===true ? "rgba(62,207,110,0.1)" : k.positive===false ? "rgba(255,64,64,0.1)" : "rgba(255,179,71,0.1)", color: k.positive===true ? "#3ecf6e" : k.positive===false ? "#ff4040" : "#FFB347", fontSize:10, fontWeight:700 }}>live</span>
                  </div>
                  <div style={{ color:"#f0eaff", fontSize:16, fontWeight:800, marginBottom:4 }}>{k.value}</div>
                  <div style={{ color:"#6a5a40", fontSize:10 }}>{k.label}</div>
                  <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Chart + Payout */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:16, marginBottom:20 }}>

              {/* Revenue Chart */}
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>Biểu đồ doanh thu 7 ngày</div>
                  <div style={{ display:"flex", gap:14 }}>
                    <span style={{ display:"flex", alignItems:"center", gap:5, color:"#6a5a40", fontSize:10 }}><span style={{ width:10, height:3, background:"#FF8C00", borderRadius:2, display:"inline-block" }} />Doanh thu</span>
                    <span style={{ display:"flex", alignItems:"center", gap:5, color:"#6a5a40", fontSize:10 }}><span style={{ width:10, height:3, background:"#3ecf6e", borderRadius:2, display:"inline-block" }} />Hoa hồng</span>
                  </div>
                </div>
                {weeklyData.length === 0 ? (
                  <div style={{ height:150, display:"flex", alignItems:"center", justifyContent:"center", color:"#6a5a40", fontSize:11 }}>Chưa có dữ liệu</div>
                ) : (
                  <div style={{ display:"flex", alignItems:"flex-end", gap:10, height:150 }}>
                    {weeklyData.map(d => (
                      <div key={d.day} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, height:"100%" }}>
                        <div style={{ flex:1, width:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end", position:"relative" }}>
                          <div style={{ position:"absolute", bottom:0, left:0, right:0, display:"flex", flexDirection:"column", gap:2 }}>
                            <div style={{ width:"100%", height:`${(d.comm/maxRev)*100}%`, background:"rgba(62,207,110,0.65)", borderRadius:"3px 3px 0 0", minHeight:d.comm>0?3:0 }} />
                            <div style={{ width:"100%", height:`${((d.rev-d.comm)/maxRev)*100}%`, background:"rgba(255,140,0,0.7)", borderRadius:"3px 3px 0 0", minHeight:d.rev>0?3:0 }} />
                          </div>
                        </div>
                        <div style={{ color:"#6a5a40", fontSize:9 }}>{d.day}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginTop:16, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                  {[
                    { label:"Tổng doanh thu", value:fmt(weeklyData.reduce((s,d)=>s+d.rev,0)) },
                    { label:"Tổng hoa hồng",  value:fmt(weeklyData.reduce((s,d)=>s+d.comm,0)) },
                    { label:"Đơn hàng",        value:totalOrders+" đơn" },
                    { label:"Giá trị TB/đơn",  value:fmt(avgOrderValue) },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign:"center" }}>
                      <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>{item.value}</div>
                      <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Driver Payouts */}
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px" }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700, marginBottom:14 }}>Phí giao hàng tài xế</div>
                {driverPayouts.length === 0 ? (
                  <div style={{ padding:"24px", textAlign:"center", color:"#6a5a40", fontSize:11 }}>Chưa có dữ liệu</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:2, marginBottom:14 }}>
                    {driverPayouts.map(p => (
                      <div key={p.name} className="table-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 10px", borderRadius:10, transition:"background 0.15s" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:10, background:"rgba(255,107,0,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🛵</div>
                          <div>
                            <div style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{p.name}</div>
                            <div style={{ color:"#6a5a40", fontSize:9 }}>{p.trips} chuyến</div>
                          </div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ color:"#FF8C00", fontSize:12, fontWeight:700 }}>{fmt(p.earnings)}</div>
                          <span style={{ padding:"1px 8px", borderRadius:6, background:"rgba(255,179,71,0.1)", color:"#FFB347", fontSize:9, fontWeight:700 }}>Chờ TT</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {pendingPayout > 0 && (
                  <>
                    <div style={{ padding:"12px", background:"rgba(255,107,0,0.06)", borderRadius:10, border:"1px solid rgba(255,107,0,0.15)", marginBottom:12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ color:"#6a5a40", fontSize:10 }}>Tổng chờ thanh toán</span>
                        <span style={{ color:"#FF8C00", fontSize:12, fontWeight:700 }}>{fmt(pendingPayout)}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <span style={{ color:"#6a5a40", fontSize:10 }}>Số tài xế</span>
                        <span style={{ color:"#FFB347", fontSize:11, fontWeight:700 }}>{driverPayouts.length} tài xế</span>
                      </div>
                    </div>
                    <button style={{ width:"100%", height:38, borderRadius:10, background:"linear-gradient(90deg,rgba(255,107,0,0.15),rgba(255,179,71,0.1))", border:"1px solid rgba(255,107,0,0.3)", color:"#FF8C00", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                      💸 Thanh toán tất cả → {fmt(pendingPayout)}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Commission table */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>Hoa hồng theo cửa hàng</div>
                <div style={{ color:"#6a5a40", fontSize:10 }}>{merchantComm.length} cửa hàng</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1.8fr 70px 80px 150px 150px", padding:"10px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                {["Cửa hàng","Tỉ lệ","Đơn hàng","Doanh thu","Hoa hồng"].map(h => (
                  <span key={h} style={{ color:"#6a5a40", fontSize:10, fontWeight:600 }}>{h}</span>
                ))}
              </div>
              {merchantComm.length === 0 ? (
                <div style={{ padding:"24px", textAlign:"center", color:"#6a5a40", fontSize:11 }}>Chưa có dữ liệu cho kỳ này</div>
              ) : (
                <>
                  {merchantComm.map(m => (
                    <div key={m.name} className="table-row" style={{ display:"grid", gridTemplateColumns:"1.8fr 70px 80px 150px 150px", padding:"12px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)", alignItems:"center", transition:"background 0.15s" }}>
                      <span style={{ color:"#f0eaff", fontSize:12, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>🏪 {m.name}</span>
                      <span style={{ color:"#FF8C00", fontSize:12, fontWeight:700 }}>{m.rate}%</span>
                      <span style={{ color:"#b0956a", fontSize:12 }}>{m.orders} đơn</span>
                      <span style={{ color:"#f0eaff", fontSize:12 }}>{fmt(m.revenue)}</span>
                      <span style={{ color:"#3ecf6e", fontSize:12, fontWeight:700 }}>{fmt(m.commission)}</span>
                    </div>
                  ))}
                  <div style={{ padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:"1px solid rgba(255,107,0,0.1)", background:"rgba(255,107,0,0.03)" }}>
                    <span style={{ color:"#6a5a40", fontSize:10 }}>Tổng cộng — {merchantComm.length} cửa hàng</span>
                    <div style={{ display:"flex", gap:32 }}>
                      <span style={{ color:"#b0956a", fontSize:11 }}>{totalMerchOrders} đơn</span>
                      <span style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{fmt(totalMerchRev)}</span>
                      <span style={{ color:"#3ecf6e", fontSize:12, fontWeight:800 }}>{fmt(totalMerchComm)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

        </div>
      </AdminShell>
    </>
  )
}
