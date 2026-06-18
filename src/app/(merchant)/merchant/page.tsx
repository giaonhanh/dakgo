"use client"

import { useState, useEffect } from "react"
import { usePushNotification } from "@/hooks/usePushNotification"
import { useOrderSound } from "@/hooks/useOrderSound"
import { motion, AnimatePresence } from "framer-motion"
import { Power, ShoppingBag, TrendingUp, Star } from "lucide-react"
import Link from "next/link"
import { formatPrice } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { OrderItemList } from "@/components/ui/OrderItemList"

type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "delivered" | "rejected"
type PayMethod   = "cash" | "wallet" | "vietqr" | "momo" | "zalopay"

interface MOrder {
  id: string
  shortId: string
  customerName: string
  customerPhone: string
  items: string
  itemList: { name: string; qty: number; price: number; note?: string; breakdown?: { basePrice: number; sizeLabel?: string; sizeDiff?: number; toppings?: { name: string; price: number }[] } | null }[]
  shipFee: number
  total: number
  subtotal: number
  discountAmount: number
  payMethod: PayMethod
  status: OrderStatus
  time: string
  note?: string
  scheduledAt?: string | null
  driverId?: string
  driverName?: string
  driverPhone?: string
  driverPlate?: string
  driverRating?: number
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; bd: string }> = {
  pending:    { label: "Chờ xác nhận",  color: "#f5c542", bg: "rgba(245,197,66,0.1)",  bd: "rgba(245,197,66,0.3)"  },
  accepted:   { label: "Đã xác nhận",   color: "#4a8ff5", bg: "rgba(74,143,245,0.1)",  bd: "rgba(74,143,245,0.3)"  },
  preparing:  { label: "Đang chuẩn bị", color: "#4a8ff5", bg: "rgba(74,143,245,0.1)",  bd: "rgba(74,143,245,0.3)"  },
  ready:      { label: "Sẵn sàng giao", color: "#3ecf6e", bg: "rgba(62,207,110,0.1)",  bd: "rgba(62,207,110,0.25)" },
  delivering: { label: "Đang giao",     color: "#FF8C00", bg: "rgba(255,107,0,0.1)",   bd: "rgba(255,107,0,0.3)"   },
  delivered:  { label: "Đã giao",       color: "#3ecf6e", bg: "rgba(62,207,110,0.06)", bd: "rgba(62,207,110,0.15)" },
  cancelled:  { label: "Đã hủy",        color: "#ff4040", bg: "rgba(255,64,64,0.08)",  bd: "rgba(255,64,64,0.2)"   },
  rejected:   { label: "Đã từ chối",    color: "#ff4040", bg: "rgba(255,64,64,0.08)",  bd: "rgba(255,64,64,0.2)"   },
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function maskPhone(phone: string): string {
  if (!phone) return "—"
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 4) return phone
  return "****" + digits.slice(-4)
}

function parseItemName(fullName: string) {
  const match = fullName.match(/^(.+?)\s*\((.+)\)$/)
  if (!match) return { base: fullName, size: null, toppings: [] as string[] }
  const base = match[1].trim()
  const parts = match[2].split(/\s*·\s*/).map(s => s.trim()).filter(Boolean)
  const sizeIdx = parts.findIndex(p => /^size/i.test(p))
  const size = sizeIdx >= 0 ? parts[sizeIdx] : null
  const toppings = parts.filter((_, i) => i !== sizeIdx)
  return { base, size, toppings }
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

export default function MerchantDashboard() {
  const supabase = createClient()
  const [shopId,        setShopId]        = useState<string | null>(null)
  const [shopName,      setShopName]      = useState("Cửa hàng")
  const [commRate,      setCommRate]      = useState(0.10)
  const [open,          setOpen]          = useState(true)
  const [orders,        setOrders]        = useState<MOrder[]>([])
  const [todayRevenue,  setTodayRevenue]  = useState(0)
  const [rating,        setRating]        = useState<number | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [toast,         setToast]         = useState("")
  const [toastOk,       setToastOk]       = useState(true)
  const [expand,        setExpand]        = useState<string | null>(null)
  const [rejectModal,   setRejectModal]   = useState<MOrder | null>(null)
  const [rejectReason,  setRejectReason]  = useState("")
  const [dispatchStatus, setDispatchStatus] = useState<Record<string, "dispatching" | "sent" | "none">>({})
  const [shopLat, setShopLat] = useState(12.6521)
  const [shopLng, setShopLng] = useState(108.5073)
  const [shopStatus, setShopStatus] = useState<"pending" | "approved" | "suspended" | null>(null)
  const [unreadNotif, setUnreadNotif] = useState(0)
  const [setupRequired, setSetupRequired] = useState(false)

  const { requestPermission } = usePushNotification()
  useOrderSound("merchant", shopId)

  const fireToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3000)
  }

  // ── Fetch shop + orders ───────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      requestPermission(user.id)   // xin quyền push notification

      // Get merchant's shop
      const { data: shop } = await supabase
        .from("shops")
        .select("id, name, is_open, rating_avg, total_reviews, status, commission_rate, phone, lat, lng")
        .eq("owner_id", user.id)
        .single()

      if (!shop) { setLoading(false); return }
      setShopStatus((shop as { status?: "pending" | "approved" | "suspended" }).status ?? "pending")
      if ((shop as { status?: string }).status !== "approved") { setLoading(false); return }
      setShopId(shop.id)
      setShopName(shop.name)
      setOpen(shop.is_open)
      setRating(shop.rating_avg ?? null)
      setCommRate(((shop as { commission_rate?: number }).commission_rate ?? 10) / 100)

      // Kiểm tra shop đã cài đặt đủ thông tin bắt buộc chưa
      const hasLat   = !!(shop as { lat?: number }).lat
      const hasLng   = !!(shop as { lng?: number }).lng
      const hasPhone = !!(shop as { phone?: string }).phone?.trim()
      const hasName  = !!shop.name?.trim()
      setSetupRequired(!hasName || !hasPhone || !hasLat || !hasLng)

      await fetchOrders(shop.id)

      // Unread notifications count
      const { count } = await supabase.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("is_read", false)
      setUnreadNotif(count ?? 0)

      setLoading(false)
    }
    load()

    // Re-check khi quay lại tab (sau khi shop update profile / đọc thông báo)
    const recheck = async () => {
      if (document.visibilityState !== "visible") return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Cập nhật lại số thông báo chưa đọc
      const { count } = await supabase.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("is_read", false)
      setUnreadNotif(count ?? 0)
      // Cập nhật trạng thái setup quán
      const { data: sh } = await supabase
        .from("shops").select("name, phone, lat, lng").eq("owner_id", user.id).single()
      if (!sh) return
      const ok = !!(sh as { lat?: number }).lat && !!(sh as { lng?: number }).lng
        && !!(sh as { phone?: string }).phone?.trim() && !!sh.name?.trim()
      if (ok) setSetupRequired(false)
    }
    document.addEventListener("visibilitychange", recheck)
    return () => document.removeEventListener("visibilitychange", recheck)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchOrders(sid: string) {
    const today = new Date()
    today.setHours(0,0,0,0)

    // Fetch orders (không join order_items để tránh RLS join issue)
    const { data: rows } = await supabase
      .from("orders")
      .select("id, status, total_amount, total, ship_fee, discount_amount, pay_method, note, created_at, scheduled_at, customer_id, driver_id")
      .eq("shop_id", sid)
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false })
      .limit(30)

    if (!rows || !rows.length) return

    const orderIds = rows.map(o => o.id)

    // Fetch order_items riêng (tránh nested join RLS)
    type RawItem = { order_id: string; name: string; price: number; qty: number; note?: string; options?: MOrder["itemList"][number]["breakdown"] }
    let { data: allItems, error: itemsErr } = await supabase
      .from("order_items")
      .select("order_id, name, price, qty, note, options")
      .in("order_id", orderIds)
    if (itemsErr) {
      console.error("[Merchant] order_items error:", itemsErr.message, itemsErr.code, itemsErr.details)
      const { data: fallback } = await supabase
        .from("order_items")
        .select("order_id, name, price, qty, note")
        .in("order_id", orderIds)
      allItems = fallback as typeof allItems
      itemsErr = null
    }

    const itemsByOrder: Record<string, RawItem[]> = {}
    ;(allItems ?? []).forEach((item: RawItem) => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
      itemsByOrder[item.order_id].push({
        order_id: item.order_id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        note: item.note ?? undefined,
        options: (item as RawItem).options ?? undefined,
      })
    })

    // Get customer profiles
    const customerIds = [...new Set(rows.map(o => o.customer_id))]
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", customerIds)
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    // Get driver profiles (cho các đơn đã có tài xế)
    const driverIds = [...new Set(rows.map(o => o.driver_id).filter(Boolean))]
    const driverProfileMap: Record<string, { full_name: string; phone: string }> = {}
    const driverInfoMap: Record<string, { license_plate: string; rating_avg: number }> = {}
    if (driverIds.length > 0) {
      const [{ data: dProfiles }, { data: dInfos }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone").in("id", driverIds),
        supabase.from("drivers").select("id, license_plate, rating_avg").in("id", driverIds),
      ])
      ;(dProfiles ?? []).forEach(p => { driverProfileMap[p.id] = p })
      ;(dInfos ?? []).forEach(d => { driverInfoMap[d.id] = d })
    }

    const revenue = rows
      .filter(o => o.status !== "cancelled" && o.status !== "rejected")
      .reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
    setTodayRevenue(revenue)

    const mapped: MOrder[] = rows.map(o => {
      const profile = profileMap[o.customer_id] ?? {}
      const items = itemsByOrder[o.id] ?? []
      const itemStr = items.map(i => `${i.name} x${i.qty}`).join(", ")
      const pm = o.pay_method as PayMethod
      const dp = o.driver_id ? driverProfileMap[o.driver_id] : null
      const di = o.driver_id ? driverInfoMap[o.driver_id] : null
      return {
        id: o.id,
        shortId: o.id.slice(0,8).toUpperCase(),
        customerName: profile.full_name ?? "Khách hàng",
        customerPhone: profile.phone ?? "",
        items: itemStr || "—",
        itemList: items.map(i => ({ name: i.name, qty: i.qty, price: i.price, note: i.note, breakdown: i.options ?? null })),
        total: o.total_amount,
        subtotal: o.total ?? o.total_amount,
        shipFee: o.ship_fee ?? 0,
        discountAmount: (o as { discount_amount?: number }).discount_amount ?? 0,
        driverId: o.driver_id ?? undefined,
        driverName: dp?.full_name ?? undefined,
        driverPhone: dp?.phone ?? undefined,
        driverPlate: di?.license_plate ?? undefined,
        driverRating: di?.rating_avg ?? undefined,
        payMethod: pm === "wallet" ? "wallet" : pm === "vietqr" ? "vietqr" : "cash",
        status: (o.status === "cancelled" ? "rejected" : o.status) as OrderStatus,
        time: fmtTime(o.created_at),
        note: o.note ?? undefined,
        scheduledAt: o.scheduled_at ?? null,
      }
    })
    setOrders(mapped)
  }

  // ── Realtime new orders ───────────────────────────────────
  useEffect(() => {
    if (!shopId) return
    const ch = supabase
      .channel(`merchant-orders:${shopId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "orders",
        filter: `shop_id=eq.${shopId}`
      }, () => {
        fetchOrders(shopId)
        setUnreadNotif(n => n + 1) // tăng badge chuông ngay, trigger DB đã tạo notification
        fireToast("🔔 Đơn mới vừa vào!")
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "orders",
        filter: `shop_id=eq.${shopId}`
      }, () => {
        fetchOrders(shopId)
      })
      .subscribe()

    // Fallback: poll every 30s in case realtime misses an event
    const interval = setInterval(() => fetchOrders(shopId), 30_000)

    return () => {
      supabase.removeChannel(ch)
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId])

  const setOrderStatus = (id: string, status: OrderStatus) =>
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))

  const handleToggleOpen = async () => {
    const next = !open
    setOpen(next)
    if (shopId) {
      const { error } = await supabase.from("shops").update({ is_open: next }).eq("id", shopId)
      if (error) { setOpen(!next); fireToast("❌ Lỗi kết nối, thử lại", false); return }
    }
    fireToast(next ? "✅ Quán đã mở cửa" : "🔒 Quán đã đóng cửa")
  }

  // Parallel model: merchant chỉ cần bắt đầu làm — dispatch đã được checkout kích hoạt
  const handlePreparing = async (order: MOrder) => {
    setOrderStatus(order.id, "preparing")
    const { error } = await supabase.from("orders").update({
      status:       "preparing",
      accepted_at:  new Date().toISOString(),
      preparing_at: new Date().toISOString(),
    }).eq("id", order.id)
    if (error) { setOrderStatus(order.id, "pending"); fireToast("❌ Không thể cập nhật, thử lại", false); return }
    fireToast(`✅ Đang chuẩn bị #${order.shortId}`)

    // Notify khách: quán đã bắt đầu làm
    fetch("/api/orders/notify-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id, status: "accepted" }),
    }).catch(() => {})
  }

  const openRejectModal = (order: MOrder) => {
    setRejectReason("")
    setRejectModal(order)
  }

  const confirmReject = async () => {
    if (!rejectModal) return
    const order  = rejectModal
    const reason = rejectReason.trim() || "Cửa hàng từ chối đơn hàng"
    setOrderStatus(order.id, "rejected")
    const { error } = await supabase.from("orders").update({
      status:        "cancelled",
      cancel_reason: reason,
      cancelled_at:  new Date().toISOString(),
    }).eq("id", order.id)
    if (error) { setOrderStatus(order.id, "pending"); fireToast("❌ Không thể từ chối, thử lại", false); setRejectModal(null); return }

    // Hoàn hoa hồng tài xế + notify khách
    fetch("/api/orders/notify-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id, status: "cancelled", cancel_reason: reason }),
    }).catch(() => {})

    const refundMsg = order.payMethod === "wallet" ? ` · Hoàn ${fmt(order.total)} về ví` : ""
    fireToast(`❌ Từ chối #${order.shortId}${refundMsg}`, false)
    setRejectModal(null)
  }

  const handleReady = async (order: MOrder) => {
    setOrderStatus(order.id, "ready")
    const { error } = await supabase.from("orders").update({ status: "ready" }).eq("id", order.id)
    if (error) { setOrderStatus(order.id, "preparing"); fireToast("❌ Lỗi kết nối, thử lại", false); return }
    fireToast(`📦 #${order.shortId} sẵn sàng giao!`)

    // Notify tài xế hàng đã xong
    fetch("/api/orders/notify-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id, status: "ready" }),
    }).catch(() => {})
  }

  const activeOrders  = orders.filter(o => !["rejected", "delivered"].includes(o.status))
  const pendingCount  = orders.filter(o => o.status === "pending").length

  // ── Pending / Suspended gate ──
  if (shopStatus === "pending") {
    return (
      <div style={{ minHeight:"100dvh", background:"#080806", display:"flex",
        alignItems:"center", justifyContent:"center", padding:24,
        fontFamily:"'Lexend',sans-serif" }}>
        <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,107,0,0.2)",
          borderRadius:20, padding:32, maxWidth:340, textAlign:"center" }}>
          <div style={{ fontSize:56, marginBottom:16 }}>⏳</div>
          <div style={{ color:"#f8f0e0", fontSize:18, fontWeight:800, marginBottom:8 }}>
            Cửa hàng đang chờ duyệt
          </div>
          <div style={{ color:"#b0956a", fontSize:13, lineHeight:1.6, marginBottom:24 }}>
            Đơn đăng ký cửa hàng của bạn đang được admin xem xét. Bạn sẽ nhận được thông báo khi được phê duyệt.
          </div>
          <button onClick={async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: s } = await supabase.from("shops").select("status").eq("owner_id", user.id).maybeSingle()
            const st = (s as { status?: string } | null)?.status
            if (st === "approved") setShopStatus("approved")
          }} style={{
            background:"rgba(255,107,0,0.12)", border:"1px solid rgba(255,107,0,0.3)",
            color:"#FF8C00", borderRadius:12, padding:"10px 24px",
            fontFamily:"'Lexend',sans-serif", fontSize:12, fontWeight:700,
            cursor:"pointer", marginBottom:12, display:"block", width:"100%",
          }}>
            🔄 Kiểm tra lại trạng thái
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login" }}
            style={{
              background:"transparent", border:"1px solid rgba(255,255,255,0.08)",
              color:"#6a5a40", borderRadius:12, padding:"10px 24px",
              fontFamily:"'Lexend',sans-serif", fontSize:12, fontWeight:600,
              cursor:"pointer", display:"block", width:"100%",
            }}>
            Đăng xuất
          </button>
        </div>
      </div>
    )
  }

  if (shopStatus === "suspended") {
    return (
      <div style={{ minHeight:"100dvh", background:"#080806", display:"flex",
        alignItems:"center", justifyContent:"center", padding:24,
        fontFamily:"'Lexend',sans-serif" }}>
        <div style={{ background:"rgba(255,64,64,0.06)", border:"1px solid rgba(255,64,64,0.2)",
          borderRadius:20, padding:32, maxWidth:340, textAlign:"center" }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🚫</div>
          <div style={{ color:"#ff6060", fontSize:18, fontWeight:800, marginBottom:8 }}>
            Cửa hàng bị tạm khóa
          </div>
          <div style={{ color:"#b0956a", fontSize:13, lineHeight:1.6, marginBottom:24 }}>
            Cửa hàng của bạn đã bị tạm khóa. Vui lòng liên hệ admin để biết thêm thông tin.
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login" }}
            style={{
              background:"rgba(255,64,64,0.12)", border:"1px solid rgba(255,64,64,0.3)",
              color:"#ff6060", borderRadius:12, padding:"10px 24px",
              fontFamily:"'Lexend',sans-serif", fontSize:12, fontWeight:700,
              cursor:"pointer", display:"block", width:"100%",
            }}>
            Đăng xuất
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes mPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes mShim  { 0%{left:-60%} 100%{left:120%} }
      `}</style>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            style={{ position: "fixed", top: "calc(env(safe-area-inset-top) + 64px)", left: "50%", transform: "translateX(-50%)",
              zIndex: 999, background: toastOk ? "rgba(62,207,110,0.15)" : "rgba(255,64,64,0.15)",
              border: `1px solid ${toastOk ? "rgba(62,207,110,0.35)" : "rgba(255,64,64,0.35)"}`,
              borderRadius: 12, padding: "8px 18px", color: toastOk ? "#3ecf6e" : "#ff6060",
              fontSize: 11, fontWeight: 600, backdropFilter: "blur(10px)",
              maxWidth: "calc(100vw - 32px)", textAlign: "center" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Blocking setup modal: hiện cho đến khi shop cập nhật đủ thông tin ── */}
      {setupRequired && (
        <div style={{ position:"fixed", inset:0, zIndex:200,
          background:"rgba(8,8,6,0.97)", backdropFilter:"blur(10px)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          padding:24, fontFamily:"'Lexend',sans-serif" }}>
          <div style={{ width:"100%", maxWidth:380 }}>
            {/* Icon */}
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ width:72, height:72, borderRadius:"50%", margin:"0 auto 14px",
                background:"linear-gradient(135deg,rgba(255,107,0,0.2),rgba(255,64,64,0.1))",
                border:"2px solid rgba(255,107,0,0.4)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>
                📍
              </div>
              <div style={{ color:"#FF6B00", fontSize:18, fontWeight:800, marginBottom:6 }}>
                Hoàn thành thông tin cửa hàng
              </div>
              <div style={{ color:"#6a5a40", fontSize:11, lineHeight:1.6 }}>
                Cửa hàng của bạn chưa cài đặt đầy đủ thông tin bắt buộc.
                Điều này ảnh hưởng trực tiếp đến việc nhận đơn và{" "}
                <strong style={{ color:"#FF8C00" }}>dòng tiền của quán</strong>.
              </div>
            </div>

            {/* Danh sách yêu cầu */}
            <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:16, padding:"4px 16px", marginBottom:20 }}>
              {[
                { icon:"🏪", label:"Tên cửa hàng",        desc:"Hiển thị cho khách đặt đơn" },
                { icon:"📞", label:"Số điện thoại quán",   desc:"Liên hệ khi cần xác nhận đơn" },
                { icon:"📍", label:"Vị trí trên bản đồ",  desc:"Tài xế dùng để điều hướng đến quán" },
              ].map((item, i, arr) => (
                <div key={item.label} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"13px 0",
                  borderBottom: i < arr.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
                    background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.2)",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700 }}>{item.label}</div>
                    <div style={{ color:"#6a5a40", fontSize:9.5, marginTop:2 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cảnh báo dòng tiền */}
            <div style={{ background:"rgba(255,64,64,0.06)", border:"1px solid rgba(255,64,64,0.2)",
              borderRadius:12, padding:"10px 14px", marginBottom:20,
              display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ fontSize:16, flexShrink:0 }}>⚠️</span>
              <span style={{ color:"#ff6060", fontSize:9.5, lineHeight:1.5 }}>
                Nếu không cập nhật, tài xế không thể tìm thấy quán — đơn hàng bị hủy và{" "}
                doanh thu của quán sẽ bị ảnh hưởng nghiêm trọng.
              </span>
            </div>

            {/* Nút bắt buộc */}
            <a href="/merchant/profile" style={{ textDecoration:"none", display:"block" }}>
              <button style={{ width:"100%", height:52, borderRadius:14, border:"none",
                background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
                color:"#fff", fontSize:14, fontWeight:800, fontFamily:"Lexend",
                cursor:"pointer", boxShadow:"0 4px 18px rgba(255,107,0,0.45)" }}>
                📋 Cập nhật ngay →
              </button>
            </a>
            <div style={{ textAlign:"center", color:"#6a5a40", fontSize:9, marginTop:10 }}>
              Thông báo này sẽ biến mất sau khi hoàn thành đầy đủ
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", inset: 0, background: "#080806",
        display: "flex", flexDirection: "column", fontFamily: "'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background: "rgba(8,8,6,0.96)", backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,107,0,0.08)",
          padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "#6a5a40", fontSize: 9 }}>Dashboard Merchant</div>
              <div style={{ color: "#f8f0e0", fontSize: 16, fontWeight: 800 }}>
                {loading ? "Đang tải..." : shopName}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Notification bell */}
              <Link href="/merchant/notifications" style={{ position:"relative", display:"block" }}>
                <div style={{ width:36, height:36, borderRadius:10,
                  background: unreadNotif > 0 ? "rgba(255,107,0,0.1)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${unreadNotif > 0 ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.08)"}`,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🔔</div>
                {unreadNotif > 0 && (
                  <div style={{ position:"absolute", top:-4, right:-4, minWidth:18, height:18,
                    borderRadius:9, background:"#ff4040", padding:"0 4px",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:9, fontWeight:800, color:"#fff", animation:"mPulse 1.5s infinite" }}>{unreadNotif}</div>
                )}
              </Link>
              {pendingCount > 0 && (
                <div style={{ position: "relative" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10,
                    background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📦</div>
                  <div style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18,
                    borderRadius: "50%", background: "#ff4040",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 800, color: "#fff",
                    animation: "mPulse 1.5s infinite" }}>{pendingCount}</div>
                </div>
              )}
              <motion.button whileTap={{ scale: 0.93 }} onClick={handleToggleOpen}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                  borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "Lexend",
                  background: open ? "rgba(62,207,110,0.15)" : "rgba(255,64,64,0.1)",
                  outline: `1px solid ${open ? "rgba(62,207,110,0.4)" : "rgba(255,64,64,0.3)"}`,
                  color: open ? "#3ecf6e" : "#ff4040", fontSize: 11, fontWeight: 700 }}>
                <Power size={12} />
                {open ? "Đang mở" : "Đã đóng"}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 24px" }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              { icon: <ShoppingBag size={15} />, label: "Đơn hôm nay", value: `${orders.length}`,             color: "#FF8C00" },
              { icon: <TrendingUp  size={15} />, label: "Doanh thu",   value: formatPrice(todayRevenue),      color: "#3ecf6e" },
              { icon: <Star        size={15} />, label: "Đánh giá",    value: rating ? `${rating} ★` : "—",  color: "#f5c542" },
            ].map(s => (
              <div key={s.label} style={{ padding: "10px 8px", borderRadius: 12, textAlign: "center",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ color: s.color, display: "flex", justifyContent: "center", marginBottom: 4 }}>{s.icon}</div>
                <div style={{ color: s.color, fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: "#6a5a40", fontSize: 7.5, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ color: "#6a5a40", fontSize: 9, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Đơn đang xử lý — {activeOrders.length} đơn
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 11 }}>
              Đang tải đơn hàng...
            </div>
          ) : activeOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 12 }}>
              😌 Không có đơn hàng nào đang xử lý
            </div>
          ) : (
            activeOrders.map((order, idx) => {
              const cfg    = STATUS_CFG[order.status] ?? { label: order.status, color: "#6a5a40", bg: "rgba(255,255,255,0.04)", bd: "rgba(255,255,255,0.1)" }
              const isOpen = expand === order.id
              return (
                <motion.div key={order.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{ marginBottom: 10,
                    background: order.status === "pending" ? "rgba(245,197,66,0.04)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${order.status === "pending" ? "rgba(245,197,66,0.25)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 14, overflow: "hidden",
                    boxShadow: order.status === "pending" ? "0 0 20px rgba(245,197,66,0.06)" : "none" }}>

                  <div onClick={() => setExpand(p => p === order.id ? null : order.id)}
                    style={{ padding: "11px 13px", cursor: "pointer" }}>

                    {/* ── Hàng 1: giờ · tổng món · ghi chú · trạng thái ── */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {order.status === "pending" && (
                          <div style={{ width: 7, height: 7, borderRadius: "50%",
                            background: "#f5c542", animation: "mPulse 1.2s infinite",
                            boxShadow: "0 0 6px rgba(245,197,66,0.6)", flexShrink: 0 }} />
                        )}
                        {/* Giờ đặt */}
                        <span style={{ color: "#b0956a", fontSize: 11, fontWeight: 700 }}>{order.time}</span>
                        {/* Tổng số món */}
                        <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 5, fontWeight: 700,
                          background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.25)",
                          color: "#FF8C00" }}>
                          {order.itemList.reduce((s, i) => s + i.qty, 0)} món
                        </span>
                        {/* Đặt trước */}
                        {order.scheduledAt && (
                          <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 5, fontWeight: 600,
                            background: "rgba(245,197,66,0.12)", border: "1px solid rgba(245,197,66,0.3)",
                            color: "#f5c542" }}>🕐 {fmtTime(order.scheduledAt)}</span>
                        )}
                        {/* Có ghi chú */}
                        {order.note && (
                          <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 5,
                            background: "rgba(245,197,66,0.08)", border: "1px solid rgba(245,197,66,0.2)",
                            color: "#f5c542" }}>📝</span>
                        )}
                      </div>
                      <div style={{ background: cfg.bg, border: `1px solid ${cfg.bd}`,
                        borderRadius: 7, padding: "2px 8px", flexShrink: 0 }}>
                        <span style={{ color: cfg.color, fontSize: 9, fontWeight: 600 }}>{cfg.label}</span>
                      </div>
                    </div>

                    {/* ── Hàng 2: Khách hàng ── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7,
                      padding: "6px 9px", borderRadius: 9,
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>👤</span>
                      <span style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 700, flex: 1,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {order.customerName}
                      </span>
                      <span style={{ color: "#6a5a40", fontSize: 9, flexShrink: 0 }}>
                        📱 {maskPhone(order.customerPhone)}
                      </span>
                    </div>

                    {/* ── Hàng 3: Danh sách món ── */}
                    <div style={{ marginBottom: 8, padding: "6px 9px", borderRadius: 9,
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      {order.itemList.slice(0, 3).map((item, i) => {
                        const { base } = parseItemName(item.name)
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between",
                            alignItems: "center", padding: "2px 0",
                            borderBottom: i < Math.min(order.itemList.length, 3) - 1
                              ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                            <span style={{ color: "#b0956a", fontSize: 10, flex: 1,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {base}
                            </span>
                            <span style={{ color: "#f8f0e0", fontSize: 10, fontWeight: 700,
                              marginLeft: 8, flexShrink: 0 }}>×{item.qty}</span>
                          </div>
                        )
                      })}
                      {order.itemList.length > 3 && (
                        <div style={{ color: "#6a5a40", fontSize: 8.5, marginTop: 3 }}>
                          +{order.itemList.length - 3} món khác...
                        </div>
                      )}
                    </div>

                    {/* ── Hàng 4: Tổng tiền + phương thức + mũi tên ── */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ background: "linear-gradient(90deg,#FF6B00,#FFB347)",
                          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                          backgroundClip: "text", fontSize: 14, fontWeight: 800 }}>
                          {fmt(order.total)}
                        </span>
                        <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 5, fontWeight: 600,
                          background: order.payMethod === "wallet" ? "rgba(74,143,245,0.1)" : "rgba(255,255,255,0.05)",
                          color: order.payMethod === "wallet" ? "#4a8ff5" : "#6a5a40",
                          border: order.payMethod === "wallet" ? "1px solid rgba(74,143,245,0.25)" : "1px solid rgba(255,255,255,0.08)" }}>
                          {order.payMethod === "wallet" ? "💙 Ví GN" : "💵 Tiền mặt"}
                        </span>
                      </div>
                      <span style={{ color: "#6a5a40", fontSize: 11,
                        transform: isOpen ? "rotate(180deg)" : "none",
                        transition: "transform .2s", display: "inline-block" }}>▾</span>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div key="exp" initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "11px 13px" }}>

                          {/* ── Tài xế nhận đơn ── */}
                          {order.driverId && (
                            <>
                              <div style={{ fontSize: 8, fontWeight: 700, color: "#6a5a40",
                                textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 }}>
                                🛵 Tài xế nhận đơn
                              </div>
                              <div style={{ borderRadius: 10, marginBottom: 12, overflow: "hidden",
                                background: "rgba(62,207,110,0.04)", border: "1px solid rgba(62,207,110,0.18)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                                      {order.driverName ?? "Đang cập nhật..."}
                                    </div>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                      {order.driverPlate && (
                                        <span style={{ color: "#3ecf6e", fontSize: 9, fontWeight: 700,
                                          background: "rgba(62,207,110,0.12)", border: "1px solid rgba(62,207,110,0.25)",
                                          padding: "2px 8px", borderRadius: 5 }}>{order.driverPlate}</span>
                                      )}
                                    </div>
                                  </div>
                                  {order.driverPhone && (
                                    <a href={`tel:${order.driverPhone}`}
                                      style={{ display: "flex", alignItems: "center", gap: 5,
                                        padding: "7px 14px", borderRadius: 8, textDecoration: "none",
                                        background: "rgba(62,207,110,0.12)", border: "1px solid rgba(62,207,110,0.3)",
                                        color: "#3ecf6e", fontSize: 10, fontWeight: 700 }}>
                                      📞 Gọi
                                    </a>
                                  )}
                                </div>
                                {order.driverPhone && (
                                  <div style={{ padding: "6px 12px", borderTop: "1px solid rgba(62,207,110,0.1)",
                                    color: "#6a5a40", fontSize: 9 }}>
                                    📱 {order.driverPhone}
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          {/* Không có tài xế còn chờ */}
                          {!order.driverId && ["preparing","ready"].includes(order.status) && (
                            <div style={{ display: "flex", alignItems: "center", gap: 7,
                              padding: "7px 10px", borderRadius: 9, marginBottom: 12,
                              background: "rgba(245,197,66,0.05)", border: "1px solid rgba(245,197,66,0.15)" }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%",
                                background: "#f5c542", animation: "mPulse 1.2s infinite", flexShrink: 0 }} />
                              <span style={{ color: "#f5c542", fontSize: 9 }}>Đang tìm tài xế gần nhất...</span>
                            </div>
                          )}

                          {/* ── Chi tiết đơn hàng ── */}
                          <div style={{ fontSize: 8, fontWeight: 700, color: "#6a5a40",
                            textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 }}>
                            Chi tiết đơn hàng
                          </div>
                          <div style={{ marginBottom: 12 }}>
                            <OrderItemList items={order.itemList} orderNote={order.note} />
                          </div>

                          {/* ── Thông tin thanh toán ── */}
                          <div style={{ fontSize: 8, fontWeight: 700, color: "#6a5a40",
                            textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 }}>
                            Thông tin thanh toán
                          </div>
                          {(() => {
                            const commission = Math.round(order.subtotal * commRate)
                            const netReceive = order.subtotal - commission - order.discountAmount
                            return (
                              <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)",
                                borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                                {[
                                  { label: "Tiền hàng", value: order.subtotal, color: "#f8f0e0", prefix: "" },
                                  { label: `Hoa hồng app ${Math.round(commRate * 100)}%`, value: commission, color: "#ff6060", prefix: "−" },
                                  ...(order.discountAmount > 0
                                    ? [{ label: "🎫 Voucher quán giảm", value: order.discountAmount, color: "#FFB347", prefix: "−" }]
                                    : []),
                                ].map((r, ri, arr) => (
                                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between",
                                    alignItems: "center", padding: "4px 0",
                                    borderBottom: ri < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                                    <span style={{ color: "#6a5a40", fontSize: 9.5 }}>{r.label}</span>
                                    <span style={{ color: r.color, fontSize: 9.5, fontWeight: 600 }}>
                                      {r.prefix}{fmt(r.value)}
                                    </span>
                                  </div>
                                ))}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                                  marginTop: 8, paddingTop: 7, borderTop: "1px solid rgba(62,207,110,0.3)" }}>
                                  <div>
                                    <div style={{ color: "#3ecf6e", fontSize: 10.5, fontWeight: 800 }}>✓ Tài xế trả quán</div>
                                    <div style={{ color: "#6a5a40", fontSize: 8, marginTop: 1 }}>
                                      💵 Tài xế trả tiền mặt khi lấy hàng
                                    </div>
                                  </div>
                                  <div style={{ color: "#3ecf6e", fontSize: 16, fontWeight: 800 }}>{fmt(netReceive)}</div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* Dispatch indicator for preparing orders */}
                          {(order.status === "accepted" || order.status === "preparing") && dispatchStatus[order.id] && (
                            <div style={{ marginBottom: 8, padding: "7px 10px", borderRadius: 9,
                              background: dispatchStatus[order.id] === "sent" ? "rgba(62,207,110,0.06)" : "rgba(74,143,245,0.06)",
                              border: `1px solid ${dispatchStatus[order.id] === "sent" ? "rgba(62,207,110,0.18)" : "rgba(74,143,245,0.18)"}`,
                              display: "flex", alignItems: "center", gap: 7 }}>
                              {dispatchStatus[order.id] === "dispatching" ? (
                                <>
                                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4a8ff5", animation: "mPulse 1s infinite", flexShrink: 0 }} />
                                  <span style={{ color: "#4a8ff5", fontSize: 9 }}>Đang tìm 3 tài xế gần nhất...</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: 11 }}>🛵</span>
                                  <span style={{ color: "#3ecf6e", fontSize: 9, fontWeight: 600 }}>Đã thông báo 3 tài xế · Chờ tài xế xác nhận nhận đơn</span>
                                </>
                              )}
                            </div>
                          )}

                          <div style={{ display: "flex", gap: 7, marginBottom: 6 }}>
                            <button onClick={() => window.open(`/merchant/print/${order.id}`, "_blank")}
                              style={{ flex: 1, height: 36, borderRadius: 10, border: "none",
                                background: "rgba(255,255,255,0.04)", outline: "1px solid rgba(255,255,255,0.1)",
                                color: "#b0956a", fontSize: 11, fontWeight: 700,
                                fontFamily: "Lexend", cursor: "pointer", display: "flex",
                                alignItems: "center", justifyContent: "center", gap: 5 }}>
                              🖨️ In hóa đơn
                            </button>
                          </div>

                          <div style={{ display: "flex", gap: 7 }}>
                            {order.status === "pending" && (
                              <>
                                <button onClick={() => openRejectModal(order)}
                                  style={{ flex: 1, height: 40, borderRadius: 10, border: "none",
                                    background: "rgba(255,64,64,0.1)", outline: "1px solid rgba(255,64,64,0.25)",
                                    color: "#ff4040", fontSize: 11, fontWeight: 700,
                                    fontFamily: "Lexend", cursor: "pointer" }}>
                                  ✕ Từ chối
                                </button>
                                <button onClick={() => handlePreparing(order)}
                                  style={{ flex: 2, height: 40, borderRadius: 10, border: "none",
                                    background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
                                    color: "#fff", fontSize: 11, fontWeight: 700,
                                    fontFamily: "Lexend", cursor: "pointer", position: "relative", overflow: "hidden",
                                    boxShadow: "0 3px 12px rgba(255,107,0,0.35)" }}>
                                  <div style={{ position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                                    background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                                    animation: "mShim 2.5s infinite" }} />
                                  <span style={{ position: "relative", zIndex: 1 }}>🍳 Bắt đầu làm</span>
                                </button>
                              </>
                            )}
                            {(order.status === "accepted" || order.status === "preparing") && (
                              order.driverId ? (
                                <button onClick={() => handleReady(order)}
                                  style={{ flex: 1, height: 40, borderRadius: 10, border: "none",
                                    background: "rgba(62,207,110,0.12)", outline: "1px solid rgba(62,207,110,0.3)",
                                    color: "#3ecf6e", fontSize: 11, fontWeight: 700,
                                    fontFamily: "Lexend", cursor: "pointer" }}>
                                  📦 Đã xong, báo tài xế lấy hàng
                                </button>
                              ) : (
                                <div style={{ flex: 1, height: 40, borderRadius: 10,
                                  background: "rgba(245,197,66,0.06)", border: "1px solid rgba(245,197,66,0.2)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  color: "#f5c542", fontSize: 10, gap: 5 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: "50%",
                                    background: "#f5c542", animation: "mPulse 1.5s infinite" }} />
                                  Đang tìm tài xế — chờ nhận đơn
                                </div>
                              )
                            )}
                            {order.status === "ready" && (
                              <div style={{ flex: 1, height: 40, borderRadius: 10,
                                background: "rgba(62,207,110,0.06)", border: "1px solid rgba(62,207,110,0.2)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#3ecf6e", fontSize: 10, gap: 5 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%",
                                  background: "#3ecf6e", animation: "mPulse 1.5s infinite" }} />
                                Đang chờ tài xế tới lấy
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
            {[
              { href: "/merchant/orders",     icon: "📋", label: "Lịch sử đơn"   },
              { href: "/merchant/menu",       icon: "🍽️", label: "Quản lý menu"  },
              { href: "/merchant/revenue",    icon: "📊", label: "Doanh thu"      },
              { href: "/merchant/reviews",    icon: "⭐", label: "Đánh giá"       },
              { href: "/merchant/promotions", icon: "🎁", label: "Khuyến mãi"    },
              { href: "/merchant/settings",   icon: "⚙️", label: "Cài đặt"      },
            ].map(n => (
              <a key={n.href} href={n.href}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                  borderRadius: 12, background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)", textDecoration: "none" }}>
                <span style={{ fontSize: 18 }}>{n.icon}</span>
                <span style={{ color: "#b0956a", fontSize: 11, fontWeight: 600 }}>{n.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reject reason modal ── */}
      <AnimatePresence>
        {rejectModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setRejectModal(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 50, backdropFilter: "blur(6px)" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0e0c09",
                borderRadius: "22px 22px 0 0", border: "1px solid rgba(255,64,64,0.2)",
                padding: "18px 18px 36px", zIndex: 51 }}>
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 16px" }} />
              <div style={{ color: "#ff4040", fontSize: 14, fontWeight: 800, marginBottom: 6 }}>✕ Từ chối đơn #{rejectModal.shortId}</div>
              <div style={{ color: "#6a5a40", fontSize: 9, marginBottom: 14 }}>
                Khách hàng sẽ nhận thông báo từ chối. {rejectModal.payMethod === "wallet" && `Hoàn tiền ${fmt(rejectModal.total)} về ví.`}
              </div>

              <div style={{ color: "rgba(176,149,106,0.75)", fontSize: 9.5, marginBottom: 5 }}>Lý do từ chối</div>
              {/* Quick reason chips */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {["Hết nguyên liệu", "Quán đóng cửa", "Quá tải đơn hàng", "Không giao khu vực này"].map(r => (
                  <button key={r} onClick={() => setRejectReason(r)}
                    style={{ padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "Lexend",
                      background: rejectReason === r ? "rgba(255,64,64,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${rejectReason === r ? "rgba(255,64,64,0.35)" : "rgba(255,255,255,0.07)"}`,
                      color: rejectReason === r ? "#ff4040" : "#6a5a40", fontSize: 9, fontWeight: rejectReason === r ? 700 : 400 }}>
                    {r}
                  </button>
                ))}
              </div>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Hoặc nhập lý do khác..."
                style={{ width: "100%", minHeight: 56, background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,64,64,0.2)", borderRadius: 11,
                  color: "#f8f0e0", fontSize: 11, padding: "8px 12px", resize: "none",
                  fontFamily: "Lexend", outline: "none", marginBottom: 14 }} />

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setRejectModal(null)}
                  style={{ flex: 1, height: 44, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend",
                    background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                    color: "#6a5a40", fontSize: 12, fontWeight: 600 }}>Hủy</button>
                <button onClick={confirmReject}
                  style={{ flex: 2, height: 44, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "Lexend",
                    background: "rgba(255,64,64,0.15)", outline: "1px solid rgba(255,64,64,0.35)",
                    color: "#ff4040", fontSize: 12, fontWeight: 800 }}>
                  ✕ Xác nhận từ chối
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
