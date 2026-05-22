"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"

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

interface DriverMarker {
  id: string; name: string; vehicle: string
  lat: number; lng: number
  status: "online" | "busy"; order: string | null
}

interface ShopMarker {
  id: string; name: string; lat: number; lng: number; isOpen: boolean
}

interface ActiveOrder {
  id: string; status: string; shop: string; customer: string; driver: string | null; eta: string
}

const ONLINE_DRIVERS: DriverMarker[] = [
  { id:"D003", name:"Lê Văn Cường",  vehicle:"Honda Air Blade", lat:12.6521, lng:108.5063, status:"busy",   order:"GN2851" },
  { id:"D004", name:"Phạm Thị Dung", vehicle:"Suzuki Raider",   lat:12.6558, lng:108.5112, status:"busy",   order:"GN2850" },
  { id:"D006", name:"Trần Văn Bình", vehicle:"Honda Wave",       lat:12.6485, lng:108.5020, status:"online", order:null     },
  { id:"D007", name:"Vũ Thị Hoa",    vehicle:"Yamaha Sirius",    lat:12.6601, lng:108.5175, status:"online", order:null     },
]

const SHOPS: ShopMarker[] = [
  { id:"S001", name:"Bún Bò Huế Ngon",   lat:12.6530, lng:108.5080, isOpen:true  },
  { id:"S002", name:"Cơm Tấm Sài Gòn",   lat:12.6495, lng:108.5050, isOpen:true  },
  { id:"S003", name:"Bánh Mì Thanh Nga",  lat:12.6570, lng:108.5130, isOpen:true  },
  { id:"S004", name:"Gà Rán KFC Mini",    lat:12.6510, lng:108.5095, isOpen:true  },
  { id:"S005", name:"Quán Cà Phê Nhớ",   lat:12.6545, lng:108.5145, isOpen:false },
]

const ACTIVE_ORDERS: ActiveOrder[] = [
  { id:"GN2851", status:"delivering", shop:"Bún Bò Huế Ngon",  customer:"Nguyễn Thị A", driver:"Lê Văn Cường",  eta:"~5 phút"    },
  { id:"GN2850", status:"preparing",  shop:"Cơm Tấm Sài Gòn",  customer:"Lê Văn B",     driver:"Phạm Thị Dung", eta:"~12 phút"   },
  { id:"GN2853", status:"pending",    shop:"Bánh Mì Thanh Nga", customer:"Vũ Văn F",     driver:null,            eta:"Chờ tài xế" },
  { id:"GN2855", status:"accepted",   shop:"Gà Rán KFC Mini",   customer:"Trần Thị C",   driver:"Vũ Thị Hoa",   eta:"~18 phút"  },
]

const STATUS_CFG: Record<string, { label:string; color:string; bg:string }> = {
  pending:    { label:"Chờ tài xế", color:"#ff4040", bg:"rgba(255,64,64,0.1)"   },
  accepted:   { label:"Đã nhận",    color:"#FFB347", bg:"rgba(255,179,71,0.1)"  },
  preparing:  { label:"Đang nấu",   color:"#4a8ff5", bg:"rgba(74,143,245,0.1)"  },
  delivering: { label:"Đang giao",  color:"#FF8C00", bg:"rgba(255,140,0,0.1)"   },
}

// ─── Leaflet map component (no-SSR) ─────────────────────────────────────────
interface AdminMapClientProps {
  drivers: DriverMarker[]
  shops: ShopMarker[]
  selected: DriverMarker | null
  onSelect: (d: DriverMarker | null) => void
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("leaflet/dist/leaflet.css")

function AdminMapClientInner({ drivers, shops, selected, onSelect }: AdminMapClientProps) {
  const divRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (!divRef.current) return
    let mounted = true

    const init = async () => {
      const L = (await import("leaflet")).default
      if (!mounted || !divRef.current) return
      if (mapRef.current) return

      const map = L.map(divRef.current, {
        center: [12.6521, 108.5073], zoom: 14,
        zoomControl: false, attributionControl: false,
      })
      mapRef.current = map

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map)

      L.control.zoom({ position: "topright" }).addTo(map)

      // Shop markers
      shops.forEach(s => {
        const icon = L.divIcon({
          html: `<div style="
            width:28px;height:28px;border-radius:8px;
            background:rgba(74,143,245,0.9);
            border:2px solid ${s.isOpen ? "#4a8ff5" : "rgba(255,255,255,0.3)"};
            display:flex;align-items:center;justify-content:center;
            font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.5);
            opacity:${s.isOpen ? 1 : 0.5};
          ">🏪</div>`,
          className: "", iconSize: [28, 28], iconAnchor: [14, 14],
        })
        const marker = L.marker([s.lat, s.lng], { icon })
        marker.addTo(map)
        marker.bindPopup(`<div style="font-family:Lexend,sans-serif;font-size:12px;color:#333">
          <b>${s.name}</b><br>
          <span style="color:${s.isOpen ? "#3ecf6e" : "#ff4040"}">${s.isOpen ? "● Đang mở" : "● Đã đóng"}</span>
        </div>`, { closeButton: false })
      })

      // Driver markers
      drivers.forEach(d => {
        const isBusy = d.status === "busy"
        const pulse = isBusy
          ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid #FF6B00;animation:radarPulse 1.8s infinite;"></div>`
          : ""
        const icon = L.divIcon({
          html: `<div style="position:relative">
            ${pulse}
            <div style="
              width:34px;height:34px;border-radius:50%;
              background:${isBusy ? "rgba(255,107,0,0.25)" : "rgba(62,207,110,0.2)"};
              border:2.5px solid ${isBusy ? "#FF6B00" : "#3ecf6e"};
              display:flex;align-items:center;justify-content:center;
              font-size:17px;box-shadow:0 0 12px ${isBusy ? "rgba(255,107,0,0.5)" : "rgba(62,207,110,0.4)"};
            ">🛵</div>
          </div>`,
          className: "", iconSize: [34, 34], iconAnchor: [17, 17],
        })
        const marker = L.marker([d.lat, d.lng], { icon })
        marker.addTo(map)
        marker.bindPopup(`<div style="font-family:Lexend,sans-serif;font-size:12px;">
          <b>${d.name}</b><br>
          <span style="color:#888">${d.vehicle}</span><br>
          <span style="color:${isBusy ? "#FF6B00" : "#3ecf6e"}">${isBusy ? "● Đang giao" : "● Rảnh"}</span>
          ${d.order ? `<br><span style="color:#FF6B00">Đơn #${d.order}</span>` : ""}
        </div>`, { closeButton: false })
        marker.on("click", () => onSelect(d))
        markersRef.current.push(marker)
      })
    }

    init()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pan to selected driver
  useEffect(() => {
    if (!mapRef.current || !selected) return
    mapRef.current.flyTo([selected.lat, selected.lng], 16, { duration: 1 })
  }, [selected])

  return (
    <>
      <style>{`
        @keyframes radarPulse { 0%{opacity:.8;transform:scale(.3)} 100%{opacity:0;transform:scale(1.4)} }
        .leaflet-popup-content-wrapper { background:#1a1520 !important; border:1px solid rgba(255,255,255,0.1); border-radius:10px !important; box-shadow:0 4px 20px rgba(0,0,0,0.5) !important; }
        .leaflet-popup-tip { background:#1a1520 !important; }
        .leaflet-popup-content { color:#f0eaff !important; margin:10px 14px !important; }
      `}</style>
      <div ref={divRef} style={{ width:"100%", height:"100%", background:"#0a0d12" }} />
    </>
  )
}

const AdminMapClient = dynamic(
  () => Promise.resolve(AdminMapClientInner),
  { ssr: false, loading: () => (
    <div style={{ width:"100%", height:"100%", background:"#0a0d12", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <div style={{ width:32, height:32, border:"3px solid rgba(255,107,0,0.2)", borderTop:"3px solid #FF6B00", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <div style={{ color:"#6a5a40", fontSize:11 }}>Đang tải bản đồ...</div>
    </div>
  )}
)

// ─── Main page ───────────────────────────────────────────────────────────────
export default function AdminMapPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [layer, setLayer] = useState<"all"|"drivers"|"orders">("all")
  const [selected, setSelected] = useState<DriverMarker | null>(null)
  const [tick, setTick] = useState(0)

  // Simulate real-time driver position updates
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(iv)
  }, [])

  const onlineCount  = ONLINE_DRIVERS.length
  const busyCount    = ONLINE_DRIVERS.filter(d => d.status === "busy").length
  const freeCount    = onlineCount - busyCount
  const pendingCount = ACTIVE_ORDERS.filter(o => o.status === "pending").length

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #06050a; font-family: 'Lexend', sans-serif; height: 100%; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,107,0,0.3); border-radius: 2px; }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .driver-row:hover { background: rgba(255,255,255,0.05) !important; cursor:pointer; }
        .order-row:hover  { background: rgba(255,255,255,0.04) !important; }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; }
      `}</style>

      <div style={{ display:"flex", height:"100vh", background:"#06050a", color:"#f0eaff", overflow:"hidden" }}>

        {/* SIDEBAR */}
        <div style={{ width: sidebarOpen ? 220 : 60, flexShrink:0, background:"rgba(10,9,18,0.98)", backdropFilter:"blur(20px)", borderRight:"1px solid rgba(255,107,0,0.12)", display:"flex", flexDirection:"column", transition:"width 0.25s ease", overflow:"hidden", zIndex:50 }}>
          <div style={{ height:60, display:"flex", alignItems:"center", padding:"0 14px", borderBottom:"1px solid rgba(255,255,255,0.06)", gap:10, flexShrink:0 }}>
            <div style={{ width:32, height:32, borderRadius:10, flexShrink:0, background:"linear-gradient(135deg,#FF6B00,#FF8C00,#FFB347)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, boxShadow:"0 0 12px rgba(255,107,0,0.4)" }}>🚀</div>
            {sidebarOpen && <div><div style={{ color:"#f8f0e0", fontSize:13, fontWeight:800 }}>GiaoNhanh</div><span style={{ fontSize:8, fontWeight:700, padding:"1px 6px", background:"rgba(180,100,255,0.15)", border:"1px solid rgba(180,100,255,0.3)", borderRadius:4, color:"#b464ff" }}>ADMIN</span></div>}
          </div>
          <nav style={{ flex:1, padding:"8px", overflowY:"auto" }}>
            {NAV_ITEMS.map(item => (
              <a key={item.href} href={item.href} className="sidebar-link" style={{ display:"flex", alignItems:"center", gap:10, height:40, borderRadius:10, padding:`0 ${sidebarOpen?10:0}px`, marginBottom:2, justifyContent:sidebarOpen?"flex-start":"center", textDecoration:"none", background: item.active?"rgba(255,107,0,0.12)":"transparent", borderLeft: item.active?"2px solid #FF6B00":"2px solid transparent", color: item.active?"#FF8C00":"#6a5a40", fontSize:11, fontWeight: item.active?700:400, transition:"all 0.2s" }}>
                <span style={{ fontSize:17, flexShrink:0 }}>{item.icon}</span>
                {sidebarOpen && <span style={{ whiteSpace:"nowrap" }}>{item.label}</span>}
              </a>
            ))}
          </nav>
          <button onClick={() => setSidebarOpen(p => !p)} style={{ margin:"8px", height:36, borderRadius:10, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", color:"#6a5a40", fontSize:14, cursor:"pointer", fontFamily:"Lexend" }}>
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* MAIN */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Topbar */}
          <div style={{ height:60, borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div>
                <div style={{ color:"#f0eaff", fontSize:14, fontWeight:800 }}>🗺️ Bản đồ tài xế live</div>
                <div style={{ color:"#6a5a40", fontSize:9 }}>Phước An · Krông Pắc · Đắk Lắk · OSM</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:8, background:"rgba(62,207,110,0.1)", border:"1px solid rgba(62,207,110,0.2)" }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background:"#3ecf6e", display:"inline-block", animation:"pulse 2s infinite", boxShadow:"0 0 5px #3ecf6e" }} />
                <span style={{ color:"#3ecf6e", fontSize:10, fontWeight:700 }}>LIVE · cập nhật 5s</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {(["all","drivers","orders"] as const).map(l => (
                <button key={l} onClick={() => setLayer(l)} style={{ padding:"6px 14px", borderRadius:8, background: layer===l?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)", border: layer===l?"1px solid rgba(255,107,0,0.35)":"1px solid rgba(255,255,255,0.08)", color: layer===l?"#FF8C00":"#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend", fontWeight: layer===l?700:400 }}>
                  {l==="all"?"Tất cả":l==="drivers"?"Tài xế":"Đơn hàng"}
                </button>
              ))}
            </div>
          </div>

          {/* Map + Right panel */}
          <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

            {/* Map */}
            <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
              <AdminMapClient
                drivers={ONLINE_DRIVERS}
                shops={SHOPS}
                selected={selected}
                onSelect={setSelected}
              />

              {/* Overlay stats */}
              <div style={{ position:"absolute", top:12, left:12, zIndex:1000, display:"flex", flexDirection:"column", gap:8, animation:"fadeUp 0.4s ease" }}>
                <div style={{ background:"rgba(6,5,10,0.88)", backdropFilter:"blur(12px)", borderRadius:12, padding:"10px 14px", border:"1px solid rgba(255,255,255,0.08)", display:"flex", gap:16 }}>
                  {[
                    { v:onlineCount, label:"Online",    c:"#3ecf6e" },
                    { v:busyCount,   label:"Đang giao", c:"#FF8C00" },
                    { v:freeCount,   label:"Rảnh",      c:"#4a8ff5" },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign:"center" }}>
                      <div style={{ color:s.c, fontSize:18, fontWeight:800, lineHeight:1 }}>{s.v}</div>
                      <div style={{ color:"#6a5a40", fontSize:8, marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {pendingCount > 0 && (
                  <div style={{ background:"rgba(255,64,64,0.15)", backdropFilter:"blur(12px)", borderRadius:10, padding:"7px 12px", border:"1px solid rgba(255,64,64,0.3)" }}>
                    <div style={{ color:"#ff4040", fontSize:10, fontWeight:700 }}>⚠️ {pendingCount} đơn chưa có tài xế</div>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div style={{ position:"absolute", bottom:12, left:12, zIndex:1000, background:"rgba(6,5,10,0.88)", backdropFilter:"blur(12px)", borderRadius:10, padding:"9px 14px", border:"1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display:"flex", gap:14 }}>
                  {[
                    { icon:"🛵", label:"Đang giao", color:"#FF6B00" },
                    { icon:"🛵", label:"Rảnh",      color:"#3ecf6e" },
                    { icon:"🏪", label:"Cửa hàng",  color:"#4a8ff5" },
                  ].map(l => (
                    <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ fontSize:12 }}>{l.icon}</span>
                      <span style={{ color:l.color, fontSize:9 }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right panel */}
            <div style={{ width:300, borderLeft:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", overflow:"hidden", background:"rgba(10,9,18,0.6)" }}>

              {/* Driver list header */}
              <div style={{ padding:"12px 14px 8px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
                <div style={{ color:"#f0eaff", fontSize:11, fontWeight:700, marginBottom:2 }}>Tài xế online ({onlineCount})</div>
                <div style={{ color:"#6a5a40", fontSize:9 }}>Nhấn để xem vị trí trên bản đồ</div>
              </div>

              {/* Driver list */}
              <div style={{ maxHeight:220, overflowY:"auto", padding:"6px 8px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                {ONLINE_DRIVERS.map(d => (
                  <div key={d.id} className="driver-row" onClick={() => setSelected(selected?.id===d.id ? null : d)}
                    style={{ padding:"9px 10px", borderRadius:10, marginBottom:3, background: selected?.id===d.id ? "rgba(255,107,0,0.1)" : "transparent", border: selected?.id===d.id ? "1px solid rgba(255,107,0,0.25)" : "1px solid transparent", transition:"all 0.15s" }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <div style={{ width:34, height:34, borderRadius:10, background:"rgba(255,107,0,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, position:"relative", flexShrink:0 }}>
                        🛵
                        <span style={{ position:"absolute", bottom:-2, right:-2, width:9, height:9, borderRadius:"50%", background: d.status==="busy"?"#FF8C00":"#3ecf6e", border:"2px solid #06050a" }} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{d.name}</div>
                        <div style={{ color:"#6a5a40", fontSize:9 }}>{d.vehicle}</div>
                      </div>
                      <span style={{ padding:"2px 7px", borderRadius:6, background: d.status==="busy"?"rgba(255,140,0,0.1)":"rgba(62,207,110,0.1)", color: d.status==="busy"?"#FF8C00":"#3ecf6e", fontSize:9, fontWeight:700, whiteSpace:"nowrap" }}>
                        {d.status==="busy" ? "Giao" : "Rảnh"}
                      </span>
                    </div>
                    {d.order && (
                      <div style={{ marginTop:5, padding:"3px 8px", borderRadius:6, background:"rgba(255,107,0,0.06)", border:"1px solid rgba(255,107,0,0.15)" }}>
                        <span style={{ color:"#FF8C00", fontSize:9 }}>📦 Đơn #{d.order}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Active orders */}
              <div style={{ padding:"10px 14px 6px", flexShrink:0 }}>
                <div style={{ color:"#f0eaff", fontSize:11, fontWeight:700 }}>Đơn đang xử lý ({ACTIVE_ORDERS.length})</div>
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"4px 8px" }}>
                {ACTIVE_ORDERS.map(o => {
                  const sc = STATUS_CFG[o.status] ?? STATUS_CFG["pending"]
                  return (
                    <div key={o.id} className="order-row" style={{ padding:"10px", borderRadius:10, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", marginBottom:6, transition:"background 0.15s" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <span style={{ color:"#FF8C00", fontSize:11, fontWeight:700 }}>#{o.id}</span>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ padding:"2px 7px", borderRadius:5, background:sc.bg, color:sc.color, fontSize:9, fontWeight:700 }}>{sc.label}</span>
                          <span style={{ color:"#6a5a40", fontSize:9 }}>{o.eta}</span>
                        </div>
                      </div>
                      <div style={{ color:"#b0956a", fontSize:9, marginBottom:2 }}>🏪 {o.shop}</div>
                      <div style={{ color:"#6a5a40", fontSize:9, marginBottom:2 }}>👤 {o.customer}</div>
                      {o.driver
                        ? <div style={{ color:"#3ecf6e", fontSize:9 }}>🛵 {o.driver}</div>
                        : <div style={{ color:"#ff4040", fontSize:9, fontWeight:700 }}>⚠️ Chưa có tài xế</div>
                      }
                    </div>
                  )
                })}
              </div>

              {/* Shops summary */}
              <div style={{ padding:"10px 14px", borderTop:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
                <div style={{ color:"#f0eaff", fontSize:11, fontWeight:700, marginBottom:8 }}>🏪 Cửa hàng ({SHOPS.filter(s=>s.isOpen).length} đang mở)</div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {SHOPS.slice(0,4).map(s => (
                    <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ color:"#b0956a", fontSize:9, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:170 }}>{s.name}</span>
                      <span style={{ fontSize:7, fontWeight:700, padding:"2px 6px", borderRadius:4, background: s.isOpen?"rgba(62,207,110,0.1)":"rgba(255,64,64,0.08)", color: s.isOpen?"#3ecf6e":"#ff4040" }}>
                        {s.isOpen?"● Mở":"● Đóng"}
                      </span>
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
