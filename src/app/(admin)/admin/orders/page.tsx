"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled"
type PayMethod   = "cash" | "vietqr" | "momo"

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

interface ManItem { productId: string; name: string; price: number; qty: number }

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

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
}

export default function AdminOrdersPage() {
  const [filter,   setFilter]   = useState<"all" | OrderStatus>("all")
  const [selected, setSelected] = useState<Order | null>(null)
  const [search,   setSearch]   = useState("")
  const [orders,   setOrders]   = useState<Order[]>([])
  const [loading,  setLoading]  = useState(true)
  const [adminId,  setAdminId]  = useState("")

  /* ── Manual order creation ── */
  const [showCreate,    setShowCreate]    = useState(false)
  const [createStep,    setCreateStep]    = useState(1)
  const [custPhone,     setCustPhone]     = useState("")
  const [custId,        setCustId]        = useState("")
  const [custName,      setCustName]      = useState("")
  const [custSearching, setCustSearching] = useState(false)
  const [custMsg,       setCustMsg]       = useState("")
  const [delivAddr,     setDelivAddr]     = useState("")
  const [manShopId,     setManShopId]     = useState("")
  const [manShopName,   setManShopName]   = useState("")
  const [manPayment,    setManPayment]    = useState<PayMethod>("cash")
  const [manNote,       setManNote]       = useState("")
  const [manItems,      setManItems]      = useState<ManItem[]>([])
  const [shopList,      setShopList]      = useState<{id:string;name:string}[]>([])
  const [productList,   setProductList]   = useState<{id:string;name:string;price:number}[]>([])
  const [creating,      setCreating]      = useState(false)
  const [createMsg,     setCreateMsg]     = useState("")

  /* ── Load orders from Supabase ── */
  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
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
      const shops    = r.shops as unknown
      const shopName = Array.isArray(shops) ? (shops[0] as { name: string })?.name ?? "—" : (shops as { name: string } | null)?.name ?? "—"
      const items    = r.order_items as unknown[]
      return {
        id: r.id, status: r.status as OrderStatus,
        total_amount: r.total_amount, delivery_address: r.delivery_address,
        created_at: r.created_at, customer_id: r.customer_id, driver_id: r.driver_id,
        shopName, itemCount: items?.length ?? 0,
        customerName: profMap[r.customer_id] ?? "Khách hàng",
        driverName: r.driver_id ? (drvMap[r.driver_id] ?? null) : null,
      }
    }))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    createClient().auth.getUser().then(({ data }) => setAdminId(data.user?.id ?? ""))
  }, [load])

  /* ── Manual order helpers ── */
  const searchCustomer = async () => {
    if (!custPhone.trim()) return
    setCustSearching(true); setCustMsg("")
    const supabase = createClient()
    const phone = custPhone.trim().replace(/\s/g, "")
    const { data } = await supabase.from("profiles").select("id,full_name").eq("phone", phone).maybeSingle()
    if (data) {
      setCustId(data.id); setCustName(data.full_name ?? "Khách hàng")
      setCustMsg(`✅ ${data.full_name ?? "Khách hàng"}`)
    } else {
      setCustId(""); setCustName("")
      setCustMsg("⚠️ Không tìm thấy — đơn sẽ dùng tài khoản admin")
    }
    setCustSearching(false)
  }

  const loadShops = useCallback(async () => {
    const { data } = await createClient().from("shops").select("id,name").eq("status","approved").order("name")
    setShopList(data ?? [])
  }, [])

  const loadProducts = async (shopId: string) => {
    setProductList([])
    const { data } = await createClient().from("products").select("id,name,price").eq("shop_id", shopId).eq("is_available", true).order("sort_order")
    setProductList(data ?? [])
  }

  const addItem = (p: {id:string;name:string;price:number}) => {
    setManItems(prev => {
      const exist = prev.find(i => i.productId === p.id)
      if (exist) return prev.map(i => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }

  const changeQty = (productId: string, delta: number) => {
    setManItems(prev => prev.flatMap(i => {
      if (i.productId !== productId) return [i]
      const newQty = i.qty + delta
      return newQty <= 0 ? [] : [{ ...i, qty: newQty }]
    }))
  }

  const manSubtotal = manItems.reduce((s, i) => s + i.price * i.qty, 0)
  const manTotal    = manSubtotal + 15000

  const submitManualOrder = async () => {
    const effectiveCustId = custId || adminId
    if (!effectiveCustId) { setCreateMsg("⚠️ Chưa xác định khách hàng"); return }
    if (!manShopId)        { setCreateMsg("⚠️ Chưa chọn cửa hàng"); return }
    if (manItems.length === 0) { setCreateMsg("⚠️ Chưa chọn món nào"); return }
    if (!delivAddr.trim()) { setCreateMsg("⚠️ Chưa nhập địa chỉ giao"); return }

    setCreating(true); setCreateMsg("")
    const supabase = createClient()

    const { data: order, error: oe } = await supabase.from("orders").insert({
      customer_id: effectiveCustId,
      shop_id: manShopId,
      status: "pending",
      delivery_address: delivAddr,
      delivery_lat: 12.6521,
      delivery_lng: 108.5073,
      subtotal: manSubtotal,
      delivery_fee: 15000,
      discount_amount: 0,
      total_amount: manTotal,
      payment_method: manPayment,
      note: (manNote || null) as string | null,
    }).select("id").single()

    if (oe || !order) {
      setCreateMsg("❌ Lỗi: " + (oe?.message ?? "Không thể tạo đơn"))
      setCreating(false); return
    }

    await supabase.from("order_items").insert(
      manItems.map(it => ({
        order_id: order.id,
        product_id: it.productId,
        name: it.name,
        price: it.price,
        quantity: it.qty,
        subtotal: it.price * it.qty,
      }))
    )

    setCreateMsg(`✅ Đã tạo đơn #${order.id.slice(0,8).toUpperCase()}`)
    setTimeout(async () => {
      setShowCreate(false); setCreateStep(1)
      setCustPhone(""); setCustId(""); setCustName(""); setCustMsg("")
      setDelivAddr(""); setManShopId(""); setManShopName("")
      setManItems([]); setManPayment("cash"); setManNote(""); setCreateMsg("")
      setCreating(false)
      await load()
    }, 1200)
  }

  const resetCreate = () => {
    setShowCreate(false); setCreateStep(1)
    setCustPhone(""); setCustId(""); setCustName(""); setCustMsg("")
    setDelivAddr(""); setManShopId(""); setManShopName("")
    setManItems([]); setManPayment("cash"); setManNote(""); setCreateMsg("")
  }

  /* ── Cancel order ── */
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

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        input,textarea,select{outline:none;font-family:'Lexend',sans-serif}
        select option{background:#1a1208;color:#f8f0e0}
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
            <button onClick={() => { setShowCreate(true); loadShops() }}
              style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#FF6B00,#FF8C00)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: "pointer", boxShadow: "0 4px 14px rgba(255,107,0,0.4)", flexShrink: 0 }}>
              +
            </button>
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

        {/* Orders list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 100px" }}>
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

        {/* Order detail modal */}
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

        {/* ── MANUAL ORDER CREATION MODAL ── */}
        <AnimatePresence>
          {showCreate && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={resetCreate} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 60, backdropFilter: "blur(6px)" }} />
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 24, stiffness: 280 }}
                style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0e0c09", borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,107,0,0.2)", zIndex: 61, maxHeight: "92dvh", display: "flex", flexDirection: "column" }}
              >
                {/* Modal header */}
                <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                      <div style={{ color: "#FF8C00", fontSize: 15, fontWeight: 800 }}>📋 Tạo đơn thủ công</div>
                      <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 2 }}>Bước {createStep}/3</div>
                    </div>
                    <button onClick={resetCreate} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: "#6a5a40", fontSize: 18, cursor: "pointer" }}>×</button>
                  </div>
                  {/* Step indicator */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                    {["Khách hàng", "Món ăn", "Xác nhận"].map((s, i) => (
                      <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                        <div style={{ height: 3, width: "100%", borderRadius: 2, background: i + 1 <= createStep ? "linear-gradient(90deg,#FF6B00,#FF8C00)" : "rgba(255,255,255,0.08)" }} />
                        <span style={{ fontSize: 8, color: i + 1 <= createStep ? "#FF8C00" : "#6a5a40", fontWeight: i + 1 === createStep ? 700 : 400 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>

                  {/* STEP 1 — Customer + Address */}
                  {createStep === 1 && (
                    <div>
                      <div style={{ color: "#f0eaff", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Tìm khách hàng theo SĐT</div>

                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input
                          type="tel" value={custPhone} onChange={e => setCustPhone(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && searchCustomer()}
                          placeholder="0901234567"
                          style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f0eaff", fontSize: 13 }}
                        />
                        <button onClick={searchCustomer} disabled={custSearching}
                          style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(255,107,0,0.15)", border: "1px solid rgba(255,107,0,0.35)", color: "#FF8C00", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend", whiteSpace: "nowrap" }}>
                          {custSearching ? "..." : "🔍 Tìm"}
                        </button>
                      </div>

                      {custMsg && (
                        <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: custMsg.startsWith("✅") ? "rgba(62,207,110,0.08)" : "rgba(255,179,71,0.08)", border: `1px solid ${custMsg.startsWith("✅") ? "rgba(62,207,110,0.25)" : "rgba(255,179,71,0.25)"}`, color: custMsg.startsWith("✅") ? "#3ecf6e" : "#FFB347", fontSize: 11 }}>
                          {custMsg}
                        </div>
                      )}

                      <div style={{ color: "#f0eaff", fontSize: 12, fontWeight: 700, marginBottom: 8, marginTop: 16 }}>Địa chỉ giao hàng <span style={{ color: "#ff4040" }}>*</span></div>
                      <textarea
                        value={delivAddr} onChange={e => setDelivAddr(e.target.value)}
                        placeholder="Số nhà, tên đường, thôn/xã..."
                        rows={3}
                        style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f0eaff", fontSize: 12, resize: "none" }}
                      />

                      <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.15)" }}>
                        <div style={{ color: "#6a5a40", fontSize: 10, lineHeight: 1.6 }}>
                          💡 Nếu không tìm thấy SĐT → đơn sẽ được ghi dưới tài khoản admin để test.<br />
                          Địa chỉ bắt buộc nhập để tài xế biết điểm giao.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2 — Shop + Items */}
                  {createStep === 2 && (
                    <div>
                      <div style={{ color: "#f0eaff", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Chọn cửa hàng <span style={{ color: "#ff4040" }}>*</span></div>
                      <select
                        value={manShopId}
                        onChange={e => {
                          const opt = e.target.options[e.target.selectedIndex]
                          setManShopId(e.target.value)
                          setManShopName(opt.text)
                          setManItems([])
                          if (e.target.value) loadProducts(e.target.value)
                        }}
                        style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: manShopId ? "#f0eaff" : "#6a5a40", fontSize: 12, marginBottom: 16 }}
                      >
                        <option value="">— Chọn cửa hàng —</option>
                        {shopList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>

                      {manShopId && productList.length === 0 && (
                        <div style={{ textAlign: "center", color: "#6a5a40", fontSize: 11, padding: "16px 0" }}>Đang tải menu...</div>
                      )}

                      {productList.length > 0 && (
                        <>
                          <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 8 }}>Nhấn "+" để thêm vào đơn</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                            {productList.map(p => {
                              const inCart = manItems.find(i => i.productId === p.id)
                              return (
                                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: inCart ? "rgba(255,107,0,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${inCart ? "rgba(255,107,0,0.25)" : "rgba(255,255,255,0.07)"}` }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ color: "#f0eaff", fontSize: 11, fontWeight: 600 }}>{p.name}</div>
                                    <div style={{ color: "#FF8C00", fontSize: 10, fontWeight: 700 }}>{fmt(p.price)}</div>
                                  </div>
                                  {inCart ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <button onClick={() => changeQty(p.id, -1)} style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,64,64,0.12)", border: "1px solid rgba(255,64,64,0.25)", color: "#ff4040", fontSize: 14, cursor: "pointer" }}>−</button>
                                      <span style={{ color: "#f0eaff", fontSize: 12, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{inCart.qty}</span>
                                      <button onClick={() => changeQty(p.id, 1)} style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.25)", color: "#FF8C00", fontSize: 14, cursor: "pointer" }}>+</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => addItem(p)} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,107,0,0.15)", border: "1px solid rgba(255,107,0,0.3)", color: "#FF8C00", fontSize: 16, cursor: "pointer" }}>+</button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}

                      {manItems.length > 0 && (
                        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(62,207,110,0.06)", border: "1px solid rgba(62,207,110,0.2)" }}>
                          <div style={{ color: "#3ecf6e", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                            ✅ {manItems.reduce((s, i) => s + i.qty, 0)} món · Tạm tính: {fmt(manSubtotal)}
                          </div>
                          {manItems.map(i => (
                            <div key={i.productId} style={{ color: "#6a5a40", fontSize: 9 }}>
                              {i.name} × {i.qty} = {fmt(i.price * i.qty)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 3 — Confirm */}
                  {createStep === 3 && (
                    <div>
                      <div style={{ color: "#f0eaff", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Xác nhận đơn hàng</div>

                      {/* Summary */}
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px", marginBottom: 14 }}>
                        {[
                          ["Khách hàng",   custName || "Tài khoản admin"],
                          ["Địa chỉ",      delivAddr],
                          ["Cửa hàng",     manShopName],
                          ["Số món",       `${manItems.reduce((s,i) => s+i.qty, 0)} món`],
                          ["Phí giao",     fmt(15000)],
                          ["Tổng cộng",    fmt(manTotal)],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <span style={{ color: "#6a5a40", fontSize: 10 }}>{k}</span>
                            <span style={{ color: k === "Tổng cộng" ? "#FF8C00" : "#f0eaff", fontSize: 10, fontWeight: k === "Tổng cộng" ? 800 : 600, textAlign: "right", maxWidth: "60%" }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Payment method */}
                      <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 8 }}>Phương thức thanh toán</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                        {([["cash","💵 Tiền mặt"],["vietqr","🏦 VietQR"],["momo","💜 MoMo"]] as const).map(([m, label]) => (
                          <button key={m} onClick={() => setManPayment(m)}
                            style={{ flex: 1, padding: "8px 4px", borderRadius: 9, fontSize: 10, fontWeight: manPayment === m ? 700 : 400, cursor: "pointer", fontFamily: "Lexend", background: manPayment === m ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: manPayment === m ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: manPayment === m ? "#FF8C00" : "#6a5a40" }}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Note */}
                      <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>Ghi chú (tuỳ chọn)</div>
                      <textarea value={manNote} onChange={e => setManNote(e.target.value)} placeholder="Ghi chú cho đơn hàng..." rows={2}
                        style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0eaff", fontSize: 12, resize: "none", marginBottom: 16 }} />

                      {createMsg && (
                        <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: createMsg.startsWith("✅") ? "rgba(62,207,110,0.08)" : "rgba(255,64,64,0.08)", color: createMsg.startsWith("✅") ? "#3ecf6e" : "#ff4040", fontSize: 11, border: `1px solid ${createMsg.startsWith("✅") ? "rgba(62,207,110,0.25)" : "rgba(255,64,64,0.25)"}` }}>
                          {createMsg}
                        </div>
                      )}

                      <button onClick={submitManualOrder} disabled={creating}
                        style={{ width: "100%", height: 48, borderRadius: 14, background: creating ? "rgba(255,107,0,0.3)" : "linear-gradient(90deg,#FF6B00,#FF8C00)", border: "none", color: "#fff", fontSize: 14, fontWeight: 800, cursor: creating ? "not-allowed" : "pointer", fontFamily: "Lexend", boxShadow: creating ? "none" : "0 4px 20px rgba(255,107,0,0.35)" }}>
                        {creating ? "⏳ Đang tạo đơn..." : `✅ Tạo đơn · ${fmt(manTotal)}`}
                      </button>
                    </div>
                  )}
                </div>

                {/* Navigation buttons */}
                <div style={{ padding: "12px 20px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, flexShrink: 0 }}>
                  {createStep > 1 && (
                    <button onClick={() => setCreateStep(s => s - 1)}
                      style={{ flex: 1, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0eaff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>
                      ← Quay lại
                    </button>
                  )}
                  {createStep < 3 && (
                    <button
                      disabled={
                        (createStep === 1 && !delivAddr.trim()) ||
                        (createStep === 2 && (manItems.length === 0 || !manShopId))
                      }
                      onClick={() => setCreateStep(s => s + 1)}
                      style={{ flex: 2, height: 44, borderRadius: 12, background: "linear-gradient(90deg,#FF6B00,#FF8C00)", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Lexend", opacity: (createStep === 1 && !delivAddr.trim()) || (createStep === 2 && (manItems.length === 0 || !manShopId)) ? 0.4 : 1 }}>
                      Tiếp theo →
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
