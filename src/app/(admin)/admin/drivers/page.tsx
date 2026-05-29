"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

// ── Types ─────────────────────────────────────────────────────────────────────

type DriverStatus = "pending" | "approved"
type OnlineStatus = "offline" | "online" | "busy"

interface Driver {
  id: string
  name: string
  phone: string
  avatarUrl: string | null
  vehicleType: string
  vehicleModel: string | null
  plate: string
  joinedDate: string
  status: DriverStatus
  onlineStatus: OnlineStatus
  rating: number | null
  trips: number
  idCardNumber: string | null
  licenseNumber: string | null
  xuBalance: number
  xuWalletId: string | null
  commissionRate: number
}

const DRIVER_STATUS_CFG: Record<DriverStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: "Chờ duyệt", color: "#FFB347", bg: "rgba(255,179,71,0.12)",  border: "rgba(255,179,71,0.3)"  },
  approved: { label: "Đã duyệt",  color: "#3ecf6e", bg: "rgba(62,207,110,0.10)",  border: "rgba(62,207,110,0.25)" },
}

const ONLINE_CFG: Record<OnlineStatus, { label: string; color: string }> = {
  offline: { label: "Offline", color: "#9080b0" },
  online:  { label: "Online",  color: "#3ecf6e" },
  busy:    { label: "Bận",     color: "#FFB347" },
}

const fmt      = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtShort = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" :
  n >= 1_000     ? (n / 1_000).toFixed(0) + "k" :
  n.toString()

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminDriversPage() {
  const [drivers,     setDrivers]     = useState<Driver[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState("")
  const [filter,      setFilter]      = useState<"all" | DriverStatus>("all")
  const [selected,    setSelected]    = useState<Driver | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [inlineEdit,  setInlineEdit]  = useState<{ id: string; value: string } | null>(null)
  const [toast,       setToast]       = useState("")
  const [toastOk,     setToastOk]     = useState(true)
  const [rejectModal, setRejectModal] = useState<Driver | null>(null)
  const [rejectReason,setRejectReason]= useState("")

  // Wallet panel
  const [xuTab,    setXuTab]    = useState<"topup" | "withdraw">("topup")
  const [xuAmount, setXuAmount] = useState("")
  const [xuNote,   setXuNote]   = useState("")
  const [xuSaving, setXuSaving] = useState(false)

  const fire = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3000) }

  // ── Load ──────────────────────────────────────────────────────────────────────

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data: rows } = await supabase
      .from("drivers")
      .select("id, vehicle_type, vehicle_model, license_plate, id_card_number, license_number, status, rating_avg, total_trips, is_approved, commission_rate, created_at")
      .order("created_at", { ascending: false })

    if (!rows || rows.length === 0) { setLoading(false); return }

    const ids = rows.map(r => r.id)
    const [{ data: profiles }, { data: wallets }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, avatar_url").in("id", ids),
      supabase.from("wallets").select("id, user_id, balance").in("user_id", ids).eq("type", "driver"),
    ])

    const profMap   = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    const walletMap = Object.fromEntries((wallets ?? []).map(w => [w.user_id, w]))

    setDrivers(rows.map(r => {
      const prof   = profMap[r.id]   as { full_name?: string; phone?: string; avatar_url?: string } | undefined
      const wallet = walletMap[r.id] as { id?: string; balance?: number } | undefined
      return {
        id:            r.id,
        name:          prof?.full_name ?? "Chưa cập nhật",
        phone:         prof?.phone ?? "—",
        avatarUrl:     prof?.avatar_url ?? null,
        vehicleType:   r.vehicle_type ?? "—",
        vehicleModel:  r.vehicle_model ?? null,
        plate:         r.license_plate ?? "—",
        joinedDate:    new Date(r.created_at).toLocaleDateString("vi-VN"),
        status:        (r.is_approved ? "approved" : "pending") as DriverStatus,
        onlineStatus:  (r.status ?? "offline") as OnlineStatus,
        rating:        r.rating_avg ?? null,
        trips:         r.total_trips ?? 0,
        idCardNumber:  r.id_card_number ?? null,
        licenseNumber: r.license_number ?? null,
        xuBalance:     wallet?.balance ?? 0,
        xuWalletId:    wallet?.id ?? null,
        commissionRate: r.commission_rate ?? 20,
      }
    }))
    setLoading(false)
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  const approve = async (id: string) => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from("drivers").update({ is_approved: true, approved_at: new Date().toISOString() }).eq("id", id)
    setDrivers(p => p.map(d => d.id === id ? { ...d, status: "approved" } : d))
    if (selected?.id === id) setSelected(s => s ? { ...s, status: "approved" } : s)
    setSaving(false)
    fire("✅ Tài xế đã được phê duyệt")
  }

  const reject = async (id: string, reason: string) => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from("profiles").update({ is_active: false }).eq("id", id)
    setDrivers(p => p.filter(d => d.id !== id))
    if (selected?.id === id) setSelected(null)
    setSaving(false)
    setRejectModal(null)
    setRejectReason("")
    fire(`❌ Đã từ chối: ${reason || "Không đủ điều kiện"}`, false)
  }

  const saveCommission = async (id: string, rate: number) => {
    const supabase = createClient()
    const { error } = await supabase.from("drivers").update({ commission_rate: rate }).eq("id", id)
    if (error) { fire("❌ Lỗi cập nhật hoa hồng", false); return }
    setDrivers(p => p.map(d => d.id === id ? { ...d, commissionRate: rate } : d))
    if (selected?.id === id) setSelected(s => s ? { ...s, commissionRate: rate } : s)
    setInlineEdit(null)
    fire(`✅ Hoa hồng → ${rate}%`)
  }

  const handleWallet = async () => {
    if (!selected) return
    const amt = parseInt(xuAmount.replace(/\D/g, ""), 10)
    if (!amt || amt <= 0) return fire("Số tiền không hợp lệ", false)
    if (xuTab === "withdraw" && amt > selected.xuBalance) return fire("Số dư không đủ để rút", false)

    setXuSaving(true)
    const supabase = createClient()
    let walletId = selected.xuWalletId

    if (!walletId) {
      const { data: newWallet } = await supabase
        .from("wallets").insert({ user_id: selected.id, type: "driver", balance: 0 }).select("id").single()
      walletId = newWallet?.id ?? null
    }
    if (!walletId) { fire("Lỗi tạo ví", false); setXuSaving(false); return }

    const delta      = xuTab === "topup" ? amt : -amt
    const newBalance = selected.xuBalance + delta

    await supabase.from("wallets").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", walletId)
    await supabase.from("transactions").insert({
      wallet_id: walletId, type: xuTab === "topup" ? "topup" : "withdrawal",
      amount: amt, balance_after: newBalance, ref_type: "admin_manual",
      note: xuNote || (xuTab === "topup" ? "Admin nạp thủ công" : "Admin rút thủ công"),
    })

    const updated = { ...selected, xuBalance: newBalance, xuWalletId: walletId }
    setSelected(updated)
    setDrivers(p => p.map(d => d.id === selected.id ? { ...d, xuBalance: newBalance, xuWalletId: walletId } : d))
    setXuAmount("")
    setXuNote("")
    fire(xuTab === "topup" ? `✅ Đã nạp ${fmt(amt)}` : `✅ Đã rút ${fmt(amt)}`)
    setXuSaving(false)
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const counts = {
    all:      drivers.length,
    pending:  drivers.filter(d => d.status === "pending").length,
    approved: drivers.filter(d => d.status === "approved").length,
    online:   drivers.filter(d => d.onlineStatus === "online").length,
  }

  const shown = drivers
    .filter(d => filter === "all" || d.status === filter)
    .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.plate.includes(search) || d.phone.includes(search))

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        input { outline: none; font-family: 'Lexend', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .driver-row:hover { background: rgba(74,143,245,0.04) !important; }
        .kpi-card { animation: fadeUp 0.35s ease both; }
        .kpi-card:hover { transform: translateY(-2px); transition: all 0.2s; }
        .action-btn:hover { filter: brightness(1.15); transform: scale(1.02); transition: all 0.15s; }
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

      <AdminShell pageTitle="🛵 Tài xế" pageSubtitle="Quản lý tài xế · phê duyệt · hoa hồng · ví">
        <div style={{ flex: 1, overflowY: "auto", padding: 16, height: "100%" }}>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
            {[
              { icon: "🛵", label: "Tổng tài xế",  value: counts.all,      c: "#4a8ff5", bg: "rgba(74,143,245,0.07)",  bd: "rgba(74,143,245,0.2)",  delay: "0s"    },
              { icon: "✅", label: "Đã duyệt",      value: counts.approved, c: "#3ecf6e", bg: "rgba(62,207,110,0.07)",  bd: "rgba(62,207,110,0.2)",  delay: "0.05s" },
              { icon: "🟢", label: "Đang online",   value: counts.online,   c: "#3ecf6e", bg: "rgba(62,207,110,0.07)",  bd: "rgba(62,207,110,0.2)",  delay: "0.10s" },
              { icon: "⏳", label: "Chờ duyệt",    value: counts.pending,  c: "#FFB347", bg: "rgba(255,179,71,0.07)",  bd: "rgba(255,179,71,0.2)",  delay: "0.15s" },
            ].map((k, i) => (
              <div key={i} className="kpi-card" style={{ background: k.bg, border: `1px solid ${k.bd}`, borderRadius: 13, padding: "11px 12px", animationDelay: k.delay }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, fontSize: 14, background: k.bg, border: `1px solid ${k.bd}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>{k.icon}</div>
                <div style={{ color: k.c, fontSize: 20, fontWeight: 800, lineHeight: 1, marginBottom: 2 }}>{k.value}</div>
                <div style={{ color: "rgba(240,234,255,0.55)", fontSize: 9 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Search + filter */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, padding: "11px 13px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "7px 11px", marginBottom: 10 }}>
              <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 14 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, biển số, số điện thoại..." style={{ flex: 1, background: "transparent", border: "none", color: "#f0eaff", fontSize: 11 }} />
              {search && <span onClick={() => setSearch("")} style={{ color: "rgba(144,128,176,0.4)", cursor: "pointer", fontSize: 13 }}>✕</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                { key: "all",      label: `Tất cả (${counts.all})`,        c: "#4a8ff5" },
                { key: "approved", label: `Đã duyệt (${counts.approved})`, c: "#3ecf6e" },
                { key: "pending",  label: `Chờ duyệt (${counts.pending})`, c: "#FFB347" },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setFilter(tab.key)} style={{ padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "Lexend", fontSize: 9, fontWeight: filter === tab.key ? 700 : 400, background: filter === tab.key ? `${tab.c}18` : "rgba(255,255,255,0.04)", border: `1px solid ${filter === tab.key ? tab.c + "55" : "rgba(255,255,255,0.07)"}`, color: filter === tab.key ? tab.c : "rgba(144,128,176,0.6)" }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 820 }}>
                {/* Header */}
                <div style={{ display: "grid", gridTemplateColumns: "44px 1.7fr 100px 95px 90px 55px 50px 75px 90px 100px", gap: 8, padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                  {["", "Tên / SĐT", "Phương tiện", "Biển số", "Trạng thái", "Rating", "Đơn", "Hoa hồng", "Số dư ví", "Thao tác"].map(h => (
                    <div key={h} style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>{h}</div>
                  ))}
                </div>

                {loading ? (
                  <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Đang tải...</div>
                ) : shown.length === 0 ? (
                  <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Không có tài xế nào</div>
                ) : shown.map((d, idx) => {
                  const st = DRIVER_STATUS_CFG[d.status]
                  const on = ONLINE_CFG[d.onlineStatus]
                  return (
                    <div key={d.id} className="driver-row" onClick={() => { setSelected(d); setXuAmount(""); setXuNote("") }}
                      style={{ display: "grid", gridTemplateColumns: "44px 1.7fr 100px 95px 90px 55px 50px 75px 90px 100px", gap: 8, padding: "10px 14px", alignItems: "center", borderBottom: idx < shown.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "pointer", transition: "all 0.15s" }}>

                      {/* Avatar */}
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "rgba(74,143,245,0.12)", border: "1px solid rgba(74,143,245,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, overflow: "hidden", position: "relative" }}>
                        {d.avatarUrl
                          ? <img src={d.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : "🧑‍💼"}
                        {d.status === "approved" && (
                          <div style={{ position: "absolute", bottom: -2, right: -2, width: 11, height: 11, borderRadius: "50%", background: on.color, border: "1.5px solid #06050a" }} />
                        )}
                      </div>

                      {/* Name */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "#f0eaff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                        <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 8, marginTop: 1 }}>{d.phone}</div>
                      </div>

                      {/* Vehicle */}
                      <div style={{ color: "rgba(240,234,255,0.7)", fontSize: 9 }}>
                        {d.vehicleType}{d.vehicleModel ? ` · ${d.vehicleModel}` : ""}
                      </div>

                      {/* Plate */}
                      <div style={{ color: "#FFB347", fontSize: 9, fontWeight: 600, fontFamily: "monospace" }}>{d.plate}</div>

                      {/* Status */}
                      <div>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 5, border: `1px solid ${st.border}`, background: st.bg, color: st.color, whiteSpace: "nowrap" }}>
                          {d.status === "approved" ? on.label : st.label}
                        </span>
                      </div>

                      {/* Rating */}
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        {d.rating !== null
                          ? <><span style={{ color: "#f5c542", fontSize: 10 }}>⭐</span><span style={{ color: "#f0eaff", fontSize: 10, fontWeight: 700 }}>{d.rating}</span></>
                          : <span style={{ color: "rgba(144,128,176,0.3)", fontSize: 9 }}>—</span>}
                      </div>

                      {/* Trips */}
                      <div style={{ color: d.trips > 0 ? "#FF8C00" : "rgba(144,128,176,0.3)", fontSize: 11, fontWeight: 700 }}>
                        {d.trips > 0 ? d.trips : "—"}
                      </div>

                      {/* Commission inline */}
                      <div onClick={e => e.stopPropagation()}>
                        {inlineEdit?.id === d.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <input type="number" min={0} max={50} value={inlineEdit.value} autoFocus
                              onChange={e => setInlineEdit({ id: d.id, value: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === "Enter")  saveCommission(d.id, parseInt(inlineEdit.value) || 0)
                                if (e.key === "Escape") setInlineEdit(null)
                              }}
                              style={{ width: 38, height: 22, borderRadius: 5, background: "rgba(180,100,255,0.14)", border: "1.5px solid rgba(180,100,255,0.6)", color: "#b464ff", fontSize: 11, textAlign: "center", padding: "0 2px", fontFamily: "Lexend" }} />
                            <button onClick={() => saveCommission(d.id, parseInt(inlineEdit.value) || 0)}
                              style={{ width: 20, height: 20, borderRadius: 4, background: "rgba(62,207,110,0.15)", border: "1px solid rgba(62,207,110,0.3)", color: "#3ecf6e", fontSize: 10, cursor: "pointer" }}>✓</button>
                            <button onClick={() => setInlineEdit(null)}
                              style={{ width: 20, height: 20, borderRadius: 4, background: "rgba(255,64,64,0.1)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 10, cursor: "pointer" }}>✕</button>
                          </div>
                        ) : (
                          <span onClick={() => setInlineEdit({ id: d.id, value: d.commissionRate.toString() })}
                            title="Click để chỉnh"
                            style={{ fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 6, background: "rgba(180,100,255,0.1)", border: "1px solid rgba(180,100,255,0.3)", color: "#b464ff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
                            {d.commissionRate}% <span style={{ fontSize: 8 }}>✏️</span>
                          </span>
                        )}
                      </div>

                      {/* Wallet balance */}
                      <div style={{ color: d.xuBalance > 0 ? "#b464ff" : "rgba(144,128,176,0.3)", fontSize: 9, fontWeight: d.xuBalance > 0 ? 700 : 400 }}>
                        {d.xuBalance > 0 ? fmtShort(d.xuBalance) : "—"}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                        {d.status === "pending" ? (
                          <>
                            <button className="action-btn" onClick={() => approve(d.id)} disabled={saving}
                              style={{ padding: "3px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.25)", color: "#3ecf6e", fontSize: 8, fontWeight: 700 }}>✅ Duyệt</button>
                            <button className="action-btn" onClick={() => { setRejectModal(d); setRejectReason("") }}
                              style={{ padding: "3px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 8, fontWeight: 700 }}>❌</button>
                          </>
                        ) : (
                          <button className="action-btn" onClick={() => { setSelected(d); setXuAmount(""); setXuNote("") }}
                            style={{ padding: "3px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.7)", fontSize: 8, fontWeight: 600 }}>Chi tiết</button>
                        )}
                      </div>
                    </div>
                  )
                })}

                <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "rgba(144,128,176,0.35)", fontSize: 8 }}>Hiển thị {shown.length} / {drivers.length} tài xế</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── Detail Drawer ──────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60, backdropFilter: "blur(5px)" }} />
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 24, stiffness: 300 }}
                style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "100%", maxWidth: 400, background: "#0d0b19", borderLeft: "1px solid rgba(255,255,255,0.08)", zIndex: 61, display: "flex", flexDirection: "column" }}>

                {/* Header */}
                <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Hồ sơ tài xế</div>
                    <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(144,128,176,0.6)", fontSize: 16, cursor: "pointer" }}>×</button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
                    <div style={{ width: 60, height: 60, borderRadius: 16, flexShrink: 0, background: "rgba(74,143,245,0.12)", border: "2px solid rgba(74,143,245,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, overflow: "hidden" }}>
                      {selected.avatarUrl
                        ? <img src={selected.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : "🧑‍💼"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#f0eaff", fontSize: 16, fontWeight: 800, marginBottom: 3 }}>{selected.name}</div>
                      <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 9, marginBottom: 5 }}>{selected.phone}</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5, border: `1px solid ${DRIVER_STATUS_CFG[selected.status].border}`, background: DRIVER_STATUS_CFG[selected.status].bg, color: DRIVER_STATUS_CFG[selected.status].color }}>
                          {DRIVER_STATUS_CFG[selected.status].label}
                        </span>
                        {selected.status === "approved" && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: ONLINE_CFG[selected.onlineStatus].color }}>
                            {ONLINE_CFG[selected.onlineStatus].label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {[
                      { label: "Chuyến đi", value: selected.trips.toString(),         c: "#FF8C00" },
                      { label: "Rating",    value: selected.rating?.toString() ?? "—", c: "#f5c542" },
                      { label: "Số dư ví",  value: fmtShort(selected.xuBalance),      c: "#b464ff" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: 8, textAlign: "center" }}>
                        <div style={{ color: s.c, fontSize: 15, fontWeight: 800 }}>{s.value}</div>
                        <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scrollable body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>

                  {/* Phương tiện */}
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "0 14px", marginBottom: 10 }}>
                    <div style={{ padding: "10px 0 4px", color: "#FF8C00", fontSize: 10, fontWeight: 700 }}>🏍️ Phương tiện</div>
                    {[
                      ["Loại xe",      selected.vehicleType],
                      ["Model",        selected.vehicleModel ?? "Chưa cập nhật"],
                      ["Biển số",      selected.plate],
                      ["Ngày đăng ký", selected.joinedDate],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 9 }}>{k}</span>
                        <span style={{ color: "#f0eaff", fontSize: 9, fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ height: 4 }} />
                  </div>

                  {/* Giấy tờ */}
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "0 14px", marginBottom: 10 }}>
                    <div style={{ padding: "10px 0 4px", color: "#4a8ff5", fontSize: 10, fontWeight: 700 }}>📋 Giấy tờ pháp lý</div>
                    {[
                      ["CMND / CCCD", selected.idCardNumber  ?? "❌ Chưa cung cấp"],
                      ["Số bằng lái", selected.licenseNumber ?? "❌ Chưa cung cấp"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 9 }}>{k}</span>
                        <span style={{ color: (v as string).startsWith("❌") ? "#ff4040" : "#3ecf6e", fontSize: 9, fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ height: 4 }} />
                  </div>

                  {/* Hoa hồng */}
                  <div style={{ background: "rgba(180,100,255,0.05)", border: "1px solid rgba(180,100,255,0.18)", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ color: "#b464ff", fontSize: 10, fontWeight: 700 }}>💜 Hoa hồng tài xế</span>
                      <span style={{ color: "rgba(180,100,255,0.5)", fontSize: 8 }}>% nền tảng / chuyến</span>
                    </div>
                    {inlineEdit?.id === selected.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="number" min={0} max={50} value={inlineEdit.value} autoFocus
                          onChange={e => setInlineEdit(ie => ie ? { ...ie, value: e.target.value } : ie)}
                          onKeyDown={e => {
                            if (e.key === "Enter")  saveCommission(selected.id, parseInt(inlineEdit.value) || 0)
                            if (e.key === "Escape") setInlineEdit(null)
                          }}
                          style={{ flex: 1, height: 40, borderRadius: 9, background: "rgba(180,100,255,0.12)", border: "1px solid rgba(180,100,255,0.5)", color: "#b464ff", fontSize: 16, fontWeight: 800, textAlign: "center", padding: "0 8px", fontFamily: "Lexend" }} />
                        <span style={{ color: "#b464ff", fontSize: 14, fontWeight: 700 }}>%</span>
                        <button onClick={() => saveCommission(selected.id, parseInt(inlineEdit.value) || 0)}
                          style={{ height: 40, padding: "0 12px", borderRadius: 9, background: "rgba(62,207,110,0.15)", border: "1px solid rgba(62,207,110,0.35)", color: "#3ecf6e", fontSize: 12, cursor: "pointer" }}>✓</button>
                        <button onClick={() => setInlineEdit(null)}
                          style={{ height: 40, padding: "0 12px", borderRadius: 9, background: "rgba(255,64,64,0.1)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 12, cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "#b464ff", fontSize: 22, fontWeight: 800 }}>{selected.commissionRate}%</span>
                        <button onClick={() => setInlineEdit({ id: selected.id, value: selected.commissionRate.toString() })}
                          style={{ height: 30, padding: "0 12px", borderRadius: 8, background: "rgba(180,100,255,0.1)", border: "1px solid rgba(180,100,255,0.3)", color: "#b464ff", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>
                          ✏️ Chỉnh sửa
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Ví xu */}
                  <div style={{ background: "rgba(180,100,255,0.05)", border: "1px solid rgba(180,100,255,0.2)", borderRadius: 14, padding: "16px", marginBottom: 10 }}>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <span style={{ color: "#b464ff", fontSize: 10, fontWeight: 700 }}>🪙 Ví xu tài xế</span>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#b464ff", fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{fmt(selected.xuBalance)}</div>
                        <div style={{ color: "rgba(180,100,255,0.45)", fontSize: 8, marginTop: 2 }}>số dư hiện tại</div>
                      </div>
                    </div>

                    {/* Tab nạp / rút */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                      {([["topup", "💰 Nạp tiền", "#3ecf6e"], ["withdraw", "📤 Rút tiền", "#ff4040"]] as const).map(([key, label, color]) => (
                        <button key={key} onClick={() => setXuTab(key)}
                          style={{ flex: 1, height: 38, borderRadius: 10,
                            background: xuTab === key ? `${color}22` : "rgba(255,255,255,0.04)",
                            border: xuTab === key ? `1.5px solid ${color}66` : "1px solid rgba(255,255,255,0.08)",
                            color: xuTab === key ? color : "rgba(144,128,176,0.5)",
                            fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend",
                            transition: "all .15s" }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Inputs */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                      <div>
                        <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, marginBottom: 5, fontWeight: 600 }}>
                          {xuTab === "topup" ? "Số tiền nạp (VND)" : "Số tiền rút (VND)"}
                        </div>
                        <input
                          type="number"
                          value={xuAmount}
                          onChange={e => setXuAmount(e.target.value)}
                          placeholder="Nhập số tiền..."
                          style={{ display: "block", width: "100%", boxSizing: "border-box",
                            height: 44, padding: "0 14px",
                            background: "rgba(255,255,255,0.06)",
                            border: `1.5px solid ${xuTab === "topup" ? "rgba(62,207,110,0.3)" : "rgba(255,64,64,0.3)"}`,
                            borderRadius: 10, color: "#f0eaff", fontSize: 14, fontWeight: 700,
                            fontFamily: "Lexend" }}
                        />
                      </div>
                      <div>
                        <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, marginBottom: 5, fontWeight: 600 }}>Ghi chú (không bắt buộc)</div>
                        <input
                          type="text"
                          value={xuNote}
                          onChange={e => setXuNote(e.target.value)}
                          placeholder="Lý do nạp/rút..."
                          style={{ display: "block", width: "100%", boxSizing: "border-box",
                            height: 40, padding: "0 14px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 10, color: "#f0eaff", fontSize: 12,
                            fontFamily: "Lexend" }}
                        />
                      </div>
                    </div>

                    {/* Nút xác nhận */}
                    <button
                      onClick={handleWallet}
                      disabled={xuSaving || !xuAmount}
                      style={{ display: "block", width: "100%", boxSizing: "border-box",
                        height: 44, borderRadius: 11, border: "none",
                        background: xuTab === "topup"
                          ? "linear-gradient(90deg,#3ecf6e,#2aad58)"
                          : "linear-gradient(90deg,#ff4040,#cc2020)",
                        color: "#fff", fontSize: 13, fontWeight: 700,
                        cursor: (!xuAmount || xuSaving) ? "not-allowed" : "pointer",
                        fontFamily: "Lexend",
                        opacity: (!xuAmount || xuSaving) ? 0.45 : 1,
                        transition: "opacity .15s" }}>
                      {xuSaving ? "⏳ Đang xử lý..." : xuTab === "topup" ? "✅ Xác nhận nạp" : "📤 Xác nhận rút"}
                    </button>
                  </div>

                  {/* Approve / reject (if pending) */}
                  {selected.status === "pending" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => approve(selected.id)} disabled={saving}
                        style={{ flex: 1, height: 44, borderRadius: 12, background: "rgba(62,207,110,0.12)", border: "1px solid rgba(62,207,110,0.35)", color: "#3ecf6e", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>✅ Phê duyệt</button>
                      <button onClick={() => { setRejectModal(selected); setRejectReason("") }} disabled={saving}
                        style={{ flex: 1, height: 44, borderRadius: 12, background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>❌ Từ chối</button>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Reject Modal ──────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {rejectModal && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRejectModal(null)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 70, backdropFilter: "blur(6px)" }} />
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", damping: 22, stiffness: 350 }}
                style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 320, background: "#0d0b19", border: "1px solid rgba(255,64,64,0.2)", borderRadius: 18, padding: "22px 20px 18px", zIndex: 71 }}>
                <div style={{ fontSize: 34, textAlign: "center", marginBottom: 10 }}>❌</div>
                <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 4 }}>Từ chối tài xế</div>
                <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 10, textAlign: "center", marginBottom: 14 }}>{rejectModal.name}</div>
                <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Lý do từ chối (không bắt buộc)"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 13px", color: "#f0eaff", fontSize: 12, fontFamily: "Lexend", marginBottom: 14, boxSizing: "border-box", outline: "none" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setRejectModal(null)} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.6)", fontSize: 11, fontWeight: 600 }}>Hủy</button>
                  <button onClick={() => reject(rejectModal.id, rejectReason)} disabled={saving} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,64,64,0.12)", border: "1px solid rgba(255,64,64,0.3)", color: "#ff4040", fontSize: 11, fontWeight: 800 }}>
                    {saving ? "Đang xử lý..." : "❌ Xác nhận từ chối"}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </AdminShell>
    </>
  )
}
