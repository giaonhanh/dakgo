"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

// ── Types ────────────────────────────────────────────────────────────────────

type MainTab    = "customers" | "drivers" | "merchants"
type UserStatus = "active" | "blacklisted" | "inactive"
type TierLevel  = "bronze" | "silver" | "gold" | "platinum"
type UserRole   = "customer" | "merchant" | "driver" | "admin"
type ShopStatus = "pending" | "approved" | "suspended"
type DriverStatus = "offline" | "online" | "busy"

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

const SHOP_STATUS_CFG: Record<ShopStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:   { label: "Chờ duyệt",      color: "#FFB347", bg: "rgba(255,179,71,0.12)",  border: "rgba(255,179,71,0.3)"  },
  approved:  { label: "Đang hoạt động", color: "#3ecf6e", bg: "rgba(62,207,110,0.10)",  border: "rgba(62,207,110,0.25)" },
  suspended: { label: "Tạm khóa",       color: "#ff4040", bg: "rgba(255,64,64,0.10)",   border: "rgba(255,64,64,0.25)"  },
}

const DRIVER_STATUS_CFG: Record<DriverStatus, { label: string; color: string; bg: string }> = {
  offline: { label: "Offline", color: "#9080b0", bg: "rgba(144,128,176,0.10)" },
  online:  { label: "Online",  color: "#3ecf6e", bg: "rgba(62,207,110,0.10)"  },
  busy:    { label: "Bận",     color: "#FFB347", bg: "rgba(255,179,71,0.12)"  },
}

function categoryIcon(cat: string): string {
  const map: Record<string, string> = { "Bún/Phở": "🍜", "Cơm hộp": "🍱", "Gà rán": "🍗", "Đồ uống": "🥤", "Bánh mì": "🥖", "Pizza": "🍕", "Bánh/Kem": "🧁", "Cà phê": "☕", "Hải sản": "🦐", "Lẩu": "🍲" }
  return map[cat] ?? "🏪"
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface AppUser {
  id: string; fullName: string; phone: string; role: UserRole; status: UserStatus
  registeredDate: string; totalOrders: number; totalSpent: number
  loyaltyPoints: number; tier: TierLevel
  shopRevenue: number; shopCommission: number; driverEarnings: number
  walletBalance: number; blacklistReason?: string
}

interface DriverRow {
  id: string; fullName: string; phone: string
  vehicleType: string; licensePlate: string
  driverStatus: DriverStatus; isApproved: boolean
  ratingAvg: number | null; totalTrips: number
  commissionRate: number; joinedDate: string
}

interface MerchantRow {
  id: string; shopName: string; ownerName: string; phone: string
  category: string; shopStatus: ShopStatus; isOpen: boolean
  ratingAvg: number | null; totalReviews: number
  commissionRate: number; isNegotiated: boolean; createdDate: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt      = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtShort = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" :
  n >= 1_000     ? (n / 1_000).toFixed(0) + "k" :
  n.toString()

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("customers")

  // ── Customers ──
  const [users,         setUsers]         = useState<AppUser[]>([])
  const [filterStatus,  setFilterStatus]  = useState<"all" | UserStatus>("all")
  const [filterRole,    setFilterRole]    = useState<"all" | UserRole>("all")
  const [search,        setSearch]        = useState("")
  const [selected,      setSelected]      = useState<AppUser | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: "lock" | "unlock"; id: string } | null>(null)
  const [usersLoading,  setUsersLoading]  = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [resetModal,    setResetModal]    = useState<AppUser | null>(null)
  const [newPassword,   setNewPassword]   = useState("")
  const [resetSaving,   setResetSaving]   = useState(false)
  const [resetMsg,      setResetMsg]      = useState("")
  const [pointsModal,   setPointsModal]   = useState<AppUser | null>(null)
  const [pointsAmount,  setPointsAmount]  = useState("")
  const [pointsReason,  setPointsReason]  = useState<"Sự kiện" | "Sinh nhật" | "Event" | "Tự nhập">("Sự kiện")
  const [pointsCustom,  setPointsCustom]  = useState("")
  const [pointsSaving,  setPointsSaving]  = useState(false)
  const [pointsMsg,     setPointsMsg]     = useState("")

  // ── Wallet (xu) modal ──
  const [walletModal,   setWalletModal]   = useState<{ id: string; name: string; role: "customer" | "driver"; balance: number } | null>(null)
  const [walletAmount,  setWalletAmount]  = useState("")
  const [walletNote,    setWalletNote]    = useState("")
  const [walletSaving,  setWalletSaving]  = useState(false)
  const [walletMsg,     setWalletMsg]     = useState("")

  // ── Drivers ──
  const [drivers,        setDrivers]        = useState<DriverRow[]>([])
  const [driversLoaded,  setDriversLoaded]  = useState(false)
  const [driversLoading, setDriversLoading] = useState(false)
  const [driverSearch,   setDriverSearch]   = useState("")
  const [driverFilter,   setDriverFilter]   = useState<"all" | "approved" | "pending">("all")
  const [driverInline,   setDriverInline]   = useState<{ id: string; value: string } | null>(null)
  const [driverSaving,   setDriverSaving]   = useState(false)

  // ── Merchants ──
  const [merchants,        setMerchants]        = useState<MerchantRow[]>([])
  const [merchantsLoaded,  setMerchantsLoaded]  = useState(false)
  const [merchantsLoading, setMerchantsLoading] = useState(false)
  const [merchantSearch,   setMerchantSearch]   = useState("")
  const [merchantFilter,   setMerchantFilter]   = useState<"all" | ShopStatus>("all")
  const [merchantInline,   setMerchantInline]   = useState<{ id: string; value: string } | null>(null)
  const [merchantSaving,   setMerchantSaving]   = useState(false)

  const [toast,   setToast]   = useState("")
  const [toastOk, setToastOk] = useState(true)
  const fire = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3000) }

  // ── Load: Customers ──────────────────────────────────────────────────────────

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    const supabase = createClient()
    const { data: profiles } = await supabase
      .from("profiles").select("id, full_name, phone, role, is_active, created_at")
      .order("created_at", { ascending: false }).limit(500)
    if (!profiles || profiles.length === 0) { setUsersLoading(false); return }

    const ids = profiles.map(p => p.id)
    const [
      { data: loyaltyRows }, { data: blacklistRows },
      { data: orderRows },   { data: shopRows },
      { data: walletRows },
    ] = await Promise.all([
      supabase.from("loyalty_points").select("user_id, total_points, tier").in("user_id", ids),
      supabase.from("blacklist").select("user_id, reason").in("user_id", ids),
      supabase.from("orders").select("customer_id, driver_id, shop_id, total_amount, total, ship_fee, status"),
      supabase.from("shops").select("id, owner_id, commission_rate"),
      supabase.from("wallets").select("user_id, type, balance").in("user_id", ids),
    ])

    const loyaltyMap   = Object.fromEntries((loyaltyRows   ?? []).map(l => [l.user_id, l]))
    const blacklistMap = Object.fromEntries((blacklistRows ?? []).map(b => [b.user_id, b]))
    const shopById     = Object.fromEntries((shopRows      ?? []).map(s => [s.id, s]))
    const walletByUser: Record<string, Record<string, number>> = {}
    for (const w of (walletRows ?? [])) {
      if (!walletByUser[w.user_id]) walletByUser[w.user_id] = {}
      walletByUser[w.user_id][w.type] = w.balance
    }

    const cOrdMap: Record<string, { count: number; spent: number }> = {}
    const dOrdMap: Record<string, { count: number; earned: number }> = {}
    const mOrdMap: Record<string, { count: number; revenue: number; commission: number }> = {}

    for (const o of (orderRows ?? [])) {
      if (o.customer_id) {
        if (!cOrdMap[o.customer_id]) cOrdMap[o.customer_id] = { count: 0, spent: 0 }
        cOrdMap[o.customer_id].count++
        if (o.status !== "cancelled") cOrdMap[o.customer_id].spent += o.total_amount ?? 0
      }
      if (o.driver_id && o.status === "delivered") {
        if (!dOrdMap[o.driver_id]) dOrdMap[o.driver_id] = { count: 0, earned: 0 }
        dOrdMap[o.driver_id].count++
        const shop = shopById[o.shop_id]
        dOrdMap[o.driver_id].earned += Math.round((o.ship_fee ?? 0) * (1 - (shop?.commission_rate ?? 15) / 100))
      }
      if (o.shop_id && o.status !== "cancelled") {
        const shop = shopById[o.shop_id]
        if (shop?.owner_id) {
          if (!mOrdMap[shop.owner_id]) mOrdMap[shop.owner_id] = { count: 0, revenue: 0, commission: 0 }
          mOrdMap[shop.owner_id].count++
          mOrdMap[shop.owner_id].revenue    += o.total_amount ?? 0
          mOrdMap[shop.owner_id].commission += Math.round((o.total ?? 0) * (shop.commission_rate ?? 15) / 100)
        }
      }
    }

    setUsers(profiles.map(p => {
      const bl   = blacklistMap[p.id]
      const loy  = loyaltyMap[p.id]
      const cOrd = cOrdMap[p.id] ?? { count: 0, spent: 0 }
      const dOrd = dOrdMap[p.id] ?? { count: 0, earned: 0 }
      const mOrd = mOrdMap[p.id] ?? { count: 0, revenue: 0, commission: 0 }
      const wBal = walletByUser[p.id] ?? {}
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
      return {
        id: p.id, fullName: p.full_name ?? "Người dùng", phone: p.phone, role, status,
        registeredDate: new Date(p.created_at).toLocaleDateString("vi-VN"),
        totalOrders: role === "driver" ? dOrd.count : role === "merchant" ? mOrd.count : cOrd.count,
        totalSpent:  role === "driver" ? dOrd.earned : role === "merchant" ? mOrd.revenue : cOrd.spent,
        loyaltyPoints: points, tier,
        shopRevenue: mOrd.revenue, shopCommission: mOrd.commission,
        driverEarnings: dOrd.earned,
        walletBalance: wBal["driver"] ?? wBal["customer"] ?? 0,
        blacklistReason: bl?.reason,
      }
    }))
    setUsersLoading(false)
  }

  // ── Load: Drivers ────────────────────────────────────────────────────────────

  async function loadDrivers() {
    if (driversLoaded) return
    setDriversLoading(true)
    const supabase = createClient()
    const { data: rows } = await supabase
      .from("drivers")
      .select("id, vehicle_type, license_plate, status, is_approved, rating_avg, total_trips, commission_rate, created_at, profiles(full_name, phone)")
      .order("created_at", { ascending: false })
    if (!rows || rows.length === 0) { setDriversLoading(false); setDriversLoaded(true); return }
    setDrivers(rows.map(r => {
      const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { full_name?: string; phone?: string } | null
      return {
        id: r.id,
        fullName: p?.full_name ?? "Tài xế",
        phone: p?.phone ?? "—",
        vehicleType: r.vehicle_type ?? "Xe máy",
        licensePlate: r.license_plate ?? "—",
        driverStatus: (r.status ?? "offline") as DriverStatus,
        isApproved: r.is_approved ?? false,
        ratingAvg: r.rating_avg ?? null,
        totalTrips: r.total_trips ?? 0,
        commissionRate: r.commission_rate ?? 20,
        joinedDate: new Date(r.created_at).toLocaleDateString("vi-VN"),
      }
    }))
    setDriversLoading(false)
    setDriversLoaded(true)
  }

  // ── Load: Merchants ──────────────────────────────────────────────────────────

  async function loadMerchants() {
    if (merchantsLoaded) return
    setMerchantsLoading(true)
    const supabase = createClient()
    const { data: rows, error: shopErr } = await supabase
      .from("shops")
      .select("id, owner_id, name, category, status, is_open, rating_avg, total_reviews, commission_rate, is_negotiated_commission, created_at")
      .order("created_at", { ascending: false })
    if (shopErr) console.error("[loadMerchants] shops query error:", shopErr)
    if (!rows || rows.length === 0) { setMerchantsLoading(false); setMerchantsLoaded(true); return }
    const ownerIds = [...new Set(rows.map(r => r.owner_id).filter(Boolean))]
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", ownerIds)
    const profMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    setMerchants(rows.map(r => {
      const p = profMap[r.owner_id] ?? {}
      return {
        id: r.id,
        shopName: r.name,
        ownerName: (p as { full_name?: string }).full_name ?? "Chủ quán",
        phone: (p as { phone?: string }).phone ?? "—",
        category: r.category ?? "Khác",
        shopStatus: (r.status ?? "pending") as ShopStatus,
        isOpen: r.is_open ?? false,
        ratingAvg: r.rating_avg ?? null,
        totalReviews: r.total_reviews ?? 0,
        commissionRate: r.commission_rate ?? 15,
        isNegotiated: r.is_negotiated_commission ?? false,
        createdDate: new Date(r.created_at).toLocaleDateString("vi-VN"),
      }
    }))
    setMerchantsLoading(false)
    setMerchantsLoaded(true)
  }

  // ── Tab switch ───────────────────────────────────────────────────────────────

  function switchTab(t: MainTab) {
    setActiveTab(t)
    if (t === "drivers"   && !driversLoaded)   loadDrivers()
    if (t === "merchants" && !merchantsLoaded) loadMerchants()
  }

  // ── Actions: Users ───────────────────────────────────────────────────────────

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
    setConfirmAction(null); setSelected(null)
  }
  const addPoints = async () => {
    if (!pointsModal) return
    const amount = parseInt(pointsAmount)
    if (!amount || isNaN(amount)) { setPointsMsg("Vui lòng nhập số điểm hợp lệ"); return }
    const reason = pointsReason === "Tự nhập" ? pointsCustom.trim() : pointsReason
    if (!reason) { setPointsMsg("Vui lòng nhập lý do"); return }
    setPointsSaving(true); setPointsMsg("")
    const supabase = createClient()
    const { data: cur } = await supabase.from("loyalty_points").select("total_points").eq("user_id", pointsModal.id).single()
    const newPoints = Math.max(0, (cur?.total_points ?? 0) + amount)
    let newTier: TierLevel = "bronze"
    if (newPoints >= 2000) newTier = "platinum"
    else if (newPoints >= 1000) newTier = "gold"
    else if (newPoints >= 500)  newTier = "silver"
    await supabase.from("loyalty_points").upsert({ user_id: pointsModal.id, total_points: newPoints, tier: newTier }, { onConflict: "user_id" })
    const emoji = amount > 0 ? "🎉" : "💸"
    const verb  = amount > 0 ? "được cộng" : "bị trừ"
    await supabase.from("notifications").insert({
      user_id: pointsModal.id, type: "system",
      title: `${emoji} ${Math.abs(amount).toLocaleString("vi-VN")} điểm ${verb}`,
      body: `Lý do: ${reason}. Điểm tích lũy hiện tại: ${newPoints.toLocaleString("vi-VN")} điểm.`,
    })
    setUsers(p => p.map(u => u.id === pointsModal.id ? { ...u, loyaltyPoints: newPoints, tier: newTier } : u))
    if (selected?.id === pointsModal.id) setSelected(s => s ? { ...s, loyaltyPoints: newPoints, tier: newTier } : s)
    setPointsMsg(`✅ ${amount > 0 ? "Cộng" : "Trừ"} ${Math.abs(amount)} điểm thành công · Tổng: ${newPoints.toLocaleString("vi-VN")}`)
    setTimeout(() => { setPointsModal(null); setPointsAmount(""); setPointsMsg(""); setPointsCustom("") }, 1800)
    setPointsSaving(false)
  }

  const adjustWallet = async () => {
    if (!walletModal) return
    const amount = parseInt(walletAmount)
    if (!amount || isNaN(amount)) { setWalletMsg("Vui lòng nhập số xu hợp lệ"); return }
    if (!walletNote.trim()) { setWalletMsg("Vui lòng nhập ghi chú"); return }
    setWalletSaving(true); setWalletMsg("")
    const supabase = createClient()
    const wType = walletModal.role === "driver" ? "driver" : "customer"
    const { data: cur } = await supabase.from("wallets").select("id, balance").eq("user_id", walletModal.id).eq("type", wType).single()
    const curBalance = cur?.balance ?? 0
    const newBalance = Math.max(0, curBalance + amount)
    if (!cur) {
      await supabase.from("wallets").insert({ user_id: walletModal.id, type: wType, balance: newBalance })
    } else {
      await supabase.from("wallets").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", cur.id)
      if (cur.id) {
        await supabase.from("transactions").insert({
          wallet_id: cur.id,
          type: amount > 0 ? "topup" : "withdrawal",
          amount: Math.abs(amount),
          balance_after: newBalance,
          note: `[Admin] ${walletNote.trim()}`,
        })
      }
    }
    const emoji = amount > 0 ? "💰" : "💸"
    const verb  = amount > 0 ? "được nạp" : "bị trừ"
    await supabase.from("notifications").insert({
      user_id: walletModal.id, type: "system",
      title: `${emoji} ${Math.abs(amount).toLocaleString("vi-VN")}đ ${verb} vào ví`,
      body: `Lý do: ${walletNote.trim()}. Số dư hiện tại: ${newBalance.toLocaleString("vi-VN")}đ.`,
    })
    setUsers(p => p.map(u => u.id === walletModal.id ? { ...u, walletBalance: newBalance } : u))
    if (selected?.id === walletModal.id) setSelected(s => s ? { ...s, walletBalance: newBalance } : s)
    setWalletMsg(`✅ ${amount > 0 ? "Nạp" : "Rút"} ${Math.abs(amount).toLocaleString("vi-VN")}đ · Số dư: ${newBalance.toLocaleString("vi-VN")}đ`)
    setTimeout(() => { setWalletModal(null); setWalletAmount(""); setWalletNote(""); setWalletMsg("") }, 1800)
    setWalletSaving(false)
  }

  const resetPassword = async () => {
    if (!resetModal || newPassword.length < 6) { setResetMsg("Mật khẩu phải ít nhất 6 ký tự"); return }
    setResetSaving(true); setResetMsg("")
    try {
      const res  = await fetch("/api/admin/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: resetModal.id, newPassword }) })
      const data = await res.json()
      if (!res.ok || data.error) { setResetMsg("Lỗi: " + (data.error ?? "Không thể đặt lại mật khẩu")) }
      else { setResetMsg("✅ Đặt mật khẩu thành công!"); setTimeout(() => { setResetModal(null); setNewPassword(""); setResetMsg("") }, 1500) }
    } catch { setResetMsg("Lỗi kết nối") }
    setResetSaving(false)
  }

  // ── Actions: Driver commission ───────────────────────────────────────────────

  const saveDriverCommission = async (id: string, rate: number) => {
    setDriverSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("drivers").update({ commission_rate: rate }).eq("id", id)
    setDriverSaving(false)
    if (error) { fire("❌ Lỗi cập nhật hoa hồng", false); return }
    setDrivers(ds => ds.map(d => d.id === id ? { ...d, commissionRate: rate } : d))
    setDriverInline(null)
    fire(`✅ Hoa hồng tài xế → ${rate}%`)
  }

  // ── Actions: Merchant commission ─────────────────────────────────────────────

  const saveMerchantCommission = async (id: string, rate: number) => {
    setMerchantSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("shops").update({ commission_rate: rate, is_negotiated_commission: true }).eq("id", id)
    setMerchantSaving(false)
    if (error) { fire("❌ Lỗi cập nhật hoa hồng", false); return }
    setMerchants(ms => ms.map(m => m.id === id ? { ...m, commissionRate: rate, isNegotiated: true } : m))
    setMerchantInline(null)
    fire(`✅ Hoa hồng thoả thuận ${rate}% đã lưu`)
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  function getDetailStats(u: AppUser) {
    if (u.role === "merchant") return [
      { label: "Tổng đơn",  value: u.totalOrders.toString(),   c: "#FF8C00" },
      { label: "Doanh thu", value: fmtShort(u.shopRevenue),    c: "#f5c542" },
      { label: "Hoa hồng",  value: fmtShort(u.shopCommission), c: "#3ecf6e" },
    ]
    if (u.role === "driver") return [
      { label: "Tổng đơn", value: u.totalOrders.toString(),   c: "#FF8C00" },
      { label: "Thu nhập",  value: fmtShort(u.driverEarnings), c: "#f5c542" },
      { label: "Số dư ví",  value: fmtShort(u.walletBalance),  c: "#4a8ff5" },
    ]
    return [
      { label: "Tổng đơn",  value: u.totalOrders.toString(),  c: "#FF8C00" },
      { label: "Chi tiêu",  value: fmtShort(u.totalSpent),    c: "#f5c542" },
      { label: "Điểm tích", value: u.loyaltyPoints.toString(), c: "#b464ff" },
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
  const totalMerchRevenue = users.filter(u => u.role === "merchant").reduce((s, u) => s + u.shopRevenue, 0)
  const totalCommission   = users.filter(u => u.role === "merchant").reduce((s, u) => s + u.shopCommission, 0)
  const totalCustSpent    = users.filter(u => u.role === "customer").reduce((s, u) => s + u.totalSpent, 0)

  const shownUsers = users
    .filter(u => filterStatus === "all" || u.status === filterStatus)
    .filter(u => !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search))

  const shownDrivers = drivers
    .filter(d => driverFilter === "all" || (driverFilter === "approved" ? d.isApproved : !d.isApproved))
    .filter(d => !driverSearch || d.fullName.toLowerCase().includes(driverSearch.toLowerCase()) || d.licensePlate.includes(driverSearch))

  const shownMerchants = merchants
    .filter(m => merchantFilter === "all" || m.shopStatus === merchantFilter)
    .filter(m => !merchantSearch || m.shopName.toLowerCase().includes(merchantSearch.toLowerCase()) || m.ownerName.toLowerCase().includes(merchantSearch.toLowerCase()))

  // ── Inline cell helpers ───────────────────────────────────────────────────────

  function CommCell({ id, rate, isNegotiated, inline, setInline, onSave, saving: sv }: {
    id: string; rate: number; isNegotiated?: boolean; inline: { id: string; value: string } | null
    setInline: (v: { id: string; value: string } | null) => void
    onSave: (id: string, rate: number) => void; saving: boolean
  }) {
    const c  = isNegotiated ? "#f5c542" : "#9080b0"
    const bg = isNegotiated ? "rgba(245,197,66,0.12)" : "rgba(144,128,176,0.08)"
    const bd = isNegotiated ? "rgba(245,197,66,0.35)" : "rgba(144,128,176,0.2)"
    if (inline?.id === id) return (
      <div style={{ display: "flex", alignItems: "center", gap: 3 }} onClick={e => e.stopPropagation()}>
        <input type="number" min={0} max={50} value={inline.value} autoFocus
          onChange={e => setInline({ id, value: e.target.value })}
          onKeyDown={e => {
            if (e.key === "Enter")  onSave(id, parseInt(inline.value) || 0)
            if (e.key === "Escape") setInline(null)
          }}
          style={{ width: 42, height: 24, borderRadius: 6, background: "rgba(245,197,66,0.14)", border: "1.5px solid rgba(245,197,66,0.6)", color: "#f5c542", fontSize: 11, textAlign: "center", padding: "0 3px", fontFamily: "Lexend", boxShadow: "0 0 0 3px rgba(245,197,66,0.1)" }} />
        <button onClick={() => onSave(id, parseInt(inline.value) || 0)} disabled={sv} title="Lưu (Enter)"
          style={{ width: 22, height: 22, borderRadius: 5, background: "rgba(62,207,110,0.15)", border: "1px solid rgba(62,207,110,0.3)", color: "#3ecf6e", fontSize: 10, cursor: "pointer" }}>✓</button>
        <button onClick={() => setInline(null)} title="Hủy (Esc)"
          style={{ width: 22, height: 22, borderRadius: 5, background: "rgba(255,64,64,0.1)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 10, cursor: "pointer" }}>✕</button>
      </div>
    )
    return (
      <span onClick={e => { e.stopPropagation(); setInline({ id, value: rate.toString() }) }}
        title={isNegotiated ? "Hoa hồng thoả thuận — click để chỉnh" : "Hoa hồng mặc định — click để chỉnh"}
        style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: bg, border: `1px solid ${bd}`, color: c, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, transition: "all .15s", userSelect: "none" }}>
        {rate}% <span style={{ fontSize: 8 }}>✏️</span>
      </span>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        input { outline: none; font-family: 'Lexend', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .user-row:hover    { background: rgba(255,107,0,0.04) !important; }
        .kpi-card          { animation: fadeUp 0.35s ease both; }
        .kpi-card:hover    { transform: translateY(-2px); transition: all 0.2s; }
        .action-btn:hover  { filter: brightness(1.15); transform: scale(1.02); transition: all 0.15s; }
        .comm-badge:hover  { background: rgba(180,100,255,0.22) !important; border-color: rgba(180,100,255,0.55) !important; transform: scale(1.04); }
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

      <AdminShell pageTitle="👤 Tài khoản" pageSubtitle="Khách hàng · Tài xế · Cửa hàng">
        <div style={{ flex: 1, overflowY: "auto", padding: 16, height: "100%" }}>

          {/* ── Main tabs ── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 6 }}>
            {([
              { key: "customers" as MainTab, icon: "👤", label: "Khách hàng", count: counts.customers, c: "#f0eaff" },
              { key: "drivers"   as MainTab, icon: "🛵", label: "Tài xế",     count: counts.drivers,   c: "#4a8ff5" },
              { key: "merchants" as MainTab, icon: "🏪", label: "Cửa hàng",   count: counts.merchants, c: "#FFB347" },
            ]).map(t => (
              <button key={t.key} onClick={() => switchTab(t.key)} style={{
                flex: 1, height: 38, borderRadius: 9, cursor: "pointer", fontFamily: "Lexend", fontSize: 11,
                fontWeight: activeTab === t.key ? 700 : 400, transition: "all .2s",
                background: activeTab === t.key ? `${t.c}18` : "transparent",
                border: activeTab === t.key ? `1px solid ${t.c}44` : "1px solid transparent",
                color: activeTab === t.key ? t.c : "rgba(144,128,176,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <span style={{ fontSize: 15 }}>{t.icon}</span>
                {t.label}
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 9, background: activeTab === t.key ? `${t.c}22` : "rgba(255,255,255,0.06)", color: activeTab === t.key ? t.c : "rgba(144,128,176,0.4)", fontWeight: 700 }}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              TAB: KHÁCH HÀNG
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "customers" && (
            <>
              {/* KPI */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
                {[
                  { icon: "👥", label: "Tổng tài khoản",    value: counts.all,                  c: "#FF8C00", bg: "rgba(255,107,0,0.07)",   bd: "rgba(255,107,0,0.2)",    delay: "0s"    },
                  { icon: "✅", label: "Đang hoạt động",    value: counts.active,                c: "#3ecf6e", bg: "rgba(62,207,110,0.07)",  bd: "rgba(62,207,110,0.2)",   delay: "0.05s" },
                  { icon: "🔒", label: "Bị khóa",           value: counts.blacklisted,           c: "#ff4040", bg: "rgba(255,64,64,0.07)",   bd: "rgba(255,64,64,0.2)",    delay: "0.10s" },
                  { icon: "💰", label: "Doanh thu shop",    value: fmtShort(totalMerchRevenue),  c: "#f5c542", bg: "rgba(245,197,66,0.07)",  bd: "rgba(245,197,66,0.2)",   delay: "0.15s" },
                  { icon: "🤝", label: "Hoa hồng nền tảng", value: fmtShort(totalCommission),   c: "#3ecf6e", bg: "rgba(62,207,110,0.07)",  bd: "rgba(62,207,110,0.2)",   delay: "0.20s" },
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
              </div>

              {/* Table */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 740 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "42px 1.8fr 110px 78px 62px 92px 84px 110px", gap: 8, padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                      {["", "Tên", "SĐT", "Đăng ký", "Đơn", "Doanh số", "Trạng thái", "Thao tác"].map(h => (
                        <div key={h} style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>{h}</div>
                      ))}
                    </div>
                    {usersLoading ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Đang tải...</div>
                    ) : shownUsers.length === 0 ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Không tìm thấy tài khoản nào</div>
                    ) : shownUsers.map((u, idx) => {
                      const st = STATUS_CFG[u.status]; const role = ROLE_CFG[u.role]
                      return (
                        <div key={u.id} className="user-row" onClick={() => setSelected(u)}
                          style={{ display: "grid", gridTemplateColumns: "42px 1.8fr 110px 78px 62px 92px 84px 110px", gap: 8, padding: "10px 14px", alignItems: "center", borderBottom: idx < shownUsers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "pointer", transition: "all 0.15s" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: role.bg, border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, position: "relative" }}>
                            {role.icon}
                            {u.status === "blacklisted" && <div style={{ position: "absolute", bottom: -2, right: -2, width: 13, height: 13, borderRadius: "50%", background: "#ff4040", border: "1.5px solid #06050a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7 }}>🔒</div>}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: "#f0eaff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.fullName}</div>
                            <span style={{ fontSize: 7, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: role.bg, color: role.color }}>{role.label}</span>
                          </div>
                          <div style={{ color: "rgba(240,234,255,0.65)", fontSize: 10 }}>{u.phone}</div>
                          <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 9 }}>{u.registeredDate}</div>
                          <div style={{ color: u.totalOrders > 0 ? "#FF8C00" : "rgba(144,128,176,0.3)", fontSize: 11, fontWeight: 700 }}>{u.totalOrders > 0 ? u.totalOrders : "—"}</div>
                          <div style={{ color: u.totalSpent > 0 ? "#f0eaff" : "rgba(144,128,176,0.3)", fontSize: 9, fontWeight: u.totalSpent > 0 ? 600 : 400 }}>{u.totalSpent > 0 ? fmtShort(u.totalSpent) : "—"}</div>
                          <div><span style={{ fontSize: 8, fontWeight: 700, padding: "3px 7px", borderRadius: 5, border: `1px solid ${st.border}`, background: st.bg, color: st.color, whiteSpace: "nowrap" }}>{st.label}</span></div>
                          <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                            {u.status !== "blacklisted"
                              ? <button className="action-btn" onClick={() => setConfirmAction({ type: "lock",   id: u.id })} style={{ padding: "4px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,64,64,0.08)",   border: "1px solid rgba(255,64,64,0.2)",   color: "#ff4040", fontSize: 8, fontWeight: 700, whiteSpace: "nowrap" }}>🔒 Khóa</button>
                              : <button className="action-btn" onClick={() => setConfirmAction({ type: "unlock", id: u.id })} style={{ padding: "4px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.08)",  border: "1px solid rgba(62,207,110,0.2)",  color: "#3ecf6e", fontSize: 8, fontWeight: 700, whiteSpace: "nowrap" }}>🔓 Mở</button>
                            }
                            <button className="action-btn" onClick={() => setSelected(u)} style={{ padding: "4px 7px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.7)", fontSize: 8, fontWeight: 600, whiteSpace: "nowrap" }}>Chi tiết</button>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
                      <div style={{ color: "rgba(144,128,176,0.35)", fontSize: 8 }}>Hiển thị {shownUsers.length} / {users.length}</div>
                      <div style={{ color: "rgba(144,128,176,0.35)", fontSize: 8 }}>Chi tiêu KH: <span style={{ color: "#FF8C00", fontWeight: 700 }}>{fmt(totalCustSpent)}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: TÀI XẾ
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "drivers" && (
            <>
              {/* KPI */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                {[
                  { icon: "🛵", label: "Tổng tài xế",  value: drivers.length,                                 c: "#4a8ff5", bg: "rgba(74,143,245,0.07)",  bd: "rgba(74,143,245,0.2)",  delay: "0s"    },
                  { icon: "✅", label: "Đã duyệt",      value: drivers.filter(d => d.isApproved).length,       c: "#3ecf6e", bg: "rgba(62,207,110,0.07)",  bd: "rgba(62,207,110,0.2)",  delay: "0.05s" },
                  { icon: "🟢", label: "Đang online",   value: drivers.filter(d => d.driverStatus === "online").length, c: "#3ecf6e", bg: "rgba(62,207,110,0.07)", bd: "rgba(62,207,110,0.2)", delay: "0.10s" },
                  { icon: "⏳", label: "Chờ duyệt",    value: drivers.filter(d => !d.isApproved).length,      c: "#FFB347", bg: "rgba(255,179,71,0.07)",  bd: "rgba(255,179,71,0.2)",  delay: "0.15s" },
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
                  <input value={driverSearch} onChange={e => setDriverSearch(e.target.value)} placeholder="Tìm tên, biển số xe..." style={{ flex: 1, background: "transparent", border: "none", color: "#f0eaff", fontSize: 11 }} />
                  {driverSearch && <span onClick={() => setDriverSearch("")} style={{ color: "rgba(144,128,176,0.4)", cursor: "pointer", fontSize: 13 }}>✕</span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {([
                    { key: "all",      label: `Tất cả (${drivers.length})`,                            c: "#4a8ff5" },
                    { key: "approved", label: `Đã duyệt (${drivers.filter(d => d.isApproved).length})`,  c: "#3ecf6e" },
                    { key: "pending",  label: `Chờ duyệt (${drivers.filter(d => !d.isApproved).length})`, c: "#FFB347" },
                  ] as const).map(tab => (
                    <button key={tab.key} onClick={() => setDriverFilter(tab.key)} style={{ padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "Lexend", fontSize: 9, fontWeight: driverFilter === tab.key ? 700 : 400, background: driverFilter === tab.key ? `${tab.c}18` : "rgba(255,255,255,0.04)", border: `1px solid ${driverFilter === tab.key ? tab.c + "55" : "rgba(255,255,255,0.07)"}`, color: driverFilter === tab.key ? tab.c : "rgba(144,128,176,0.6)" }}>{tab.label}</button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 720 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "42px 1.6fr 90px 90px 80px 60px 48px 72px 80px 54px", gap: 8, padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                      {["", "Tên / SĐT", "Phương tiện", "Biển số", "Trạng thái", "Rating", "Đơn", "Hoa hồng", "Ngày tham gia", "Ví xu"].map(h => (
                        <div key={h} style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>{h}</div>
                      ))}
                    </div>
                    {driversLoading ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Đang tải...</div>
                    ) : shownDrivers.length === 0 ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Không có tài xế nào</div>
                    ) : shownDrivers.map((d, idx) => {
                      const ds = DRIVER_STATUS_CFG[d.driverStatus]
                      return (
                        <div key={d.id} className="user-row"
                          style={{ display: "grid", gridTemplateColumns: "42px 1.6fr 90px 90px 80px 60px 48px 72px 80px 54px", gap: 8, padding: "10px 14px", alignItems: "center", borderBottom: idx < shownDrivers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", transition: "all 0.15s" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "rgba(74,143,245,0.12)", border: "1px solid rgba(74,143,245,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, position: "relative" }}>
                            🛵
                            {d.isApproved && <div style={{ position: "absolute", bottom: -2, right: -2, width: 11, height: 11, borderRadius: "50%", background: d.driverStatus === "online" ? "#3ecf6e" : "#9080b0", border: "1.5px solid #06050a" }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: "#f0eaff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.fullName}</div>
                            <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 8, marginTop: 1 }}>{d.phone}</div>
                          </div>
                          <div style={{ color: "rgba(240,234,255,0.7)", fontSize: 9 }}>{d.vehicleType}</div>
                          <div style={{ color: "#FFB347", fontSize: 9, fontWeight: 600, fontFamily: "monospace" }}>{d.licensePlate}</div>
                          <div>
                            <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: ds.bg, color: ds.color, whiteSpace: "nowrap" }}>
                              {d.isApproved ? ds.label : "⏳ Chờ duyệt"}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            {d.ratingAvg !== null ? <><span style={{ color: "#f5c542", fontSize: 10 }}>⭐</span><span style={{ color: "#f0eaff", fontSize: 10, fontWeight: 700 }}>{d.ratingAvg}</span></> : <span style={{ color: "rgba(144,128,176,0.3)", fontSize: 9 }}>—</span>}
                          </div>
                          <div style={{ color: d.totalTrips > 0 ? "#FF8C00" : "rgba(144,128,176,0.3)", fontSize: 11, fontWeight: 700 }}>{d.totalTrips > 0 ? d.totalTrips : "—"}</div>
                          <div>
                            <CommCell id={d.id} rate={d.commissionRate} inline={driverInline} setInline={setDriverInline} onSave={saveDriverCommission} saving={driverSaving} />
                          </div>
                          <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 9 }}>{d.joinedDate}</div>
                          <div onClick={e => e.stopPropagation()}>
                            <button className="action-btn" onClick={() => { setWalletModal({ id: d.id, name: d.fullName, role: "driver", balance: users.find(u => u.id === d.id)?.walletBalance ?? 0 }); setWalletAmount(""); setWalletNote(""); setWalletMsg("") }} style={{ padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)", color: "#3ecf6e", fontSize: 8, fontWeight: 700, whiteSpace: "nowrap" }}>💰 Xu</button>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ color: "rgba(144,128,176,0.35)", fontSize: 8 }}>Hiển thị {shownDrivers.length} / {drivers.length} tài xế</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: CỬA HÀNG
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "merchants" && (
            <>
              {/* KPI */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                {[
                  { icon: "🏪", label: "Tổng cửa hàng",  value: merchants.length,                                      c: "#FFB347", bg: "rgba(255,179,71,0.07)",  bd: "rgba(255,179,71,0.2)",  delay: "0s"    },
                  { icon: "✅", label: "Đang hoạt động", value: merchants.filter(m => m.shopStatus === "approved").length, c: "#3ecf6e", bg: "rgba(62,207,110,0.07)",  bd: "rgba(62,207,110,0.2)",  delay: "0.05s" },
                  { icon: "🟢", label: "Đang mở cửa",    value: merchants.filter(m => m.isOpen).length,                 c: "#3ecf6e", bg: "rgba(62,207,110,0.07)",  bd: "rgba(62,207,110,0.2)",  delay: "0.10s" },
                  { icon: "🤝", label: "HH thoả thuận",  value: merchants.filter(m => m.isNegotiated).length,           c: "#b464ff", bg: "rgba(180,100,255,0.07)", bd: "rgba(180,100,255,0.2)", delay: "0.15s" },
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
                  <input value={merchantSearch} onChange={e => setMerchantSearch(e.target.value)} placeholder="Tìm tên quán, chủ quán..." style={{ flex: 1, background: "transparent", border: "none", color: "#f0eaff", fontSize: 11 }} />
                  {merchantSearch && <span onClick={() => setMerchantSearch("")} style={{ color: "rgba(144,128,176,0.4)", cursor: "pointer", fontSize: 13 }}>✕</span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {([
                    { key: "all",       label: `Tất cả (${merchants.length})`,                                              c: "#FFB347" },
                    { key: "approved",  label: `Hoạt động (${merchants.filter(m => m.shopStatus === "approved").length})`,  c: "#3ecf6e" },
                    { key: "pending",   label: `Chờ duyệt (${merchants.filter(m => m.shopStatus === "pending").length})`,   c: "#FFB347" },
                    { key: "suspended", label: `Tạm khóa (${merchants.filter(m => m.shopStatus === "suspended").length})`,  c: "#ff4040" },
                  ] as const).map(tab => (
                    <button key={tab.key} onClick={() => setMerchantFilter(tab.key)} style={{ padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "Lexend", fontSize: 9, fontWeight: merchantFilter === tab.key ? 700 : 400, background: merchantFilter === tab.key ? `${tab.c}18` : "rgba(255,255,255,0.04)", border: `1px solid ${merchantFilter === tab.key ? tab.c + "55" : "rgba(255,255,255,0.07)"}`, color: merchantFilter === tab.key ? tab.c : "rgba(144,128,176,0.6)" }}>{tab.label}</button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 780 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "36px 1.8fr 1.2fr 80px 80px 55px 72px 80px", gap: 8, padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                      {["", "Cửa hàng", "Chủ / SĐT", "Danh mục", "Trạng thái", "Rating", "Hoa hồng", "Ngày tạo"].map(h => (
                        <div key={h} style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>{h}</div>
                      ))}
                    </div>
                    {merchantsLoading ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Đang tải...</div>
                    ) : shownMerchants.length === 0 ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>Không có cửa hàng nào</div>
                    ) : shownMerchants.map((m, idx) => {
                      const ss = SHOP_STATUS_CFG[m.shopStatus]
                      return (
                        <div key={m.id} className="user-row"
                          style={{ display: "grid", gridTemplateColumns: "36px 1.8fr 1.2fr 80px 80px 55px 72px 80px", gap: 8, padding: "10px 14px", alignItems: "center", borderBottom: idx < shownMerchants.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", transition: "all 0.15s" }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,179,71,0.12)", border: "1px solid rgba(255,179,71,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, position: "relative" }}>
                            {categoryIcon(m.category)}
                            {m.isOpen && <div style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: "#3ecf6e", border: "1.5px solid #06050a", boxShadow: "0 0 4px #3ecf6e" }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: "#f0eaff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.shopName}</div>
                            <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 8, marginTop: 1 }}>{m.category}</div>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: "#f0eaff", fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.ownerName}</div>
                            <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 8 }}>{m.phone}</div>
                          </div>
                          <div style={{ color: "rgba(240,234,255,0.6)", fontSize: 9 }}>{m.category}</div>
                          <div>
                            <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 5, border: `1px solid ${ss.border}`, background: ss.bg, color: ss.color, whiteSpace: "nowrap" }}>{ss.label}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            {m.ratingAvg !== null ? <><span style={{ color: "#f5c542", fontSize: 10 }}>⭐</span><span style={{ color: "#f0eaff", fontSize: 10, fontWeight: 700 }}>{m.ratingAvg}</span></> : <span style={{ color: "rgba(144,128,176,0.3)", fontSize: 9 }}>—</span>}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <CommCell id={m.id} rate={m.commissionRate} isNegotiated={m.isNegotiated} inline={merchantInline} setInline={setMerchantInline} onSave={saveMerchantCommission} saving={merchantSaving} />
                            {m.isNegotiated && <span style={{ fontSize: 7, color: "#f5c542", opacity: 0.8 }}>thoả thuận</span>}
                          </div>
                          <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 9 }}>{m.createdDate}</div>
                        </div>
                      )
                    })}
                    <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ color: "rgba(144,128,176,0.35)", fontSize: 8 }}>Hiển thị {shownMerchants.length} / {merchants.length} cửa hàng</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* ── Detail Drawer (customers) ──────────────────────────────────────── */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60, backdropFilter: "blur(5px)" }} />
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 24, stiffness: 300 }} style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 360, background: "#0d0b19", borderLeft: "1px solid rgba(255,255,255,0.08)", zIndex: 61, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Hồ sơ {ROLE_CFG[selected.role].label}</div>
                    <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(144,128,176,0.6)", fontSize: 16, cursor: "pointer" }}>×</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 18, flexShrink: 0, background: ROLE_CFG[selected.role].bg, border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{ROLE_CFG[selected.role].icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#f0eaff", fontSize: 16, fontWeight: 800, marginBottom: 3 }}>{selected.fullName}</div>
                      <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 9, marginBottom: 5 }}>{selected.phone}</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5, border: `1px solid ${STATUS_CFG[selected.status].border}`, background: STATUS_CFG[selected.status].bg, color: STATUS_CFG[selected.status].color }}>{STATUS_CFG[selected.status].label}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: ROLE_CFG[selected.role].bg, border: `1px solid ${ROLE_CFG[selected.role].color}44`, color: ROLE_CFG[selected.role].color }}>{ROLE_CFG[selected.role].icon} {ROLE_CFG[selected.role].label}</span>
                        {selected.role === "customer" && <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: TIER_CFG[selected.tier].bg, border: `1px solid ${TIER_CFG[selected.tier].color}44`, color: TIER_CFG[selected.tier].color }}>{TIER_CFG[selected.tier].icon} {TIER_CFG[selected.tier].label}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {getDetailStats(selected).map(s => (
                      <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: 8, textAlign: "center" }}>
                        <div style={{ color: s.c, fontSize: 15, fontWeight: 800 }}>{s.value}</div>
                        <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, padding: "14px 18px", overflowY: "auto" }}>
                  {selected.status === "blacklisted" && selected.blacklistReason && (
                    <div style={{ background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                      <div style={{ color: "#ff4040", fontSize: 9, fontWeight: 700, marginBottom: 4 }}>⚠️ Lý do bị khóa</div>
                      <div style={{ color: "rgba(255,100,100,0.8)", fontSize: 10, lineHeight: 1.5 }}>{selected.blacklistReason}</div>
                    </div>
                  )}
                  {([
                    ["Số điện thoại", selected.phone],
                    ["Ngày đăng ký", selected.registeredDate],
                    ["Trạng thái", STATUS_CFG[selected.status].label],
                    ["Vai trò", ROLE_CFG[selected.role].label],
                    ...(selected.role === "customer" ? [["Số dư ví", fmt(selected.walletBalance)]] : []),
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 12 }}>
                      <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 9 }}>{k}</span>
                      <span style={{ color: k === "Số dư ví" ? "#3ecf6e" : "#f0eaff", fontSize: 9, fontWeight: 600, textAlign: "right" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "12px 18px 18px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {selected.role === "customer" && (
                    <>
                      <button onClick={() => { setWalletModal({ id: selected.id, name: selected.fullName, role: "customer", balance: selected.walletBalance }); setWalletAmount(""); setWalletNote(""); setWalletMsg("") }} style={{ width: "100%", height: 38, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.25)", color: "#3ecf6e", fontSize: 11, fontWeight: 700 }}>💰 Nạp / Rút xu Giao Nhanh</button>
                      <button onClick={() => { setPointsModal(selected); setPointsAmount(""); setPointsMsg(""); setPointsCustom(""); setPointsReason("Sự kiện") }} style={{ width: "100%", height: 38, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend", background: "rgba(180,100,255,0.08)", border: "1px solid rgba(180,100,255,0.25)", color: "#b464ff", fontSize: 11, fontWeight: 700 }}>⭐ Nạp / Rút điểm tích lũy</button>
                    </>
                  )}
                  {selected.role !== "admin" && (
                    <button onClick={() => { setResetModal(selected); setNewPassword(""); setResetMsg("") }} style={{ width: "100%", height: 38, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.25)", color: "#FF8C00", fontSize: 11, fontWeight: 700 }}>🔑 Đặt lại mật khẩu</button>
                  )}
                  {selected.status !== "blacklisted"
                    ? <button onClick={() => setConfirmAction({ type: "lock",   id: selected.id })} style={{ width: "100%", height: 38, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,64,64,0.08)",  border: "1px solid rgba(255,64,64,0.2)",  color: "#ff4040", fontSize: 11, fontWeight: 700 }}>🔒 Khóa tài khoản</button>
                    : <button onClick={() => setConfirmAction({ type: "unlock", id: selected.id })} style={{ width: "100%", height: 38, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)", color: "#3ecf6e", fontSize: 11, fontWeight: 700 }}>🔓 Mở khóa tài khoản</button>
                  }
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
                style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 320, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100svh - 48px)", overflowY: "auto", background: "#0d0b19", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 18, padding: "22px 20px 18px", zIndex: 71 }}>
                <div style={{ fontSize: 34, textAlign: "center", marginBottom: 10 }}>🔑</div>
                <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 4 }}>Đặt lại mật khẩu</div>
                <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 10, textAlign: "center", marginBottom: 16 }}>{resetModal.fullName} · {resetModal.phone}</div>
                <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="text" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 13px", color: "#f0eaff", fontSize: 12, fontFamily: "Lexend", marginBottom: 8, boxSizing: "border-box" }} />
                {resetMsg && <div style={{ fontSize: 10, color: resetMsg.startsWith("✅") ? "#3ecf6e" : "#ff6060", marginBottom: 10, textAlign: "center", background: resetMsg.startsWith("✅") ? "rgba(62,207,110,0.08)" : "rgba(255,64,64,0.08)", borderRadius: 8, padding: "6px 10px" }}>{resetMsg}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={() => setResetModal(null)} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.6)", fontSize: 11, fontWeight: 600 }}>Hủy</button>
                  <button onClick={resetPassword} disabled={resetSaving || newPassword.length < 6} style={{ flex: 1, height: 40, borderRadius: 10, cursor: resetSaving ? "default" : "pointer", fontFamily: "Lexend", background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.3)", color: "#FF8C00", fontSize: 11, fontWeight: 800, opacity: newPassword.length < 6 ? 0.4 : 1 }}>{resetSaving ? "Đang lưu..." : "✅ Xác nhận"}</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Points Modal ── */}
        <AnimatePresence>
          {pointsModal && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPointsModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 70, backdropFilter: "blur(6px)" }} />
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", damping: 22, stiffness: 350 }}
                style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 340, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100svh - 48px)", overflowY: "auto", background: "#0d0b19", border: "1px solid rgba(180,100,255,0.25)", borderRadius: 18, padding: "22px 20px 18px", zIndex: 71 }}>
                <div style={{ fontSize: 34, textAlign: "center", marginBottom: 10 }}>⭐</div>
                <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 4 }}>Nạp / Rút điểm tích lũy</div>
                <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 10, textAlign: "center", marginBottom: 16 }}>
                  {pointsModal.fullName} · Hiện có {pointsModal.loyaltyPoints.toLocaleString("vi-VN")} điểm
                </div>

                {/* Amount */}
                <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, marginBottom: 5 }}>Số điểm (+ để cộng, - để trừ)</div>
                <input type="number" value={pointsAmount} onChange={e => setPointsAmount(e.target.value)} placeholder="VD: 100 hoặc -50"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(180,100,255,0.25)", borderRadius: 10, padding: "10px 13px", color: "#b464ff", fontSize: 14, fontFamily: "Lexend", marginBottom: 12, boxSizing: "border-box", textAlign: "center", fontWeight: 800 }} />

                {/* Reason */}
                <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, marginBottom: 6 }}>Lý do</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                  {(["Sự kiện", "Sinh nhật", "Event", "Tự nhập"] as const).map(r => (
                    <button key={r} onClick={() => setPointsReason(r)} style={{ height: 32, borderRadius: 8, cursor: "pointer", fontFamily: "Lexend", fontSize: 10, fontWeight: pointsReason === r ? 700 : 400, background: pointsReason === r ? "rgba(62,207,110,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${pointsReason === r ? "rgba(62,207,110,0.4)" : "rgba(255,255,255,0.08)"}`, color: pointsReason === r ? "#3ecf6e" : "rgba(144,128,176,0.6)" }}>
                      {r}
                    </button>
                  ))}
                </div>
                {pointsReason === "Tự nhập" && (
                  <input value={pointsCustom} onChange={e => setPointsCustom(e.target.value)} placeholder="Nhập lý do..."
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 13px", color: "#f0eaff", fontSize: 11, fontFamily: "Lexend", marginBottom: 10, boxSizing: "border-box" }} />
                )}

                {pointsMsg && <div style={{ fontSize: 10, color: pointsMsg.startsWith("✅") ? "#3ecf6e" : "#ff6060", marginBottom: 10, textAlign: "center", background: pointsMsg.startsWith("✅") ? "rgba(62,207,110,0.08)" : "rgba(255,64,64,0.08)", borderRadius: 8, padding: "6px 10px" }}>{pointsMsg}</div>}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={() => setPointsModal(null)} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.6)", fontSize: 11, fontWeight: 600 }}>Hủy</button>
                  <button onClick={addPoints} disabled={pointsSaving} style={{ flex: 2, height: 40, borderRadius: 10, cursor: pointsSaving ? "default" : "pointer", fontFamily: "Lexend", background: "rgba(180,100,255,0.12)", border: "1px solid rgba(180,100,255,0.3)", color: "#b464ff", fontSize: 11, fontWeight: 800, opacity: pointsSaving ? 0.6 : 1 }}>{pointsSaving ? "Đang xử lý..." : "✅ Xác nhận"}</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Wallet (xu) Modal ── */}
        <AnimatePresence>
          {walletModal && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setWalletModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 70, backdropFilter: "blur(6px)" }} />
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", damping: 22, stiffness: 350 }}
                style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 340, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100svh - 48px)", overflowY: "auto", background: "#0d0b19", border: "1px solid rgba(62,207,110,0.25)", borderRadius: 18, padding: "22px 20px 18px", zIndex: 71 }}>
                <div style={{ fontSize: 34, textAlign: "center", marginBottom: 10 }}>💰</div>
                <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 4 }}>Nạp / Rút xu Giao Nhanh</div>
                <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 10, textAlign: "center", marginBottom: 16 }}>
                  {walletModal.name} · {walletModal.role === "driver" ? "Tài xế" : "Khách hàng"} · Số dư: {walletModal.balance.toLocaleString("vi-VN")}đ
                </div>

                <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, marginBottom: 5 }}>Số tiền (+ để nạp, - để rút)</div>
                <input type="number" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} placeholder="VD: 50000 hoặc -20000"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(62,207,110,0.25)", borderRadius: 10, padding: "10px 13px", color: "#3ecf6e", fontSize: 14, fontFamily: "Lexend", marginBottom: 12, boxSizing: "border-box", textAlign: "center", fontWeight: 800 }} />

                <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, marginBottom: 6 }}>Ghi chú (bắt buộc)</div>
                <input value={walletNote} onChange={e => setWalletNote(e.target.value)} placeholder="VD: Thưởng mời bạn bè, Hoàn tiền..."
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 13px", color: "#f0eaff", fontSize: 11, fontFamily: "Lexend", marginBottom: 14, boxSizing: "border-box" }} />

                {walletMsg && <div style={{ fontSize: 10, color: walletMsg.startsWith("✅") ? "#3ecf6e" : "#ff6060", marginBottom: 10, textAlign: "center", background: walletMsg.startsWith("✅") ? "rgba(62,207,110,0.08)" : "rgba(255,64,64,0.08)", borderRadius: 8, padding: "6px 10px" }}>{walletMsg}</div>}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={() => setWalletModal(null)} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.6)", fontSize: 11, fontWeight: 600 }}>Hủy</button>
                  <button onClick={adjustWallet} disabled={walletSaving} style={{ flex: 2, height: 40, borderRadius: 10, cursor: walletSaving ? "default" : "pointer", fontFamily: "Lexend", background: "rgba(62,207,110,0.12)", border: "1px solid rgba(62,207,110,0.3)", color: "#3ecf6e", fontSize: 11, fontWeight: 800, opacity: walletSaving ? 0.6 : 1 }}>{walletSaving ? "Đang xử lý..." : "✅ Xác nhận"}</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Confirm Lock/Unlock ── */}
        <AnimatePresence>
          {confirmAction && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmAction(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 70, backdropFilter: "blur(6px)" }} />
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", damping: 22, stiffness: 350 }}
                style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 320, maxWidth: "calc(100vw - 32px)", background: "#0d0b19", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: "22px 20px 18px", zIndex: 71 }}>
                {(() => {
                  const isLock = confirmAction.type === "lock"
                  const u      = users.find(x => x.id === confirmAction.id)
                  return (
                    <>
                      <div style={{ fontSize: 38, textAlign: "center", marginBottom: 10 }}>{isLock ? "🔒" : "🔓"}</div>
                      <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>{isLock ? "Khóa tài khoản?" : "Mở khóa tài khoản?"}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", background: isLock ? "rgba(255,64,64,0.1)" : "rgba(62,207,110,0.1)", border: `1px solid ${isLock ? "rgba(255,64,64,0.25)" : "rgba(62,207,110,0.25)"}`, borderRadius: 7, padding: "5px 10px", marginBottom: 14, color: isLock ? "#ff4040" : "#3ecf6e" }}>{u?.fullName}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setConfirmAction(null)} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.6)", fontSize: 11, fontWeight: 600 }}>Hủy</button>
                        <button onClick={execConfirm} disabled={saving} style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend", background: isLock ? "rgba(255,64,64,0.12)" : "rgba(62,207,110,0.12)", border: `1px solid ${isLock ? "rgba(255,64,64,0.3)" : "rgba(62,207,110,0.3)"}`, color: isLock ? "#ff4040" : "#3ecf6e", fontSize: 11, fontWeight: 800 }}>{isLock ? "🔒 Khóa" : "🔓 Mở khóa"}</button>
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
