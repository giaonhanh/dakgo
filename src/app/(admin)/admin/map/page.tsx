"use client"

import { useState } from "react"

const NAV_ITEMS = [
  { icon: "🏠",  label: "Dashboard",    href: "/admin",               active: false },
  { icon: "🏍️", label: "Tài xế",        href: "/admin/drivers",       active: false },
  { icon: "🏪",  label: "Cửa hàng",      href: "/admin/merchants",     active: false },
  { icon: "📦",  label: "Đơn hàng",      href: "/admin/orders",        active: false },
  { icon: "👥",  label: "Khách hàng",    href: "/admin/users",         active: false },
  { icon: "💰",  label: "Tài chính",     href: "/admin/finance",       active: false },
  { icon: "🗺️", label: "Bản đồ live",   href: "/admin/map",           active: true  },
  { icon: "🏷️", label: "Khuyến mãi",    href: "/admin/promotions",    active: false },
  { icon: "⚖️",  label: "Tranh chấp",    href: "/admin/disputes",      active: false },
  { icon: "📣",  label: "Thông báo",     href: "/admin/notifications", active: false },
  { icon: "⚙️",  label: "Cài đặt",       href: "/admin/settings",      active: false },
]

const ONLINE_DRIVERS = [
  { id:"D003", name:"Lê Văn Cường",  vehicle:"Honda Air Blade", lat:12.652, lng:108.508, status:"busy",   order:"GN2851", icon:"🟠" },
  { id:"D004", name:"Phạm Thị Dung", vehicle:"Suzuki Raider",   lat:12.658, lng:108.514, status:"busy",   order:"GN2850", icon:"🟠" },
  { id:"D006", name:"Trần Văn Bình", vehicle:"Honda Wave",       lat:12.645, lng:108.502, status:"online", order:null,     icon:"🟢" },
  { id:"D007", name:"Vũ Thị Hoa",    vehicle:"Yamaha Sirius",    lat:12.661, lng:108.521, status:"online", order:null,     icon:"🟢" },
]

const ACTIVE_ORDERS = [
  { id:"GN2851", status:"delivering", shop:"Bún Bò Huế Ngon",  customer:"Nguyễn Thị A", driver:"Lê Văn Cường",  eta:"~5 phút" },
  { id:"GN2850", status:"preparing",  shop:"Cơm Tấm Sài Gòn",  customer:"Lê Văn B",     driver:"Phạm Thị Dung", eta:"~12 phút" },
  { id:"GN2853", status:"pending",    shop:"Bánh Mì Thanh Nga", customer:"Vũ Văn F",     driver:null,            eta:"Chờ tài xế" },
]

// Fake marker positions (percentage on a 600x400 canvas)
const MARKERS = [
  { type:"driver", name:"Lê Văn Cường",  x:42, y:55, color:"#FF8C00", busy:true  },
  { type:"driver", name:"Phạm Thị Dung", x:62, y:38, color:"#FF8C00", busy:true  },
  { type:"driver", name:"Trần Văn Bình", x:25, y:70, color:"#3ecf6e", busy:false },
  { type:"driver", name:"Vũ Thị Hoa",    x:78, y:30, color:"#3ecf6e", busy:false },
  { type:"shop",   name:"Bún Bò Huế",    x:50, y:45, color:"#4a8ff5", busy:false },
  { type:"shop",   name:"Cơm Tấm",       x:60, y:60, color:"#4a8ff5", busy:false },
  { type:"shop",   name:"KFC Phước",     x:35, y:35, color:"#4a8ff5", busy:false },
]

export default function AdminMapPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [layer, setLayer] = useState<"all"|"drivers"|"orders">("all")
  const [selected, setSelected] = useState<typeof ONLINE_DRIVERS[0]|null>(null)

  const onlineCount  = ONLINE_DRIVERS.length
  const busyCount    = ONLINE_DRIVERS.filter(d=>d.status==="busy").length
  const freeCount    = onlineCount - busyCount
  const activeOrders = ACTIVE_ORDERS.length

  return (
    <>
      <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #06050a; font-family: 'Lexend', sans-serif; height: 100%; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,107,0,0.3); border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
        @keyframes radarPulse { 0%{opacity:.7;transform:scale(.3)} 100%{opacity:0;transform:scale(1)} }
        .driver-row:hover { background: rgba(255,255,255,0.05) !important; cursor:pointer; }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; }
        .map-marker:hover { transform:scale(1.3) !important; }
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
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div>
                <div style={{ color:"#f0eaff", fontSize:16, fontWeight:800 }}>🗺️ Bản đồ live</div>
                <div style={{ color:"#6a5a40", fontSize:10 }}>Phước An, Krông Pắc, Đắk Lắk</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:8, background:"rgba(62,207,110,0.1)", border:"1px solid rgba(62,207,110,0.2)" }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#3ecf6e", display:"inline-block", animation:"pulse 2s infinite" }} />
                <span style={{ color:"#3ecf6e", fontSize:10, fontWeight:700 }}>LIVE</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {(["all","drivers","orders"] as const).map(l => (
                <button key={l} onClick={() => setLayer(l)} style={{ padding:"6px 14px", borderRadius:8, background: layer===l ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: layer===l ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: layer===l ? "#FF8C00" : "#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend", fontWeight: layer===l ? 700 : 400 }}>
                  {l==="all"?"Tất cả":l==="drivers"?"Tài xế":"Đơn hàng"}
                </button>
              ))}
            </div>
          </div>

          {/* Map + Panel */}
          <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

            {/* Map area */}
            <div style={{ flex:1, position:"relative", background:"#0a0d12", overflow:"hidden" }}>

              {/* Grid overlay (fake map tiles) */}
              <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(255,107,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,0,0.03) 1px, transparent 1px)", backgroundSize:"60px 60px", pointerEvents:"none" }} />
              <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize:"20px 20px", pointerEvents:"none" }} />

              {/* Road lines (decorative) */}
              <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
                <line x1="0%" y1="55%" x2="100%" y2="55%" stroke="rgba(255,107,0,0.08)" strokeWidth="3" />
                <line x1="40%" y1="0%" x2="40%" y2="100%" stroke="rgba(255,107,0,0.08)" strokeWidth="3" />
                <line x1="0%" y1="30%" x2="100%" y2="60%" stroke="rgba(255,107,0,0.05)" strokeWidth="2" />
                <line x1="20%" y1="0%" x2="80%" y2="100%" stroke="rgba(255,107,0,0.05)" strokeWidth="2" />
                <circle cx="40%" cy="55%" r="4" fill="rgba(255,107,0,0.3)" />
                <circle cx="40%" cy="55%" r="12" fill="none" stroke="rgba(255,107,0,0.2)" strokeWidth="1" />
              </svg>

              {/* Markers */}
              {MARKERS.map((m, i) => (
                <div key={i} className="map-marker" title={m.name} style={{
                  position:"absolute", left:`${m.x}%`, top:`${m.y}%`, transform:"translate(-50%,-50%)",
                  zIndex:10, cursor:"pointer", transition:"transform 0.2s",
                }}>
                  {m.type === "driver" ? (
                    <div style={{ position:"relative" }}>
                      {m.busy && (
                        <div style={{ position:"absolute", inset:-8, borderRadius:"50%", border:`2px solid ${m.color}`, opacity:0, animation:"radarPulse 2s infinite" }} />
                      )}
                      <div style={{ width:32, height:32, borderRadius:"50%", background:`rgba(${m.color==="#FF8C00"?"255,140,0":"62,207,110"},0.2)`, border:`2px solid ${m.color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, boxShadow:`0 0 12px ${m.color}40` }}>
                        🛵
                      </div>
                    </div>
                  ) : (
                    <div style={{ width:28, height:28, borderRadius:8, background:"rgba(74,143,245,0.2)", border:"2px solid #4a8ff5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, boxShadow:"0 0 10px rgba(74,143,245,0.3)" }}>
                      🏪
                    </div>
                  )}
                </div>
              ))}

              {/* Map label */}
              <div style={{ position:"absolute", bottom:16, left:16, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)", borderRadius:10, padding:"8px 14px", border:"1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ color:"#6a5a40", fontSize:9, marginBottom:4 }}>Phước An · Krông Pắc · Đắk Lắk</div>
                <div style={{ display:"flex", gap:12 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:4, color:"#FF8C00", fontSize:10 }}>🛵 {onlineCount} tài xế online</span>
                  <span style={{ display:"flex", alignItems:"center", gap:4, color:"#4a8ff5", fontSize:10 }}>🏪 7 quán mở cửa</span>
                </div>
              </div>

              {/* Zoom controls */}
              <div style={{ position:"absolute", top:16, right:16, display:"flex", flexDirection:"column", gap:4 }}>
                {["+","−","⌖"].map(b => (
                  <button key={b} style={{ width:32, height:32, borderRadius:8, background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.08)", color:"#f0eaff", fontSize:16, cursor:"pointer", backdropFilter:"blur(8px)" }}>{b}</button>
                ))}
              </div>
            </div>

            {/* Right panel */}
            <div style={{ width:300, borderLeft:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

              {/* Stats */}
              <div style={{ padding:"14px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, flexShrink:0 }}>
                {[
                  { label:"Online",       value:onlineCount,  color:"#3ecf6e" },
                  { label:"Đang giao",    value:busyCount,    color:"#FF8C00" },
                  { label:"Rảnh",         value:freeCount,    color:"#4a8ff5" },
                  { label:"Đơn active",   value:activeOrders, color:"#b464ff" },
                ].map(s => (
                  <div key={s.label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                    <div style={{ color:s.color, fontSize:22, fontWeight:800 }}>{s.value}</div>
                    <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Driver list */}
              <div style={{ padding:"10px 14px 6px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
                <div style={{ color:"#f0eaff", fontSize:11, fontWeight:700 }}>Tài xế online</div>
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"6px 8px" }}>
                {ONLINE_DRIVERS.map(d => (
                  <div key={d.id} className="driver-row" onClick={() => setSelected(selected?.id===d.id ? null : d)} style={{ padding:"10px", borderRadius:10, marginBottom:4, background: selected?.id===d.id ? "rgba(255,107,0,0.08)" : "transparent", border: selected?.id===d.id ? "1px solid rgba(255,107,0,0.25)" : "1px solid transparent", transition:"all 0.15s" }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:"rgba(255,107,0,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, position:"relative", flexShrink:0 }}>
                        🛵
                        <span style={{ position:"absolute", bottom:-2, right:-2, width:10, height:10, borderRadius:"50%", background: d.status==="busy" ? "#FF8C00" : "#3ecf6e", border:"2px solid #06050a" }} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{d.name}</div>
                        <div style={{ color:"#6a5a40", fontSize:9 }}>{d.vehicle}</div>
                      </div>
                      <span style={{ padding:"2px 8px", borderRadius:6, background: d.status==="busy" ? "rgba(255,140,0,0.1)" : "rgba(62,207,110,0.1)", color: d.status==="busy" ? "#FF8C00" : "#3ecf6e", fontSize:9, fontWeight:700, whiteSpace:"nowrap" }}>
                        {d.status==="busy" ? "Đang giao" : "Rảnh"}
                      </span>
                    </div>
                    {d.order && (
                      <div style={{ marginTop:6, padding:"4px 8px", borderRadius:7, background:"rgba(255,107,0,0.06)", border:"1px solid rgba(255,107,0,0.15)" }}>
                        <span style={{ color:"#FF8C00", fontSize:9 }}>📦 Đơn #{d.order}</span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Active orders */}
                <div style={{ padding:"6px 2px 4px", marginTop:8, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color:"#f0eaff", fontSize:11, fontWeight:700, marginBottom:8 }}>Đơn đang xử lý</div>
                  {ACTIVE_ORDERS.map(o => (
                    <div key={o.id} style={{ padding:"10px", borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", marginBottom:6 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ color:"#FF8C00", fontSize:11, fontWeight:700 }}>#{o.id}</span>
                        <span style={{ color:"#6a5a40", fontSize:9 }}>{o.eta}</span>
                      </div>
                      <div style={{ color:"#b0956a", fontSize:9, marginBottom:2 }}>🏪 {o.shop}</div>
                      <div style={{ color:"#6a5a40", fontSize:9 }}>👤 {o.customer}</div>
                      {o.driver && <div style={{ color:"#6a5a40", fontSize:9 }}>🛵 {o.driver}</div>}
                      {!o.driver && <div style={{ color:"#ff4040", fontSize:9 }}>⏳ Chưa có tài xế</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
