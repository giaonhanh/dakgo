"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

interface Product {
  id: string
  name: string
  price: number
  originalPrice?: number
  category: string
  imagePreview: string | null
  available: boolean
  badge: "hot" | "bigsale" | "bestseller" | null
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"
const BADGE_CFG = {
  hot:        { label:"🔥 HOT",      color:"#ff4040", bg:"rgba(255,64,64,0.15)"   },
  bigsale:    { label:"💸 BIG SALE", color:"#FFD700", bg:"rgba(255,215,0,0.12)"   },
  bestseller: { label:"📈 BÁN CHẠY", color:"#3ecf6e", bg:"rgba(62,207,110,0.12)" },
}

export default function ShopPreviewPage() {
  const supabase = createClient()

  const [shopId, setShopId]         = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [uploading, setUploading]   = useState<"cover" | "logo" | null>(null)
  const [coverUrl, setCoverUrl]     = useState<string | null>(null)
  const [logoUrl, setLogoUrl]       = useState<string | null>(null)
  const [shopName, setShopName]     = useState("")
  const [category, setCategory]     = useState("")
  const [address, setAddress]       = useState("")
  const [rating, setRating]         = useState(5.0)
  const [totalReviews, setTotalReviews] = useState(0)
  const [isOpen, setIsOpen]         = useState(false)
  const [products, setProducts]     = useState<Product[]>([])
  const [prepTime, setPrepTime]     = useState("10–15")
  const [todayLabel, setTodayLabel] = useState("07:00–21:00")
  const [todayClosed, setTodayClosed] = useState(false)
  const [activeTab, setActiveTab]   = useState("Tất cả")
  const [toast, setToast]           = useState("")

  const coverRef = useRef<HTMLInputElement>(null)
  const logoRef  = useRef<HTMLInputElement>(null)

  const fire = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(""), 2400)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: shop } = await supabase.from("shops")
        .select("id,name,category,address,rating_avg,total_reviews,is_open,cover_image_url,logo_url")
        .eq("owner_id", user.id).single()
      if (shop) {
        setShopId(shop.id)
        setShopName(shop.name ?? "")
        setCategory(shop.category ?? "")
        setAddress(shop.address ?? "")
        setRating(shop.rating_avg ?? 5.0)
        setTotalReviews(shop.total_reviews ?? 0)
        setIsOpen(shop.is_open)
        if (shop.cover_image_url) setCoverUrl(shop.cover_image_url)
        if (shop.logo_url) setLogoUrl(shop.logo_url)
        const { data: prods } = await supabase.from("products")
          .select("id,name,price,original_price,category,image_url,is_available,sold_count")
          .eq("shop_id", shop.id)
          .eq("is_available", true)
          .order("sort_order")
        if (prods) {
          setProducts(prods.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            originalPrice: p.original_price ?? undefined,
            category: p.category ?? "Khác",
            imagePreview: p.image_url ?? null,
            available: p.is_available,
            badge: p.sold_count >= 20 ? "bestseller" : null,
          })))
        }
      }
      // Read localStorage for hours/prep overrides
      try {
        const saved = localStorage.getItem("merchant_shop_hours")
        if (saved) {
          const arr = JSON.parse(saved)
          const jsDay = new Date().getDay()
          const idx = jsDay === 0 ? 6 : jsDay - 1
          const today = arr[idx]
          if (today) {
            if (!today.open) {
              setTodayClosed(true)
            } else if (Array.isArray(today.slots) && today.slots.length > 0) {
              setTodayLabel(today.slots.map((s: { from: string; to: string }) => `${s.from}–${s.to}`).join(" · "))
            } else if (today.from) {
              setTodayLabel(`${today.from}–${today.to}`)
            }
          }
        }
      } catch { /* ignore */ }
      try {
        const pt = localStorage.getItem("merchant_prep_time")
        if (pt) setPrepTime(pt)
      } catch { /* ignore */ }
      setLoading(false)
    }
    init()
  }, [supabase])

  const cats = useMemo(() =>
    ["Tất cả", ...Array.from(new Set(products.map(p => p.category)))],
  [products])

  const displayed = useMemo(() =>
    activeTab === "Tất cả" ? products : products.filter(p => p.category === activeTab),
  [products, activeTab])

  const compressImage = (file: File, maxW: number, maxH: number, quality: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement("canvas")
        canvas.width = w; canvas.height = h
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h)
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("compress failed")), "image/webp", quality)
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })

  const onCoverFile = async (file: File) => {
    if (!shopId) return
    const localUrl = URL.createObjectURL(file)
    setCoverUrl(localUrl)
    setUploading("cover")
    const compressed = await compressImage(file, 1200, 480, 0.92).catch(() => file)
    const path = `${shopId}/cover`
    const { error: upErr } = await supabase.storage.from("shops").upload(path, compressed, { upsert: true, contentType: "image/webp" })
    if (upErr) { fire("❌ Lỗi tải ảnh bìa: " + upErr.message); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from("shops").getPublicUrl(path)
    const urlWithBust = `${publicUrl}?t=${Date.now()}`
    const { error: dbErr } = await supabase.from("shops").update({ cover_image_url: urlWithBust }).eq("id", shopId)
    if (dbErr) { fire("❌ Không lưu được vào DB: " + dbErr.message); setUploading(null); return }
    setCoverUrl(urlWithBust)
    setUploading(null)
    fire("Đã cập nhật ảnh bìa")
  }

  const onLogoFile = async (file: File) => {
    if (!shopId) return
    const localUrl = URL.createObjectURL(file)
    setLogoUrl(localUrl)
    setUploading("logo")
    const compressed = await compressImage(file, 400, 400, 0.92).catch(() => file)
    const path = `${shopId}/logo`
    const { error: upErr } = await supabase.storage.from("shops").upload(path, compressed, { upsert: true, contentType: "image/webp" })
    if (upErr) { fire("❌ Lỗi tải logo: " + upErr.message); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from("shops").getPublicUrl(path)
    const logoWithBust = `${publicUrl}?t=${Date.now()}`
    const { error: dbErr } = await supabase.from("shops").update({ logo_url: logoWithBust }).eq("id", shopId)
    if (dbErr) { fire("❌ Không lưu được vào DB: " + dbErr.message); setUploading(null); return }
    setLogoUrl(logoWithBust)
    setUploading(null)
    fire("Đã cập nhật logo cửa hàng")
  }

  if (loading) {
    return (
      <div style={{ position:"fixed", inset:0, background:"#080806",
        display:"flex", alignItems:"center", justifyContent:"center",
        flexDirection:"column", gap:12, fontFamily:"'Lexend',sans-serif" }}>
        <div style={{ width:36, height:36, borderRadius:"50%",
          border:"3px solid rgba(255,107,0,0.2)", borderTop:"3px solid #FF6B00",
          animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ color:"#6a5a40", fontSize:11 }}>Đang tải xem trước...</div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{display:none}
      `}</style>

      {/* Hidden file inputs */}
      <input ref={coverRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e => { const f=e.target.files?.[0]; if(f) onCoverFile(f); e.target.value="" }} />
      <input ref={logoRef}  type="file" accept="image/*" style={{display:"none"}}
        onChange={e => { const f=e.target.files?.[0]; if(f) onLogoFile(f);  e.target.value="" }} />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}
            style={{position:"fixed",top:56,left:"50%",transform:"translateX(-50%)",zIndex:999,whiteSpace:"nowrap",
              background:"rgba(62,207,110,0.15)",border:"1px solid rgba(62,207,110,0.35)",
              borderRadius:12,padding:"7px 18px",color:"#3ecf6e",fontSize:11,fontWeight:600,backdropFilter:"blur(10px)"}}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{minHeight:"100dvh",background:"#080806",fontFamily:"'Lexend',sans-serif",paddingBottom:32}}>

        {/* ── Merchant preview banner ── */}
        <div style={{background:"linear-gradient(90deg,rgba(255,140,0,0.18),rgba(255,107,0,0.1))",borderBottom:"1px solid rgba(255,107,0,0.25)",padding:"calc(env(safe-area-inset-top) + 10px) 16px 10px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:30,backdropFilter:"blur(12px)"}}>
          <a href="/merchant" style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:14,flexShrink:0}}>←</a>
          <div style={{flex:1}}>
            <div style={{color:"#FF8C00",fontSize:11,fontWeight:800}}>👁 Chế độ xem trước</div>
            <div style={{color:"rgba(255,140,0,0.65)",fontSize:9}}>Đây là giao diện khách hàng nhìn thấy</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={() => coverRef.current?.click()} disabled={uploading === "cover"}
              style={{background:"rgba(255,107,0,0.12)",border:"1px solid rgba(255,107,0,0.3)",borderRadius:8,padding:"5px 10px",color:"#FF8C00",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",whiteSpace:"nowrap",opacity:uploading==="cover"?0.5:1}}>
              {uploading === "cover" ? "Đang tải..." : "🖼 Đổi ảnh bìa"}
            </button>
            <button onClick={() => logoRef.current?.click()} disabled={uploading === "logo"}
              style={{background:"rgba(255,107,0,0.12)",border:"1px solid rgba(255,107,0,0.3)",borderRadius:8,padding:"5px 10px",color:"#FF8C00",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",whiteSpace:"nowrap",opacity:uploading==="logo"?0.5:1}}>
              {uploading === "logo" ? "Đang tải..." : "🏪 Đổi logo"}
            </button>
          </div>
        </div>

        {/* ── Image size guidelines ── */}
        <div style={{padding:"10px 16px",background:"rgba(74,143,245,0.05)",borderBottom:"1px solid rgba(74,143,245,0.1)"}}>
          <div style={{color:"#4a8ff5",fontSize:9,fontWeight:800,marginBottom:6}}>📐 Kích thước ảnh tối ưu</div>
          <div style={{display:"flex",gap:6,overflowX:"auto"} as React.CSSProperties}>
            {[
              {icon:"🖼️", label:"Ảnh bìa",  size:"800×400px", note:"Tỉ lệ 2:1"},
              {icon:"🏪", label:"Logo",      size:"300×300px", note:"Tỉ lệ 1:1"},
              {icon:"🍽️", label:"Ảnh món",  size:"400×400px", note:"Tỉ lệ 1:1"},
            ].map(t => (
              <div key={t.label} style={{flexShrink:0,display:"flex",alignItems:"center",gap:5,padding:"5px 10px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8}}>
                <span style={{fontSize:14}}>{t.icon}</span>
                <div>
                  <div style={{color:"#f8f0e0",fontSize:9,fontWeight:700}}>{t.label}: <span style={{color:"#FF8C00"}}>{t.size}</span></div>
                  <div style={{color:"#6a5a40",fontSize:8}}>{t.note} · JPG/PNG/WEBP</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Cover image ── */}
        <div style={{position:"relative",height:220,background:"linear-gradient(135deg,#1a0a00,#2d1200,#0d0600)",overflow:"hidden",cursor:"pointer"}}
          onClick={() => coverRef.current?.click()}>
          {coverUrl
            ? <img src={coverUrl} alt="Cover" style={{width:"100%",height:"100%",objectFit:"cover"}} />
            : (
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
                <div style={{fontSize:36,opacity:0.3}}>🖼</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontWeight:600}}>Nhấn để tải ảnh bìa</div>
                <div style={{color:"rgba(255,107,0,0.5)",fontSize:9,fontWeight:700}}>Kích thước tối ưu: 800 × 400 px</div>
              </div>
            )
          }
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:100,background:"linear-gradient(to top,#080806,transparent)"}} />
        </div>

        {/* ── Shop info — avatar + name + stats ── */}
        <div style={{padding:"0 16px"}}>

          {/* Avatar + Name row */}
          <div style={{display:"flex",alignItems:"flex-end",gap:12,
            marginTop:-40,marginBottom:14,position:"relative",zIndex:10}}>

            {/* Logo circle — clickable to change */}
            <div
              onClick={() => logoRef.current?.click()}
              style={{width:78,height:78,borderRadius:"50%",
                border:"3px solid #080806",overflow:"hidden",flexShrink:0,
                background:"rgba(255,255,255,0.06)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,
                boxShadow:"0 0 0 1px rgba(255,107,0,0.25),0 4px 20px rgba(0,0,0,0.6)",
                cursor:"pointer",position:"relative"}}>
              {logoUrl
                ? <img src={logoUrl} alt="Logo" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                : "🏪"}
              {uploading === "logo" && (
                <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⏳</div>
              )}
              {!uploading && (
                <div style={{position:"absolute",bottom:0,left:0,right:0,height:24,
                  background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:10,color:"#FF8C00",fontWeight:700}}>✏️</span>
                </div>
              )}
            </div>

            {/* Name + address */}
            <div style={{flex:1,minWidth:0,paddingBottom:6}}>
              <div style={{color:"#f8f0e0",fontSize:18,fontWeight:800,lineHeight:1.2,
                marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {shopName || "Tên cửa hàng"}
              </div>
              <div style={{color:"#6a5a40",fontSize:9.5,lineHeight:1.5,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {category ? `${category} · ` : ""}{address.split(",")[0]}
              </div>
            </div>
          </div>

          {/* Stats row: chuẩn bị → giờ mở → đánh giá */}
          <div style={{display:"flex",gap:8,marginBottom:4}}>
            {[
              { icon:"⏱️", val:`${prepTime} phút`, sub:"Thời gian chuẩn bị" },
              { icon:"🕐", val: todayClosed ? "Hôm nay nghỉ" : todayLabel, sub:"Thời gian mở cửa" },
              { icon:"⭐", val: rating.toFixed(1), sub:`${totalReviews} đánh giá` },
            ].map(s => (
              <div key={s.icon} style={{flex:1,textAlign:"center",
                background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
                borderRadius:10,padding:"8px 4px"}}>
                <div style={{fontSize:15,marginBottom:2}}>{s.icon}</div>
                <div style={{color: todayClosed && s.icon==="🕐" ? "#ff4040" : "#f8f0e0",
                  fontSize:10,fontWeight:700,lineHeight:1.2}}>{s.val}</div>
                <div style={{color:"#6a5a40",fontSize:7.5}}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Category tabs (sticky) ── */}
        {cats.length > 1 && (
          <div style={{position:"sticky",top:56,zIndex:30,background:"rgba(8,8,6,0.95)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"10px 14px",marginTop:12}}>
            <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none"} as React.CSSProperties}>
              {cats.map(c => {
                const cnt = c === "Tất cả" ? products.length : products.filter(p => p.category === c).length
                return (
                  <button key={c} onClick={() => setActiveTab(c)}
                    style={{display:"flex",alignItems:"center",gap:4,flexShrink:0,padding:"5px 12px",borderRadius:20,border:"none",
                      background:activeTab===c?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                      outline:`${activeTab===c?1.5:1}px solid ${activeTab===c?"rgba(255,107,0,0.4)":"rgba(255,255,255,0.08)"}`,
                      color:activeTab===c?"#FF8C00":"#6a5a40",fontSize:10,fontWeight:activeTab===c?600:400,
                      cursor:"pointer",fontFamily:"Lexend",transition:"all .2s",whiteSpace:"nowrap"}}>
                    <span>{c}</span>
                    <span style={{color:"#6a5a40",fontSize:8.5}}>({cnt})</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Product list (1-column horizontal, same as customer) ── */}
        <div style={{padding:"4px 14px 0"}}>
          {displayed.length === 0 ? (
            <div style={{textAlign:"center",padding:"40px 0",color:"#6a5a40"}}>
              <div style={{fontSize:40,marginBottom:8}}>🍽️</div>
              <div style={{fontSize:12}}>Chưa có sản phẩm nào</div>
              <div style={{fontSize:10,marginTop:4}}>Thêm món ăn trong mục Menu để hiển thị ở đây</div>
            </div>
          ) : (
            cats.filter(c => c !== "Tất cả").map(c => {
              const items = activeTab === "Tất cả"
                ? (c === cats.find(x => x !== "Tất cả") ? displayed : [])
                : []
              const sectionItems = activeTab === "Tất cả"
                ? products.filter(p => p.category === c)
                : (activeTab === c ? displayed : [])
              if (sectionItems.length === 0 && activeTab !== "Tất cả") return null
              if (sectionItems.length === 0) return null
              return (
                <div key={c}>
                  {activeTab === "Tất cả" && (
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"16px 0 4px"}}>
                      <div style={{color:"#f8f0e0",fontSize:13,fontWeight:700}}>{c}</div>
                      <div style={{flex:1,height:1,background:"rgba(255,255,255,0.06)"}} />
                      <span style={{color:"#6a5a40",fontSize:9}}>{sectionItems.length} món</span>
                    </div>
                  )}
                  {sectionItems.map((p, idx) => {
                    const bc = p.badge ? BADGE_CFG[p.badge] : null
                    const disc = p.originalPrice && p.originalPrice > p.price
                      ? Math.round((1 - p.price / p.originalPrice) * 100) : null
                    return (
                      <motion.div key={p.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:idx*0.04}}
                        style={{display:"flex",gap:12,padding:"13px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                        {/* Image */}
                        <div style={{position:"relative",flexShrink:0}}>
                          <div style={{width:82,height:82,borderRadius:12,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>
                            {p.imagePreview
                              ? <img src={p.imagePreview} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}} />
                              : "🍽️"}
                          </div>
                          {disc && (
                            <div style={{position:"absolute",top:-4,left:-4,background:"#ff4040",color:"#fff",borderRadius:6,padding:"1px 6px",fontSize:8,fontWeight:800}}>-{disc}%</div>
                          )}
                          {bc && (
                            <div style={{position:"absolute",bottom:-4,right:-4,background:bc.bg,borderRadius:6,padding:"1px 6px",fontSize:7,fontWeight:700,color:bc.color}}>{bc.label}</div>
                          )}
                        </div>
                        {/* Info */}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{color:"#f8f0e0",fontSize:12.5,fontWeight:600,marginBottom:3,lineHeight:1.3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"} as React.CSSProperties}>{p.name}</div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <div>
                              <span style={{background:"linear-gradient(90deg,#FF6B00,#FFB347)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontSize:14,fontWeight:800}}>{fmt(p.price)}</span>
                              {p.originalPrice && p.originalPrice > p.price && (
                                <span style={{color:"#6a5a40",fontSize:9,textDecoration:"line-through",marginLeft:5}}>{fmt(p.originalPrice)}</span>
                              )}
                            </div>
                            <button style={{width:36,height:36,borderRadius:10,border:"none",background:"linear-gradient(135deg,#FF6B00,#FF8C00)",color:"#fff",fontSize:20,fontWeight:300,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 10px rgba(255,107,0,0.4)",flexShrink:0,fontFamily:"Lexend"}}>+</button>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )
            })
          )}
          <div style={{height:20}} />
        </div>
      </div>
    </>
  )
}
