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
  { icon: "🏷️", label: "Khuyến mãi",    href: "/admin/promotions",    active: true  },
  { icon: "⚖️",  label: "Tranh chấp",    href: "/admin/disputes",      active: false },
  { icon: "📣",  label: "Thông báo",     href: "/admin/notifications", active: false },
  { icon: "⚙️",  label: "Cài đặt",       href: "/admin/settings",      active: false },
]

type VoucherType = "percent" | "fixed" | "freeship"
type VoucherStatus = "active" | "expired" | "scheduled"

interface Voucher {
  id: string; code: string; title: string; type: VoucherType; value: number
  minOrder: number; maxDiscount: number | null; used: number; limit: number | null
  validFrom: string; validTo: string; status: VoucherStatus; shopId: string | null
  totalDiscount: number
}

const VOUCHERS: Voucher[] = [
  { id:"V001", code:"GIAONHANH10", title:"Giảm 10% đơn đầu tiên",       type:"percent",  value:10,    minOrder:50000,  maxDiscount:30000,  used:124, limit:500,  validFrom:"01/05/2025", validTo:"31/05/2025", status:"active",    shopId:null,   totalDiscount:2480000 },
  { id:"V002", code:"FREESHIP5K",  title:"Miễn phí ship 5km",            type:"freeship", value:15000, minOrder:30000,  maxDiscount:null,   used:89,  limit:200,  validFrom:"10/05/2025", validTo:"20/05/2025", status:"active",    shopId:null,   totalDiscount:1335000 },
  { id:"V003", code:"BUNBO20K",    title:"Giảm 20k tại Bún Bò Huế Ngon", type:"fixed",    value:20000, minOrder:80000,  maxDiscount:null,   used:32,  limit:100,  validFrom:"05/05/2025", validTo:"15/05/2025", status:"expired",   shopId:"S001", totalDiscount:640000  },
  { id:"V004", code:"WELCOME50",   title:"Giảm 50k cho thành viên mới",   type:"fixed",    value:50000, minOrder:100000, maxDiscount:null,   used:7,   limit:50,   validFrom:"15/05/2025", validTo:"30/05/2025", status:"active",    shopId:null,   totalDiscount:350000  },
  { id:"V005", code:"FLASH30",     title:"Flash sale cuối tuần -30%",     type:"percent",  value:30,    minOrder:70000,  maxDiscount:50000,  used:0,   limit:300,  validFrom:"18/05/2025", validTo:"19/05/2025", status:"scheduled", shopId:null,   totalDiscount:0       },
  { id:"V006", code:"GANNHA15",    title:"Giảm 15% quán gần nhà",         type:"percent",  value:15,    minOrder:40000,  maxDiscount:25000,  used:56,  limit:null, validFrom:"01/05/2025", validTo:"31/05/2025", status:"active",    shopId:null,   totalDiscount:980000  },
]

const TYPE_CFG: Record<VoucherType, { label:string; color:string; bg:string; icon:string }> = {
  percent:  { label:"% Giảm giá",  color:"#FF8C00", bg:"rgba(255,140,0,0.1)",   icon:"%" },
  fixed:    { label:"Giảm cố định", color:"#4a8ff5", bg:"rgba(74,143,245,0.1)", icon:"₫" },
  freeship: { label:"Miễn phí ship",color:"#3ecf6e", bg:"rgba(62,207,110,0.1)", icon:"🚀" },
}

const STATUS_CFG: Record<VoucherStatus, { label:string; color:string; bg:string }> = {
  active:    { label:"Đang chạy",    color:"#3ecf6e", bg:"rgba(62,207,110,0.1)" },
  expired:   { label:"Hết hạn",      color:"#6a5a40", bg:"rgba(255,255,255,0.06)" },
  scheduled: { label:"Chờ kích hoạt",color:"#FFB347", bg:"rgba(255,179,71,0.1)" },
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

const TIER_LABELS: Record<string, string> = {
  bronze:"Đồng 🥉", silver:"Bạc 🥈", gold:"Vàng 🥇", platinum:"Bạch Kim 💎"
}

interface LoyaltyReward {
  id: string; title: string; icon: string
  type: VoucherType; value: number
  pointCost: number; stock: number; redeemed: number
  minTier: "bronze" | "silver" | "gold" | "platinum"
  isActive: boolean
}

const REWARDS: LoyaltyReward[] = [
  { id:"LR001", title:"Freeship đơn tiếp theo",    icon:"🚀", type:"freeship", value:15000, pointCost:200,  stock:50, redeemed:12, minTier:"bronze",   isActive:true  },
  { id:"LR002", title:"Giảm 20k đơn từ 100k",     icon:"💳", type:"fixed",    value:20000, pointCost:300,  stock:30, redeemed:8,  minTier:"silver",   isActive:true  },
  { id:"LR003", title:"Giảm 10% tối đa 30k",      icon:"%",  type:"percent",  value:10,    pointCost:500,  stock:20, redeemed:3,  minTier:"silver",   isActive:true  },
  { id:"LR004", title:"Giảm 50k đơn từ 200k",     icon:"🎁", type:"fixed",    value:50000, pointCost:800,  stock:10, redeemed:1,  minTier:"gold",     isActive:true  },
  { id:"LR005", title:"Freeship 1 tuần liên tục",  icon:"🎯", type:"freeship", value:15000, pointCost:2000, stock:5,  redeemed:0,  minTier:"platinum", isActive:false },
]

export default function AdminPromotionsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [filter, setFilter] = useState<"all"|VoucherStatus>("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Voucher|null>(null)
  const [showCreate,       setShowCreate]       = useState(false)
  const [pageTab,          setPageTab]          = useState<"voucher"|"rewards">("voucher")
  const [showCreateReward, setShowCreateReward] = useState(false)
  const [rewardForm,       setRewardForm]       = useState({ title:"", icon:"🎁", type:"freeship" as VoucherType, value:"", pointCost:"", stock:"", minTier:"bronze" as LoyaltyReward["minTier"] })

  // Create form state
  const [form, setForm] = useState({ code:"", title:"", type:"percent" as VoucherType, value:"", minOrder:"", maxDiscount:"", limit:"", validFrom:"", validTo:"" })

  const shown = VOUCHERS
    .filter(v => filter==="all" || v.status===filter)
    .filter(v => !search || v.code.includes(search.toUpperCase()) || v.title.toLowerCase().includes(search.toLowerCase()))

  const totalDiscount = VOUCHERS.filter(v=>v.status==="active").reduce((s,v)=>s+v.totalDiscount, 0)
  const activeCount   = VOUCHERS.filter(v=>v.status==="active").length
  const usedToday     = 47

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
        .voucher-row:hover { background: rgba(255,255,255,0.04) !important; }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; }
        input, select, textarea { font-family: 'Lexend', sans-serif; outline: none; }
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
              <div style={{ color:"#f0eaff", fontSize:16, fontWeight:800 }}>🏷️ Khuyến mãi</div>
              <div style={{ color:"#6a5a40", fontSize:10 }}>Quản lý voucher · Mã giảm giá · Flash sale</div>
            </div>
            <button
              onClick={() => pageTab === "voucher" ? setShowCreate(true) : setShowCreateReward(true)}
              style={{ padding:"8px 20px", borderRadius:10, background:"linear-gradient(90deg,#FF6B00,#FF8C00)", border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
              {pageTab === "voucher" ? "+ Tạo voucher mới" : "+ Tạo phần thưởng"}
            </button>
          </div>

          {/* Content */}
          <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

            {/* Tabs */}
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {(["voucher","rewards"] as const).map(tab => (
                <button key={tab} onClick={() => setPageTab(tab)}
                  style={{ padding:"8px 20px", borderRadius:10, cursor:"pointer", fontFamily:"Lexend", fontSize:12,
                    background: pageTab===tab ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                    border: pageTab===tab ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)",
                    color: pageTab===tab ? "#FF8C00" : "#6a5a40",
                    fontWeight: pageTab===tab ? 700 : 400 }}>
                  {tab === "voucher" ? "🏷️ Voucher Khuyến Mãi" : "🎁 Danh mục Đổi Điểm"}
                </button>
              ))}
            </div>

            {pageTab === "voucher" && (<>

            {/* KPI */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:20 }}>
              {[
                { label:"Tổng voucher",       value:VOUCHERS.length,  icon:"🏷️", delta:"", color:"#f0eaff" },
                { label:"Đang hoạt động",     value:activeCount,      icon:"✅",  delta:"+1 hôm nay", color:"#3ecf6e" },
                { label:"Dùng hôm nay",       value:usedToday,        icon:"📊", delta:"+12%", color:"#4a8ff5" },
                { label:"Chờ kích hoạt",      value:VOUCHERS.filter(v=>v.status==="scheduled").length, icon:"⏰", delta:"", color:"#FFB347" },
                { label:"Tổng giảm giá TT",   value:fmt(totalDiscount), icon:"💸", delta:"tháng này", color:"#FF8C00" },
              ].map((k, i) => (
                <div key={k.label} className="kpi-card" style={{ animationDelay:`${i*0.06}s`, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div style={{ fontSize:24 }}>{k.icon}</div>
                    {k.delta && <span style={{ color:"#6a5a40", fontSize:9 }}>{k.delta}</span>}
                  </div>
                  <div style={{ color:k.color, fontSize:typeof k.value==="number" ? 22 : 14, fontWeight:800, marginBottom:4 }}>{k.value}</div>
                  <div style={{ color:"#6a5a40", fontSize:10 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center" }}>
              <div style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"8px 14px", display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ color:"#6a5a40" }}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã voucher, tên..." style={{ flex:1, background:"none", border:"none", color:"#f0eaff", fontSize:12 }} />
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {(["all","active","scheduled","expired"] as const).map(f => (
                  <button key={f} onClick={()=>setFilter(f)} style={{ padding:"7px 14px", borderRadius:8, background: filter===f ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: filter===f ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: filter===f ? "#FF8C00" : "#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend", fontWeight: filter===f ? 700 : 400 }}>
                    {f==="all"?"Tất cả":STATUS_CFG[f as VoucherStatus]?.label ?? f}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"130px 1.6fr 90px 100px 90px 80px 100px 120px", padding:"10px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                {["Mã voucher","Tên","Loại","Giá trị","Đã dùng","Tỉ lệ","Hạn dùng","Trạng thái"].map(h => (
                  <span key={h} style={{ color:"#6a5a40", fontSize:10, fontWeight:600 }}>{h}</span>
                ))}
              </div>
              {shown.map(v => {
                const tc = TYPE_CFG[v.type]
                const sc = STATUS_CFG[v.status]
                const usageRate = v.limit ? Math.round((v.used/v.limit)*100) : null
                return (
                  <div key={v.id} className="voucher-row" onClick={() => setSelected(v)} style={{ display:"grid", gridTemplateColumns:"130px 1.6fr 90px 100px 90px 80px 100px 120px", padding:"13px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)", alignItems:"center", cursor:"pointer", transition:"background 0.15s" }}>
                    <span style={{ color:"#FF8C00", fontSize:12, fontWeight:800, fontFamily:"monospace" }}>{v.code}</span>
                    <span style={{ color:"#f0eaff", fontSize:11, fontWeight:500 }}>{v.title}</span>
                    <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ padding:"2px 8px", borderRadius:6, background:tc.bg, color:tc.color, fontSize:9, fontWeight:700 }}>{tc.icon} {tc.label}</span>
                    </span>
                    <span style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>
                      {v.type==="percent" ? `–${v.value}%` : fmt(v.value)}
                      {v.maxDiscount && <span style={{ color:"#6a5a40", fontSize:9, display:"block" }}>tối đa {fmt(v.maxDiscount)}</span>}
                    </span>
                    <span style={{ color:"#b0956a", fontSize:12 }}>
                      {v.used}{v.limit ? `/${v.limit}` : ""}
                    </span>
                    <span>
                      {usageRate !== null ? (
                        <div>
                          <div style={{ height:4, borderRadius:2, background:"rgba(255,255,255,0.08)", overflow:"hidden", marginBottom:3 }}>
                            <div style={{ height:"100%", width:`${usageRate}%`, background: usageRate>80 ? "#ff4040" : "#3ecf6e", borderRadius:2 }} />
                          </div>
                          <span style={{ color:"#6a5a40", fontSize:9 }}>{usageRate}%</span>
                        </div>
                      ) : <span style={{ color:"#6a5a40", fontSize:9 }}>Không giới hạn</span>}
                    </span>
                    <span style={{ color:"#6a5a40", fontSize:9 }}>{v.validFrom}<br />→ {v.validTo}</span>
                    <span style={{ padding:"3px 10px", borderRadius:7, background:sc.bg, color:sc.color, fontSize:9, fontWeight:700, width:"fit-content" }}>{sc.label}</span>
                  </div>
                )
              })}
            </div>
            </>)}

            {pageTab === "rewards" && (<>
              {/* KPI — Rewards */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                {[
                  { label:"Tổng phần thưởng",  value:REWARDS.length,                                                  icon:"🎁", color:"#f0eaff" },
                  { label:"Đang hoạt động",     value:REWARDS.filter(r=>r.isActive).length,                           icon:"✅",  color:"#3ecf6e" },
                  { label:"Tổng lượt đổi",      value:REWARDS.reduce((s,r)=>s+r.redeemed,0),                          icon:"🔄",  color:"#4a8ff5" },
                  { label:"Điểm đã tiêu thụ",   value:REWARDS.reduce((s,r)=>s+r.redeemed*r.pointCost,0).toLocaleString("vi-VN"), icon:"⭐", color:"#b464ff" },
                ].map((k,i) => (
                  <div key={k.label} className="kpi-card" style={{ animationDelay:`${i*0.06}s`, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                    <div style={{ fontSize:24, marginBottom:10 }}>{k.icon}</div>
                    <div style={{ color:k.color, fontSize:22, fontWeight:800, marginBottom:4 }}>{k.value}</div>
                    <div style={{ color:"#6a5a40", fontSize:10 }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Info */}
              <div style={{ background:"rgba(180,100,255,0.06)", border:"1px solid rgba(180,100,255,0.15)", borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", gap:12, alignItems:"flex-start" }}>
                <span style={{ fontSize:20 }}>💡</span>
                <div style={{ color:"#6a5a40", fontSize:10, lineHeight:1.7 }}>
                  <strong style={{ color:"#b464ff" }}>Quy tắc:</strong> 100 điểm = 1.000 xu · Khách đổi điểm lấy voucher trong ứng dụng.<br />
                  Voucher đổi điểm tự động tạo code riêng cho từng khách khi đổi thành công.
                </div>
              </div>

              {/* Rewards table */}
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"46px 1.8fr 110px 100px 80px 70px 130px 100px", padding:"10px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  {["","Tên phần thưởng","Ưu đãi","Giá điểm","Tồn kho","Đã đổi","Hạng tối thiểu","Trạng thái"].map((h,hi) => (
                    <span key={hi} style={{ color:"#6a5a40", fontSize:10, fontWeight:600 }}>{h}</span>
                  ))}
                </div>
                {REWARDS.map((r,i) => {
                  const tc = TYPE_CFG[r.type]
                  return (
                    <div key={r.id} className="voucher-row"
                      style={{ display:"grid", gridTemplateColumns:"46px 1.8fr 110px 100px 80px 70px 130px 100px", padding:"13px 20px", borderBottom:i<REWARDS.length-1?"1px solid rgba(255,255,255,0.04)":"none", alignItems:"center", transition:"background 0.15s", cursor:"default" }}>
                      <span style={{ fontSize:22 }}>{r.icon}</span>
                      <span style={{ color:"#f0eaff", fontSize:11, fontWeight:500 }}>{r.title}</span>
                      <span>
                        <span style={{ padding:"2px 8px", borderRadius:6, background:tc.bg, color:tc.color, fontSize:9, fontWeight:700 }}>{tc.icon} {tc.label}</span>
                      </span>
                      <span style={{ color:"#b464ff", fontSize:13, fontWeight:700 }}>
                        {r.pointCost.toLocaleString()}
                        <span style={{ color:"#6a5a40", fontSize:9, fontWeight:400 }}> điểm</span>
                      </span>
                      <span style={{ color:"#b0956a", fontSize:12 }}>
                        {r.stock - r.redeemed}
                        <span style={{ color:"#6a5a40", fontSize:9 }}>/{r.stock}</span>
                      </span>
                      <span style={{ color:"#4a8ff5", fontSize:12, fontWeight:600 }}>{r.redeemed}</span>
                      <span style={{ padding:"2px 9px", borderRadius:6, background:"rgba(180,100,255,0.1)", color:"#b464ff", fontSize:9, fontWeight:700, width:"fit-content" }}>
                        {TIER_LABELS[r.minTier]}
                      </span>
                      <span style={{ display:"flex", gap:6 }}>
                        <span style={{ padding:"3px 9px", borderRadius:7, fontSize:9, fontWeight:700, width:"fit-content",
                          background:r.isActive?"rgba(62,207,110,0.1)":"rgba(255,255,255,0.06)",
                          color:r.isActive?"#3ecf6e":"#6a5a40" }}>
                          {r.isActive ? "✅ Hoạt động" : "⏸ Tắt"}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </>)}

          </div>
        </div>

        {/* Detail drawer */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={() => setSelected(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, backdropFilter:"blur(4px)" }} />
              <motion.div initial={{ x:"100%" }} animate={{ x:0 }} exit={{ x:"100%" }} transition={{ type:"spring", damping:24, stiffness:300 }} style={{ position:"fixed", top:0, right:0, bottom:0, width:380, background:"#0d0b12", borderLeft:"1px solid rgba(255,107,0,0.15)", zIndex:101, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                {/* Header */}
                <div style={{ padding:"20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ color:"#FF8C00", fontSize:18, fontWeight:800, fontFamily:"monospace", marginBottom:4 }}>{selected.code}</div>
                    <div style={{ color:"#f0eaff", fontSize:13, fontWeight:600 }}>{selected.title}</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"none", color:"#6a5a40", fontSize:16, cursor:"pointer" }}>×</button>
                </div>

                <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
                  {/* Stats */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
                    {[
                      { label:"Đã dùng",    value:`${selected.used}${selected.limit?`/${selected.limit}`:""}` },
                      { label:"Tổng giảm",  value:fmt(selected.totalDiscount) },
                      { label:"Min. đơn",   value:fmt(selected.minOrder) },
                    ].map(s => (
                      <div key={s.label} style={{ background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"10px", textAlign:"center" }}>
                        <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>{s.value}</div>
                        <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Info */}
                  {[
                    ["Loại voucher",   TYPE_CFG[selected.type].label],
                    ["Giá trị",        selected.type==="percent" ? `Giảm ${selected.value}%` : fmt(selected.value)],
                    ["Giảm tối đa",    selected.maxDiscount ? fmt(selected.maxDiscount) : "Không giới hạn"],
                    ["Đơn tối thiểu",  fmt(selected.minOrder)],
                    ["Hiệu lực",       `${selected.validFrom} → ${selected.validTo}`],
                    ["Phạm vi",        selected.shopId ? "Riêng cửa hàng" : "Toàn hệ thống"],
                    ["Trạng thái",     STATUS_CFG[selected.status].label],
                  ].map(([k,v]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ color:"#6a5a40", fontSize:11 }}>{k}</span>
                      <span style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{v}</span>
                    </div>
                  ))}

                  {/* Usage bar */}
                  {selected.limit && (
                    <div style={{ marginTop:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ color:"#6a5a40", fontSize:10 }}>Mức sử dụng</span>
                        <span style={{ color:"#f0eaff", fontSize:10 }}>{Math.round((selected.used/selected.limit)*100)}%</span>
                      </div>
                      <div style={{ height:6, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${(selected.used/selected.limit)*100}%`, background:"linear-gradient(90deg,#FF6B00,#FFB347)", borderRadius:3 }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ padding:"16px 20px", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", gap:8 }}>
                  {selected.status === "active" && (
                    <button style={{ flex:1, height:40, borderRadius:10, background:"rgba(255,64,64,0.08)", border:"1px solid rgba(255,64,64,0.2)", color:"#ff4040", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                      ⏹ Dừng voucher
                    </button>
                  )}
                  {selected.status === "scheduled" && (
                    <button style={{ flex:1, height:40, borderRadius:10, background:"rgba(62,207,110,0.1)", border:"1px solid rgba(62,207,110,0.25)", color:"#3ecf6e", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                      ▶ Kích hoạt ngay
                    </button>
                  )}
                  <button style={{ flex:1, height:40, borderRadius:10, background:"rgba(74,143,245,0.1)", border:"1px solid rgba(74,143,245,0.25)", color:"#4a8ff5", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                    ✏️ Chỉnh sửa
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Create modal */}
        <AnimatePresence>
          {showCreate && (
            <>
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={() => setShowCreate(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:100, backdropFilter:"blur(4px)" }} />
              <motion.div initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.92 }} transition={{ type:"spring", damping:24, stiffness:300 }} style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:480, background:"#0d0b12", borderRadius:18, border:"1px solid rgba(255,107,0,0.2)", zIndex:101, overflow:"hidden" }}>
                <div style={{ padding:"20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ color:"#f0eaff", fontSize:15, fontWeight:800 }}>+ Tạo voucher mới</div>
                  <button onClick={() => setShowCreate(false)} style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"none", color:"#6a5a40", fontSize:16, cursor:"pointer" }}>×</button>
                </div>
                <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:12 }}>
                  {[
                    { label:"Mã voucher",  key:"code",      placeholder:"GIAONHANH10" },
                    { label:"Tên voucher", key:"title",     placeholder:"Giảm 10% đơn đầu tiên" },
                    { label:"Giá trị",     key:"value",     placeholder:"10" },
                    { label:"Đơn tối thiểu",key:"minOrder", placeholder:"50000" },
                    { label:"Giới hạn dùng",key:"limit",   placeholder:"500 (để trống = không giới hạn)" },
                    { label:"Từ ngày",     key:"validFrom", placeholder:"dd/mm/yyyy" },
                    { label:"Đến ngày",    key:"validTo",   placeholder:"dd/mm/yyyy" },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ color:"#6a5a40", fontSize:10, marginBottom:4 }}>{f.label}</div>
                      <input value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} placeholder={f.placeholder} style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                    </div>
                  ))}
                  <div>
                    <div style={{ color:"#6a5a40", fontSize:10, marginBottom:4 }}>Loại khuyến mãi</div>
                    <div style={{ display:"flex", gap:8 }}>
                      {(["percent","fixed","freeship"] as VoucherType[]).map(t => (
                        <button key={t} onClick={() => setForm(p=>({...p, type:t}))} style={{ flex:1, height:36, borderRadius:10, background: form.type===t ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: form.type===t ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: form.type===t ? "#FF8C00" : "#6a5a40", fontSize:10, cursor:"pointer", fontFamily:"Lexend", fontWeight: form.type===t ? 700 : 400 }}>
                          {TYPE_CFG[t].icon} {TYPE_CFG[t].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setShowCreate(false)} style={{ width:"100%", height:44, borderRadius:12, background:"linear-gradient(90deg,#FF6B00,#FF8C00)", border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", marginTop:4 }}>
                    🏷️ Tạo voucher
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        {/* Create reward modal */}
        <AnimatePresence>
          {showCreateReward && (
            <>
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={() => setShowCreateReward(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:100, backdropFilter:"blur(4px)" }} />
              <motion.div initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.92 }} transition={{ type:"spring", damping:24, stiffness:300 }}
                style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:500, background:"#0d0b12", borderRadius:18, border:"1px solid rgba(180,100,255,0.22)", zIndex:101, overflow:"hidden" }}>
                <div style={{ padding:"20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ color:"#f0eaff", fontSize:15, fontWeight:800 }}>🎁 Tạo phần thưởng đổi điểm</div>
                    <div style={{ color:"#6a5a40", fontSize:10, marginTop:2 }}>Khách hàng dùng điểm tích lũy để đổi lấy voucher này</div>
                  </div>
                  <button onClick={() => setShowCreateReward(false)} style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"none", color:"#6a5a40", fontSize:16, cursor:"pointer" }}>×</button>
                </div>
                <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:12, maxHeight:"70vh", overflowY:"auto" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 80px", gap:10 }}>
                    <div>
                      <div style={{ color:"#6a5a40", fontSize:10, marginBottom:4 }}>Tên phần thưởng</div>
                      <input value={rewardForm.title} onChange={e => setRewardForm(p=>({...p, title:e.target.value}))} placeholder="Freeship đơn tiếp theo" style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12, fontFamily:"Lexend", outline:"none" }} />
                    </div>
                    <div>
                      <div style={{ color:"#6a5a40", fontSize:10, marginBottom:4 }}>Icon</div>
                      <input value={rewardForm.icon} onChange={e => setRewardForm(p=>({...p, icon:e.target.value}))} placeholder="🎁" style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:20, textAlign:"center", fontFamily:"Lexend", outline:"none" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Loại ưu đãi</div>
                    <div style={{ display:"flex", gap:8 }}>
                      {(["percent","fixed","freeship"] as VoucherType[]).map(t => (
                        <button key={t} onClick={() => setRewardForm(p=>({...p, type:t}))}
                          style={{ flex:1, height:36, borderRadius:10, cursor:"pointer", fontFamily:"Lexend",
                            background: rewardForm.type===t ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                            border: rewardForm.type===t ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)",
                            color: rewardForm.type===t ? "#FF8C00" : "#6a5a40",
                            fontSize:10, fontWeight: rewardForm.type===t ? 700 : 400 }}>
                          {TYPE_CFG[t].icon} {TYPE_CFG[t].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                    {[
                      { label:"Giá trị ưu đãi",  key:"value",     placeholder:"15000 hoặc 10 (%)" },
                      { label:"Giá điểm đổi",    key:"pointCost", placeholder:"200 điểm" },
                      { label:"Số lượng tồn kho",key:"stock",     placeholder:"50" },
                    ].map(f => (
                      <div key={f.key}>
                        <div style={{ color:"#6a5a40", fontSize:10, marginBottom:4 }}>{f.label}</div>
                        <input value={rewardForm[f.key as keyof typeof rewardForm] as string} onChange={e => setRewardForm(p=>({...p, [f.key]:e.target.value}))} placeholder={f.placeholder} style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12, fontFamily:"Lexend", outline:"none" }} />
                      </div>
                    ))}
                  </div>

                  <div>
                    <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Hạng tối thiểu được đổi</div>
                    <div style={{ display:"flex", gap:8 }}>
                      {(["bronze","silver","gold","platinum"] as const).map(tier => (
                        <button key={tier} onClick={() => setRewardForm(p=>({...p, minTier:tier}))}
                          style={{ flex:1, height:36, borderRadius:10, cursor:"pointer", fontFamily:"Lexend",
                            background: rewardForm.minTier===tier ? "rgba(180,100,255,0.12)" : "rgba(255,255,255,0.04)",
                            border: rewardForm.minTier===tier ? "1px solid rgba(180,100,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
                            color: rewardForm.minTier===tier ? "#b464ff" : "#6a5a40",
                            fontSize:9, fontWeight: rewardForm.minTier===tier ? 700 : 400 }}>
                          {TIER_LABELS[tier]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ background:"rgba(180,100,255,0.06)", border:"1px solid rgba(180,100,255,0.15)", borderRadius:10, padding:"10px 14px", color:"#6a5a40", fontSize:9, lineHeight:1.6 }}>
                    💡 Voucher này sẽ xuất hiện trong ứng dụng khách hàng · Khách chọn đổi → hệ thống tự tạo code riêng · Code tự hết hạn sau 30 ngày
                  </div>

                  <button
                    onClick={() => {
                      setShowCreateReward(false)
                      setRewardForm({ title:"", icon:"🎁", type:"freeship", value:"", pointCost:"", stock:"", minTier:"bronze" })
                    }}
                    style={{ width:"100%", height:44, borderRadius:12, background:"linear-gradient(90deg,#b464ff,#d484ff)", border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                    🎁 Tạo phần thưởng
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    </>
  )
}
