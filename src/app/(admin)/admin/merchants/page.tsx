"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

type ShopStatus = "pending" | "approved" | "suspended"

interface Merchant {
  id: string
  shopName: string
  ownerName: string
  phone: string
  address: string
  category: string
  categoryIcon: string
  status: ShopStatus
  registeredDate: string
  commissionRate: number
  rating: number | null
  totalOrders: number
  isOpen: boolean
  coverColor: string
  ownerId: string
  description: string
  openTime: string
  closeTime: string
}

interface EditShop {
  name: string; phone: string; address: string
  category: string; commissionRate: number; isOpen: boolean
  openTime: string; closeTime: string; description: string
}

const STATUS_CFG: Record<ShopStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:   { label: "Chờ duyệt",      color: "#FFB347", bg: "rgba(255,179,71,0.12)",  border: "rgba(255,179,71,0.3)"  },
  approved:  { label: "Đang hoạt động", color: "#3ecf6e", bg: "rgba(62,207,110,0.10)",  border: "rgba(62,207,110,0.25)" },
  suspended: { label: "Tạm khóa",       color: "#ff4040", bg: "rgba(255,64,64,0.10)",   border: "rgba(255,64,64,0.25)"  },
}

const CATEGORIES = ["Bún/Phở","Cơm hộp","Gà rán","Đồ uống","Bánh mì","Pizza","Bánh/Kem","Cà phê","Hải sản","Lẩu","Khác"]


function categoryIcon(cat: string): string {
  const map: Record<string, string> = { "Bún/Phở": "🍜", "Cơm hộp": "🍱", "Gà rán": "🍗", "Đồ uống": "🥤", "Bánh mì": "🥖", "Pizza": "🍕", "Bánh/Kem": "🧁", "Cà phê": "☕", "Hải sản": "🦐", "Lẩu": "🍲" }
  return map[cat] ?? "🏪"
}
function categoryColor(cat: string): string {
  const map: Record<string, string> = { "Bún/Phở": "rgba(255,107,0,0.15)", "Cơm hộp": "rgba(62,207,110,0.12)", "Gà rán": "rgba(255,179,71,0.12)", "Đồ uống": "rgba(74,143,245,0.12)", "Bánh mì": "rgba(245,197,66,0.12)", "Pizza": "rgba(180,100,255,0.12)", "Bánh/Kem": "rgba(74,143,245,0.10)", "Cà phê": "rgba(255,64,64,0.12)" }
  return map[cat] ?? "rgba(255,255,255,0.06)"
}

const fmt      = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtShort = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n.toLocaleString("vi-VN")

export default function AdminMerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [filterStatus, setFilterStatus] = useState<"all" | ShopStatus>("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Merchant | null>(null)
  const [drawerTab, setDrawerTab] = useState<"info" | "settings">("info")
  const [editShop, setEditShop] = useState<EditShop | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: "approve" | "suspend" | "reject" | "unsuspend"; id: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; shopName: string; inputName: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [inlineEdit, setInlineEdit] = useState<{ id: string; value: string } | null>(null)
  const [toast, setToast] = useState("")
  const [toastOk, setToastOk] = useState(true)

  const fireToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3000)
  }

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data: rows } = await supabase
      .from("shops")
      .select("id, name, category, address, status, is_open, commission_rate, rating_avg, total_reviews, created_at, owner_id, phone, description, opening_hours")
      .order("created_at", { ascending: false })

    if (!rows || rows.length === 0) { setLoading(false); return }

    const ownerIds = [...new Set(rows.map(r => r.owner_id).filter(Boolean))]
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", ownerIds)
    const profMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    setMerchants(rows.map(r => {
      const prof = profMap[r.owner_id] ?? {}
      const oh = (r.opening_hours ?? {}) as Record<string, string>
      return {
        id: r.id, shopName: r.name,
        ownerName: (prof as { full_name?: string }).full_name ?? "Chủ quán",
        phone: r.phone ?? (prof as { phone?: string }).phone ?? "—",
        address: r.address, category: r.category,
        categoryIcon: categoryIcon(r.category), status: r.status as ShopStatus,
        registeredDate: new Date(r.created_at).toLocaleDateString("vi-VN"),
        commissionRate: r.commission_rate ?? 15, rating: r.rating_avg ?? null,
        totalOrders: r.total_reviews ?? 0, isOpen: r.is_open ?? false,
        coverColor: categoryColor(r.category),
        ownerId: r.owner_id,
        description: r.description ?? "",
        openTime: oh.open ?? "06:00",
        closeTime: oh.close ?? "22:00",
      }
    }))
    setLoading(false)
  }

  const updateStatus = async (id: string, status: ShopStatus, extra?: { is_open?: boolean }) => {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("shops").update({ status, ...(extra ?? {}) }).eq("id", id)
    setSaving(false)
    if (error) { fireToast("❌ Lỗi cập nhật trạng thái", false); return }
    setMerchants(p => p.map(m => m.id === id ? { ...m, status, ...(extra ?? {}) } : m))
    if (selected?.id === id) setSelected(p => p ? { ...p, status, ...(extra ?? {}) } : p)
  }

  const openEditMode = (m: Merchant) => {
    setEditShop({
      name: m.shopName, phone: m.phone, address: m.address,
      category: m.category, commissionRate: m.commissionRate,
      isOpen: m.isOpen, openTime: m.openTime, closeTime: m.closeTime, description: m.description,
    })
    setDrawerTab("settings")
  }

  const saveShopSettings = async () => {
    if (!selected || !editShop) return
    setEditSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("shops").update({
      name: editShop.name, phone: editShop.phone, address: editShop.address,
      category: editShop.category, commission_rate: editShop.commissionRate,
      is_open: editShop.isOpen, description: editShop.description,
      opening_hours: { open: editShop.openTime, close: editShop.closeTime },
    }).eq("id", selected.id)
    setEditSaving(false)
    if (error) { fireToast("❌ Lỗi lưu dữ liệu: " + error.message, false); return }
    const updated = {
      shopName: editShop.name, phone: editShop.phone, address: editShop.address,
      category: editShop.category, categoryIcon: categoryIcon(editShop.category),
      commissionRate: editShop.commissionRate, isOpen: editShop.isOpen,
      coverColor: categoryColor(editShop.category),
      description: editShop.description, openTime: editShop.openTime, closeTime: editShop.closeTime,
    }
    setMerchants(p => p.map(m => m.id === selected.id ? { ...m, ...updated } : m))
    setSelected(p => p ? { ...p, ...updated } : p)
    fireToast("✅ Đã cập nhật thông tin cửa hàng")
  }

  const saveInlineCommission = async (id: string, rate: number) => {
    const supabase = createClient()
    const { error } = await supabase.from("shops").update({ commission_rate: rate, is_negotiated_commission: true }).eq("id", id)
    if (error) { fireToast("❌ Lỗi cập nhật hoa hồng", false); return }
    setMerchants(ps => ps.map(m => m.id === id ? { ...m, commissionRate: rate } : m))
    if (selected?.id === id) setSelected(p => p ? { ...p, commissionRate: rate } : p)
    setInlineEdit(null)
    fireToast(`✅ Hoa hồng thoả thuận ${rate}% đã lưu`)
  }

  const deleteShop = async () => {
    if (!deleteConfirm) return
    setSaving(true)
    const supabase = createClient()
    const ownerId = merchants.find(m => m.id === deleteConfirm.id)?.ownerId ?? ""
    const { error: e1 } = await supabase.from("shops").update({ status: "suspended", is_open: false }).eq("id", deleteConfirm.id)
    if (e1) { setSaving(false); fireToast("❌ Lỗi xóa cửa hàng", false); return }
    const { error: e2 } = await supabase.from("profiles").update({ is_active: false }).eq("id", ownerId)
    if (e2) { setSaving(false); fireToast("❌ Lỗi vô hiệu hóa tài khoản", false); return }
    setMerchants(p => p.filter(m => m.id !== deleteConfirm.id))
    setDeleteConfirm(null)
    setSelected(null)
    setSaving(false)
    fireToast("🗑 Đã xóa cửa hàng", false)
  }

  const execConfirm = async () => {
    if (!confirmAction) return
    const { type, id } = confirmAction
    if (type === "approve")   await updateStatus(id, "approved")
    if (type === "reject")    await updateStatus(id, "suspended")
    if (type === "suspend")   await updateStatus(id, "suspended", { is_open: false })
    if (type === "unsuspend") await updateStatus(id, "approved")
    setConfirmAction(null)
    fireToast(type === "approve" ? "✅ Đã phê duyệt cửa hàng" : type === "unsuspend" ? "♻️ Đã mở khóa" : "🚫 Đã khóa cửa hàng", type === "approve" || type === "unsuspend")
  }

  const counts = {
    all: merchants.length,
    pending: merchants.filter(m => m.status === "pending").length,
    approved: merchants.filter(m => m.status === "approved").length,
    suspended: merchants.filter(m => m.status === "suspended").length,
    open: merchants.filter(m => m.isOpen).length,
  }

  const shown = merchants
    .filter(m => filterStatus === "all" || m.status === filterStatus)
    .filter(m => !search || m.shopName.toLowerCase().includes(search.toLowerCase()) || m.ownerName.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #06050a; font-family: 'Lexend', sans-serif; height: 100%; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,107,0,0.25); border-radius: 2px; }
        input, select, textarea { outline: none; font-family: 'Lexend', sans-serif; }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes shimmer { 0% { left:-60%; } 100% { left:120%; } }
        .merchant-row:hover { background: rgba(255,107,0,0.04) !important; border-color: rgba(255,107,0,0.18) !important; }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; }
        .kpi-card { animation: fadeUp 0.35s ease both; }
        .kpi-card:hover { transform: translateY(-2px); transition: all 0.2s; }
        .action-btn:hover { filter: brightness(1.15); transform: scale(1.02); }
        .edit-input:focus { border-color: rgba(255,107,0,0.5) !important; box-shadow: 0 0 0 3px rgba(255,107,0,0.08) !important; }
        .tab-btn { transition: all .2s; }
        .tab-btn:hover { color: #f0eaff !important; }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 200,
              background: toastOk ? "rgba(62,207,110,0.15)" : "rgba(255,64,64,0.15)",
              border: `1px solid ${toastOk ? "rgba(62,207,110,0.35)" : "rgba(255,64,64,0.35)"}`,
              borderRadius: 12, padding: "8px 20px", color: toastOk ? "#3ecf6e" : "#ff4040",
              fontSize: 11, fontWeight: 600, backdropFilter: "blur(12px)", whiteSpace: "nowrap" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AdminShell pageTitle="🏪 Cửa hàng & Merchant" pageSubtitle="Quản lý cửa hàng · Phê duyệt · Hoa hồng">
        <div style={{ flex: 1, overflowY: "auto", padding: 16, height: "100%" }}>

            {/* KPI */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
              {[
                { icon: "🏪", label: "Tổng cửa hàng",  value: counts.all,       sub: `${counts.open} đang mở`,  c: "#FF8C00", bg: "rgba(255,107,0,0.07)",   bd: "rgba(255,107,0,0.2)",   delay: "0s"    },
                { icon: "✅", label: "Đang hoạt động",  value: counts.approved,  sub: "Đã được duyệt",           c: "#3ecf6e", bg: "rgba(62,207,110,0.07)",  bd: "rgba(62,207,110,0.2)",  delay: "0.06s" },
                { icon: "⏳", label: "Chờ duyệt",       value: counts.pending,   sub: "Cần xem xét",             c: "#FFB347", bg: "rgba(255,179,71,0.07)",  bd: "rgba(255,179,71,0.2)",  delay: "0.12s" },
                { icon: "🚫", label: "Tạm khóa",        value: counts.suspended, sub: "Vi phạm",                 c: "#ff4040", bg: "rgba(255,64,64,0.07)",   bd: "rgba(255,64,64,0.2)",   delay: "0.18s" },
                { icon: "🟢", label: "Đang mở cửa",     value: counts.open,      sub: "Nhận đơn ngay",           c: "#3ecf6e", bg: "rgba(62,207,110,0.07)",  bd: "rgba(62,207,110,0.2)",  delay: "0.24s" },
              ].map((k, i) => (
                <div key={i} className="kpi-card" style={{ background: k.bg, border: `1px solid ${k.bd}`, borderRadius: 13, padding: "11px 12px", animationDelay: k.delay }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: k.bg, border: `1px solid ${k.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginBottom: 6 }}>{k.icon}</div>
                  <div style={{ color: k.c, fontSize: 22, fontWeight: 800, lineHeight: 1, marginBottom: 2 }}>{k.value}</div>
                  <div style={{ color: "rgba(240,234,255,0.55)", fontSize: 9 }}>{k.label}</div>
                  <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 8, marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Search + Filter */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, padding: "11px 13px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "7px 11px", marginBottom: 10 }}>
                <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 14 }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên quán, chủ quán..." style={{ flex: 1, background: "transparent", border: "none", color: "#f0eaff", fontSize: 11 }} />
                {search && <span onClick={() => setSearch("")} style={{ color: "rgba(144,128,176,0.4)", cursor: "pointer", fontSize: 13 }}>✕</span>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {([
                  { key: "all",       label: `Tất cả (${counts.all})`,           c: "#FF8C00" },
                  { key: "approved",  label: `Hoạt động (${counts.approved})`,   c: "#3ecf6e" },
                  { key: "pending",   label: `Chờ duyệt (${counts.pending})`,    c: "#FFB347" },
                  { key: "suspended", label: `Tạm khóa (${counts.suspended})`,   c: "#ff4040" },
                ] as const).map(tab => (
                  <button key={tab.key} onClick={() => setFilterStatus(tab.key)} style={{ padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "Lexend", fontSize: 9, fontWeight: filterStatus === tab.key ? 700 : 400, background: filterStatus === tab.key ? `${tab.c}18` : "rgba(255,255,255,0.04)", border: `1px solid ${filterStatus === tab.key ? tab.c + "55" : "rgba(255,255,255,0.07)"}`, color: filterStatus === tab.key ? tab.c : "rgba(144,128,176,0.6)" }}>{tab.label}</button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "52px 1.8fr 1.2fr 90px 80px 72px 68px 140px", gap: 8, padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                {["", "Cửa hàng", "Chủ / SĐT", "Danh mục", "Trạng thái", "Rating", "Hoa hồng", "Thao tác"].map(h => (
                  <div key={h} style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>{h}</div>
                ))}
              </div>

              {loading ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Đang tải...</div>
              ) : shown.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Không tìm thấy cửa hàng nào</div>
              ) : shown.map((m, idx) => {
                const s = STATUS_CFG[m.status]
                return (
                  <div key={m.id} className="merchant-row" onClick={() => { setSelected(m); setDrawerTab("info"); setEditShop(null) }} style={{ display: "grid", gridTemplateColumns: "52px 1.8fr 1.2fr 90px 80px 72px 68px 140px", gap: 8, padding: "10px 14px", borderBottom: idx < shown.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "pointer", transition: "all 0.15s", alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: m.coverColor, border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, position: "relative" }}>
                      {m.categoryIcon}
                      {m.isOpen && <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: "#3ecf6e", border: "1.5px solid #06050a", boxShadow: "0 0 4px #3ecf6e" }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#f0eaff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.shopName}</div>
                      <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 8, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.address}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#f0eaff", fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.ownerName}</div>
                      <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 8, marginTop: 2 }}>{m.phone}</div>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, padding: "3px 7px", width: "fit-content" }}>
                      <span style={{ fontSize: 10 }}>{m.categoryIcon}</span>
                      <span style={{ color: "rgba(240,234,255,0.7)", fontSize: 8, fontWeight: 500 }}>{m.category}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 8, fontWeight: 700, padding: "3px 7px", borderRadius: 5, border: `1px solid ${s.border}`, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
                    </div>
                    <div>
                      {m.rating !== null ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <span style={{ color: "#f5c542", fontSize: 11 }}>⭐</span>
                          <span style={{ color: "#f0eaff", fontSize: 11, fontWeight: 700 }}>{m.rating}</span>
                        </div>
                      ) : <span style={{ color: "rgba(144,128,176,0.3)", fontSize: 9 }}>—</span>}
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      {inlineEdit?.id === m.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <input type="number" min={0} max={50} value={inlineEdit.value} autoFocus
                            onChange={e => setInlineEdit(ie => ie ? { ...ie, value: e.target.value } : ie)}
                            onKeyDown={e => {
                              if (e.key === "Enter") saveInlineCommission(m.id, parseInt(inlineEdit.value) || 0)
                              if (e.key === "Escape") setInlineEdit(null)
                            }}
                            style={{ width: 38, height: 22, borderRadius: 5, background: "rgba(180,100,255,0.12)", border: "1px solid rgba(180,100,255,0.5)", color: "#b464ff", fontSize: 10, textAlign: "center", padding: "0 3px", fontFamily: "Lexend" }} />
                          <button onClick={() => saveInlineCommission(m.id, parseInt(inlineEdit.value) || 0)}
                            style={{ width: 20, height: 20, borderRadius: 4, background: "rgba(62,207,110,0.15)", border: "none", color: "#3ecf6e", fontSize: 9, cursor: "pointer" }}>✓</button>
                          <button onClick={() => setInlineEdit(null)}
                            style={{ width: 20, height: 20, borderRadius: 4, background: "rgba(255,64,64,0.1)", border: "none", color: "#ff4040", fontSize: 9, cursor: "pointer" }}>✕</button>
                        </div>
                      ) : (
                        <span onClick={() => setInlineEdit({ id: m.id, value: m.commissionRate.toString() })}
                          title="Click để chỉnh hoa hồng"
                          style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: "rgba(180,100,255,0.1)", border: "1px solid rgba(180,100,255,0.25)", color: "#b464ff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {m.commissionRate}% <span style={{ fontSize: 7, opacity: 0.6 }}>✏️</span>
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                      {m.status === "pending" && (
                        <>
                          <button className="action-btn" onClick={() => setConfirmAction({ type: "approve", id: m.id })} style={{ padding: "4px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.3)", color: "#3ecf6e", fontSize: 8, fontWeight: 700 }}>✅ Duyệt</button>
                          <button className="action-btn" onClick={() => setConfirmAction({ type: "reject", id: m.id })} style={{ padding: "4px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 8, fontWeight: 700 }}>❌</button>
                        </>
                      )}
                      {m.status === "approved" && (
                        <button className="action-btn" onClick={() => setConfirmAction({ type: "suspend", id: m.id })} style={{ padding: "4px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 8, fontWeight: 700 }}>🚫 Khóa</button>
                      )}
                      {m.status === "suspended" && (
                        <button className="action-btn" onClick={() => setConfirmAction({ type: "unsuspend", id: m.id })} style={{ padding: "4px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)", color: "#3ecf6e", fontSize: 8, fontWeight: 700 }}>♻️ Mở</button>
                      )}
                      <button className="action-btn" onClick={() => { setSelected(m); openEditMode(m) }} style={{ padding: "4px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)", color: "#FF8C00", fontSize: 8, fontWeight: 600 }}>✏️</button>
                    </div>
                  </div>
                )
              })}
              <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "rgba(144,128,176,0.35)", fontSize: 8 }}>Hiển thị {shown.length} / {merchants.length} cửa hàng</div>
              </div>
            </div>
        </div>
      </AdminShell>

      {/* ── DETAIL DRAWER ── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelected(null); setEditShop(null) }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60, backdropFilter: "blur(5px)" }} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 420, background: "#0d0b19", borderLeft: "1px solid rgba(255,255,255,0.08)", zIndex: 61, display: "flex", flexDirection: "column" }}>

              {/* Drawer header */}
              <div style={{ padding: "14px 18px 0", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Chi tiết cửa hàng</div>
                  <button onClick={() => { setSelected(null); setEditShop(null) }} style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(144,128,176,0.6)", fontSize: 16, cursor: "pointer" }}>×</button>
                </div>

                {/* Cover + name */}
                <div style={{ height: 72, borderRadius: 12, marginBottom: 12, background: selected.coverColor, border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>{selected.categoryIcon}</div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#f0eaff", fontSize: 15, fontWeight: 800 }}>{selected.shopName}</div>
                    <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, marginTop: 2 }}>ID: {selected.id.slice(0, 8).toUpperCase()}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: `1px solid ${STATUS_CFG[selected.status].border}`, background: STATUS_CFG[selected.status].bg, color: STATUS_CFG[selected.status].color }}>{STATUS_CFG[selected.status].label}</span>
                </div>

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
                  {[
                    { label: "Rating",     value: selected.rating !== null ? `⭐ ${selected.rating}` : "—", c: "#f5c542" },
                    { label: "Hoa hồng",  value: `${selected.commissionRate}%`,                           c: "#b464ff" },
                    { label: "Trạng thái", value: selected.isOpen ? "🟢 Mở" : "🔴 Đóng",               c: selected.isOpen ? "#3ecf6e" : "#ff4040" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 8px", textAlign: "center" }}>
                      <div style={{ color: s.c, fontSize: 13, fontWeight: 800 }}>{s.value}</div>
                      <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 7, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 0, marginBottom: -1 }}>
                  {(["info", "settings"] as const).map(t => (
                    <button key={t} className="tab-btn" onClick={() => { setDrawerTab(t); if (t === "settings" && !editShop) openEditMode(selected) }}
                      style={{ flex: 1, height: 36, border: "none", background: "transparent", cursor: "pointer", fontFamily: "Lexend",
                        borderBottom: `2px solid ${drawerTab === t ? "#FF6B00" : "transparent"}`,
                        color: drawerTab === t ? "#FF8C00" : "rgba(144,128,176,0.5)", fontSize: 10, fontWeight: drawerTab === t ? 700 : 400 }}>
                      {t === "info" ? "📋 Thông tin" : "⚙️ Cài đặt shop"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drawer body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>

                {/* ── TAB: Thông tin ── */}
                {drawerTab === "info" && (
                  <>
                    {[
                      ["Chủ quán",      selected.ownerName],
                      ["Số điện thoại", selected.phone],
                      ["Địa chỉ",       selected.address],
                      ["Danh mục",      `${selected.categoryIcon} ${selected.category}`],
                      ["Ngày đăng ký",  selected.registeredDate],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 12 }}>
                        <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, flexShrink: 0 }}>{k}</span>
                        <span style={{ color: "#f0eaff", fontSize: 9, fontWeight: 600, textAlign: "right" }}>{v}</span>
                      </div>
                    ))}

                    {/* Policy notice */}
                    <div style={{ marginTop: 16, background: "rgba(74,143,245,0.06)", border: "1px solid rgba(74,143,245,0.18)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ color: "#4a8ff5", fontSize: 9, fontWeight: 700, marginBottom: 4 }}>ℹ️ Chính sách tài khoản</div>
                      <div style={{ color: "rgba(74,143,245,0.7)", fontSize: 8.5, lineHeight: 1.5 }}>
                        Cửa hàng và khách hàng <strong>không thể tự xóa tài khoản</strong>. Muốn xóa, vui lòng liên hệ quản trị viên.
                        Chỉ Admin mới có quyền khóa hoặc xóa tài khoản.
                      </div>
                    </div>
                  </>
                )}

                {/* ── TAB: Cài đặt shop ── */}
                {drawerTab === "settings" && editShop && (
                  <>
                    <SLabel>Tên cửa hàng</SLabel>
                    <SInput value={editShop.name} onChange={v => setEditShop(e => e ? { ...e, name: v } : e)} placeholder="Tên cửa hàng" />

                    <SLabel>Số điện thoại</SLabel>
                    <SInput value={editShop.phone} onChange={v => setEditShop(e => e ? { ...e, phone: v } : e)} placeholder="0901234567" />

                    <SLabel>Địa chỉ</SLabel>
                    <SInput value={editShop.address} onChange={v => setEditShop(e => e ? { ...e, address: v } : e)} placeholder="Địa chỉ cửa hàng" />

                    <SLabel>Mô tả</SLabel>
                    <textarea value={editShop.description} onChange={e => setEditShop(s => s ? { ...s, description: e.target.value } : s)}
                      placeholder="Mô tả ngắn về cửa hàng..."
                      style={{ width: "100%", minHeight: 64, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, color: "#f0eaff", fontSize: 11, padding: "8px 12px", resize: "vertical", marginBottom: 12 }} />

                    <SLabel>Danh mục</SLabel>
                    <select value={editShop.category} onChange={e => setEditShop(s => s ? { ...s, category: e.target.value } : s)}
                      style={{ width: "100%", height: 40, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, color: "#f0eaff", fontSize: 11, padding: "0 12px", marginBottom: 12, fontFamily: "Lexend", colorScheme: "dark" }}>
                      {CATEGORIES.map(c => <option key={c} value={c} style={{ background: "#0d0b19" }}>{c}</option>)}
                    </select>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <div>
                        <SLabel>Giờ mở cửa</SLabel>
                        <input type="time" value={editShop.openTime} onChange={e => setEditShop(s => s ? { ...s, openTime: e.target.value } : s)}
                          style={{ width: "100%", height: 40, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, color: "#f0eaff", fontSize: 11, padding: "0 10px", colorScheme: "dark" }} />
                      </div>
                      <div>
                        <SLabel>Giờ đóng cửa</SLabel>
                        <input type="time" value={editShop.closeTime} onChange={e => setEditShop(s => s ? { ...s, closeTime: e.target.value } : s)}
                          style={{ width: "100%", height: 40, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, color: "#f0eaff", fontSize: 11, padding: "0 10px", colorScheme: "dark" }} />
                      </div>
                    </div>

                    <SLabel>Hoa hồng (%)</SLabel>
                    <input type="number" min={0} max={50} value={editShop.commissionRate}
                      onChange={e => setEditShop(s => s ? { ...s, commissionRate: parseInt(e.target.value) || 0 } : s)}
                      style={{ width: "100%", height: 40, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, color: "#f0eaff", fontSize: 12, padding: "0 12px", marginBottom: 12 }} />

                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                      <button onClick={() => setEditShop(s => s ? { ...s, isOpen: !s.isOpen } : s)}
                        style={{ width: 42, height: 24, borderRadius: 12, flexShrink: 0,
                          background: editShop.isOpen ? "rgba(62,207,110,0.2)" : "rgba(255,255,255,0.06)",
                          border: `1px solid ${editShop.isOpen ? "rgba(62,207,110,0.4)" : "rgba(255,255,255,0.1)"}`,
                          display: "flex", alignItems: "center", padding: "3px 4px",
                          cursor: "pointer", justifyContent: editShop.isOpen ? "flex-end" : "flex-start" }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: editShop.isOpen ? "#3ecf6e" : "#6a5a40" }} />
                      </button>
                      <div>
                        <div style={{ color: editShop.isOpen ? "#3ecf6e" : "rgba(144,128,176,0.5)", fontSize: 10, fontWeight: 700 }}>
                          {editShop.isOpen ? "🟢 Đang mở cửa" : "🔴 Đang đóng cửa"}
                        </div>
                        <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 8 }}>Bật/tắt nhận đơn</div>
                      </div>
                    </div>

                    {/* Save button */}
                    <button onClick={saveShopSettings} disabled={editSaving || !editShop.name.trim()}
                      style={{ width: "100%", height: 44, borderRadius: 12, border: "none",
                        background: "linear-gradient(90deg,#FF6B00,#FF8C00)", color: "#fff",
                        fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Lexend",
                        boxShadow: "0 3px 16px rgba(255,107,0,0.35)", position: "relative", overflow: "hidden",
                        opacity: editSaving || !editShop.name.trim() ? 0.6 : 1, marginBottom: 10 }}>
                      {editSaving ? "Đang lưu..." : "💾 Lưu thay đổi"}
                    </button>
                  </>
                )}
              </div>

              {/* Drawer footer actions */}
              <div style={{ padding: "12px 18px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                {selected.status === "pending" && (
                  <>
                    <button onClick={() => { setConfirmAction({ type: "approve", id: selected.id }); setSelected(null) }} style={{ height: 40, borderRadius: 11, cursor: "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.12)", border: "1px solid rgba(62,207,110,0.35)", color: "#3ecf6e", fontSize: 11, fontWeight: 700 }}>✅ Phê duyệt cửa hàng</button>
                    <button onClick={() => { setConfirmAction({ type: "reject", id: selected.id }); setSelected(null) }} style={{ height: 40, borderRadius: 11, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 11, fontWeight: 700 }}>❌ Từ chối đăng ký</button>
                  </>
                )}
                {selected.status === "approved" && (
                  <button onClick={() => { setConfirmAction({ type: "suspend", id: selected.id }); setSelected(null) }} style={{ height: 40, borderRadius: 11, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 11, fontWeight: 700 }}>🚫 Tạm khóa cửa hàng</button>
                )}
                {selected.status === "suspended" && (
                  <button onClick={() => { setConfirmAction({ type: "unsuspend", id: selected.id }); setSelected(null) }} style={{ height: 40, borderRadius: 11, cursor: "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)", color: "#3ecf6e", fontSize: 11, fontWeight: 700 }}>♻️ Mở khóa cửa hàng</button>
                )}
                {/* Delete — admin only */}
                <button onClick={() => setDeleteConfirm({ id: selected.id, shopName: selected.shopName, inputName: "" })}
                  style={{ height: 36, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend",
                    background: "rgba(255,64,64,0.05)", border: "1px dashed rgba(255,64,64,0.25)",
                    color: "rgba(255,64,64,0.65)", fontSize: 10, fontWeight: 600 }}>
                  🗑 Xóa vĩnh viễn (Admin only)
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── CONFIRM MODAL (approve/suspend/etc) ── */}
      <AnimatePresence>
        {confirmAction && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmAction(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 70, backdropFilter: "blur(6px)" }} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 22, stiffness: 350 }}
              style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 320, background: "#0d0b19", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: "20px 20px 16px", zIndex: 71 }}>
              {(() => {
                const cfg = {
                  approve:   { icon: "✅", title: "Phê duyệt cửa hàng?", c: "#3ecf6e", bg: "rgba(62,207,110,0.1)",  bd: "rgba(62,207,110,0.3)",  btn: "Phê duyệt" },
                  reject:    { icon: "❌", title: "Từ chối đăng ký?",     c: "#ff4040", bg: "rgba(255,64,64,0.1)",   bd: "rgba(255,64,64,0.25)",  btn: "Từ chối"   },
                  suspend:   { icon: "🚫", title: "Tạm khóa cửa hàng?",   c: "#ff4040", bg: "rgba(255,64,64,0.1)",   bd: "rgba(255,64,64,0.25)",  btn: "Tạm khóa"  },
                  unsuspend: { icon: "♻️", title: "Mở khóa cửa hàng?",    c: "#3ecf6e", bg: "rgba(62,207,110,0.1)",  bd: "rgba(62,207,110,0.3)",  btn: "Mở khóa"   },
                }[confirmAction.type]
                const shop = merchants.find(m => m.id === confirmAction.id)
                return (
                  <>
                    <div style={{ fontSize: 36, textAlign: "center", marginBottom: 10 }}>{cfg.icon}</div>
                    <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>{cfg.title}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", background: cfg.bg, border: `1px solid ${cfg.bd}`, borderRadius: 7, padding: "5px 10px", marginBottom: 14, color: cfg.c }}>{shop?.shopName}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setConfirmAction(null)} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.6)", fontSize: 11, fontWeight: 600 }}>Hủy</button>
                      <button onClick={execConfirm} disabled={saving} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: cfg.bg, border: `1px solid ${cfg.bd}`, color: cfg.c, fontSize: 11, fontWeight: 800 }}>{cfg.btn}</button>
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── DELETE CONFIRM MODAL ── */}
      <AnimatePresence>
        {deleteConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 80, backdropFilter: "blur(8px)" }} />
            <motion.div initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.88 }}
              transition={{ type: "spring", damping: 22, stiffness: 350 }}
              style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 340, background: "#100d20", border: "1px solid rgba(255,64,64,0.25)", borderRadius: 18, padding: "22px 20px 18px", zIndex: 81 }}>
              <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>⚠️</div>
              <div style={{ color: "#ff4040", fontSize: 15, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>Xóa vĩnh viễn?</div>
              <div style={{ color: "rgba(255,100,100,0.7)", fontSize: 10, textAlign: "center", lineHeight: 1.6, marginBottom: 14 }}>
                Hành động này <strong>không thể hoàn tác</strong>. Tất cả dữ liệu của cửa hàng sẽ bị xóa vĩnh viễn.
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9.5, marginBottom: 6 }}>
                Nhập tên cửa hàng để xác nhận: <span style={{ color: "#ff4040", fontWeight: 700 }}>"{deleteConfirm.shopName}"</span>
              </div>
              <input value={deleteConfirm.inputName}
                onChange={e => setDeleteConfirm(d => d ? { ...d, inputName: e.target.value } : d)}
                placeholder="Nhập tên cửa hàng..."
                style={{ width: "100%", height: 40, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,64,64,0.3)", borderRadius: 9, color: "#f0eaff", fontSize: 11, padding: "0 12px", marginBottom: 14 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.6)", fontSize: 11, fontWeight: 600 }}>Hủy</button>
                <button onClick={deleteShop} disabled={saving || deleteConfirm.inputName !== deleteConfirm.shopName}
                  style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: deleteConfirm.inputName === deleteConfirm.shopName ? "rgba(255,64,64,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${deleteConfirm.inputName === deleteConfirm.shopName ? "rgba(255,64,64,0.35)" : "rgba(255,255,255,0.07)"}`, color: deleteConfirm.inputName === deleteConfirm.shopName ? "#ff4040" : "rgba(144,128,176,0.3)", fontSize: 11, fontWeight: 800, opacity: deleteConfirm.inputName !== deleteConfirm.shopName ? 0.5 : 1 }}>
                  🗑 Xóa
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function SLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "rgba(144,128,176,0.55)", fontSize: 9, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>
}

function SInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${focused ? "rgba(255,107,0,0.45)" : "rgba(255,255,255,0.09)"}`, borderRadius: 10, padding: "0 12px", height: 40, marginBottom: 12, transition: "all .2s", boxShadow: focused ? "0 0 0 3px rgba(255,107,0,0.08)" : "none", display: "flex", alignItems: "center" }}>
      <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ flex: 1, background: "transparent", border: "none", color: "#f0eaff", fontSize: 11 }} />
    </div>
  )
}
