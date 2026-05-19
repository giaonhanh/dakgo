"use client"

import { useState } from "react"

const NAV_ITEMS = [
  { icon: "🏠",  label: "Dashboard",    href: "/admin",               active: false },
  { icon: "🏍️", label: "Tài xế",        href: "/admin/drivers",       active: false },
  { icon: "🏪",  label: "Cửa hàng",      href: "/admin/merchants",     active: false },
  { icon: "📦",  label: "Đơn hàng",      href: "/admin/orders",        active: false },
  { icon: "👥",  label: "Khách hàng",    href: "/admin/users",         active: false },
  { icon: "💰",  label: "Tài chính",     href: "/admin/finance",       active: true  },
  { icon: "🗺️", label: "Bản đồ live",   href: "/admin/map",           active: false },
  { icon: "🏷️", label: "Khuyến mãi",    href: "/admin/promotions",    active: false },
  { icon: "⚖️",  label: "Tranh chấp",    href: "/admin/disputes",      active: false },
  { icon: "📣",  label: "Thông báo",     href: "/admin/notifications", active: false },
  { icon: "⚙️",  label: "Cài đặt",       href: "/admin/settings",      active: false },
]

const KPI = [
  { label: "Doanh thu hôm nay",  value: "4.850.000đ",  delta: "+12%", positive: true,  icon: "💵" },
  { label: "Doanh thu tháng",    value: "87.450.000đ", delta: "+8%",  positive: true,  icon: "📈" },
  { label: "Hoa hồng thu được",  value: "13.117.500đ", delta: "+5%",  positive: true,  icon: "🏷️" },
  { label: "Chờ thanh toán",     value: "2.340.000đ",  delta: "3 TX", positive: null,  icon: "⏳" },
  { label: "Đã thanh toán",      value: "84.150.000đ", delta: "96%",  positive: true,  icon: "✅" },
]

const WEEKLY = [
  { day: "T2", rev: 5200000, comm: 780000 },
  { day: "T3", rev: 6800000, comm: 1020000 },
  { day: "T4", rev: 4100000, comm: 615000 },
  { day: "T5", rev: 7900000, comm: 1185000 },
  { day: "T6", rev: 8500000, comm: 1275000 },
  { day: "T7", rev: 6200000, comm: 930000 },
  { day: "CN", rev: 4850000, comm: 727500 },
]

const MERCHANTS_COMM = [
  { name: "Bún Bò Huế Ngon",   rate: 15, orders: 45, revenue: 4500000, commission: 675000 },
  { name: "Gà Rán KFC Phước",   rate: 18, orders: 62, revenue: 7100000, commission: 1278000 },
  { name: "Cơm Tấm Sài Gòn",   rate: 12, orders: 38, revenue: 3200000, commission: 384000 },
  { name: "Bánh Mì Thanh Nga",  rate: 12, orders: 51, revenue: 1530000, commission: 183600 },
  { name: "Quán Cà Phê Nhớ",    rate: 10, orders: 29, revenue: 1450000, commission: 145000 },
]

const PAYOUTS = [
  { driver: "Trần Văn Bình",  trips: 28, earnings: 1120000, status: "paid"    },
  { driver: "Phạm Thị Dung",  trips: 35, earnings: 1400000, status: "paid"    },
  { driver: "Lê Văn Cường",   trips: 22, earnings: 880000,  status: "pending" },
  { driver: "Nguyễn Văn An",  trips: 19, earnings: 760000,  status: "pending" },
]

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function AdminFinancePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [period, setPeriod] = useState<"day"|"week"|"month">("week")

  const maxRev = Math.max(...WEEKLY.map(d => d.rev))

  return (
    <>
      <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #06050a; font-family: 'Lexend', sans-serif; height: 100%; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,107,0,0.3); border-radius: 2px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .kpi-card { animation: fadeUp 0.4s ease both; }
        .kpi-card:hover { transform: translateY(-2px); border-color: rgba(255,107,0,0.35) !important; transition: all 0.2s; }
        .table-row:hover { background: rgba(255,255,255,0.04) !important; }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; }
      `}</style>

      <div style={{ display:"flex", height:"100vh", background:"#06050a", color:"#f0eaff", overflow:"hidden" }}>

        {/* SIDEBAR */}
        <div style={{ width: sidebarOpen ? 220 : 60, flexShrink:0, background:"rgba(12,11,20,0.95)", backdropFilter:"blur(20px)", borderRight:"1px solid rgba(255,107,0,0.12)", display:"flex", flexDirection:"column", transition:"width 0.25s ease", overflow:"hidden", zIndex:50 }}>
          <div style={{ height:56, display:"flex", alignItems:"center", padding:"0 14px", borderBottom:"1px solid rgba(255,255,255,0.06)", gap:10, flexShrink:0 }}>
            <div style={{ width:30, height:30, borderRadius:9, flexShrink:0, background:"linear-gradient(135deg,#FF6B00,#FF8C00,#FFB347)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🚀</div>
            {sidebarOpen && <div><div style={{ color:"#f0eaff", fontSize:13, fontWeight:800, lineHeight:1 }}>GiaoNhanh</div><div style={{ color:"#6a5a40", fontSize:9 }}>Admin Panel</div></div>}
          </div>
          <nav style={{ flex:1, padding:"8px", overflowY:"auto" }}>
            {NAV_ITEMS.map(item => (
              <a key={item.href} href={item.href} className="sidebar-link" style={{ display:"flex", alignItems:"center", gap:10, height:40, borderRadius:10, padding:"0 10px", marginBottom:2, textDecoration:"none", background: item.active ? "rgba(255,107,0,0.12)" : "transparent", borderLeft: item.active ? "2px solid #FF6B00" : "2px solid transparent", color: item.active ? "#FF8C00" : "#6a5a40", fontSize:12, fontWeight: item.active ? 700 : 400, whiteSpace:"nowrap", overflow:"hidden", transition:"all 0.2s" }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </a>
            ))}
          </nav>
          <button onClick={() => setSidebarOpen(p => !p)} style={{ margin:"8px", height:36, borderRadius:10, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#6a5a40", fontSize:16, cursor:"pointer", flexShrink:0 }}>
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* MAIN */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Top bar */}
          <div style={{ height:56, borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", flexShrink:0 }}>
            <div>
              <div style={{ color:"#f0eaff", fontSize:16, fontWeight:800 }}>💰 Tài chính</div>
              <div style={{ color:"#6a5a40", fontSize:10 }}>Doanh thu · Hoa hồng · Thanh toán tài xế</div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {(["day","week","month"] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{ padding:"6px 14px", borderRadius:8, background: period===p ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: period===p ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: period===p ? "#FF8C00" : "#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend", fontWeight: period===p ? 700 : 400 }}>
                  {p==="day"?"Hôm nay":p==="week"?"7 ngày":"Tháng này"}
                </button>
              ))}
              <button style={{ padding:"6px 16px", borderRadius:8, background:"rgba(62,207,110,0.1)", border:"1px solid rgba(62,207,110,0.25)", color:"#3ecf6e", fontSize:11, cursor:"pointer", fontFamily:"Lexend", fontWeight:700 }}>📊 Xuất báo cáo</button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

            {/* KPI */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:20 }}>
              {KPI.map((k, i) => (
                <div key={k.label} className="kpi-card" style={{ animationDelay:`${i*0.06}s`, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div style={{ fontSize:24 }}>{k.icon}</div>
                    <span style={{ padding:"2px 8px", borderRadius:6, background: k.positive===true ? "rgba(62,207,110,0.1)" : k.positive===false ? "rgba(255,64,64,0.1)" : "rgba(255,179,71,0.1)", color: k.positive===true ? "#3ecf6e" : k.positive===false ? "#ff4040" : "#FFB347", fontSize:10, fontWeight:700 }}>{k.delta}</span>
                  </div>
                  <div style={{ color:"#f0eaff", fontSize:16, fontWeight:800, marginBottom:4 }}>{k.value}</div>
                  <div style={{ color:"#6a5a40", fontSize:10 }}>{k.label}</div>
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
                <div style={{ display:"flex", alignItems:"flex-end", gap:10, height:150 }}>
                  {WEEKLY.map(d => (
                    <div key={d.day} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, height:"100%" }}>
                      <div style={{ flex:1, width:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end", position:"relative" }}>
                        <div style={{ position:"absolute", bottom:0, left:0, right:0, display:"flex", flexDirection:"column", gap:2 }}>
                          <div style={{ width:"100%", height:`${(d.comm/maxRev)*100}%`, background:"rgba(62,207,110,0.65)", borderRadius:"3px 3px 0 0", minHeight:3 }} />
                          <div style={{ width:"100%", height:`${((d.rev-d.comm)/maxRev)*100}%`, background:"rgba(255,140,0,0.7)", borderRadius:"3px 3px 0 0", minHeight:3 }} />
                        </div>
                      </div>
                      <div style={{ color:"#6a5a40", fontSize:9 }}>{d.day}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginTop:16, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                  {[
                    { label:"Tổng doanh thu", value:fmt(WEEKLY.reduce((s,d)=>s+d.rev,0)) },
                    { label:"Tổng hoa hồng",  value:fmt(WEEKLY.reduce((s,d)=>s+d.comm,0)) },
                    { label:"Đơn hàng",        value:"283 đơn" },
                    { label:"Giá trị TB/đơn",  value:"164.000đ" },
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
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700, marginBottom:14 }}>Thanh toán tài xế</div>
                <div style={{ display:"flex", flexDirection:"column", gap:2, marginBottom:14 }}>
                  {PAYOUTS.map(p => (
                    <div key={p.driver} className="table-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 10px", borderRadius:10, transition:"background 0.15s" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:"rgba(255,107,0,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🛵</div>
                        <div>
                          <div style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{p.driver}</div>
                          <div style={{ color:"#6a5a40", fontSize:9 }}>{p.trips} chuyến</div>
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ color:"#FF8C00", fontSize:12, fontWeight:700 }}>{fmt(p.earnings)}</div>
                        <span style={{ padding:"1px 8px", borderRadius:6, background: p.status==="paid" ? "rgba(62,207,110,0.1)" : "rgba(255,179,71,0.1)", color: p.status==="paid" ? "#3ecf6e" : "#FFB347", fontSize:9, fontWeight:700 }}>
                          {p.status==="paid" ? "Đã TT" : "Chờ TT"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding:"12px", background:"rgba(255,107,0,0.06)", borderRadius:10, border:"1px solid rgba(255,107,0,0.15)", marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ color:"#6a5a40", fontSize:10 }}>Tổng chờ thanh toán</span>
                    <span style={{ color:"#FF8C00", fontSize:12, fontWeight:700 }}>{fmt(1640000)}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"#6a5a40", fontSize:10 }}>Số tài xế chờ</span>
                    <span style={{ color:"#FFB347", fontSize:11, fontWeight:700 }}>2 tài xế</span>
                  </div>
                </div>
                <button style={{ width:"100%", height:38, borderRadius:10, background:"linear-gradient(90deg,rgba(255,107,0,0.15),rgba(255,179,71,0.1))", border:"1px solid rgba(255,107,0,0.3)", color:"#FF8C00", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                  💸 Thanh toán tất cả → 1.640.000đ
                </button>
              </div>
            </div>

            {/* Commission table */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>Hoa hồng theo cửa hàng</div>
                <button style={{ padding:"6px 14px", borderRadius:8, background:"rgba(62,207,110,0.08)", border:"1px solid rgba(62,207,110,0.2)", color:"#3ecf6e", fontSize:11, cursor:"pointer", fontFamily:"Lexend", fontWeight:700 }}>📥 Xuất Excel</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1.8fr 70px 80px 150px 150px 110px", padding:"10px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                {["Cửa hàng","Tỉ lệ","Đơn hàng","Doanh thu","Hoa hồng",""].map(h => (
                  <span key={h} style={{ color:"#6a5a40", fontSize:10, fontWeight:600 }}>{h}</span>
                ))}
              </div>
              {MERCHANTS_COMM.map(m => (
                <div key={m.name} className="table-row" style={{ display:"grid", gridTemplateColumns:"1.8fr 70px 80px 150px 150px 110px", padding:"12px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)", alignItems:"center", transition:"background 0.15s" }}>
                  <span style={{ color:"#f0eaff", fontSize:12, fontWeight:600 }}>🏪 {m.name}</span>
                  <span style={{ color:"#FF8C00", fontSize:12, fontWeight:700 }}>{m.rate}%</span>
                  <span style={{ color:"#b0956a", fontSize:12 }}>{m.orders} đơn</span>
                  <span style={{ color:"#f0eaff", fontSize:12 }}>{fmt(m.revenue)}</span>
                  <span style={{ color:"#3ecf6e", fontSize:12, fontWeight:700 }}>{fmt(m.commission)}</span>
                  <button style={{ padding:"5px 12px", borderRadius:7, background:"rgba(74,143,245,0.1)", border:"1px solid rgba(74,143,245,0.25)", color:"#4a8ff5", fontSize:10, cursor:"pointer", fontFamily:"Lexend", width:"fit-content" }}>Chi tiết</button>
                </div>
              ))}
              <div style={{ padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:"1px solid rgba(255,107,0,0.1)", background:"rgba(255,107,0,0.03)" }}>
                <span style={{ color:"#6a5a40", fontSize:10 }}>Tổng cộng — 5 cửa hàng</span>
                <div style={{ display:"flex", gap:32 }}>
                  <span style={{ color:"#b0956a", fontSize:11 }}>225 đơn</span>
                  <span style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{fmt(17780000)}</span>
                  <span style={{ color:"#3ecf6e", fontSize:12, fontWeight:800 }}>{fmt(2666100)}</span>
                  <span style={{ width:110 }} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
