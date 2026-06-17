"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
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

interface WeeklyRow   { day: string; rev: number; comm: number }
interface DriverComm  { id: string; name: string; trips: number; shipTotal: number; commission: number }
interface Withdrawal  { id: string; name: string; amount: number; bank: string; account: string; created_at: string }

export default function AdminFinancePage() {
  const supabase = createClient()
  const router   = useRouter()
  const [period, setPeriod] = useState<"day"|"week"|"month">("week")
  const [loading, setLoading] = useState(true)

  const [totalRevenue,    setTotalRevenue]    = useState(0)
  const [totalCommission, setTotalCommission] = useState(0)
  const [totalOrders,     setTotalOrders]     = useState(0)
  const [avgOrderValue,   setAvgOrderValue]   = useState(0)
  const [pendingWithdraw, setPendingWithdraw] = useState(0)

  const [weeklyData,    setWeeklyData]    = useState<WeeklyRow[]>([])
  const [driverComms,   setDriverComms]   = useState<DriverComm[]>([])
  const [withdrawals,   setWithdrawals]   = useState<Withdrawal[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const now        = new Date()
    const today      = new Date(now); today.setHours(0,0,0,0)
    const sevenAgo   = new Date(now); sevenAgo.setDate(sevenAgo.getDate()-6); sevenAgo.setHours(0,0,0,0)
    const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodStart = period === "day" ? today : period === "week" ? sevenAgo : firstMonth

    // Orders trong kỳ — lấy driver_commission_amount (hoa hồng tài xế trả app)
    const { data: rawOrders } = await supabase
      .from("orders")
      .select("id, total_amount, ship_fee, driver_id, driver_commission_amount, created_at")
      .gte("created_at", periodStart.toISOString())
      .neq("status", "cancelled")

    const orders = rawOrders ?? []

    const rev  = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
    const comm = orders.reduce((s, o) => s + (o.driver_commission_amount ?? 0), 0)
    setTotalRevenue(rev)
    setTotalCommission(Math.round(comm))
    setTotalOrders(orders.length)
    setAvgOrderValue(orders.length > 0 ? Math.round(rev / orders.length) : 0)

    // Biểu đồ 7 ngày
    const last7 = getLast7Labels()
    setWeeklyData(last7.map(({ label, iso }) => {
      const dayOrders = orders.filter(o => o.created_at.startsWith(iso))
      return {
        day:  label,
        rev:  dayOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0),
        comm: dayOrders.reduce((s, o) => s + (o.driver_commission_amount ?? 0), 0),
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

    // Yêu cầu rút tiền đang chờ
    const { data: wds } = await supabase
      .from("withdrawals")
      .select("id, user_id, amount, bank_account, created_at, profiles!user_id(full_name)")
      .eq("status", "pending_transfer")
      .order("created_at", { ascending: false })
      .limit(5)

    const wdList: Withdrawal[] = (wds ?? []).map(w => {
      const p = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles as { full_name?: string } | null
      return {
        id:         w.id,
        name:       p?.full_name ?? "Tài xế",
        amount:     w.amount,
        bank:       "",
        account:    w.bank_account,
        created_at: w.created_at,
      }
    })
    setWithdrawals(wdList)
    setPendingWithdraw(wdList.reduce((s, w) => s + w.amount, 0))

    setLoading(false)
  }, [period, supabase])

  useEffect(() => { load() }, [load])

  const maxRev        = Math.max(...weeklyData.map(d => d.rev), 1)
  const totalDrvComm  = driverComms.reduce((s, d) => s + d.commission, 0)
  const totalDrvTrips = driverComms.reduce((s, d) => s + d.trips, 0)
  const totalDrvShip  = driverComms.reduce((s, d) => s + d.shipTotal, 0)

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
              { icon:"💵", label:"Doanh thu GMV",     value:fmtS(totalRevenue)+"đ",    sub: period==="day"?"Hôm nay":period==="week"?"7 ngày":"Tháng này", color:"#3ecf6e" },
              { icon:"📦", label:"Tổng đơn",           value:totalOrders+" đơn",         sub:"Không bị hủy",       color:"#4a8ff5" },
              { icon:"🏷️", label:"Hoa hồng từ tài xế", value:fmtS(totalCommission)+"đ", sub:"Phí nền tảng thu được", color:"#FF8C00" },
              { icon:"📊", label:"Giá trị TB/đơn",     value:fmtS(avgOrderValue)+"đ",   sub:"Doanh thu trung bình",  color:"#b464ff" },
              { icon:"⏳", label:"Chờ rút tiền",       value:fmtS(pendingWithdraw)+"đ", sub:`${withdrawals.length} yêu cầu`, color:"#FFB347" },
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
                    <span style={{ width:10, height:3, background:"#3ecf6e", borderRadius:2, display:"inline-block" }} />Hoa hồng tài xế
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
                  { label:"Doanh thu",        value: fmt(weeklyData.reduce((s,d)=>s+d.rev,0)) },
                  { label:"Hoa hồng tài xế",  value: fmt(weeklyData.reduce((s,d)=>s+d.comm,0)) },
                  { label:"Đơn hàng",          value: totalOrders + " đơn" },
                  { label:"Giá trị TB/đơn",    value: fmt(avgOrderValue) },
                ].map(item => (
                  <div key={item.label} style={{ textAlign:"center" }}>
                    <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>{item.value}</div>
                    <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending withdrawals */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px", display:"flex", flexDirection:"column" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>Yêu cầu rút tiền chờ duyệt</div>
                {withdrawals.length > 0 && (
                  <span style={{ padding:"2px 8px", borderRadius:6, background:"rgba(255,179,71,0.12)", color:"#FFB347", fontSize:10, fontWeight:700 }}>{withdrawals.length}</span>
                )}
              </div>
              {withdrawals.length === 0 ? (
                <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#6a5a40", fontSize:11 }}>Không có yêu cầu nào đang chờ</div>
              ) : (
                <>
                  <div style={{ display:"flex", flexDirection:"column", gap:2, flex:1 }}>
                    {withdrawals.map(w => (
                      <div key={w.id} className="table-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 8px", borderRadius:10, transition:"background 0.15s" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:34, height:34, borderRadius:10, background:"rgba(255,179,71,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🛵</div>
                          <div>
                            <div style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{w.name}</div>
                            <div style={{ color:"#6a5a40", fontSize:9 }}>{w.account}</div>
                          </div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ color:"#FFB347", fontSize:12, fontWeight:700 }}>{fmt(w.amount)}</div>
                          <div style={{ color:"#6a5a40", fontSize:9 }}>{new Date(w.created_at).toLocaleDateString("vi-VN")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:10, padding:"10px 12px", background:"rgba(255,179,71,0.07)", borderRadius:10, border:"1px solid rgba(255,179,71,0.18)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ color:"#6a5a40", fontSize:10 }}>Tổng chờ chuyển</span>
                    <span style={{ color:"#FFB347", fontSize:13, fontWeight:800 }}>{fmt(pendingWithdraw)}</span>
                  </div>
                  <button
                    onClick={() => router.push("/admin/withdrawals")}
                    style={{ marginTop:10, width:"100%", height:36, borderRadius:10, background:"rgba(255,179,71,0.1)", border:"1px solid rgba(255,179,71,0.3)", color:"#FFB347", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}
                  >
                    Xem tất cả yêu cầu rút →
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Driver commission table */}
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>Hoa hồng theo tài xế</div>
              <div style={{ color:"#6a5a40", fontSize:10 }}>{driverComms.length} tài xế có đơn</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 140px 160px", padding:"10px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              {["Tài xế","Số chuyến","Phí giao (gross)","Hoa hồng nộp app"].map(h => (
                <span key={h} style={{ color:"#6a5a40", fontSize:10, fontWeight:600 }}>{h}</span>
              ))}
            </div>
            {driverComms.length === 0 ? (
              <div style={{ padding:"24px", textAlign:"center", color:"#6a5a40", fontSize:11 }}>Chưa có dữ liệu cho kỳ này</div>
            ) : (
              <>
                {driverComms.map(d => (
                  <div key={d.id} className="table-row" style={{ display:"grid", gridTemplateColumns:"2fr 80px 140px 160px", padding:"12px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)", alignItems:"center", transition:"background 0.15s" }}>
                    <span style={{ color:"#f0eaff", fontSize:12, fontWeight:600 }}>🛵 {d.name}</span>
                    <span style={{ color:"#b0956a", fontSize:12 }}>{d.trips} chuyến</span>
                    <span style={{ color:"#f0eaff", fontSize:12 }}>{fmt(d.shipTotal)}</span>
                    <span style={{ color:"#3ecf6e", fontSize:12, fontWeight:700 }}>{fmt(d.commission)}</span>
                  </div>
                ))}
                <div style={{ padding:"12px 20px", display:"grid", gridTemplateColumns:"2fr 80px 140px 160px", alignItems:"center", borderTop:"1px solid rgba(255,107,0,0.1)", background:"rgba(255,107,0,0.03)" }}>
                  <span style={{ color:"#6a5a40", fontSize:10 }}>Tổng cộng — {driverComms.length} tài xế</span>
                  <span style={{ color:"#b0956a", fontSize:11 }}>{totalDrvTrips} chuyến</span>
                  <span style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{fmt(totalDrvShip)}</span>
                  <span style={{ color:"#3ecf6e", fontSize:12, fontWeight:800 }}>{fmt(totalDrvComm)}</span>
                </div>
              </>
            )}
          </div>

        </div>
      </AdminShell>
    </>
  )
}
