"use client"

import { useState } from "react"

const NAV_ITEMS = [
  { icon: "🏠",  label: "Dashboard",    href: "/admin",               active: false },
  { icon: "🏍️", label: "Tài xế",        href: "/admin/drivers",       active: false },
  { icon: "🏪",  label: "Cửa hàng",      href: "/admin/merchants",     active: false },
  { icon: "📦",  label: "Đơn hàng",      href: "/admin/orders",        active: false },
  { icon: "👥",  label: "Khách hàng",    href: "/admin/users",         active: false },
  { icon: "💰",  label: "Tài chính",     href: "/admin/finance",       active: false },
  { icon: "🗺️", label: "Bản đồ live",   href: "/admin/map",           active: false },
  { icon: "🏷️", label: "Khuyến mãi",    href: "/admin/promotions",    active: false },
  { icon: "⚖️",  label: "Tranh chấp",    href: "/admin/disputes",      active: false },
  { icon: "📣",  label: "Thông báo",     href: "/admin/notifications", active: true  },
  { icon: "⚙️",  label: "Cài đặt",       href: "/admin/settings",      active: false },
]

type Audience = "all" | "customers" | "drivers" | "merchants"
type NotifStatus = "sent" | "scheduled" | "draft"

interface SentNotif {
  id: string; title: string; body: string; audience: Audience
  status: NotifStatus; sent: number; opened: number; sentAt: string; scheduledAt?: string
}

const SENT_NOTIFS: SentNotif[] = [
  { id:"N001", title:"⚡ Flash Sale cuối tuần!",          body:"Giảm đến 30% tất cả đơn hàng từ 6h-10h sáng T7 CN. Đặt ngay!",              audience:"customers", status:"sent",      sent:892, opened:634, sentAt:"16/05/2025 18:00" },
  { id:"N002", title:"🛵 Có đơn hàng mới chờ bạn",       body:"Đơn #GN2851 cần tài xế giao đến 22 Lê Hồng Phong. Khu vực 2km.",           audience:"drivers",   status:"sent",      sent:12,  opened:10,  sentAt:"17/05/2025 15:30" },
  { id:"N003", title:"🏪 Cập nhật chính sách hoa hồng",  body:"Từ 01/06/2025 tỉ lệ hoa hồng sẽ điều chỉnh. Vui lòng xem chi tiết.",       audience:"merchants", status:"sent",      sent:8,   opened:8,   sentAt:"15/05/2025 10:00" },
  { id:"N004", title:"🎁 Voucher sinh nhật cho bạn!",     body:"Chúc mừng sinh nhật! Sử dụng BDAY30 để giảm 30% đơn hàng hôm nay.",        audience:"customers", status:"scheduled", sent:0,   opened:0,   sentAt:"", scheduledAt:"18/05/2025 08:00" },
  { id:"N005", title:"📊 Thống kê tháng 4 của bạn",      body:"Cửa hàng của bạn đạt 125 đơn, doanh thu 18.5tr tháng vừa rồi. Xem báo cáo.", audience:"merchants", status:"draft",    sent:0,   opened:0,   sentAt:"" },
]

const AUDIENCE_CFG: Record<Audience, { label:string; icon:string; color:string; count:number }> = {
  all:       { label:"Tất cả",     icon:"👥", color:"#f0eaff", count:1234 },
  customers: { label:"Khách hàng", icon:"🧑", color:"#4a8ff5", count:892  },
  drivers:   { label:"Tài xế",     icon:"🛵", color:"#FF8C00", count:12   },
  merchants: { label:"Cửa hàng",   icon:"🏪", color:"#3ecf6e", count:8    },
}

const STATUS_CFG: Record<NotifStatus, { label:string; color:string; bg:string }> = {
  sent:      { label:"Đã gửi",     color:"#3ecf6e", bg:"rgba(62,207,110,0.1)" },
  scheduled: { label:"Đã lên lịch",color:"#4a8ff5", bg:"rgba(74,143,245,0.1)" },
  draft:     { label:"Nháp",       color:"#6a5a40", bg:"rgba(255,255,255,0.06)" },
}

export default function AdminNotificationsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [audience, setAudience] = useState<Audience>("all")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all"|NotifStatus>("all")
  const [preview, setPreview] = useState(false)

  const shown = SENT_NOTIFS.filter(n => filterStatus==="all" || n.status===filterStatus)

  const totalSent   = SENT_NOTIFS.filter(n=>n.status==="sent").reduce((s,n)=>s+n.sent, 0)
  const totalOpened = SENT_NOTIFS.filter(n=>n.status==="sent").reduce((s,n)=>s+n.opened, 0)
  const openRate    = totalSent ? Math.round((totalOpened/totalSent)*100) : 0

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
        .notif-row:hover { background: rgba(255,255,255,0.04) !important; }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; }
        input, textarea, select { font-family: 'Lexend', sans-serif; outline: none; }
        textarea { resize: none; }
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
          <div style={{ height:56, borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", padding:"0 24px", flexShrink:0 }}>
            <div>
              <div style={{ color:"#f0eaff", fontSize:16, fontWeight:800 }}>📣 Thông báo</div>
              <div style={{ color:"#6a5a40", fontSize:10 }}>Push notification · Broadcast · Lên lịch gửi</div>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex:1, display:"grid", gridTemplateColumns:"420px 1fr", overflow:"hidden" }}>

            {/* Compose panel */}
            <div style={{ borderRight:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div style={{ padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>Soạn thông báo mới</div>
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>

                {/* KPI */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
                  {[
                    { label:"Đã gửi tháng này", value:totalSent },
                    { label:"Đã mở",             value:totalOpened },
                    { label:"Tỉ lệ mở",          value:`${openRate}%` },
                  ].map((k, i) => (
                    <div key={k.label} className="kpi-card" style={{ animationDelay:`${i*0.06}s`, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"12px" }}>
                      <div style={{ color:"#FF8C00", fontSize:18, fontWeight:800 }}>{k.value}</div>
                      <div style={{ color:"#6a5a40", fontSize:9, marginTop:3 }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* Audience */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ color:"#6a5a40", fontSize:10, marginBottom:8 }}>Đối tượng nhận</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                    {(Object.entries(AUDIENCE_CFG) as [Audience, typeof AUDIENCE_CFG[Audience]][]).map(([key, cfg]) => (
                      <button key={key} onClick={() => setAudience(key)} style={{ height:48, borderRadius:10, background: audience===key ? `${cfg.color}18` : "rgba(255,255,255,0.03)", border: audience===key ? `1px solid ${cfg.color}40` : "1px solid rgba(255,255,255,0.07)", color: audience===key ? cfg.color : "#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend", fontWeight: audience===key ? 700 : 400, display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"all 0.15s" }}>
                        <span style={{ fontSize:16 }}>{cfg.icon}</span>
                        <div style={{ textAlign:"left" }}>
                          <div style={{ fontSize:11 }}>{cfg.label}</div>
                          <div style={{ fontSize:9, opacity:0.7 }}>{cfg.count} người</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Tiêu đề (max 50 ký tự)</div>
                  <input value={title} onChange={e=>setTitle(e.target.value.slice(0,50))} placeholder="⚡ Flash Sale cuối tuần!" style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                  <div style={{ textAlign:"right", color:"#6a5a40", fontSize:9, marginTop:3 }}>{title.length}/50</div>
                </div>

                {/* Body */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Nội dung (max 200 ký tự)</div>
                  <textarea value={body} onChange={e=>setBody(e.target.value.slice(0,200))} placeholder="Nhập nội dung thông báo..." rows={4} style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                  <div style={{ textAlign:"right", color:"#6a5a40", fontSize:9, marginTop:3 }}>{body.length}/200</div>
                </div>

                {/* Schedule */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Lên lịch gửi (để trống = gửi ngay)</div>
                  <input type="datetime-local" value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)} style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12, colorScheme:"dark" }} />
                </div>

                {/* Preview */}
                {(title || body) && (
                  <div style={{ padding:"12px", background:"rgba(255,255,255,0.04)", borderRadius:12, border:"1px solid rgba(255,255,255,0.08)", marginBottom:14 }}>
                    <div style={{ color:"#6a5a40", fontSize:9, marginBottom:8 }}>Preview thông báo</div>
                    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#FF6B00,#FFB347)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🚀</div>
                      <div>
                        <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700, marginBottom:2 }}>{title || "Tiêu đề..."}</div>
                        <div style={{ color:"#b0956a", fontSize:10 }}>{body || "Nội dung thông báo..."}</div>
                        <div style={{ color:"#6a5a40", fontSize:9, marginTop:4 }}>Giao Nhanh · vừa xong</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Send buttons */}
                <div style={{ display:"flex", gap:8 }}>
                  <button style={{ flex:1, height:42, borderRadius:11, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#6a5a40", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                    💾 Lưu nháp
                  </button>
                  <button onClick={() => { setTitle(""); setBody(""); setScheduleTime("") }} style={{ flex:2, height:42, borderRadius:11, background:"linear-gradient(90deg,#FF6B00,#FF8C00)", border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                    {scheduleTime ? "🕐 Lên lịch gửi" : "📣 Gửi ngay"} → {AUDIENCE_CFG[audience].count} người
                  </button>
                </div>
              </div>
            </div>

            {/* History */}
            <div style={{ display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div style={{ padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>Lịch sử thông báo</div>
                <div style={{ display:"flex", gap:6 }}>
                  {(["all","sent","scheduled","draft"] as const).map(f => (
                    <button key={f} onClick={()=>setFilterStatus(f)} style={{ padding:"5px 12px", borderRadius:7, background: filterStatus===f ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: filterStatus===f ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: filterStatus===f ? "#FF8C00" : "#6a5a40", fontSize:10, cursor:"pointer", fontFamily:"Lexend", fontWeight: filterStatus===f ? 700 : 400 }}>
                      {f==="all"?"Tất cả":STATUS_CFG[f as NotifStatus]?.label ?? f}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"12px 20px" }}>
                {shown.map(n => {
                  const sc = STATUS_CFG[n.status]
                  const ac = AUDIENCE_CFG[n.audience]
                  const openRate = n.sent ? Math.round((n.opened/n.sent)*100) : 0
                  return (
                    <div key={n.id} className="notif-row" style={{ padding:"14px", borderRadius:12, marginBottom:8, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", transition:"background 0.15s" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                        <div style={{ flex:1, marginRight:12 }}>
                          <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700, marginBottom:2 }}>{n.title}</div>
                          <div style={{ color:"#6a5a40", fontSize:10 }}>{n.body}</div>
                        </div>
                        <span style={{ padding:"2px 8px", borderRadius:6, background:sc.bg, color:sc.color, fontSize:9, fontWeight:700, whiteSpace:"nowrap" }}>{sc.label}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ display:"flex", gap:12 }}>
                          <span style={{ color:ac.color, fontSize:10 }}>{ac.icon} {ac.label}</span>
                          {n.status === "sent" && (
                            <>
                              <span style={{ color:"#6a5a40", fontSize:10 }}>📤 {n.sent} gửi</span>
                              <span style={{ color:"#3ecf6e", fontSize:10 }}>📖 {openRate}% mở</span>
                            </>
                          )}
                          {n.scheduledAt && (
                            <span style={{ color:"#4a8ff5", fontSize:10 }}>🕐 {n.scheduledAt}</span>
                          )}
                        </div>
                        <span style={{ color:"#6a5a40", fontSize:9 }}>{n.sentAt || (n.scheduledAt ? `Lên lịch: ${n.scheduledAt}` : "Nháp")}</span>
                      </div>
                      {n.status === "sent" && n.sent > 0 && (
                        <div style={{ marginTop:8, height:3, borderRadius:2, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${openRate}%`, background:"linear-gradient(90deg,#FF6B00,#3ecf6e)", borderRadius:2 }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
