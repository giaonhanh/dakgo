"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SHOP_CATEGORIES, getCategoryByValue, normalizeCategoryValue } from "@/lib/categories"
import { useCartStore } from "@/store/cartStore"

interface ShopRow {
  id: string
  name: string
  address: string
  rating_avg: number | null
  total_orders: number
  image_url: string | null
  is_open: boolean
  opening_hours: { open?: string; close?: string } | null
  category: string
}

function isShopOpen(shop: ShopRow): boolean {
  const h = shop.opening_hours
  if (!h?.open || !h?.close) return shop.is_open
  const now = new Date()
  const vnMin = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes()
  const [oh, om] = h.open.split(":").map(Number)
  const [ch, cm] = h.close.split(":").map(Number)
  const openMin  = oh * 60 + om
  const closeMin = ch * 60 + cm
  return closeMin > openMin
    ? vnMin >= openMin && vnMin < closeMin
    : vnMin >= openMin || vnMin < closeMin
}

function openLabel(shop: ShopRow): string {
  const h = shop.opening_hours
  if (!h?.open) return ""
  return `Mở lúc ${h.open}`
}

export default function CategoryPage() {
  const router   = useRouter()
  const params   = useParams()
  const supabase = createClient()

  const slug = (params?.category as string) ?? ""
  const cat  = getCategoryByValue(slug)
  const validSlug = SHOP_CATEGORIES.some(c => c.value === slug)

  const { items: cartItems } = useCartStore()
  const totalQty = cartItems.reduce((s, i) => s + i.qty, 0)

  const [shops,   setShops]   = useState<ShopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy,  setSortBy]  = useState<"default" | "rating" | "orders">("default")
  const [toast,   setToast]   = useState("")

  useEffect(() => {
    if (!validSlug) { setLoading(false); return }
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from("shops")
        .select("id, name, address, rating_avg, total_orders, image_url, is_open, opening_hours, category")
        .eq("status", "approved")
        .order("rating_avg", { ascending: false })
        .limit(60)

      if (!data) { setLoading(false); return }

      const filtered = (data as ShopRow[]).filter(s =>
        normalizeCategoryValue(s.category ?? "khac") === slug
      )
      setShops(filtered)
      setLoading(false)
    }
    load()
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...shops].sort((a, b) => {
    const aOpen = isShopOpen(a) ? 0 : 1
    const bOpen = isShopOpen(b) ? 0 : 1
    if (aOpen !== bOpen) return aOpen - bOpen
    if (sortBy === "rating") return (b.rating_avg ?? 0) - (a.rating_avg ?? 0)
    if (sortBy === "orders") return (b.total_orders ?? 0) - (a.total_orders ?? 0)
    return (b.rating_avg ?? 0) - (a.rating_avg ?? 0)
  })

  const borderColor = cat.color.replace(/[\d.]+\)$/, "0.35)")
  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2000) }

  if (!validSlug) {
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
      `}</style>

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
        borderBottom:`1px solid ${borderColor}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => router.back()}
            style={{ width:40, height:40, borderRadius:12, background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:18, cursor:"pointer", flexShrink:0 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ color:"#f8f0e0", fontSize:16, fontWeight:800 }}>
              {cat.emoji} {cat.label}
            </div>
            <div style={{ color:"#6a5a40", fontSize:11, marginTop:1 }}>
              {loading ? "Đang tải..." : `${shops.length} cửa hàng · Krông Pắc`}
            </div>
          </div>
          <div style={{ background:cat.color, border:`1px solid ${borderColor}`,
            borderRadius:20, padding:"4px 10px", fontSize:11, fontWeight:700,
            color: "#f8f0e0" }}>
            {loading ? "..." : `${shops.length} quán`}
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
            { key:"default", label:"⭐ Nổi bật"   },
            { key:"rating",  label:"🏅 Đánh giá"  },
            { key:"orders",  label:"🔥 Nhiều đơn" },
          ] as const).map(opt => (
            <button key={opt.key} onClick={() => setSortBy(opt.key)}
              style={{ flexShrink:0, padding:"6px 13px", borderRadius:20, cursor:"pointer",
                fontFamily:"Lexend", fontSize:11, fontWeight:600,
                background: sortBy===opt.key ? cat.color : "rgba(255,255,255,0.05)",
                border: sortBy===opt.key ? `1px solid ${borderColor}` : "1px solid rgba(255,255,255,0.08)",
                color: sortBy===opt.key ? "#f8f0e0" : "#6a5a40",
                transition:"all .15s" }}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Shop list */}
        <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:10 }}>
          {loading ? (
            [1,2,3,4].map(i => (
              <div key={i} style={{ height:88, borderRadius:16,
                background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)" }} />
            ))
          ) : sorted.length === 0 ? (
            <div style={{ textAlign:"center", padding:"56px 0" }}>
              <div style={{ fontSize:52, marginBottom:12 }}>{cat.emoji}</div>
              <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:600, marginBottom:4 }}>
                Chưa có cửa hàng
              </div>
              <div style={{ color:"#6a5a40", fontSize:10 }}>
                Danh mục này đang được cập nhật
              </div>
            </div>
          ) : sorted.map((shop, i) => {
            const open = isShopOpen(shop)
            return (
              <motion.div key={shop.id}
                initial={{ opacity:0, y:12 }}
                animate={{ opacity:1, y:0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => {
                  if (!open) { fireToast(`🔴 ${openLabel(shop)}`); return }
                  router.push(`/shop/${shop.id}`)
                }}>
                <div style={{
                  background:"rgba(255,255,255,0.05)", backdropFilter:"blur(10px)",
                  border:`1px solid ${open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}`,
                  borderRadius:16, padding:"12px 13px",
                  display:"flex", alignItems:"center", gap:12,
                  opacity: open ? 1 : 0.55, cursor:"pointer", position:"relative",
                }}>
                  {/* Avatar */}
                  <div style={{ width:62, height:62, borderRadius:14, flexShrink:0,
                    background: cat.color, border:`1px solid ${borderColor}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:28, overflow:"hidden", position:"relative" }}>
                    {shop.image_url
                      ? <img src={shop.image_url} alt={shop.name}
                          style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : cat.emoji}
                    {!open && (
                      <div style={{ position:"absolute", inset:0,
                        background:"rgba(8,8,6,0.6)", display:"flex",
                        alignItems:"center", justifyContent:"center",
                        fontSize:18, borderRadius:14 }}>🔴</div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:700,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {shop.name}
                    </div>
                    <div style={{ color:"#6a5a40", fontSize:10, marginTop:2,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      📍 {shop.address || "Krông Pắc"}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:5 }}>
                      <span style={{ color:"#FFB347", fontSize:11 }}>
                        ★ {(shop.rating_avg ?? 5).toFixed(1)}
                      </span>
                      {(shop.total_orders ?? 0) > 0 && (
                        <>
                          <span style={{ color:"rgba(255,255,255,0.1)" }}>·</span>
                          <span style={{ color:"#6a5a40", fontSize:10 }}>
                            {shop.total_orders.toLocaleString("vi-VN")} đơn
                          </span>
                        </>
                      )}
                      <span style={{ color:"rgba(255,255,255,0.1)" }}>·</span>
                      {open ? (
                        <span style={{ color:"#3ecf6e", fontSize:10, fontWeight:600 }}>🟢 Đang mở</span>
                      ) : (
                        <span style={{ color:"#ff6060", fontSize:10, fontWeight:600 }}>
                          🔴 {openLabel(shop) || "Đóng cửa"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  {open && (
                    <div style={{ color:"#6a5a40", fontSize:18, flexShrink:0 }}>›</div>
                  )}
                </div>
              </motion.div>
            )
          })}
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
              alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18, position:"relative" }}>
            <span style={{ fontSize:19 }}>{tab.icon}</span>
            {"badge" in tab && tab.badge > 0 && (
              <div style={{ position:"absolute", top:1, right:6,
                width:14, height:14, borderRadius:99,
                background:"#ff4040", color:"#fff",
                fontSize:10, fontWeight:800,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                {tab.badge > 9 ? "9+" : tab.badge}
              </div>
            )}
            <span style={{ fontSize:10, color:"#6a5a40" }}>{tab.label}</span>
          </a>
        ))}
      </div>
    </>
  )
}
