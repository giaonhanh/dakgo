"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Product { id: string; name: string; price: number; originalPrice?: number; category: string; imagePreview: string | null; available: boolean; badge: "hot" | "bigsale" | "bestseller" | null }

const SAMPLE_PRODUCTS: Product[] = [
  { id:"p1", name:"Bún bò đặc biệt", price:45000, originalPrice:55000, category:"Bún", imagePreview:null, available:true, badge:"bestseller" },
  { id:"p2", name:"Bún bò thường",   price:35000, category:"Bún",     imagePreview:null, available:true, badge:null },
  { id:"p3", name:"Trà đá",          price:5000,  category:"Đồ uống", imagePreview:null, available:true, badge:null },
  { id:"p4", name:"Sinh tố bơ",      price:25000, category:"Đồ uống", imagePreview:null, available:true, badge:"hot" },
]
const CATS = ["Tất cả", ...Array.from(new Set(SAMPLE_PRODUCTS.map(p => p.category)))]

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"
const BADGE_CFG = {
  hot:        { label:"🔥 HOT",      color:"#ff4040", bg:"rgba(255,64,64,0.15)"    },
  bigsale:    { label:"💸 BIG SALE", color:"#FFD700", bg:"rgba(255,215,0,0.12)"    },
  bestseller: { label:"📈 BÁN CHẠY", color:"#3ecf6e", bg:"rgba(62,207,110,0.12)"  },
}

export default function ShopPreviewPage() {
  const [coverUrl, setCoverUrl]   = useState<string | null>(null)
  const [logoUrl,  setLogoUrl]    = useState<string | null>(null)
  const [shopName] = useState("Bún Bò Huế Ngon")
  const [category] = useState("🍜 Bún / Phở")
  const [address]  = useState("22 Lê Hồng Phong, Phước An, Krông Pắc")
  const [rating]    = useState(4.8)
  const [isOpen]    = useState(true)
  const [prepTime, setPrepTime] = useState("10–15")
  const [todayLabel, setTodayLabel] = useState("07:00–21:00")
  const [todayClosed, setTodayClosed] = useState(false)

  useEffect(() => {
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
          } else {
            // new format: slots[]; old format: from/to directly
            if (Array.isArray(today.slots) && today.slots.length > 0) {
              setTodayLabel(today.slots.map((s: { from: string; to: string }) => `${s.from}–${s.to}`).join(" · "))
            } else if (today.from) {
              setTodayLabel(`${today.from}–${today.to}`)
            }
          }
        }
      }
    } catch { /* ignore */ }
    try {
      const pt = localStorage.getItem("merchant_prep_time")
      if (pt) setPrepTime(pt)
    } catch { /* ignore */ }
  }, [])
  const [activeTab, setActiveTab] = useState("Tất cả")
  const [toast, setToast]         = useState("")

  const coverRef = useRef<HTMLInputElement>(null)
  const logoRef  = useRef<HTMLInputElement>(null)

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2400) }

  const onCoverFile = (file: File) => {
    const url = URL.createObjectURL(file)
    setCoverUrl(url)
    fire("Đã cập nhật ảnh bìa")
    // TODO: upload to Supabase Storage bucket "shop-covers"
  }
  const onLogoFile = (file: File) => {
    const url = URL.createObjectURL(file)
    setLogoUrl(url)
    fire("Đã cập nhật logo cửa hàng")
    // TODO: upload to Supabase Storage bucket "shop-logos"
  }

  const displayed = activeTab === "Tất cả" ? SAMPLE_PRODUCTS : SAMPLE_PRODUCTS.filter(p => p.category === activeTab)

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{display:none}
      `}</style>

      {/* Hidden file inputs */}
      <input ref={coverRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => { const f=e.target.files?.[0]; if(f) onCoverFile(f); e.target.value="" }} />
      <input ref={logoRef}  type="file" accept="image/*" style={{display:"none"}} onChange={e => { const f=e.target.files?.[0]; if(f) onLogoFile(f);  e.target.value="" }} />

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
        <div style={{background:"linear-gradient(90deg,rgba(255,140,0,0.18),rgba(255,107,0,0.1))",borderBottom:"1px solid rgba(255,107,0,0.25)",padding:"10px 16px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:30,backdropFilter:"blur(12px)"}}>
          <a href="/merchant" style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:14,flexShrink:0}}>←</a>
          <div style={{flex:1}}>
            <div style={{color:"#FF8C00",fontSize:11,fontWeight:800}}>👁 Chế độ xem trước</div>
            <div style={{color:"rgba(255,140,0,0.65)",fontSize:9}}>Đây là giao diện khách hàng nhìn thấy</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={() => coverRef.current?.click()}
              style={{background:"rgba(255,107,0,0.12)",border:"1px solid rgba(255,107,0,0.3)",borderRadius:8,padding:"5px 10px",color:"#FF8C00",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",whiteSpace:"nowrap"}}>🖼 Đổi ảnh bìa</button>
            <button onClick={() => logoRef.current?.click()}
              style={{background:"rgba(255,107,0,0.12)",border:"1px solid rgba(255,107,0,0.3)",borderRadius:8,padding:"5px 10px",color:"#FF8C00",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",whiteSpace:"nowrap"}}>🏪 Đổi logo</button>
          </div>
        </div>

        {/* ── Cover image ── */}
        <div style={{position:"relative",height:200,background:"linear-gradient(135deg,#1a0a00,#2d1200,#0d0600)",overflow:"hidden",cursor:"pointer"}}
          onClick={() => coverRef.current?.click()}>
          {coverUrl
            ? <img src={coverUrl} alt="Cover" style={{width:"100%",height:"100%",objectFit:"cover"}} />
            : (
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
                <div style={{fontSize:36,opacity:0.3}}>🖼</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontWeight:600}}>Nhấn để tải ảnh bìa</div>
              </div>
            )
          }
          {/* Gradient overlay */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:100,background:"linear-gradient(to top,#080806,transparent)"}} />
        </div>

        {/* ── Shop info ── */}
        <div style={{padding:"0 16px",marginTop:-40,position:"relative",zIndex:10}}>
          <div style={{display:"flex",alignItems:"flex-end",gap:14,marginBottom:14}}>
            {/* Logo */}
            <div onClick={() => logoRef.current?.click()}
              style={{width:76,height:76,borderRadius:18,border:"3px solid rgba(255,107,0,0.4)",background:"rgba(8,8,6,0.9)",flexShrink:0,cursor:"pointer",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}}>
              {logoUrl
                ? <img src={logoUrl} alt="Logo" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                : <span>🍜</span>
              }
            </div>

            {/* Name + status */}
            <div style={{flex:1,paddingBottom:4}}>
              <div style={{color:"#f8f0e0",fontSize:18,fontWeight:800,marginBottom:4}}>{shopName}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{display:"flex",alignItems:"center",gap:4,background:isOpen?"rgba(62,207,110,0.12)":"rgba(255,64,64,0.1)",border:`1px solid ${isOpen?"rgba(62,207,110,0.3)":"rgba(255,64,64,0.25)"}`,borderRadius:6,padding:"2px 8px"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:isOpen?"#3ecf6e":"#ff4040",boxShadow:isOpen?"0 0 5px #3ecf6e":"none"}} />
                  <span style={{color:isOpen?"#3ecf6e":"#ff4040",fontSize:9,fontWeight:700}}>{isOpen?"Đang mở":"Đã đóng"}</span>
                </div>
                <span style={{color:"#6a5a40",fontSize:9}}>{category}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{display:"flex",gap:16,marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{color:"#FFB347",fontSize:13}}>★</span>
              <span style={{color:"#f8f0e0",fontSize:12,fontWeight:700}}>{rating}</span>
              <span style={{color:"#6a5a40",fontSize:10}}>(124 đánh giá)</span>
            </div>
            <div style={{color:"#6a5a40",fontSize:10,display:"flex",alignItems:"center",gap:4}}>
              <span>📍</span><span>{address}</span>
            </div>
          </div>

          {/* Info chips */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
            <span style={{
              background: todayClosed ? "rgba(255,64,64,0.08)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${todayClosed ? "rgba(255,64,64,0.2)" : "rgba(255,255,255,0.08)"}`,
              borderRadius:8, padding:"4px 10px",
              color: todayClosed ? "#ff4040" : "#b0956a", fontSize:9 }}>
              🕐 {todayClosed ? "Hôm nay nghỉ" : todayLabel}
            </span>
            <span style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"4px 10px",color:"#b0956a",fontSize:9}}>
              ⏱️ Chuẩn bị {prepTime} phút
            </span>
          </div>
        </div>

        {/* ── Category tabs ── */}
        <div style={{display:"flex",gap:6,padding:"0 16px 10px",overflowX:"auto"} as React.CSSProperties}>
          {CATS.map(c => (
            <button key={c} onClick={() => setActiveTab(c)}
              style={{flexShrink:0,padding:"6px 16px",borderRadius:20,
                background:activeTab===c?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                border:activeTab===c?"1px solid rgba(255,107,0,0.35)":"1px solid rgba(255,255,255,0.06)",
                color:activeTab===c?"#FF8C00":"#6a5a40",fontSize:10,fontWeight:activeTab===c?700:400,cursor:"pointer",fontFamily:"Lexend",whiteSpace:"nowrap"}}>
              {c}
            </button>
          ))}
        </div>

        {/* ── Product grid ── */}
        <div style={{padding:"0 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {displayed.map((p, idx) => {
            const bc = p.badge ? BADGE_CFG[p.badge] : null
            return (
              <motion.div key={p.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:idx*0.05}}
                style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,overflow:"hidden",cursor:"pointer"}}>
                {/* Image */}
                <div style={{height:100,background:"rgba(255,107,0,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,position:"relative",overflow:"hidden"}}>
                  {p.imagePreview ? <img src={p.imagePreview} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span>🍽️</span>}
                  {bc && (
                    <div style={{position:"absolute",top:6,left:6,background:bc.bg,border:"none",borderRadius:6,padding:"2px 6px",fontSize:8,fontWeight:800,color:bc.color}}>{bc.label}</div>
                  )}
                  {p.originalPrice && (
                    <div style={{position:"absolute",top:6,right:6,background:"#ff4040",borderRadius:5,padding:"2px 6px",fontSize:8,fontWeight:800,color:"#fff"}}>
                      -{Math.round((1-p.price/p.originalPrice)*100)}%
                    </div>
                  )}
                </div>
                {/* Info */}
                <div style={{padding:"9px 10px 11px"}}>
                  <div style={{color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{background:"linear-gradient(90deg,#FF6B00,#FFB347)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontSize:12,fontWeight:800}}>{fmt(p.price)}</span>
                    {p.originalPrice && <span style={{color:"rgba(255,255,255,0.25)",fontSize:9,textDecoration:"line-through"}}>{fmt(p.originalPrice)}</span>}
                  </div>
                  <button style={{width:"100%",height:30,borderRadius:8,background:"linear-gradient(90deg,#FF6B00,#FF8C00)",border:"none",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",marginTop:8,fontFamily:"Lexend"}}>
                    + Thêm
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Upload hint when no cover */}
        {!coverUrl && (
          <div style={{margin:"20px 16px 0",background:"rgba(255,107,0,0.06)",border:"1px dashed rgba(255,107,0,0.25)",borderRadius:14,padding:14,display:"flex",gap:10,alignItems:"center"}}>
            <div style={{fontSize:22}}>💡</div>
            <div>
              <div style={{color:"#FF8C00",fontSize:11,fontWeight:700,marginBottom:2}}>Thêm ảnh bìa & logo để thu hút khách</div>
              <div style={{color:"#6a5a40",fontSize:9}}>Nhấn "Đổi ảnh bìa" hoặc "Đổi logo" ở thanh trên cùng</div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
