"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatPrice } from "@/lib/utils"

type Status = "all" | "delivered" | "cancelled" | "pending" | "preparing" | "accepted" | "ready"
type Period = "today" | "week" | "month" | "all"

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; bd: string }> = {
  pending:    { label: "Chờ xác nhận",  color: "#f5c542", bg: "rgba(245,197,66,0.12)",  bd: "rgba(245,197,66,0.3)"  },
  accepted:   { label: "Đã xác nhận",   color: "#4a8ff5", bg: "rgba(74,143,245,0.12)",  bd: "rgba(74,143,245,0.3)"  },
  preparing:  { label: "Đang chuẩn bị", color: "#4a8ff5", bg: "rgba(74,143,245,0.12)",  bd: "rgba(74,143,245,0.3)"  },
  ready:      { label: "Sẵn sàng giao", color: "#3ecf6e", bg: "rgba(62,207,110,0.12)",  bd: "rgba(62,207,110,0.25)" },
  delivering: { label: "Đang giao",     color: "#b464ff", bg: "rgba(180,100,255,0.12)", bd: "rgba(180,100,255,0.3)" },
  delivered:  { label: "Hoàn thành",    color: "#3ecf6e", bg: "rgba(62,207,110,0.12)",  bd: "rgba(62,207,110,0.25)" },
  cancelled:  { label: "Đã huỷ",        color: "#ff4040", bg: "rgba(255,64,64,0.10)",   bd: "rgba(255,64,64,0.25)"  },
}

const PAY_LABEL: Record<string, string> = {
  cash: "Tiền mặt", vietqr: "VietQR", momo: "MoMo", zalopay: "ZaloPay", wallet: "Ví"
}

const STATUS_TABS: { key: Status; label: string }[] = [
  { key: "all",       label: "Tất cả"     },
  { key: "delivered", label: "Hoàn thành" },
  { key: "cancelled", label: "Đã huỷ"    },
  { key: "pending",   label: "Chờ xác nhận" },
  { key: "preparing", label: "Đang làm"  },
]

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: "today", label: "Hôm nay"  },
  { key: "week",  label: "Tuần này" },
  { key: "month", label: "Tháng này"},
  { key: "all",   label: "Tất cả"   },
]

interface OrderRow {
  id: string
  shortId: string
  createdAt: string
  status: string
  payMethod: string
  total: number
  deliveryFee: number
  discountAmount: number
  items: string
  note: string | null
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const hm = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
  const date = `${d.getDate()}/${d.getMonth()+1}`
  return { hm, date }
}

function getPeriodStart(period: Period): Date | null {
  const now = new Date()
  if (period === "today") {
    const d = new Date(now); d.setHours(0,0,0,0); return d
  }
  if (period === "week") {
    const d = new Date(now); d.setDate(now.getDate() - 6); d.setHours(0,0,0,0); return d
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return null
}

const PAGE_SIZE = 20

export default function MerchantOrdersPage() {
  const supabase = createClient()

  const [shopId,    setShopId]    = useState<string | null>(null)
  const [shopName,  setShopName]  = useState("")
  const [loading,   setLoading]   = useState(true)
  const [orders,    setOrders]    = useState<OrderRow[]>([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(0)
  const [hasMore,   setHasMore]   = useState(false)
  const [status,    setStatus]    = useState<Status>("all")
  const [period,    setPeriod]    = useState<Period>("today")
  const [expand,    setExpand]    = useState<string | null>(null)
  const [summary,   setSummary]   = useState({ count: 0, revenue: 0, cancelled: 0 })
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Load shop ────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: shop } = await supabase
        .from("shops").select("id,name").eq("owner_id", user.id).maybeSingle()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)
      setShopName(shop.name ?? "")
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fetch orders ─────────────────────────────────────────────
  const fetchOrders = useCallback(async (sid: string, pg: number) => {
    setLoading(true)
    try {
      const start = getPeriodStart(period)

      let q = supabase
        .from("orders")
        .select("id,status,total_amount,delivery_fee,discount_amount,pay_method,note,created_at", { count: "exact" })
        .eq("shop_id", sid)
        .order("created_at", { ascending: false })
        .range(pg * PAGE_SIZE, pg * PAGE_SIZE + PAGE_SIZE - 1)

      if (status !== "all") q = q.eq("status", status)
      if (start)            q = q.gte("created_at", start.toISOString())

      const { data: rows, count, error } = await q
      if (error || !rows) { setLoading(false); return }

      const orderIds = rows.map(r => r.id)
      let itemMap = new Map<string, string>()

      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("order_id,name,qty")
          .in("order_id", orderIds)

        for (const it of items ?? []) {
          const prev = itemMap.get(it.order_id)
          const entry = `${it.name} ×${it.qty ?? 1}`
          itemMap.set(it.order_id, prev ? prev + ", " + entry : entry)
        }
      }

      const mapped: OrderRow[] = rows.map(r => ({
        id:             r.id,
        shortId:        r.id.slice(-6).toUpperCase(),
        createdAt:      r.created_at,
        status:         r.status,
        payMethod:      r.pay_method ?? "cash",
        total:          r.total_amount ?? 0,
        deliveryFee:    r.delivery_fee ?? 0,
        discountAmount: r.discount_amount ?? 0,
        items:          itemMap.get(r.id) ?? "—",
        note:           r.note ?? null,
      }))

      if (pg === 0) {
        setOrders(mapped)
      } else {
        setOrders(prev => [...prev, ...mapped])
      }

      const totalCount = count ?? 0
      setTotal(totalCount)
      setHasMore((pg + 1) * PAGE_SIZE < totalCount)

      // Summary for all delivered / cancelled in period
      let sqDel = supabase
        .from("orders").select("total_amount", { count: "exact" })
        .eq("shop_id", sid).eq("status", "delivered")
      let sqCan = supabase
        .from("orders").select("id", { count: "exact" })
        .eq("shop_id", sid).eq("status", "cancelled")
      if (start) { sqDel = sqDel.gte("created_at", start.toISOString()); sqCan = sqCan.gte("created_at", start.toISOString()) }

      const [{ data: dOrders }, { count: cCount }] = await Promise.all([sqDel, sqCan])
      const rev = (dOrders ?? []).reduce((s: number, o: { total_amount: number | null }) => s + (o.total_amount ?? 0), 0)
      setSummary({ count: totalCount, revenue: rev, cancelled: cCount ?? 0 })
    } finally {
      setLoading(false)
    }
  }, [supabase, status, period])

  useEffect(() => {
    if (!shopId) return
    setPage(0)
    setOrders([])
    fetchOrders(shopId, 0)
  }, [shopId, status, period, fetchOrders])

  // ── Realtime: đơn mới / đổi status ────────────────────────────
  useEffect(() => {
    if (!shopId) return
    channelRef.current?.unsubscribe()
    const ch = supabase
      .channel(`merchant-orders-${shopId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "orders",
        filter: `shop_id=eq.${shopId}`,
      }, () => {
        setPage(0); setOrders([]); fetchOrders(shopId, 0)
      })
      .subscribe()
    channelRef.current = ch
    return () => { ch.unsubscribe(); channelRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId])

  // ── Đổi trạng thái đơn ────────────────────────────────────────
  const updateStatus = async (orderId: string, nextStatus: string) => {
    setUpdatingId(orderId)
    await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o))
    setUpdatingId(null)
  }

  function loadMore() {
    if (!shopId) return
    const next = page + 1
    setPage(next)
    fetchOrders(shopId, next)
  }

  const fmt = (n: number) => formatPrice(n)

  return (
    <div style={{ minHeight: "100dvh", background: "#080806", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: "env(safe-area-inset-top) 16px 0", paddingTop: `max(env(safe-area-inset-top), 12px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 8, paddingBottom: 16 }}>
          <a href="/merchant" style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            textDecoration: "none", fontSize: 16, color: "#f8f0e0", flexShrink: 0
          }}>←</a>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f8f0e0", fontSize: 16, fontWeight: 800 }}>Lịch sử đơn hàng</div>
            <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 1 }}>{shopName}</div>
          </div>
        </div>

        {/* Period filter */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
          {PERIOD_TABS.map(t => (
            <button key={t.key} onClick={() => setPeriod(t.key)} style={{
              flexShrink: 0, padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
              border: "1px solid",
              background: period === t.key ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)",
              borderColor: period === t.key ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.08)",
              color: period === t.key ? "#FF8C00" : "#6a5a40",
              cursor: "pointer",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Status filter */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12 }}>
          {STATUS_TABS.map(t => (
            <button key={t.key} onClick={() => setStatus(t.key)} style={{
              flexShrink: 0, padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
              border: "1px solid",
              background: status === t.key ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)",
              borderColor: status === t.key ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.08)",
              color: status === t.key ? "#FF8C00" : "#6a5a40",
              cursor: "pointer",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { icon: "📋", label: "Tổng đơn", value: String(summary.count), color: "#f8f0e0" },
            { icon: "💰", label: "Doanh thu", value: summary.revenue >= 1000 ? Math.round(summary.revenue/1000)+"k" : "0đ", color: "#FF8C00" },
            { icon: "❌", label: "Đã huỷ",   value: String(summary.cancelled), color: "#ff4040" },
          ].map(c => (
            <div key={c.label} style={{
              padding: "10px 8px", borderRadius: 12,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 18 }}>{c.icon}</div>
              <div style={{ color: c.color, fontSize: 15, fontWeight: 800, marginTop: 2 }}>{c.value}</div>
              <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 1 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Order count */}
        {!loading && (
          <div style={{ color: "#6a5a40", fontSize: 11, marginBottom: 8 }}>
            {total > 0 ? `${total} đơn hàng` : "Không có đơn hàng"}
          </div>
        )}

        {/* Orders list */}
        {loading && orders.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                height: 88, borderRadius: 14, background: "rgba(255,255,255,0.04)",
                animation: "pulse 1.5s infinite"
              }} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div style={{
            padding: 40, textAlign: "center", borderRadius: 16,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)"
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ color: "#6a5a40", fontSize: 13 }}>Chưa có đơn hàng nào</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orders.map(order => {
              const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.pending
              const { hm, date } = fmtDateTime(order.createdAt)
              const isOpen = expand === order.id
              const subtotal = order.total - order.deliveryFee

              return (
                <div key={order.id}
                  onClick={() => setExpand(isOpen ? null : order.id)}
                  style={{
                    borderRadius: 14, overflow: "hidden",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                  }}>
                  {/* Main row */}
                  <div style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {/* Status dot */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: cfg.bg, border: `1px solid ${cfg.bd}`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16
                    }}>
                      {order.status === "delivered" ? "✅" : order.status === "cancelled" ? "❌" : order.status === "pending" ? "⏳" : "🍳"}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <span style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 700 }}>
                          #{order.shortId}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                          background: cfg.bg, border: `1px solid ${cfg.bd}`, color: cfg.color, flexShrink: 0
                        }}>{cfg.label}</span>
                      </div>

                      <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {order.items}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                        <span style={{ color: "#FF8C00", fontSize: 13, fontWeight: 800 }}>{fmt(order.total)}</span>
                        <span style={{ color: "#6a5a40", fontSize: 10 }}>{hm} · {date}</span>
                      </div>
                    </div>

                    <div style={{ color: "#6a5a40", fontSize: 14, flexShrink: 0, marginTop: 8 }}>
                      {isOpen ? "▲" : "▼"}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{
                      borderTop: "1px solid rgba(255,255,255,0.07)",
                      padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6
                    }}>
                      {/* Items full */}
                      <div>
                        <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 4 }}>Món đặt</div>
                        <div style={{ color: "#b0956a", fontSize: 12, lineHeight: 1.6 }}>{order.items}</div>
                      </div>

                      {/* Price breakdown */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                        <Row label="Tiền hàng"    value={fmt(subtotal)} />
                        <Row label="Phí giao"     value={fmt(order.deliveryFee)} />
                        {order.discountAmount > 0 && (
                          <Row label="Giảm giá" value={`-${fmt(order.discountAmount)}`} valueColor="#3ecf6e" />
                        )}
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 4, marginTop: 2 }}>
                          <Row label="Tổng cộng" value={fmt(order.total)} valueColor="#FF8C00" bold />
                        </div>
                      </div>

                      {/* Payment */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                        <Tag icon="💳" label={PAY_LABEL[order.payMethod] ?? order.payMethod} />
                        {order.note && <Tag icon="📝" label={order.note} />}
                      </div>

                      {/* Action buttons theo trạng thái */}
                      {order.status === "pending" && (
                        <div style={{ display:"flex", gap:8, marginTop:8 }}>
                          <button
                            onClick={e => { e.stopPropagation(); updateStatus(order.id, "cancelled") }}
                            disabled={updatingId === order.id}
                            style={{ flex:1, height:38, borderRadius:10, border:"1px solid rgba(255,64,64,0.3)", background:"rgba(255,64,64,0.07)", color:"#ff6060", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", opacity: updatingId===order.id?0.5:1 }}>
                            ✕ Từ chối
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); updateStatus(order.id, "preparing") }}
                            disabled={updatingId === order.id}
                            style={{ flex:2, height:38, borderRadius:10, border:"none", background:"linear-gradient(90deg,#FF6B00,#FF8C00)", color:"#fff", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"Lexend", opacity: updatingId===order.id?0.5:1 }}>
                            {updatingId===order.id ? "..." : "✅ Xác nhận & Chuẩn bị"}
                          </button>
                        </div>
                      )}
                      {(order.status === "accepted" || order.status === "preparing") && (
                        <button
                          onClick={e => { e.stopPropagation(); updateStatus(order.id, "ready") }}
                          disabled={updatingId === order.id}
                          style={{ width:"100%", height:38, borderRadius:10, border:"none", marginTop:8, background:"linear-gradient(90deg,#3ecf6e,#2db55d)", color:"#fff", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"Lexend", opacity: updatingId===order.id?0.5:1 }}>
                          {updatingId===order.id ? "..." : "🍱 Sẵn sàng giao — Gọi tài xế đến lấy"}
                        </button>
                      )}
                      {order.status === "ready" && (
                        <div style={{ marginTop:8, padding:"8px 12px", borderRadius:10, background:"rgba(62,207,110,0.08)", border:"1px solid rgba(62,207,110,0.2)", color:"#3ecf6e", fontSize:11, fontWeight:700, textAlign:"center" }}>
                          🛵 Đang chờ tài xế đến lấy hàng...
                        </div>
                      )}
                      {order.status === "delivering" && (
                        <div style={{ marginTop:8, padding:"8px 12px", borderRadius:10, background:"rgba(180,100,255,0.08)", border:"1px solid rgba(180,100,255,0.2)", color:"#b464ff", fontSize:11, fontWeight:700, textAlign:"center" }}>
                          🛵 Tài xế đang giao hàng đến khách
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Load more */}
            {hasMore && (
              <button onClick={e => { e.stopPropagation(); loadMore() }} disabled={loading} style={{
                marginTop: 4, padding: "12px", borderRadius: 12, width: "100%",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#b0956a", fontSize: 12, fontWeight: 600, cursor: "pointer",
                opacity: loading ? 0.5 : 1
              }}>
                {loading ? "Đang tải..." : "Xem thêm"}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.4 }
        }
      `}</style>
    </div>
  )
}

function Row({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "#6a5a40", fontSize: 11 }}>{label}</span>
      <span style={{ color: valueColor ?? "#b0956a", fontSize: 11, fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  )
}

function Tag({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
      borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)"
    }}>
      <span style={{ fontSize: 11 }}>{icon}</span>
      <span style={{ color: "#b0956a", fontSize: 10 }}>{label}</span>
    </div>
  )
}
