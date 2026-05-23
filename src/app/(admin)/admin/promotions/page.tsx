"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

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

type VoucherType   = "percent" | "fixed" | "freeship"
type VoucherStatus = "active" | "expired" | "scheduled"

interface Voucher {
  id: string; code: string; title: string; type: VoucherType; value: number
  minOrder: number; maxDiscount: number | null; used: number; limit: number | null
  validFrom: string; validTo: string; status: VoucherStatus; shopId: string | null
  is_active: boolean
}

const TYPE_CFG: Record<VoucherType, { label:string; color:string; bg:string; icon:string }> = {
  percent:  { label:"% Giảm giá",   color:"#FF8C00", bg:"rgba(255,140,0,0.1)",   icon:"%" },
  fixed:    { label:"Giảm cố định", color:"#4a8ff5", bg:"rgba(74,143,245,0.1)", icon:"₫" },
  freeship: { label:"Miễn phí ship",color:"#3ecf6e", bg:"rgba(62,207,110,0.1)", icon:"🚀" },
}

const STATUS_CFG: Record<VoucherStatus, { label:string; color:string; bg:string }> = {
  active:    { label:"Đang chạy",     color:"#3ecf6e", bg:"rgba(62,207,110,0.1)" },
  expired:   { label:"Hết hạn",       color:"#6a5a40", bg:"rgba(255,255,255,0.06)" },
  scheduled: { label:"Chờ kích hoạt", color:"#FFB347", bg:"rgba(255,179,71,0.1)" },
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function deriveStatus(v: { is_active: boolean; valid_from: string; valid_to: string }): VoucherStatus {
  const now = new Date()
  if (!v.is_active || new Date(v.valid_to) < now) return "expired"
  if (new Date(v.valid_from) > now) return "scheduled"
  return "active"
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("vi-VN") } catch { return iso }
}

export default function AdminPromotionsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [filter,      setFilter]      = useState<"all" | VoucherStatus>("all")
  const [search,      setSearch]      = useState("")
  const [selected,    setSelected]    = useState<Voucher | null>(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [pageTab,     setPageTab]     = useState<"voucher" | "rewards">("voucher")
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [vouchers,    setVouchers]    = useState<Voucher[]>([])
  const [userId,      setUserId]      = useState<string | null>(null)

  const [form, setForm] = useState({
    code: "", title: "", type: "percent" as VoucherType,
    value: "", minOrder: "", maxDiscount: "", limit: "",
    validFrom: "", validTo: "",
  })

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("vouchers")
      .select("id,code,title,discount_type,discount_value,min_order,max_discount,usage_limit,used_count,valid_from,valid_to,shop_id,is_active")
      .order("created_at", { ascending: false })

    if (error || !data) { setLoading(false); return }

    setVouchers(data.map(r => ({
      id:         r.id,
      code:       r.code,
      title:      r.title,
      type:       r.discount_type as VoucherType,
      value:      r.discount_value,
      minOrder:   r.min_order,
      maxDiscount:r.max_discount,
      used:       r.used_count,
      limit:      r.usage_limit,
      validFrom:  r.valid_from,
      validTo:    r.valid_to,
      shopId:     r.shop_id,
      is_active:  r.is_active,
      status:     deriveStatus({ is_active: r.is_active, valid_from: r.valid_from, valid_to: r.valid_to }),
    })))
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
    load()
  }, [load])

  const shown = useMemo(() =>
    vouchers
      .filter(v => filter === "all" || v.status === filter)
      .filter(v => !search || v.code.includes(search.toUpperCase()) || v.title.toLowerCase().includes(search.toLowerCase())),
    [vouchers, filter, search]
  )

  const activeCount    = useMemo(() => vouchers.filter(v => v.status === "active").length, [vouchers])
  const scheduledCount = useMemo(() => vouchers.filter(v => v.status === "scheduled").length, [vouchers])
  const totalUsed      = useMemo(() => vouchers.reduce((s, v) => s + v.used, 0), [vouchers])

  async function handleCreate() {
    if (!form.code || !form.title || !form.value || !form.validFrom || !form.validTo) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("vouchers").insert({
      code:           form.code.toUpperCase().trim(),
      title:          form.title.trim(),
      discount_type:  form.type,
      discount_value: Number(form.value),
      min_order:      Number(form.minOrder) || 0,
      max_discount:   form.maxDiscount ? Number(form.maxDiscount) : null,
      usage_limit:    form.limit ? Number(form.limit) : null,
      valid_from:     new Date(form.validFrom).toISOString(),
      valid_to:       new Date(form.validTo + "T23:59:59").toISOString(),
      is_active:      true,
      created_by:     userId,
    })
    setSaving(false)
    if (!error) {
      setShowCreate(false)
      setForm({ code:"", title:"", type:"percent", value:"", minOrder:"", maxDiscount:"", limit:"", validFrom:"", validTo:"" })
      load()
    }
  }

  async function handleToggle(v: Voucher) {
    const nowActive = v.status === "active"
    setVouchers(prev => prev.map(x => x.id === v.id ? { ...x, is_active: !nowActive, status: deriveStatus({ is_active: !nowActive, valid_from: x.validFrom, valid_to: x.validTo }) } : x))
    if (selected?.id === v.id) setSelected(s => s ? { ...s, is_active: !nowActive, status: deriveStatus({ is_active: !nowActive, valid_from: s.validFrom, valid_to: s.validTo }) } : s)
    const supabase = createClient()
    const { error } = await supabase.from("vouchers").update({ is_active: !nowActive }).eq("id", v.id)
    if (error) load()
  }

  async function handleDelete(id: string) {
    const backup = vouchers
    setVouchers(prev => prev.filter(x => x.id !== id))
    setSelected(null)
    const supabase = createClient()
    const { error } = await supabase.from("vouchers").delete().eq("id", id)
    if (error) setVouchers(backup)
  }

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
            {pageTab === "voucher" && (
              <button onClick={() => setShowCreate(true)} style={{ padding:"8px 20px", borderRadius:10, background:"linear-gradient(90deg,#FF6B00,#FF8C00)", border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                + Tạo voucher mới
              </button>
            )}
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
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
              {[
                { label:"Tổng voucher",     value: vouchers.length, icon:"🏷️", color:"#f0eaff" },
                { label:"Đang hoạt động",   value: activeCount,      icon:"✅",  color:"#3ecf6e" },
                { label:"Chờ kích hoạt",    value: scheduledCount,   icon:"⏰", color:"#FFB347" },
                { label:"Tổng lượt dùng",   value: totalUsed,        icon:"📊", color:"#4a8ff5" },
              ].map((k, i) => (
                <div key={k.label} className="kpi-card" style={{ animationDelay:`${i*0.06}s`, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                  <div style={{ fontSize:24, marginBottom:10 }}>{k.icon}</div>
                  <div style={{ color:k.color, fontSize:22, fontWeight:800, marginBottom:4 }}>{loading ? "–" : k.value}</div>
                  <div style={{ color:"#6a5a40", fontSize:10 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center" }}>
              <div style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"8px 14px", display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ color:"#6a5a40" }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã voucher, tên..." style={{ flex:1, background:"none", border:"none", color:"#f0eaff", fontSize:12 }} />
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {(["all","active","scheduled","expired"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ padding:"7px 14px", borderRadius:8, background: filter===f ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: filter===f ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: filter===f ? "#FF8C00" : "#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend", fontWeight: filter===f ? 700 : 400 }}>
                    {f==="all" ? "Tất cả" : STATUS_CFG[f as VoucherStatus]?.label ?? f}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"130px 1.6fr 90px 100px 90px 80px 110px 120px", padding:"10px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                {["Mã voucher","Tên","Loại","Giá trị","Đã dùng","Tỉ lệ","Hạn dùng","Trạng thái"].map(h => (
                  <span key={h} style={{ color:"#6a5a40", fontSize:10, fontWeight:600 }}>{h}</span>
                ))}
              </div>

              {loading ? (
                <div style={{ padding:"40px", textAlign:"center", color:"#6a5a40", fontSize:12 }}>Đang tải...</div>
              ) : shown.length === 0 ? (
                <div style={{ padding:"40px", textAlign:"center", color:"#6a5a40", fontSize:12 }}>
                  {vouchers.length === 0 ? "Chưa có voucher nào. Tạo voucher đầu tiên!" : "Không có voucher phù hợp"}
                </div>
              ) : shown.map(v => {
                const tc = TYPE_CFG[v.type]
                const sc = STATUS_CFG[v.status]
                const usageRate = v.limit ? Math.round((v.used / v.limit) * 100) : null
                return (
                  <div key={v.id} className="voucher-row" onClick={() => setSelected(v)} style={{ display:"grid", gridTemplateColumns:"130px 1.6fr 90px 100px 90px 80px 110px 120px", padding:"13px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)", alignItems:"center", cursor:"pointer", transition:"background 0.15s" }}>
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
                    <span style={{ color:"#6a5a40", fontSize:9 }}>{fmtDate(v.validFrom)}<br />→ {fmtDate(v.validTo)}</span>
                    <span style={{ padding:"3px 10px", borderRadius:7, background:sc.bg, color:sc.color, fontSize:9, fontWeight:700, width:"fit-content" }}>{sc.label}</span>
                  </div>
                )
              })}
            </div>
            </>)}

            {pageTab === "rewards" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px", gap:16 }}>
                <div style={{ fontSize:48 }}>🎁</div>
                <div style={{ color:"#f0eaff", fontSize:16, fontWeight:700 }}>Chưa có danh mục đổi điểm</div>
                <div style={{ color:"#6a5a40", fontSize:12, textAlign:"center", maxWidth:400, lineHeight:1.7 }}>
                  Tính năng đổi điểm lấy phần thưởng sẽ yêu cầu bảng <code style={{ color:"#FF8C00" }}>loyalty_rewards</code> trong cơ sở dữ liệu.<br />
                  Khách hàng tích điểm qua mỗi đơn hàng và có thể đổi lấy voucher tại đây.
                </div>
                <div style={{ background:"rgba(180,100,255,0.06)", border:"1px solid rgba(180,100,255,0.15)", borderRadius:12, padding:"12px 20px", color:"#6a5a40", fontSize:10, lineHeight:1.7, maxWidth:440 }}>
                  💡 <strong style={{ color:"#b464ff" }}>Quy tắc:</strong> 100 điểm = 1.000 xu · Khách đổi điểm lấy voucher trong ứng dụng.<br />
                  Voucher đổi điểm tự động tạo code riêng cho từng khách khi đổi thành công.
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Detail drawer */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={() => setSelected(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, backdropFilter:"blur(4px)" }} />
              <motion.div initial={{ x:"100%" }} animate={{ x:0 }} exit={{ x:"100%" }} transition={{ type:"spring", damping:24, stiffness:300 }} style={{ position:"fixed", top:0, right:0, bottom:0, width:380, background:"#0d0b12", borderLeft:"1px solid rgba(255,107,0,0.15)", zIndex:101, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                <div style={{ padding:"20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ color:"#FF8C00", fontSize:18, fontWeight:800, fontFamily:"monospace", marginBottom:4 }}>{selected.code}</div>
                    <div style={{ color:"#f0eaff", fontSize:13, fontWeight:600 }}>{selected.title}</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"none", color:"#6a5a40", fontSize:16, cursor:"pointer" }}>×</button>
                </div>

                <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                    {[
                      { label:"Đã dùng", value:`${selected.used}${selected.limit ? `/${selected.limit}` : ""}` },
                      { label:"Min. đơn", value:fmt(selected.minOrder) },
                    ].map(s => (
                      <div key={s.label} style={{ background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"10px", textAlign:"center" }}>
                        <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>{s.value}</div>
                        <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {[
                    ["Loại voucher",   TYPE_CFG[selected.type].label],
                    ["Giá trị",        selected.type==="percent" ? `Giảm ${selected.value}%` : fmt(selected.value)],
                    ["Giảm tối đa",    selected.maxDiscount ? fmt(selected.maxDiscount) : "Không giới hạn"],
                    ["Đơn tối thiểu",  fmt(selected.minOrder)],
                    ["Hiệu lực",       `${fmtDate(selected.validFrom)} → ${fmtDate(selected.validTo)}`],
                    ["Phạm vi",        selected.shopId ? "Riêng cửa hàng" : "Toàn hệ thống"],
                    ["Trạng thái",     STATUS_CFG[selected.status].label],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ color:"#6a5a40", fontSize:11 }}>{k}</span>
                      <span style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{v}</span>
                    </div>
                  ))}

                  {selected.limit && (
                    <div style={{ marginTop:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ color:"#6a5a40", fontSize:10 }}>Mức sử dụng</span>
                        <span style={{ color:"#f0eaff", fontSize:10 }}>{Math.round((selected.used / selected.limit) * 100)}%</span>
                      </div>
                      <div style={{ height:6, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${(selected.used / selected.limit) * 100}%`, background:"linear-gradient(90deg,#FF6B00,#FFB347)", borderRadius:3 }} />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ padding:"16px 20px", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", gap:8 }}>
                  {selected.status === "active" && (
                    <button onClick={() => handleToggle(selected)} style={{ flex:1, height:40, borderRadius:10, background:"rgba(255,64,64,0.08)", border:"1px solid rgba(255,64,64,0.2)", color:"#ff4040", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                      ⏹ Dừng voucher
                    </button>
                  )}
                  {selected.status === "scheduled" && (
                    <button onClick={() => handleToggle(selected)} style={{ flex:1, height:40, borderRadius:10, background:"rgba(62,207,110,0.1)", border:"1px solid rgba(62,207,110,0.25)", color:"#3ecf6e", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                      ▶ Kích hoạt ngay
                    </button>
                  )}
                  {selected.status === "expired" && (
                    <button onClick={() => handleDelete(selected.id)} style={{ flex:1, height:40, borderRadius:10, background:"rgba(255,64,64,0.08)", border:"1px solid rgba(255,64,64,0.2)", color:"#ff4040", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                      🗑 Xóa voucher
                    </button>
                  )}
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
              <motion.div initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.92 }} transition={{ type:"spring", damping:24, stiffness:300 }} style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"min(480px, calc(100vw - 24px))", maxHeight:"calc(100dvh - 80px)", background:"#0d0b12", borderRadius:18, border:"1px solid rgba(255,107,0,0.2)", zIndex:101, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                <div style={{ padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
                  <div style={{ color:"#f0eaff", fontSize:15, fontWeight:800 }}>+ Tạo voucher mới</div>
                  <button onClick={() => setShowCreate(false)} style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"none", color:"#6a5a40", fontSize:16, cursor:"pointer" }}>×</button>
                </div>
                <div style={{ flex:1, padding:"16px 20px", display:"flex", flexDirection:"column", gap:12, overflowY:"auto" }}>
                  {[
                    { label:"Mã voucher",      key:"code",        placeholder:"GIAONHANH10", type:"text" },
                    { label:"Tên voucher",      key:"title",       placeholder:"Giảm 10% đơn đầu tiên", type:"text" },
                    { label:"Giá trị",          key:"value",       placeholder:"10 (hoặc 20000)", type:"number" },
                    { label:"Đơn tối thiểu (đ)",key:"minOrder",    placeholder:"50000", type:"number" },
                    { label:"Giảm tối đa (đ)",  key:"maxDiscount", placeholder:"30000 (để trống nếu không có)", type:"number" },
                    { label:"Giới hạn dùng",    key:"limit",       placeholder:"500 (để trống = không giới hạn)", type:"number" },
                    { label:"Từ ngày",          key:"validFrom",   placeholder:"", type:"date" },
                    { label:"Đến ngày",         key:"validTo",     placeholder:"", type:"date" },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ color:"#6a5a40", fontSize:10, marginBottom:4 }}>{f.label}</div>
                      <input
                        type={f.type}
                        value={form[f.key as keyof typeof form]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12 }}
                      />
                    </div>
                  ))}
                  <div>
                    <div style={{ color:"#6a5a40", fontSize:10, marginBottom:4 }}>Loại khuyến mãi</div>
                    <div style={{ display:"flex", gap:8 }}>
                      {(["percent","fixed","freeship"] as VoucherType[]).map(t => (
                        <button key={t} onClick={() => setForm(p => ({ ...p, type:t }))} style={{ flex:1, height:36, borderRadius:10, background: form.type===t ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: form.type===t ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: form.type===t ? "#FF8C00" : "#6a5a40", fontSize:10, cursor:"pointer", fontFamily:"Lexend", fontWeight: form.type===t ? 700 : 400 }}>
                          {TYPE_CFG[t].icon} {TYPE_CFG[t].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !form.code || !form.title || !form.value || !form.validFrom || !form.validTo}
                    style={{ width:"100%", height:44, borderRadius:12, background:"linear-gradient(90deg,#FF6B00,#FF8C00)", border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", marginTop:4, opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Đang tạo..." : "🏷️ Tạo voucher"}
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
