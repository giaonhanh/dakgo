"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const NAV_ITEMS = [
  { icon: "🏠",  label: "Dashboard",    href: "/admin",               active: false },
  { icon: "🏍️", label: "Tài xế",        href: "/admin/drivers",       active: false },
  { icon: "🏪",  label: "Cửa hàng",      href: "/admin/merchants",     active: false },
  { icon: "📦",  label: "Đơn hàng",      href: "/admin/orders",        active: false },
  { icon: "👥",  label: "Khách hàng",    href: "/admin/users",         active: false },
  { icon: "💰",  label: "Tài chính",     href: "/admin/finance",       active: false },
  { icon: "🗺️", label: "Bản đồ live",   href: "/admin/map",           active: false },
  { icon: "🏷️", label: "Khuyến mãi",    href: "/admin/promotions",    active: false },
  { icon: "⚖️",  label: "Tranh chấp",    href: "/admin/disputes",      active: true  },
  { icon: "📣",  label: "Thông báo",     href: "/admin/notifications", active: false },
  { icon: "⚙️",  label: "Cài đặt",       href: "/admin/settings",      active: false },
]

type DisputeStatus = "open" | "investigating" | "resolved" | "escalated"
type DisputeType   = "missing_item" | "wrong_order" | "late_delivery" | "overcharge" | "driver_behavior" | "food_quality"

interface Dispute {
  id: string; orderId: string; type: DisputeType; status: DisputeStatus
  customer: string; customerPhone: string; merchant: string; driver: string | null
  amount: number; description: string; createdAt: string; updatedAt: string
  resolution?: string; refundAmount?: number
  timeline: { time: string; action: string; by: string }[]
}

const DISPUTES: Dispute[] = [
  {
    id:"TC001", orderId:"GN2841", type:"missing_item", status:"open",
    customer:"Nguyễn Thị An", customerPhone:"0901234567", merchant:"Bún Bò Huế Ngon", driver:"Trần Văn Bình",
    amount:220000, description:"Thiếu 1 bát bún bò, đã thanh toán đủ nhưng không nhận đủ đồ",
    createdAt:"17/05/2025 14:32", updatedAt:"17/05/2025 14:32",
    timeline:[{ time:"14:32", action:"Khách hàng gửi khiếu nại", by:"Nguyễn Thị An" }]
  },
  {
    id:"TC002", orderId:"GN2835", type:"late_delivery", status:"investigating",
    customer:"Lê Văn Bình", customerPhone:"0912345678", merchant:"Cơm Tấm Sài Gòn", driver:"Phạm Thị Dung",
    amount:85000, description:"Giao hàng trễ 45 phút so với dự kiến, đồ ăn đã nguội",
    createdAt:"17/05/2025 12:10", updatedAt:"17/05/2025 13:45",
    timeline:[
      { time:"12:10", action:"Khách hàng gửi khiếu nại", by:"Lê Văn Bình" },
      { time:"13:45", action:"Admin đang điều tra", by:"Admin Hệ thống" },
    ]
  },
  {
    id:"TC003", orderId:"GN2828", type:"overcharge", status:"resolved",
    customer:"Phạm Thị Cúc", customerPhone:"0923456789", merchant:"Gà Rán KFC Phước", driver:"Lê Văn Cường",
    amount:115000, description:"Bị tính thêm phí giao hàng ngoài hợp đồng",
    createdAt:"16/05/2025 10:20", updatedAt:"16/05/2025 16:30",
    resolution:"Xác nhận tính phí sai. Hoàn tiền 15.000đ cho khách.", refundAmount:15000,
    timeline:[
      { time:"10:20", action:"Khách hàng gửi khiếu nại", by:"Phạm Thị Cúc" },
      { time:"11:05", action:"Admin điều tra", by:"Admin Hệ thống" },
      { time:"16:30", action:"Giải quyết — hoàn 15.000đ", by:"Admin Hệ thống" },
    ]
  },
  {
    id:"TC004", orderId:"GN2820", type:"driver_behavior", status:"escalated",
    customer:"Hoàng Văn Dũng", customerPhone:"0934567890", merchant:"Quán Cà Phê Nhớ", driver:"Nguyễn Văn An",
    amount:45000, description:"Tài xế thái độ không tốt, nói tục với khách hàng",
    createdAt:"15/05/2025 09:15", updatedAt:"17/05/2025 08:00",
    timeline:[
      { time:"09:15", action:"Khách hàng gửi khiếu nại", by:"Hoàng Văn Dũng" },
      { time:"10:30", action:"Gửi cảnh cáo tài xế", by:"Admin Hệ thống" },
      { time:"08:00", action:"Leo thang — cần xem xét đình chỉ", by:"Admin Hệ thống" },
    ]
  },
  {
    id:"TC005", orderId:"GN2815", type:"wrong_order", status:"resolved",
    customer:"Trần Thị Hoa", customerPhone:"0945678901", merchant:"Bánh Mì Thanh Nga", driver:"Vũ Thanh Long",
    amount:30000, description:"Nhận sai loại bánh mì, đặt đặc biệt nhận được thường",
    createdAt:"15/05/2025 16:40", updatedAt:"15/05/2025 18:20",
    resolution:"Quán nhận lỗi, hoàn 100% tiền đơn hàng.", refundAmount:30000,
    timeline:[
      { time:"16:40", action:"Khách hàng gửi khiếu nại", by:"Trần Thị Hoa" },
      { time:"17:15", action:"Liên hệ cửa hàng xác nhận", by:"Admin Hệ thống" },
      { time:"18:20", action:"Giải quyết — hoàn 100%", by:"Admin Hệ thống" },
    ]
  },
]

const TYPE_CFG: Record<DisputeType, { label:string; icon:string; color:string }> = {
  missing_item:     { label:"Thiếu hàng",      icon:"📦", color:"#FF8C00" },
  wrong_order:      { label:"Sai đơn",          icon:"❌", color:"#ff4040" },
  late_delivery:    { label:"Giao trễ",          icon:"⏰", color:"#FFB347" },
  overcharge:       { label:"Tính sai phí",      icon:"💸", color:"#b464ff" },
  driver_behavior:  { label:"Thái độ tài xế",   icon:"🛵", color:"#ff4040" },
  food_quality:     { label:"Chất lượng đồ ăn", icon:"🍴", color:"#4a8ff5" },
}

const STATUS_CFG: Record<DisputeStatus, { label:string; color:string; bg:string }> = {
  open:          { label:"Mới gửi",     color:"#FFB347", bg:"rgba(255,179,71,0.1)" },
  investigating: { label:"Đang xét",    color:"#4a8ff5", bg:"rgba(74,143,245,0.1)" },
  resolved:      { label:"Đã giải quyết",color:"#3ecf6e", bg:"rgba(62,207,110,0.1)" },
  escalated:     { label:"Leo thang",   color:"#ff4040", bg:"rgba(255,64,64,0.1)" },
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function AdminDisputesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [filter, setFilter] = useState<"all"|DisputeStatus>("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Dispute|null>(null)

  const shown = DISPUTES
    .filter(d => filter==="all" || d.status===filter)
    .filter(d => !search || d.id.includes(search.toUpperCase()) || d.customer.toLowerCase().includes(search.toLowerCase()) || d.orderId.includes(search.toUpperCase()))

  const counts = {
    open:          DISPUTES.filter(d=>d.status==="open").length,
    investigating: DISPUTES.filter(d=>d.status==="investigating").length,
    resolved:      DISPUTES.filter(d=>d.status==="resolved").length,
    escalated:     DISPUTES.filter(d=>d.status==="escalated").length,
  }
  const totalRefund = DISPUTES.filter(d=>d.refundAmount).reduce((s,d)=>s+(d.refundAmount??0), 0)

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
        .dispute-row:hover { background: rgba(255,255,255,0.04) !important; }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; }
        input { font-family: 'Lexend', sans-serif; outline: none; }
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
              <div style={{ color:"#f0eaff", fontSize:16, fontWeight:800 }}>⚖️ Tranh chấp</div>
              <div style={{ color:"#6a5a40", fontSize:10 }}>Khiếu nại · Hoàn tiền · Xử lý sự cố</div>
            </div>
            {counts.open > 0 && (
              <div style={{ padding:"6px 16px", borderRadius:8, background:"rgba(255,179,71,0.1)", border:"1px solid rgba(255,179,71,0.25)", color:"#FFB347", fontSize:12, fontWeight:700 }}>
                ⚠️ {counts.open} khiếu nại mới cần xử lý
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

            {/* KPI */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:20 }}>
              {[
                { label:"Mới gửi",        value:counts.open,          icon:"📨", color:"#FFB347" },
                { label:"Đang điều tra",  value:counts.investigating,  icon:"🔍", color:"#4a8ff5" },
                { label:"Leo thang",      value:counts.escalated,      icon:"🚨", color:"#ff4040" },
                { label:"Đã giải quyết", value:counts.resolved,       icon:"✅", color:"#3ecf6e" },
                { label:"Tổng hoàn tiền", value:fmt(totalRefund),      icon:"💸", color:"#FF8C00" },
              ].map((k, i) => (
                <div key={k.label} className="kpi-card" style={{ animationDelay:`${i*0.06}s`, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                  <div style={{ fontSize:24, marginBottom:10 }}>{k.icon}</div>
                  <div style={{ color:k.color, fontSize:typeof k.value==="number"?22:14, fontWeight:800, marginBottom:4 }}>{k.value}</div>
                  <div style={{ color:"#6a5a40", fontSize:10 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center" }}>
              <div style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"8px 14px", display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ color:"#6a5a40" }}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã TC, khách hàng, đơn hàng..." style={{ flex:1, background:"none", border:"none", color:"#f0eaff", fontSize:12 }} />
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {(["all","open","investigating","escalated","resolved"] as const).map(f => (
                  <button key={f} onClick={()=>setFilter(f)} style={{ padding:"7px 12px", borderRadius:8, background: filter===f ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: filter===f ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: filter===f ? "#FF8C00" : "#6a5a40", fontSize:10, cursor:"pointer", fontFamily:"Lexend", fontWeight: filter===f ? 700 : 400 }}>
                    {f==="all"?"Tất cả":STATUS_CFG[f as DisputeStatus]?.label ?? f}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"80px 90px 120px 1.4fr 120px 100px 110px 110px", padding:"10px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                {["Mã TC","Đơn hàng","Loại","Mô tả","Khách hàng","Số tiền","Trạng thái","Ngày gửi"].map(h => (
                  <span key={h} style={{ color:"#6a5a40", fontSize:10, fontWeight:600 }}>{h}</span>
                ))}
              </div>
              {shown.map(d => {
                const tc = TYPE_CFG[d.type]
                const sc = STATUS_CFG[d.status]
                return (
                  <div key={d.id} className="dispute-row" onClick={() => setSelected(d)} style={{ display:"grid", gridTemplateColumns:"80px 90px 120px 1.4fr 120px 100px 110px 110px", padding:"13px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)", alignItems:"center", cursor:"pointer", transition:"background 0.15s" }}>
                    <span style={{ color:"#FF8C00", fontSize:11, fontWeight:800 }}>{d.id}</span>
                    <span style={{ color:"#4a8ff5", fontSize:11, fontWeight:600 }}>#{d.orderId}</span>
                    <span style={{ padding:"2px 8px", borderRadius:6, background:`${tc.color}18`, color:tc.color, fontSize:9, fontWeight:700, width:"fit-content" }}>{tc.icon} {tc.label}</span>
                    <span style={{ color:"#b0956a", fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={d.description}>{d.description}</span>
                    <span style={{ color:"#f0eaff", fontSize:11, fontWeight:500 }}>{d.customer}</span>
                    <span style={{ color:"#f0eaff", fontSize:11 }}>{fmt(d.amount)}</span>
                    <span style={{ padding:"3px 10px", borderRadius:7, background:sc.bg, color:sc.color, fontSize:9, fontWeight:700, width:"fit-content" }}>{sc.label}</span>
                    <span style={{ color:"#6a5a40", fontSize:9 }}>{d.createdAt}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Detail drawer */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={() => setSelected(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, backdropFilter:"blur(4px)" }} />
              <motion.div initial={{ x:"100%" }} animate={{ x:0 }} exit={{ x:"100%" }} transition={{ type:"spring", damping:24, stiffness:300 }} style={{ position:"fixed", top:0, right:0, bottom:0, width:400, background:"#0d0b12", borderLeft:"1px solid rgba(255,107,0,0.15)", zIndex:101, display:"flex", flexDirection:"column", overflow:"hidden" }}>

                {/* Header */}
                <div style={{ padding:"18px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                      <span style={{ color:"#FF8C00", fontSize:14, fontWeight:800 }}>{selected.id}</span>
                      <span style={{ padding:"2px 8px", borderRadius:6, background:STATUS_CFG[selected.status].bg, color:STATUS_CFG[selected.status].color, fontSize:9, fontWeight:700 }}>{STATUS_CFG[selected.status].label}</span>
                    </div>
                    <div style={{ color:"#6a5a40", fontSize:10 }}>Đơn #{selected.orderId} · {selected.createdAt}</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"none", color:"#6a5a40", fontSize:16, cursor:"pointer" }}>×</button>
                </div>

                <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>

                  {/* Type badge */}
                  <div style={{ padding:"12px", background:`${TYPE_CFG[selected.type].color}10`, border:`1px solid ${TYPE_CFG[selected.type].color}30`, borderRadius:10, marginBottom:14 }}>
                    <div style={{ color:TYPE_CFG[selected.type].color, fontSize:12, fontWeight:700, marginBottom:4 }}>
                      {TYPE_CFG[selected.type].icon} {TYPE_CFG[selected.type].label}
                    </div>
                    <div style={{ color:"#b0956a", fontSize:11 }}>{selected.description}</div>
                  </div>

                  {/* Parties */}
                  {[
                    ["👤 Khách hàng",  selected.customer],
                    ["📞 Số điện thoại", selected.customerPhone],
                    ["🏪 Cửa hàng",   selected.merchant],
                    ["🛵 Tài xế",      selected.driver ?? "Không liên quan"],
                    ["💰 Giá trị đơn", fmt(selected.amount)],
                  ].map(([k,v]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ color:"#6a5a40", fontSize:11 }}>{k}</span>
                      <span style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{v}</span>
                    </div>
                  ))}

                  {/* Resolution */}
                  {selected.resolution && (
                    <div style={{ marginTop:14, padding:"12px", background:"rgba(62,207,110,0.06)", border:"1px solid rgba(62,207,110,0.2)", borderRadius:10 }}>
                      <div style={{ color:"#3ecf6e", fontSize:11, fontWeight:700, marginBottom:4 }}>✅ Kết quả giải quyết</div>
                      <div style={{ color:"#b0956a", fontSize:11, marginBottom:6 }}>{selected.resolution}</div>
                      {selected.refundAmount && (
                        <div style={{ color:"#3ecf6e", fontSize:13, fontWeight:800 }}>Hoàn tiền: {fmt(selected.refundAmount)}</div>
                      )}
                    </div>
                  )}

                  {/* Timeline */}
                  <div style={{ marginTop:16 }}>
                    <div style={{ color:"#f0eaff", fontSize:11, fontWeight:700, marginBottom:12 }}>Lịch sử xử lý</div>
                    {selected.timeline.map((t, i) => (
                      <div key={i} style={{ display:"flex", gap:12, marginBottom:12 }}>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:"#FF8C00", flexShrink:0, marginTop:3 }} />
                          {i < selected.timeline.length-1 && <div style={{ width:1, flex:1, background:"rgba(255,107,0,0.2)", marginTop:4 }} />}
                        </div>
                        <div style={{ paddingBottom: i < selected.timeline.length-1 ? 8 : 0 }}>
                          <div style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{t.action}</div>
                          <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>{t.time} · {t.by}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {selected.status !== "resolved" && (
                  <div style={{ padding:"16px 20px", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", gap:8, flexDirection:"column" }}>
                    {selected.status === "open" && (
                      <button style={{ height:38, borderRadius:10, background:"rgba(74,143,245,0.1)", border:"1px solid rgba(74,143,245,0.25)", color:"#4a8ff5", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                        🔍 Bắt đầu điều tra
                      </button>
                    )}
                    <div style={{ display:"flex", gap:8 }}>
                      <button style={{ flex:1, height:38, borderRadius:10, background:"rgba(62,207,110,0.1)", border:"1px solid rgba(62,207,110,0.25)", color:"#3ecf6e", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                        ✅ Giải quyết
                      </button>
                      <button style={{ flex:1, height:38, borderRadius:10, background:"rgba(255,64,64,0.08)", border:"1px solid rgba(255,64,64,0.2)", color:"#ff4040", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                        🚨 Leo thang
                      </button>
                    </div>
                    <button style={{ height:38, borderRadius:10, background:"rgba(255,107,0,0.08)", border:"1px solid rgba(255,107,0,0.2)", color:"#FF8C00", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                      💸 Hoàn tiền cho khách
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
