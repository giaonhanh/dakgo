"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

type VoucherType = "percent" | "fixed" | "freeship"
interface Voucher {
  id: string
  code: string
  title: string
  type: VoucherType
  value: number
  minOrder: number
  maxDiscount: number | null
  validTo: string
  shopName: string | null
  used: boolean
  saved: boolean
  totalLeft: number
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

const TYPE_CFG: Record<VoucherType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  percent:  { label:"Giảm %",    icon:"🏷️", color:"#FF8C00", bg:"rgba(255,140,0,0.1)",  border:"rgba(255,140,0,0.3)"  },
  fixed:    { label:"Giảm tiền", icon:"💸", color:"#3ecf6e", bg:"rgba(62,207,110,0.1)", border:"rgba(62,207,110,0.3)" },
  freeship: { label:"Free ship", icon:"🚚", color:"#4a8ff5", bg:"rgba(74,143,245,0.1)", border:"rgba(74,143,245,0.3)" },
}

const VOUCHERS: Voucher[] = [
  { id:"v1", code:"GIAONHANH20", title:"Giảm 20% đơn hàng",          type:"percent",  value:20, minOrder:80000,  maxDiscount:40000,  validTo:"2026-05-20T23:59", shopName:null,           used:false, saved:true,  totalLeft:42  },
  { id:"v2", code:"FREESHIP50K", title:"Miễn phí giao hàng",          type:"freeship", value:0,  minOrder:50000,  maxDiscount:null,   validTo:"2026-05-18T23:59", shopName:null,           used:false, saved:true,  totalLeft:8   },
  { id:"v3", code:"BUNBO15K",   title:"Giảm 15.000đ tại Bún Bò Huế", type:"fixed",    value:15000,minOrder:60000,maxDiscount:null,   validTo:"2026-05-25T23:59", shopName:"Bún Bò Huế",  used:false, saved:true,  totalLeft:120 },
  { id:"v4", code:"NEWUSER30",  title:"Khách mới giảm 30%",           type:"percent",  value:30, minOrder:100000, maxDiscount:60000,  validTo:"2026-06-01T23:59", shopName:null,           used:true,  saved:true,  totalLeft:0   },
  { id:"v5", code:"FLASH50",   title:"Flash Sale 50% tất cả",        type:"percent",  value:50, minOrder:120000, maxDiscount:80000,  validTo:"2026-05-17T22:00", shopName:null,           used:false, saved:false, totalLeft:5   },
  { id:"v6", code:"GARANHU5K", title:"Giảm 5.000đ tại Gà Rán Huỳnh",type:"fixed",    value:5000, minOrder:30000,maxDiscount:null,   validTo:"2026-05-31T23:59", shopName:"Gà Rán Huỳnh",used:false, saved:false, totalLeft:67  },
]

function useCountdown(isoDate: string) {
  const [diff, setDiff] = useState(0)
  useEffect(() => {
    const tick = () => setDiff(Math.max(0, new Date(isoDate).getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isoDate])
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const days = Math.floor(diff / 86400000)
  if (diff <= 0) return { text: "Đã hết hạn", urgent: true, expired: true }
  if (days > 0)  return { text: `Còn ${days} ngày`, urgent: false, expired: false }
  return { text: `Còn ${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`, urgent: h < 3, expired: false }
}

function VoucherCard({ v, onSave, onCopy }: { v: Voucher; onSave: () => void; onCopy: () => void }) {
  const countdown = useCountdown(v.validTo)
  const cfg = TYPE_CFG[v.type]
  return (
    <motion.div layout initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
      style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${v.used||countdown.expired?"rgba(255,255,255,0.07)":cfg.border}`,
        borderRadius:16, overflow:"hidden", opacity:v.used||countdown.expired?0.5:1 }}>
      {/* Dashed border separator */}
      <div style={{ display:"flex" }}>
        {/* Left stripe */}
        <div style={{ width:6, background:v.used||countdown.expired?"rgba(255,255,255,0.05)":cfg.bg,
          borderRight:`2px dashed ${v.used||countdown.expired?"rgba(255,255,255,0.08)":cfg.border}` }} />
        {/* Content */}
        <div style={{ flex:1, padding:"12px 12px 12px 14px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:cfg.bg,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
              {cfg.icon}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                <span style={{ fontSize:7.5, fontWeight:700, padding:"1px 6px", borderRadius:4,
                  background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>
                  {cfg.label}
                </span>
                {v.shopName && (
                  <span style={{ fontSize:7.5, color:"#6a5a40", background:"rgba(255,255,255,0.04)",
                    padding:"1px 6px", borderRadius:4, border:"1px solid rgba(255,255,255,0.07)" }}>
                    {v.shopName}
                  </span>
                )}
              </div>
              <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700, marginBottom:3,
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {v.title}
              </div>
              <div style={{ color:"#6a5a40", fontSize:8.5, marginBottom:6 }}>
                Đơn tối thiểu {fmt(v.minOrder)}
                {v.maxDiscount && ` · Giảm tối đa ${fmt(v.maxDiscount)}`}
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontFamily:"'Courier New',monospace",
                    background:"rgba(255,107,0,0.1)", border:"1px dashed rgba(255,107,0,0.3)",
                    borderRadius:5, padding:"2px 8px", color:"#FF8C00", fontSize:10, fontWeight:700 }}>
                    {v.code}
                  </span>
                  <button onClick={onCopy} style={{ background:"none", border:"none", cursor:"pointer",
                    color:"#6a5a40", fontSize:10, padding:0, fontFamily:"Lexend" }}>
                    📋
                  </button>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:8, color:countdown.urgent?"#ff4040":countdown.expired?"#6a5a40":"#6a5a40",
                    fontWeight:countdown.urgent?700:400 }}>
                    {countdown.text}
                  </div>
                  {!countdown.expired && !v.used && (
                    <div style={{ fontSize:7.5, color:"#6a5a40" }}>
                      Còn {v.totalLeft} lượt
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Footer */}
          <div style={{ marginTop:10, paddingTop:8,
            borderTop:"1px solid rgba(255,255,255,0.05)",
            display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            {v.used ? (
              <span style={{ color:"#6a5a40", fontSize:9 }}>✓ Đã sử dụng</span>
            ) : countdown.expired ? (
              <span style={{ color:"#ff4040", fontSize:9 }}>✗ Đã hết hạn</span>
            ) : (
              <button onClick={onSave} style={{ background:"none", border:"none", cursor:"pointer",
                display:"flex", alignItems:"center", gap:4, padding:0, fontFamily:"Lexend" }}>
                <span style={{ fontSize:12 }}>{v.saved ? "💾" : "🔖"}</span>
                <span style={{ fontSize:9, color:v.saved?"#FF8C00":"#6a5a40" }}>
                  {v.saved ? "Đã lưu" : "Lưu mã"}
                </span>
              </button>
            )}
            {!v.used && !countdown.expired && (
              <a href="/cart" style={{ textDecoration:"none",
                background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
                borderRadius:8, padding:"5px 14px",
                color:"#fff", fontSize:9, fontWeight:700,
                boxShadow:"0 2px 8px rgba(255,107,0,0.3)" }}>
                Dùng ngay →
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function VouchersPage() {
  const [vouchers, setVouchers]   = useState<Voucher[]>(VOUCHERS)
  const [filter, setFilter]       = useState<"all"|"saved"|VoucherType>("all")
  const [code, setCode]           = useState("")
  const [toast, setToast]         = useState("")
  const [toastOk, setToastOk]     = useState(true)

  const fireToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok)
    setTimeout(() => setToast(""), 2500)
  }

  const handleCopy = (c: string) => {
    navigator.clipboard.writeText(c).catch(() => {})
    fireToast(`Đã sao chép mã ${c}`)
  }

  const handleSave = (id: string) => {
    const v = vouchers.find(x => x.id === id)
    const willBeSaved = !v?.saved
    setVouchers(vs => vs.map(v => v.id === id ? { ...v, saved: !v.saved } : v))
    fireToast(willBeSaved ? "Đã lưu mã thành công!" : "Đã bỏ lưu mã")
  }

  const handleApply = () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    const found = vouchers.find(v => v.code === trimmed)
    if (found && !found.used) {
      fireToast(`Áp dụng mã ${trimmed} thành công!`)
      setCode("")
    } else {
      fireToast("Mã không hợp lệ hoặc đã được dùng", false)
    }
  }

  const filtered = vouchers.filter(v => {
    if (filter === "saved") return v.saved
    if (filter === "all")   return true
    return v.type === filter
  })

  const FILTERS = [
    { v:"all" as const,      l:"Tất cả" },
    { v:"saved" as const,    l:"Đã lưu" },
    { v:"freeship" as const, l:"Free ship" },
    { v:"percent" as const,  l:"Giảm %" },
    { v:"fixed" as const,    l:"Giảm tiền" },
  ]

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%;overflow:hidden}
        input{outline:none;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
      `}</style>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-14 }}
            style={{ position:"fixed", top:52, left:"50%", transform:"translateX(-50%)",
              zIndex:999, whiteSpace:"nowrap",
              background:toastOk?"rgba(62,207,110,0.15)":"rgba(255,64,64,0.15)",
              border:`1px solid ${toastOk?"rgba(62,207,110,0.35)":"rgba(255,64,64,0.35)"}`,
              borderRadius:12, padding:"7px 18px",
              color:toastOk?"#3ecf6e":"#ff4040",
              fontSize:11, fontWeight:600, backdropFilter:"blur(10px)" }}>
            {toastOk ? "✓" : "✗"} {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position:"fixed", inset:0, background:"#080806",
        display:"flex", flexDirection:"column", fontFamily:"'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)", backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          padding:"44px 16px 0", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <a href="/" style={{ width:32, height:32, borderRadius:9, textDecoration:"none",
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>Kho Voucher</div>
              <div style={{ color:"#6a5a40", fontSize:9 }}>
                {vouchers.filter(v => !v.used && new Date(v.validTo) > new Date()).length} mã đang có hiệu lực
              </div>
            </div>
          </div>

          {/* Manual code input */}
          <div style={{ display:"flex", gap:7, marginBottom:12 }}>
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:8,
              background:"rgba(255,255,255,0.04)",
              border:`1px solid ${code?"rgba(255,107,0,0.45)":"rgba(255,255,255,0.08)"}`,
              borderRadius:12, padding:"0 12px", height:42, transition:"all .2s",
              boxShadow:code?"0 0 0 3px rgba(255,107,0,0.09)":"none" }}>
              <span style={{ color:"#6a5a40", fontSize:14 }}>🎫</span>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && handleApply()}
                placeholder="Nhập mã voucher..."
                style={{ flex:1, background:"transparent", border:"none",
                  color:"#f8f0e0", fontSize:12, letterSpacing:1 }} />
              {code && (
                <button onClick={() => setCode("")}
                  style={{ background:"none", border:"none", cursor:"pointer",
                    color:"#6a5a40", fontSize:14, padding:0 }}>×</button>
              )}
            </div>
            <button onClick={handleApply} disabled={!code}
              style={{ height:42, padding:"0 16px", borderRadius:12, border:"none",
                background:code?"linear-gradient(90deg,#FF6B00,#FF8C00)":"rgba(255,255,255,0.07)",
                color:code?"#fff":"#6a5a40",
                fontSize:11, fontWeight:700, fontFamily:"Lexend", cursor:code?"pointer":"default",
                boxShadow:code?"0 2px 10px rgba(255,107,0,0.35)":"none" }}>
              Áp dụng
            </button>
          </div>

          {/* Filter chips */}
          <div style={{ display:"flex", gap:5, overflowX:"auto",
            scrollbarWidth:"none", paddingBottom:12 } as React.CSSProperties}>
            {FILTERS.map(f => (
              <div key={f.v} onClick={() => setFilter(f.v)}
                style={{ padding:"4px 12px", borderRadius:20, cursor:"pointer", flexShrink:0,
                  background:filter===f.v?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                  border:`1px solid ${filter===f.v?"rgba(255,107,0,0.35)":"rgba(255,255,255,0.07)"}`,
                  color:filter===f.v?"#FF8C00":"#6a5a40",
                  fontSize:9, fontWeight:filter===f.v?700:400, transition:"all .15s" }}>
                {f.l}
              </div>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px 88px",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* Stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:7, marginBottom:14 }}>
            {[
              { label:"Đang có", value:vouchers.filter(v=>!v.used&&new Date(v.validTo)>new Date()).length, color:"#3ecf6e" },
              { label:"Đã lưu",  value:vouchers.filter(v=>v.saved).length,                               color:"#FF8C00" },
              { label:"Đã dùng", value:vouchers.filter(v=>v.used).length,                                color:"#6a5a40" },
            ].map(s => (
              <div key={s.label} style={{ background:"rgba(255,255,255,0.03)",
                border:"1px solid rgba(255,255,255,0.07)", borderRadius:12,
                padding:"9px 10px", textAlign:"center" }}>
                <div style={{ color:s.color, fontSize:20, fontWeight:800 }}>{s.value}</div>
                <div style={{ color:"#6a5a40", fontSize:8, marginTop:1 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Voucher cards */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                  style={{ textAlign:"center", padding:"40px 0", color:"#6a5a40" }}>
                  <div style={{ fontSize:40, marginBottom:8 }}>🎫</div>
                  <div style={{ fontSize:12 }}>Không có voucher nào</div>
                </motion.div>
              ) : filtered.map(v => (
                <VoucherCard key={v.id} v={v}
                  onSave={() => handleSave(v.id)}
                  onCopy={() => handleCopy(v.code)} />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Nav */}
        <div style={{ position:"absolute", bottom:"max(16px,env(safe-area-inset-bottom))",left:14, right:14, height:56,
          background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999,
          display:"flex", alignItems:"center", justifyContent:"space-around",
          padding:"0 6px", zIndex:50, boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            { icon:"🏠", label:"Trang chủ", href:"/",        active:false },
            { icon:"📋", label:"Đơn hàng",  href:"/orders",  active:false },
            { icon:"🛒", label:"Giỏ hàng",  href:"/cart",    active:false },
            { icon:"⚙️", label:"Cài đặt",   href:"/settings",active:false },
          ].map(tab => (
            <a key={tab.href} href={tab.href}
              style={{ textDecoration:"none", display:"flex", flexDirection:"column",
                alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18,
                background:tab.active?"rgba(255,107,0,0.12)":"transparent" }}>
              <span style={{ fontSize:19 }}>{tab.icon}</span>
              <span style={{ fontSize:7.5, color:"#6a5a40" }}>{tab.label}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
