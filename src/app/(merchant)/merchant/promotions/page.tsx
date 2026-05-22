"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type PromoType = "percent" | "fixed" | "freeship" | "combo"
type PromoStatus = "active" | "scheduled" | "ended"

interface Promotion {
  id: string
  title: string
  type: PromoType
  value: number
  minOrder: number
  maxDiscount: number | null
  usageLimit: number | null
  usedCount: number
  startAt: string
  endAt: string
  status: PromoStatus
  productIds: string[]
  applyAll: boolean
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

const TYPE_CFG: Record<PromoType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  percent:  { label:"Giảm %",    icon:"🏷️", color:"#FF8C00", bg:"rgba(255,140,0,0.12)",  border:"rgba(255,140,0,0.35)"  },
  fixed:    { label:"Giảm tiền", icon:"💸", color:"#3ecf6e", bg:"rgba(62,207,110,0.12)", border:"rgba(62,207,110,0.35)" },
  freeship: { label:"Free ship", icon:"🚚", color:"#4a8ff5", bg:"rgba(74,143,245,0.12)", border:"rgba(74,143,245,0.35)" },
  combo:    { label:"Combo",     icon:"🎁", color:"#b464ff", bg:"rgba(180,100,255,0.12)",border:"rgba(180,100,255,0.35)"},
}

const STATUS_CFG: Record<PromoStatus, { label: string; color: string; bg: string }> = {
  active:    { label:"Đang chạy", color:"#3ecf6e", bg:"rgba(62,207,110,0.12)"  },
  scheduled: { label:"Lên lịch",  color:"#f5c542", bg:"rgba(245,197,66,0.12)"  },
  ended:     { label:"Đã kết thúc",color:"#6a5a40", bg:"rgba(255,255,255,0.06)"},
}

const INIT_PROMOS: Promotion[] = [
  { id:"p1", title:"Flash Sale cuối tuần",        type:"percent",  value:25, minOrder:80000,  maxDiscount:50000,  usageLimit:200, usedCount:127, startAt:"2026-05-17T08:00", endAt:"2026-05-18T22:00", status:"active",    productIds:[], applyAll:true  },
  { id:"p2", title:"Free ship đơn từ 60k",        type:"freeship", value:0,  minOrder:60000,  maxDiscount:null,   usageLimit:null,usedCount:89,  startAt:"2026-05-15T00:00", endAt:"2026-05-31T23:59", status:"active",    productIds:[], applyAll:true  },
  { id:"p3", title:"Giảm 15k combo bún + nước",   type:"fixed",    value:15000,minOrder:55000,maxDiscount:null,   usageLimit:50,  usedCount:32,  startAt:"2026-05-17T10:00", endAt:"2026-05-20T23:59", status:"active",    productIds:["p1","p5"], applyAll:false },
  { id:"p4", title:"Khai trương tháng 6 giảm 30%",type:"percent",  value:30, minOrder:100000, maxDiscount:80000,  usageLimit:300, usedCount:0,   startAt:"2026-06-01T00:00", endAt:"2026-06-07T23:59", status:"scheduled", productIds:[], applyAll:true  },
  { id:"p5", title:"Mua 2 tặng 1 món tráng miệng",type:"combo",    value:0,  minOrder:0,      maxDiscount:null,   usageLimit:100, usedCount:100, startAt:"2026-05-01T00:00", endAt:"2026-05-14T23:59", status:"ended",     productIds:[], applyAll:false },
]

export default function MerchantPromotionsPage() {
  const [promos, setPromos]         = useState<Promotion[]>(INIT_PROMOS)
  const [filter, setFilter]         = useState<"all" | PromoStatus>("all")
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected]     = useState<Promotion | null>(null)
  const [toast, setToast]           = useState("")

  const [form, setForm] = useState({
    title: "", type: "percent" as PromoType, value: "", minOrder: "", maxDiscount: "",
    usageLimit: "", perPersonLimit: "", startAt: "", endAt: "", applyAll: true,
  })

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2400) }

  const toggleStatus = (id: string) => {
    const p = promos.find(x => x.id === id)
    const isCurrentlyActive = p?.status === "active"
    setPromos(ps => ps.map(p => {
      if (p.id !== id) return p
      const next: PromoStatus = p.status === "active" ? "ended" : "active"
      return { ...p, status: next }
    }))
    fireToast(isCurrentlyActive ? "Đã tắt chương trình" : "Đã bật chương trình")
  }

  const deletePromo = (id: string) => {
    setPromos(ps => ps.filter(p => p.id !== id))
    setSelected(null)
    fireToast("Đã xoá chương trình khuyến mãi")
  }

  const handleCreate = () => {
    if (!form.title || !form.startAt || !form.endAt) return
    if (new Date(form.endAt) <= new Date(form.startAt)) {
      fireToast("Ngày kết thúc phải sau ngày bắt đầu!")
      return
    }
    if (form.type === "percent") {
      const pct = parseInt(form.value) || 0
      if (pct <= 0 || pct > 100) { fireToast("Phần trăm giảm phải từ 1–100"); return }
    }
    const now = new Date()
    const start = new Date(form.startAt)
    const newPromo: Promotion = {
      id: `p${Date.now()}`,
      title: form.title,
      type: form.type,
      value: parseInt(form.value) || 0,
      minOrder: parseInt(form.minOrder) || 0,
      maxDiscount: form.maxDiscount ? parseInt(form.maxDiscount) : null,
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
      // perPersonLimit stored in data field — ready for Supabase column when added
      usedCount: 0,
      startAt: form.startAt,
      endAt: form.endAt,
      status: start > now ? "scheduled" : "active",
      productIds: [],
      applyAll: form.applyAll,
    }
    setPromos(ps => [newPromo, ...ps])
    setForm({ title:"", type:"percent", value:"", minOrder:"", maxDiscount:"", usageLimit:"", perPersonLimit:"", startAt:"", endAt:"", applyAll:true })
    setShowCreate(false)
    fireToast("Tạo chương trình khuyến mãi thành công!")
  }

  const filtered = promos.filter(p => filter === "all" ? true : p.status === filter)

  const totalActive  = promos.filter(p => p.status === "active").length
  const totalUsed    = promos.reduce((s, p) => s + p.usedCount, 0)
  const totalRevImpact = promos.filter(p => p.status === "active").reduce((s, p) => s + p.usedCount * (p.type === "fixed" ? p.value : 15000), 0)

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%;overflow:hidden}
        input,select,textarea{outline:none;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
      `}</style>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-14 }}
            style={{ position:"fixed", top:52, left:"50%", transform:"translateX(-50%)",
              zIndex:999, whiteSpace:"nowrap",
              background:"rgba(62,207,110,0.15)", border:"1px solid rgba(62,207,110,0.35)",
              borderRadius:12, padding:"7px 18px",
              color:"#3ecf6e", fontSize:11, fontWeight:600, backdropFilter:"blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setShowCreate(false)}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
                zIndex:90, backdropFilter:"blur(4px)" }} />
            <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
              transition={{ type:"spring", damping:26, stiffness:280 }}
              style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:91,
                background:"#0e0c09", border:"1px solid rgba(255,107,0,0.2)",
                borderRadius:"22px 22px 0 0", maxHeight:"92vh",
                display:"flex", flexDirection:"column" }}>
              <div style={{ padding:"14px 18px 10px", flexShrink:0 }}>
                <div style={{ width:36, height:4, background:"rgba(255,255,255,0.12)",
                  borderRadius:2, margin:"0 auto 14px" }} />
                <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:700 }}>
                  ➕ Tạo chương trình khuyến mãi
                </div>
              </div>

              <div style={{ flex:1, overflowY:"auto", padding:"0 18px 32px" }}>
                {/* Tên */}
                <MLabel>Tên chương trình</MLabel>
                <MInput value={form.title} onChange={v => setForm(f => ({ ...f, title:v }))}
                  placeholder="VD: Flash Sale cuối tuần" />

                {/* Loại */}
                <MLabel>Loại khuyến mãi</MLabel>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:12 }}>
                  {(Object.keys(TYPE_CFG) as PromoType[]).map(t => {
                    const cfg = TYPE_CFG[t]
                    return (
                      <div key={t} onClick={() => setForm(f => ({ ...f, type:t }))}
                        style={{ height:44, borderRadius:11, cursor:"pointer",
                          display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                          background:form.type===t?cfg.bg:"rgba(255,255,255,0.04)",
                          border:`1px solid ${form.type===t?cfg.border:"rgba(255,255,255,0.08)"}`,
                          color:form.type===t?cfg.color:"#6a5a40",
                          fontSize:11, fontWeight:form.type===t?700:400, transition:"all .15s" }}>
                        <span>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Giá trị */}
                {form.type !== "freeship" && form.type !== "combo" && (
                  <>
                    <MLabel>{form.type === "percent" ? "Phần trăm giảm (%)" : "Số tiền giảm (đ)"}</MLabel>
                    <MInput value={form.value} onChange={v => setForm(f => ({ ...f, value:v }))}
                      type="number" placeholder={form.type === "percent" ? "VD: 20" : "VD: 15000"} />
                  </>
                )}

                {/* Min order */}
                <MLabel>Đơn hàng tối thiểu</MLabel>
                <MInput value={form.minOrder} onChange={v => setForm(f => ({ ...f, minOrder:v }))}
                  type="number" placeholder="VD: 60000 (0 = không giới hạn)" />

                {/* Max discount */}
                {form.type === "percent" && (
                  <>
                    <MLabel>Giảm tối đa (đ) — tuỳ chọn</MLabel>
                    <MInput value={form.maxDiscount} onChange={v => setForm(f => ({ ...f, maxDiscount:v }))}
                      type="number" placeholder="VD: 50000" />
                  </>
                )}

                {/* Usage limit */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div>
                    <MLabel>Tổng lượt dùng</MLabel>
                    <MInput value={form.usageLimit} onChange={v => setForm(f => ({ ...f, usageLimit:v }))}
                      type="number" placeholder="Bỏ trống = ∞" />
                  </div>
                  <div>
                    <MLabel>Giới hạn / người</MLabel>
                    <MInput value={form.perPersonLimit} onChange={v => setForm(f => ({ ...f, perPersonLimit:v }))}
                      type="number" placeholder="VD: 1 lần" />
                  </div>
                </div>

                {/* Date range */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                  <div>
                    <MLabel>Bắt đầu</MLabel>
                    <input type="datetime-local" value={form.startAt}
                      onChange={e => setForm(f => ({ ...f, startAt:e.target.value }))}
                      style={{ width:"100%", height:42, borderRadius:11, border:"1px solid rgba(255,255,255,0.08)",
                        background:"rgba(255,255,255,0.04)", color:"#f8f0e0", fontSize:11,
                        padding:"0 10px", boxSizing:"border-box",
                        colorScheme:"dark" }} />
                  </div>
                  <div>
                    <MLabel>Kết thúc</MLabel>
                    <input type="datetime-local" value={form.endAt}
                      onChange={e => setForm(f => ({ ...f, endAt:e.target.value }))}
                      style={{ width:"100%", height:42, borderRadius:11, border:"1px solid rgba(255,255,255,0.08)",
                        background:"rgba(255,255,255,0.04)", color:"#f8f0e0", fontSize:11,
                        padding:"0 10px", boxSizing:"border-box",
                        colorScheme:"dark" }} />
                  </div>
                </div>

                {/* Apply scope */}
                <MLabel>Áp dụng cho</MLabel>
                <div style={{ display:"flex", gap:6, marginBottom:18 }}>
                  {[["Tất cả món", true], ["Món được chọn", false]].map(([l, v]) => (
                    <div key={String(v)} onClick={() => setForm(f => ({ ...f, applyAll: v as boolean }))}
                      style={{ flex:1, height:40, borderRadius:10, cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background:form.applyAll === v?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                        border:`1px solid ${form.applyAll === v?"rgba(255,107,0,0.35)":"rgba(255,255,255,0.08)"}`,
                        color:form.applyAll === v?"#FF8C00":"#6a5a40",
                        fontSize:10, fontWeight:form.applyAll === v?700:400, transition:"all .15s" }}>
                      {l as string}
                    </div>
                  ))}
                </div>

                <button onClick={handleCreate}
                  disabled={!form.title || !form.startAt || !form.endAt}
                  style={{ width:"100%", height:48, borderRadius:13, border:"none",
                    background:"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
                    color:"#fff", fontSize:12, fontWeight:700, fontFamily:"Lexend",
                    cursor:"pointer", position:"relative", overflow:"hidden",
                    boxShadow:"0 3px 16px rgba(255,107,0,0.4)",
                    opacity:!form.title||!form.startAt||!form.endAt?0.5:1 }}>
                  <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
                    background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                    animation:"shimmer 2.5s infinite" }} />
                  <span style={{ position:"relative", zIndex:1 }}>🚀 Tạo chương trình</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setSelected(null)}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
                zIndex:80, backdropFilter:"blur(4px)" }} />
            <motion.div initial={{ x:"100%" }} animate={{ x:0 }} exit={{ x:"100%" }}
              transition={{ type:"spring", damping:27, stiffness:290 }}
              style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(340px,100%)",
                zIndex:81, background:"#0e0c09",
                border:"1px solid rgba(255,107,0,0.15)",
                borderRadius:"16px 0 0 16px",
                display:"flex", flexDirection:"column" }}>

              {/* Drawer Header */}
              <div style={{ padding:"16px 16px 12px",
                borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <button onClick={() => setSelected(null)}
                    style={{ width:32, height:32, borderRadius:9, border:"none",
                      background:"rgba(255,255,255,0.05)", cursor:"pointer",
                      color:"#f8f0e0", fontSize:16, display:"flex",
                      alignItems:"center", justifyContent:"center" }}>←</button>
                  <div style={{ flex:1, color:"#f8f0e0", fontSize:13, fontWeight:700,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {selected.title}
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <span style={{ fontSize:8, fontWeight:700, padding:"2px 8px", borderRadius:5,
                    background:TYPE_CFG[selected.type].bg, color:TYPE_CFG[selected.type].color,
                    border:`1px solid ${TYPE_CFG[selected.type].border}` }}>
                    {TYPE_CFG[selected.type].icon} {TYPE_CFG[selected.type].label}
                  </span>
                  <span style={{ fontSize:8, fontWeight:700, padding:"2px 8px", borderRadius:5,
                    background:STATUS_CFG[selected.status].bg, color:STATUS_CFG[selected.status].color }}>
                    {STATUS_CFG[selected.status].label}
                  </span>
                </div>
              </div>

              <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
                {/* Stats */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
                  {[
                    { label:"Đã dùng",       value:`${selected.usedCount}/${selected.usageLimit ?? "∞"}`,  color:"#FF8C00" },
                    { label:"Áp dụng",        value:selected.applyAll?"Tất cả món":"Món chọn",             color:"#4a8ff5" },
                    { label:"Đơn tối thiểu",  value:fmt(selected.minOrder),                                color:"#b0956a" },
                    { label:"Giảm tối đa",    value:selected.maxDiscount?fmt(selected.maxDiscount):"Không giới hạn", color:"#b0956a" },
                  ].map(s => (
                    <div key={s.label} style={{ background:"rgba(255,255,255,0.03)",
                      border:"1px solid rgba(255,255,255,0.06)",
                      borderRadius:10, padding:"9px 10px" }}>
                      <div style={{ color:s.color, fontSize:11, fontWeight:700 }}>{s.value}</div>
                      <div style={{ color:"#6a5a40", fontSize:7.5, marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Usage bar */}
                {selected.usageLimit && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ color:"#6a5a40", fontSize:9 }}>Tỉ lệ sử dụng</span>
                      <span style={{ color:"#FF8C00", fontSize:9, fontWeight:700 }}>
                        {Math.round((selected.usedCount / selected.usageLimit) * 100)}%
                      </span>
                    </div>
                    <div style={{ height:6, borderRadius:3,
                      background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:3,
                        width:`${Math.min(100,(selected.usedCount/selected.usageLimit)*100)}%`,
                        background:"linear-gradient(90deg,#FF6B00,#FFB347)",
                        transition:"width .5s" }} />
                    </div>
                  </div>
                )}

                {/* Date range */}
                <div style={{ background:"rgba(255,255,255,0.03)",
                  border:"1px solid rgba(255,255,255,0.06)",
                  borderRadius:10, padding:"10px 12px", marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ color:"#6a5a40", fontSize:8.5 }}>🗓 Bắt đầu</span>
                    <span style={{ color:"#f8f0e0", fontSize:8.5 }}>
                      {new Date(selected.startAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"#6a5a40", fontSize:8.5 }}>🏁 Kết thúc</span>
                    <span style={{ color:"#f8f0e0", fontSize:8.5 }}>
                      {new Date(selected.endAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding:"12px 16px 28px",
                borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                {selected.status !== "ended" && (
                  <button onClick={() => { toggleStatus(selected.id); setSelected(null) }}
                    style={{ width:"100%", height:44, borderRadius:12, marginBottom:8,
                      background:selected.status === "active"
                        ?"rgba(255,64,64,0.1)":"linear-gradient(90deg,#FF6B00,#FF8C00)",
                      border:`1px solid ${selected.status==="active"?"rgba(255,64,64,0.3)":"transparent"}`,
                      color:selected.status === "active"?"#ff4040":"#fff",
                      fontSize:11, fontWeight:700, fontFamily:"Lexend", cursor:"pointer" }}>
                    {selected.status === "active" ? "⏸ Tạm dừng" : "▶ Kích hoạt"}
                  </button>
                )}
                <button onClick={() => deletePromo(selected.id)}
                  style={{ width:"100%", height:40, borderRadius:12,
                    background:"rgba(255,64,64,0.08)", border:"1px solid rgba(255,64,64,0.2)",
                    color:"#ff4040", fontSize:11, fontWeight:600,
                    fontFamily:"Lexend", cursor:"pointer" }}>
                  🗑 Xoá chương trình
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div style={{ position:"fixed", inset:0, background:"#080806",
        display:"flex", flexDirection:"column", fontFamily:"'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)", backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          padding:"52px 16px 12px", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <a href="/merchant" style={{ width:36, height:36, borderRadius:10, textDecoration:"none",
              background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)",
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"#f8f0e0", fontSize:16 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0", fontSize:16, fontWeight:800 }}>Khuyến Mãi</div>
              <div style={{ color:"#6a5a40", fontSize:9 }}>{totalActive} đang chạy · {promos.length} tổng</div>
            </div>
            <button onClick={() => setShowCreate(true)}
              style={{ background:"linear-gradient(90deg,#FF6B00,#FF8C00)", border:"none",
                borderRadius:10, padding:"8px 14px", color:"#fff",
                fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Lexend",
                boxShadow:"0 2px 12px rgba(255,107,0,0.4)" }}>
              + Tạo mới
            </button>
          </div>

          {/* KPI row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:7, marginBottom:12 }}>
            {[
              { label:"Đang chạy",    value:String(totalActive),                  color:"#3ecf6e" },
              { label:"Tổng lượt dùng",value:String(totalUsed),                   color:"#FF8C00" },
              { label:"Ưu đãi đã trao",value:fmt(totalRevImpact),                 color:"#b464ff" },
            ].map(s => (
              <div key={s.label} style={{ background:"rgba(255,255,255,0.03)",
                border:"1px solid rgba(255,255,255,0.06)", borderRadius:11, padding:"8px 10px" }}>
                <div style={{ color:s.color, fontSize:14, fontWeight:800 }}>{s.value}</div>
                <div style={{ color:"#6a5a40", fontSize:7.5, marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div style={{ display:"flex", gap:5, overflowX:"auto", scrollbarWidth:"none", paddingBottom:0 } as React.CSSProperties}>
            {([["all","Tất cả"],["active","Đang chạy"],["scheduled","Lên lịch"],["ended","Đã kết thúc"]] as const).map(([k, l]) => (
              <div key={k} onClick={() => setFilter(k)}
                style={{ padding:"5px 13px", borderRadius:20, cursor:"pointer", flexShrink:0,
                  background:filter===k?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                  border:`1px solid ${filter===k?"rgba(255,107,0,0.35)":"rgba(255,255,255,0.07)"}`,
                  color:filter===k?"#FF8C00":"#6a5a40",
                  fontSize:9, fontWeight:filter===k?700:400, transition:"all .15s" }}>
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px 24px",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                style={{ textAlign:"center", padding:"40px 0", color:"#6a5a40" }}>
                <div style={{ fontSize:40, marginBottom:8 }}>🎁</div>
                <div style={{ fontSize:12 }}>Chưa có chương trình khuyến mãi</div>
              </motion.div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {filtered.map((p, i) => {
                  const typeCfg = TYPE_CFG[p.type]
                  const statusCfg = STATUS_CFG[p.status]
                  const usagePct = p.usageLimit
                    ? Math.min(100, (p.usedCount / p.usageLimit) * 100) : null
                  return (
                    <motion.div key={p.id} layout
                      initial={{ opacity:0, y:12 }}
                      animate={{ opacity:1, y:0, transition:{ delay:i*0.04 } }}
                      onClick={() => setSelected(p)}
                      style={{ background:"rgba(255,255,255,0.03)",
                        border:`1px solid ${p.status==="active"?typeCfg.border:"rgba(255,255,255,0.07)"}`,
                        borderRadius:16, padding:"13px 13px",
                        cursor:"pointer", opacity:p.status==="ended"?0.6:1 }}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                        <div style={{ width:42, height:42, borderRadius:12,
                          background:typeCfg.bg,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:22, flexShrink:0 }}>
                          {typeCfg.icon}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                            <span style={{ fontSize:7.5, fontWeight:700, padding:"1px 6px", borderRadius:4,
                              background:statusCfg.bg, color:statusCfg.color }}>
                              {statusCfg.label}
                            </span>
                            <span style={{ fontSize:7.5, padding:"1px 6px", borderRadius:4,
                              background:typeCfg.bg, color:typeCfg.color }}>
                              {typeCfg.label}
                            </span>
                          </div>
                          <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700, marginBottom:3,
                            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {p.title}
                          </div>
                          <div style={{ color:"#6a5a40", fontSize:8.5, marginBottom:6 }}>
                            {p.type === "percent" ? `Giảm ${p.value}%` :
                             p.type === "fixed" ? `Giảm ${fmt(p.value)}` :
                             p.type === "freeship" ? "Miễn phí giao hàng" : "Combo đặc biệt"}
                            {p.minOrder > 0 && ` · Đơn tối thiểu ${fmt(p.minOrder)}`}
                          </div>
                          {usagePct !== null && (
                            <div>
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                <span style={{ color:"#6a5a40", fontSize:7.5 }}>
                                  {p.usedCount}/{p.usageLimit} lượt
                                </span>
                                <span style={{ color:usagePct>=90?"#ff4040":"#FF8C00",
                                  fontSize:7.5, fontWeight:700 }}>
                                  {Math.round(usagePct)}%
                                </span>
                              </div>
                              <div style={{ height:4, borderRadius:2,
                                background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                                <div style={{ height:"100%", borderRadius:2,
                                  width:`${usagePct}%`,
                                  background:usagePct>=90
                                    ?"linear-gradient(90deg,#ff4040,#ff6060)"
                                    :"linear-gradient(90deg,#FF6B00,#FFB347)" }} />
                              </div>
                            </div>
                          )}
                          {!p.usageLimit && (
                            <div style={{ color:"#6a5a40", fontSize:7.5 }}>
                              {p.usedCount} lượt đã dùng · Không giới hạn
                            </div>
                          )}
                        </div>
                        <div style={{ color:"#6a5a40", fontSize:18, flexShrink:0 }}>›</div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}

// ─── Helper components ────────────────────────────────────
function MLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color:"rgba(176,149,106,0.6)", fontSize:9.5,
      marginBottom:5, marginTop:0 }}>
      {children}
    </div>
  )
}

function MInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display:"flex", alignItems:"center",
      background:"rgba(255,255,255,0.04)",
      border:`1px solid ${focused?"rgba(255,107,0,0.45)":"rgba(255,255,255,0.08)"}`,
      borderRadius:11, padding:"0 12px", height:42, marginBottom:10, transition:"all .2s",
      boxShadow:focused?"0 0 0 3px rgba(255,107,0,0.09)":"none" }}>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ flex:1, background:"transparent", border:"none",
          color:"#f8f0e0", fontSize:12 }} />
    </div>
  )
}
