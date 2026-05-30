"use client"

// src/app/(customer)/shop/[shopId]/page.tsx
// Trang quán ăn: hero · thông tin · category tabs · menu sản phẩm · cart bar

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useCartStore } from "@/store/cartStore"
import { createClient } from "@/lib/supabase/client"

// ─── Types ────────────────────────────────────────────────
interface Product {
  id:        string
  category:  string
  name:      string
  desc:      string
  price:     number
  origPrice: number | null
  imageUrl:  string | null
  sold:      number
  hot?:      boolean
  toppings:  Topping[]
  sizes:     SizeOpt[]
}

interface MenuGroupMeta { id: string; name: string; sortOrder: number }

interface ShopInfo {
  name:          string
  description:   string | null
  address:       string
  rating:        number | null
  rating_count:  number | null
  is_open:       boolean
  avatar_url:    string | null
  cover_url:     string | null
  phone:         string | null
  opening_hours: { open?: string; close?: string } | null
  prep_time:     string | null
  menu_groups:   MenuGroupMeta[] | null
}

interface Topping { id: string; name: string; price: number }
interface SizeOpt { id: string; label: string; priceDiff: number }

interface ComboVoucher {
  id:       string
  title:    string
  discount: number
  endAt:    string
  items:    { productId: string; productName: string; productPrice: number; minQty: number }[]
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

// ─── Particle effect (add-to-cart) ───────────────────────
function spawnParticle(btn: HTMLElement, badge: HTMLElement | null) {
  if (!badge) return
  const s = btn.getBoundingClientRect()
  const t = badge.getBoundingClientRect()
  const sx = s.left + s.width / 2
  const sy = s.top  + s.height / 2
  const tx = t.left + t.width / 2
  const ty = t.top  + t.height / 2

  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const p = document.createElement("div")
      const ox = (Math.random() - .5) * 14
      const oy = (Math.random() - .5) * 14
      p.style.cssText = `position:fixed;pointer-events:none;z-index:9999;
        width:7px;height:7px;border-radius:50%;
        background:#FF8C00;box-shadow:0 0 6px #FF6B00;
        left:${sx + ox}px;top:${sy + oy}px;`
      document.body.appendChild(p)
      let tick = 0
      const dx = tx - (sx + ox), dy = ty - (sy + oy)
      const iv = setInterval(() => {
        tick += 0.06
        if (tick >= 1) { clearInterval(iv); p.remove(); return }
        const e = tick < .5 ? 2*tick*tick : -1+(4-2*tick)*tick
        p.style.left      = `${sx + ox + dx * e}px`
        p.style.top       = `${sy + oy + dy * e - Math.sin(tick * Math.PI) * 44}px`
        p.style.opacity   = `${1 - tick * .8}`
        p.style.transform = `scale(${1 - tick * .4})`
      }, 16)
    }, i * 40)
  }
}

// ─── ProductSheet (full product detail: image · desc · size · topping · qty · note) ───
function ProductSheet({
  product, selSize, selTops, qty, note,
  onSizeChange, onToggleTop, onQtyChange, onNoteChange, onClose, onConfirm,
}: {
  product:      Product
  selSize:      string | null
  selTops:      string[]
  qty:          number
  note:         string
  onSizeChange: (id: string) => void
  onToggleTop:  (id: string) => void
  onQtyChange:  (q: number) => void
  onNoteChange: (n: string) => void
  onClose:      () => void
  onConfirm:    () => void
}) {
  const sizeDiff  = product.sizes.find(s => s.id === selSize)?.priceDiff ?? 0
  const topTotal  = selTops.reduce((s, tid) => s + (product.toppings.find(t => t.id === tid)?.price ?? 0), 0)
  const unitPrice = product.price + sizeDiff + topTotal
  const total     = unitPrice * qty

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose}
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)",
          zIndex:120, backdropFilter:"blur(4px)" }} />
      <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
        transition={{ type:"spring", damping:26, stiffness:280 }}
        style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:121,
          background:"#0e0c09", borderRadius:"22px 22px 0 0",
          border:"1px solid rgba(255,107,0,0.18)",
          maxHeight:"92svh", display:"flex", flexDirection:"column" }}>

        {/* Handle bar + close button */}
        <div style={{ padding:"10px 16px 0", flexShrink:0, position:"relative" }}>
          <div style={{ width:36, height:4, background:"rgba(255,255,255,0.12)",
            borderRadius:2, margin:"0 auto" }} />
          <button onClick={onClose}
            style={{ position:"absolute", top:6, right:12, width:32, height:32,
              borderRadius:9, border:"none", background:"rgba(255,255,255,0.08)",
              color:"#6a5a40", fontSize:18, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:"auto" }}>

          {/* Hero image */}
          <div style={{ width:"100%", height:220, background:"rgba(255,255,255,0.04)",
            overflow:"hidden", position:"relative" }}>
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name}
                style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            ) : (
              <div style={{ width:"100%", height:"100%", display:"flex",
                alignItems:"center", justifyContent:"center", fontSize:72, opacity:.3 }}>
                🍽️
              </div>
            )}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:80,
              background:"linear-gradient(to top,#0e0c09,transparent)" }} />
          </div>

          {/* Product name + price + description */}
          <div style={{ padding:"14px 16px 0" }}>
            <div style={{ color:"#f8f0e0", fontSize:17, fontWeight:800,
              lineHeight:1.3, marginBottom:6 }}>
              {product.name}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8,
              marginBottom: product.desc ? 8 : 18 }}>
              <span style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                backgroundClip:"text", fontSize:16, fontWeight:800 }}>
                {product.price.toLocaleString("vi-VN")}đ
              </span>
              {product.origPrice && (
                <span style={{ color:"#6a5a40", fontSize:11,
                  textDecoration:"line-through" }}>
                  {product.origPrice.toLocaleString("vi-VN")}đ
                </span>
              )}
            </div>
            {product.desc && (
              <div style={{ color:"#6a5a40", fontSize:11, lineHeight:1.7,
                marginBottom:18 }}>
                {product.desc}
              </div>
            )}
          </div>

          <div style={{ padding:"0 16px 8px" }}>

            {/* Size */}
            {product.sizes.length > 0 && (
              <div style={{ marginBottom:18 }}>
                <div style={{ color:"rgba(176,149,106,0.7)", fontSize:9.5, fontWeight:700,
                  letterSpacing:".4px", textTransform:"uppercase", marginBottom:8 }}>
                  Chọn size <span style={{ color:"#ff4040", marginLeft:2 }}>*</span>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                  {product.sizes.map(s => {
                    const active = selSize === s.id
                    return (
                      <div key={s.id} onClick={() => onSizeChange(s.id)}
                        style={{ padding:"8px 16px", borderRadius:10, cursor:"pointer",
                          background: active ? "rgba(255,107,0,0.14)" : "rgba(255,255,255,0.04)",
                          border:`1.5px solid ${active ? "#FF6B00" : "rgba(255,255,255,0.1)"}`,
                          transition:"all .15s" }}>
                        <div style={{ color: active ? "#FF8C00" : "#b0956a",
                          fontSize:11, fontWeight: active ? 700 : 400 }}>{s.label}</div>
                        {s.priceDiff !== 0 && (
                          <div style={{ color: active ? "#FF8C00" : "#6a5a40", fontSize:9, marginTop:1 }}>
                            {s.priceDiff > 0 ? "+" : ""}{s.priceDiff.toLocaleString("vi-VN")}đ
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Toppings */}
            {product.toppings.length > 0 && (
              <div style={{ marginBottom:18 }}>
                <div style={{ color:"rgba(176,149,106,0.7)", fontSize:9.5, fontWeight:700,
                  letterSpacing:".4px", textTransform:"uppercase", marginBottom:8 }}>
                  Chọn topping
                  <span style={{ color:"#6a5a40", fontSize:8.5, textTransform:"none",
                    fontWeight:400, marginLeft:4 }}>(tuỳ chọn)</span>
                </div>
                <div style={{ background:"rgba(255,255,255,0.02)",
                  border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden" }}>
                  {product.toppings.map((t, i) => {
                    const checked = selTops.includes(t.id)
                    const isLast  = i === product.toppings.length - 1
                    return (
                      <div key={t.id} onClick={() => onToggleTop(t.id)}
                        style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 12px",
                          borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)",
                          background: checked ? "rgba(255,107,0,0.05)" : "transparent",
                          cursor:"pointer", transition:"background .12s" }}>
                        <div style={{ width:22, height:22, borderRadius:7, flexShrink:0,
                          background: checked ? "#FF6B00" : "rgba(255,255,255,0.06)",
                          border:`1.5px solid ${checked ? "#FF6B00" : "rgba(255,255,255,0.12)"}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          transition:"all .12s" }}>
                          {checked && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}
                        </div>
                        <span style={{ flex:1, color: checked ? "#f8f0e0" : "#b0956a",
                          fontSize:12, fontWeight: checked ? 600 : 400 }}>{t.name}</span>
                        <span style={{ color:"#FF8C00", fontSize:10, fontWeight:600, flexShrink:0 }}>
                          +{t.price.toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Qty stepper */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              marginBottom:18 }}>
              <div style={{ color:"rgba(176,149,106,0.7)", fontSize:9.5, fontWeight:700,
                letterSpacing:".4px", textTransform:"uppercase" }}>Số lượng</div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <button onClick={() => onQtyChange(Math.max(1, qty - 1))}
                  style={{ width:36, height:36, borderRadius:10, border:"none",
                    background: qty > 1 ? "rgba(255,107,0,0.14)" : "rgba(255,255,255,0.05)",
                    color: qty > 1 ? "#FF8C00" : "#6a5a40",
                    fontSize:18, cursor: qty > 1 ? "pointer" : "default",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:"Lexend", transition:"all .12s" }}>−</button>
                <span style={{ color:"#f8f0e0", fontSize:16, fontWeight:700,
                  minWidth:28, textAlign:"center" }}>{qty}</span>
                <button onClick={() => onQtyChange(qty + 1)}
                  style={{ width:36, height:36, borderRadius:10, border:"none",
                    background:"rgba(255,107,0,0.14)", color:"#FF8C00",
                    fontSize:18, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:"Lexend" }}>+</button>
              </div>
            </div>

            {/* Ghi chú */}
            <div style={{ marginBottom:12 }}>
              <div style={{ color:"rgba(176,149,106,0.7)", fontSize:9.5, fontWeight:700,
                letterSpacing:".4px", textTransform:"uppercase", marginBottom:8 }}>
                Ghi chú
              </div>
              <textarea
                value={note}
                onChange={e => onNoteChange(e.target.value)}
                placeholder="VD: ít cay, không hành, thêm đá..."
                rows={2}
                style={{ width:"100%", padding:"10px 12px",
                  background:"rgba(255,255,255,0.04)",
                  border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:10, color:"#f8f0e0", fontSize:12,
                  resize:"none", fontFamily:"Lexend", outline:"none",
                  lineHeight:1.6, boxSizing:"border-box" as const }}
              />
            </div>

          </div>
        </div>

        {/* Confirm button */}
        <div style={{ padding:"10px 16px",
          paddingBottom:"max(20px,env(safe-area-inset-bottom))",
          borderTop:"1px solid rgba(255,255,255,0.06)", flexShrink:0,
          background:"#0e0c09" }}>
          <button onClick={onConfirm}
            style={{ width:"100%", height:50, borderRadius:14, border:"none",
              background:"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
              color:"#fff", fontSize:13, fontWeight:700, fontFamily:"Lexend",
              cursor:"pointer", boxShadow:"0 4px 18px rgba(255,107,0,0.4)",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <span>🛒 Thêm {qty > 1 ? `${qty} × ` : ""}vào giỏ</span>
            <span style={{ opacity:.85, fontSize:12 }}>•</span>
            <span>{total.toLocaleString("vi-VN")}đ</span>
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ─── ProductCard ──────────────────────────────────────────
function ProductCard({
  product, onAdd, badgeRef,
}: {
  product: Product
  onAdd: (p: Product, btn: HTMLElement) => void
  badgeRef: React.RefObject<HTMLElement | null>
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const discount = product.origPrice
    ? Math.round((1 - product.price / product.origPrice) * 100)
    : null

  return (
    <div style={{ display:"flex", gap:12, padding:"13px 0",
      borderBottom:"1px solid rgba(255,255,255,0.06)" }}>

      {/* Image */}
      <div style={{ position:"relative", flexShrink:0 }}>
        <div style={{ width:82, height:82, borderRadius:12,
          background:"rgba(255,255,255,0.05)",
          border:"1px solid rgba(255,255,255,0.08)",
          overflow:"hidden",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:36 }}>
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name}
                style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            : "🍽️"}
        </div>
        {discount && (
          <div style={{ position:"absolute", top:-4, left:-4,
            background:"#ff4040", color:"#fff",
            borderRadius:6, padding:"1px 6px",
            fontSize:8, fontWeight:800 }}>
            -{discount}%
          </div>
        )}
        {product.hot && (
          <div style={{ position:"absolute", bottom:-4, right:-4,
            background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
            color:"#fff", borderRadius:6, padding:"1px 6px",
            fontSize:7, fontWeight:700 }}>
            🔥 Hot
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:"#f8f0e0", fontSize:12.5, fontWeight:600,
          marginBottom:3, lineHeight:1.3,
          overflow:"hidden", display:"-webkit-box",
          WebkitLineClamp:2, WebkitBoxOrient:"vertical" } as React.CSSProperties}>
          {product.name}
        </div>
        <div style={{ color:"#6a5a40", fontSize:9.5, lineHeight:1.5,
          marginBottom:6,
          overflow:"hidden", display:"-webkit-box",
          WebkitLineClamp:2, WebkitBoxOrient:"vertical" } as React.CSSProperties}>
          {product.desc}
        </div>

        {/* Price row */}
        <div style={{ display:"flex", alignItems:"center",
          justifyContent:"space-between" }}>
          <div>
            <span style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              backgroundClip:"text", fontSize:14, fontWeight:800 }}>
              {fmt(product.price)}
            </span>
            {product.origPrice && (
              <span style={{ color:"#6a5a40", fontSize:9,
                textDecoration:"line-through", marginLeft:5 }}>
                {fmt(product.origPrice)}
              </span>
            )}
            <div style={{ color:"#6a5a40", fontSize:8.5, marginTop:1 }}>
              Đã bán {product.sold.toLocaleString("vi-VN")}
            </div>
          </div>

          {/* Add button */}
          {(() => {
            const hasOpts = product.toppings.length > 0 || product.sizes.length > 0
            return (
              <button ref={btnRef}
                onClick={() => btnRef.current && onAdd(product, btnRef.current)}
                style={{ height:36, borderRadius:10, border:"none",
                  padding: hasOpts ? "0 10px" : "0",
                  width: hasOpts ? "auto" : 36,
                  background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
                  color:"#fff", fontSize: hasOpts ? 10 : 20,
                  fontWeight: hasOpts ? 700 : 300, cursor:"pointer",
                  fontFamily:"Lexend",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:"0 2px 10px rgba(255,107,0,0.4)",
                  flexShrink:0, transition:"transform .15s, box-shadow .15s",
                  whiteSpace:"nowrap", lineHeight:1 }}>
                {hasOpts ? "Chọn ›" : "+"}
              </button>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────
export default function ShopPage() {
  const router       = useRouter()
  const params       = useParams()
  const searchParams = useSearchParams()
  const shopId       = (params?.shopId as string) ?? ""
  const isEditMode   = searchParams?.get("edit") === "1"
  const supabase     = createClient()
  const addItem       = useCartStore(s => s.addItem)
  const clearAndAdd   = useCartStore(s => s.clearAndAdd)
  const storeShopId   = useCartStore(s => s.shopId)
  const storeShopName = useCartStore(s => s.items[0]?.shop ?? "")
  const totalItems    = useCartStore(s => s.totalQty())
  const totalPrice    = useCartStore(s => s.totalPrice())

  type PendingItem = { id:string; name:string; price:number; shop:string; shopId:string; imageUrl?:string; note?:string }
  const [shop,          setShop]          = useState<ShopInfo | null>(null)
  const [products,      setProducts]      = useState<Product[]>([])
  const [categories,    setCategories]    = useState<{id:string; label:string}[]>([])
  const [combos,        setCombos]        = useState<ComboVoucher[]>([])
  const [loading,       setLoading]       = useState(true)
  const [activeTab,     setActiveTab]     = useState("")
  const [scrolled,      setScrolled]      = useState(false)
  const [toast,         setToast]         = useState("")
  const [favoured,      setFavoured]      = useState(false)
  const [conflictItem,  setConflictItem]  = useState<PendingItem | null>(null)
  const [uploading,     setUploading]     = useState<"cover"|"logo"|null>(null)
  const [optSheet,      setOptSheet]      = useState<Product | null>(null)
  const [selSize,       setSelSize]       = useState<string | null>(null)
  const [selTops,       setSelTops]       = useState<string[]>([])
  const [optQty,        setOptQty]        = useState(1)
  const [optNote,       setOptNote]       = useState("")
  const coverRef = useRef<HTMLInputElement>(null)
  const logoRef  = useRef<HTMLInputElement>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const cartBadgeRef = useRef<HTMLElement | null>(null)
  const sectionRefs  = useRef<Record<string, HTMLDivElement | null>>({})
  const tabsRef      = useRef<HTMLDivElement>(null)

  // Fetch shop + products from Supabase
  useEffect(() => {
    if (!shopId) return
    async function load() {
      // Shop info
      const { data: shopData } = await supabase
        .from("shops")
        .select("name,description,address,rating_avg,total_reviews,is_open,logo_url,cover_image_url,phone,opening_hours,menu_groups_data")
        .eq("id", shopId)
        .single()
      if (shopData) setShop({
        ...shopData,
        rating: shopData.rating_avg,
        rating_count: shopData.total_reviews,
        avatar_url: shopData.logo_url,
        cover_url: shopData.cover_image_url,
        opening_hours: shopData.opening_hours ?? null,
        prep_time: null,
        menu_groups: (shopData.menu_groups_data as MenuGroupMeta[] | null) ?? null,
      } as ShopInfo)

      // Products
      const { data: prodData } = await supabase
        .from("products")
        .select("id,name,description,price,original_price,category,is_available,sold_count,image_url,toppings,sizes")
        .eq("shop_id", shopId)
        .eq("is_available", true)
        .order("sort_order", { ascending: true })

      type ProdRow = { id:string; name:string; description:string|null; price:number; original_price:number|null; category:string|null; sold_count:number; image_url:string|null; toppings:unknown; sizes:unknown }
      const mapped: Product[] = (prodData ?? [] as ProdRow[]).map((p: ProdRow) => ({
        id: p.id, name: p.name, desc: p.description ?? "",
        price: p.price, origPrice: p.original_price ?? null,
        category: p.category ?? "Thực đơn",
        imageUrl: p.image_url,
        sold: p.sold_count, hot: p.sold_count > 50,
        toppings: (p.toppings as Topping[] | null) ?? [],
        sizes: (p.sizes as SizeOpt[] | null) ?? [],
      }))
      setProducts(mapped)

      // Derive category tabs — prefer menu_groups_data names (merchant-defined order & labels)
      const rawGroups = (shopData?.menu_groups_data as MenuGroupMeta[] | null) ?? []
      let cats: { id: string; label: string }[]
      if (rawGroups.length > 0) {
        const sorted = [...rawGroups].sort((a, b) => a.sortOrder - b.sortOrder)
        const usedIds = new Set(mapped.map(p => p.category).filter(Boolean))
        // Tabs: only groups that actually have products
        cats = [
          { id: "__all__", label: "Tất cả" },
          ...sorted.filter(g => usedIds.has(g.id)).map(g => ({ id: g.id, label: g.name })),
        ]
        // Products whose group was deleted / not in groups list → "Khác"
        const knownIds = new Set(sorted.map(g => g.id))
        if (mapped.some(p => p.category && !knownIds.has(p.category))) {
          cats.push({ id: "__other__", label: "Khác" })
        }
      } else {
        // Fallback: derive directly from product category field
        const catMap = new Map<string, string>()
        mapped.forEach(p => { if (p.category && !catMap.has(p.category)) catMap.set(p.category, p.category) })
        cats = [{ id: "__all__", label: "Tất cả" }, ...Array.from(catMap.entries()).map(([id, label]) => ({ id, label }))]
      }
      setCategories(cats)
      setActiveTab(cats[0]?.id ?? "")

      // Load combo vouchers
      const now = new Date().toISOString()
      const { data: vouchers } = await supabase
        .from("vouchers")
        .select("id,title,discount_value,valid_to")
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .gte("valid_to", now)
      if (vouchers && vouchers.length > 0) {
        const vIds = vouchers.map((v: {id:string}) => v.id)
        const { data: ciRows } = await supabase
          .from("combo_items")
          .select("voucher_id,product_id,min_quantity,products(name,price)")
          .in("voucher_id", vIds)
        const ciMap: Record<string, ComboVoucher["items"]> = {}
        ;(ciRows ?? []).forEach((r: {voucher_id:string;product_id:string;min_quantity:number;products:{name:string;price:number}[]|null}) => {
          if (!ciMap[r.voucher_id]) ciMap[r.voucher_id] = []
          const prod = Array.isArray(r.products) ? r.products[0] : r.products
          ciMap[r.voucher_id].push({ productId: r.product_id, productName: (prod as {name:string;price:number}|null)?.name ?? "", productPrice: (prod as {name:string;price:number}|null)?.price ?? 0, minQty: r.min_quantity })
        })
        setCombos(vouchers.map((v: {id:string;title:string;discount_value:number;valid_to:string}) => ({
          id: v.id, title: v.title, discount: v.discount_value, endAt: v.valid_to,
          items: ciMap[v.id] ?? [],
        })))
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId])

  // Scroll header detection
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 130)
    el.addEventListener("scroll", onScroll, { passive:true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  const fireToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(""), 1800)
  }

  const uploadImage = async (file: File, type: "cover" | "logo") => {
    setUploading(type)
    const ext  = file.name.split(".").pop() ?? "jpg"
    const path = `${shopId}/${type}.${ext}`
    const bucket = type === "cover" ? "shop-covers" : "shop-logos"
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) { fireToast("Lỗi tải ảnh!"); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
    const col = type === "cover" ? "cover_image_url" : "logo_url"
    await supabase.from("shops").update({ [col]: publicUrl, updated_at: new Date().toISOString() }).eq("id", shopId)
    setShop(s => s ? { ...s, cover_url: type === "cover" ? publicUrl : s.cover_url, avatar_url: type === "logo" ? publicUrl : s.avatar_url } : s)
    fireToast(type === "cover" ? "Đã cập nhật ảnh bìa" : "Đã cập nhật logo")
    setUploading(null)
  }

  // Add to cart — kiểm tra conflict shop khác
  const handleAdd = useCallback((product: Product, btn: HTMLElement) => {
    if (product.toppings.length > 0 || product.sizes.length > 0) {
      setOptSheet(product)
      setSelSize(product.sizes[0]?.id ?? null)
      setSelTops([])
      setOptQty(1)
      setOptNote("")
      return
    }
    const newItem = { id: product.id, name: product.name, price: product.price, shop: shop?.name ?? "", shopId, imageUrl: product.imageUrl ?? undefined }
    if (storeShopId && storeShopId !== shopId) { setConflictItem(newItem); return }
    spawnParticle(btn, cartBadgeRef.current)
    addItem(newItem)
    fireToast(`Đã thêm ${product.name}`)
  }, [addItem, shopId, storeShopId, shop])

  const confirmOptions = useCallback(() => {
    if (!optSheet) return
    const sizeDiff  = optSheet.sizes.find(s => s.id === selSize)?.priceDiff ?? 0
    const topTotal  = selTops.reduce((s, tid) => s + (optSheet.toppings.find(t => t.id === tid)?.price ?? 0), 0)
    const unitPrice = optSheet.price + sizeDiff + topTotal
    const sizeLabel = optSheet.sizes.find(s => s.id === selSize)?.label
    const topLabels = selTops.map(tid => optSheet.toppings.find(t => t.id === tid)?.name).filter(Boolean)
    const optSuffix = [...(sizeLabel ? [sizeLabel] : []), ...topLabels].join(" · ")
    const itemName  = optSuffix ? `${optSheet.name} (${optSuffix})` : optSheet.name
    // note included in id so same product+options with different notes = separate cart items
    const noteSlug  = optNote.trim() ? `__${optNote.trim().slice(0, 30)}` : ""
    const itemId    = `${optSheet.id}__${selSize ?? "ns"}__${[...selTops].sort().join(",")}${noteSlug}`
    const newItem   = {
      id: itemId, name: itemName, price: unitPrice,
      shop: shop?.name ?? "", shopId, imageUrl: optSheet.imageUrl ?? undefined,
      note: optNote.trim() || undefined,
    }
    if (storeShopId && storeShopId !== shopId) {
      setConflictItem(newItem)
      setOptSheet(null)
      return
    }
    for (let i = 0; i < optQty; i++) addItem(newItem)
    setOptSheet(null)
    fireToast(`Đã thêm ${itemName}`)
  }, [optSheet, selSize, selTops, optQty, optNote, shop, shopId, storeShopId, addItem])

  const confirmReplace = () => {
    if (!conflictItem) return
    clearAndAdd(conflictItem)
    fireToast(`Đã thêm ${conflictItem.name}`)
    setConflictItem(null)
  }

  // Scroll to category section
  const scrollToSection = (id: string) => {
    setActiveTab(id)
    const el = sectionRefs.current[id]
    if (el && containerRef.current) {
      const top = el.offsetTop - 120
      containerRef.current.scrollTo({ top, behavior:"smooth" })
    }
  }

  const productsByCategory = (catId: string) => {
    if (catId === "__all__") return products
    if (catId === "__other__") {
      const knownIds = new Set(categories.filter(c => c.id !== "__all__" && c.id !== "__other__").map(c => c.id))
      return products.filter(p => !p.category || !knownIds.has(p.category))
    }
    return products.filter(p => p.category === catId)
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%;overflow:hidden}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        @keyframes shopShim{0%{left:-60%}100%{left:120%}}
        @keyframes shopPulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes shopBounce{0%,100%{transform:scale(1)}40%{transform:scale(1.25)}}
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}}
            exit={{opacity:0,y:-12}}
            style={{ position:"fixed", top:50, left:"50%",
              transform:"translateX(-50%)", zIndex:999, whiteSpace:"nowrap",
              background:"rgba(255,107,0,0.15)",
              border:"1px solid rgba(255,107,0,0.35)",
              borderRadius:12, padding:"7px 16px",
              color:"#FF8C00", fontSize:11, fontWeight:600,
              backdropFilter:"blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position:"fixed", inset:0, background:"#080806",
        display:"flex", flexDirection:"column" }}>

        {/* ── Sticky Header ── */}
        <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:40,
          background: scrolled ? "rgba(8,8,6,0.96)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "none",
          padding:"calc(env(safe-area-inset-top) + 10px) 16px 10px",
          transition:"all .25s" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/" style={{ width:32, height:32, borderRadius:9,
              background:"rgba(0,0,0,0.35)",
              border:"1px solid rgba(255,255,255,0.12)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:14, textDecoration:"none", color:"#f8f0e0",
              backdropFilter:"blur(8px)", flexShrink:0 }}>←</a>

            <AnimatePresence>
              {scrolled && (
                <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}
                  exit={{opacity:0,y:4}} style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:700,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {shop?.name ?? ""}
                  </div>
                  <div style={{ color:"#6a5a40", fontSize:8.5 }}>{shop?.description ?? ""}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
              <button onClick={() => setFavoured(f => !f)}
                style={{ width:32, height:32, borderRadius:9,
                  background:"rgba(0,0,0,0.35)",
                  border:`1px solid ${favoured?"rgba(255,64,64,0.4)":"rgba(255,255,255,0.12)"}`,
                  backdropFilter:"blur(8px)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:15, cursor:"pointer",
                  color: favoured ? "#ff4040" : "#f8f0e0",
                  animation: favoured ? "shopBounce .4s" : "none" }}>
                {favoured ? "❤️" : "🤍"}
              </button>
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/shop/${shopId}`
                  const title = shop?.name ?? "Giao Nhanh"
                  const text  = `Đặt đồ ăn tại ${title} trên Giao Nhanh!`
                  if (navigator.share) {
                    try { await navigator.share({ title, text, url }) } catch { /* user dismissed */ }
                  } else {
                    await navigator.clipboard.writeText(url)
                    fireToast("Đã sao chép link quán!")
                  }
                }}
                style={{ width:32, height:32, borderRadius:9,
                  background:"rgba(0,0,0,0.35)",
                  border:"1px solid rgba(255,255,255,0.12)",
                  backdropFilter:"blur(8px)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:15, cursor:"pointer" }}>
                🔗
              </button>
            </div>
          </div>
        </div>

        {/* ── Closed shop overlay ── */}
        {!loading && shop && !shop.is_open && (
          <div style={{ position:"absolute", inset:0, zIndex:200,
            background:"rgba(8,8,6,0.96)", backdropFilter:"blur(10px)",
            display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", padding:"32px 24px", gap:0 }}>
            {/* Back button */}
            <div style={{ position:"absolute", top:"max(44px,env(safe-area-inset-top))", left:16 }}>
              <a href="/" style={{ width:36, height:36, borderRadius:10,
                background:"rgba(255,255,255,0.07)",
                border:"1px solid rgba(255,255,255,0.12)",
                display:"flex", alignItems:"center", justifyContent:"center",
                textDecoration:"none", color:"#f8f0e0", fontSize:16 }}>←</a>
            </div>
            {/* Icon */}
            <div style={{ fontSize:64, marginBottom:20, opacity:.85 }}>🔒</div>
            <div style={{ color:"#f8f0e0", fontSize:20, fontWeight:800,
              textAlign:"center", marginBottom:8 }}>
              {shop.name}
            </div>
            <div style={{ background:"rgba(255,64,64,0.12)",
              border:"1px solid rgba(255,64,64,0.3)",
              borderRadius:10, padding:"6px 16px", marginBottom:20 }}>
              <span style={{ color:"#ff4040", fontSize:12, fontWeight:700 }}>
                🔴 Quán đang nghỉ
              </span>
            </div>
            <div style={{ color:"#6a5a40", fontSize:12, textAlign:"center",
              lineHeight:1.8, maxWidth:280 }}>
              Cửa hàng hiện chưa nhận đơn.
              <br />Bạn có thể quay lại sau hoặc chọn quán khác.
            </div>
            <button onClick={() => router.back()}
              style={{ marginTop:28, height:48, padding:"0 32px",
                borderRadius:14, border:"none",
                background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
                color:"#fff", fontSize:13, fontWeight:700,
                cursor:"pointer", fontFamily:"Lexend",
                boxShadow:"0 4px 18px rgba(255,107,0,0.35)" }}>
              ← Quay lại
            </button>
          </div>
        )}

        {/* ── Scrollable content ── */}
        <div ref={containerRef}
          style={{ flex:1, overflowY:"auto",
            paddingBottom: totalItems > 0 ? 144 : 88,
            WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* Loading state */}
          {loading && (
            <div style={{ height:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ color:"#6a5a40", fontSize:12 }}>Đang tải...</div>
            </div>
          )}

          {/* Hero */}
          <div style={{ height:220, position:"relative", overflow:"hidden",
            background: shop?.cover_url
              ? `url(${shop.cover_url}) center/cover`
              : "linear-gradient(135deg,#1a0800 0%,#2d1500 50%,#0d0600 100%)" }}>
            <div style={{ position:"absolute", top:-40, right:-40, width:180, height:180,
              background:"radial-gradient(circle,rgba(255,107,0,0.2) 0%,transparent 65%)" }} />
            <div style={{ position:"absolute", bottom:-30, left:-30, width:120, height:120,
              background:"radial-gradient(circle,rgba(255,179,71,0.15) 0%,transparent 65%)" }} />
            {!shop?.cover_url && (
              <div style={{ position:"absolute", right:24, top:"50%",
                transform:"translateY(-50%)", fontSize:80, opacity:.15 }}>🏪</div>
            )}
            <div style={{ position:"absolute", inset:0,
              background:"linear-gradient(to top,rgba(8,8,6,0.85) 0%,transparent 60%)" }} />
            {shop && (
              <div style={{ position:"absolute", top:92, right:16,
                display:"flex", alignItems:"center", gap:5,
                background: shop.is_open ? "rgba(62,207,110,0.15)" : "rgba(255,64,64,0.15)",
                border:`1px solid ${shop.is_open ? "rgba(62,207,110,0.35)" : "rgba(255,64,64,0.35)"}`,
                borderRadius:8, padding:"4px 10px", backdropFilter:"blur(8px)" }}>
                <div style={{ width:6, height:6, borderRadius:"50%",
                  background: shop.is_open ? "#3ecf6e" : "#ff4040",
                  animation:"shopPulse 1.5s infinite" }} />
                <span style={{ color: shop.is_open ? "#3ecf6e" : "#ff4040", fontSize:9.5, fontWeight:600 }}>
                  {shop.is_open ? "Đang mở cửa" : "Đã đóng cửa"}
                </span>
              </div>
            )}
          </div>

          {/* Shop info */}
          {shop && (
            <div style={{ padding:"0 16px" }}>

              {/* Avatar + Name row — avatar overlaps banner bottom */}
              <div style={{ display:"flex", alignItems:"flex-end", gap:12,
                marginTop:-40, marginBottom:14,
                position:"relative", zIndex:10 }}>

                {/* Logo circle */}
                <div style={{ width:78, height:78, borderRadius:"50%",
                  border:"3px solid #080806", overflow:"hidden", flexShrink:0,
                  background:"rgba(255,255,255,0.06)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:34,
                  boxShadow:"0 0 0 1px rgba(255,107,0,0.25),0 4px 20px rgba(0,0,0,0.6)" }}>
                  {shop.avatar_url
                    ? <img src={shop.avatar_url} alt={shop.name}
                        style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : "🏪"}
                </div>

                {/* Name + address */}
                <div style={{ flex:1, minWidth:0, paddingBottom:6 }}>
                  <div style={{ color:"#f8f0e0", fontSize:18, fontWeight:800, lineHeight:1.2,
                    marginBottom:4,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {shop.name}
                  </div>
                  <div style={{ color:"#6a5a40", fontSize:9.5, lineHeight:1.5,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {shop.description ? `${shop.description} · ` : ""}{shop.address.split(",")[0]}
                  </div>
                </div>
              </div>

              {/* Stats row: chuẩn bị → giờ mở → đánh giá */}
              <div style={{ display:"flex", gap:8, marginBottom:4 }}>
                {[
                  { icon:"⏱️", val: shop.prep_time ?? "10–15 phút", sub:"Thời gian chuẩn bị" },
                  { icon:"🕐", val: (() => {
                      if (!shop.opening_hours) return "07:00–21:00"
                      const hours = shop.opening_hours as { open?: string; close?: string } | null
                      if (hours?.open && hours?.close) return `${hours.open}–${hours.close}`
                      return "07:00–21:00"
                    })(), sub:"Thời gian mở cửa" },
                  { icon:"⭐", val: shop.rating?.toFixed(1) ?? "Mới", sub:`${shop.rating_count ?? 0} đánh giá` },
                ].map(s => (
                  <div key={s.icon} style={{ flex:1, textAlign:"center",
                    background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)",
                    borderRadius:10, padding:"8px 4px" }}>
                    <div style={{ fontSize:15, marginBottom:2 }}>{s.icon}</div>
                    <div style={{ color:"#f8f0e0", fontSize:10, fontWeight:700, lineHeight:1.2 }}>{s.val}</div>
                    <div style={{ color:"#6a5a40", fontSize:7.5 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Combo deals ── */}
          {combos.length > 0 && (
            <div style={{ padding:"10px 14px 0" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ fontSize:13 }}>🎁</span>
                <span style={{ color:"#f8f0e0", fontSize:12, fontWeight:700 }}>Combo ưu đãi</span>
                <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
              </div>
              <div style={{ display:"flex", gap:8, overflowX:"auto", scrollbarWidth:"none", paddingBottom:4 } as React.CSSProperties}>
                {combos.map(combo => {
                  const totalOriginal = combo.items.reduce((s, i) => s + i.productPrice * i.minQty, 0)
                  return (
                    <div key={combo.id} style={{ flexShrink:0, width:220,
                      background:"rgba(180,100,255,0.06)", border:"1px solid rgba(180,100,255,0.22)",
                      borderRadius:14, padding:"11px 13px" }}>
                      <div style={{ color:"#b464ff", fontSize:10, fontWeight:700, marginBottom:6 }}>{combo.title}</div>
                      <div style={{ marginBottom:8 }}>
                        {combo.items.map(item => (
                          <div key={item.productId} style={{ display:"flex", justifyContent:"space-between",
                            alignItems:"center", marginBottom:3 }}>
                            <span style={{ color:"#b0956a", fontSize:9.5, flex:1, overflow:"hidden",
                              textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {item.productName}
                            </span>
                            <span style={{ color:"#6a5a40", fontSize:8.5, flexShrink:0, marginLeft:4 }}>×{item.minQty}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                        <div>
                          {totalOriginal > 0 && (
                            <div style={{ color:"#6a5a40", fontSize:8.5, textDecoration:"line-through" }}>
                              {totalOriginal.toLocaleString("vi-VN")}đ
                            </div>
                          )}
                          <div style={{ background:"linear-gradient(90deg,#b464ff,#8b5cf6)",
                            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                            backgroundClip:"text", fontSize:13, fontWeight:800 }}>
                            {totalOriginal > 0 ? (totalOriginal - combo.discount).toLocaleString("vi-VN") + "đ" : `Giảm ${combo.discount.toLocaleString("vi-VN")}đ`}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            combo.items.forEach(item => {
                              const prod = products.find(p => p.id === item.productId)
                              if (!prod) return
                              const newItem = { id: prod.id, name: prod.name, price: prod.price, shop: shop?.name ?? "", shopId }
                              if (storeShopId && storeShopId !== shopId) { setConflictItem(newItem); return }
                              for (let q = 0; q < item.minQty; q++) addItem(newItem)
                            })
                            fireToast(`Đã thêm combo ${combo.title}`)
                          }}
                          style={{ height:30, padding:"0 12px", borderRadius:9, border:"none",
                            background:"linear-gradient(90deg,#b464ff,#8b5cf6)",
                            color:"#fff", fontSize:10, fontWeight:700,
                            cursor:"pointer", fontFamily:"Lexend", flexShrink:0,
                            boxShadow:"0 2px 10px rgba(180,100,255,0.35)" }}>
                          + Thêm combo
                        </button>
                      </div>
                      <div style={{ color:"#6a5a40", fontSize:7.5 }}>
                        HSD: {new Date(combo.endAt).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Category tabs (sticky) ── */}
          {categories.length > 0 && (
            <div ref={tabsRef} style={{ position:"sticky", top:72, zIndex:30,
              background:"rgba(8,8,6,0.95)", backdropFilter:"blur(12px)",
              borderBottom:"1px solid rgba(255,255,255,0.06)",
              padding:"10px 14px 10px", marginTop:12 }}>
              <div style={{ display:"flex", gap:6, overflowX:"auto",
                scrollbarWidth:"none" } as React.CSSProperties}>
                {categories.map(cat => {
                  const active = activeTab === cat.id
                  const cnt = productsByCategory(cat.id).length
                  return (
                    <button key={cat.id}
                      onClick={() => scrollToSection(cat.id)}
                      style={{ display:"flex", alignItems:"center", gap:4,
                        flexShrink:0, padding:"5px 12px", borderRadius:20, border:"none",
                        background: active ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                        outline:`${active ? 1.5 : 1}px solid ${active ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: active ? "#FF8C00" : "#6a5a40",
                        fontSize:10, fontWeight: active ? 600 : 400,
                        cursor:"pointer", fontFamily:"Lexend", transition:"all .2s" }}>
                      <span>{cat.label}</span>
                      <span style={{ color:"#6a5a40", fontSize:8.5 }}>({cnt})</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Product sections ── */}
          <div style={{ padding:"4px 14px 0" }}>
            {products.length === 0 && !loading && (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#6a5a40", fontSize:12 }}>
                Quán chưa có sản phẩm nào
              </div>
            )}
            {categories.map(cat => {
              const items = productsByCategory(cat.id)
              if (!items.length) return null
              return (
                <div key={cat.id}
                  ref={el => { sectionRefs.current[cat.id] = el }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"16px 0 4px" }}>
                    <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:700 }}>{cat.label}</div>
                    <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
                    <span style={{ color:"#6a5a40", fontSize:9 }}>{items.length} món</span>
                  </div>
                  {items.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAdd={handleAdd}
                      badgeRef={cartBadgeRef}
                    />
                  ))}
                </div>
              )
            })}

            {/* Bottom breathing room */}
            <div style={{ height:12 }} />
          </div>
        </div>

        {/* ── Cart bar (slides up when cart not empty) ── */}
        <AnimatePresence>
          {totalItems > 0 && (
            <motion.div
              initial={{ y:80, opacity:0 }}
              animate={{ y:0,  opacity:1 }}
              exit={{   y:80,  opacity:0 }}
              transition={{ type:"spring", damping:18, stiffness:200 }}
              style={{ position:"absolute", bottom:84, left:14, right:14,
                zIndex:45 }}>
              <div onClick={() => router.push("/cart")} style={{ cursor:"pointer" }}>
                <div style={{ background:"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
                  borderRadius:14, padding:"12px 16px",
                  display:"flex", alignItems:"center", gap:12,
                  boxShadow:"0 4px 24px rgba(255,107,0,0.45)",
                  position:"relative", overflow:"hidden" }}>
                  {/* Shimmer */}
                  <div style={{ position:"absolute", top:0, left:"-60%",
                    width:"35%", height:"100%",
                    background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                    animation:"shopShim 2.5s infinite" }} />

                  {/* Badge */}
                  <div ref={cartBadgeRef as React.RefObject<HTMLDivElement>}
                    style={{ width:30, height:30, borderRadius:9,
                      background:"rgba(0,0,0,0.2)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      flexShrink:0, position:"relative", zIndex:1 }}>
                    <span style={{ fontSize:16 }}>🛒</span>
                    <div style={{ position:"absolute", top:-5, right:-5,
                      background:"#fff", color:"#FF6B00",
                      borderRadius:"50%", width:16, height:16,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:9, fontWeight:800 }}>
                      {totalItems}
                    </div>
                  </div>

                  {/* Text */}
                  <div style={{ flex:1, position:"relative", zIndex:1 }}>
                    <div style={{ color:"#fff", fontSize:12, fontWeight:700 }}>
                      Xem giỏ hàng
                    </div>
                    <div style={{ color:"rgba(255,255,255,0.75)", fontSize:9.5 }}>
                      {totalItems} món · {fmt(totalPrice)}
                    </div>
                  </div>

                  <div style={{ color:"rgba(255,255,255,0.8)",
                    fontSize:18, position:"relative", zIndex:1 }}>→</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom Nav ── */}
        <div style={{ position:"absolute", bottom:"max(16px,env(safe-area-inset-bottom))",left:14, right:14, height:56,
          background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
          WebkitBackdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999,
          display:"flex", alignItems:"center", justifyContent:"space-around",
          padding:"0 6px", zIndex:50,
          boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            { icon:"🏠", label:"Trang chủ", href:"/",        active:false },
            { icon:"📋", label:"Đơn hàng",  href:"/orders",  active:false },
            { icon:"🛒", label:"Giỏ hàng",  href:"/cart",    active:false, badge: totalItems },
            { icon:"⚙️", label:"Cài đặt",   href:"/settings",active:false },
          ].map(tab => (
            <button key={tab.href} onClick={() => router.push(tab.href)}
              style={{ background: tab.active ? "rgba(255,107,0,0.12)" : "transparent",
                border:"none", display:"flex",
                flexDirection:"column", alignItems:"center",
                gap:2, padding:"5px 11px", borderRadius:18,
                cursor:"pointer", position:"relative", transition:"all .2s" }}>
              <span style={{ fontSize:19, position:"relative" }}>
                {tab.icon}
                {(tab.badge ?? 0) > 0 && (
                  <span style={{ position:"absolute", top:-5, right:-7,
                    background:"#ff4040", color:"#fff",
                    borderRadius:"50%", width:15, height:15,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:8, fontWeight:800 }}>
                    {tab.badge}
                  </span>
                )}
              </span>
              <span style={{ fontSize:7.5, color:"#6a5a40" }}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Options Sheet — size + topping ── */}
      <AnimatePresence>
        {optSheet && (
          <ProductSheet
            product={optSheet}
            selSize={selSize}
            selTops={selTops}
            qty={optQty}
            note={optNote}
            onSizeChange={id => setSelSize(id)}
            onToggleTop={id => setSelTops(ts => ts.includes(id) ? ts.filter(x => x !== id) : [...ts, id])}
            onQtyChange={q => setOptQty(q)}
            onNoteChange={n => setOptNote(n)}
            onClose={() => setOptSheet(null)}
            onConfirm={confirmOptions}
          />
        )}
      </AnimatePresence>

      {/* ── Conflict Modal — đổi quán ── */}
      <AnimatePresence>
        {conflictItem && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:"fixed", inset:0, zIndex:200,
              background:"rgba(0,0,0,0.72)", backdropFilter:"blur(6px)",
              display:"flex", alignItems:"flex-end", justifyContent:"center",
              padding:"0 16px 40px" }}
            onClick={() => setConflictItem(null)}>
            <motion.div
              initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:80, opacity:0 }}
              transition={{ type:"spring", damping:22, stiffness:260 }}
              onClick={e => e.stopPropagation()}
              style={{ background:"#151210", border:"1px solid rgba(255,107,0,0.28)",
                borderRadius:22, padding:"22px 18px 18px", width:"100%", maxWidth:420 }}>
              <div style={{ fontSize:32, textAlign:"center", marginBottom:8 }}>🛒</div>
              <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700,
                textAlign:"center", marginBottom:10 }}>
                Thay đổi quán?
              </div>
              <div style={{ color:"#b0956a", fontSize:12, textAlign:"center",
                lineHeight:1.7, marginBottom:20 }}>
                Giỏ hàng đang có món từ{" "}
                <span style={{ color:"#FF8C00", fontWeight:700 }}>{storeShopName}</span>.
                <br />Thêm món mới sẽ <strong style={{ color:"#ff6060" }}>xóa giỏ hàng hiện tại</strong>.
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button
                  onClick={() => setConflictItem(null)}
                  style={{ flex:1, height:48, borderRadius:13,
                    border:"1px solid rgba(255,255,255,0.1)",
                    background:"rgba(255,255,255,0.06)",
                    color:"#b0956a", fontSize:13, fontWeight:600,
                    cursor:"pointer", fontFamily:"Lexend" }}>
                  Giữ giỏ cũ
                </button>
                <button
                  onClick={confirmReplace}
                  style={{ flex:1, height:48, borderRadius:13, border:"none",
                    background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
                    color:"#fff", fontSize:13, fontWeight:700,
                    cursor:"pointer", fontFamily:"Lexend",
                    boxShadow:"0 4px 16px rgba(255,107,0,0.4)" }}>
                  Xóa &amp; thêm mới
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
