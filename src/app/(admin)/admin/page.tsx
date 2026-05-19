"use client"

import { useState } from "react"

interface Order {
  id: string
  customer: string
  shop: string
  amount: number
  status: "delivering" | "completed" | "cancelled" | "pending"
}

const ORDERS: Order[] = [
  { id: "DH142", customer: "Nguyễn Văn A", shop: "Cơm Tấm Lan",  amount: 105000, status: "delivering" },
  { id: "DH141", customer: "Trần Thị B",   shop: "Quán Mộc",      amount: 85000,  status: "completed"  },
  { id: "DH140", customer: "Lê Văn C",     shop: "Tiệm Kem",      amount: 75000,  status: "cancelled"  },
  { id: "DH139", customer: "Phạm Thị D",   shop: "Bún Bò Huế",    amount: 92000,  status: "completed"  },
  { id: "DH138", customer: "Hoàng Văn E",  shop: "Trà Sữa Ding",  amount: 55000,  status: "pending"    },
]

const STATUS_MAP = {
  delivering: { label: "Đang giao",      color: "#FF8C00", bg: "rgba(255,140,0,0.12)",   border: "rgba(255,107,0,0.3)"   },
  completed:  { label: "Hoàn thành",     color: "#3ecf6e", bg: "rgba(62,207,110,0.10)",  border: "rgba(62,207,110,0.25)" },
  cancelled:  { label: "Đã hủy",         color: "#ff4040", bg: "rgba(255,64,64,0.10)",   border: "rgba(255,64,64,0.25)"  },
  pending:    { label: "Chờ xác nhận",   color: "#4a8ff5", bg: "rgba(74,143,245,0.10)",  border: "rgba(74,143,245,0.25)" },
}

const NAV_ITEMS = [
  { icon: "🏠",  label: "Dashboard",      href: "/admin",               active: true  },
  { icon: "🏍️", label: "Tài xế",          href: "/admin/drivers",       active: false },
  { icon: "🏪",  label: "Cửa hàng",        href: "/admin/merchants",     active: false },
  { icon: "📦",  label: "Đơn hàng",        href: "/admin/orders",        active: false },
  { icon: "👥",  label: "Khách hàng",      href: "/admin/users",         active: false },
  { icon: "💰",  label: "Tài chính",       href: "/admin/finance",       active: false },
  { icon: "🗺️", label: "Bản đồ live",     href: "/admin/map",           active: false },
  { icon: "🏷️", label: "Khuyến mãi",      href: "/admin/promotions",    active: false },
  { icon: "⚖️",  label: "Tranh chấp",      href: "/admin/disputes",      active: false },
  { icon: "📣",  label: "Thông báo",       href: "/admin/notifications", active: false },
  { icon: "⚙️",  label: "Cài đặt",         href: "/admin/settings",      active: false },
]

const CHART_BARS = [
  { day: "T2", value: 55, today: false },
  { day: "T3", value: 70, today: false },
  { day: "T4", value: 45, today: false },
  { day: "T5", value: 88, today: false },
  { day: "T6", value: 95, today: false },
  { day: "T7", value: 62, today: false },
  { day: "CN", value: 78, today: true  },
]

const HOUR_BARS = [
  { h: "6h",  v: 20 }, { h: "7h",  v: 45 }, { h: "8h",  v: 75 },
  { h: "9h",  v: 98 }, { h: "10h", v: 85 }, { h: "11h", v: 90 },
  { h: "12h", v: 40 },
]

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

  return (
    <>
      <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #06050a; font-family: 'Lexend', sans-serif; height: 100%; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,107,0,0.3); border-radius: 2px; }

        @keyframes shimmer { 0% { left:-60%; } 100% { left:120%; } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

        .kpi-card { animation: fadeUp 0.4s ease both; }
        .kpi-card:hover { transform: translateY(-2px); border-color: rgba(255,107,0,0.35) !important; transition: all 0.2s; }
        .order-row:hover { background: rgba(255,255,255,0.04) !important; }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; }
      `}</style>

      <div style={{
        display: "flex",
        height: "100vh",
        background: "#06050a",
        color: "#f0eaff",
        overflow: "hidden",
      }}>

        {/* SIDEBAR */}
        <div style={{
          width: sidebarOpen ? 220 : 60,
          flexShrink: 0,
          background: "rgba(12,11,20,0.95)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,107,0,0.12)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s ease",
          overflow: "hidden",
          zIndex: 50,
        }}>

          {/* Logo */}
          <div style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: "linear-gradient(135deg, #FF6B00, #FF8C00, #FFB347)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15,
            }}>🚀</div>
            {sidebarOpen && (
              <div>
                <div style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700 }}>Giao Nhanh</div>
                <div style={{
                  fontSize: 8, fontWeight: 700, padding: "1px 5px",
                  background: "rgba(180,100,255,0.15)", border: "1px solid rgba(180,100,255,0.3)",
                  borderRadius: 4, color: "#b464ff", display: "inline-block",
                }}>ADMIN</div>
              </div>
            )}
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: "10px 8px", overflow: "auto" }}>
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                <div
                  className="sidebar-link"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: sidebarOpen ? "8px 10px" : "8px",
                    borderRadius: 10,
                    marginBottom: 3,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    background: item.active ? "rgba(255,107,0,0.12)" : "transparent",
                    borderLeft: item.active ? "2px solid #FF6B00" : "2px solid transparent",
                    justifyContent: sidebarOpen ? "flex-start" : "center",
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  {sidebarOpen && (
                    <span style={{
                      fontSize: 11, fontWeight: item.active ? 600 : 400,
                      color: item.active ? "#FF8C00" : "rgba(144,128,176,0.8)",
                      whiteSpace: "nowrap",
                    }}>{item.label}</span>
                  )}
                </div>
              </a>
            ))}
          </nav>

          {/* Toggle button */}
          <div
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              height: 44, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(144,128,176,0.6)", fontSize: 14,
              transition: "color 0.2s",
            }}
          >
            {sidebarOpen ? "◀" : "▶"}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top bar */}
          <div style={{
            height: 56, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 20px",
            background: "rgba(12,11,20,0.8)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div>
              <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Admin</div>
              <div style={{ color: "#f0eaff", fontSize: 13, fontWeight: 700 }}>Giao Nhanh — Dashboard</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9 }}>
                Krông Pắc · {new Date().toLocaleDateString("vi-VN")}
              </div>
              {/* Notif bell */}
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative",
              }}>
                🔔
                <div style={{
                  position: "absolute", top: 5, right: 5,
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#ff4040", border: "1.5px solid #06050a",
                  boxShadow: "0 0 4px #ff4040",
                  animation: "pulse 1.5s infinite",
                }} />
              </div>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(180,100,255,0.15)", border: "1px solid rgba(180,100,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, cursor: "pointer",
              }}>👤</div>
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>

            {/* KPI Cards — 4 cột x 2 hàng */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginBottom: 14,
            }}>
              {[
                { icon: "💰", label: "Doanh thu hôm nay",  value: "8.5M",   sub: "+14% hôm qua",       c: "#FF8C00", bg: "rgba(255,107,0,0.07)",    bd: "rgba(255,107,0,0.2)",    delay: "0s"    },
                { icon: "📦", label: "Đơn hàng",            value: "142",    sub: "+8 trong 1h",         c: "#3ecf6e", bg: "rgba(62,207,110,0.06)",   bd: "rgba(62,207,110,0.18)",  delay: "0.05s" },
                { icon: "🏍️",label: "Tài xế online",       value: "12",     sub: "3 đang giao",         c: "#4a8ff5", bg: "rgba(74,143,245,0.07)",   bd: "rgba(74,143,245,0.2)",   delay: "0.1s"  },
                { icon: "👥", label: "Khách hoạt động",     value: "89",     sub: "+23 hôm nay",         c: "#b464ff", bg: "rgba(180,100,255,0.07)",  bd: "rgba(180,100,255,0.2)",  delay: "0.15s" },
                { icon: "🏪", label: "Quán đang mở",        value: "23",     sub: "2 quán mới",          c: "#FF8C00", bg: "rgba(255,107,0,0.07)",    bd: "rgba(255,107,0,0.2)",    delay: "0.2s"  },
                { icon: "⚠️", label: "Khiếu nại",           value: "3",      sub: "Cần xử lý",           c: "#ff4040", bg: "rgba(255,64,64,0.07)",    bd: "rgba(255,64,64,0.2)",    delay: "0.25s" },
                { icon: "📈", label: "Doanh thu tháng",     value: "28.4M",  sub: "+18% tháng trước",    c: "#3ecf6e", bg: "rgba(62,207,110,0.06)",   bd: "rgba(62,207,110,0.18)",  delay: "0.3s"  },
                { icon: "🏷️",label: "Voucher đã dùng",     value: "47",     sub: "Tiết kiệm 2.1M",      c: "#f5c542", bg: "rgba(245,197,66,0.07)",   bd: "rgba(245,197,66,0.2)",   delay: "0.35s" },
              ].map((k, i) => (
                <div key={i} className="kpi-card" style={{
                  background: k.bg,
                  border: `1px solid ${k.bd}`,
                  borderRadius: 13,
                  padding: "11px 12px",
                  animationDelay: k.delay,
                  cursor: "default",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: k.bg, border: `1px solid ${k.bd}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14,
                    }}>{k.icon}</div>
                    <div style={{
                      fontSize: 7, fontWeight: 700, padding: "2px 6px",
                      background: k.bg, border: `1px solid ${k.bd}`,
                      borderRadius: 4, color: k.c,
                    }}>↑</div>
                  </div>
                  <div style={{ color: k.c, fontSize: 22, fontWeight: 800, lineHeight: 1, marginBottom: 2 }}>{k.value}</div>
                  <div style={{ color: "rgba(240,234,255,0.6)", fontSize: 9 }}>{k.label}</div>
                  <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 8, marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Two-column: Charts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>

              {/* Revenue line chart */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 13, padding: "11px 13px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ color: "rgba(144,128,176,0.8)", fontSize: 10, fontWeight: 600 }}>📈 Doanh thu 7 ngày</div>
                  <div style={{
                    color: "#FF8C00", fontSize: 8, fontWeight: 600,
                    background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.25)",
                    borderRadius: 5, padding: "2px 7px",
                  }}>Tuần ▾</div>
                </div>
                <div style={{ position: "relative", height: 80, marginBottom: 6 }}>
                  {[25, 50, 75].map(p => (
                    <div key={p} style={{
                      position: "absolute", left: 0, right: 0,
                      top: `${100 - p}%`, height: 1,
                      background: "rgba(255,255,255,0.04)",
                    }} />
                  ))}
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 300 80" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF8C00" stopOpacity="0.3"/>
                        <stop offset="100%" stopColor="#FF8C00" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d="M0,52 L43,35 L86,44 L129,16 L172,10 L215,26 L300,18"
                      stroke="#FF8C00" strokeWidth="2" fill="none" strokeLinecap="round"/>
                    <path d="M0,52 L43,35 L86,44 L129,16 L172,10 L215,26 L300,18 L300,80 L0,80 Z"
                      fill="url(#lg1)"/>
                    <circle cx="300" cy="18" r="4" fill="#FF6B00"/>
                  </svg>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {CHART_BARS.map(b => (
                    <div key={b.day} style={{
                      fontSize: 8,
                      color: b.today ? "#FF8C00" : "rgba(144,128,176,0.4)",
                      fontWeight: b.today ? 700 : 400,
                    }}>{b.day}</div>
                  ))}
                </div>
              </div>

              {/* Orders by hour bar chart */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 13, padding: "11px 13px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ color: "rgba(144,128,176,0.8)", fontSize: 10, fontWeight: 600 }}>📊 Đơn theo giờ</div>
                  <div style={{
                    color: "#b464ff", fontSize: 8, fontWeight: 600,
                    background: "rgba(180,100,255,0.1)", border: "1px solid rgba(180,100,255,0.25)",
                    borderRadius: 5, padding: "2px 7px",
                  }}>Hôm nay ▾</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 70, marginBottom: 6 }}>
                  {HOUR_BARS.map((b, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%" }}>
                      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                        <div style={{
                          width: "100%",
                          height: `${b.v}%`,
                          borderRadius: "3px 3px 0 0",
                          background: i === 3
                            ? "linear-gradient(180deg,#b464ff,rgba(180,100,255,0.3))"
                            : "rgba(180,100,255,0.25)",
                          boxShadow: i === 3 ? "0 0 8px rgba(180,100,255,0.4)" : "none",
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {HOUR_BARS.map((b, i) => (
                    <div key={i} style={{
                      flex: 1, textAlign: "center", fontSize: 7,
                      color: i === 3 ? "#b464ff" : "rgba(144,128,176,0.4)",
                    }}>{b.h}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Map + Orders table */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, marginBottom: 14 }}>

              {/* Mini live map */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 13, padding: "11px 13px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                  <div style={{ color: "rgba(144,128,176,0.8)", fontSize: 10, fontWeight: 600 }}>🗺️ Bản đồ tài xế live</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#3ecf6e", fontSize: 8, fontWeight: 600 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3ecf6e", animation: "pulse 1.5s infinite" }} />
                    12 online
                  </div>
                </div>
                <div style={{
                  height: 140, borderRadius: 9,
                  background: "linear-gradient(160deg,#070910,#080b10,#050709)",
                  position: "relative", overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}>
                  {[30, 55, 78].map(p => (
                    <div key={p} style={{ position:"absolute", height:1, background:"rgba(180,100,255,0.2)", left:0, right:0, top:`${p}%` }} />
                  ))}
                  {[35, 60].map(p => (
                    <div key={p} style={{ position:"absolute", width:1, background:"rgba(180,100,255,0.2)", top:0, bottom:0, left:`${p}%` }} />
                  ))}
                  <div style={{ position:"absolute", height:1.5, background:"rgba(180,100,255,0.4)", left:0, right:0, top:"50%" }} />
                  <div style={{ position:"absolute", width:1.5, background:"rgba(180,100,255,0.4)", top:0, bottom:0, left:"50%" }} />
                  {[
                    { t:28, l:38, c:"#3ecf6e" }, { t:45, l:55, c:"#3ecf6e" }, { t:60, l:42, c:"#FF6B00" },
                    { t:35, l:62, c:"#FF6B00"  }, { t:65, l:58, c:"#FF6B00" }, { t:22, l:30, c:"rgba(144,128,176,0.4)" },
                    { t:70, l:25, c:"rgba(144,128,176,0.4)" }, { t:50, l:70, c:"#3ecf6e" },
                  ].map((d, i) => (
                    <div key={i} style={{
                      position: "absolute", top:`${d.t}%`, left:`${d.l}%`,
                      width: 8, height: 8, borderRadius: "50%",
                      background: d.c, border: "1.5px solid rgba(255,255,255,0.6)",
                      boxShadow: `0 0 5px ${d.c}`,
                      transform: "translate(-50%,-50%)",
                    }} />
                  ))}
                  <div style={{
                    position: "absolute", bottom: 5, right: 6,
                    background: "rgba(6,5,10,0.85)", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 6, padding: "3px 7px",
                    fontSize: 7, color: "rgba(144,128,176,0.6)",
                  }}>Phước An, Krông Pắc</div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 7 }}>
                  {[
                    { c:"#3ecf6e",                  l:"Rảnh (5)"      },
                    { c:"#FF6B00",                  l:"Đang giao (4)" },
                    { c:"rgba(144,128,176,0.4)",    l:"Nghỉ (3)"      },
                  ].map(l => (
                    <div key={l.l} style={{ display:"flex", alignItems:"center", gap:3 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:l.c }} />
                      <span style={{ color:"rgba(144,128,176,0.5)", fontSize:7 }}>{l.l}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Orders table */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 13, padding: "11px 13px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                  <div style={{ color: "rgba(144,128,176,0.8)", fontSize: 10, fontWeight: 600 }}>🔔 Đơn hàng gần đây</div>
                  <a href="/admin/orders" style={{ color: "#FF8C00", fontSize: 8, textDecoration: "none" }}>Xem tất cả →</a>
                </div>
                {/* Table header */}
                <div style={{
                  display: "grid", gridTemplateColumns: "70px 1fr 80px 65px 60px",
                  gap: 6, padding: "5px 8px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4,
                }}>
                  {["Mã đơn","Khách hàng","Cửa hàng","Tổng tiền","Trạng thái"].map(h => (
                    <div key={h} style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
                  ))}
                </div>
                {/* Rows */}
                {ORDERS.map((o) => {
                  const s = STATUS_MAP[o.status]
                  return (
                    <div key={o.id} className="order-row" style={{
                      display: "grid", gridTemplateColumns: "70px 1fr 80px 65px 60px",
                      gap: 6, padding: "7px 8px",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      borderRadius: 7, cursor: "pointer", transition: "background 0.15s",
                    }}>
                      <div style={{ color: "#b464ff", fontSize: 9, fontWeight: 600 }}>#{o.id}</div>
                      <div style={{ color: "#f0eaff", fontSize: 9, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.customer}</div>
                      <div style={{ color: "rgba(144,128,176,0.7)", fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.shop}</div>
                      <div style={{ color: "#FF8C00", fontSize: 9, fontWeight: 700 }}>{fmt(o.amount)}</div>
                      <div>
                        <span style={{
                          fontSize: 7, fontWeight: 700, padding: "2px 6px",
                          borderRadius: 4, border: `1px solid ${s.border}`,
                          background: s.bg, color: s.color,
                          whiteSpace: "nowrap",
                        }}>{s.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick actions */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 13, padding: "11px 14px",
            }}>
              <div style={{ color: "rgba(144,128,176,0.8)", fontSize: 10, fontWeight: 600, marginBottom: 10 }}>⚡ Thao tác nhanh</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: "✅ Duyệt tài xế mới",     c: "#3ecf6e", bg: "rgba(62,207,110,0.1)",  bd: "rgba(62,207,110,0.25)", badge: "2" },
                  { label: "🏪 Duyệt cửa hàng",        c: "#FF8C00", bg: "rgba(255,107,0,0.1)",   bd: "rgba(255,107,0,0.25)",  badge: "1" },
                  { label: "⚖️ Xử lý khiếu nại",       c: "#ff4040", bg: "rgba(255,64,64,0.1)",   bd: "rgba(255,64,64,0.25)",  badge: "3" },
                  { label: "📣 Gửi thông báo",          c: "#b464ff", bg: "rgba(180,100,255,0.1)", bd: "rgba(180,100,255,0.25)",badge: ""  },
                  { label: "💰 Giải ngân",              c: "#f5c542", bg: "rgba(245,197,66,0.1)",  bd: "rgba(245,197,66,0.25)", badge: ""  },
                  { label: "⚙️ Cài đặt hệ thống",      c: "rgba(144,128,176,0.7)", bg: "rgba(255,255,255,0.04)", bd: "rgba(255,255,255,0.08)", badge: "" },
                ].map((a, i) => (
                  <button key={i} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 12px", borderRadius: 9,
                    background: a.bg, border: `1px solid ${a.bd}`,
                    color: a.c, fontSize: 10, fontWeight: 500,
                    cursor: "pointer", fontFamily: "Lexend",
                    position: "relative",
                    transition: "all 0.15s",
                  }}>
                    {a.label}
                    {a.badge && (
                      <span style={{
                        background: "#ff4040", color: "#fff",
                        borderRadius: "50%", width: 14, height: 14,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 8, fontWeight: 700,
                      }}>{a.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
