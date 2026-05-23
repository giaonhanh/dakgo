"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { formatPrice } from "@/lib/utils"
import { useCartStore } from "@/store/cartStore"
import { createClient } from "@/lib/supabase/client"

// ─── Types ───────────────────────────────────────────────
type Status = "delivering" | "preparing" | "pending" | "accepted" | "ready" | "completed" | "cancelled"

interface Topping { name: string; price: number }
interface Item {
  emoji: string; name: string; qty: number; price: number
  productId?: string
  size?: string; sugar?: string; ice?: string; toppings?: Topping[]
}
interface Order {
  id: string; shopId: string; shopName: string; shopEmoji: string; shopColor: string
  driverId: string | null
  status: Status; items: Item[]
  subtotal: number; deliveryFee: number; discount: number
  nightFee?: number; weatherFee?: string
  createdAt: string; address: string; note?: string
  driver?: { name: string; plate: string; phone: string; rating: number; eta: number }
  payMethod: string; rating?: number; cancelReason?: string
}

// ─── UI Config (không phải data) ────────────────────────
const TABS = [
  { key: "all",       label: "Hôm nay"     },
  { key: "active",    label: "Đang xử lý"  },
  { key: "completed", label: "Hoàn thành"  },
  { key: "cancelled", label: "Đã hủy"      },
  { key: "history",   label: "🕐 Lịch sử"  },
]

const CANCEL_REASONS = [
  "Đặt nhầm món", "Thay đổi ý định",
  "Tài xế đến lâu quá", "Cửa hàng không phản hồi", "Khác...",
]

const STATUS_CFG: Record<Status, { label: string; c: string; bg: string; bd: string; dot: boolean }> = {
  delivering: { label: "Đang giao",     c: "#FF8C00", bg: "rgba(255,140,0,0.12)",   bd: "rgba(255,107,0,0.3)",   dot: true  },
  preparing:  { label: "Đang chuẩn bị", c: "#4a8ff5", bg: "rgba(74,143,245,0.12)",  bd: "rgba(74,143,245,0.3)",  dot: true  },
  accepted:   { label: "Đã xác nhận",   c: "#3ecf6e", bg: "rgba(62,207,110,0.10)",  bd: "rgba(62,207,110,0.28)", dot: true  },
  pending:    { label: "Chờ xác nhận",  c: "#b464ff", bg: "rgba(180,100,255,0.12)", bd: "rgba(180,100,255,0.3)", dot: false },
  ready:      { label: "Sẵn sàng giao", c: "#FFB347", bg: "rgba(255,179,71,0.12)",  bd: "rgba(255,179,71,0.3)",  dot: true  },
  completed:  { label: "Hoàn thành",    c: "#3ecf6e", bg: "rgba(62,207,110,0.08)",  bd: "rgba(62,207,110,0.25)", dot: false },
  cancelled:  { label: "Đã hủy",        c: "#ff4040", bg: "rgba(255,64,64,0.08)",   bd: "rgba(255,64,64,0.22)",  dot: false },
}

// ─── Helpers ─────────────────────────────────────────────
const calcTotal = (o: Order) =>
  o.subtotal + o.deliveryFee - o.discount + (o.nightFee ?? 0) + (o.weatherFee ? 8000 : 0)

const SHOP_COLORS = ["#FF8C00","#4a8ff5","#3ecf6e","#FFB347","#b464ff","#ff6060"]
function shopColor(idx: number) { return SHOP_COLORS[idx % SHOP_COLORS.length] }

function categoryToEmoji(cat: string | null): string {
  if (!cat) return "🍽️"
  const c = cat.toLowerCase()
  if (c.includes("bun") || c.includes("phở") || c.includes("mì")) return "🍜"
  if (c.includes("trà") || c.includes("tra") || c.includes("drink")) return "🧋"
  if (c.includes("gà") || c.includes("ga")) return "🍗"
  if (c.includes("cơm") || c.includes("com")) return "🍱"
  if (c.includes("burger") || c.includes("fast")) return "🍔"
  if (c.includes("cafe") || c.includes("cà phê")) return "☕"
  if (c.includes("bánh") || c.includes("cake")) return "🍰"
  if (c.includes("pizza")) return "🍕"
  return "🍽️"
}

function fmtPayMethod(pm: string): string {
  const map: Record<string, string> = {
    cash: "Tiền mặt", vietqr: "VietQR",
    momo: "MoMo", zalopay: "ZaloPay", wallet: "Ví GiaoNhanh",
  }
  return map[pm] ?? pm
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

function fmtDateKey(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`
}

function mapStatus(s: string): Status {
  if (s === "delivered") return "completed"
  return s as Status
}

// ─── Sub-components ──────────────────────────────────────
function StatusBadge({ status }: { status: Status }) {
  const c = STATUS_CFG[status]
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
      background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 7, padding: "3px 9px" }}>
      {c.dot && (
        <div style={{ width: 6, height: 6, borderRadius: "50%",
          background: c.c, animation: "oPulse 1.5s infinite" }} />
      )}
      <span style={{ color: c.c, fontSize: 9.5, fontWeight: 600 }}>{c.label}</span>
    </div>
  )
}

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "#6a5a40", fontSize: 8.5, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
      {children}
    </div>
  )
}

function InfoBox({ rows }: { rows: { icon: string; key: string; val: string }[] }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "8px 10px" }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 7, padding: "4px 0",
          borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
          <span style={{ fontSize: 12, flexShrink: 0 }}>{r.icon}</span>
          <div>
            <div style={{ color: "#6a5a40", fontSize: 8 }}>{r.key}</div>
            <div style={{ color: "#b0956a", fontSize: 9.5, marginTop: 1 }}>{r.val}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const ADMIN_PHONE = "0901999888"

// ─── Main ─────────────────────────────────────────────────
export default function OrdersPage() {
  const supabase = createClient()
  const router = useRouter()
  const { addItem, clearCart } = useCartStore()
  const [orders,       setOrders]       = useState<Order[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState("all")
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [showCancel,   setShowCancel]   = useState<string | null>(null)
  const [showReview,   setShowReview]   = useState<string | null>(null)
  const [cancelRsn,    setCancelRsn]    = useState("")
  const [foodStar,     setFoodStar]     = useState(5)
  const [driverStar,   setDriverStar]   = useState(5)
  const [reviewTxt,    setReviewTxt]    = useState("")
  const [toast,        setToast]        = useState("")
  const [userId,       setUserId]       = useState<string | null>(null)

  const fireToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400) }

  // ── Fetch orders from Supabase ──────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data: rows } = await supabase
        .from("orders")
        .select(`
          id, status, delivery_address, note, subtotal, delivery_fee, discount_amount,
          payment_method, cancel_reason, created_at, driver_id, shop_id,
          shops(id, name, category),
          order_items(id, product_id, name, price, quantity, note),
          drivers(id, license_plate, rating_avg)
        `)
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (!rows) { setLoading(false); return }

      // Fetch driver profiles for orders that have a driver
      const driverIds = rows
        .filter(o => o.driver_id)
        .map(o => o.driver_id as string)
      let driverProfiles: { id: string; full_name: string | null; phone: string }[] = []
      if (driverIds.length > 0) {
        const { data: dp } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", driverIds)
        driverProfiles = (dp ?? []) as typeof driverProfiles
      }

      // Fetch reviews for completed orders
      const completedIds = rows
        .filter(o => o.status === "delivered" || o.status === "completed")
        .map(o => o.id)
      let reviewMap: Record<string, number> = {}
      if (completedIds.length > 0) {
        const { data: rv } = await supabase
          .from("reviews")
          .select("order_id, food_rating")
          .in("order_id", completedIds)
        ;(rv ?? []).forEach((r: { order_id: string; food_rating: number | null }) => {
          if (r.food_rating) reviewMap[r.order_id] = r.food_rating
        })
      }

      const mapped: Order[] = rows.map((o, idx) => {
        const shop = Array.isArray(o.shops) ? o.shops[0] : o.shops
        const driverRow = Array.isArray(o.drivers) ? o.drivers[0] : o.drivers
        const driverProfile = driverProfiles.find(p => p.id === o.driver_id)
        const items = (o.order_items ?? []) as { id: string; product_id: string | null; name: string; price: number; quantity: number; note: string | null }[]

        return {
          id: o.id,
          shopId: o.shop_id ?? "",
          driverId: o.driver_id ?? null,
          shopName: shop?.name ?? "Cửa hàng",
          shopEmoji: categoryToEmoji(shop?.category ?? null),
          shopColor: shopColor(idx),
          status: mapStatus(o.status),
          items: items.map(i => ({
            emoji: "🍽️",
            name: i.name,
            qty: i.quantity,
            price: i.price,
            productId: i.product_id ?? i.id,
          })),
          subtotal: o.subtotal,
          deliveryFee: o.delivery_fee,
          discount: o.discount_amount ?? 0,
          createdAt: fmtDate(o.created_at),
          address: o.delivery_address,
          note: o.note ?? undefined,
          driver: driverRow ? {
            name: driverProfile?.full_name ?? "Tài xế",
            plate: driverRow.license_plate ?? "",
            phone: driverProfile?.phone ?? "",
            rating: Number(driverRow.rating_avg ?? 5),
            eta: 0,
          } : undefined,
          payMethod: fmtPayMethod(o.payment_method),
          rating: reviewMap[o.id] ?? undefined,
          cancelReason: o.cancel_reason ?? undefined,
        }
      })

      setOrders(mapped)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Today filter ────────────────────────────────────────
  const TODAY_STR = (() => {
    const d = new Date()
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`
  })()
  const ACTIVE_ST: Status[] = ["delivering","preparing","pending","accepted","ready"]
  const todayOrders   = orders.filter(o => ACTIVE_ST.includes(o.status) || o.createdAt.startsWith(TODAY_STR))
  const historyOrders = orders.filter(o => !ACTIVE_ST.includes(o.status) && !o.createdAt.startsWith(TODAY_STR))

  // ── Swipe navigation ────────────────────────────────────
  const rootRef = useRef<HTMLDivElement>(null)
  const swipeX  = useRef(0)
  const swipeY  = useRef(0)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onStart = (e: TouchEvent) => {
      swipeX.current = e.touches[0].clientX
      swipeY.current = e.touches[0].clientY
    }
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - swipeX.current
      const dy = e.changedTouches[0].clientY - swipeY.current
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) router.push("/")
        else router.push("/cart")
      }
    }
    el.addEventListener("touchstart", onStart, { passive: true })
    el.addEventListener("touchend",   onEnd,   { passive: true })
    return () => {
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchend",   onEnd)
    }
  }, [router])

  const cancelOrder    = orders.find(o => o.id === showCancel)
  const canSelfCancel  = cancelOrder?.status === "pending"
  const willRefundWallet = cancelOrder?.payMethod === "Ví GiaoNhanh"
  const reviewOrder    = orders.find(o => o.id === showReview)

  const handleConfirmCancel = async () => {
    if (!cancelRsn || !showCancel || !userId) return
    await supabase.from("orders").update({
      status: "cancelled",
      cancel_reason: cancelRsn,
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
    }).eq("id", showCancel)
    setOrders(prev => prev.map(o => o.id === showCancel ? { ...o, status: "cancelled" as Status, cancelReason: cancelRsn } : o))
    const msg = willRefundWallet ? "Đã hủy đơn · Hoàn tiền về ví GiaoNhanh!" : "Đã hủy đơn hàng!"
    fireToast(msg)
    setShowCancel(null)
    setCancelRsn("")
  }

  const handleReorder = (order: Order) => {
    clearCart()
    order.items.forEach(item => {
      addItem({
        id:      item.productId ?? `${order.shopId}-${item.name}`,
        name:    item.name,
        price:   item.price,
        shop:    order.shopName,
        shopId:  order.shopId,
      })
    })
    fireToast("Đã thêm vào giỏ hàng!")
    setTimeout(() => router.push("/cart"), 1200)
  }

  const filtered = orders.filter(o => {
    if (activeTab === "history")
      return !ACTIVE_ST.includes(o.status) && !o.createdAt.startsWith(TODAY_STR)
    if (activeTab === "cancelled") return o.status === "cancelled"
    const visibleToday = ACTIVE_ST.includes(o.status) || o.createdAt.startsWith(TODAY_STR)
    if (!visibleToday) return false
    if (activeTab === "all")       return true
    if (activeTab === "active")    return ACTIVE_ST.includes(o.status)
    if (activeTab === "completed") return o.status === "completed"
    return true
  })

  const tabCount = (k: string) => {
    if (k === "history")   return historyOrders.length
    if (k === "all")       return todayOrders.length
    if (k === "active")    return todayOrders.filter(o => ACTIVE_ST.includes(o.status)).length
    if (k === "completed") return todayOrders.filter(o => o.status === "completed").length
    if (k === "cancelled") return orders.filter(o => o.status === "cancelled").length
    return 0
  }

  const NAV_TABS = [
    { icon: "🏠", label: "Trang chủ", href: "/",         active: false },
    { icon: "📋", label: "Đơn hàng",  href: "/orders",   active: true  },
    { icon: "🛒", label: "Giỏ hàng",  href: "/cart",     active: false },
    { icon: "⚙️", label: "Cài đặt",  href: "/settings", active: false },
  ]

  return (
    <>
      <style>{`
        @keyframes oPulse   { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes oShimmer { 0%{left:-60%} 100%{left:120%} }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            style={{ position: "fixed", top: 52, left: "50%", transform: "translateX(-50%)",
              zIndex: 999, whiteSpace: "nowrap", background: "rgba(62,207,110,0.15)",
              border: "1px solid rgba(62,207,110,0.35)", borderRadius: 12,
              padding: "7px 18px", color: "#3ecf6e", fontSize: 11, fontWeight: 600,
              backdropFilter: "blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cancel Sheet ── */}
      <AnimatePresence>
        {showCancel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowCancel(null); setCancelRsn("") }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 190, backdropFilter: "blur(4px)" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 191,
                background: "#0e0c09", border: "1px solid rgba(255,107,0,0.15)",
                borderRadius: "20px 20px 0 0", padding: "20px 18px 36px" }}>
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 18px" }} />

              {canSelfCancel ? (
                <>
                  <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    Hủy đơn #{showCancel?.slice(0,8).toUpperCase()}
                  </div>
                  <div style={{ background: willRefundWallet ? "rgba(62,207,110,0.07)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${willRefundWallet ? "rgba(62,207,110,0.2)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 10, padding: "9px 12px", marginBottom: 14,
                    display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{willRefundWallet ? "💚" : "ℹ️"}</span>
                    <div>
                      <div style={{ color: willRefundWallet ? "#3ecf6e" : "#b0956a", fontSize: 10, fontWeight: 600 }}>
                        {willRefundWallet ? "Sẽ hoàn tiền về ví GiaoNhanh" : "Thanh toán tiền mặt — không hoàn tiền"}
                      </div>
                      <div style={{ color: "#6a5a40", fontSize: 8.5, marginTop: 2 }}>
                        {willRefundWallet
                          ? "Đơn huỷ trước khi quán xác nhận · Hoàn 100% về ví"
                          : "Đơn tiền mặt huỷ trước khi quán xác nhận không được hoàn"}
                      </div>
                    </div>
                  </div>
                  <div style={{ color: "#b0956a", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 9 }}>Lý do hủy</div>
                  {CANCEL_REASONS.map(r => (
                    <div key={r} onClick={() => setCancelRsn(r)}
                      style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
                        background: cancelRsn === r ? "rgba(255,107,0,0.08)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${cancelRsn === r ? "rgba(255,107,0,0.35)" : "rgba(255,255,255,0.06)"}`,
                        transition: "all .15s" }}>
                      <div style={{ width: 15, height: 15, borderRadius: "50%", flexShrink: 0,
                        border: `1.5px solid ${cancelRsn === r ? "#FF6B00" : "rgba(255,255,255,0.15)"}`,
                        background: cancelRsn === r ? "#FF6B00" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {cancelRsn === r && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                      <span style={{ color: cancelRsn === r ? "#FF8C00" : "#b0956a", fontSize: 11 }}>{r}</span>
                    </div>
                  ))}
                  <button onClick={handleConfirmCancel}
                    style={{ width: "100%", height: 46, borderRadius: 12, border: "none", marginTop: 10,
                      background: cancelRsn ? "linear-gradient(90deg,#ff4040,#ff6060)" : "rgba(255,255,255,0.06)",
                      color: cancelRsn ? "#fff" : "#6a5a40", fontSize: 12, fontWeight: 700, fontFamily: "Lexend",
                      cursor: cancelRsn ? "pointer" : "default", opacity: cancelRsn ? 1 : 0.55 }}>
                    {cancelRsn ? "✕ Xác nhận hủy đơn" : "Chọn lý do để tiếp tục"}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Không thể tự hủy đơn</div>
                  <div style={{ background: "rgba(255,64,64,0.07)", border: "1px solid rgba(255,64,64,0.2)",
                    borderRadius: 11, padding: "12px 13px", marginBottom: 16 }}>
                    <div style={{ color: "#ff6060", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                      ⚠️ Quán đã xác nhận đơn #{showCancel?.slice(0,8).toUpperCase()}
                    </div>
                    <div style={{ color: "#6a5a40", fontSize: 9.5, lineHeight: 1.6 }}>
                      Sau khi quán xác nhận, chỉ quản trị viên mới có quyền hủy đơn.
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10, padding: "9px 12px", marginBottom: 16,
                    display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>ℹ️</span>
                    <div style={{ color: "#6a5a40", fontSize: 9, lineHeight: 1.6 }}>
                      {willRefundWallet
                        ? "Nếu admin chấp thuận huỷ, tiền sẽ được hoàn về ví GiaoNhanh."
                        : "Đơn tiền mặt: nếu admin chấp thuận huỷ, chưa có giao dịch phát sinh."}
                    </div>
                  </div>
                  <a href={`tel:${ADMIN_PHONE}`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", height: 50, borderRadius: 12, textDecoration: "none",
                      background: "linear-gradient(90deg,#4a8ff5,#6aafff)",
                      color: "#fff", fontSize: 13, fontWeight: 700,
                      boxShadow: "0 4px 16px rgba(74,143,245,0.35)" }}>
                    📞 Gọi quản trị viên hỗ trợ
                  </a>
                  <div style={{ textAlign: "center", color: "#6a5a40", fontSize: 8.5, marginTop: 8 }}>
                    Hotline: {ADMIN_PHONE} · Hỗ trợ 7:00 – 22:00
                  </div>
                  <button onClick={() => { setShowCancel(null); setCancelRsn("") }}
                    style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
                      background: "transparent", color: "#6a5a40", fontSize: 11, fontFamily: "Lexend",
                      cursor: "pointer", marginTop: 8 }}>
                    Đóng
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Review Sheet ── */}
      <AnimatePresence>
        {showReview && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowReview(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 190, backdropFilter: "blur(4px)" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 191,
                background: "#0e0c09", border: "1px solid rgba(255,107,0,0.15)",
                borderRadius: "20px 20px 0 0", padding: "20px 18px 36px" }}>
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 18px" }} />
              <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
                Đánh giá đơn #{showReview?.slice(0,8).toUpperCase()}
              </div>
              {([
                { label: "🍽️ Chất lượng món",  star: foodStar,   set: setFoodStar   },
                { label: "🚵 Tài xế giao hàng", star: driverStar, set: setDriverStar },
              ] as const).map(s => (
                <div key={s.label} style={{ marginBottom: 14 }}>
                  <div style={{ color: "#b0956a", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{s.label}</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    {[1,2,3,4,5].map(n => (
                      <span key={n} onClick={() => s.set(n)}
                        style={{ fontSize: 28, cursor: "pointer", transition: "transform .15s",
                          opacity: n <= s.star ? 1 : 0.2,
                          filter: n <= s.star ? "drop-shadow(0 0 4px rgba(255,179,71,0.6))" : "none" }}>⭐</span>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#b0956a", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Nhận xét</div>
                <textarea value={reviewTxt} onChange={e => setReviewTxt(e.target.value)}
                  placeholder="Món ngon, giao đúng giờ..." rows={2}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10, padding: "9px 11px", color: "#f8f0e0", fontSize: 11, fontFamily: "Lexend", outline: "none", resize: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
                {["Món ngon", "Giao nhanh", "Đóng gói cẩn thận", "Tài xế thân thiện"].map(t => (
                  <div key={t} onClick={() => setReviewTxt(p => p ? p + ", " + t : t)}
                    style={{ padding: "4px 10px", borderRadius: 8, cursor: "pointer",
                      background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.2)", color: "#FF8C00", fontSize: 9 }}>{t}</div>
                ))}
              </div>
              <button
                onClick={async () => {
                  if (!showReview || !userId || !reviewOrder) return
                  await supabase.from("reviews").insert({
                    order_id: showReview,
                    reviewer_id: userId,
                    shop_id: reviewOrder.shopId,
                    driver_id: reviewOrder.driverId,
                    food_rating: foodStar,
                    driver_rating: driverStar,
                    comment: reviewTxt || null,
                  })
                  fireToast("Đã gửi đánh giá, cảm ơn bạn!")
                  setShowReview(null); setReviewTxt(""); setFoodStar(5); setDriverStar(5)
                }}
                style={{ width: "100%", height: 46, borderRadius: 12, border: "none", position: "relative", overflow: "hidden",
                  background: "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
                  color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "Lexend", cursor: "pointer",
                  boxShadow: "0 3px 14px rgba(255,107,0,0.35)" }}>
                <div style={{ position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                  background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)", animation: "oShimmer 2.5s infinite" }} />
                <span style={{ position: "relative", zIndex: 1 }}>⭐ Gửi đánh giá</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div ref={rootRef}
        style={{ position: "fixed", inset: 0, background: "#080806", zIndex: 60,
          display: "flex", flexDirection: "column", fontFamily: "'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background: "rgba(8,8,6,0.96)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "calc(env(safe-area-inset-top,0px) + 12px) 16px 12px",
          flexShrink: 0, zIndex: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <button onClick={() => router.back()}
              style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, color: "#f8f0e0", cursor: "pointer" }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 700 }}>Đơn hàng của tôi</div>
              <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 1 }}>
                {loading ? "Đang tải..." : `${todayOrders.length} đơn hôm nay${historyOrders.length > 0 ? ` · ${historyOrders.length} trong lịch sử` : ""}`}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 5, overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties}>
            {TABS.map(t => {
              const cnt = tabCount(t.key)
              const on  = activeTab === t.key
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                    padding: "5px 12px", borderRadius: 20, border: "none", fontFamily: "Lexend", cursor: "pointer",
                    transition: "all .2s",
                    background: on ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                    outline: `${on ? 1.5 : 1}px solid ${on ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: on ? "#FF8C00" : "#6a5a40", fontSize: 10, fontWeight: on ? 600 : 400 }}>
                  {t.label}
                  {cnt > 0 && (
                    <span style={{ background: on ? "#FF6B00" : "rgba(255,255,255,0.1)",
                      color: on ? "#fff" : "#6a5a40",
                      borderRadius: 10, padding: "0 5px", fontSize: 8.5, fontWeight: 700 }}>{cnt}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 88px",
          WebkitOverflowScrolling: "touch" } as React.CSSProperties}>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <div style={{ color: "#6a5a40", fontSize: 12 }}>Đang tải đơn hàng...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 10 }}>
              <span style={{ fontSize: 40 }}>{activeTab === "history" ? "📋" : "😭"}</span>
              <div style={{ color: "#6a5a40", fontSize: 12 }}>
                {activeTab === "history" ? "Chưa có đơn hàng trong lịch sử" : "Không có đơn hàng nào"}
              </div>
              {activeTab === "history" && (
                <button onClick={() => setActiveTab("all")}
                  style={{ background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.25)",
                    borderRadius: 10, padding: "6px 14px", color: "#FF8C00", fontSize: 10,
                    fontFamily: "Lexend", cursor: "pointer" }}>
                  Xem đơn hôm nay
                </button>
              )}
            </div>
          ) : (
            filtered.map((order, idx) => {
              const cfg        = STATUS_CFG[order.status]
              const isOpen     = expanded === order.id
              const total      = calcTotal(order)
              const isActive   = ["delivering","preparing","pending","ready"].includes(order.status)
              const isCompleted  = order.status === "completed"
              const isCancelled  = order.status === "cancelled"
              const itemPreview  = order.items.map(i => `${i.emoji} ${i.name} ×${i.qty}`).join(" · ")

              return (
                <motion.div key={order.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.15) }}
                  style={{ marginBottom: 10, opacity: isCancelled ? 0.82 : 1 }}>
                  <div style={{ background: isActive ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
                    backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    border: `1px solid ${isActive ? cfg.bd : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 16, overflow: "hidden" }}>

                    {/* Card header */}
                    <div onClick={() => setExpanded(p => p === order.id ? null : order.id)}
                      style={{ padding: "12px 13px", cursor: "pointer" }}>

                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                          {order.shopEmoji}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "#f8f0e0", fontSize: 11.5, fontWeight: 600,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {order.shopName}
                          </div>
                          <div style={{ color: "#6a5a40", fontSize: 8.5, marginTop: 1 }}>
                            #{order.id.slice(0,8).toUpperCase()} · {order.createdAt}
                          </div>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>

                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                        borderRadius: 8, padding: "5px 9px", color: "#b0956a", fontSize: 9, marginBottom: 7,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {itemPreview}
                      </div>

                      {isCompleted && order.rating && (
                        <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 7,
                          padding: "5px 8px", background: "rgba(255,179,71,0.06)",
                          border: "1px solid rgba(255,179,71,0.15)", borderRadius: 7 }}>
                          {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 12, opacity: s <= order.rating! ? 1 : 0.2 }}>⭐</span>)}
                          <span style={{ color: "#b0956a", fontSize: 8.5, marginLeft: 4 }}>Bạn đã đánh giá đơn này</span>
                        </div>
                      )}

                      {isCancelled && order.cancelReason && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7,
                          padding: "5px 9px", background: "rgba(255,64,64,0.05)",
                          border: "1px solid rgba(255,64,64,0.15)", borderRadius: 7 }}>
                          <span style={{ fontSize: 11 }}>⚠️</span>
                          <span style={{ color: "#ff6060", fontSize: 8.5 }}>Lý do: {order.cancelReason}</span>
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <span style={{ color: "#6a5a40", fontSize: 9 }}>Tổng thanh toán: </span>
                          <span style={{ background: "linear-gradient(135deg,#FF6B00,#FFB347)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                            fontSize: isCancelled ? 12 : 13, fontWeight: 700,
                            textDecoration: isCancelled ? "line-through" : "none" }}>
                            {formatPrice(total)}
                          </span>
                        </div>
                        <span style={{ color: "#6a5a40", fontSize: 12,
                          transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s", display: "inline-block" }}>⌾</span>
                      </div>
                    </div>

                    {/* Expanded */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div key="detail" initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }} style={{ overflow: "hidden" }}>
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 13px" }}>

                            {order.status === "delivering" && order.driver && (
                              <button onClick={() => router.push(`/tracking/${order.id}`)}
                                style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: 10 }}>
                                <div style={{ background: "#0f1a08", border: "1px solid rgba(62,207,110,0.28)",
                                  borderRadius: 11, padding: "9px 12px", display: "flex", alignItems: "center", gap: 9,
                                  position: "relative", overflow: "hidden" }}>
                                  <div style={{ position: "absolute", right: -8, top: -8, width: 60, height: 60,
                                    background: "radial-gradient(circle,rgba(62,207,110,0.18) 0%,transparent 65%)" }} />
                                  <span style={{ fontSize: 20, position: "relative", zIndex: 1 }}>🗺️</span>
                                  <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3ecf6e", animation: "oPulse 1.5s infinite" }} />
                                      <span style={{ color: "#3ecf6e", fontSize: 9, fontWeight: 600 }}>Tài xế đang đến</span>
                                    </div>
                                    <div style={{ color: "#f8f0e0", fontSize: 10, fontWeight: 600, marginTop: 2 }}>
                                      {order.driver.name} · {order.driver.plate}
                                    </div>
                                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, marginTop: 1 }}>
                                      ⭐ {order.driver.rating} · Nhấn để mở bản đồ
                                    </div>
                                  </div>
                                  <span style={{ color: "#3ecf6e", fontSize: 16, position: "relative", zIndex: 1 }}>›</span>
                                </div>
                              </button>
                            )}

                            {order.status === "preparing" && (
                              <div style={{ background: "rgba(74,143,245,0.07)", border: "1px solid rgba(74,143,245,0.2)",
                                borderRadius: 11, padding: "9px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 18 }}>👨‍🍳</span>
                                <div>
                                  <div style={{ color: "#4a8ff5", fontSize: 10, fontWeight: 600 }}>Cửa hàng đang chuẩn bị</div>
                                  <div style={{ color: "rgba(74,143,245,0.55)", fontSize: 8.5, marginTop: 1 }}>Dự kiến xong sau 10–15 phút</div>
                                </div>
                              </div>
                            )}

                            <SLabel>Chi tiết đơn hàng</SLabel>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                              borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
                              {order.items.map((item, i) => (
                                <div key={i} style={{ padding: "8px 10px",
                                  borderBottom: i < order.items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <span style={{ fontSize: 13 }}>{item.emoji}</span>
                                      <div>
                                        <span style={{ color: "#b0956a", fontSize: 10 }}>{item.name}</span>
                                        <span style={{ color: "#6a5a40", fontSize: 9, marginLeft: 5 }}>×{item.qty}</span>
                                      </div>
                                    </div>
                                    <span style={{ color: "#f8f0e0", fontSize: 10, fontWeight: 600 }}>
                                      {formatPrice(item.price * item.qty)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <SLabel>Chi tiết thanh toán</SLabel>
                            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                              borderRadius: 10, padding: "8px 10px", marginBottom: 10 }}>
                              {[
                                { label: "Tiền món",       val: order.subtotal,     c: "#b0956a" },
                                order.deliveryFee > 0 ? { label: "Phí giao hàng", val: order.deliveryFee, c: "#b0956a" } : null,
                                order.discount > 0    ? { label: "Giảm giá",      val: -order.discount,   c: "#3ecf6e" } : null,
                              ].filter((r): r is { label: string; val: number; c: string } => r !== null)
                               .map((r, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                                  <span style={{ color: "#6a5a40", fontSize: 9 }}>{r.label}</span>
                                  <span style={{ color: r.c, fontSize: 9 }}>{r.val < 0 ? "-" : ""}{formatPrice(Math.abs(r.val))}</span>
                                </div>
                              ))}
                              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 600 }}>Tổng cộng</span>
                                <span style={{ background: "linear-gradient(135deg,#FF6B00,#FFB347)",
                                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                  backgroundClip: "text", fontSize: 14, fontWeight: 700 }}>{formatPrice(total)}</span>
                              </div>
                            </div>

                            <SLabel>Thông tin giao hàng</SLabel>
                            <InfoBox rows={[
                              { icon: "📍", key: "Địa chỉ",    val: order.address   },
                              ...(order.note   ? [{ icon: "📝", key: "Ghi chú",     val: order.note! }] : []),
                              { icon: "💳", key: "Thanh toán", val: order.payMethod },
                              ...(order.driver ? [{ icon: "🛵", key: "Tài xế",
                                val: `${order.driver.name} · ${order.driver.plate} ⭐${order.driver.rating}` }] : []),
                              ...(order.cancelReason ? [{ icon: "✕", key: "Lý do hủy", val: order.cancelReason }] : []),
                            ]} />

                            <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
                              {order.status === "delivering" && (
                                <button onClick={() => router.push(`/tracking/${order.id}`)}
                                  style={{ flex: 1, height: 36, borderRadius: 9, border: "none",
                                    background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
                                    color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: "Lexend",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                                    boxShadow: "0 3px 10px rgba(255,107,0,0.3)", cursor: "pointer" }}>
                                  🗺️ Theo dõi đơn
                                </button>
                              )}
                              {(order.status === "delivering" || order.status === "preparing") && order.driver?.phone && (
                                <a href={`tel:${order.driver.phone}`}
                                  style={{ width: 36, height: 36, borderRadius: 9,
                                    border: "1px solid rgba(62,207,110,0.3)",
                                    background: "rgba(62,207,110,0.07)", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                                    textDecoration: "none" }}>📞</a>
                              )}
                              {order.status === "pending" && (
                                <button onClick={() => setShowCancel(order.id)}
                                  style={{ flex: 1, height: 36, borderRadius: 9,
                                    border: "1px solid rgba(255,64,64,0.25)",
                                    background: "rgba(255,64,64,0.07)", color: "#ff4040",
                                    fontSize: 10, fontWeight: 600, fontFamily: "Lexend", cursor: "pointer" }}>
                                  ✕ Hủy đơn
                                </button>
                              )}
                              {(order.status === "accepted" || order.status === "preparing") && (
                                <button onClick={() => setShowCancel(order.id)}
                                  style={{ flex: 1, height: 36, borderRadius: 9,
                                    border: "1px solid rgba(74,143,245,0.3)",
                                    background: "rgba(74,143,245,0.07)", color: "#4a8ff5",
                                    fontSize: 10, fontWeight: 600, fontFamily: "Lexend", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                                  📞 Liên hệ Admin
                                </button>
                              )}
                              {isCompleted && (
                                <>
                                  <button onClick={() => handleReorder(order)}
                                    style={{ flex: 1, height: 36, borderRadius: 9, border: "none",
                                      background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
                                      color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: "Lexend", cursor: "pointer",
                                      position: "relative", overflow: "hidden",
                                      boxShadow: "0 3px 10px rgba(255,107,0,0.3)",
                                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                                    <div style={{ position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                                      background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)",
                                      animation: "oShimmer 2.5s infinite" }} />
                                    <span style={{ position: "relative", zIndex: 1 }}>🔄 Đặt lại</span>
                                  </button>
                                  {!order.rating && (
                                    <button onClick={() => setShowReview(order.id)}
                                      style={{ height: 36, padding: "0 11px", borderRadius: 9,
                                        border: "1px solid rgba(255,179,71,0.3)",
                                        background: "rgba(255,179,71,0.07)", color: "#FFB347",
                                        fontSize: 10, fontWeight: 600, fontFamily: "Lexend", cursor: "pointer", whiteSpace: "nowrap" }}>
                                      ⭐ Đánh giá
                                    </button>
                                  )}
                                </>
                              )}
                              {isCancelled && (
                                <button onClick={() => handleReorder(order)}
                                  style={{ flex: 1, height: 36, borderRadius: 9,
                                    border: "1px solid rgba(255,107,0,0.25)",
                                    background: "rgba(255,107,0,0.07)", color: "#FF8C00",
                                    fontSize: 10, fontWeight: 600, fontFamily: "Lexend", cursor: "pointer" }}>
                                  🔄 Đặt lại đơn này
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )
            })
          )}

          {activeTab !== "history" && historyOrders.length > 0 && (
            <div onClick={() => setActiveTab("history")}
              style={{ margin: "6px 0 0", padding: "11px 14px", borderRadius: 12, cursor: "pointer",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#b0956a", fontSize: 10, fontWeight: 600 }}>🕐 Lịch sử đơn hàng</div>
                <div style={{ color: "#6a5a40", fontSize: 8.5, marginTop: 2 }}>
                  {historyOrders.length} đơn hàng từ các ngày trước
                </div>
              </div>
              <span style={{ color: "#6a5a40", fontSize: 16, lineHeight: 1 }}>›</span>
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <div style={{ position: "absolute", bottom:"max(16px,env(safe-area-inset-bottom))",left:14, right: 14, height: 56,
          background: "rgba(8,8,6,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,107,0,0.2)", borderRadius: 9999,
          display: "flex", alignItems: "center", justifyContent: "space-around",
          padding: "0 6px", zIndex: 50, boxShadow: "0 0 20px rgba(255,107,0,0.1)" }}>
          {NAV_TABS.map(tab => (
            <button key={tab.href} onClick={() => router.push(tab.href)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "5px 11px", borderRadius: 18, border: "none", cursor: "pointer",
                fontFamily: "Lexend", background: tab.active ? "rgba(255,107,0,0.12)" : "transparent",
                transform: tab.active ? "translateY(-2px)" : "translateY(0)",
                transition: "all .2s", position: "relative" }}>
              <span style={{ fontSize: 19, filter: tab.active ? "drop-shadow(0 0 4px rgba(255,107,0,0.6))" : "none" }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: 7.5, color: tab.active ? "#FF8C00" : "#6a5a40", fontWeight: tab.active ? 600 : 400 }}>
                {tab.label}
              </span>
              {tab.active && (
                <div style={{ position: "absolute", bottom: -2, width: 28, height: 3, borderRadius: 2,
                  background: "radial-gradient(ellipse,rgba(255,107,0,0.9) 0%,transparent 70%)", filter: "blur(1px)" }} />
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
