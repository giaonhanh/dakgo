"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Filter = "all" | "active" | "delivered" | "cancelled"

interface Order {
  id: string
  status: string
  ship_fee: number
  total_amount: number
  created_at: string
  commission_rate: number
  shop_name: string
  delivery_address: string
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "Chờ xác nhận", color: "#b464ff", bg: "rgba(180,100,255,0.12)" },
  accepted:   { label: "Quán đã nhận", color: "#4a8ff5", bg: "rgba(74,143,245,0.12)" },
  preparing:  { label: "Đang làm món", color: "#4a8ff5", bg: "rgba(74,143,245,0.12)" },
  ready:      { label: "Chờ lấy hàng",color: "#FFB347", bg: "rgba(255,179,71,0.12)" },
  delivering: { label: "Đang giao",    color: "#FF8C00", bg: "rgba(255,140,0,0.12)" },
  delivered:  { label: "Hoàn thành",   color: "#3ecf6e", bg: "rgba(62,207,110,0.12)" },
  cancelled:  { label: "Đã huỷ",       color: "#6a5a40", bg: "rgba(106,90,64,0.1)" },
}

const DRIVER_CANCEL_REASONS = ["Xe hư / sự cố", "Bận việc đột xuất", "Địa chỉ quá xa", "Khác"]
const DRIVER_CANCELLABLE = ["pending","accepted","preparing"]

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60)    return "Vừa xong"
  if (diff < 3600)  return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  if (diff < 172800) return "Hôm qua"
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
}

export default function DriverOrdersPage() {
  const router  = useRouter()
  const supabase = createClient()

  const [orders,       setOrders]       = useState<Order[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<Filter>("all")
  const [driverId,     setDriverId]     = useState("")
  const [cancelLocked, setCancelLocked] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelling,   setCancelling]   = useState(false)
  const [toast,        setToast]        = useState("")

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2800) }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setDriverId(user.id)

    const { data: prof } = await supabase.from("profiles").select("cancel_locked").eq("id", user.id).single()
    if (prof?.cancel_locked) setCancelLocked(true)

    const { data } = await supabase
      .from("orders")
      .select(`
        id, status, ship_fee, total_amount, created_at, delivery_address,
        shops ( name, commission_rate )
      `)
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)

    const mapped = (data ?? []).map((o: Record<string, unknown>) => {
      const shop = Array.isArray(o.shops)
        ? (o.shops[0] as { name: string; commission_rate: number })
        : (o.shops as { name: string; commission_rate: number } | null)
      return {
        id:               o.id as string,
        status:           o.status as string,
        ship_fee:         (o.ship_fee as number) ?? 0,
        total_amount:     (o.total_amount as number) ?? 0,
        created_at:       o.created_at as string,
        delivery_address: (o.delivery_address as string) ?? "",
        shop_name:        shop?.name ?? "Cửa hàng",
        commission_rate:  shop?.commission_rate ?? 15,
      }
    })

    setOrders(mapped)
    setLoading(false)
  }

  const handleDriverCancel = async () => {
    if (!showCancelModal || !cancelReason || !driverId) return
    if (cancelLocked) { fireToast("Tài khoản bị khóa hủy đơn · Liên hệ admin!"); setShowCancelModal(null); return }
    setCancelling(true)

    const { error } = await supabase.from("orders").update({
      status: "pending",
      driver_id: null,
      cancel_reason: `Tài xế hủy: ${cancelReason}`,
      cancelled_at: new Date().toISOString(),
    }).eq("id", showCancelModal)

    if (error) { fireToast("Không thể hủy đơn, thử lại!"); setCancelling(false); return }

    await supabase.from("cancel_logs").insert({ order_id: showCancelModal, user_id: driverId, role: "driver", reason: cancelReason, cancelled_at: new Date().toISOString() })

    // Đếm hủy trong ngày hôm nay
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0)
    const { count } = await supabase.from("cancel_logs").select("*", { count: "exact", head: true })
      .eq("user_id", driverId).eq("role", "driver").gte("cancelled_at", startOfDay.toISOString())
    const total = count ?? 0

    if (total >= 4) {
      await supabase.from("profiles").update({ cancel_locked: true, cancel_locked_at: new Date().toISOString(), cancel_locked_reason: "Hủy đơn quá nhiều lần trong ngày" }).eq("id", driverId)
      setCancelLocked(true)
      fireToast("⚠️ Tài khoản bị khóa · Liên hệ admin để mở khóa")
    } else if (total === 3) {
      fireToast("⚠️ Lần hủy thứ 3 hôm nay · Hủy thêm 1 lần nữa sẽ bị khóa tài khoản!")
    } else {
      fireToast("Đã hủy nhận đơn · Đơn quay về hàng chờ tìm tài xế khác")
    }

    setOrders(p => p.filter(o => o.id !== showCancelModal))
    setShowCancelModal(null)
    setCancelReason("")
    setCancelling(false)
  }

  const filtered = orders.filter(o => {
    if (filter === "all")       return true
    if (filter === "active")    return DRIVER_CANCELLABLE.includes(o.status) || ["ready","delivering"].includes(o.status)
    if (filter === "delivered") return o.status === "delivered"
    if (filter === "cancelled") return o.status === "cancelled"
    return true
  })

  const todayEarned = orders
    .filter(o => o.status === "delivered" && new Date(o.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, o) => sum + Math.round(o.ship_fee * (1 - o.commission_rate / 100)), 0)

  const tabs: { key: Filter; label: string }[] = [
    { key: "all",       label: "Tất cả" },
    { key: "active",    label: "Đang chạy" },
    { key: "delivered", label: "Hoàn thành" },
    { key: "cancelled", label: "Đã huỷ" },
  ]

  return (
    <div style={{ minHeight: "100dvh", background: "#080806", fontFamily: "'Lexend',sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px} @keyframes pulse{0%,100%{opacity:.6}50%{opacity:.3}} @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 999, whiteSpace: "nowrap",
          background: "rgba(14,12,9,0.95)", border: "1px solid rgba(255,107,0,0.3)", borderRadius: 12,
          padding: "8px 18px", color: "#FF8C00", fontSize: 11, fontWeight: 600, backdropFilter: "blur(10px)" }}>
          {toast}
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <>
          <div onClick={() => { setShowCancelModal(null); setCancelReason("") }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 190, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 191,
            background: "#0e0c09", border: "1px solid rgba(255,64,64,0.2)", borderRadius: "20px 20px 0 0",
            padding: "20px 18px 40px", animation: "slideUp .3s ease" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 18px" }} />
            {cancelLocked ? (
              <>
                <div style={{ color: "#ff4040", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🔒 Tài khoản bị khóa hủy đơn</div>
                <div style={{ background: "rgba(255,64,64,0.07)", border: "1px solid rgba(255,64,64,0.2)", borderRadius: 11, padding: "12px 13px", marginBottom: 16, color: "#ff6060", fontSize: 10, lineHeight: 1.6 }}>
                  Bạn đã hủy quá nhiều đơn hôm nay. Liên hệ quản trị viên để mở khóa tài khoản.
                </div>
                <button onClick={() => setShowCancelModal(null)}
                  style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#6a5a40", fontSize: 11, fontFamily: "Lexend", cursor: "pointer" }}>Đóng</button>
              </>
            ) : (
              <>
                <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>✕ Hủy nhận đơn #{showCancelModal.slice(-6).toUpperCase()}</div>
                <div style={{ background: "rgba(255,179,71,0.07)", border: "1px solid rgba(255,179,71,0.2)", borderRadius: 10, padding: "9px 12px", marginBottom: 14, color: "#FFB347", fontSize: 9.5, lineHeight: 1.6 }}>
                  ⚠️ Đơn sẽ quay về hàng chờ để tìm tài xế khác. Hủy nhiều lần có thể bị khóa tài khoản.
                </div>
                <div style={{ color: "#b0956a", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 9 }}>Lý do hủy</div>
                {DRIVER_CANCEL_REASONS.map(r => (
                  <div key={r} onClick={() => setCancelReason(r)}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
                      background: cancelReason === r ? "rgba(255,64,64,0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${cancelReason === r ? "rgba(255,64,64,0.35)" : "rgba(255,255,255,0.06)"}` }}>
                    <div style={{ width: 15, height: 15, borderRadius: "50%", flexShrink: 0,
                      border: `1.5px solid ${cancelReason === r ? "#ff4040" : "rgba(255,255,255,0.15)"}`,
                      background: cancelReason === r ? "#ff4040" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {cancelReason === r && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                    <span style={{ color: cancelReason === r ? "#ff6060" : "#b0956a", fontSize: 11 }}>{r}</span>
                  </div>
                ))}
                <button onClick={handleDriverCancel} disabled={!cancelReason || cancelling}
                  style={{ width: "100%", height: 46, borderRadius: 12, border: "none", marginTop: 10,
                    background: cancelReason ? "linear-gradient(90deg,#ff4040,#ff6060)" : "rgba(255,255,255,0.06)",
                    color: cancelReason ? "#fff" : "#6a5a40", fontSize: 12, fontWeight: 700, fontFamily: "Lexend",
                    cursor: cancelReason ? "pointer" : "default", opacity: cancelReason ? 1 : 0.55 }}>
                  {cancelling ? "Đang xử lý..." : cancelReason ? "✕ Xác nhận hủy nhận đơn" : "Chọn lý do để tiếp tục"}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Header */}
      <div style={{ background: "rgba(8,8,6,0.96)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,107,0,0.08)", paddingTop: "env(safe-area-inset-top)", flexShrink: 0 }}>
        <div style={{ height: 56, padding: "0 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", color: "#f8f0e0", flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>Đơn hàng</div>
          </div>
          {todayEarned > 0 && (
            <div style={{ background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.25)", borderRadius: 8, padding: "4px 10px" }}>
              <div style={{ color: "#6a5a40", fontSize: 8 }}>Hôm nay</div>
              <div style={{ color: "#3ecf6e", fontSize: 11, fontWeight: 800 }}>{fmt(todayEarned)}</div>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, padding: "0 16px 12px", overflowX: "auto" } as React.CSSProperties}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 20, fontSize: 10, fontWeight: filter === t.key ? 700 : 400, cursor: "pointer", border: "none",
                background: filter === t.key ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)",
                color: filter === t.key ? "#FF8C00" : "#6a5a40" }}>
              {t.label}
              {t.key === "active" && orders.filter(o => [...DRIVER_CANCELLABLE,"ready","delivering"].includes(o.status)).length > 0 && (
                <span style={{ marginLeft: 4, background: "#FF6B00", color: "#fff", borderRadius: 99, fontSize: 8, padding: "1px 5px" }}>
                  {orders.filter(o => [...DRIVER_CANCELLABLE,"ready","delivering"].includes(o.status)).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", paddingBottom: "calc(100px + env(safe-area-inset-bottom))" }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 80, borderRadius: 14, background: "rgba(255,255,255,0.04)", marginBottom: 8, animation: "pulse 1.5s infinite" }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ color: "#6a5a40", fontSize: 13 }}>Chưa có đơn nào</div>
          </div>
        ) : filtered.map(o => {
          const cfg = STATUS_CFG[o.status] ?? STATUS_CFG.cancelled
          const earning = o.status === "delivered"
            ? Math.round(o.ship_fee * (1 - o.commission_rate / 100))
            : o.ship_fee
          const isActive = [...DRIVER_CANCELLABLE, "ready","delivering"].includes(o.status)
          const canCancel = DRIVER_CANCELLABLE.includes(o.status)
          return (
            <div key={o.id}
              style={{ marginBottom: 8, borderRadius: 14, padding: "12px 14px", cursor: "default",
                background: isActive ? "rgba(62,207,110,0.05)" : "rgba(255,255,255,0.03)",
                border: isActive ? "1px solid rgba(62,207,110,0.2)" : "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700 }}>#{o.id.slice(-6).toUpperCase()}</div>
                  <div style={{ color: "#b0956a", fontSize: 10, marginTop: 2 }}>🏪 {o.shop_name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ background: cfg.bg, color: cfg.color, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 99 }}>
                    {cfg.label}
                  </div>
                  <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 4 }}>{fmtTime(o.created_at)}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "#6a5a40", fontSize: 9, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  📍 {o.delivery_address}
                </div>
                <div style={{ color: o.status === "delivered" ? "#3ecf6e" : "#b0956a", fontSize: 12, fontWeight: 800 }}>
                  {fmt(earning)}
                </div>
              </div>
              {isActive && (
                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                  <div onClick={() => router.push(`/driver/navigate/${o.id}`)}
                    style={{ flex: 1, padding: "6px 10px", background: "rgba(62,207,110,0.08)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <span style={{ color: "#3ecf6e", fontSize: 9, fontWeight: 700 }}>Nhấn để xem lộ trình</span>
                    <span style={{ color: "#3ecf6e", fontSize: 12 }}>›</span>
                  </div>
                  {canCancel && (
                    <button onClick={e => { e.stopPropagation(); setCancelReason(""); setShowCancelModal(o.id) }}
                      style={{ flexShrink: 0, padding: "6px 10px", background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", borderRadius: 8, color: "#ff6060", fontSize: 9, fontWeight: 700, fontFamily: "Lexend", cursor: "pointer" }}>
                      ✕ Hủy
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: "calc(12px + env(safe-area-inset-bottom))", left: 14, right: 14, height: 56, borderRadius: 9999, zIndex: 50, background: "rgba(8,8,6,0.92)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,107,0,0.2)", boxShadow: "0 0 20px rgba(255,107,0,0.1)", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px" }}>
        {[
          { href: "/driver",          icon: "🏠", label: "Trang chủ", active: false },
          { href: "/driver/orders",   icon: "📋", label: "Đơn hàng",  active: true  },
          { href: "/driver/earnings", icon: "📊", label: "Thu nhập",  active: false },
          { href: "/driver/profile",  icon: "👤", label: "Hồ sơ",     active: false },
        ].map(tab => (
          <a key={tab.href} href={tab.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textDecoration: "none", padding: "6px 12px", borderRadius: 20, background: tab.active ? "rgba(255,107,0,0.1)" : "transparent", position: "relative" }}>
            <span style={{ fontSize: 17 }}>{tab.icon}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: tab.active ? "#FF8C00" : "#6a5a40" }}>{tab.label}</span>
            {tab.active && <div style={{ position: "absolute", bottom: -1, width: 28, height: 3, background: "radial-gradient(ellipse,rgba(255,107,0,0.9) 0%,transparent 70%)", filter: "blur(1px)" }} />}
          </a>
        ))}
      </nav>
    </div>
  )
}
