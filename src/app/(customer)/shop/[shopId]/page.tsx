"use client"

// src/app/(customer)/shop/[shopId]/page.tsx
// Trang quán ăn: hero · thông tin · category tabs · menu sản phẩm · cart bar

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useParams, useRouter } from "next/navigation"
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
}

interface ShopInfo {
  name:         string
  description:  string | null
  address:      string
  rating:       number | null
  rating_count: number | null
  is_open:      boolean
  avatar_url:   string | null
  cover_url:    string | null
  phone:        string | null
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
          <button ref={btnRef}
            onClick={() => btnRef.current && onAdd(product, btnRef.current)}
            style={{ width:36, height:36, borderRadius:10, border:"none",
              background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
              color:"#fff", fontSize:20, fontWeight:300, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 2px 10px rgba(255,107,0,0.4)",
              flexShrink:0, transition:"transform .15s, box-shadow .15s",
              lineHeight:1 }}>
            +
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────
export default function ShopPage() {
  const router   = useRouter()
  const params   = useParams()
  const shopId   = (params?.shopId as string) ?? ""
  const supabase = createClient()
  const addItem       = useCartStore(s => s.addItem)
  const clearAndAdd   = useCartStore(s => s.clearAndAdd)
  const storeShopId   = useCartStore(s => s.shopId)
  const storeShopName = useCartStore(s => s.items[0]?.shop ?? "")
  const totalItems    = useCartStore(s => s.totalQty())
  const totalPrice    = useCartStore(s => s.totalPrice())

  type PendingItem = { id:string; name:string; price:number; shop:string; shopId:string }
  const [shop,          setShop]          = useState<ShopInfo | null>(null)
  const [products,      setProducts]      = useState<Product[]>([])
  const [categories,    setCategories]    = useState<{id:string; label:string}[]>([])
  const [loading,       setLoading]       = useState(true)
  const [activeTab,     setActiveTab]     = useState("")
  const [scrolled,      setScrolled]      = useState(false)
  const [toast,         setToast]         = useState("")
  const [favoured,      setFavoured]      = useState(false)
  const [conflictItem,  setConflictItem]  = useState<PendingItem | null>(null)

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
        .select("name,description,address,rating,rating_count,is_open,avatar_url,cover_url,phone")
        .eq("id", shopId)
        .single()
      if (shopData) setShop(shopData as ShopInfo)

      // Products
      const { data: prodData } = await supabase
        .from("products")
        .select("id,name,description,price,category,is_available,sold_count,image_url")
        .eq("shop_id", shopId)
        .eq("is_available", true)
        .order("sort_order", { ascending: true })

      const mapped: Product[] = (prodData ?? []).map((p: {id:string;name:string;description:string|null;price:number;category:string|null;sold_count:number;image_url:string|null}) => ({
        id: p.id, name: p.name, desc: p.description ?? "",
        price: p.price, origPrice: null,
        category: p.category ?? "Thực đơn",
        imageUrl: p.image_url,
        sold: p.sold_count, hot: p.sold_count > 50,
      }))
      setProducts(mapped)

      // Derive categories from products
      const catMap = new Map<string, string>()
      mapped.forEach(p => { if (!catMap.has(p.category)) catMap.set(p.category, p.category) })
      const cats = [{ id:"__all__", label:"Tất cả" }, ...Array.from(catMap.entries()).map(([id, label]) => ({ id, label }))]
      setCategories(cats)
      setActiveTab(cats[0]?.id ?? "")

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

  // Add to cart — kiểm tra conflict shop khác
  const handleAdd = useCallback((product: Product, btn: HTMLElement) => {
    const newItem = { id: product.id, name: product.name, price: product.price, shop: shop?.name ?? "", shopId }
    if (storeShopId && storeShopId !== shopId) {
      setConflictItem(newItem)
      return
    }
    spawnParticle(btn, cartBadgeRef.current)
    addItem(newItem)
    fireToast(`Đã thêm ${product.name}`)
  }, [addItem, shopId, storeShopId, shop])

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

  const productsByCategory = (catId: string) =>
    catId === "__all__" ? products : products.filter(p => p.category === catId)

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
          padding:"44px 16px 10px",
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
          <div style={{ height:200, position:"relative", overflow:"hidden",
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

          {/* Shop info card */}
          {shop && (
            <div style={{ padding:"0 14px" }}>
              <div style={{ background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:16, padding:"14px", marginTop:-24,
                position:"relative", zIndex:10 }}>
                <div style={{ marginBottom:10 }}>
                  <div style={{ color:"#f8f0e0", fontSize:17, fontWeight:800, marginBottom:4 }}>
                    {shop.name}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    {shop.description && (
                      <span style={{ color:"#6a5a40", fontSize:9 }}>{shop.description}</span>
                    )}
                    <span style={{ color:"#6a5a40", fontSize:8.5 }}>· {shop.address.split(",")[0]}</span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  {[
                    { icon:"⭐", val: shop.rating?.toFixed(1) ?? "Mới", sub:`(${shop.rating_count ?? 0} đánh giá)` },
                    { icon:"📍", val: shop.address.split(",").slice(-1)[0]?.trim() ?? "Phước An", sub:"địa chỉ" },
                    { icon:"⏱️", val:"15–25 phút", sub:"giao hàng" },
                  ].map(s => (
                    <div key={s.icon} style={{ flex:1, textAlign:"center",
                      background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)",
                      borderRadius:10, padding:"7px 4px" }}>
                      <div style={{ fontSize:15, marginBottom:2 }}>{s.icon}</div>
                      <div style={{ color:"#f8f0e0", fontSize:11, fontWeight:700 }}>{s.val}</div>
                      <div style={{ color:"#6a5a40", fontSize:8 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { label:"Phí ship", val:fmt(15000), color:"#FF8C00" },
                    { label:"Đơn tối thiểu", val:fmt(30000), color:"#b0956a" },
                    { label:"Chuẩn bị", val:"10–15 phút", color:"#b0956a" },
                  ].map(d => (
                    <div key={d.label} style={{ flex:1, textAlign:"center" }}>
                      <div style={{ color:d.color, fontSize:11, fontWeight:700 }}>{d.val}</div>
                      <div style={{ color:"#6a5a40", fontSize:8 }}>{d.label}</div>
                    </div>
                  ))}
                </div>
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
