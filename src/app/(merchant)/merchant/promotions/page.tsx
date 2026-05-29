"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

type PromoType = "percent" | "fixed" | "freeship" | "combo"
type PromoStatus = "active" | "scheduled" | "ended"

interface PickerProduct { id: string; name: string; price: number; category: string }

interface ComboItem { productId: string; minQty: number; productName?: string; productPrice?: number }

interface Promotion {
  id: string
  title: string
  type: PromoType
  value: number
  minOrder: number
  maxDiscount: number | null
  usageLimit: number | null
  perPersonLimit: number | null
  usedCount: number
  startAt: string
  endAt: string
  status: PromoStatus
  productIds: string[]
  applyAll: boolean
  comboItems: ComboItem[]
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function genCode() {
  return "GN" + Math.random().toString(36).substring(2, 8).toUpperCase()
}

function deriveStatus(v: { is_active: boolean; valid_from: string; valid_to: string }): PromoStatus {
  const now = new Date()
  if (!v.is_active || new Date(v.valid_to) < now) return "ended"
  if (new Date(v.valid_from) > now) return "scheduled"
  return "active"
}

const TYPE_CFG: Record<PromoType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  percent:  { label:"Giảm %",    icon:"🏷️", color:"#FF8C00", bg:"rgba(255,140,0,0.12)",  border:"rgba(255,140,0,0.35)"  },
  fixed:    { label:"Giảm tiền", icon:"💸", color:"#3ecf6e", bg:"rgba(62,207,110,0.12)", border:"rgba(62,207,110,0.35)" },
  freeship: { label:"Free ship", icon:"🚚", color:"#4a8ff5", bg:"rgba(74,143,245,0.12)", border:"rgba(74,143,245,0.35)" },
  combo:    { label:"Combo",     icon:"🎁", color:"#b464ff", bg:"rgba(180,100,255,0.12)",border:"rgba(180,100,255,0.35)"},
}

const STATUS_CFG: Record<PromoStatus, { label: string; color: string; bg: string }> = {
  active:    { label:"Đang chạy",   color:"#3ecf6e", bg:"rgba(62,207,110,0.12)"  },
  scheduled: { label:"Lên lịch",    color:"#f5c542", bg:"rgba(245,197,66,0.12)"  },
  ended:     { label:"Đã kết thúc", color:"#6a5a40", bg:"rgba(255,255,255,0.06)"},
}

export default function MerchantPromotionsPage() {
  const supabase = createClient()

  const [shopId, setShopId]             = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [promos, setPromos]             = useState<Promotion[]>([])
  const [pickerProducts, setPickerProducts] = useState<PickerProduct[]>([])
  const [filter, setFilter]             = useState<"all" | PromoStatus>("all")
  const [showCreate, setShowCreate]     = useState(false)
  const [selected, setSelected]         = useState<Promotion | null>(null)
  const [toast, setToast]               = useState("")
  const [toastErr, setToastErr]         = useState(false)

  const [form, setForm] = useState({
    title: "", code: genCode(), type: "percent" as PromoType, value: "", minOrder: "", maxDiscount: "",
    usageLimit: "", perPersonLimit: "", startAt: "", endAt: "", applyAll: true,
    selectedProductIds: [] as string[],
    comboItems: [] as ComboItem[],
  })

  const loadData = useCallback(async (sid: string) => {
    const [{ data: vouchers, error: vErr }, { data: products }] = await Promise.all([
      supabase.from("vouchers")
        .select("id,title,discount_type,discount_value,min_order,max_discount,usage_limit,per_person_limit,used_count,valid_from,valid_to,is_active,is_combo")
        .eq("shop_id", sid)
        .order("created_at", { ascending: false }),
      supabase.from("products")
        .select("id,name,price,category")
        .eq("shop_id", sid)
        .eq("is_available", true)
        .order("sort_order"),
    ])
    if (vErr) console.error("[promotions] load error:", vErr)
    if (vouchers) {
      const voucherIds = vouchers.map(v => v.id)
      let comboMap: Record<string, ComboItem[]> = {}
      if (voucherIds.length > 0) {
        const { data: ciRows } = await supabase
          .from("combo_items")
          .select("voucher_id,product_id,min_quantity,products(name,price)")
          .in("voucher_id", voucherIds)
        if (ciRows) {
          ciRows.forEach((r: { voucher_id: string; product_id: string; min_quantity: number; products: { name: string; price: number }[] | null }) => {
            if (!comboMap[r.voucher_id]) comboMap[r.voucher_id] = []
            const prod = Array.isArray(r.products) ? r.products[0] : r.products
            comboMap[r.voucher_id].push({
              productId: r.product_id,
              minQty: r.min_quantity,
              productName: (prod as {name:string;price:number} | null)?.name,
              productPrice: (prod as {name:string;price:number} | null)?.price,
            })
          })
        }
      }
      setPromos(vouchers.map(v => ({
        id: v.id,
        title: v.title,
        type: v.is_combo ? "combo" : (v.discount_type as PromoType) ?? "percent",
        value: v.discount_value,
        minOrder: v.min_order,
        maxDiscount: v.max_discount,
        usageLimit: v.usage_limit,
        perPersonLimit: v.per_person_limit ?? null,
        usedCount: v.used_count,
        startAt: v.valid_from,
        endAt: v.valid_to,
        status: deriveStatus(v),
        productIds: [],
        applyAll: true,
        comboItems: comboMap[v.id] ?? [],
      })))
    }
    if (products) {
      setPickerProducts(products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category ?? "Khác",
      })))
    }
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: shop } = await supabase.from("shops")
        .select("id").eq("owner_id", user.id).single()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)
      await loadData(shop.id)
      setLoading(false)
    }
    init()
  }, [loadData, supabase])

  const productsByCategory = useMemo(() =>
    pickerProducts.reduce<Record<string, PickerProduct[]>>((acc, p) => {
      if (!acc[p.category]) acc[p.category] = []
      acc[p.category].push(p)
      return acc
    }, {}),
  [pickerProducts])

  const toggleProduct = (id: string) =>
    setForm(f => ({
      ...f,
      selectedProductIds: f.selectedProductIds.includes(id)
        ? f.selectedProductIds.filter(x => x !== id)
        : [...f.selectedProductIds, id],
    }))

  const fireToast = (msg: string, err = false) => { setToast(msg); setToastErr(err); setTimeout(() => setToast(""), 2400) }

  const toggleStatus = async (id: string) => {
    const p = promos.find(x => x.id === id)
    if (!p) return
    const nowActive = p.status === "active"
    setPromos(ps => ps.map(x => x.id !== id ? x : { ...x, status: nowActive ? "ended" : "active" }))
    const { error } = await supabase.from("vouchers")
      .update({ is_active: !nowActive })
      .eq("id", id)
    if (error) {
      setPromos(ps => ps.map(x => x.id !== id ? x : { ...x, status: p.status }))
      fireToast("Lỗi cập nhật trạng thái!", true)
    } else {
      fireToast(nowActive ? "Đã tắt chương trình" : "Đã bật chương trình")
    }
  }

  const deletePromo = async (id: string) => {
    const backup = promos
    setPromos(ps => ps.filter(p => p.id !== id))
    setSelected(null)
    const { error } = await supabase.from("vouchers").delete().eq("id", id)
    if (error) {
      setPromos(backup)
      fireToast("Lỗi xoá!", true)
    } else {
      fireToast("Đã xoá chương trình khuyến mãi")
    }
  }

  const setComboItemQty = (productId: string, qty: number) => {
    setForm(f => {
      if (qty <= 0) return { ...f, comboItems: f.comboItems.filter(c => c.productId !== productId) }
      const existing = f.comboItems.find(c => c.productId === productId)
      if (existing) return { ...f, comboItems: f.comboItems.map(c => c.productId === productId ? { ...c, minQty: qty } : c) }
      const prod = pickerProducts.find(p => p.id === productId)
      return { ...f, comboItems: [...f.comboItems, { productId, minQty: qty, productName: prod?.name, productPrice: prod?.price }] }
    })
  }

  const handleCreate = async () => {
    if (!form.title || !form.startAt || !form.endAt || !shopId) return
    if (form.type === "combo" && form.comboItems.length === 0) {
      fireToast("Chọn ít nhất 1 món cho combo!", true); return
    }
    if (form.type !== "combo" && !form.applyAll && form.selectedProductIds.length === 0) {
      fireToast("Vui lòng chọn ít nhất 1 món!", true); return
    }
    if (new Date(form.endAt) <= new Date(form.startAt)) {
      fireToast("Ngày kết thúc phải sau ngày bắt đầu!", true); return
    }
    if (form.type === "percent") {
      const pct = parseInt(form.value) || 0
      if (pct <= 0 || pct > 100) { fireToast("Phần trăm giảm phải từ 1–100", true); return }
    }
    if (form.type === "fixed" || form.type === "combo") {
      const amt = parseInt(form.value) || 0
      if (amt <= 0) { fireToast("Số tiền giảm phải lớn hơn 0đ!", true); return }
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date()
    const start = new Date(form.startAt)
    const dbType = form.type === "combo" ? "fixed" : form.type
    const insertPayload: Record<string, unknown> = {
      code: form.code.trim().toUpperCase() || genCode(),
      title: form.title,
      discount_type: dbType,
      discount_value: parseInt(form.value) || 0,
      min_order: parseInt(form.minOrder) || 0,
      max_discount: form.maxDiscount ? parseInt(form.maxDiscount) : null,
      usage_limit: form.usageLimit ? parseInt(form.usageLimit) : null,
      per_person_limit: form.perPersonLimit ? parseInt(form.perPersonLimit) : null,
      valid_from: new Date(form.startAt).toISOString(),
      valid_to: new Date(form.endAt).toISOString(),
      is_active: true,
      is_combo: form.type === "combo",
      shop_id: shopId,
    }
    const { data, error } = await supabase.from("vouchers").insert(insertPayload)
      .select("id,title,discount_type,discount_value,min_order,max_discount,usage_limit,used_count,valid_from,valid_to,is_active").single()
    if (error || !data) {
      setSaving(false)
      console.error("[promotions] insert error:", error)
      fireToast("Lỗi: " + (error?.message ?? "không tạo được chương trình"), true)
      return
    }

    // Lưu combo_items nếu bảng tồn tại
    if (form.type === "combo" && form.comboItems.length > 0) {
      await supabase.from("combo_items").insert(
        form.comboItems.map(ci => ({
          voucher_id: data.id,
          product_id: ci.productId,
          min_quantity: ci.minQty,
        }))
      ).then(() => { /* ignore error nếu bảng chưa tạo */ })
    }

    setSaving(false)
    const newPromo: Promotion = {
      id: data.id,
      title: data.title,
      type: form.type,
      value: data.discount_value,
      minOrder: data.min_order,
      maxDiscount: data.max_discount,
      usageLimit: data.usage_limit,
      perPersonLimit: form.perPersonLimit ? parseInt(form.perPersonLimit) : null,
      usedCount: 0,
      startAt: data.valid_from,
      endAt: data.valid_to,
      status: start > now ? "scheduled" : "active",
      productIds: form.applyAll ? [] : form.selectedProductIds,
      applyAll: form.applyAll,
      comboItems: form.comboItems,
    }
    setPromos(ps => [newPromo, ...ps])
    setForm({ title:"", code:genCode(), type:"percent", value:"", minOrder:"", maxDiscount:"", usageLimit:"", perPersonLimit:"", startAt:"", endAt:"", applyAll:true, selectedProductIds:[], comboItems:[] })
    setShowCreate(false)
    fireToast("Tạo chương trình khuyến mãi thành công!")
  }

  const filtered = promos.filter(p => filter === "all" ? true : p.status === filter)
  const totalActive   = promos.filter(p => p.status === "active").length
  const totalUsed     = promos.reduce((s, p) => s + p.usedCount, 0)
  const totalRevImpact = promos.filter(p => p.status === "active").reduce((s, p) => s + p.usedCount * (p.type === "fixed" ? p.value : 15000), 0)

  if (loading) {
    return (
      <div style={{ position:"fixed", inset:0, background:"#080806",
        display:"flex", alignItems:"center", justifyContent:"center",
        flexDirection:"column", gap:12, fontFamily:"'Lexend',sans-serif" }}>
        <div style={{ width:36, height:36, borderRadius:"50%",
          border:"3px solid rgba(255,107,0,0.2)",
          borderTop:"3px solid #FF6B00",
          animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ color:"#6a5a40", fontSize:11 }}>Đang tải khuyến mãi...</div>
      </div>
    )
  }

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
            style={{ position:"fixed", top:"calc(env(safe-area-inset-top) + 64px)", left:"50%", transform:"translateX(-50%)",
              zIndex:999, whiteSpace:"nowrap",
              background: toastErr ? "rgba(255,64,64,0.15)" : "rgba(62,207,110,0.15)",
              border: toastErr ? "1px solid rgba(255,64,64,0.35)" : "1px solid rgba(62,207,110,0.35)",
              borderRadius:12, padding:"7px 18px",
              color: toastErr ? "#ff4040" : "#3ecf6e",
              fontSize:11, fontWeight:600, backdropFilter:"blur(10px)" }}>
            {toastErr ? "✕" : "✓"} {toast}
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
                  borderRadius:2, margin:"0 auto 12px" }} />
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:700 }}>
                    ➕ Tạo chương trình khuyến mãi
                  </div>
                  <button onClick={() => setShowCreate(false)}
                    style={{ width:32, height:32, borderRadius:9, border:"none",
                      background:"rgba(255,255,255,0.06)", color:"#6a5a40",
                      fontSize:18, cursor:"pointer", display:"flex",
                      alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    ×
                  </button>
                </div>
              </div>

              <div style={{ flex:1, overflowY:"auto", padding:"0 18px 32px" }}>
                {/* Tên */}
                <MLabel>Tên chương trình</MLabel>
                <MInput value={form.title} onChange={v => setForm(f => ({ ...f, title:v }))}
                  placeholder="VD: Flash Sale cuối tuần" />

                {/* Mã voucher */}
                <MLabel>Mã voucher</MLabel>
                <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                  <div style={{ flex:1, display:"flex", alignItems:"center",
                    background:"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:11, padding:"0 12px", height:42 }}>
                    <input value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g,"") }))}
                      placeholder="VD: SALE50"
                      maxLength={20}
                      style={{ flex:1, background:"transparent", border:"none",
                        color:"#FF8C00", fontSize:13, fontWeight:700, letterSpacing:1,
                        fontFamily:"monospace" }} />
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, code: genCode() }))}
                    style={{ padding:"0 12px", height:42, borderRadius:11, border:"none",
                      background:"rgba(255,255,255,0.07)", color:"#6a5a40",
                      fontSize:10, cursor:"pointer", fontFamily:"Lexend", whiteSpace:"nowrap" }}>
                    🎲 Tạo ngẫu nhiên
                  </button>
                </div>

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
                {form.type !== "freeship" && (
                  <>
                    <MLabel>{form.type === "percent" ? "Phần trăm giảm (%)" : "Số tiền giảm khi mua combo (đ)"}</MLabel>
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
                <MLabel>Tổng lượt dùng</MLabel>
                <MInput value={form.usageLimit} onChange={v => setForm(f => ({ ...f, usageLimit:v }))}
                  type="number" placeholder="Bỏ trống = không giới hạn" />

                {/* Per-person limit */}
                <MLabel>Giới hạn/người</MLabel>
                <MInput value={form.perPersonLimit} onChange={v => setForm(f => ({ ...f, perPersonLimit:v }))}
                  type="number" placeholder="VD: 1 (bỏ trống = không giới hạn)" />

                {/* Date range */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                  <div>
                    <MLabel>Bắt đầu</MLabel>
                    <input type="datetime-local" value={form.startAt}
                      onChange={e => setForm(f => ({ ...f, startAt:e.target.value }))}
                      style={{ width:"100%", height:42, borderRadius:11, border:"1px solid rgba(255,255,255,0.08)",
                        background:"rgba(255,255,255,0.04)", color:"#f8f0e0", fontSize:11,
                        padding:"0 10px", boxSizing:"border-box", colorScheme:"dark" }} />
                  </div>
                  <div>
                    <MLabel>Kết thúc</MLabel>
                    <input type="datetime-local" value={form.endAt}
                      onChange={e => setForm(f => ({ ...f, endAt:e.target.value }))}
                      style={{ width:"100%", height:42, borderRadius:11, border:"1px solid rgba(255,255,255,0.08)",
                        background:"rgba(255,255,255,0.04)", color:"#f8f0e0", fontSize:11,
                        padding:"0 10px", boxSizing:"border-box", colorScheme:"dark" }} />
                  </div>
                </div>

                {/* Combo picker — chỉ hiện khi type = combo */}
                {form.type === "combo" && (
                  <div style={{ marginBottom:18 }}>
                    <MLabel>Món trong combo <span style={{ color:"#6a5a40", fontSize:8.5, fontWeight:400 }}>(đặt số lượng tối thiểu)</span></MLabel>
                    {pickerProducts.length === 0 ? (
                      <div style={{ padding:"14px", textAlign:"center", color:"#6a5a40", fontSize:10,
                        background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12 }}>
                        Chưa có sản phẩm nào trong menu
                      </div>
                    ) : (
                      <div style={{ background:"rgba(180,100,255,0.04)", border:"1px solid rgba(180,100,255,0.2)", borderRadius:12, overflow:"hidden" }}>
                        {pickerProducts.map((prod, pi) => {
                          const ci = form.comboItems.find(c => c.productId === prod.id)
                          const qty = ci?.minQty ?? 0
                          const isLast = pi === pickerProducts.length - 1
                          return (
                            <div key={prod.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                              borderBottom:isLast?"none":"1px solid rgba(255,255,255,0.05)",
                              background:qty>0?"rgba(180,100,255,0.06)":"transparent", transition:"background .15s" }}>
                              <div style={{ flex:1 }}>
                                <div style={{ color:qty>0?"#f8f0e0":"#b0956a", fontSize:11, fontWeight:qty>0?600:400 }}>{prod.name}</div>
                                <div style={{ color:"#6a5a40", fontSize:9 }}>{prod.price.toLocaleString("vi-VN")}đ</div>
                              </div>
                              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                                <button onClick={() => setComboItemQty(prod.id, qty - 1)}
                                  style={{ width:28, height:28, borderRadius:7, border:"none",
                                    background:qty>0?"rgba(180,100,255,0.2)":"rgba(255,255,255,0.06)",
                                    color:qty>0?"#b464ff":"#6a5a40", fontSize:16, cursor:"pointer",
                                    display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Lexend" }}>−</button>
                                <span style={{ fontSize:12, fontWeight:700, color:qty>0?"#b464ff":"#6a5a40",
                                  minWidth:18, textAlign:"center" }}>{qty}</span>
                                <button onClick={() => setComboItemQty(prod.id, qty + 1)}
                                  style={{ width:28, height:28, borderRadius:7, border:"none",
                                    background:"rgba(180,100,255,0.2)", color:"#b464ff", fontSize:16, cursor:"pointer",
                                    display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Lexend" }}>+</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {form.comboItems.length === 0 && pickerProducts.length > 0 && (
                      <div style={{ marginTop:6, color:"rgba(255,64,64,0.7)", fontSize:9 }}>⚠ Đặt số lượng ≥ 1 cho ít nhất 1 món</div>
                    )}
                    {form.comboItems.length > 0 && (
                      <div style={{ marginTop:6, color:"#b464ff", fontSize:9 }}>
                        ✓ {form.comboItems.length} món trong combo · giảm {fmt(parseInt(form.value)||0)} khi mua đủ
                      </div>
                    )}
                  </div>
                )}

                {/* Apply scope — chỉ hiện khi KHÔNG phải combo */}
                {form.type !== "combo" && (
                  <>
                    <MLabel>Áp dụng cho</MLabel>
                    <div style={{ display:"flex", gap:6, marginBottom:form.applyAll ? 18 : 10 }}>
                      <div onClick={() => setForm(f => ({ ...f, applyAll: true }))}
                        style={{ flex:1, height:40, borderRadius:10, cursor:"pointer",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          background:form.applyAll?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                          border:`1px solid ${form.applyAll?"rgba(255,107,0,0.35)":"rgba(255,255,255,0.08)"}`,
                          color:form.applyAll?"#FF8C00":"#6a5a40",
                          fontSize:10, fontWeight:form.applyAll?700:400, transition:"all .15s" }}>
                        Tất cả món
                      </div>
                      <div onClick={() => setForm(f => ({ ...f, applyAll: false }))}
                        style={{ flex:1, height:40, borderRadius:10, cursor:"pointer", position:"relative",
                          display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                          background:!form.applyAll?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                          border:`1px solid ${!form.applyAll?"rgba(255,107,0,0.35)":"rgba(255,255,255,0.08)"}`,
                          color:!form.applyAll?"#FF8C00":"#6a5a40",
                          fontSize:10, fontWeight:!form.applyAll?700:400, transition:"all .15s" }}>
                        Món được chọn
                        {!form.applyAll && form.selectedProductIds.length > 0 && (
                          <span style={{ width:16, height:16, borderRadius:"50%",
                            background:"#FF6B00", color:"#fff", fontSize:8, fontWeight:800,
                            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            {form.selectedProductIds.length}
                          </span>
                        )}
                      </div>
                    </div>
                    {!form.applyAll && (
                      <div style={{ marginBottom:18 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                          <div style={{ color:"rgba(176,149,106,0.6)", fontSize:9.5 }}>
                            Chọn món áp dụng {form.selectedProductIds.length > 0 && `(${form.selectedProductIds.length} món)`}
                          </div>
                          {form.selectedProductIds.length > 0 && (
                            <button onClick={() => setForm(f => ({ ...f, selectedProductIds:[] }))}
                              style={{ background:"none", border:"none", color:"#6a5a40", fontSize:9, cursor:"pointer", fontFamily:"Lexend" }}>
                              Bỏ chọn tất cả
                            </button>
                          )}
                        </div>
                        {pickerProducts.length === 0 ? (
                          <div style={{ padding:"16px", textAlign:"center", color:"#6a5a40", fontSize:10,
                            background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12 }}>
                            Chưa có sản phẩm nào trong menu
                          </div>
                        ) : (
                          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, overflow:"hidden" }}>
                            {Object.entries(productsByCategory).map(([cat, items], ci) => (
                              <div key={cat}>
                                <div style={{ padding:"7px 12px", background:"rgba(255,255,255,0.02)",
                                  borderBottom:"1px solid rgba(255,255,255,0.05)",
                                  color:"#6a5a40", fontSize:8.5, fontWeight:700, letterSpacing:".3px", textTransform:"uppercase" }}>
                                  {cat}
                                </div>
                                {items.map((prod, pi) => {
                                  const checked = form.selectedProductIds.includes(prod.id)
                                  const isLast = ci === Object.keys(productsByCategory).length - 1 && pi === items.length - 1
                                  return (
                                    <div key={prod.id} onClick={() => toggleProduct(prod.id)}
                                      style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                                        borderBottom:isLast?"none":"1px solid rgba(255,255,255,0.05)",
                                        background:checked?"rgba(255,107,0,0.04)":"transparent",
                                        cursor:"pointer", transition:"background .15s" }}>
                                      <div style={{ width:20, height:20, borderRadius:6, flexShrink:0,
                                        background:checked?"#FF6B00":"rgba(255,255,255,0.06)",
                                        border:`1.5px solid ${checked?"#FF6B00":"rgba(255,255,255,0.12)"}`,
                                        display:"flex", alignItems:"center", justifyContent:"center",
                                        fontSize:10, transition:"all .15s" }}>
                                        {checked && <span style={{ color:"#fff", fontSize:9, fontWeight:900 }}>✓</span>}
                                      </div>
                                      <div style={{ flex:1 }}>
                                        <div style={{ color:checked?"#f8f0e0":"#b0956a", fontSize:11, fontWeight:checked?600:400 }}>{prod.name}</div>
                                      </div>
                                      <div style={{ color:"#6a5a40", fontSize:9.5, flexShrink:0 }}>{prod.price.toLocaleString("vi-VN")}đ</div>
                                    </div>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                        {form.selectedProductIds.length === 0 && pickerProducts.length > 0 && (
                          <div style={{ marginTop:6, color:"rgba(255,64,64,0.7)", fontSize:9 }}>⚠ Chọn ít nhất 1 món để tiếp tục</div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <button onClick={handleCreate} disabled={saving || !form.title || !form.startAt || !form.endAt ||
                  (form.type === "combo" && form.comboItems.length === 0) ||
                  (form.type !== "combo" && !form.applyAll && form.selectedProductIds.length === 0 && pickerProducts.length > 0)}
                  style={{ width:"100%", height:48, borderRadius:13, border:"none",
                    background:"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
                    color:"#fff", fontSize:12, fontWeight:700, fontFamily:"Lexend",
                    cursor:saving?"not-allowed":"pointer", position:"relative", overflow:"hidden",
                    boxShadow:"0 3px 16px rgba(255,107,0,0.4)",
                    opacity:(saving||!form.title||!form.startAt||!form.endAt||(form.type==="combo"&&form.comboItems.length===0)||(form.type!=="combo"&&!form.applyAll&&form.selectedProductIds.length===0&&pickerProducts.length>0))?0.5:1 }}>
                  <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
                    background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                    animation:"shimmer 2.5s infinite" }} />
                  <span style={{ position:"relative", zIndex:1 }}>
                    {saving ? "Đang lưu..." : "🚀 Tạo chương trình"}
                  </span>
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

              <div style={{ padding:"16px 16px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
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
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
                  {[
                    { label:"Đã dùng",      value:`${selected.usedCount}/${selected.usageLimit ?? "∞"}`, color:"#FF8C00" },
                    { label:"Áp dụng",       value:selected.applyAll?"Tất cả món":"Món chọn",            color:"#4a8ff5" },
                    { label:"Đơn tối thiểu", value:fmt(selected.minOrder),                               color:"#b0956a" },
                    { label:"Giảm tối đa",   value:selected.maxDiscount?fmt(selected.maxDiscount):"Không giới hạn", color:"#b0956a" },
                  ].map(s => (
                    <div key={s.label} style={{ background:"rgba(255,255,255,0.03)",
                      border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:"9px 10px" }}>
                      <div style={{ color:s.color, fontSize:11, fontWeight:700 }}>{s.value}</div>
                      <div style={{ color:"#6a5a40", fontSize:7.5, marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {selected.usageLimit !== null && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ color:"#6a5a40", fontSize:9 }}>Tỉ lệ sử dụng</span>
                      <span style={{ color:"#FF8C00", fontSize:9, fontWeight:700 }}>
                        {Math.round((selected.usedCount / selected.usageLimit) * 100)}%
                      </span>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:3,
                        width:`${Math.min(100,(selected.usedCount/selected.usageLimit)*100)}%`,
                        background:"linear-gradient(90deg,#FF6B00,#FFB347)", transition:"width .5s" }} />
                    </div>
                  </div>
                )}

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

                {/* Combo items detail */}
                {selected.type === "combo" && selected.comboItems.length > 0 && (
                  <div style={{ background:"rgba(180,100,255,0.06)", border:"1px solid rgba(180,100,255,0.2)",
                    borderRadius:10, padding:"10px 12px", marginBottom:14 }}>
                    <div style={{ color:"#b464ff", fontSize:9, fontWeight:700, marginBottom:8 }}>🎁 Các món trong combo</div>
                    {selected.comboItems.map(ci => (
                      <div key={ci.productId} style={{ display:"flex", justifyContent:"space-between",
                        alignItems:"center", marginBottom:5 }}>
                        <span style={{ color:"#f8f0e0", fontSize:10 }}>{ci.productName ?? ci.productId}</span>
                        <span style={{ color:"#b464ff", fontSize:9, fontWeight:700,
                          background:"rgba(180,100,255,0.15)", borderRadius:5, padding:"2px 7px" }}>
                          ×{ci.minQty}
                        </span>
                      </div>
                    ))}
                    <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid rgba(180,100,255,0.15)",
                      color:"#6a5a40", fontSize:8.5 }}>
                      Giảm <span style={{ color:"#b464ff", fontWeight:700 }}>{fmt(selected.value)}</span> khi mua đủ combo
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding:"12px 16px 28px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
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
          padding:"calc(env(safe-area-inset-top) + 12px) 16px 12px", flexShrink:0 }}>
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
              { label:"Đang chạy",     value:String(totalActive),  color:"#3ecf6e" },
              { label:"Tổng lượt dùng",value:String(totalUsed),    color:"#FF8C00" },
              { label:"Ưu đãi đã trao",value:fmt(totalRevImpact),  color:"#b464ff" },
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
                <div style={{ fontSize:10, marginTop:4 }}>Nhấn "+ Tạo mới" để bắt đầu</div>
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
