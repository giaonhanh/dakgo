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
  customer_address: string
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  accepted:   { label: "Đã nhận",    color: "#FF8C00", bg: "rgba(255,140,0,0.12)" },
  delivering: { label: "Đang giao",  color: "#4a8ff5", bg: "rgba(74,143,245,0.12)" },
  delivered:  { label: "Hoàn thành", color: "#3ecf6e", bg: "rgba(62,207,110,0.12)" },
  cancelled:  { label: "Đã huỷ",     color: "#6a5a40", bg: "rgba(106,90,64,0.1)" },
}

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

  const [orders,  setOrders]  = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<Filter>("all")

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from("orders")
      .select(`
        id, status, ship_fee, total_amount, created_at, customer_address,
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
        customer_address: (o.customer_address as string) ?? "",
        shop_name:        shop?.name ?? "Cửa hàng",
        commission_rate:  shop?.commission_rate ?? 15,
      }
    })

    setOrders(mapped)
    setLoading(false)
  }

  const filtered = orders.filter(o => {
    if (filter === "all")       return true
    if (filter === "active")    return ["accepted","delivering"].includes(o.status)
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
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px} @keyframes pulse{0%,100%{opacity:.6}50%{opacity:.3}}`}</style>

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
              {t.key === "active" && orders.filter(o => ["accepted","delivering"].includes(o.status)).length > 0 && (
                <span style={{ marginLeft: 4, background: "#FF6B00", color: "#fff", borderRadius: 99, fontSize: 8, padding: "1px 5px" }}>
                  {orders.filter(o => ["accepted","delivering"].includes(o.status)).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 100px" }}>
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
          const isActive = ["accepted","delivering"].includes(o.status)
          return (
            <div key={o.id}
              onClick={() => isActive ? router.push(`/driver/navigate/${o.id}`) : undefined}
              style={{ marginBottom: 8, borderRadius: 14, padding: "12px 14px", cursor: isActive ? "pointer" : "default",
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
                  📍 {o.customer_address}
                </div>
                <div style={{ color: o.status === "delivered" ? "#3ecf6e" : "#b0956a", fontSize: 12, fontWeight: 800 }}>
                  {fmt(earning)}
                </div>
              </div>
              {isActive && (
                <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(62,207,110,0.08)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#3ecf6e", fontSize: 9, fontWeight: 700 }}>Đang chạy · Nhấn để xem lộ trình</span>
                  <span style={{ color: "#3ecf6e", fontSize: 12 }}>›</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 12, left: 14, right: 14, height: 56, borderRadius: 9999, zIndex: 50, background: "rgba(8,8,6,0.92)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,107,0,0.2)", boxShadow: "0 0 20px rgba(255,107,0,0.1)", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px" }}>
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
