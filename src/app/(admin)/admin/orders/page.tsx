"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

type OrderStatus  = "pending" | "accepted" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled"
type PayMethod    = "cash" | "vietqr" | "momo"
type ServiceType  = "food" | "motorbike" | "taxi" | "buy_for_me" | "deliver_for_me"

interface Order {
  id: string; status: OrderStatus; total_amount: number
  delivery_address: string; created_at: string
  customer_id: string; driver_id: string | null
  shopName: string; itemCount: number; customerName: string; driverName: string | null
}
interface ManItem  { productId: string; name: string; price: number; qty: number }
interface ShopSlot { shopId: string; shopName: string; items: ManItem[] }

type PricingMap = Record<string, { rows: string[]; extra: string }>

const EXTRA_SHOP = 5_000 // phí thêm mỗi quán (cố định)

const STATUS_CFG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: "Chờ xử lý",  color: "#FFB347", bg: "rgba(255,179,71,0.1)"  },
  accepted:   { label: "Đã nhận",    color: "#4a8ff5", bg: "rgba(74,143,245,0.1)"  },
  preparing:  { label: "Đang nấu",   color: "#4a8ff5", bg: "rgba(74,143,245,0.1)"  },
  ready:      { label: "Sẵn sàng",   color: "#3ecf6e", bg: "rgba(62,207,110,0.1)"  },
  delivering: { label: "Đang giao",  color: "#FF8C00", bg: "rgba(255,140,0,0.1)"   },
  delivered:  { label: "Đã giao",    color: "#3ecf6e", bg: "rgba(62,207,110,0.1)"  },
  cancelled:  { label: "Đã hủy",     color: "#ff4040", bg: "rgba(255,64,64,0.1)"   },
}

const SVC_META: Record<ServiceType, { label: string; icon: string; color: string; desc: string; pricingKey: string }> = {
  food:           { label:"Giao đồ ăn", icon:"🍜", color:"#FF6B00", desc:"Đặt từ 1 hoặc nhiều cửa hàng", pricingKey:"food"         },
  motorbike:      { label:"Xe ôm",      icon:"🏍️", color:"#b464ff", desc:"Đặt xe ôm di chuyển",           pricingKey:"motorbike"    },
  taxi:           { label:"Taxi",        icon:"🚗", color:"#f5c542", desc:"Đặt taxi 4-7 chỗ",              pricingKey:"taxi"         },
  buy_for_me:     { label:"Mua hộ",     icon:"🛒", color:"#3ecf6e", desc:"Tài xế mua và giao",             pricingKey:"errand"       },
  deliver_for_me: { label:"Giao hộ",    icon:"📦", color:"#4a8ff5", desc:"Giao bưu kiện, hàng hoá",        pricingKey:"errand"       },
}

// Tính phí theo bảng cước — giống hàm calcExampleFare trong settings page
function calcFeeFromPricing(distKm: number, rows: string[], extra: string): number {
  if (!rows || rows.length === 0) return 15_000
  const km = Math.max(0.5, distKm)
  let total = 0
  const fullKm = Math.ceil(km)
  for (let i = 0; i < Math.min(fullKm, 10); i++) {
    let price = 0
    for (let j = i; j >= 0; j--) {
      if (rows[j] && rows[j] !== "") { price = parseInt(rows[j]) || 0; break }
    }
    total += price
  }
  if (km > 10) total += Math.ceil(km - 10) * (parseInt(extra) || 0)
  return Math.round(total)
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`
}

export default function AdminOrdersPage() {
  const [filter,   setFilter]   = useState<"all" | OrderStatus>("all")
  const [selected, setSelected] = useState<Order | null>(null)
  const [search,   setSearch]   = useState("")
  const [orders,   setOrders]   = useState<Order[]>([])
  const [loading,  setLoading]  = useState(true)
  const [adminId,  setAdminId]  = useState("")

  // Pricing from app_settings
  const [pricing, setPricing] = useState<PricingMap | null>(null)

  /* ── Create modal state ── */
  const [showCreate,  setShowCreate]  = useState(false)
  const [step,        setStep]        = useState(1)
  const [service,     setService]     = useState<ServiceType>("food")

  // Customer
  const [custPhone,  setCustPhone]  = useState("")
  const [custId,     setCustId]     = useState("")
  const [custName,   setCustName]   = useState("")
  const [searching,  setSearching]  = useState(false)
  const [custMsg,    setCustMsg]    = useState("")

  // Addresses
  const [delivAddr,  setDelivAddr]  = useState("")
  const [pickupAddr, setPickupAddr] = useState("")

  // Distance → fee calculation
  const [distKm,     setDistKm]     = useState("2")     // admin inputs km
  const [feeOverride,setFeeOverride] = useState("")     // admin can override fee

  // Ride-specific
  const [vehicleType, setVehicleType] = useState<"motorbike"|"car">("motorbike")

  // Errand-specific
  const [itemsDesc,  setItemsDesc]  = useState("")
  const [estCost,    setEstCost]    = useState("")
  const [pkgDesc,    setPkgDesc]    = useState("")

  // Food multi-shop
  const [shopSlots,  setShopSlots]  = useState<ShopSlot[]>([{ shopId:"", shopName:"", items:[] }])
  const [activeSlot, setActiveSlot] = useState(0)
  const [shopList,   setShopList]   = useState<{id:string;name:string}[]>([])
  const [productMap, setProductMap] = useState<Record<string,{id:string;name:string;price:number}[]>>({})

  // Confirm
  const [payment,    setPayment]    = useState<PayMethod>("cash")
  const [note,       setNote]       = useState("")
  const [creating,   setCreating]   = useState(false)
  const [createMsg,  setCreateMsg]  = useState("")

  /* ── Computed fees (reactive to distKm + pricing + service) ── */
  const computedBaseFee = useCallback((): number => {
    if (!pricing) return 15_000
    const key = SVC_META[service].pricingKey
    const cfg = pricing[key]
    if (!cfg) return 15_000
    return calcFeeFromPricing(parseFloat(distKm) || 1, cfg.rows, cfg.extra)
  }, [pricing, service, distKm])

  const baseFee      = feeOverride ? parseInt(feeOverride) || 0 : computedBaseFee()
  const filledSlots  = shopSlots.filter(s => s.shopId && s.items.length > 0)
  const totalShipFee = filledSlots.length > 0
    ? baseFee + (filledSlots.length - 1) * EXTRA_SHOP
    : baseFee
  const foodSubtotal = shopSlots.reduce((s, slot) => s + slot.items.reduce((ss, it) => ss + it.price * it.qty, 0), 0)
  const foodTotal    = foodSubtotal + totalShipFee

  /* ── Load orders ── */
  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: rows, error } = await supabase
      .from("orders")
      .select("id,status,total_amount,delivery_address,created_at,customer_id,driver_id,shops!shop_id(name),order_items(id)")
      .order("created_at", { ascending: false })
      .limit(100)
    if (error || !rows) { setLoading(false); return }

    const custIds = [...new Set(rows.map(r => r.customer_id).filter(Boolean))]
    const drvIds  = [...new Set(rows.map(r => r.driver_id).filter(Boolean) as string[])]
    const [{ data: profs }, { data: drvProfs }] = await Promise.all([
      custIds.length ? supabase.from("profiles").select("id,full_name").in("id", custIds) : Promise.resolve({ data: [] }),
      drvIds.length  ? supabase.from("profiles").select("id,full_name").in("id", drvIds)  : Promise.resolve({ data: [] }),
    ])
    const pMap = Object.fromEntries((profs ?? []).map(p => [p.id, p.full_name ?? "Khách hàng"]))
    const dMap = Object.fromEntries((drvProfs ?? []).map(p => [p.id, p.full_name ?? "Tài xế"]))

    setOrders(rows.map(r => {
      const s = r.shops as unknown
      const shopName = Array.isArray(s) ? (s[0] as {name:string})?.name ?? "—" : (s as {name:string}|null)?.name ?? "—"
      return {
        id: r.id, status: r.status as OrderStatus, total_amount: r.total_amount,
        delivery_address: r.delivery_address, created_at: r.created_at,
        customer_id: r.customer_id, driver_id: r.driver_id, shopName,
        itemCount: (r.order_items as unknown[])?.length ?? 0,
        customerName: pMap[r.customer_id] ?? "Khách hàng",
        driverName: r.driver_id ? (dMap[r.driver_id] ?? null) : null,
      }
    }))
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    load()
    supabase.auth.getUser().then(({ data }) => setAdminId(data.user?.id ?? ""))
    // Load pricing settings
    supabase.from("app_settings").select("value").eq("key","pricing").maybeSingle()
      .then(({ data }) => { if (data?.value) setPricing(data.value as PricingMap) })
  }, [load])

  /* ── Helpers ── */
  const searchCustomer = async () => {
    if (!custPhone.trim()) return
    setSearching(true); setCustMsg("")
    const { data } = await createClient().from("profiles").select("id,full_name").eq("phone", custPhone.trim()).maybeSingle()
    if (data) { setCustId(data.id); setCustName(data.full_name ?? "Khách"); setCustMsg(`✅ ${data.full_name ?? "Khách hàng"}`) }
    else      { setCustId(""); setCustName(""); setCustMsg("⚠️ Không tìm thấy — dùng tài khoản admin") }
    setSearching(false)
  }

  const loadShops = useCallback(async () => {
    const { data } = await createClient().from("shops").select("id,name").eq("status","approved").order("name")
    setShopList(data ?? [])
  }, [])

  const loadProducts = async (shopId: string) => {
    if (productMap[shopId]) return
    const { data } = await createClient().from("products").select("id,name,price").eq("shop_id", shopId).eq("is_available", true).order("sort_order")
    setProductMap(p => ({ ...p, [shopId]: data ?? [] }))
  }

  const addItem = (slotIdx: number, p: {id:string;name:string;price:number}) => {
    setShopSlots(prev => prev.map((slot, i) => {
      if (i !== slotIdx) return slot
      const exist = slot.items.find(it => it.productId === p.id)
      const items = exist
        ? slot.items.map(it => it.productId === p.id ? {...it, qty: it.qty+1} : it)
        : [...slot.items, { productId:p.id, name:p.name, price:p.price, qty:1 }]
      return { ...slot, items }
    }))
  }

  const changeQty = (slotIdx: number, productId: string, delta: number) => {
    setShopSlots(prev => prev.map((slot, i) => {
      if (i !== slotIdx) return slot
      return { ...slot, items: slot.items.flatMap(it => {
        if (it.productId !== productId) return [it]
        return it.qty + delta <= 0 ? [] : [{...it, qty: it.qty+delta}]
      })}
    }))
  }

  const addShopSlot = () => {
    setShopSlots(p => [...p, { shopId:"", shopName:"", items:[] }])
    setActiveSlot(shopSlots.length)
  }

  const removeShopSlot = (idx: number) => {
    setShopSlots(p => p.filter((_,i) => i !== idx))
    setActiveSlot(Math.max(0, activeSlot - 1))
  }

  // Nhãn phí tính theo cước — hiển thị cho admin biết
  const feeLabel = (svc: ServiceType, km: number): string => {
    if (!pricing) return "15.000đ (mặc định)"
    const key = SVC_META[svc].pricingKey
    const cfg = pricing[key]
    if (!cfg) return "15.000đ (mặc định)"
    const fee = calcFeeFromPricing(km, cfg.rows, cfg.extra)
    return `${fmt(fee)} (theo bảng cước ${km}km)`
  }

  /* ── Cancel ── */
  const handleCancel = async (orderId: string) => {
    await createClient().from("orders").update({ status:"cancelled", cancelled_at:new Date().toISOString() }).eq("id", orderId)
    setOrders(p => p.map(o => o.id === orderId ? {...o, status:"cancelled"} : o))
    if (selected?.id === orderId) setSelected(p => p ? {...p, status:"cancelled"} : p)
  }

  /* ── Submit ── */
  const submit = async () => {
    const eid = custId || adminId
    if (!eid) { setCreateMsg("⚠️ Chưa xác định khách hàng"); return }
    setCreating(true); setCreateMsg("")
    const supabase = createClient()

    try {
      if (service === "food") {
        if (!delivAddr.trim())       throw new Error("Chưa nhập địa chỉ giao")
        if (filledSlots.length === 0) throw new Error("Chưa chọn món nào")
        const created: string[] = []
        for (let i = 0; i < filledSlots.length; i++) {
          const slot = filledSlots[i]
          const sub  = slot.items.reduce((s, it) => s + it.price * it.qty, 0)
          // phí: bảng cước cho quán đầu, +EXTRA_SHOP cho quán tiếp theo
          const fee  = i === 0 ? baseFee : EXTRA_SHOP
          const { data: order, error: oe } = await supabase.from("orders").insert({
            customer_id: eid, shop_id: slot.shopId, status: "pending",
            delivery_address: delivAddr, delivery_lat: 12.6521, delivery_lng: 108.5073,
            subtotal: sub, delivery_fee: fee, discount_amount: 0,
            total_amount: sub + fee, payment_method: payment,
            note: ((i > 0 ? `[+quán ${i+1}/${filledSlots.length}] ` : "") + (note || "")) || null,
          }).select("id").single()
          if (oe || !order) throw new Error(oe?.message ?? "Lỗi tạo đơn " + slot.shopName)
          await supabase.from("order_items").insert(
            slot.items.map(it => ({ order_id:order.id, product_id:it.productId, name:it.name, price:it.price, quantity:it.qty, subtotal:it.price*it.qty }))
          )
          created.push(order.id.slice(0,8).toUpperCase())
        }
        setCreateMsg(`✅ Tạo ${created.length} đơn: ${created.map(id=>"#"+id).join(", ")}`)

      } else if (service === "motorbike" || service === "taxi") {
        if (!pickupAddr.trim() || !delivAddr.trim()) throw new Error("Chưa nhập địa chỉ")
        await supabase.from("rides").insert({
          customer_id: eid, status: "searching",
          vehicle_type: service === "taxi" ? "car" : "motorbike",
          pickup_address: pickupAddr, pickup_lat: 12.6521, pickup_lng: 108.5073,
          dropoff_address: delivAddr, dropoff_lat: 12.6521, dropoff_lng: 108.5073,
          estimated_fare: baseFee || null, payment_method: payment,
        })
        setCreateMsg(`✅ Đã tạo yêu cầu ${SVC_META[service].label} · ${fmt(baseFee)}`)

      } else if (service === "buy_for_me") {
        if (!pickupAddr.trim() || !delivAddr.trim()) throw new Error("Chưa nhập địa chỉ")
        await supabase.from("errands").insert({
          customer_id: eid, type: "buy_for_me", status: "pending",
          pickup_address: pickupAddr, pickup_lat: 12.6521, pickup_lng: 108.5073,
          delivery_address: delivAddr, delivery_lat: 12.6521, delivery_lng: 108.5073,
          items_description: itemsDesc || null,
          estimated_items_cost: parseInt(estCost) || null,
          service_fee: baseFee, payment_method: payment, note: note || null,
        })
        setCreateMsg(`✅ Đã tạo yêu cầu Mua hộ · phí ${fmt(baseFee)}`)

      } else {
        if (!pickupAddr.trim() || !delivAddr.trim()) throw new Error("Chưa nhập địa chỉ")
        await supabase.from("errands").insert({
          customer_id: eid, type: "deliver_for_me", status: "pending",
          pickup_address: pickupAddr, pickup_lat: 12.6521, pickup_lng: 108.5073,
          delivery_address: delivAddr, delivery_lat: 12.6521, delivery_lng: 108.5073,
          package_description: pkgDesc || null,
          service_fee: baseFee, payment_method: payment, note: note || null,
        })
        setCreateMsg(`✅ Đã tạo yêu cầu Giao hộ · phí ${fmt(baseFee)}`)
      }

      setTimeout(async () => { resetCreate(); await load() }, 1400)
    } catch (e) {
      setCreateMsg("❌ " + (e instanceof Error ? e.message : "Lỗi không xác định"))
    }
    setCreating(false)
  }

  const resetCreate = () => {
    setShowCreate(false); setStep(1); setService("food")
    setCustPhone(""); setCustId(""); setCustName(""); setCustMsg("")
    setDelivAddr(""); setPickupAddr("")
    setDistKm("2"); setFeeOverride("")
    setVehicleType("motorbike")
    setItemsDesc(""); setEstCost(""); setPkgDesc("")
    setShopSlots([{ shopId:"", shopName:"", items:[] }]); setActiveSlot(0)
    setPayment("cash"); setNote(""); setCreateMsg("")
  }

  const step2Valid = service === "food"
    ? delivAddr.trim().length > 0
    : pickupAddr.trim().length > 0 && delivAddr.trim().length > 0

  const shown = orders
    .filter(o => filter === "all" || o.status === filter)
    .filter(o => !search ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.shopName.toLowerCase().includes(search.toLowerCase())
    )
  const todayTotal = orders.filter(o => o.status !== "cancelled").reduce((s,o) => s+o.total_amount, 0)

  /* ── Fee input widget — dùng lại trong step 2 mọi service ── */
  const FeeRow = () => (
    <div style={{ background:"rgba(255,107,0,0.06)", border:"1px solid rgba(255,107,0,0.2)", borderRadius:11, padding:"12px 14px", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ color:"#FF8C00", fontSize:11, fontWeight:700 }}>📐 Tính phí theo bảng cước</div>
        {feeOverride && (
          <button onClick={() => setFeeOverride("")}
            style={{ color:"#6a5a40", fontSize:9, background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
            Dùng cước tự động
          </button>
        )}
      </div>

      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
        {/* Distance input */}
        <div style={{ flex:1 }}>
          <div style={{ color:"#6a5a40", fontSize:9, marginBottom:4 }}>Khoảng cách</div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <input type="number" value={distKm} min="0.5" step="0.5"
              onChange={e => { setDistKm(e.target.value); setFeeOverride("") }}
              style={{ width:"100%", padding:"8px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, color:"#f0eaff", fontSize:12, textAlign:"right" }} />
            <span style={{ color:"#6a5a40", fontSize:11, flexShrink:0 }}>km</span>
          </div>
        </div>

        {/* Arrow */}
        <div style={{ color:"#6a5a40", fontSize:16, paddingTop:18 }}>→</div>

        {/* Calculated fee (editable override) */}
        <div style={{ flex:1 }}>
          <div style={{ color:"#6a5a40", fontSize:9, marginBottom:4 }}>
            Phí giao {feeOverride ? "(ghi đè)" : "(tự động)"}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <input type="number" value={feeOverride || computedBaseFee()}
              onChange={e => setFeeOverride(e.target.value)}
              style={{ width:"100%", padding:"8px 10px", background: feeOverride ? "rgba(255,179,71,0.08)" : "rgba(255,107,0,0.08)", border:`1px solid ${feeOverride?"rgba(255,179,71,0.35)":"rgba(255,107,0,0.3)"}`, borderRadius:8, color: feeOverride ? "#FFB347" : "#FF8C00", fontSize:12, textAlign:"right", fontWeight:700 }} />
            <span style={{ color:"#6a5a40", fontSize:11, flexShrink:0 }}>đ</span>
          </div>
        </div>
      </div>

      {/* Pricing breakdown hint */}
      {pricing && !feeOverride && (
        <div style={{ color:"#6a5a40", fontSize:9, lineHeight:1.7 }}>
          {(() => {
            const key = SVC_META[service].pricingKey
            const cfg = pricing[key]
            if (!cfg) return "Chưa có bảng cước"
            const km = parseFloat(distKm) || 1
            const fee = calcFeeFromPricing(km, cfg.rows, cfg.extra)
            const rows = cfg.rows.filter(r => r !== "")
            return `Bảng cước ${SVC_META[service].label}: ${rows.slice(0,3).map((r,i) => `km${i+1}=${parseInt(r||"0").toLocaleString("vi-VN")}đ`).join(" · ")}${rows.length>3?" · ...":""} → ${km}km = ${fmt(fee)}`
          })()}
        </div>
      )}
    </div>
  )

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        input,textarea,select{outline:none;font-family:'Lexend',sans-serif}
        select option{background:#1a1208;color:#f8f0e0}
      `}</style>

      <AdminShell
        pageTitle="📦 Quản lý đơn hàng"
        pageSubtitle={loading ? "Đang tải..." : `${orders.length} đơn · ${fmt(todayTotal)}`}
        actions={
          <button onClick={() => { setShowCreate(true); loadShops() }}
            style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#FF6B00,#FF8C00)", border:"none", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, color:"#fff", cursor:"pointer", boxShadow:"0 4px 14px rgba(255,107,0,0.4)" }}>
            +
          </button>
        }
      >
        <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
          {/* Search + Filters */}
          <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
            <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"10px 14px", display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
              <span style={{ color:"#6a5a40", fontSize:14 }}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã đơn, khách hàng, quán..." style={{ flex:1, background:"none", border:"none", color:"#f8f0e0", fontSize:11 }} />
            </div>

            <div style={{ display:"flex", gap:5, overflowX:"auto" }}>
              {(["all","pending","accepted","preparing","ready","delivering","delivered","cancelled"] as const).map(f => (
                <button key={f} onClick={()=>setFilter(f)}
                  style={{ flexShrink:0, padding:"5px 10px", borderRadius:8, background:filter===f?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)", border:filter===f?"1px solid rgba(255,107,0,0.35)":"1px solid rgba(255,255,255,0.06)", color:filter===f?"#FF8C00":"#6a5a40", fontSize:9, fontWeight:filter===f?700:400, cursor:"pointer", fontFamily:"Lexend", whiteSpace:"nowrap" }}>
                  {f==="all"?"Tất cả":STATUS_CFG[f].label}
                </button>
              ))}
            </div>
          </div>

        {/* ── Orders list ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"10px 16px 100px" }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"#6a5a40", fontSize:11 }}>Đang tải đơn hàng...</div>
          ) : shown.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"#6a5a40", fontSize:11 }}>Không tìm thấy đơn hàng nào</div>
          ) : shown.map(order => {
            const cfg = STATUS_CFG[order.status]
            return (
              <div key={order.id} onClick={()=>setSelected(order)}
                style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:12, marginBottom:8, cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ color:"#FF8C00", fontSize:12, fontWeight:800 }}>#{order.id.slice(0,8).toUpperCase()}</span>
                    <span style={{ background:cfg.bg, color:cfg.color, borderRadius:6, padding:"2px 7px", fontSize:8, fontWeight:700 }}>{cfg.label}</span>
                  </div>
                  <span style={{ color:"#6a5a40", fontSize:9 }}>{fmtTime(order.created_at)}</span>
                </div>
                <div style={{ color:"#f8f0e0", fontSize:11, fontWeight:600, marginBottom:3 }}>{order.customerName}</div>
                <div style={{ color:"#6a5a40", fontSize:9, marginBottom:3 }}>🏪 {order.shopName} · {order.itemCount} món</div>
                <div style={{ color:"#6a5a40", fontSize:9, marginBottom:6 }}>📍 {order.delivery_address}</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ color:"#6a5a40", fontSize:9 }}>{order.driverName?`🛵 ${order.driverName}`:"⏳ Chưa có tài xế"}</div>
                  <span style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", fontSize:13, fontWeight:800 }}>{fmt(order.total_amount)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Detail modal ── */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSelected(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:50, backdropFilter:"blur(4px)" }} />
              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",damping:22,stiffness:300}}
                style={{ position:"fixed", bottom:0, left:0, right:0, background:"#0e0c09", borderRadius:"20px 20px 0 0", border:"1px solid rgba(255,255,255,0.08)", padding:"20px 16px 32px", zIndex:51 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div>
                    <div style={{ color:"#FF8C00", fontSize:16, fontWeight:800 }}>#{selected.id.slice(0,8).toUpperCase()}</div>
                    <div style={{ color:"#6a5a40", fontSize:9 }}>{fmtTime(selected.created_at)} · {STATUS_CFG[selected.status].label}</div>
                  </div>
                  <button onClick={()=>setSelected(null)} style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"none", color:"#6a5a40", fontSize:16, cursor:"pointer" }}>×</button>
                </div>
                {[
                  ["Khách hàng", selected.customerName],
                  ["Cửa hàng",   selected.shopName],
                  ["Tài xế",     selected.driverName ?? "Chưa phân công"],
                  ["Địa chỉ",    selected.delivery_address],
                  ["Số món",     `${selected.itemCount} món`],
                  ["Tổng tiền",  fmt(selected.total_amount)],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:8, paddingBottom:8, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color:"#6a5a40", fontSize:9, flexShrink:0 }}>{k}</span>
                    <span style={{ color:"#f8f0e0", fontSize:9, fontWeight:600, textAlign:"right" }}>{v}</span>
                  </div>
                ))}
                {(selected.status==="pending"||selected.status==="accepted"||selected.status==="preparing") && (
                  <button onClick={()=>handleCancel(selected.id)}
                    style={{ width:"100%", height:44, borderRadius:12, background:"rgba(255,64,64,0.08)", border:"1px solid rgba(255,64,64,0.2)", color:"#ff4040", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", marginTop:8 }}>
                    ❌ Hủy đơn
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════
            MANUAL ORDER CREATION MODAL
        ══════════════════════════════════════════════ */}
        <AnimatePresence>
          {showCreate && (
            <>
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={resetCreate}
                style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:60, backdropFilter:"blur(6px)" }} />

              <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",damping:24,stiffness:280}}
                style={{ position:"fixed", bottom:0, left:0, right:0, background:"#0e0c09", borderRadius:"24px 24px 0 0", border:"1px solid rgba(255,107,0,0.2)", zIndex:61, maxHeight:"94dvh", display:"flex", flexDirection:"column" }}>

                {/* Modal header */}
                <div style={{ padding:"18px 18px 0", flexShrink:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:18 }}>{SVC_META[service].icon}</span>
                        <span style={{ color:"#FF8C00", fontSize:15, fontWeight:800 }}>Tạo đơn thủ công</span>
                      </div>
                      <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>Bước {step}/3 · {SVC_META[service].label}</div>
                    </div>
                    <button onClick={resetCreate} style={{ width:30, height:30, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"none", color:"#6a5a40", fontSize:18, cursor:"pointer" }}>×</button>
                  </div>
                  {/* Step bar */}
                  <div style={{ display:"flex", gap:5, marginBottom:16 }}>
                    {["Dịch vụ & KH","Địa chỉ & Phí","Xác nhận"].map((s,i) => (
                      <div key={s} style={{ flex:1, display:"flex", flexDirection:"column", gap:3, alignItems:"center" }}>
                        <div style={{ height:3, width:"100%", borderRadius:2, background:i+1<=step?"linear-gradient(90deg,#FF6B00,#FF8C00)":"rgba(255,255,255,0.08)", transition:"background .3s" }} />
                        <span style={{ fontSize:8, color:i+1<=step?"#FF8C00":"#6a5a40", fontWeight:i+1===step?700:400 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal body */}
                <div style={{ flex:1, overflowY:"auto", padding:"0 18px 16px" }}>

                  {/* ─── STEP 1: Service + Customer ─── */}
                  {step === 1 && (
                    <div>
                      <div style={{ color:"#6a5a40", fontSize:10, marginBottom:8 }}>Loại dịch vụ</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7, marginBottom:18 }}>
                        {(Object.entries(SVC_META) as [ServiceType, typeof SVC_META[ServiceType]][]).map(([key, m]) => (
                          <button key={key} onClick={() => { setService(key); setFeeOverride("") }}
                            style={{ padding:"12px 10px", borderRadius:12, display:"flex", alignItems:"center", gap:9, border:service===key?`1.5px solid ${m.color}`:"1.5px solid rgba(255,255,255,0.08)", background:service===key?`${m.color}18`:"rgba(255,255,255,0.03)", cursor:"pointer", fontFamily:"Lexend", textAlign:"left", transition:"all .2s" }}>
                            <span style={{ fontSize:22, flexShrink:0 }}>{m.icon}</span>
                            <div>
                              <div style={{ color:service===key?m.color:"#f0eaff", fontSize:11, fontWeight:service===key?700:500 }}>{m.label}</div>
                              <div style={{ color:"#6a5a40", fontSize:9 }}>{m.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>

                      <div style={{ color:"#6a5a40", fontSize:10, marginBottom:7 }}>Khách hàng (tìm theo SĐT)</div>
                      <div style={{ display:"flex", gap:7, marginBottom:8 }}>
                        <input type="tel" value={custPhone} onChange={e=>setCustPhone(e.target.value)}
                          onKeyDown={e=>e.key==="Enter"&&searchCustomer()} placeholder="0901234567"
                          style={{ flex:1, padding:"10px 13px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                        <button onClick={searchCustomer} disabled={searching}
                          style={{ padding:"0 14px", borderRadius:10, background:"rgba(255,107,0,0.15)", border:"1px solid rgba(255,107,0,0.35)", color:"#FF8C00", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                          {searching?"...":"🔍"}
                        </button>
                      </div>
                      {custMsg && (
                        <div style={{ marginBottom:14, padding:"8px 12px", borderRadius:8, background:custMsg.startsWith("✅")?"rgba(62,207,110,0.08)":"rgba(255,179,71,0.08)", border:`1px solid ${custMsg.startsWith("✅")?"rgba(62,207,110,0.25)":"rgba(255,179,71,0.25)"}`, color:custMsg.startsWith("✅")?"#3ecf6e":"#FFB347", fontSize:11 }}>
                          {custMsg}
                        </div>
                      )}
                      <div style={{ padding:"9px 13px", borderRadius:10, background:"rgba(255,107,0,0.05)", border:"1px solid rgba(255,107,0,0.12)" }}>
                        <div style={{ color:"#6a5a40", fontSize:9, lineHeight:1.7 }}>
                          💡 Khách đặt qua fanpage / hotline → nhập SĐT để tìm tài khoản.<br />
                          Không tìm thấy → đơn dùng tài khoản admin.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── STEP 2: Addresses + Fee ─── */}
                  {step === 2 && (
                    <div>

                      {/* FOOD */}
                      {service === "food" && (
                        <>
                          <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Địa chỉ giao hàng <span style={{color:"#ff4040"}}>*</span></div>
                          <textarea value={delivAddr} onChange={e=>setDelivAddr(e.target.value)} rows={2}
                            placeholder="Số nhà, đường, thôn/xã..."
                            style={{ width:"100%", padding:"10px 13px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f0eaff", fontSize:12, resize:"none", marginBottom:14 }} />

                          {/* Fee calculator */}
                          <FeeRow />

                          {/* Multi-shop fee breakdown */}
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:11, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", marginBottom:14 }}>
                            <div>
                              <div style={{ color:"#f0eaff", fontSize:11, fontWeight:700 }}>Phí giao tổng</div>
                              <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>
                                Quán 1: {fmt(baseFee)}{filledSlots.length>1 ? ` · +${filledSlots.length-1} quán × ${fmt(EXTRA_SHOP)}` : ""}
                              </div>
                            </div>
                            <div style={{ textAlign:"right" }}>
                              <div style={{ color:"#FFB347", fontSize:16, fontWeight:800 }}>{fmt(totalShipFee)}</div>
                              <div style={{ color:"#6a5a40", fontSize:9 }}>{filledSlots.length||shopSlots.length} cửa hàng</div>
                            </div>
                          </div>

                          {/* Shop slots */}
                          {shopSlots.map((slot, si) => (
                            <div key={si} style={{ marginBottom:10, borderRadius:13, border:`1.5px solid ${activeSlot===si?"rgba(255,107,0,0.4)":"rgba(255,255,255,0.08)"}`, background:activeSlot===si?"rgba(255,107,0,0.04)":"rgba(255,255,255,0.02)", overflow:"hidden" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", cursor:"pointer" }} onClick={()=>setActiveSlot(si)}>
                                <div style={{ width:24, height:24, borderRadius:8, background:activeSlot===si?"rgba(255,107,0,0.2)":"rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:activeSlot===si?"#FF8C00":"#6a5a40", flexShrink:0 }}>
                                  {si+1}
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ color:slot.shopId?"#f0eaff":"#6a5a40", fontSize:11, fontWeight:slot.shopId?600:400 }}>
                                    {slot.shopName||"Chọn cửa hàng..."}
                                  </div>
                                  {slot.items.length > 0 && (
                                    <div style={{ color:"#FF8C00", fontSize:9, marginTop:1 }}>
                                      {slot.items.reduce((s,i)=>s+i.qty,0)} món · {fmt(slot.items.reduce((s,i)=>s+i.price*i.qty,0))}
                                    </div>
                                  )}
                                </div>
                                <span style={{ padding:"2px 7px", borderRadius:20, fontSize:8, fontWeight:700, whiteSpace:"nowrap", flexShrink:0,
                                  background:si===0?"rgba(62,207,110,0.1)":"rgba(255,107,0,0.12)",
                                  border:si===0?"1px solid rgba(62,207,110,0.2)":"1px solid rgba(255,107,0,0.25)",
                                  color:si===0?"#3ecf6e":"#FF8C00" }}>
                                  {si===0 ? fmt(baseFee) : `+${fmt(EXTRA_SHOP)}`}
                                </span>
                                {shopSlots.length > 1 && (
                                  <button onClick={e=>{e.stopPropagation();removeShopSlot(si)}}
                                    style={{ width:22, height:22, borderRadius:6, background:"rgba(255,64,64,0.1)", border:"1px solid rgba(255,64,64,0.2)", color:"#ff4040", fontSize:12, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                                )}
                              </div>

                              {activeSlot === si && (
                                <div style={{ padding:"10px 12px" }}>
                                  <select value={slot.shopId}
                                    onChange={e=>{
                                      const opt = e.target.options[e.target.selectedIndex]
                                      setShopSlots(prev=>prev.map((s,i)=>i===si?{...s,shopId:e.target.value,shopName:opt.text,items:[]}:s))
                                      if (e.target.value) loadProducts(e.target.value)
                                    }}
                                    style={{ width:"100%", padding:"9px 12px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:9, color:slot.shopId?"#f0eaff":"#6a5a40", fontSize:11, marginBottom:10 }}>
                                    <option value="">— Chọn cửa hàng —</option>
                                    {shopList.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                                  </select>

                                  {slot.shopId && !productMap[slot.shopId] && (
                                    <div style={{ textAlign:"center", color:"#6a5a40", fontSize:10, padding:"8px 0" }}>Đang tải menu...</div>
                                  )}

                                  {(productMap[slot.shopId] ?? []).map(p => {
                                    const inCart = slot.items.find(i=>i.productId===p.id)
                                    return (
                                      <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", borderRadius:9, marginBottom:5, background:inCart?"rgba(255,107,0,0.07)":"rgba(255,255,255,0.02)", border:`1px solid ${inCart?"rgba(255,107,0,0.2)":"rgba(255,255,255,0.06)"}` }}>
                                        <div style={{ flex:1 }}>
                                          <div style={{ color:"#f0eaff", fontSize:10, fontWeight:600 }}>{p.name}</div>
                                          <div style={{ color:"#FF8C00", fontSize:9, fontWeight:700 }}>{fmt(p.price)}</div>
                                        </div>
                                        {inCart ? (
                                          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                                            <button onClick={()=>changeQty(si,p.id,-1)} style={{ width:24, height:24, borderRadius:7, background:"rgba(255,64,64,0.12)", border:"1px solid rgba(255,64,64,0.25)", color:"#ff4040", fontSize:13, cursor:"pointer" }}>−</button>
                                            <span style={{ color:"#f0eaff", fontSize:11, fontWeight:700, minWidth:14, textAlign:"center" }}>{inCart.qty}</span>
                                            <button onClick={()=>changeQty(si,p.id,1)} style={{ width:24, height:24, borderRadius:7, background:"rgba(255,107,0,0.12)", border:"1px solid rgba(255,107,0,0.25)", color:"#FF8C00", fontSize:13, cursor:"pointer" }}>+</button>
                                          </div>
                                        ) : (
                                          <button onClick={()=>addItem(si,p)} style={{ width:26, height:26, borderRadius:7, background:"rgba(255,107,0,0.14)", border:"1px solid rgba(255,107,0,0.3)", color:"#FF8C00", fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ))}

                          <button onClick={addShopSlot}
                            style={{ width:"100%", height:40, borderRadius:11, background:"rgba(255,107,0,0.08)", border:"1.5px dashed rgba(255,107,0,0.3)", color:"#FF8C00", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                            + Thêm cửa hàng (+{fmt(EXTRA_SHOP)})
                          </button>
                        </>
                      )}

                      {/* RIDE */}
                      {(service === "motorbike" || service === "taxi") && (
                        <>
                          {service === "taxi" && (
                            <div style={{ marginBottom:14 }}>
                              <div style={{ color:"#6a5a40", fontSize:10, marginBottom:7 }}>Loại xe</div>
                              <div style={{ display:"flex", gap:7 }}>
                                {([["motorbike","🏍️ Xe ôm"],["car","🚗 4 chỗ"]] as const).map(([v,l]) => (
                                  <button key={v} onClick={()=>setVehicleType(v)}
                                    style={{ flex:1, padding:"9px", borderRadius:9, border:vehicleType===v?"1.5px solid rgba(245,197,66,0.5)":"1.5px solid rgba(255,255,255,0.08)", background:vehicleType===v?"rgba(245,197,66,0.1)":"rgba(255,255,255,0.03)", color:vehicleType===v?"#f5c542":"#6a5a40", fontSize:11, fontWeight:vehicleType===v?700:400, cursor:"pointer", fontFamily:"Lexend" }}>
                                    {l}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {[
                            { label:"Điểm đón *", val:pickupAddr, set:setPickupAddr, ph:"Địa chỉ đón khách" },
                            { label:"Điểm đến *", val:delivAddr,  set:setDelivAddr,  ph:"Địa chỉ đến" },
                          ].map(f=>(
                            <div key={f.label} style={{ marginBottom:12 }}>
                              <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>{f.label}</div>
                              <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                                style={{ width:"100%", padding:"10px 13px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                            </div>
                          ))}
                          {/* Fee from pricing */}
                          <FeeRow />
                          <div style={{ padding:"8px 12px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", fontSize:9, color:"#6a5a40" }}>
                            💡 Giá hiển thị là ước tính theo bảng cước. Admin có thể ghi đè ô bên phải.
                          </div>
                        </>
                      )}

                      {/* MUA HỘ */}
                      {service === "buy_for_me" && (
                        <>
                          {[
                            { label:"Địa chỉ cần mua *", val:pickupAddr, set:setPickupAddr, ph:"Chợ / cửa hàng cần đến" },
                            { label:"Địa chỉ giao đến *", val:delivAddr, set:setDelivAddr, ph:"Địa chỉ nhận hàng" },
                          ].map(f=>(
                            <div key={f.label} style={{ marginBottom:12 }}>
                              <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>{f.label}</div>
                              <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                                style={{ width:"100%", padding:"10px 13px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                            </div>
                          ))}
                          <FeeRow />
                          <div style={{ marginBottom:12 }}>
                            <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Danh sách đồ cần mua</div>
                            <textarea value={itemsDesc} onChange={e=>setItemsDesc(e.target.value)} rows={3}
                              placeholder="2 hộp sữa TH, 1kg thịt bằm, rau cải..."
                              style={{ width:"100%", padding:"10px 13px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f0eaff", fontSize:12, resize:"none" }} />
                          </div>
                          <div>
                            <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Tiền hàng ước tính (tài xế ứng trước)</div>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <input type="number" value={estCost} onChange={e=>setEstCost(e.target.value)} placeholder="0"
                                style={{ flex:1, padding:"10px 13px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                              <span style={{ color:"#6a5a40", fontSize:11, flexShrink:0 }}>đ</span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* GIAO HỘ */}
                      {service === "deliver_for_me" && (
                        <>
                          {[
                            { label:"Địa chỉ lấy hàng *", val:pickupAddr, set:setPickupAddr, ph:"Nơi tài xế đến lấy" },
                            { label:"Địa chỉ giao đến *", val:delivAddr,  set:setDelivAddr,  ph:"Nơi cần giao" },
                          ].map(f=>(
                            <div key={f.label} style={{ marginBottom:12 }}>
                              <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>{f.label}</div>
                              <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                                style={{ width:"100%", padding:"10px 13px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                            </div>
                          ))}
                          <FeeRow />
                          <div>
                            <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Mô tả kiện hàng</div>
                            <textarea value={pkgDesc} onChange={e=>setPkgDesc(e.target.value)} rows={3}
                              placeholder="Hộp bánh, túi đồ, kích thước, lưu ý đặc biệt..."
                              style={{ width:"100%", padding:"10px 13px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f0eaff", fontSize:12, resize:"none" }} />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ─── STEP 3: Confirm + Payment ─── */}
                  {step === 3 && (
                    <div>
                      <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700, marginBottom:12 }}>Xác nhận đơn hàng</div>

                      {/* Summary */}
                      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:13, padding:"14px", marginBottom:14 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, paddingBottom:10, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                          <span style={{ fontSize:22 }}>{SVC_META[service].icon}</span>
                          <div>
                            <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>{SVC_META[service].label}</div>
                            <div style={{ color:"#6a5a40", fontSize:9 }}>{custName||"Tài khoản admin"} · {distKm}km</div>
                          </div>
                          <div style={{ marginLeft:"auto", textAlign:"right" }}>
                            <div style={{ color:"#6a5a40", fontSize:8 }}>Phí theo cước</div>
                            <div style={{ color:"#FF8C00", fontSize:12, fontWeight:800 }}>{fmt(baseFee)}</div>
                          </div>
                        </div>

                        {service === "food" && filledSlots.map((slot, i) => (
                          <div key={i} style={{ marginBottom:8, paddingBottom:8, borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                              <span style={{ color:"#FF8C00", fontSize:10, fontWeight:700 }}>🏪 {slot.shopName}</span>
                              <span style={{ color:"#6a5a40", fontSize:9 }}>ship: {fmt(i===0?baseFee:EXTRA_SHOP)}</span>
                            </div>
                            {slot.items.map(it => (
                              <div key={it.productId} style={{ display:"flex", justifyContent:"space-between" }}>
                                <span style={{ color:"#b0956a", fontSize:9 }}>{it.name} ×{it.qty}</span>
                                <span style={{ color:"#b0956a", fontSize:9 }}>{fmt(it.price*it.qty)}</span>
                              </div>
                            ))}
                          </div>
                        ))}

                        {service !== "food" && [
                          pickupAddr && ["Điểm đón/lấy", pickupAddr],
                          delivAddr  && ["Điểm giao",    delivAddr],
                          itemsDesc  && ["Đồ cần mua",   itemsDesc],
                          pkgDesc    && ["Kiện hàng",     pkgDesc],
                          estCost    && ["Tiền hàng ước", fmt(parseInt(estCost)||0)],
                        ].filter(Boolean).map(row => row && (
                          <div key={row[0]} style={{ display:"flex", justifyContent:"space-between", marginBottom:7, paddingBottom:7, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                            <span style={{ color:"#6a5a40", fontSize:9, flexShrink:0 }}>{row[0]}</span>
                            <span style={{ color:"#f0eaff", fontSize:9, fontWeight:600, textAlign:"right", maxWidth:"62%" }}>{row[1]}</span>
                          </div>
                        ))}

                        <div style={{ display:"flex", justifyContent:"space-between", paddingTop:8, borderTop:"1px solid rgba(255,107,0,0.15)" }}>
                          <span style={{ color:"#6a5a40", fontSize:11, fontWeight:700 }}>Tổng cộng</span>
                          <span style={{ color:"#FF8C00", fontSize:15, fontWeight:800 }}>
                            {service==="food"
                              ? fmt(foodTotal)
                              : service==="buy_for_me"
                                ? fmt(baseFee + (parseInt(estCost)||0))
                                : fmt(baseFee)}
                          </span>
                        </div>
                      </div>

                      {/* Payment */}
                      <div style={{ color:"#6a5a40", fontSize:10, marginBottom:7 }}>Phương thức thanh toán</div>
                      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
                        {([["cash","💵 Tiền mặt"],["vietqr","🏦 VietQR"],["momo","💜 MoMo"]] as const).map(([m,l])=>(
                          <button key={m} onClick={()=>setPayment(m)}
                            style={{ flex:1, padding:"8px 4px", borderRadius:9, fontSize:10, fontWeight:payment===m?700:400, cursor:"pointer", fontFamily:"Lexend", background:payment===m?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)", border:payment===m?"1px solid rgba(255,107,0,0.35)":"1px solid rgba(255,255,255,0.08)", color:payment===m?"#FF8C00":"#6a5a40" }}>
                            {l}
                          </button>
                        ))}
                      </div>

                      <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Ghi chú</div>
                      <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="Ghi chú nội bộ..."
                        style={{ width:"100%", padding:"9px 13px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:11, resize:"none", marginBottom:14 }} />

                      {createMsg && (
                        <div style={{ marginBottom:12, padding:"8px 12px", borderRadius:8, background:createMsg.startsWith("✅")?"rgba(62,207,110,0.08)":"rgba(255,64,64,0.08)", color:createMsg.startsWith("✅")?"#3ecf6e":"#ff4040", fontSize:11, border:`1px solid ${createMsg.startsWith("✅")?"rgba(62,207,110,0.25)":"rgba(255,64,64,0.25)"}` }}>
                          {createMsg}
                        </div>
                      )}

                      <button onClick={submit} disabled={creating}
                        style={{ width:"100%", height:50, borderRadius:14, background:creating?"rgba(255,107,0,0.3)":"linear-gradient(90deg,#FF6B00,#FF8C00)", border:"none", color:"#fff", fontSize:14, fontWeight:800, cursor:creating?"not-allowed":"pointer", fontFamily:"Lexend", boxShadow:creating?"none":"0 4px 20px rgba(255,107,0,0.35)" }}>
                        {creating?"⏳ Đang tạo...":"✅ Xác nhận tạo đơn"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer nav */}
                <div style={{ padding:"10px 18px 28px", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", gap:8, flexShrink:0 }}>
                  {step > 1 && (
                    <button onClick={()=>setStep(s=>s-1)}
                      style={{ flex:1, height:44, borderRadius:12, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#f0eaff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                      ← Quay lại
                    </button>
                  )}
                  {step < 3 && (
                    <button disabled={step===2&&!step2Valid} onClick={()=>setStep(s=>s+1)}
                      style={{ flex:2, height:44, borderRadius:12, background:"linear-gradient(90deg,#FF6B00,#FF8C00)", border:"none", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"Lexend", opacity:step===2&&!step2Valid?0.38:1, transition:"opacity .2s" }}>
                      Tiếp theo →
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        </div>
      </AdminShell>
    </>
  )
}
