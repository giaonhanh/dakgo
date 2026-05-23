"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter, useParams } from "next/navigation"
import { formatPrice } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const CATEGORY_META: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  "buoi-sang": { icon:"☀️",  label:"Buổi sáng",  color:"#FFB347", bg:"rgba(255,179,71,0.08)",  border:"rgba(255,179,71,0.25)" },
  "buoi-trua": { icon:"🌤️", label:"Buổi trưa",  color:"#FF8C00", bg:"rgba(255,140,0,0.08)",   border:"rgba(255,140,0,0.25)"  },
  "buoi-toi":  { icon:"🌙",  label:"Buổi tối",   color:"#4a8ff5", bg:"rgba(74,143,245,0.08)",  border:"rgba(74,143,245,0.25)" },
  "nuoc-uong": { icon:"🧋",  label:"Nước uống",  color:"#3ecf6e", bg:"rgba(62,207,110,0.08)",  border:"rgba(62,207,110,0.25)" },
  "mon-nhau":  { icon:"🍺",  label:"Món nhậu",   color:"#b464ff", bg:"rgba(180,100,255,0.08)", border:"rgba(180,100,255,0.25)"},
  "an-vat":    { icon:"🍿",  label:"Ăn vặt",    color:"#ff6060", bg:"rgba(255,96,96,0.08)",   border:"rgba(255,96,96,0.25)"  },
}

// Keywords used to filter products client-side by category
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "buoi-sang": ["bánh mì","cháo","xôi","cà phê","cafe","sáng","bánh","trứng","bún","phở"],
  "buoi-trua": ["cơm","trưa","gà","heo","bún","phở","mì","cá"],
  "buoi-toi":  ["tối","lẩu","nướng","pizza","burger","đêm"],
  "nuoc-uong": ["trà","nước","sinh tố","boba","ép","đồ uống","café","cà phê","sữa"],
  "mon-nhau":  ["nhậu","lẩu","nướng","mực","hải sản","bia","nem","đậu"],
  "an-vat":    ["bánh","vặt","snack","kẹo","mochi","chả","bắp","ăn vặt"],
}

interface DBProduct {
  id: string; name: string; price: number; original_price: number | null
  sold_count: number; image_url: string | null
  shop_id: string; shop_name: string; shop_rating: number
}

export default function CategoryPage() {
  const router   = useRouter()
  const params   = useParams()
  const supabase = createClient()
  const category = (params?.category as string) ?? ""
  const meta     = CATEGORY_META[category]

  const [items,   setItems]   = useState<DBProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState("")
  const [sortBy,  setSortBy]  = useState<"popular" | "price_asc" | "price_desc">("popular")

  useEffect(() => {
    async function load() {
      setLoading(true)
      const keywords = CATEGORY_KEYWORDS[category] ?? []

      const { data } = await supabase
        .from("products")
        .select(`
          id, name, price, original_price, sold_count, image_url, shop_id,
          shops!inner(name, rating_avg, status, is_available)
        `)
        .eq("is_available", true)
        .eq("shops.status", "approved")
        .order("sold_count", { ascending: false })
        .limit(60)

      if (!data) { setLoading(false); return }

      const rows = (data as Array<{
        id:string; name:string; price:number; original_price:number|null
        sold_count:number; image_url:string|null; shop_id:string
        shops: { name:string; rating_avg:number; status:string; is_available:boolean } | Array<{ name:string; rating_avg:number; status:string; is_available:boolean }>
      }>)

      // Filter by category keywords (Vietnamese accent-insensitive)
      const normalize = (s: string) => s.toLowerCase()
        .replace(/[àáạảãăắặẳẵâấậẩẫ]/g,"a").replace(/[èéẹẻẽêếệểễ]/g,"e")
        .replace(/[ìíịỉĩ]/g,"i").replace(/[òóọỏõôốộổỗơớợởỡ]/g,"o")
        .replace(/[ùúụủũưứựửữ]/g,"u").replace(/[ỳýỵỷỹ]/g,"y").replace(/đ/g,"d")

      const matched = keywords.length > 0
        ? rows.filter(r => {
            const n = normalize(r.name)
            return keywords.some(k => n.includes(normalize(k)))
          })
        : rows

      setItems(matched.slice(0, 30).map(r => {
        const shop = Array.isArray(r.shops) ? r.shops[0] : r.shops
        return {
          id: r.id, name: r.name, price: r.price,
          original_price: r.original_price,
          sold_count: r.sold_count, image_url: r.image_url,
          shop_id: r.shop_id,
          shop_name: shop?.name ?? "Cửa hàng",
          shop_rating: Number(shop?.rating_avg ?? 5),
        }
      }))
      setLoading(false)
    }
    load()
  }, [category]) // eslint-disable-line react-hooks/exhaustive-deps

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2000) }

  const sorted = [...items].sort((a, b) => {
    if (sortBy === "price_asc")  return a.price - b.price
    if (sortBy === "price_desc") return b.price - a.price
    return b.sold_count - a.sold_count
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
            <div style={{ color:"#6a5a40", fontSize:9, marginTop:1 }}>
              {loading ? "Đang tải..." : `${items.length} món · Phước An, Krông Pắc`}
            </div>
          </div>
          <div style={{ background:meta.bg, border:`1px solid ${meta.border}`,
            borderRadius:20, padding:"4px 10px",
            color:meta.color, fontSize:9, fontWeight:700 }}>
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
            { key:"popular",    label:"🔥 Phổ biến"   },
            { key:"price_asc",  label:"💰 Giá thấp"   },
            { key:"price_desc", label:"💎 Giá cao"     },
          ] as const).map(opt => (
            <button key={opt.key} onClick={() => setSortBy(opt.key)}
              style={{ flexShrink:0, padding:"6px 13px", borderRadius:20, cursor:"pointer",
                fontFamily:"Lexend", fontSize:9.5, fontWeight:600,
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
              <a href={`/shop/${item.shop_id}`} style={{ textDecoration:"none" }}>
                <div style={{
                  background:"rgba(255,255,255,0.05)", backdropFilter:"blur(10px)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:16, padding:"11px 13px",
                  display:"flex", alignItems:"center", gap:12,
                  position:"relative", overflow:"hidden",
                }}>
                  {/* Image area */}
                  <div style={{ width:70, height:70, borderRadius:14, flexShrink:0,
                    background: item.image_url ? "transparent" : meta.bg,
                    border:`1px solid ${meta.border}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:34, position:"relative", overflow:"hidden" }}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : "🍽️"}
                    {item.original_price && item.original_price > item.price && (
                      <div style={{ position:"absolute", top:-5, left:-5,
                        background:"#ff4040", color:"#fff",
                        fontSize:7, fontWeight:700, padding:"2px 5px", borderRadius:5,
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
                    <div style={{ color:"#6a5a40", fontSize:9, marginBottom:5 }}>
                      🏪 {item.shop_name}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                        <span style={{ color:"#FFB347", fontSize:9 }}>★</span>
                        <span style={{ color:"#b0956a", fontSize:8.5 }}>{item.shop_rating.toFixed(1)}</span>
                      </div>
                      {item.sold_count > 0 && (
                        <>
                          <span style={{ color:"rgba(255,255,255,0.1)", fontSize:9 }}>·</span>
                          <span style={{ color:"#3ecf6e", fontSize:8, fontWeight:600 }}>
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
                        <div style={{ color:"#4a5040", fontSize:9, textDecoration:"line-through" }}>
                          {formatPrice(item.original_price)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* View button */}
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); router.push(`/shop/${item.shop_id}`) }}
                    style={{ width:36, height:36, borderRadius:11, flexShrink:0,
                      background:"linear-gradient(135deg,#FF6B00,#FF8C00)",
                      border:"none", color:"#fff", fontSize:20, fontWeight:700,
                      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                      boxShadow:"0 3px 10px rgba(255,107,0,0.4)", position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
                      background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)",
                      animation:"dmShim 2.5s infinite" }} />
                    <span style={{ position:"relative", zIndex:1 }}>›</span>
                  </button>
                </div>
              </a>
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
          { icon:"🛒", label:"Giỏ hàng",  href:"/cart" },
          { icon:"⚙️", label:"Cài đặt",   href:"/settings" },
        ].map(tab => (
          <a key={tab.href} href={tab.href}
            style={{ textDecoration:"none", display:"flex", flexDirection:"column",
              alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18 }}>
            <span style={{ fontSize:19 }}>{tab.icon}</span>
            <span style={{ fontSize:7.5, color:"#6a5a40" }}>{tab.label}</span>
          </a>
        ))}
      </div>
    </>
  )
}
