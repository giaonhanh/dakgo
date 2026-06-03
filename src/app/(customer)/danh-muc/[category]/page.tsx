"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter, useParams } from "next/navigation"
import { formatPrice } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useCartStore } from "@/store/cartStore"

const CATEGORY_META: Record<string, { icon: string; label: string; tag: string; color: string; bg: string; border: string }> = {
  "buoi-sang": { icon:"☀️",  label:"Buổi sáng", tag:"Buổi sáng", color:"#FFB347", bg:"rgba(255,179,71,0.08)",  border:"rgba(255,179,71,0.25)" },
  "buoi-trua": { icon:"🌤️", label:"Buổi trưa", tag:"Buổi trưa", color:"#FF8C00", bg:"rgba(255,140,0,0.08)",   border:"rgba(255,140,0,0.25)"  },
  "buoi-toi":  { icon:"🌙",  label:"Buổi tối",  tag:"Buổi tối",  color:"#4a8ff5", bg:"rgba(74,143,245,0.08)",  border:"rgba(74,143,245,0.25)" },
  "nuoc-uong": { icon:"🧋",  label:"Nước uống", tag:"Nước uống", color:"#3ecf6e", bg:"rgba(62,207,110,0.08)",  border:"rgba(62,207,110,0.25)" },
  "mon-nhau":  { icon:"🍺",  label:"Món nhậu",  tag:"Món nhậu",  color:"#b464ff", bg:"rgba(180,100,255,0.08)", border:"rgba(180,100,255,0.25)"},
  "an-vat":    { icon:"🍿",  label:"Ăn vặt",    tag:"Ăn vặt",    color:"#ff6060", bg:"rgba(255,96,96,0.08)",   border:"rgba(255,96,96,0.25)"  },
}

interface DBProduct {
  id: string; name: string; price: number; original_price: number | null
  sold_count: number; image_url: string | null
  shop_id: string; shop_name: string; shop_rating: number
  created_at: string
}

export default function CategoryPage() {
  const router   = useRouter()
  const params   = useParams()
  const supabase = createClient()
  const category = (params?.category as string) ?? ""
  const meta     = CATEGORY_META[category]

  const { items: cartItems, addItem, clearAndAdd, shopId: cartShopId } = useCartStore()
  const totalQty = cartItems.reduce((s, i) => s + i.qty, 0)

  const [items,       setItems]       = useState<DBProduct[]>([])
  const [loading,     setLoading]     = useState(true)
  const [toast,       setToast]       = useState("")
  const [sortBy,      setSortBy]      = useState<"nearest" | "bestseller" | "newest">("nearest")
  const [conflict,    setConflict]    = useState<DBProduct | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const tag = meta?.tag
      if (!tag) { setLoading(false); return }

      const { data } = await supabase
        .from("products")
        .select(`
          id, name, price, original_price, sold_count, image_url, shop_id, created_at,
          shops!inner(name, rating_avg, status, is_open)
        `)
        .eq("is_available", true)
        .eq("shops.status", "approved")
        .eq("shops.is_open", true)
        .contains("tags", [tag])
        .order("sold_count", { ascending: false })
        .limit(60)

      if (!data) { setLoading(false); return }

      const rows = (data as Array<{
        id:string; name:string; price:number; original_price:number|null
        sold_count:number; image_url:string|null; shop_id:string; created_at:string
        shops: { name:string; rating_avg:number } | Array<{ name:string; rating_avg:number }>
      }>)

      setItems(rows.map(r => {
        const shop = Array.isArray(r.shops) ? r.shops[0] : r.shops
        return {
          id: r.id, name: r.name, price: r.price,
          original_price: r.original_price,
          sold_count: r.sold_count, image_url: r.image_url,
          shop_id: r.shop_id,
          shop_name: shop?.name ?? "Cửa hàng",
          shop_rating: Number(shop?.rating_avg ?? 5),
          created_at: r.created_at,
        }
      }))
      setLoading(false)
    }
    load()
  }, [category]) // eslint-disable-line react-hooks/exhaustive-deps

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2000) }

  const handleAdd = (item: DBProduct) => {
    if (cartShopId && cartShopId !== item.shop_id && cartItems.length > 0) {
      setConflict(item)
      return
    }
    addItem({ id: item.id, name: item.name, price: item.price, shop: item.shop_name, shopId: item.shop_id, imageUrl: item.image_url ?? undefined })
    fireToast("✅ Đã thêm vào giỏ hàng")
  }

  const confirmConflict = () => {
    if (!conflict) return
    clearAndAdd({ id: conflict.id, name: conflict.name, price: conflict.price, shop: conflict.shop_name, shopId: conflict.shop_id, imageUrl: conflict.image_url ?? undefined })
    setConflict(null)
    fireToast("✅ Đã thêm vào giỏ hàng")
  }

  const sorted = [...items].sort((a, b) => {
    if (sortBy === "bestseller") return b.sold_count - a.sold_count
    if (sortBy === "newest")     return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return 0 // "nearest" giữ thứ tự DB
  })

  if (!meta) {
    return (
      <div style={{ minHeight:"100dvh", background:"#080806", display:"flex",
        flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
        <div style={{ fontSize:48 }}>🔍</div>
        <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:600 }}>Danh mục không tồn tại</div>
        <button onClick={() => router.back()}
          style={{ padding:"8px 20px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)",
            background:"rgba(255,255,255,0.06)", color:"#b0956a", fontSize:12, cursor:"pointer",
            fontFamily:"Lexend" }}>← Quay lại</button>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        @keyframes dmShim{0%{left:-60%}100%{left:120%}}
      `}</style>

      {/* Conflict modal — giỏ hàng từ cửa hàng khác */}
      <AnimatePresence>
        {conflict && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:"fixed", inset:0, zIndex:9000,
              background:"rgba(8,8,6,0.85)", backdropFilter:"blur(10px)",
              display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 16px 40px" }}>
            <motion.div initial={{y:60}} animate={{y:0}} exit={{y:60}}
              style={{ width:"100%", maxWidth:400,
                background:"rgba(20,18,14,0.98)", borderRadius:20,
                border:"1px solid rgba(255,107,0,0.25)", padding:"20px 20px 16px" }}>
              <div style={{ fontSize:22, textAlign:"center", marginBottom:10 }}>🛒</div>
              <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:700, textAlign:"center", marginBottom:6 }}>
                Thêm từ cửa hàng khác?
              </div>
              <div style={{ color:"#6a5a40", fontSize:10.5, textAlign:"center", lineHeight:1.7, marginBottom:18 }}>
                Giỏ hàng đang có món từ cửa hàng khác.<br/>
                Thêm món này sẽ xoá giỏ hàng cũ.
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setConflict(null)}
                  style={{ flex:1, height:42, borderRadius:12,
                    background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                    color:"#6a5a40", fontSize:12, fontWeight:600, cursor:"pointer",
                    fontFamily:"Lexend" }}>
                  Giữ giỏ cũ
                </button>
                <button onClick={confirmConflict}
                  style={{ flex:1, height:42, borderRadius:12,
                    background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
                    border:"none", color:"#fff", fontSize:12, fontWeight:700,
                    cursor:"pointer", fontFamily:"Lexend" }}>
                  Thêm món mới
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}
            style={{ position:"fixed", top:"calc(env(safe-area-inset-top,0px) + 56px)",
              left:"50%", transform:"translateX(-50%)", zIndex:999, whiteSpace:"nowrap",
              background:"rgba(255,107,0,0.15)", border:"1px solid rgba(255,107,0,0.35)",
              borderRadius:12, padding:"7px 16px", color:"#FF8C00", fontSize:11, fontWeight:600,
              backdropFilter:"blur(10px)" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:40,
        padding:"calc(env(safe-area-inset-top,0px) + 12px) 16px 12px",
        background:"rgba(8,8,6,0.97)", backdropFilter:"blur(20px)",
        borderBottom:`1px solid ${meta.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => router.back()}
            style={{ width:40, height:40, borderRadius:12, background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:18, cursor:"pointer", flexShrink:0 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ color:"#f8f0e0", fontSize:16, fontWeight:800 }}>
              {meta.icon} {meta.label}
            </div>
            <div style={{ color:"#6a5a40", fontSize: 11, marginTop:1 }}>
              {loading ? "Đang tải..." : `${items.length} món · Phước An, Krông Pắc`}
            </div>
          </div>
          <div style={{ background:meta.bg, border:`1px solid ${meta.border}`,
            borderRadius:20, padding:"4px 10px",
            color:meta.color, fontSize: 11, fontWeight:700 }}>
            {loading ? "..." : `${items.length} món`}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ minHeight:"100dvh", background:"#080806",
        paddingTop:"calc(env(safe-area-inset-top,0px) + 72px)",
        paddingBottom:"calc(env(safe-area-inset-bottom,0px) + 80px)" }}>

        {/* Sort bar */}
        <div style={{ display:"flex", gap:7, padding:"12px 16px 10px", overflowX:"auto", scrollbarWidth:"none" }}>
          {([
            { key:"nearest",    label:"📍 Gần bạn nhất" },
            { key:"bestseller", label:"🔥 Bán chạy"     },
            { key:"newest",     label:"🆕 Món mới"      },
          ] as const).map(opt => (
            <button key={opt.key} onClick={() => setSortBy(opt.key)}
              style={{ flexShrink:0, padding:"6px 13px", borderRadius:20, cursor:"pointer",
                fontFamily:"Lexend", fontSize: 11, fontWeight:600,
                background: sortBy===opt.key ? meta.bg : "rgba(255,255,255,0.05)",
                border: sortBy===opt.key ? `1px solid ${meta.border}` : "1px solid rgba(255,255,255,0.08)",
                color: sortBy===opt.key ? meta.color : "#6a5a40",
                transition:"all .15s",
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Items */}
        <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:10 }}>
          {loading ? (
            [1,2,3,4].map(i => (
              <div key={i} style={{ height:92, borderRadius:16,
                background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)",
                animation:"pulse 1.5s infinite" }} />
            ))
          ) : sorted.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 0" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🍽️</div>
              <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:600, marginBottom:4 }}>
                Chưa có món ăn
              </div>
              <div style={{ color:"#6a5a40", fontSize:10 }}>
                Danh mục này đang được cập nhật
              </div>
            </div>
          ) : sorted.map((item, i) => (
            <motion.div key={item.id}
              initial={{ opacity:0, y:12 }}
              animate={{ opacity:1, y:0 }}
              transition={{ delay: i * 0.04 }}>
              <div style={{
                background:"rgba(255,255,255,0.05)", backdropFilter:"blur(10px)",
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:16, padding:"11px 13px",
                display:"flex", alignItems:"center", gap:12,
                position:"relative", overflow:"hidden",
              }}>
                {/* Image — tap to open shop */}
                <div onClick={() => router.push(`/shop/${item.shop_id}`)}
                  style={{ width:70, height:70, borderRadius:14, flexShrink:0,
                    background: item.image_url ? "transparent" : meta.bg,
                    border:`1px solid ${meta.border}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:34, position:"relative", overflow:"hidden", cursor:"pointer" }}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : "🍽️"}
                  {item.original_price && item.original_price > item.price && (
                    <div style={{ position:"absolute", top:-5, left:-5,
                      background:"#ff4040", color:"#fff",
                      fontSize: 10, fontWeight:700, padding:"2px 5px", borderRadius:5,
                      boxShadow:"0 0 5px rgba(255,64,64,0.3)" }}>
                      -{Math.round((1-item.price/item.original_price)*100)}%
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700, marginBottom:3,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {item.name}
                  </div>
                  <div onClick={() => router.push(`/shop/${item.shop_id}`)}
                    style={{ color:"#6a5a40", fontSize: 11, marginBottom:5, cursor:"pointer" }}>
                    🏪 {item.shop_name}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                      <span style={{ color:"#FFB347", fontSize: 11 }}>★</span>
                      <span style={{ color:"#b0956a", fontSize: 11 }}>{item.shop_rating.toFixed(1)}</span>
                    </div>
                    {item.sold_count > 0 && (
                      <>
                        <span style={{ color:"rgba(255,255,255,0.1)", fontSize: 11 }}>·</span>
                        <span style={{ color:"#3ecf6e", fontSize: 11, fontWeight:600 }}>
                          🔥 {item.sold_count.toLocaleString("vi-VN")} đã bán
                        </span>
                      </>
                    )}
                  </div>
                  {/* Price */}
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                    <div style={{
                      background:"linear-gradient(135deg,#FF6B00,#FFB347)",
                      WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                      backgroundClip:"text", fontSize:13, fontWeight:800,
                    }}>{formatPrice(item.price)}</div>
                    {item.original_price && item.original_price > item.price && (
                      <div style={{ color:"#4a5040", fontSize: 11, textDecoration:"line-through" }}>
                        {formatPrice(item.original_price)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add to cart button */}
                <button
                  onClick={() => handleAdd(item)}
                  style={{ width:36, height:36, borderRadius:11, flexShrink:0,
                    background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
                    border:"none", color:"#fff", fontSize:24, fontWeight:400,
                    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                    boxShadow:"0 3px 10px rgba(255,107,0,0.4)", position:"relative", overflow:"hidden",
                    lineHeight:1 }}>
                  <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
                    background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)",
                    animation:"dmShim 2.5s infinite" }} />
                  <span style={{ position:"relative", zIndex:1 }}>+</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:"max(16px,env(safe-area-inset-bottom))", left:14, right:14, height:56,
        background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
        border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999,
        display:"flex", alignItems:"center", justifyContent:"space-around",
        padding:"0 6px", zIndex:50, boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
        {[
          { icon:"🏠", label:"Trang chủ", href:"/" },
          { icon:"📋", label:"Đơn hàng",  href:"/orders" },
          { icon:"🛒", label:"Giỏ hàng",  href:"/cart", badge: totalQty },
          { icon:"⚙️", label:"Cài đặt",   href:"/settings" },
        ].map(tab => (
          <a key={tab.href} href={tab.href}
            style={{ textDecoration:"none", display:"flex", flexDirection:"column",
              alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18,
              position:"relative" }}>
            <span style={{ fontSize:19 }}>{tab.icon}</span>
            {"badge" in tab && tab.badge > 0 && (
              <div style={{ position:"absolute", top:1, right:6,
                width:14, height:14, borderRadius:99,
                background:"#ff4040", color:"#fff",
                fontSize: 10, fontWeight:800,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                {tab.badge > 9 ? "9+" : tab.badge}
              </div>
            )}
            <span style={{ fontSize: 10, color:"#6a5a40" }}>{tab.label}</span>
          </a>
        ))}
      </div>
    </>
  )
}
