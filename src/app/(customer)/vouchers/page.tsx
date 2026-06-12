"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Badge from "@/components/ui/Badge"
import NewVoucherCard from "@/components/ui/VoucherCard"
import type { VoucherItem } from "@/components/ui/VoucherCard"

type VoucherType = "percent" | "fixed" | "freeship"

interface ComboItem { product_id: string; min_quantity: number; products: { name: string; price: number } | null }
interface Voucher {
  id: string
  code: string
  title: string
  type: VoucherType
  value: number
  minOrder: number
  maxDiscount: number | null
  perUserLimit: number | null
  usageLimit: number | null
  usedCount: number
  validTo: string
  shopId: string | null
  shopName: string | null
  used: boolean    // đã dùng bởi user hiện tại
  saved: boolean   // đã bookmark (localStorage)
  isCombo: boolean
  comboItems: ComboItem[]
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function voucherToItem(v: Voucher): VoucherItem {
  const type: VoucherItem["type"] = v.isCombo ? "combo"
    : v.type === "fixed"    ? "cash"
    : v.type === "freeship" ? "freeship"
    : "percent"
  const totalUses     = v.usageLimit ?? 999
  const remainingUses = v.usageLimit !== null ? Math.max(0, v.usageLimit - v.usedCount) : 999
  const comboDesc     = v.isCombo && v.comboItems.length > 0
    ? "Cần: " + v.comboItems.map(ci => `${ci.products?.name ?? "Món"}${ci.min_quantity > 1 ? ` ×${ci.min_quantity}` : ""}`).join(", ")
    : ""
  return {
    id:             v.id,
    type,
    value:          v.value,
    maxDiscount:    v.maxDiscount ?? undefined,
    minOrder:       v.minOrder,
    title:          v.title,
    description:    comboDesc || (v.minOrder > 0 ? `Đơn tối thiểu ${fmt(v.minOrder)}` : ""),
    expiresAt:      v.validTo,
    remainingUses,
    totalUses,
    isSaved:        v.saved,
    isApplied:      false,
    shopId:         v.shopId ?? undefined,
    shopName:       v.shopName ?? undefined,
  }
}

const TYPE_CFG: Record<VoucherType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  percent:  { label:"Giảm %",    icon:"🏷️", color:"#FF8C00", bg:"rgba(255,140,0,0.1)",  border:"rgba(255,140,0,0.3)"  },
  fixed:    { label:"Giảm tiền", icon:"💸", color:"#3ecf6e", bg:"rgba(62,207,110,0.1)", border:"rgba(62,207,110,0.3)" },
  freeship: { label:"Free ship", icon:"🚚", color:"#4a8ff5", bg:"rgba(74,143,245,0.1)", border:"rgba(74,143,245,0.3)" },
}
const COMBO_CFG = { label:"Combo", icon:"🎁", color:"#a855f7", bg:"rgba(168,85,247,0.1)", border:"rgba(168,85,247,0.3)" }

function useCountdown(isoDate: string) {
  const [diff, setDiff] = useState(0)
  useEffect(() => {
    const tick = () => setDiff(Math.max(0, new Date(isoDate).getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isoDate])
  const days = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (diff <= 0) return { text: "Đã hết hạn", urgent: true, expired: true }
  if (days > 0)  return { text: `Còn ${days} ngày`, urgent: days <= 3, expired: false }
  return { text: `Còn ${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`, urgent: true, expired: false }
}

function VoucherCard({ v, onSave, onCopy, onUseNow }: { v: Voucher; onSave: () => void; onCopy: () => void; onUseNow: () => void }) {
  const countdown = useCountdown(v.validTo)
  const cfg = v.isCombo ? COMBO_CFG : TYPE_CFG[v.type]
  const totalLeft = v.usageLimit !== null ? Math.max(0, v.usageLimit - v.usedCount) : null
  const disabled  = v.used || countdown.expired || (totalLeft !== null && totalLeft <= 0)

  return (
    <motion.div layout initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
      style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${disabled?"rgba(255,255,255,0.07)":cfg.border}`,
        borderRadius:16, overflow:"hidden", opacity:disabled?0.55:1 }}>
      <div style={{ display:"flex" }}>
        {/* Left colour stripe */}
        <div style={{ width:6, background:disabled?"rgba(255,255,255,0.05)":cfg.bg, borderRight:`2px dashed ${disabled?"rgba(255,255,255,0.08)":cfg.border}` }} />
        {/* Content */}
        <div style={{ flex:1, padding:"12px 12px 12px 14px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:cfg.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
              {cfg.icon}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2, flexWrap:"wrap" }}>
                <Badge
                  layer={1}
                  variant={v.isCombo ? "combo" : v.type === "percent" ? "sale" : v.type === "fixed" ? "fire" : "partner"}
                  size="sm"
                />
                {v.shopName && (
                  <span style={{ fontSize: 10, color:"#6a5a40", background:"rgba(255,255,255,0.04)", padding:"1px 6px", borderRadius:4, border:"1px solid rgba(255,255,255,0.07)" }}>
                    {v.shopName}
                  </span>
                )}
              </div>
              <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700, marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {v.title}
              </div>

              {/* Combo: danh sách món bắt buộc */}
              {v.isCombo && v.comboItems.length > 0 && (
                <div style={{ marginBottom:8, padding:"8px 10px", borderRadius:10,
                  background:"rgba(168,85,247,0.06)", border:"1px solid rgba(168,85,247,0.18)" }}>
                  <div style={{ color:"#a855f7", fontSize:9.5, fontWeight:700, textTransform:"uppercase",
                    letterSpacing:0.6, marginBottom:5 }}>🛒 Điều kiện — phải có trong giỏ hàng</div>
                  {v.comboItems.map((ci, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"4px 0", borderBottom: i < v.comboItems.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ color:"#a855f7", fontSize:10 }}>✦</span>
                        <span style={{ color:"#f8f0e0", fontSize:11, fontWeight:600 }}>
                          {ci.products?.name ?? "Sản phẩm không tên"}
                        </span>
                        {ci.min_quantity > 1 && (
                          <span style={{ background:"rgba(168,85,247,0.15)", color:"#a855f7",
                            fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:4 }}>
                            ×{ci.min_quantity}
                          </span>
                        )}
                      </div>
                      {ci.products?.price != null && (
                        <span style={{ color:"#6a5a40", fontSize:10 }}>{fmt(ci.products.price)}</span>
                      )}
                    </div>
                  ))}
                  <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ color:"#a855f7", fontSize:10 }}>🎁</span>
                    <span style={{ color:"#a855f7", fontSize:10, fontWeight:700 }}>
                      Mua đủ combo · Giảm ngay {v.type === "percent" ? `${v.value}%` : fmt(v.value)}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ color:"#6a5a40", fontSize: 11, marginBottom:6, lineHeight:1.5 }}>
                {!v.isCombo && <>Đơn tối thiểu {fmt(v.minOrder)}</>}
                {v.maxDiscount && ` · Giảm tối đa ${fmt(v.maxDiscount)}`}
                {v.perUserLimit && ` · Mỗi người tối đa ${v.perUserLimit} lần`}
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontFamily:"'Courier New',monospace", background:"rgba(255,107,0,0.1)", border:"1px dashed rgba(255,107,0,0.3)", borderRadius:5, padding:"2px 8px", color:"#FF8C00", fontSize:10, fontWeight:700 }}>
                    {v.code}
                  </span>
                  <button onClick={onCopy} style={{ background:"none", border:"none", cursor:"pointer", color:"#6a5a40", fontSize:10, padding:0, fontFamily:"Lexend" }}>
                    📋
                  </button>
                </div>
                <div style={{ textAlign:"right", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
                  {countdown.urgent
                    ? <Badge layer={2} variant="expire-urgent" size="sm" label={countdown.text} />
                    : <div style={{ fontSize: 11, color:"#6a5a40" }}>{countdown.text}</div>
                  }
                  {totalLeft !== null && !countdown.expired && (
                    totalLeft <= 5
                      ? <Badge layer={2} variant="low-usage" size="sm" label={`Còn ${totalLeft} lượt`} />
                      : <div style={{ fontSize: 10, color:"#6a5a40" }}>Còn {totalLeft} lượt</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop:10, paddingTop:8, borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            {v.used ? (
              <span style={{ color:"#6a5a40", fontSize: 11 }}>✓ Đã sử dụng</span>
            ) : countdown.expired ? (
              <span style={{ color:"#ff4040", fontSize: 11 }}>✗ Đã hết hạn</span>
            ) : (totalLeft !== null && totalLeft <= 0) ? (
              <span style={{ color:"#ff4040", fontSize: 11 }}>✗ Đã hết lượt</span>
            ) : (
              <button onClick={onSave} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:4, padding:0, fontFamily:"Lexend" }}>
                <span style={{ fontSize:12 }}>{v.saved ? "💾" : "🔖"}</span>
                <span style={{ fontSize: 11, color:v.saved?"#FF8C00":"#6a5a40" }}>{v.saved ? "Đã lưu" : "Lưu mã"}</span>
              </button>
            )}
            {!disabled && (
              <button onClick={onUseNow} style={{ background: v.isCombo ? "linear-gradient(90deg,#a855f7,#7c3aed)" : "linear-gradient(90deg,#FF6B00,#FF8C00)", borderRadius:8, padding:"5px 14px", color:"#fff", fontSize: 11, fontWeight:700, boxShadow: v.isCombo ? "0 2px 8px rgba(168,85,247,0.35)" : "0 2px 8px rgba(255,107,0,0.3)", border:"none", cursor:"pointer", fontFamily:"Lexend" }}>
                {v.isCombo ? "🛒 Đặt combo →" : "Dùng ngay →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function VouchersPage() {
  const router = useRouter()
  const [vouchers, setVouchers]   = useState<Voucher[]>([])
  const [loading,  setLoading]    = useState(true)
  const [filter,   setFilter]     = useState<"all"|"saved"|"combo"|VoucherType>("all")
  const [code,     setCode]       = useState("")
  const [toast,    setToast]      = useState("")
  const [toastOk,  setToastOk]    = useState(true)

  const fireToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok)
    setTimeout(() => setToast(""), 2500)
  }

  // Fetch vouchers from DB
  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const now = new Date().toISOString()

      const { data: { user } } = await supabase.auth.getUser()

      const [{ data: vData }, { data: usages }, { data: shops }] = await Promise.all([
        supabase.from("vouchers")
          .select("id, code, title, discount_type, discount_value, min_order, max_discount, per_person_limit, usage_limit, used_count, valid_to, shop_id, is_combo, combo_items(product_id, min_quantity, products(name, price))")
          .eq("is_active", true)
          .gte("valid_to", now)
          .order("valid_to", { ascending: true }),
        user ? supabase.from("voucher_usages").select("voucher_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
        supabase.from("shops").select("id, name"),
      ])

      const usedSet  = new Set((usages ?? []).map((u: { voucher_id: string }) => u.voucher_id))
      const shopMap  = Object.fromEntries((shops ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))

      let savedIds: string[] = []
      try { savedIds = JSON.parse(localStorage.getItem("saved_voucher_ids") || "[]") } catch { /* */ }

      const mapped: Voucher[] = (vData ?? []).map((v: {
        id: string; code: string; title: string; discount_type: string; discount_value: number
        min_order: number; max_discount: number | null; per_person_limit: number | null
        usage_limit: number | null; used_count: number; valid_to: string; shop_id: string | null
        is_combo: boolean
        combo_items: { product_id: string; min_quantity: number; products: { name: string; price: number }[] | null }[] | null
      }) => ({
        id:           v.id,
        code:         v.code,
        title:        v.title,
        type:         v.discount_type as VoucherType,
        value:        v.discount_value,
        minOrder:     v.min_order,
        maxDiscount:  v.max_discount,
        perUserLimit: v.per_person_limit,
        usageLimit:   v.usage_limit,
        usedCount:    v.used_count,
        validTo:      v.valid_to,
        shopId:       v.shop_id,
        shopName:     v.shop_id ? (shopMap[v.shop_id] ?? null) : null,
        used:         usedSet.has(v.id),
        saved:        savedIds.includes(v.id),
        isCombo:      v.is_combo ?? false,
        comboItems:   (v.combo_items ?? []).map(ci => ({
          product_id:   ci.product_id,
          min_quantity: ci.min_quantity,
          products:     Array.isArray(ci.products) ? (ci.products[0] ?? null) : ci.products,
        })),
      }))

      setVouchers(mapped)
      setLoading(false)
    }
    load()
  }, [])

  const handleCopy = (c: string) => {
    navigator.clipboard.writeText(c).catch(() => {})
    fireToast(`Đã sao chép mã ${c}`)
  }

  const handleSave = (id: string) => {
    const v = vouchers.find(x => x.id === id)
    const willSave = !v?.saved
    setVouchers(vs => vs.map(x => x.id === id ? { ...x, saved: !x.saved } : x))
    try {
      const cur = JSON.parse(localStorage.getItem("saved_voucher_ids") || "[]") as string[]
      localStorage.setItem("saved_voucher_ids", JSON.stringify(
        willSave ? [...cur.filter(s => s !== id), id] : cur.filter(s => s !== id)
      ))
    } catch { /* */ }
    fireToast(willSave ? "Đã lưu mã thành công!" : "Đã bỏ lưu mã")
  }

  const handleUseNow = (v: Voucher) => {
    // Lưu voucher vào sessionStorage để checkout tự động gợi ý áp dụng
    try {
      sessionStorage.setItem("pending_voucher", JSON.stringify({ code: v.code, title: v.title, type: v.type, value: v.value }))
    } catch { /* */ }
    if (v.shopId) {
      router.push(`/shop/${v.shopId}`)
    } else {
      router.push("/")
    }
  }

  const handleApply = () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    const found = vouchers.find(v => v.code === trimmed)
    if (found && !found.used && new Date(found.validTo) > new Date()) {
      fireToast(`Áp dụng mã ${trimmed} thành công!`)
      setCode("")
    } else {
      fireToast("Mã không hợp lệ, đã dùng hoặc hết hạn", false)
    }
  }

  const filtered = vouchers.filter(v => {
    if (filter === "saved")  return v.saved
    if (filter === "combo")  return v.isCombo
    if (filter === "all")    return true
    return v.type === filter && !v.isCombo
  })

  const FILTERS = [
    { v:"all" as const,      l:"Tất cả" },
    { v:"saved" as const,    l:"Đã lưu" },
    { v:"combo" as const,    l:"🎁 Combo" },
    { v:"freeship" as const, l:"Free ship" },
    { v:"percent" as const,  l:"Giảm %" },
    { v:"fixed" as const,    l:"Giảm tiền" },
  ]

  const activeCount = vouchers.filter(v => !v.used && new Date(v.validTo) > new Date()).length

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%;overflow:hidden}
        input{outline:none;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:.15}}
      `}</style>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-14 }}
            style={{ position:"fixed", top:52, left:"50%", transform:"translateX(-50%)", zIndex:999, whiteSpace:"nowrap",
              background:toastOk?"rgba(62,207,110,0.15)":"rgba(255,64,64,0.15)",
              border:`1px solid ${toastOk?"rgba(62,207,110,0.35)":"rgba(255,64,64,0.35)"}`,
              borderRadius:12, padding:"7px 18px", color:toastOk?"#3ecf6e":"#ff4040",
              fontSize:11, fontWeight:600, backdropFilter:"blur(10px)" }}>
            {toastOk ? "✓" : "✗"} {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position:"fixed", inset:0, background:"#080806", display:"flex", flexDirection:"column", fontFamily:"'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"calc(env(safe-area-inset-top) + 12px) 16px 0", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <a href="/" style={{ width:32, height:32, borderRadius:9, textDecoration:"none", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>Kho Voucher</div>
              <div style={{ color:"#6a5a40", fontSize: 11 }}>
                {loading ? "Đang tải..." : `${activeCount} mã đang có hiệu lực`}
              </div>
            </div>
          </div>

          {/* Manual code input */}
          <div style={{ display:"flex", gap:7, marginBottom:12 }}>
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.04)", border:`1px solid ${code?"rgba(255,107,0,0.45)":"rgba(255,255,255,0.08)"}`, borderRadius:12, padding:"0 12px", height:42, transition:"all .2s", boxShadow:code?"0 0 0 3px rgba(255,107,0,0.09)":"none" }}>
              <span style={{ color:"#6a5a40", fontSize:14 }}>🎫</span>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key==="Enter" && handleApply()} placeholder="Nhập mã voucher..."
                style={{ flex:1, background:"transparent", border:"none", color:"#f8f0e0", fontSize:12, letterSpacing:1 }} />
              {code && <button onClick={() => setCode("")} style={{ background:"none", border:"none", cursor:"pointer", color:"#6a5a40", fontSize:14, padding:0 }}>×</button>}
            </div>
            <button onClick={handleApply} disabled={!code} style={{ height:42, padding:"0 16px", borderRadius:12, border:"none", background:code?"linear-gradient(90deg,#FF6B00,#FF8C00)":"rgba(255,255,255,0.07)", color:code?"#fff":"#6a5a40", fontSize:11, fontWeight:700, fontFamily:"Lexend", cursor:code?"pointer":"default", boxShadow:code?"0 2px 10px rgba(255,107,0,0.35)":"none" }}>
              Áp dụng
            </button>
          </div>

          {/* Filter chips */}
          <div style={{ display:"flex", gap:5, overflowX:"auto", scrollbarWidth:"none", paddingBottom:12 } as React.CSSProperties}>
            {FILTERS.map(f => (
              <div key={f.v} onClick={() => setFilter(f.v)} style={{ padding:"4px 12px", borderRadius:20, cursor:"pointer", flexShrink:0, background:filter===f.v?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)", border:`1px solid ${filter===f.v?"rgba(255,107,0,0.35)":"rgba(255,255,255,0.07)"}`, color:filter===f.v?"#FF8C00":"#6a5a40", fontSize: 11, fontWeight:filter===f.v?700:400, transition:"all .15s" }}>
                {f.l}
              </div>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px 88px", WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:7, marginBottom:14 }}>
            {[
              { label:"Đang có",  value: activeCount,                              color:"#3ecf6e" },
              { label:"Đã lưu",   value: vouchers.filter(v=>v.saved).length,       color:"#FF8C00" },
              { label:"Đã dùng",  value: vouchers.filter(v=>v.used).length,        color:"#6a5a40" },
            ].map(s => (
              <div key={s.label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"9px 10px", textAlign:"center" }}>
                <div style={{ color:s.color, fontSize:20, fontWeight:800 }}>{loading ? "—" : s.value}</div>
                <div style={{ color:"#6a5a40", fontSize: 11, marginTop:1 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Cards */}
          {loading ? (
            Array.from({ length: 4 }).map((_,i) => (
              <div key={i} style={{ height:130, borderRadius:16, background:"rgba(255,255,255,0.04)", marginBottom:8, animation:"pulse 1.5s infinite" }} />
            ))
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ textAlign:"center", padding:"40px 0", color:"#6a5a40" }}>
                    <div style={{ fontSize:40, marginBottom:8 }}>🎫</div>
                    <div style={{ fontSize:12 }}>{vouchers.length===0 ? "Chưa có voucher nào" : "Không có voucher phù hợp"}</div>
                  </motion.div>
                ) : filtered.map(v => (
                  <motion.div key={v.id} layout initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}>
                    <NewVoucherCard
                      voucher={voucherToItem(v)}
                      onSave={(id) => handleSave(id)}
                      onApply={(id) => { const found = vouchers.find(x => x.id === id); if (found) handleUseNow(found) }}
                      onViewCombo={v.isCombo && v.shopId ? () => handleUseNow(v) : undefined}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <div style={{ position:"absolute", bottom:"max(16px,env(safe-area-inset-bottom))", left:14, right:14, height:56, background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999, display:"flex", alignItems:"center", justifyContent:"space-around", padding:"0 6px", zIndex:50, boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            { icon:"🏠", label:"Trang chủ", href:"/",        active:false },
            { icon:"📋", label:"Đơn hàng",  href:"/orders",  active:false },
            { icon:"🛒", label:"Giỏ hàng",  href:"/cart",    active:false },
            { icon:"⚙️", label:"Cài đặt",   href:"/profile",active:false },
          ].map(tab => (
            <a key={tab.href} href={tab.href} style={{ textDecoration:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18, background:tab.active?"rgba(255,107,0,0.12)":"transparent" }}>
              <span style={{ fontSize:19 }}>{tab.icon}</span>
              <span style={{ fontSize: 10, color:"#6a5a40" }}>{tab.label}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
