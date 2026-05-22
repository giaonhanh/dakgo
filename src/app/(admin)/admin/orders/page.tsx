"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled"

interface Order {
  id: string
  status: OrderStatus
  total_amount: number
  delivery_address: string
  created_at: string
  customer_id: string
  driver_id: string | null
  shopName: string
  itemCount: number
  customerName: string
  driverName: string | null
}

const STATUS_CFG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: "Chờ xử lý",  color: "#FFB347", bg: "rgba(255,179,71,0.1)"   },
  accepted:   { label: "Đã nhận",    color: "#4a8ff5", bg: "rgba(74,143,245,0.1)"   },
  preparing:  { label: "Đang nấu",   color: "#4a8ff5", bg: "rgba(74,143,245,0.1)"   },
  ready:      { label: "Sẵn sàng",   color: "#3ecf6e", bg: "rgba(62,207,110,0.1)"   },
  delivering: { label: "Đang giao",  color: "#FF8C00", bg: "rgba(255,140,0,0.1)"    },
  delivered:  { label: "Đã giao",    color: "#3ecf6e", bg: "rgba(62,207,110,0.1)"   },
  cancelled:  { label: "Đã hủy",     color: "#ff4040", bg: "rgba(255,64,64,0.1)"    },
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<"all" | OrderStatus>("all")
  const [selected, setSelected] = useState<Order | null>(null)
  const [search, setSearch] = useState("")
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: rows, error } = await supabase
        .from("orders")
        .select("id, status, total_amount, delivery_address, created_at, customer_id, driver_id, shops!shop_id(name), order_items(id)")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error || !rows) { setLoading(false); return }

      const custIds = [...new Set(rows.map(r => r.customer_id).filter(Boolean))]
      const drvIds  = [...new Set(rows.map(r => r.driver_id).filter(Boolean) as string[])]

      const [{ data: profiles }, { data: driverProfiles }] = await Promise.all([
        custIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", custIds) : Promise.resolve({ data: [] }),
        drvIds.length  > 0 ? supabase.from("profiles").select("id, full_name").in("id", drvIds)  : Promise.resolve({ data: [] }),
      ])

      const profMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name ?? "Khách hàng"]))
      const drvMap  = Object.fromEntries((driverProfiles ?? []).map(p => [p.id, p.full_name ?? "Tài xế"]))

      setOrders(rows.map(r => {
        const shops = r.shops as unknown
        const shopName = Array.isArray(shops) ? (shops[0] as { name: string })?.name ?? "—" : (shops as { name: string } | null)?.name ?? "—"
        const items = r.order_items as unknown[]
        return {
          id: r.id,
          status: r.status as OrderStatus,
          total_amount: r.total_amount,
          delivery_address: r.delivery_address,
          created_at: r.created_at,
          customer_id: r.customer_id,
          driver_id: r.driver_id,
          shopName,
          itemCount: items?.length ?? 0,
          customerName: profMap[r.customer_id] ?? "Khách hàng",
          driverName: r.driver_id ? (drvMap[r.driver_id] ?? null) : null,
        }
      }))
      setLoading(false)
    }
    load()
  }, [])

  const handleCancel = async (orderId: string) => {
    const supabase = createClient()
    await supabase.from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", orderId)
    setOrders(p => p.map(o => o.id === orderId ? { ...o, status: "cancelled" as OrderStatus } : o))
    if (selected?.id === orderId) setSelected(p => p ? { ...p, status: "cancelled" } : p)
  }

  const shown = orders
    .filter(o => filter === "all" || o.status === filter)
    .filter(o => !search ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.shopName.toLowerCase().includes(search.toLowerCase())
    )

  const todayTotal = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.total_amount, 0)

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
  }

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        input{outline:none;font-family:'Lexend',sans-serif}
      `}</style>
      <div style={{ position: "fixed", inset: 0, background: "#080806", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "52px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <a href="/admin" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#f8f0e0", fontSize: 16 }}>←</a>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 16, fontWeight: 800 }}>Quản lý đơn hàng</div>
              <div style={{ color: "#6a5a40", fontSize: 9 }}>
                {loading ? "Đang tải..." : `${orders.length} đơn · ${fmt(todayTotal)}`}
              </div>
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <span style={{ color: "#6a5a40", fontSize: 14 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã đơn, khách hàng, quán..." style={{ flex: 1, background: "none", border: "none", color: "#f8f0e0", fontSize: 11 }} />
          </div>

          <div style={{ display: "flex", gap: 5, overflowX: "auto" }}>
            {(["all", "pending", "accepted", "preparing", "ready", "delivering", "delivered", "cancelled"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 8, background: filter === f ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: filter === f ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.06)", color: filter === f ? "#FF8C00" : "#6a5a40", fontSize: 9, fontWeight: filter === f ? 700 : 400, cursor: "pointer", fontFamily: "Lexend", whiteSpace: "nowrap" }}>
                {f === "all" ? "Tất cả" : STATUS_CFG[f].label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 20px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 11 }}>Đang tải đơn hàng...</div>
          ) : shown.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 11 }}>Không tìm thấy đơn hàng nào</div>
          ) : shown.map(order => {
            const cfg = STATUS_CFG[order.status]
            return (
              <div key={order.id} onClick={() => setSelected(order)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, marginBottom: 8, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "#FF8C00", fontSize: 12, fontWeight: 800 }}>#{order.id.slice(0, 8).toUpperCase()}</span>
                    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 6, padding: "2px 7px", fontSize: 8, fontWeight: 700 }}>{cfg.label}</span>
                  </div>
                  <span style={{ color: "#6a5a40", fontSize: 9 }}>{fmtTime(order.created_at)}</span>
                </div>
                <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 600, marginBottom: 3 }}>{order.customerName}</div>
                <div style={{ color: "#6a5a40", fontSize: 9, marginBottom: 3 }}>🏪 {order.shopName} · {order.itemCount} món</div>
                <div style={{ color: "#6a5a40", fontSize: 9, marginBottom: 6 }}>📍 {order.delivery_address}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: "#6a5a40", fontSize: 9 }}>
                    {order.driverName ? `🛵 ${order.driverName}` : "⏳ Chưa có tài xế"}
                  </div>
                  <span style={{ background: "linear-gradient(90deg,#FF6B00,#FFB347)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontSize: 13, fontWeight: 800 }}>{fmt(order.total_amount)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detail modal */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, backdropFilter: "blur(4px)" }} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 22, stiffness: 300 }} style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0e0c09", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.08)", padding: "20px 16px 32px", zIndex: 51 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ color: "#FF8C00", fontSize: 16, fontWeight: 800 }}>#{selected.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ color: "#6a5a40", fontSize: 9 }}>{fmtTime(selected.created_at)} · {STATUS_CFG[selected.status].label}</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
                </div>
                {[
                  ["Khách hàng",    selected.customerName],
                  ["Cửa hàng",     selected.shopName],
                  ["Tài xế",       selected.driverName ?? "Chưa phân công"],
                  ["Địa chỉ giao", selected.delivery_address],
                  ["Số món",       `${selected.itemCount} món`],
                  ["Tổng tiền",    fmt(selected.total_amount)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color: "#6a5a40", fontSize: 9, flexShrink: 0 }}>{k}</span>
                    <span style={{ color: "#f8f0e0", fontSize: 9, fontWeight: 600, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
                {(selected.status === "pending" || selected.status === "preparing" || selected.status === "accepted") && (
                  <button onClick={() => handleCancel(selected.id)} style={{ width: "100%", height: 44, borderRadius: 12, background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend", marginTop: 8 }}>
                    ❌ Hủy đơn
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
