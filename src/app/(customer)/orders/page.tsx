"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { formatPrice } from "@/lib/utils"
import { useCartStore } from "@/store/cartStore"
import { createClient } from "@/lib/supabase/client"
import { getAdminContact } from "@/lib/adminContact"
import { maskPhone } from "@/lib/maskPhone"
import { OrderItemList, type ItemBreakdown } from "@/components/ui/OrderItemList"
import { isBlacklisted, logCancelAndCheckLock } from "@/lib/cancelLock"

// ─── Types ───────────────────────────────────────────────
type Status = "delivering" | "preparing" | "pending" | "accepted" | "ready" | "completed" | "cancelled"
type ServiceType = "food" | "errand_deliver" | "errand_buy" | "ride_motorbike" | "ride_car" | "ride_car_4" | "ride_car_7"

interface Item {
  emoji: string; name: string; qty: number; price: number
  productId?: string; note?: string
  breakdown?: ItemBreakdown
}
interface Order {
  id: string; shopId: string; shopName: string; shopEmoji: string; shopColor: string
  driverId: string | null
  serviceType: ServiceType
  status: Status; items: Item[]
  subtotal: number; deliveryFee: number; discount: number
  nightFee?: number
  createdAt: string; createdAtRaw: string; address: string; note?: string
  driver?: { name: string; plate: string; phone: string; rating: number; eta: number }
  payMethod: string; payMethodRaw: string; rating?: number; cancelReason?: string
  paymentStatus: string; xuUsed: number; xuBonusUsed: number
  senderName?: string; senderPhone?: string
  recipientName?: string; recipientPhone?: string
  packagePhotoUrl?: string; pickupAddress?: string
  customerName?: string; customerPhone?: string
  distanceKm?: number
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
  "Đặt nhầm món", "Nhầm địa chỉ", "Nhầm phương thức thanh toán", "Khác",
]

const STATUS_CFG: Record<Status, { label: string; c: string; bg: string; bd: string; dot: boolean }> = {
  pending:    { label: "Chờ xác nhận",          c: "#b464ff", bg: "rgba(180,100,255,0.12)", bd: "rgba(180,100,255,0.3)", dot: false },
  accepted:   { label: "Đã xác nhận · Đang làm", c: "#4a8ff5", bg: "rgba(74,143,245,0.12)",  bd: "rgba(74,143,245,0.3)",  dot: true  },
  preparing:  { label: "Đã xác nhận · Đang làm", c: "#4a8ff5", bg: "rgba(74,143,245,0.12)",  bd: "rgba(74,143,245,0.3)",  dot: true  },
  ready:      { label: "Đang tìm tài xế",         c: "#FFB347", bg: "rgba(255,179,71,0.12)",  bd: "rgba(255,179,71,0.3)",  dot: true  },
  delivering: { label: "Đang giao",               c: "#FF8C00", bg: "rgba(255,140,0,0.12)",   bd: "rgba(255,107,0,0.3)",   dot: true  },
  completed:  { label: "Đã giao",                 c: "#3ecf6e", bg: "rgba(62,207,110,0.08)",  bd: "rgba(62,207,110,0.25)", dot: false },
  cancelled:  { label: "Đã hủy",                  c: "#ff4040", bg: "rgba(255,64,64,0.08)",   bd: "rgba(255,64,64,0.22)",  dot: false },
}

// ─── Helpers ─────────────────────────────────────────────
const calcTotal = (o: Order) =>
  (o.subtotal ?? 0) + (o.deliveryFee ?? 0) - (o.discount ?? 0) + (o.nightFee ?? 0)

const SERVICE_CFG: Record<ServiceType, { label: string; emoji: string; color: string; chipBg: string; chipBd: string }> = {
  food:           { label: "Đồ ăn",   emoji: "🍜", color: "#FF6B00", chipBg: "rgba(255,107,0,0.12)",  chipBd: "rgba(255,107,0,0.35)"  },
  errand_deliver: { label: "Giao hộ", emoji: "📦", color: "#b464ff", chipBg: "rgba(180,100,255,0.12)", chipBd: "rgba(180,100,255,0.35)" },
  errand_buy:     { label: "Mua hộ",  emoji: "🛒", color: "#3ecf6e", chipBg: "rgba(62,207,110,0.12)",  chipBd: "rgba(62,207,110,0.35)"  },
  ride_motorbike: { label: "Xe ôm",       emoji: "🏍", color: "#4a8ff5", chipBg: "rgba(74,143,245,0.12)",  chipBd: "rgba(74,143,245,0.35)"  },
  ride_car:       { label: "Taxi",        emoji: "🚕", color: "#FFB347", chipBg: "rgba(255,179,71,0.12)",   chipBd: "rgba(255,179,71,0.35)"  },
  ride_car_4:     { label: "Taxi 4 chỗ", emoji: "🚕", color: "#FFB347", chipBg: "rgba(255,179,71,0.12)",   chipBd: "rgba(255,179,71,0.35)"  },
  ride_car_7:     { label: "Taxi 7 chỗ", emoji: "🚙", color: "#b464ff", chipBg: "rgba(180,100,255,0.12)",  chipBd: "rgba(180,100,255,0.35)" },
}

const SHOP_COLORS = ["#FF8C00","#4a8ff5","#3ecf6e","#FFB347","#b464ff","#ff6060"]
function shopColor(idx: number) { return SHOP_COLORS[idx % SHOP_COLORS.length] }
function isRideType(t: ServiceType) { return t === "ride_motorbike" || t === "ride_car" || t === "ride_car_4" || t === "ride_car_7" }


function fmtPayMethod(pm: string): string {
  const map: Record<string, string> = {
    cash: "Tiền mặt", vietqr: "VietQR",
    momo: "MoMo", zalopay: "ZaloPay", wallet: "Ví DakGo",
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
      <span style={{ color: c.c, fontSize: 11, fontWeight: 600 }}>{c.label}</span>
    </div>
  )
}

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "#6a5a40", fontSize: 11, fontWeight: 600,
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
            <div style={{ color: "#6a5a40", fontSize: 11 }}>{r.key}</div>
            <div style={{ color: "#b0956a", fontSize: 11, marginTop: 1 }}>{r.val}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Admin phone loaded dynamically from DB — see useEffect below
let ADMIN_PHONE = "0901999888"

// ─── Main ─────────────────────────────────────────────────
export default function OrdersPage() {
  const supabase = createClient()
  const router = useRouter()
  const { addItem, clearCart } = useCartStore()
  const [orders,       setOrders]       = useState<Order[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState("all")
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [showCancel,       setShowCancel]       = useState<string | null>(null)
  const [cancelRsn,        setCancelRsn]        = useState("")
  const [shopStar,         setShopStar]         = useState(5)
  const [driverReviewStar, setDriverReviewStar] = useState(5)
  const [shopReviewTxt,    setShopReviewTxt]    = useState("")
  const [driverReviewTxt,  setDriverReviewTxt]  = useState("")
  const [toast,            setToast]            = useState("")
  const [userId,       setUserId]       = useState<string | null>(null)
  const [cancelLocked, setCancelLocked] = useState(false)
  const [cancelSecsLeft, setCancelSecsLeft] = useState(0)
  const [adminPhone, setAdminPhone] = useState(ADMIN_PHONE)

  const fireToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400) }

  useEffect(() => {
    getAdminContact().then(c => { if (c.phone) { ADMIN_PHONE = c.phone; setAdminPhone(c.phone) } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fetch orders from Supabase ──────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      // Profile: tên + SĐT để hiện trong chi tiết rides
      const { data: prof } = await supabase
        .from("profiles").select("full_name, phone").eq("id", user.id).single()
      if (await isBlacklisted(supabase, user.id)) setCancelLocked(true)
      const myName  = prof?.full_name ?? ""
      const myPhone = prof?.phone     ?? ""

      const { data: rows, error: ordersErr } = await supabase
        .from("orders")
        .select(`
          id, status, delivery_address, note, total, ship_fee,
          pay_method, cancel_reason, created_at, driver_id, shop_id,
          payment_status, xu_used, xu_bonus_used, discount_amount,
          shops(id, name)
        `)
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (ordersErr) console.error("[Orders] fetch error:", ordersErr.message)

      const orderIds = (rows ?? []).map(o => o.id)

      // Fetch order_items riêng (tránh nested join RLS)
      const { data: allItems } = orderIds.length ? await supabase
        .from("order_items")
        .select("order_id, id, product_id, name, price, qty, note, options")
        .in("order_id", orderIds) : { data: [] }
      const itemsByOrder: Record<string, { id: string; product_id: string | null; name: string; price: number; qty: number; note?: string; breakdown?: ItemBreakdown }[]> = {}
      ;(allItems ?? []).forEach((item: { order_id: string; id: string; product_id: string | null; name: string; price: number; qty: number; note?: string; options?: ItemBreakdown }) => {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
        itemsByOrder[item.order_id].push({ id: item.id, product_id: item.product_id, name: item.name, price: item.price, qty: item.qty, note: item.note, breakdown: item.options })
      })

      // Fetch driver profiles for orders that have a driver
      const driverIds = (rows ?? [])
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
      const completedIds = (rows ?? [])
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

      const mapped: Order[] = (rows ?? []).map((o, idx) => {
        const shop = Array.isArray(o.shops) ? o.shops[0] : o.shops
        const driverProfile = driverProfiles.find(p => p.id === o.driver_id)
        const items = itemsByOrder[o.id] ?? []

        return {
          id: o.id,
          serviceType: "food" as ServiceType,
          shopId: o.shop_id ?? "",
          driverId: o.driver_id ?? null,
          shopName: shop?.name ?? "Cửa hàng",
          shopEmoji: "🍽️",
          shopColor: shopColor(idx),
          status: mapStatus(o.status),
          items: items.map(i => ({
            emoji: "🍽️",
            name: i.name,
            qty: i.qty,
            price: i.price,
            productId: i.product_id ?? i.id,
            note: i.note ?? undefined,
            breakdown: i.breakdown ?? undefined,
          })),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          subtotal:    (o as any).total    ?? 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          deliveryFee: (o as any).ship_fee ?? 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          discount:    (o as any).discount_amount ?? 0,
          createdAt: fmtDate(o.created_at),
          createdAtRaw: o.created_at,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          address:   (o as any).delivery_address ?? "",
          note: o.note ?? undefined,
          driver: driverProfile ? {
            name: driverProfile.full_name ?? "Tài xế",
            plate: "",
            phone: driverProfile.phone ?? "",
            rating: 5,
            eta: 0,
          } : undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payMethod:     fmtPayMethod((o as any).pay_method ?? "cash"),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payMethodRaw:  (o as any).pay_method ?? "cash",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          paymentStatus: (o as any).payment_status ?? "pending",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          xuUsed:        (o as any).xu_used       ?? 0,
          xuBonusUsed:   (o as any).xu_bonus_used ?? 0,
          rating: reviewMap[o.id] ?? undefined,
          cancelReason: o.cancel_reason ?? undefined,
        }
      })

      // ── Fetch errands (giao hộ / mua hộ) ──────────────────
      const { data: errandRows } = await supabase
        .from("errands")
        .select("id, type, status, pickup_address, delivery_address, package_description, items_description, service_fee, payment_method, note, created_at, driver_id, sender_name, sender_phone, recipient_name, recipient_phone, package_photo_url")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30)

      const errandMapped: Order[] = (errandRows ?? []).map((e, idx) => ({
        id:          e.id,
        serviceType: (e.type === "buy_for_me" ? "errand_buy" : "errand_deliver") as ServiceType,
        shopId:      "",
        shopName:    e.type === "buy_for_me" ? "Mua hộ" : "Giao hộ",
        shopEmoji:   e.type === "buy_for_me" ? "🛍️" : "📦",
        shopColor:   shopColor(idx + 100),
        driverId:    e.driver_id ?? null,
        status:      mapStatus(e.status ?? "pending"),
        items: [{
          emoji: e.type === "buy_for_me" ? "🛒" : "📦",
          name:  e.type === "buy_for_me"
            ? (e.items_description ?? "Danh sách mua")
            : (e.package_description ?? "Gói hàng"),
          qty:   1,
          price: e.service_fee ?? 0,
        }],
        subtotal:    e.service_fee ?? 0,
        deliveryFee: 0,
        discount:    0,
        createdAt:   fmtDate(e.created_at),
        createdAtRaw: e.created_at,
        address:     e.delivery_address ?? "",
        pickupAddress: e.pickup_address ?? undefined,
        note:          e.note ?? undefined,
        payMethod:     fmtPayMethod(e.payment_method ?? "cash"),
        payMethodRaw:  e.payment_method ?? "cash",
        paymentStatus: "pending",
        xuUsed:        0,
        xuBonusUsed:   0,
        senderName:    e.sender_name    ?? undefined,
        senderPhone:   e.sender_phone   ?? undefined,
        recipientName: e.recipient_name ?? undefined,
        recipientPhone:e.recipient_phone ?? undefined,
        packagePhotoUrl: e.package_photo_url ?? undefined,
      }))

      // ── Fetch rides (xe ôm / taxi) ─────────────────────────
      const { data: rideRows } = await supabase
        .from("rides")
        .select("id, vehicle_type, status, pickup_address, dropoff_address, estimated_fare, distance_km, payment_method, note, created_at, driver_id")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30)

      const rideMapped: Order[] = (rideRows ?? []).map((r, idx) => {
        const isMoto = r.vehicle_type === "motorbike"
        const svcType: ServiceType = isMoto ? "ride_motorbike"
          : r.vehicle_type === "car_7" ? "ride_car_7"
          : "ride_car_4"
        const svcLabel = isMoto ? "Xe ôm"
          : r.vehicle_type === "car_7" ? "Taxi 7 chỗ"
          : "Taxi 4 chỗ"
        const svcEmoji = isMoto ? "🛵" : r.vehicle_type === "car_7" ? "🚙" : "🚕"
        return {
          id:          r.id,
          serviceType: svcType,
          shopId:      "",
          shopName:    svcLabel,
          shopEmoji:   svcEmoji,
          shopColor:   shopColor(idx + 200),
          driverId:    r.driver_id ?? null,
          status:      r.status === "searching" ? "pending" : mapStatus(r.status ?? "pending"),
          items:        [],
          subtotal:     r.estimated_fare ?? 0,
          deliveryFee:  0,
          discount:     0,
          createdAt:    fmtDate(r.created_at),
          createdAtRaw: r.created_at,
          address:      r.dropoff_address ?? "",
          pickupAddress:r.pickup_address ?? undefined,
          note:         r.note ?? undefined,
          payMethod:    fmtPayMethod(r.payment_method ?? "cash"),
          payMethodRaw: r.payment_method ?? "cash",
          paymentStatus:"pending",
          xuUsed:       0,
          xuBonusUsed:  0,
          customerName:  myName,
          customerPhone: myPhone,
          distanceKm:    r.distance_km ?? undefined,
        }
      })

      const allOrders = [...mapped, ...errandMapped, ...rideMapped]
        .sort((a, b) => new Date(b.createdAtRaw).getTime() - new Date(a.createdAtRaw).getTime())

      setOrders(allOrders)
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

  // ── Realtime: tự động cập nhật payment_status + status khi có thay đổi ──
  useEffect(() => {
    if (!userId) return
    const ch = supabase
      .channel(`orders-rt-${userId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "orders",
        filter: `customer_id=eq.${userId}`,
      }, ({ new: upd }) => {
        const o = upd as { id: string; payment_status?: string; status?: string }
        setOrders(prev => prev.map(ord => {
          if (ord.id !== o.id) return ord
          return {
            ...ord,
            ...(o.payment_status ? { paymentStatus: o.payment_status } : {}),
            ...(o.status         ? { status: o.status as Status }       : {}),
          }
        }))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const cancelOrder      = orders.find(o => o.id === showCancel)
  const willRefundWallet = cancelOrder?.payMethod === "Ví DakGo"

  // Reset review inputs khi chuyển sang đơn khác
  useEffect(() => {
    setShopStar(5); setDriverReviewStar(5)
    setShopReviewTxt(""); setDriverReviewTxt("")
  }, [expanded])

  // 30s countdown khi mở cancel modal
  useEffect(() => {
    if (!showCancel || !cancelOrder) return
    const raw = cancelOrder.createdAtRaw
    const update = () => {
      const elapsed = Math.floor((Date.now() - new Date(raw).getTime()) / 1000)
      setCancelSecsLeft(Math.max(0, 30 - elapsed))
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [showCancel, cancelOrder])

  const canSelfCancel = cancelOrder?.status === "pending" && cancelSecsLeft > 0

  const handleConfirmCancel = async () => {
    if (!cancelRsn || !showCancel || !userId) return
    if (cancelLocked) {
      fireToast("Tài khoản bị khóa hủy đơn · Liên hệ quản trị viên!")
      setShowCancel(null); return
    }
    if (cancelSecsLeft <= 0) {
      fireToast("Đã hết thời gian hủy đơn!")
      setShowCancel(null); return
    }
    const { error } = await supabase.from("orders").update({
      status: "cancelled",
      cancel_reason: cancelRsn,
      cancelled_at: new Date().toISOString(),
    }).eq("id", showCancel).eq("customer_id", userId)
    if (error) {
      console.error("[Cancel] update error:", error.message, error.code)
      fireToast("Không thể hủy đơn, vui lòng thử lại!")
      return
    }

    const { locked, count } = await logCancelAndCheckLock(supabase, "customer", userId, showCancel, cancelRsn)

    if (locked) {
      setCancelLocked(true)
      fireToast("⚠️ Tài khoản bị khóa do hủy đơn quá nhiều lần · Liên hệ admin để mở khóa")
    } else {
      setOrders(prev => prev.map(o => o.id === showCancel ? { ...o, status: "cancelled" as Status, cancelReason: cancelRsn } : o))
      const msg = willRefundWallet ? "Đã hủy đơn · Hoàn tiền về ví DakGo!" : "Đã hủy đơn hàng!"
      if (count === 2) fireToast(`${msg} · ⚠️ Đây là lần hủy thứ 2, hủy thêm 1 lần nữa sẽ bị khóa tài khoản!`)
      else fireToast(msg)
    }
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
    // "Đã hủy" chỉ hiện đơn hủy trong ngày hôm nay — ngày mới tự reset
    if (activeTab === "cancelled")
      return o.status === "cancelled" && o.createdAt.startsWith(TODAY_STR)
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
    if (k === "cancelled") return orders.filter(o => o.status === "cancelled" && o.createdAt.startsWith(TODAY_STR)).length
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
            style={{ position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 62px)", left: "50%", transform: "translateX(-50%)",
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

              {cancelLocked ? (
                <>
                  <div style={{ color: "#ff4040", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🔒 Tài khoản bị khóa hủy đơn</div>
                  <div style={{ background: "rgba(255,64,64,0.07)", border: "1px solid rgba(255,64,64,0.2)", borderRadius: 11, padding: "12px 13px", marginBottom: 16 }}>
                    <div style={{ color: "#ff6060", fontSize: 10, lineHeight: 1.6 }}>
                      Bạn đã hủy đơn quá nhiều lần. Vui lòng liên hệ quản trị viên để mở khóa tài khoản.
                    </div>
                  </div>
                  <button onClick={() => { setShowCancel(null); setCancelRsn("") }}
                    style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#6a5a40", fontSize: 11, fontFamily: "Lexend", cursor: "pointer" }}>
                    Đóng
                  </button>
                </>
              ) : canSelfCancel ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700 }}>
                      Hủy đơn #{showCancel?.slice(0,8).toUpperCase()}
                    </div>
                    <div style={{ background: cancelSecsLeft <= 10 ? "rgba(255,64,64,0.15)" : "rgba(255,179,71,0.12)", border: `1px solid ${cancelSecsLeft <= 10 ? "rgba(255,64,64,0.3)" : "rgba(255,179,71,0.3)"}`, borderRadius: 8, padding: "3px 9px", color: cancelSecsLeft <= 10 ? "#ff4040" : "#FFB347", fontSize: 11, fontWeight: 700 }}>
                      ⏱ {cancelSecsLeft}s
                    </div>
                  </div>
                  <div style={{ background: willRefundWallet ? "rgba(62,207,110,0.07)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${willRefundWallet ? "rgba(62,207,110,0.2)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 10, padding: "9px 12px", marginBottom: 14,
                    display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{willRefundWallet ? "💚" : "ℹ️"}</span>
                    <div>
                      <div style={{ color: willRefundWallet ? "#3ecf6e" : "#b0956a", fontSize: 10, fontWeight: 600 }}>
                        {willRefundWallet ? "Sẽ hoàn tiền về ví DakGo" : "Thanh toán tiền mặt — không hoàn tiền"}
                      </div>
                      <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 2 }}>
                        {willRefundWallet
                          ? "Đơn huỷ trước khi quán xác nhận · Hoàn 100% về ví"
                          : "Đơn tiền mặt huỷ trước khi quán xác nhận không được hoàn"}
                      </div>
                    </div>
                  </div>
                  <div style={{ color: "#b0956a", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 9 }}>Lý do hủy</div>
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
                      {cancelOrder?.status === "pending"
                        ? "⏰ Đã quá 30 giây kể từ khi đặt đơn"
                        : `⚠️ Quán đã xác nhận đơn #${showCancel?.slice(0,8).toUpperCase()}`}
                    </div>
                    <div style={{ color: "#6a5a40", fontSize: 11, lineHeight: 1.6 }}>
                      {cancelOrder?.status === "pending"
                        ? "Chỉ được hủy trong 30 giây đầu tiên. Liên hệ admin nếu cần hỗ trợ."
                        : "Sau khi quán xác nhận, chỉ quản trị viên mới có quyền hủy đơn."}
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10, padding: "9px 12px", marginBottom: 16,
                    display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>ℹ️</span>
                    <div style={{ color: "#6a5a40", fontSize: 11, lineHeight: 1.6 }}>
                      {willRefundWallet
                        ? "Nếu admin chấp thuận huỷ, tiền sẽ được hoàn về ví DakGo."
                        : "Đơn tiền mặt: nếu admin chấp thuận huỷ, chưa có giao dịch phát sinh."}
                    </div>
                  </div>
                  <a href={`tel:${adminPhone}`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", height: 50, borderRadius: 12, textDecoration: "none",
                      background: "linear-gradient(90deg,#4a8ff5,#6aafff)",
                      color: "#fff", fontSize: 13, fontWeight: 700,
                      boxShadow: "0 4px 16px rgba(74,143,245,0.35)" }}>
                    📞 Gọi quản trị viên hỗ trợ
                  </a>
                  <div style={{ textAlign: "center", color: "#6a5a40", fontSize: 11, marginTop: 8 }}>
                    Hotline: {adminPhone} · Hỗ trợ 7:00 – 22:00
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
              <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>
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
                      borderRadius: 10, padding: "0 5px", fontSize: 11, fontWeight: 700 }}>{cnt}</span>
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
              const svc        = SERVICE_CFG[order.serviceType]
              const isOpen     = expanded === order.id
              const total      = calcTotal(order)
              const isActive   = ["delivering","preparing","pending","ready"].includes(order.status)
              const isCompleted  = order.status === "completed"
              const isCancelled  = order.status === "cancelled"

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

                      {/* Row 1: Dịch vụ · Tên quán · Trạng thái (realtime) */}
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                          background: svc.chipBg, border: `1px solid ${svc.chipBd}`, borderRadius: 6, padding: "2px 7px" }}>
                          <span style={{ fontSize: 11 }}>{svc.emoji}</span>
                          <span style={{ color: svc.color, fontSize: 11, fontWeight: 700 }}>{svc.label}</span>
                        </div>
                        <div style={{ flex: 1, color: "#f8f0e0", fontSize: 11.5, fontWeight: 700,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {order.shopName}
                        </div>
                        <StatusBadge status={order.status} />
                      </div>

                      {/* Row 2: Mã đơn · Ngày giờ · Số món  Tổng › */}
                      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ color: "#6a5a40", fontSize: 11, fontWeight: 600 }}>
                          #{order.id.slice(0,8).toUpperCase()}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.12)", margin: "0 5px", fontSize: 11 }}>·</span>
                        <span style={{ color: "#6a5a40", fontSize: 11 }}>{order.createdAt}</span>
                        <span style={{ color: "rgba(255,255,255,0.12)", margin: "0 5px", fontSize: 11 }}>·</span>
                        {(isRideType(order.serviceType))
                          ? <span style={{ color: "#6a5a40", fontSize: 11 }}>{order.distanceKm ? `~${order.distanceKm}km` : "Chuyến xe"}</span>
                          : <span style={{ color: "#6a5a40", fontSize: 11 }}>{order.items.length} món</span>
                        }
                        <div style={{ flex: 1 }} />
                        <span style={{ background: "linear-gradient(135deg,#FF6B00,#FFB347)",
                          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                          fontSize: 13, fontWeight: 700, marginRight: 7,
                          textDecoration: isCancelled ? "line-through" : "none" }}>
                          {formatPrice(total)}
                        </span>
                        <span style={{ color: "#6a5a40", fontSize: 11, display: "inline-block",
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}>⌾</span>
                      </div>

                    </div>

                    {/* ── Thông tin giao hàng (luôn hiển thị) ── */}
                    <div style={{ padding: "9px 13px 10px",
                      borderTop: "1px solid rgba(255,255,255,0.05)" }}>

                      {/* Địa chỉ / Điểm trả khách */}
                      <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 7 }}>
                        <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>
                          {(isRideType(order.serviceType)) ? "🚩" : "📍"}
                        </span>
                        <span style={{ color: "#b0956a", fontSize: 11, lineHeight: 1.45, flex: 1 }}>
                          {(isRideType(order.serviceType))
                            ? `${order.pickupAddress?.split(",")[0] ?? "—"} → ${order.address?.split(",")[0] ?? "—"}`
                            : (order.address || "Chưa có địa chỉ")
                          }
                        </span>
                      </div>

                      {/* Tài xế + call + tracking */}
                      {order.driver ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontSize: 12, flexShrink: 0 }}>🛵</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ color: "#f8f0e0", fontSize: 10, fontWeight: 600 }}>{order.driver.name}</span>
                            {order.driver.plate && (
                              <span style={{ color: "#6a5a40", fontSize: 11, marginLeft: 5 }}>{order.driver.plate}</span>
                            )}
                          </div>
                          {order.driver.phone && !isCompleted && !isCancelled && (
                            <a href={`tel:${order.driver.phone}`}
                              onClick={e => e.stopPropagation()}
                              style={{ textDecoration: "none", width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                                background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.28)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📞</a>
                          )}
                          {isActive && !isRideType(order.serviceType) && (
                            <button onClick={e => { e.stopPropagation(); router.push(`/tracking/${order.id}`) }}
                              style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, cursor: "pointer",
                                background: "rgba(255,107,0,0.1)", outline: "1px solid rgba(255,107,0,0.28)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🗺️</button>
                          )}
                        </div>
                      ) : !isCancelled && !isCompleted ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 11 }}>⏳</span>
                          <span style={{ color: "#6a5a40", fontSize: 11 }}>Đang tìm tài xế...</span>
                        </div>
                      ) : null}

                      {/* Lý do hủy */}
                      {isCancelled && order.cancelReason && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7,
                          padding: "5px 9px", background: "rgba(255,64,64,0.05)",
                          border: "1px solid rgba(255,64,64,0.15)", borderRadius: 7 }}>
                          <span style={{ fontSize: 11 }}>⚠️</span>
                          <span style={{ color: "#ff6060", fontSize: 11 }}>Lý do: {order.cancelReason}</span>
                        </div>
                      )}
                    </div>

                    {/* Expanded */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div key="detail" initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }} style={{ overflow: "hidden" }}>
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 13px" }}>

                            {order.status === "preparing" && (
                              <div style={{ background: "rgba(74,143,245,0.07)", border: "1px solid rgba(74,143,245,0.2)",
                                borderRadius: 11, padding: "9px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 18 }}>👨‍🍳</span>
                                <div>
                                  <div style={{ color: "#4a8ff5", fontSize: 10, fontWeight: 600 }}>Cửa hàng đang chuẩn bị</div>
                                  <div style={{ color: "rgba(74,143,245,0.55)", fontSize: 11, marginTop: 1 }}>Dự kiến xong sau 10–15 phút</div>
                                </div>
                              </div>
                            )}

                            {/* ── 1a. Chi tiết chuyến xe (rides) ── */}
                            {(isRideType(order.serviceType)) && (
                              <>
                                <SLabel>Chi tiết chuyến xe</SLabel>
                                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                                  borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
                                  <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🟢</span>
                                      <div>
                                        <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 2 }}>Điểm đón</div>
                                        <div style={{ color: "#f8f0e0", fontSize: 11.5, fontWeight: 600 }}>{order.pickupAddress || "—"}</div>
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ padding: "10px 12px" }}>
                                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📍</span>
                                      <div>
                                        <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 2 }}>Điểm trả khách</div>
                                        <div style={{ color: "#f8f0e0", fontSize: 11.5, fontWeight: 600 }}>{order.address || "—"}</div>
                                      </div>
                                    </div>
                                  </div>
                                  {order.distanceKm && (
                                    <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.05)",
                                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ color: "#6a5a40", fontSize: 11 }}>Khoảng cách ước tính</span>
                                      <span style={{ color: "#FFB347", fontSize: 11, fontWeight: 700 }}>~{order.distanceKm} km</span>
                                    </div>
                                  )}
                                </div>
                                {/* Thông tin người đặt */}
                                <SLabel>Thông tin người đặt</SLabel>
                                <InfoBox rows={[
                                  ...(order.customerName  ? [{ icon: "👤", key: "Họ tên",       val: order.customerName }] : []),
                                  ...(order.customerPhone ? [{ icon: "📞", key: "Số điện thoại", val: order.customerPhone }] : []),
                                  ...(order.driver        ? [{ icon: "🛵", key: "Tài xế",        val: `${order.driver.name}${order.driver.plate ? " · " + order.driver.plate : ""}` }] : []),
                                  ...(order.driver?.phone ? [{ icon: "📞", key: "SĐT tài xế",    val: maskPhone(order.driver.phone) }] : []),
                                  ...(order.note          ? [{ icon: "📝", key: "Ghi chú",       val: order.note }] : []),
                                ]} />
                              </>
                            )}

                            {/* ── 1b. Chi tiết món (food / errand) ── */}
                            {!isRideType(order.serviceType) && (
                            <><SLabel>Chi tiết món</SLabel>
                            <div style={{ marginBottom: 10 }}>
                              <OrderItemList items={order.items} orderNote={order.note} />
                            </div>
                            </>
                            )}

                            {/* ── 2. Thông tin thanh toán ── */}
                            {(() => {
                              const xuUsed      = order.xuUsed      ?? 0
                              const xuBonusUsed = order.xuBonusUsed ?? 0
                              const totalXu     = xuUsed + xuBonusUsed
                              const cashPayable = Math.max(0, total - totalXu)
                              const raw   = order.payMethodRaw  ?? "cash"
                              const pStat = order.paymentStatus ?? "pending"
                              let statusText = ""; let statusColor = "#6a5a40"
                              if (pStat === "paid") { statusText = "✅ Đã thanh toán"; statusColor = "#3ecf6e" }
                              else if (cashPayable === 0) { statusText = "✅ Đã trả bằng xu"; statusColor = "#3ecf6e" }
                              else if (raw === "cash") { statusText = `💵 Chưa thanh toán`; statusColor = "#ff6060" }
                              else { statusText = `⏳ Chờ chuyển khoản`; statusColor = "#FFB347" }
                              return (
                                <>
                                  <SLabel>Thông tin thanh toán</SLabel>
                                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                                    borderRadius: 10, padding: "8px 10px", marginBottom: 10 }}>
                                    {[
                                      { label: isRideType(order.serviceType) ? "Cước phí xe" : "Tiền hàng", val: order.subtotal,    c: "#b0956a" },
                                      order.deliveryFee > 0 ? { label: "Phí giao hàng",  val: order.deliveryFee,  c: "#b0956a" } : null,
                                      order.discount > 0    ? { label: "Voucher giảm",   val: -order.discount,    c: "#3ecf6e" } : null,
                                      xuUsed > 0            ? { label: "🪙 Xu DakGo", val: -xuUsed,          c: "#FFB347" } : null,
                                      xuBonusUsed > 0       ? { label: "🎁 Xu thưởng",   val: -xuBonusUsed,       c: "#FFB347" } : null,
                                    ].filter((r): r is { label: string; val: number; c: string } => r !== null)
                                     .map((r, ri) => (
                                      <div key={ri} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                                        <span style={{ color: "#6a5a40", fontSize: 11 }}>{r.label}</span>
                                        <span style={{ color: r.c, fontSize: 11 }}>{r.val < 0 ? "−" : ""}{formatPrice(Math.abs(r.val))}</span>
                                      </div>
                                    ))}
                                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                      <span style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 600 }}>Tổng cộng</span>
                                      <span style={{ background: "linear-gradient(135deg,#FF6B00,#FFB347)",
                                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                        backgroundClip: "text", fontSize: 14, fontWeight: 700 }}>{formatPrice(total)}</span>
                                    </div>
                                    {cashPayable > 0 && pStat !== "paid" && (
                                      <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                                        <span style={{ color: "#6a5a40", fontSize: 11 }}>Số tiền cần phải thanh toán</span>
                                        <span style={{ color: "#ff6060", fontSize: 11, fontWeight: 700 }}>{formatPrice(cashPayable)}</span>
                                      </div>
                                    )}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                                      padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4 }}>
                                      <span style={{ color: "#6a5a40", fontSize: 11 }}>{order.payMethod}</span>
                                      <span style={{ color: statusColor, fontSize: 11, fontWeight: 600 }}>{statusText}</span>
                                    </div>
                                  </div>
                                </>
                              )
                            })()}

                            {/* ── 3. Thông tin giao hàng (food / errand only) ── */}
                            {!isRideType(order.serviceType) && (
                            <><SLabel>Thông tin giao hàng</SLabel>
                            <InfoBox rows={[
                              ...(order.pickupAddress ? [{ icon: "📤", key: "Lấy tại",     val: order.pickupAddress }] : []),
                              { icon: "📍", key: order.serviceType === "food" ? "Địa chỉ giao" : "Giao đến", val: order.address },
                              ...(order.senderName    ? [{ icon: "👤", key: "Người gửi",    val: `${order.senderName} · ${maskPhone(order.senderPhone)}` }] : []),
                              ...(order.recipientName ? [{ icon: "📬", key: "Người nhận",   val: `${order.recipientName} · ${maskPhone(order.recipientPhone)}` }] : []),
                              ...(order.driver        ? [{ icon: "🛵", key: "Tài xế",        val: `${order.driver.name}${order.driver.plate ? " · " + order.driver.plate : ""}` }] : []),
                              ...(order.driver?.phone ? [{ icon: "📞", key: "SĐT tài xế",   val: order.driver.phone }] : []),
                              ...(order.note          ? [{ icon: "📝", key: "Ghi chú đơn",  val: order.note }] : []),
                            ]} />
                            </> )}

                            {order.packagePhotoUrl && (
                              <>
                                <SLabel>Ảnh gói hàng</SLabel>
                                <img src={order.packagePhotoUrl} alt="Gói hàng"
                                  style={{ width:"100%",borderRadius:10,marginBottom:10,objectFit:"cover",maxHeight:200 }} />
                              </>
                            )}

                            {/* ── 4. Đánh giá inline (completed + chưa đánh giá) ── */}
                            {isCompleted && !order.rating && (
                              <div style={{ marginBottom: 10, background: "rgba(255,179,71,0.04)",
                                border: "1px solid rgba(255,179,71,0.15)", borderRadius: 12, padding: "12px 12px" }}>
                                <div style={{ color: "#FFB347", fontSize: 10, fontWeight: 700, marginBottom: 12 }}>
                                  ⭐ Đánh giá đơn hàng
                                </div>
                                {/* Tài xế */}
                                {order.driverId && (
                                  <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                    <div style={{ color: "#b0956a", fontSize: 11, fontWeight: 600,
                                      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>🛵 Tài xế giao hàng</div>
                                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                                      {[1,2,3,4,5].map(n => (
                                        <span key={n} onClick={() => setDriverReviewStar(n)}
                                          style={{ fontSize: 26, cursor: "pointer",
                                            opacity: n <= driverReviewStar ? 1 : 0.2,
                                            filter: n <= driverReviewStar ? "drop-shadow(0 0 3px rgba(255,179,71,0.7))" : "none" }}>⭐</span>
                                      ))}
                                    </div>
                                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
                                      {["DakGo","Thân thiện","Đúng giờ","Cẩn thận","Biết đường"].map(chip => (
                                        <div key={chip} onClick={() => setDriverReviewTxt(p => p.includes(chip) ? p.replace(`, ${chip}`,"").replace(chip,"").trim() : p ? `${p}, ${chip}` : chip)}
                                          style={{ padding: "3px 9px", borderRadius: 8, cursor: "pointer", fontSize: 11,
                                            background: driverReviewTxt.includes(chip) ? "rgba(74,143,245,0.12)" : "rgba(255,255,255,0.04)",
                                            border: `1px solid ${driverReviewTxt.includes(chip) ? "rgba(74,143,245,0.4)" : "rgba(255,255,255,0.08)"}`,
                                            color: driverReviewTxt.includes(chip) ? "#4a8ff5" : "#6a5a40" }}>{chip}</div>
                                      ))}
                                    </div>
                                    <div style={{ position: "relative" }}>
                                      <textarea value={driverReviewTxt}
                                        onChange={e => setDriverReviewTxt(e.target.value.slice(0,200))}
                                        placeholder="Nhận xét về tài xế..." rows={2}
                                        style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
                                          borderRadius:9, padding:"7px 9px 14px", color:"#f8f0e0", fontSize:10, fontFamily:"Lexend",
                                          outline:"none", resize:"none", boxSizing:"border-box" }} />
                                      <span style={{ position:"absolute", bottom:5, right:8, color:"#6a5a40", fontSize: 10, pointerEvents:"none" }}>
                                        {driverReviewTxt.length}/200
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {/* Quán ăn */}
                                {order.serviceType === "food" && (
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={{ color: "#b0956a", fontSize: 11, fontWeight: 600,
                                      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>🍽️ Chất lượng quán</div>
                                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                                      {[1,2,3,4,5].map(n => (
                                        <span key={n} onClick={() => setShopStar(n)}
                                          style={{ fontSize: 26, cursor: "pointer",
                                            opacity: n <= shopStar ? 1 : 0.2,
                                            filter: n <= shopStar ? "drop-shadow(0 0 3px rgba(255,179,71,0.7))" : "none" }}>⭐</span>
                                      ))}
                                    </div>
                                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
                                      {["Món ngon","Đúng mô tả","Đóng gói đẹp","Sạch sẽ","Phục vụ tốt"].map(chip => (
                                        <div key={chip} onClick={() => setShopReviewTxt(p => p.includes(chip) ? p.replace(`, ${chip}`,"").replace(chip,"").trim() : p ? `${p}, ${chip}` : chip)}
                                          style={{ padding: "3px 9px", borderRadius: 8, cursor: "pointer", fontSize: 11,
                                            background: shopReviewTxt.includes(chip) ? "rgba(62,207,110,0.1)" : "rgba(255,255,255,0.04)",
                                            border: `1px solid ${shopReviewTxt.includes(chip) ? "rgba(62,207,110,0.35)" : "rgba(255,255,255,0.08)"}`,
                                            color: shopReviewTxt.includes(chip) ? "#3ecf6e" : "#6a5a40" }}>{chip}</div>
                                      ))}
                                    </div>
                                    <div style={{ position: "relative" }}>
                                      <textarea value={shopReviewTxt}
                                        onChange={e => setShopReviewTxt(e.target.value.slice(0,200))}
                                        placeholder="Nhận xét về quán..." rows={2}
                                        style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
                                          borderRadius:9, padding:"7px 9px 14px", color:"#f8f0e0", fontSize:10, fontFamily:"Lexend",
                                          outline:"none", resize:"none", boxSizing:"border-box" }} />
                                      <span style={{ position:"absolute", bottom:5, right:8, color:"#6a5a40", fontSize: 10, pointerEvents:"none" }}>
                                        {shopReviewTxt.length}/200
                                      </span>
                                    </div>
                                  </div>
                                )}
                                <button onClick={async () => {
                                    if (!userId) return
                                    await supabase.from("reviews").insert({
                                      order_id: order.id, reviewer_id: userId,
                                      shop_id: order.shopId || null, driver_id: order.driverId,
                                      food_rating: shopStar, driver_rating: driverReviewStar,
                                      shop_comment: shopReviewTxt || null,
                                      driver_comment: driverReviewTxt || null,
                                    })
                                    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, rating: shopStar } : o))
                                    fireToast("Đã gửi đánh giá, cảm ơn bạn!")
                                    setShopStar(5); setDriverReviewStar(5)
                                    setShopReviewTxt(""); setDriverReviewTxt("")
                                  }}
                                  style={{ width:"100%", height:44, borderRadius:11, border:"none", position:"relative", overflow:"hidden",
                                    background:"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
                                    color:"#fff", fontSize:11, fontWeight:700, fontFamily:"Lexend", cursor:"pointer",
                                    boxShadow:"0 3px 14px rgba(255,107,0,0.3)" }}>
                                  <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
                                    background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)", animation:"oShimmer 2.5s infinite" }} />
                                  <span style={{ position:"relative", zIndex:1 }}>⭐ Gửi đánh giá</span>
                                </button>
                              </div>
                            )}

                            {/* Đã đánh giá */}
                            {isCompleted && order.rating && (
                              <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:10,
                                padding:"7px 10px", background:"rgba(255,179,71,0.06)",
                                border:"1px solid rgba(255,179,71,0.15)", borderRadius:9 }}>
                                {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize:12, opacity: s <= order.rating! ? 1 : 0.2 }}>⭐</span>)}
                                <span style={{ color:"#b0956a", fontSize: 11, marginLeft:5 }}>Bạn đã đánh giá đơn này</span>
                              </div>
                            )}

                            {/* ── 5. Action buttons ── */}
                            <div style={{ display: "flex", gap: 7, marginTop: 6 }}>
                              {isActive && !isRideType(order.serviceType) && (
                                <button onClick={() => router.push(`/tracking/${order.id}`)}
                                  style={{ flex: 1, height: 36, borderRadius: 9, border: "none",
                                    background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
                                    color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: "Lexend",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                                    boxShadow: "0 3px 10px rgba(255,107,0,0.3)", cursor: "pointer" }}>
                                  🗺️ Theo dõi đơn hàng
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
                              {(isCompleted || isCancelled) && (
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
                <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 2 }}>
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
              <span style={{ fontSize: 10, color: tab.active ? "#FF8C00" : "#6a5a40", fontWeight: tab.active ? 600 : 400 }}>
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


