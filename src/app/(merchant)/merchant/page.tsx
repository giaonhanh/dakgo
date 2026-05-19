"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Power, ShoppingBag, TrendingUp, Star } from "lucide-react"
import { formatPrice } from "@/lib/utils"

type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "rejected"
type PayMethod   = "cash" | "wallet"

interface MOrder {
  id: string
  customerName: string
  customerPhone: string
  items: string
  itemList: { name: string; qty: number; price: number }[]
  total: number
  payMethod: PayMethod
  status: OrderStatus
  time: string
  note?: string
}

const INIT_ORDERS: MOrder[] = [
  {
    id: "GN2855",
    customerName: "Nguyễn Văn An",
    customerPhone: "0901234567",
    items: "Cơm sườn x2, Nước ngọt x1",
    itemList: [
      { name: "Cơm sườn trứng", qty: 2, price: 40000 },
      { name: "Nước ngọt",      qty: 1, price: 15000 },
    ],
    total: 110000,
    payMethod: "wallet",
    status: "pending",
    time: "13:42",
    note: "Ít cay, không hành",
  },
  {
    id: "GN2854",
    customerName: "Trần Thị Mai",
    customerPhone: "0912345678",
    items: "Bún bò đặc biệt x1",
    itemList: [{ name: "Bún bò đặc biệt", qty: 1, price: 45000 }],
    total: 60000,
    payMethod: "cash",
    status: "preparing",
    time: "13:30",
  },
  {
    id: "GN2853",
    customerName: "Lê Văn Bình",
    customerPhone: "0923456789",
    items: "Cơm chiên x2, Trà đá x2",
    itemList: [
      { name: "Cơm chiên dương châu", qty: 2, price: 35000 },
      { name: "Trà đá",               qty: 2, price: 5000  },
    ],
    total: 90000,
    payMethod: "cash",
    status: "ready",
    time: "13:15",
  },
]

const STATUS_CFG: Record<OrderStatus, { label: string; color: string; bg: string; bd: string }> = {
  pending:   { label: "Chờ xác nhận",   color: "#f5c542", bg: "rgba(245,197,66,0.1)",  bd: "rgba(245,197,66,0.3)"  },
  accepted:  { label: "Đã xác nhận",    color: "#4a8ff5", bg: "rgba(74,143,245,0.1)",  bd: "rgba(74,143,245,0.3)"  },
  preparing: { label: "Đang chuẩn bị",  color: "#4a8ff5", bg: "rgba(74,143,245,0.1)",  bd: "rgba(74,143,245,0.3)"  },
  ready:     { label: "Sẵn sàng giao",  color: "#3ecf6e", bg: "rgba(62,207,110,0.1)",  bd: "rgba(62,207,110,0.25)" },
  rejected:  { label: "Đã từ chối",     color: "#ff4040", bg: "rgba(255,64,64,0.08)",  bd: "rgba(255,64,64,0.2)"   },
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function MerchantDashboard() {
  const [open,    setOpen]    = useState(true)
  const [orders,  setOrders]  = useState<MOrder[]>(INIT_ORDERS)
  const [toast,   setToast]   = useState("")
  const [toastOk, setToastOk] = useState(true)
  const [expand,  setExpand]  = useState<string | null>("GN2855")

  const fireToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3000)
  }

  const setStatus = (id: string, status: OrderStatus) =>
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))

  const handleAccept = (order: MOrder) => {
    setStatus(order.id, "accepting" as OrderStatus)
    setStatus(order.id, "accepted")
    // Notification sẽ đi qua Supabase Realtime → push notification tới khách
    fireToast(`✅ Đã xác nhận #${order.id} · Khách đã được thông báo`)
    // Tự chuyển sang preparing sau 1s (quán bắt đầu làm)
    setTimeout(() => setStatus(order.id, "preparing"), 1000)
  }

  const handleReject = (order: MOrder) => {
    setStatus(order.id, "rejected")
    const refundMsg = order.payMethod === "wallet"
      ? ` · Hoàn ${fmt(order.total)} về ví khách`
      : " · Khách thanh toán tiền mặt, không hoàn"
    fireToast(`❌ Đã từ chối #${order.id}${refundMsg}`, false)
  }

  const handleReady = (order: MOrder) => {
    setStatus(order.id, "ready")
    fireToast(`📦 #${order.id} sẵn sàng · Đang tìm tài xế...`)
  }

  const activeOrders   = orders.filter(o => !["rejected"].includes(o.status))
  const pendingCount   = orders.filter(o => o.status === "pending").length
  const todayRevenue   = 1850000
  const rating         = 4.8

  return (
    <>
      <style>{`
        @keyframes mPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes mShim  { 0%{left:-60%} 100%{left:120%} }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            style={{ position: "fixed", top: 52, left: "50%", transform: "translateX(-50%)",
              zIndex: 999, background: toastOk ? "rgba(62,207,110,0.15)" : "rgba(255,64,64,0.15)",
              border: `1px solid ${toastOk ? "rgba(62,207,110,0.35)" : "rgba(255,64,64,0.35)"}`,
              borderRadius: 12, padding: "8px 18px", color: toastOk ? "#3ecf6e" : "#ff6060",
              fontSize: 11, fontWeight: 600, backdropFilter: "blur(10px)",
              maxWidth: "calc(100vw - 32px)", textAlign: "center" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position: "fixed", inset: 0, background: "#080806",
        display: "flex", flexDirection: "column", fontFamily: "'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background: "rgba(8,8,6,0.96)", backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,107,0,0.08)",
          padding: "44px 16px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "#6a5a40", fontSize: 9 }}>Dashboard Merchant</div>
              <div style={{ color: "#f8f0e0", fontSize: 16, fontWeight: 800 }}>Cơm Tấm Lan</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Badge đơn mới */}
              {pendingCount > 0 && (
                <div style={{ position: "relative" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10,
                    background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔔</div>
                  <div style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18,
                    borderRadius: "50%", background: "#ff4040",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 800, color: "#fff",
                    animation: "mPulse 1.5s infinite" }}>{pendingCount}</div>
                </div>
              )}
              {/* Toggle mở/đóng cửa */}
              <motion.button whileTap={{ scale: 0.93 }} onClick={() => setOpen(v => !v)}
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
              { icon: <ShoppingBag size={15} />, label: "Đơn hôm nay", value: `${orders.length}`,          color: "#FF8C00" },
              { icon: <TrendingUp  size={15} />, label: "Doanh thu",   value: formatPrice(todayRevenue),   color: "#3ecf6e" },
              { icon: <Star        size={15} />, label: "Đánh giá",    value: `${rating} ★`,               color: "#f5c542" },
            ].map(s => (
              <div key={s.label} style={{ padding: "10px 8px", borderRadius: 12, textAlign: "center",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ color: s.color, display: "flex", justifyContent: "center", marginBottom: 4 }}>{s.icon}</div>
                <div style={{ color: s.color, fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: "#6a5a40", fontSize: 7.5, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Đơn hàng */}
          <div style={{ color: "#6a5a40", fontSize: 9, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Đơn đang xử lý — {activeOrders.length} đơn
          </div>

          {activeOrders.map((order, idx) => {
            const cfg    = STATUS_CFG[order.status]
            const isOpen = expand === order.id

            return (
              <motion.div key={order.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                style={{ marginBottom: 10,
                  background: order.status === "pending"
                    ? "rgba(245,197,66,0.04)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${order.status === "pending"
                    ? "rgba(245,197,66,0.25)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 14, overflow: "hidden",
                  boxShadow: order.status === "pending"
                    ? "0 0 20px rgba(245,197,66,0.06)" : "none" }}>

                {/* Card header */}
                <div onClick={() => setExpand(p => p === order.id ? null : order.id)}
                  style={{ padding: "11px 13px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center",
                    justifyContent: "space-between", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Dot pulse nếu pending */}
                      {order.status === "pending" && (
                        <div style={{ width: 7, height: 7, borderRadius: "50%",
                          background: "#f5c542", animation: "mPulse 1.2s infinite",
                          boxShadow: "0 0 6px rgba(245,197,66,0.6)" }} />
                      )}
                      <div style={{ color: "#FF8C00", fontSize: 12, fontWeight: 800 }}>#{order.id}</div>
                      <div style={{ color: "#6a5a40", fontSize: 9 }}>{order.time}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                      background: cfg.bg, border: `1px solid ${cfg.bd}`,
                      borderRadius: 7, padding: "2px 8px" }}>
                      <span style={{ color: cfg.color, fontSize: 9, fontWeight: 600 }}>{cfg.label}</span>
                    </div>
                  </div>

                  <div style={{ color: "#b0956a", fontSize: 9.5,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    marginBottom: 5 }}>{order.items}</div>

                  <div style={{ display: "flex", alignItems: "center",
                    justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: "linear-gradient(90deg,#FF6B00,#FFB347)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        backgroundClip: "text", fontSize: 13, fontWeight: 800 }}>
                        {fmt(order.total)}
                      </span>
                      {/* Badge phương thức TT */}
                      <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 5, fontWeight: 600,
                        background: order.payMethod === "wallet"
                          ? "rgba(74,143,245,0.1)" : "rgba(255,255,255,0.05)",
                        color: order.payMethod === "wallet" ? "#4a8ff5" : "#6a5a40",
                        border: order.payMethod === "wallet"
                          ? "1px solid rgba(74,143,245,0.25)" : "1px solid rgba(255,255,255,0.08)" }}>
                        {order.payMethod === "wallet" ? "💙 Ví GN" : "💵 Tiền mặt"}
                      </span>
                    </div>
                    <span style={{ color: "#6a5a40", fontSize: 12,
                      transform: isOpen ? "rotate(180deg)" : "none",
                      transition: "transform .2s", display: "inline-block" }}>⌾</span>
                  </div>
                </div>

                {/* Expanded */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div key="exp" initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "11px 13px" }}>

                        {/* Chi tiết món */}
                        <div style={{ marginBottom: 10 }}>
                          {order.itemList.map((item, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between",
                              padding: "4px 0", borderBottom: i < order.itemList.length - 1
                                ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                              <span style={{ color: "#b0956a", fontSize: 10 }}>
                                {item.name} <span style={{ color: "#6a5a40" }}>×{item.qty}</span>
                              </span>
                              <span style={{ color: "#f8f0e0", fontSize: 10, fontWeight: 600 }}>
                                {fmt(item.price * item.qty)}
                              </span>
                            </div>
                          ))}
                          {order.note && (
                            <div style={{ marginTop: 7, padding: "5px 8px", borderRadius: 7,
                              background: "rgba(255,255,255,0.03)", color: "#6a5a40", fontSize: 8.5 }}>
                              📝 {order.note}
                            </div>
                          )}
                        </div>

                        {/* Thông tin khách */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8,
                          padding: "7px 10px", borderRadius: 9, marginBottom: 10,
                          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <span style={{ fontSize: 14 }}>👤</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: "#b0956a", fontSize: 10, fontWeight: 600 }}>{order.customerName}</div>
                            <div style={{ color: "#6a5a40", fontSize: 8.5, marginTop: 1 }}>{order.customerPhone}</div>
                          </div>
                          <a href={`tel:${order.customerPhone}`}
                            style={{ width: 30, height: 30, borderRadius: 8, textDecoration: "none",
                              background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)",
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>📞</a>
                        </div>

                        {/* Hoàn tiền nếu từ chối */}
                        {order.status === "pending" && (
                          <div style={{ padding: "7px 10px", borderRadius: 9, marginBottom: 10,
                            background: order.payMethod === "wallet"
                              ? "rgba(74,143,245,0.06)" : "rgba(255,255,255,0.02)",
                            border: `1px solid ${order.payMethod === "wallet"
                              ? "rgba(74,143,245,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                            <div style={{ color: order.payMethod === "wallet" ? "#4a8ff5" : "#6a5a40",
                              fontSize: 9, lineHeight: 1.6 }}>
                              {order.payMethod === "wallet"
                                ? `💙 Nếu từ chối → hoàn ${fmt(order.total)} về ví khách tự động`
                                : "💵 Tiền mặt — từ chối không cần hoàn tiền"}
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: 7 }}>
                          {order.status === "pending" && (
                            <>
                              <button onClick={() => handleReject(order)}
                                style={{ flex: 1, height: 40, borderRadius: 10, border: "none",
                                  background: "rgba(255,64,64,0.1)",
                                  outline: "1px solid rgba(255,64,64,0.25)",
                                  color: "#ff4040", fontSize: 11, fontWeight: 700,
                                  fontFamily: "Lexend", cursor: "pointer" }}>
                                ✕ Từ chối
                              </button>
                              <button onClick={() => handleAccept(order)}
                                style={{ flex: 2, height: 40, borderRadius: 10, border: "none",
                                  background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
                                  color: "#fff", fontSize: 11, fontWeight: 700,
                                  fontFamily: "Lexend", cursor: "pointer", position: "relative", overflow: "hidden",
                                  boxShadow: "0 3px 12px rgba(255,107,0,0.35)" }}>
                                <div style={{ position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                                  background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                                  animation: "mShim 2.5s infinite" }} />
                                <span style={{ position: "relative", zIndex: 1 }}>✓ Xác nhận đơn</span>
                              </button>
                            </>
                          )}
                          {(order.status === "accepted" || order.status === "preparing") && (
                            <button onClick={() => handleReady(order)}
                              style={{ flex: 1, height: 40, borderRadius: 10, border: "none",
                                background: "rgba(62,207,110,0.12)",
                                outline: "1px solid rgba(62,207,110,0.3)",
                                color: "#3ecf6e", fontSize: 11, fontWeight: 700,
                                fontFamily: "Lexend", cursor: "pointer" }}>
                              📦 Đã xong · Tìm tài xế
                            </button>
                          )}
                          {order.status === "ready" && (
                            <div style={{ flex: 1, height: 40, borderRadius: 10,
                              background: "rgba(62,207,110,0.06)",
                              border: "1px solid rgba(62,207,110,0.2)",
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
          })}

          {activeOrders.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 12 }}>
              😌 Không có đơn hàng nào đang xử lý
            </div>
          )}

          {/* Nav links */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
            {[
              { href: "/merchant/menu",       icon: "🍽️", label: "Quản lý menu"   },
              { href: "/merchant/revenue",    icon: "📊", label: "Doanh thu"       },
              { href: "/merchant/promotions", icon: "🎁", label: "Khuyến mãi"     },
              { href: "/merchant/profile",    icon: "⚙️", label: "Cài đặt quán"  },
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
    </>
  )
}
