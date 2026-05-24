"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

type UserStatus = "active" | "blacklisted" | "inactive"
type TierLevel  = "bronze" | "silver" | "gold" | "platinum"
type UserRole   = "customer" | "merchant" | "driver" | "admin"

const ROLE_CFG: Record<UserRole, { label: string; color: string; bg: string; icon: string }> = {
  customer: { label: "Khách hàng", color: "#f0eaff", bg: "rgba(255,255,255,0.08)", icon: "👤" },
  merchant: { label: "Cửa hàng",  color: "#FFB347", bg: "rgba(255,179,71,0.12)",  icon: "🏪" },
  driver:   { label: "Tài xế",    color: "#4a8ff5", bg: "rgba(74,143,245,0.12)",  icon: "🛵" },
  admin:    { label: "Admin",     color: "#b464ff", bg: "rgba(180,100,255,0.15)", icon: "⚙️" },
}

const STATUS_CFG: Record<UserStatus, { label: string; color: string; bg: string; border: string }> = {
  active:      { label: "Hoạt động", color: "#3ecf6e", bg: "rgba(62,207,110,0.10)",  border: "rgba(62,207,110,0.25)"  },
  blacklisted: { label: "Bị khóa",  color: "#ff4040", bg: "rgba(255,64,64,0.10)",   border: "rgba(255,64,64,0.25)"   },
  inactive:    { label: "Không HĐ", color: "#9080b0", bg: "rgba(144,128,176,0.10)", border: "rgba(144,128,176,0.2)"  },
}

const TIER_CFG: Record<TierLevel, { label: string; color: string; bg: string; icon: string }> = {
  bronze:   { label: "Bronze",   color: "#cd7f32", bg: "rgba(205,127,50,0.12)",  icon: "🥉" },
  silver:   { label: "Silver",   color: "#a8a9ad", bg: "rgba(168,169,173,0.12)", icon: "🥈" },
  gold:     { label: "Gold",     color: "#f5c542", bg: "rgba(245,197,66,0.12)",  icon: "🥇" },
  platinum: { label: "Platinum", color: "#b464ff", bg: "rgba(180,100,255,0.15)", icon: "💎" },
}


interface AppUser {
  id: string
  fullName: string
  phone: string
  role: UserRole
  status: UserStatus
  registeredDate: string
  totalOrders: number
  totalSpent: number
  loyaltyPoints: number
  tier: TierLevel
  shopRevenue: number
  shopCommission: number
  driverEarnings: number
  walletBalance: number
  blacklistReason?: string
}


const fmt      = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtShort = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" :
  n >= 1_000     ? (n / 1_000).toFixed(0) + "k" :
  n.toString()

export default function AdminUsersPage() {
  const [users,         setUsers]         = useState<AppUser[]>([])
  const [filterStatus,  setFilterStatus]  = useState<"all" | UserStatus>("all")
  const [filterRole,    setFilterRole]    = useState<"all" | UserRole>("all")
  const [search,        setSearch]        = useState("")
  const [selected,      setSelected]      = useState<AppUser | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: "lock" | "unlock"; id: string } | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)

  // Password reset
  const [resetModal,  setResetModal]  = useState<AppUser | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [resetSaving, setResetSaving] = useState(false)
  const [resetMsg,    setResetMsg]    = useState("")

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone, role, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(500)

    if (!profiles || profiles.length === 0) { setLoading(false); return }

    const ids = profiles.map(p => p.id)

    const [
      { data: loyaltyRows },
      { data: blacklistRows },
      { data: orderRows },
      { data: shopRows },
      { data: walletRows },
    ] = await Promise.all([
      supabase.from("loyalty_points").select("user_id, total_points, tier").in("user_id", ids),
      supabase.from("blacklist").select("user_id, reason").in("user_id", ids),
      supabase.from("orders").select("customer_id, driver_id, shop_id, total_amount, subtotal, delivery_fee, status"),
      supabase.from("shops").select("id, owner_id, commission_rate"),
      supabase.from("wallets").select("user_id, type, balance").in("user_id", ids),
    ])

    const loyaltyMap   = Object.fromEntries((loyaltyRows ?? []).map(l => [l.user_id, l]))
    const blacklistMap = Object.fromEntries((blacklistRows ?? []).map(b => [b.user_id, b]))
    const shopById     = Object.fromEntries((shopRows ?? []).map(s => [s.id, s]))

    const walletByUser: Record<string, Record<string, number>> = {}
    for (const w of (walletRows ?? [])) {
      if (!walletByUser[w.user_id]) walletByUser[w.user_id] = {}
      walletByUser[w.user_id][w.type] = w.balance
    }

    const customerOrders: Record<string, { count: number; spent: number }> = {}
    const driverOrders:   Record<string, { count: number; earned: number }> = {}
    const merchantOrders: Record<string, { count: number; revenue: number; commission: number }> = {}

    for (const o of (orderRows ?? [])) {
      const nonCancelled = o.status !== "cancelled"
      const delivered    = o.status === "delivered"

      if (o.customer_id) {
        if (!customerOrders[o.customer_id]) customerOrders[o.customer_id] = { count: 0, spent: 0 }
        customerOrders[o.customer_id].count++
        if (nonCancelled) customerOrders[o.customer_id].spent += o.total_amount ?? 0
      }

      if (o.driver_id && delivered) {
        if (!driverOrders[o.driver_id]) driverOrders[o.driver_id] = { count: 0, earned: 0 }
        driverOrders[o.driver_id].count++
        const shop    = shopById[o.shop_id]
        const commRate = shop?.commission_rate ?? 15
        driverOrders[o.driver_id].earned += Math.round((o.delivery_fee ?? 0) * (1 - commRate / 100))
      }

      if (o.shop_id && nonCancelled) {
        const shop = shopById[o.shop_id]
        if (shop?.owner_id) {
          const oid = shop.owner_id
          if (!merchantOrders[oid]) merchantOrders[oid] = { count: 0, revenue: 0, commission: 0 }
          merchantOrders[oid].count++
          merchantOrders[oid].revenue    += o.total_amount ?? 0
          merchantOrders[oid].commission += Math.round((o.subtotal ?? 0) * (shop.commission_rate ?? 15) / 100)
        }
      }
    }

    setUsers(profiles.map(p => {
      const bl   = blacklistMap[p.id]
      const loy  = loyaltyMap[p.id]
      const cOrd = customerOrders[p.id] ?? { count: 0, spent: 0 }
      const dOrd = driverOrders[p.id]   ?? { count: 0, earned: 0 }
      const mOrd = merchantOrders[p.id] ?? { count: 0, revenue: 0, commission: 0 }
      const wBal = walletByUser[p.id]   ?? {}

      let status: UserStatus = "active"
      if (bl) status = "blacklisted"
      else if (!p.is_active) status = "inactive"

      const points = loy?.total_points ?? 0
      let tier: TierLevel = "bronze"
      if (points >= 2000) tier = "platinum"
      else if (points >= 1000) tier = "gold"
      else if (points >= 500)  tier = "silver"
      if (loy?.tier) tier = loy.tier as TierLevel

      const role = (p.role ?? "customer") as UserRole
      const totalOrders   = role === "driver" ? dOrd.count    : role === "merchant" ? mOrd.count   : cOrd.count
      const displayAmount = role === "driver" ? dOrd.earned   : role === "merchant" ? mOrd.revenue : cOrd.spent

      return {
        id: p.id,
        fullName: p.full_name ?? "Người dùng",
        phone: p.phone,
        role,
        status,
        registeredDate: new Date(p.created_at).toLocaleDateString("vi-VN"),
        totalOrders,
        totalSpent: displayAmount,
        loyaltyPoints: points,
        tier,
        shopRevenue:    mOrd.revenue,
        shopCommission: mOrd.commission,
        driverEarnings: dOrd.earned,
        walletBalance:  wBal["driver"] ?? wBal["customer"] ?? 0,
        blacklistReason: bl?.reason,
      }
    }))
    setLoading(false)
  }

  const lockUser = async (id: string) => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from("profiles").update({ is_active: false }).eq("id", id)
    await supabase.from("blacklist").upsert({ user_id: id, reason: "Khóa bởi admin", auto_triggered: false })
    setUsers(p => p.map(u => u.id === id ? { ...u, status: "blacklisted" as UserStatus } : u))
    if (selected?.id === id) setSelected(s => s ? { ...s, status: "blacklisted" } : s)
    setSaving(false)
  }

  const unlockUser = async (id: string) => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from("profiles").update({ is_active: true }).eq("id", id)
    await supabase.from("blacklist").delete().eq("user_id", id)
    setUsers(p => p.map(u => u.id === id ? { ...u, status: "active" as UserStatus, blacklistReason: undefined } : u))
    if (selected?.id === id) setSelected(s => s ? { ...s, status: "active", blacklistReason: undefined } : s)
    setSaving(false)
  }

  const execConfirm = async () => {
    if (!confirmAction) return
    if (confirmAction.type === "lock")   await lockUser(confirmAction.id)
    if (confirmAction.type === "unlock") await unlockUser(confirmAction.id)
    setConfirmAction(null)
    setSelected(null)
  }

  const resetPassword = async () => {
    if (!resetModal || newPassword.length < 6) { setResetMsg("Mật khẩu phải ít nhất 6 ký tự"); return }
    setResetSaving(true); setResetMsg("")
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetModal.id, newPassword }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setResetMsg("Lỗi: " + (data.error ?? "Không thể đặt lại mật khẩu"))
      } else {
        setResetMsg("✅ Đặt mật khẩu thành công!")
        setTimeout(() => { setResetModal(null); setNewPassword(""); setResetMsg("") }, 1500)
      }
    } catch { setResetMsg("Lỗi kết nối") }
    setResetSaving(false)
  }

  function getDetailStats(u: AppUser) {
    if (u.role === "merchant") return [
      { label: "Tổng đơn",  value: u.totalOrders.toString(),    c: "#FF8C00" },
      { label: "Doanh thu", value: fmtShort(u.shopRevenue),     c: "#f5c542" },
      { label: "Hoa hồng",  value: fmtShort(u.shopCommission),  c: "#3ecf6e" },
    ]
    if (u.role === "driver") return [
      { label: "Tổng đơn",  value: u.totalOrders.toString(),    c: "#FF8C00" },
      { label: "Thu nhập",  value: fmtShort(u.driverEarnings),  c: "#f5c542" },
      { label: "Số dư ví",  value: fmtShort(u.walletBalance),   c: "#4a8ff5" },
    ]
    return [
      { label: "Tổng đơn",  value: u.totalOrders.toString(),    c: "#FF8C00" },
      { label: "Chi tiêu",  value: fmtShort(u.totalSpent),      c: "#f5c542" },
      { label: "Điểm tích", value: u.loyaltyPoints.toString(),  c: "#b464ff" },
    ]
  }

  const counts = {
    all:         users.length,
    active:      users.filter(u => u.status === "active").length,
    blacklisted: users.filter(u => u.status === "blacklisted").length,
    inactive:    users.filter(u => u.status === "inactive").length,
    customers:   users.filter(u => u.role === "customer").length,
    merchants:   users.filter(u => u.role === "merchant").length,
    drivers:     users.filter(u => u.role === "driver").length,
  }
  const totalCustSpent    = users.filter(u => u.role === "customer").reduce((s, u) => s + u.totalSpent, 0)
  const totalMerchRevenue = users.filter(u => u.role === "merchant").reduce((s, u) => s + u.shopRevenue, 0)
  const totalCommission   = users.filter(u => u.role === "merchant").reduce((s, u) => s + u.shopCommission, 0)

  const shown = users
    .filter(u => filterStatus === "all" || u.status === filterStatus)
    .filter(u => filterRole   === "all" || u.role   === filterRole)
    .filter(u => !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search))

  return (
    <>
      <style>{`
        input { outline: none; font-family: 'Lexend', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .user-row:hover { background: rgba(255,107,0,0.04) !important; border-color: rgba(255,107,0,0.15) !important; }
        .kpi-card { animation: fadeUp 0.35s ease both; }
        .kpi-card:hover { transform: translateY(-2px); transition: all 0.2s; }
        .action-btn:hover { filter: brightness(1.15); transform: scale(1.02); transition: all 0.15s; }
      `}</style>
      <AdminShell pageTitle="👤 Tài khoản" pageSubtitle="Quản lý người dùng · Rút nạp · Mật khẩu">
        <div style={{ flex: 1, overflowY: "auto", padding: 16, height: "100%" }}>

          <>

            {/* KPI */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 14 }}>
              {[
                { icon: "👥", label: "Tổng tài khoản",  value: counts.all,                  c: "#FF8C00", bg: "rgba(255,107,0,0.07)",   bd: "rgba(255,107,0,0.2)",    delay: "0s"    },
                { icon: "👤", label: "Khách hàng",       value: counts.customers,             c: "#f0eaff", bg: "rgba(255,255,255,0.04)", bd: "rgba(255,255,255,0.09)", delay: "0.04s" },
                { icon: "🏪", label: "Cửa hàng",         value: counts.merchants,             c: "#FFB347", bg: "rgba(255,179,71,0.07)",  bd: "rgba(255,179,71,0.2)",   delay: "0.08s" },
                { icon: "🛵", label: "Tài xế",           value: counts.drivers,               c: "#4a8ff5", bg: "rgba(74,143,245,0.07)", bd: "rgba(74,143,245,0.2)",   delay: "0.12s" },
                { icon: "💰", label: "Doanh thu shop",   value: fmtShort(totalMerchRevenue), c: "#f5c542", bg: "rgba(245,197,66,0.07)",  bd: "rgba(245,197,66,0.2)",   delay: "0.16s" },
                { icon: "🤝", label: "Hoa hồng nền tảng",value: fmtShort(totalCommission),  c: "#3ecf6e", bg: "rgba(62,207,110,0.07)", bd: "rgba(62,207,110,0.2)",   delay: "0.20s" },
              ].map((k, i) => (
                <div key={i} className="kpi-card" style={{ background: k.bg, border: `1px solid ${k.bd}`, borderRadius: 13, padding: "11px 12px", animationDelay: k.delay }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, fontSize: 14, background: k.bg, border: `1px solid ${k.bd}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>{k.icon}</div>
                  <div style={{ color: k.c, fontSize: 20, fontWeight: 800, lineHeight: 1, marginBottom: 2 }}>{k.value}</div>
                  <div style={{ color: "rgba(240,234,255,0.55)", fontSize: 9 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Search + Filter */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, padding: "11px 13px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "7px 11px", marginBottom: 10 }}>
                <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 14 }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, số điện thoại..." style={{ flex: 1, background: "transparent", border: "none", color: "#f0eaff", fontSize: 11 }} />
                {search && <span onClick={() => setSearch("")} style={{ color: "rgba(144,128,176,0.4)", cursor: "pointer", fontSize: 13 }}>✕</span>}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
                {([
                  { key: "all",         label: `Tất cả (${counts.all})`,          c: "#FF8C00" },
                  { key: "active",      label: `Hoạt động (${counts.active})`,    c: "#3ecf6e" },
                  { key: "blacklisted", label: `Bị khóa (${counts.blacklisted})`, c: "#ff4040" },
                  { key: "inactive",    label: `Không HĐ (${counts.inactive})`,   c: "#9080b0" },
                ] as const).map(tab => (
                  <button key={tab.key} onClick={() => setFilterStatus(tab.key)} style={{ padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "Lexend", fontSize: 9, fontWeight: filterStatus === tab.key ? 700 : 400, background: filterStatus === tab.key ? `${tab.c}18` : "rgba(255,255,255,0.04)", border: `1px solid ${filterStatus === tab.key ? tab.c + "55" : "rgba(255,255,255,0.07)"}`, color: filterStatus === tab.key ? tab.c : "rgba(144,128,176,0.6)" }}>{tab.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <span style={{ color: "rgba(144,128,176,0.4)", fontSize: 8, alignSelf: "center", marginRight: 2 }}>Vai trò:</span>
                {(["all", "customer", "merchant", "driver", "admin"] as const).map(r => {
                  const cfg = r === "all" ? null : ROLE_CFG[r]
                  return (
                    <button key={r} onClick={() => setFilterRole(r)} style={{ padding: "3px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", fontSize: 8, fontWeight: filterRole === r ? 700 : 400, background: filterRole === r ? (cfg?.bg ?? "rgba(255,107,0,0.1)") : "rgba(255,255,255,0.04)", border: `1px solid ${filterRole === r ? (cfg?.color ?? "#FF8C00") + "55" : "rgba(255,255,255,0.07)"}`, color: filterRole === r ? (cfg?.color ?? "#FF8C00") : "rgba(144,128,176,0.55)" }}>
                      {r === "all" ? "Tất cả" : `${cfg!.icon} ${cfg!.label}`}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Table — horizontal scroll so "Chi tiết" luôn hiện */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 740 }}>
                  {/* Header */}
                  <div style={{ display: "grid", gridTemplateColumns: "42px 1.8fr 110px 78px 62px 92px 84px 110px", gap: 8, padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                    {["", "Tên", "SĐT", "Đăng ký", "Đơn", "Doanh số", "Trạng thái", "Thao tác"].map(h => (
                      <div key={h} style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>{h}</div>
                    ))}
                  </div>

                  {loading ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Đang tải...</div>
                  ) : shown.length === 0 ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Không tìm thấy tài khoản nào</div>
                  ) : shown.map((u, idx) => {
                    const st   = STATUS_CFG[u.status]
                    const role = ROLE_CFG[u.role]
                    return (
                      <div key={u.id} className="user-row" onClick={() => setSelected(u)}
                        style={{ display: "grid", gridTemplateColumns: "42px 1.8fr 110px 78px 62px 92px 84px 110px", gap: 8, padding: "10px 14px", alignItems: "center", borderBottom: idx < shown.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "pointer", transition: "all 0.15s" }}>

                        {/* Avatar */}
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: role.bg, border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, position: "relative" }}>
                          {role.icon}
                          {u.status === "blacklisted" && <div style={{ position: "absolute", bottom: -2, right: -2, width: 13, height: 13, borderRadius: "50%", background: "#ff4040", border: "1.5px solid #06050a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7 }}>🔒</div>}
                        </div>

                        {/* Tên + vai trò label bên dưới (không lặp ngày đăng ký) */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: "#f0eaff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.fullName}</div>
                          <span style={{ fontSize: 7, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: role.bg, color: role.color }}>{role.label}</span>
                        </div>

                        <div style={{ color: "rgba(240,234,255,0.65)", fontSize: 10 }}>{u.phone}</div>
                        <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 9 }}>{u.registeredDate}</div>

                        <div style={{ color: u.totalOrders > 0 ? "#FF8C00" : "rgba(144,128,176,0.3)", fontSize: 11, fontWeight: 700 }}>
                          {u.totalOrders > 0 ? u.totalOrders : "—"}
                        </div>

                        <div style={{ color: u.totalSpent > 0 ? "#f0eaff" : "rgba(144,128,176,0.3)", fontSize: 9, fontWeight: u.totalSpent > 0 ? 600 : 400 }}>
                          {u.totalSpent > 0 ? fmtShort(u.totalSpent) : "—"}
                        </div>

                        <div>
                          <span style={{ fontSize: 8, fontWeight: 700, padding: "3px 7px", borderRadius: 5, border: `1px solid ${st.border}`, background: st.bg, color: st.color, whiteSpace: "nowrap" }}>{st.label}</span>
                        </div>

                        {/* Thao tác — luôn hiển thị nhờ minWidth table */}
                        <div style={{ display: "flex", gap: 5, flexWrap: "nowrap" }} onClick={e => e.stopPropagation()}>
                          {u.status !== "blacklisted" ? (
                            <button className="action-btn" onClick={() => setConfirmAction({ type: "lock", id: u.id })} style={{ padding: "4px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 8, fontWeight: 700, whiteSpace: "nowrap" }}>🔒 Khóa</button>
                          ) : (
                            <button className="action-btn" onClick={() => setConfirmAction({ type: "unlock", id: u.id })} style={{ padding: "4px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)", color: "#3ecf6e", fontSize: 8, fontWeight: 700, whiteSpace: "nowrap" }}>🔓 Mở</button>
                          )}
                          <button className="action-btn" onClick={() => setSelected(u)} style={{ padding: "4px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.7)", fontSize: 8, fontWeight: 600, whiteSpace: "nowrap" }}>Chi tiết</button>
                        </div>
                      </div>
                    )
                  })}

                  <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ color: "rgba(144,128,176,0.35)", fontSize: 8 }}>Hiển thị {shown.length} / {users.length} tài khoản</div>
                    <div style={{ color: "rgba(144,128,176,0.35)", fontSize: 8 }}>Chi tiêu KH: <span style={{ color: "#FF8C00", fontWeight: 700 }}>{fmt(totalCustSpent)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </>

        </div>

        {/* ── Detail Drawer ── */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60, backdropFilter: "blur(5px)" }} />
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 24, stiffness: 300 }} style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 360, background: "#0d0b19", borderLeft: "1px solid rgba(255,255,255,0.08)", zIndex: 61, display: "flex", flexDirection: "column" }}>
                {/* Header */}
                <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>
                      Hồ sơ {ROLE_CFG[selected.role].label}
                    </div>
                    <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(144,128,176,0.6)", fontSize: 16, cursor: "pointer" }}>×</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 18, flexShrink: 0, background: ROLE_CFG[selected.role].bg, border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                      {ROLE_CFG[selected.role].icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#f0eaff", fontSize: 16, fontWeight: 800, marginBottom: 3 }}>{selected.fullName}</div>
                      <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 9, marginBottom: 5 }}>{selected.phone}</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5, border: `1px solid ${STATUS_CFG[selected.status].border}`, background: STATUS_CFG[selected.status].bg, color: STATUS_CFG[selected.status].color }}>{STATUS_CFG[selected.status].label}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: ROLE_CFG[selected.role].bg, border: `1px solid ${ROLE_CFG[selected.role].color}44`, color: ROLE_CFG[selected.role].color }}>{ROLE_CFG[selected.role].icon} {ROLE_CFG[selected.role].label}</span>
                        {/* Tier badge chỉ cho khách hàng */}
                        {selected.role === "customer" && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: TIER_CFG[selected.tier].bg, border: `1px solid ${TIER_CFG[selected.tier].color}44`, color: TIER_CFG[selected.tier].color }}>{TIER_CFG[selected.tier].icon} {TIER_CFG[selected.tier].label}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Stats — context theo vai trò */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {getDetailStats(selected).map(s => (
                      <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "8px", textAlign: "center" }}>
                        <div style={{ color: s.c, fontSize: 15, fontWeight: 800 }}>{s.value}</div>
                        <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, padding: "14px 18px", overflowY: "auto" }}>
                  {selected.status === "blacklisted" && selected.blacklistReason && (
                    <div style={{ background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                      <div style={{ color: "#ff4040", fontSize: 9, fontWeight: 700, marginBottom: 4 }}>⚠️ Lý do bị khóa</div>
                      <div style={{ color: "rgba(255,100,100,0.8)", fontSize: 10, lineHeight: 1.5 }}>{selected.blacklistReason}</div>
                    </div>
                  )}
                  {[
                    ["Số điện thoại", selected.phone],
                    ["Ngày đăng ký",  selected.registeredDate],
                    ["Trạng thái",    STATUS_CFG[selected.status].label],
                    ["Vai trò",       ROLE_CFG[selected.role].label],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 12 }}>
                      <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 9 }}>{k}</span>
                      <span style={{ color: "#f0eaff", fontSize: 9, fontWeight: 600, textAlign: "right" }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Footer actions */}
                <div style={{ padding: "12px 18px 18px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {selected.role !== "admin" && (
                    <button onClick={() => { setResetModal(selected); setNewPassword(""); setResetMsg("") }}
                      style={{ width: "100%", height: 38, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.25)", color: "#FF8C00", fontSize: 11, fontWeight: 700 }}>
                      🔑 Đặt lại mật khẩu
                    </button>
                  )}
                  {selected.status !== "blacklisted" ? (
                    <button onClick={() => setConfirmAction({ type: "lock", id: selected.id })} style={{ width: "100%", height: 38, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 11, fontWeight: 700 }}>🔒 Khóa tài khoản</button>
                  ) : (
                    <button onClick={() => setConfirmAction({ type: "unlock", id: selected.id })} style={{ width: "100%", height: 38, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)", color: "#3ecf6e", fontSize: 11, fontWeight: 700 }}>🔓 Mở khóa tài khoản</button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Password Reset Modal ── */}
        <AnimatePresence>
          {resetModal && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResetModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 70, backdropFilter: "blur(6px)" }} />
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", damping: 22, stiffness: 350 }}
                style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 320, background: "#0d0b19", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 18, padding: "22px 20px 18px", zIndex: 71 }}>
                <div style={{ fontSize: 34, textAlign: "center", marginBottom: 10 }}>🔑</div>
                <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 4 }}>Đặt lại mật khẩu</div>
                <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 10, textAlign: "center", marginBottom: 16 }}>
                  {resetModal.fullName} · {resetModal.phone}
                </div>
                <input
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  type="text"
                  placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 13px", color: "#f0eaff", fontSize: 12, fontFamily: "Lexend", marginBottom: 8, boxSizing: "border-box" }}
                />
                {resetMsg && (
                  <div style={{ fontSize: 10, color: resetMsg.startsWith("✅") ? "#3ecf6e" : "#ff6060", marginBottom: 10, textAlign: "center", background: resetMsg.startsWith("✅") ? "rgba(62,207,110,0.08)" : "rgba(255,64,64,0.08)", borderRadius: 8, padding: "6px 10px" }}>
                    {resetMsg}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={() => setResetModal(null)} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.6)", fontSize: 11, fontWeight: 600 }}>Hủy</button>
                  <button onClick={resetPassword} disabled={resetSaving || newPassword.length < 6}
                    style={{ flex: 1, height: 40, borderRadius: 10, cursor: resetSaving ? "default" : "pointer", fontFamily: "Lexend", background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.3)", color: "#FF8C00", fontSize: 11, fontWeight: 800, opacity: newPassword.length < 6 ? 0.4 : 1 }}>
                    {resetSaving ? "Đang lưu..." : "✅ Xác nhận"}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Confirm Lock/Unlock Modal ── */}
        <AnimatePresence>
          {confirmAction && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmAction(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 70, backdropFilter: "blur(6px)" }} />
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", damping: 22, stiffness: 350 }} style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 320, background: "#0d0b19", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: "22px 20px 18px", zIndex: 71 }}>
                {(() => {
                  const isLock = confirmAction.type === "lock"
                  const user   = users.find(u => u.id === confirmAction.id)
                  return (
                    <>
                      <div style={{ fontSize: 38, textAlign: "center", marginBottom: 10 }}>{isLock ? "🔒" : "🔓"}</div>
                      <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>{isLock ? "Khóa tài khoản?" : "Mở khóa tài khoản?"}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", background: isLock ? "rgba(255,64,64,0.1)" : "rgba(62,207,110,0.1)", border: `1px solid ${isLock ? "rgba(255,64,64,0.25)" : "rgba(62,207,110,0.25)"}`, borderRadius: 7, padding: "5px 10px", marginBottom: 14, color: isLock ? "#ff4040" : "#3ecf6e" }}>{user?.fullName}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setConfirmAction(null)} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.6)", fontSize: 11, fontWeight: 600 }}>Hủy</button>
                        <button onClick={execConfirm} disabled={saving} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: isLock ? "rgba(255,64,64,0.12)" : "rgba(62,207,110,0.12)", border: `1px solid ${isLock ? "rgba(255,64,64,0.3)" : "rgba(62,207,110,0.3)"}`, color: isLock ? "#ff4040" : "#3ecf6e", fontSize: 11, fontWeight: 800 }}>
                          {isLock ? "🔒 Khóa" : "🔓 Mở khóa"}
                        </button>
                      </div>
                    </>
                  )
                })()}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </AdminShell>
    </>
  )
}
