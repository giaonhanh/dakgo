"use client"

// src/app/(customer)/review/[orderId]/page.tsx
// Đánh giá sau đơn hàng — màn hình riêng đầy đủ
// Sao món + sao tài xế + upload ảnh + tag nhanh + tip + submit

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

// ─── Mock order data (thay bằng fetch theo orderId) ────────
const ORDER = {
  id:       "GN2840",
  shopName: "Cơm Nhà Bếp",
  shopEmoji:"🍱",
  items:    ["Cơm sườn trứng", "Canh chua cá"],
  total:    73000,
  driver:   { name:"Nguyễn Thị Lan", plate:"47B-33412", rating:4.8 },
  createdAt:"13/05 · 12:05",
}

const FOOD_TAGS   = ["Món ngon","Đúng mô tả","Phần nhiều","Giá hợp lý","Đóng gói đẹp"]
const DRIVER_TAGS = ["Giao nhanh","Đúng giờ","Thân thiện","Chuyên nghiệp","Cẩn thận"]
const TIP_OPTIONS = [0, 5000, 10000, 20000, 50000]
const fmt = (n:number) => n === 0 ? "Không tip" : n.toLocaleString("vi-VN")+"đ"

// ─── Star Row ──────────────────────────────────────────────
function StarRow({ value, onChange }: { value:number; onChange:(v:number)=>void }) {
  const [hover, setHover] = useState(0)
  const LABELS = ["","Tệ","Không tốt","Bình thường","Tốt","Xuất sắc!"]
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ display:"flex",gap:6,justifyContent:"center",marginBottom:6 }}>
        {[1,2,3,4,5].map(n => (
          <span key={n}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{ fontSize:34,cursor:"pointer",transition:"all .15s",
              transform: (hover||value) >= n ? "scale(1.15)" : "scale(1)",
              filter:    (hover||value) >= n
                ? "drop-shadow(0 0 6px rgba(255,179,71,0.7))" : "grayscale(1)",
              opacity:   (hover||value) >= n ? 1 : 0.25 }}>⭐</span>
        ))}
      </div>
      <div style={{ color:"#FFB347",fontSize:11,fontWeight:600,minHeight:16 }}>
        {LABELS[hover || value]}
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────
export default function ReviewPage() {
  const [foodStar,   setFoodStar]   = useState(0)
  const [driverStar, setDriverStar] = useState(0)
  const [foodTags,   setFoodTags]   = useState<string[]>([])
  const [driverTags, setDriverTags] = useState<string[]>([])
  const [comment,    setComment]    = useState("")
  const [tip,        setTip]        = useState(0)
  const [photos,     setPhotos]     = useState<string[]>([])
  const [submitted,  setSubmitted]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const toggleTag = (tag:string, list:string[], set:(_:string[])=>void) =>
    set(list.includes(tag) ? list.filter(t=>t!==tag) : [...list,tag])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (photos.length + files.length > 3) return
    files.forEach(f => {
      const url = URL.createObjectURL(f)
      setPhotos(prev => [...prev, url])
    })
  }

  const canSubmit = foodStar > 0 && driverStar > 0

  if (submitted) {
    return (
      <div style={{ position:"fixed",inset:0,background:"#080806",
        display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",gap:12,fontFamily:"'Lexend',sans-serif" }}>
        <motion.div initial={{scale:0}} animate={{scale:1}}
          transition={{type:"spring",damping:12}}>
          <span style={{ fontSize:64 }}>⭐</span>
        </motion.div>
        <div style={{ color:"#f8f0e0",fontSize:18,fontWeight:800 }}>Cảm ơn bạn!</div>
        <div style={{ color:"#6a5a40",fontSize:11,textAlign:"center",lineHeight:1.7 }}>
          Đánh giá của bạn giúp cải thiện<br/>chất lượng dịch vụ Giao Nhanh
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:4,
          background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.25)",
          borderRadius:10,padding:"6px 14px" }}>
          <span style={{ fontSize:14 }}>💎</span>
          <span style={{ color:"#3ecf6e",fontSize:11,fontWeight:600 }}>
            +50 điểm tích lũy đã được cộng!
          </span>
        </div>
        <a href="/orders" style={{ marginTop:8,padding:"11px 28px",
          borderRadius:12,border:"none",textDecoration:"none",
          background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
          color:"#fff",fontSize:12,fontWeight:700,fontFamily:"Lexend" }}>
          Về trang đơn hàng →
        </a>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%;overflow:hidden}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
      `}</style>

      <div style={{ position:"fixed",inset:0,background:"#080806",
        display:"flex",flexDirection:"column",fontFamily:"'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)",backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          padding:"44px 16px 12px",flexShrink:0,zIndex:40 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <a href="/orders" style={{ width:32,height:32,borderRadius:9,
              textDecoration:"none",background:"rgba(255,255,255,0.05)",
              border:"1px solid rgba(255,255,255,0.08)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:15,fontWeight:700 }}>Đánh giá đơn hàng</div>
              <div style={{ color:"#6a5a40",fontSize:9,marginTop:1 }}>#{ORDER.id}</div>
            </div>
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px 100px",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* Order summary */}
          <div style={{ background:"rgba(255,255,255,0.05)",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:13,padding:"11px 13px",marginBottom:14,
            display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:40,height:40,borderRadius:11,flexShrink:0,
              background:"rgba(255,107,0,0.08)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>
              {ORDER.shopEmoji}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:11.5,fontWeight:600 }}>{ORDER.shopName}</div>
              <div style={{ color:"#6a5a40",fontSize:8.5,marginTop:2 }}>
                {ORDER.items.join(" · ")}
              </div>
              <div style={{ color:"#6a5a40",fontSize:8,marginTop:2 }}>
                {ORDER.createdAt} · {ORDER.total.toLocaleString("vi-VN")}đ
              </div>
            </div>
          </div>

          {/* Food rating */}
          <SCard title="🍽️ Chất lượng món ăn">
            <StarRow value={foodStar} onChange={setFoodStar} />
            {foodStar > 0 && (
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                style={{ marginTop:12 }}>
                <div style={{ color:"#6a5a40",fontSize:9,marginBottom:7 }}>
                  Bạn thích điều gì? (chọn nhiều)
                </div>
                <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                  {FOOD_TAGS.map(t => (
                    <TagChip key={t} label={t}
                      on={foodTags.includes(t)}
                      onClick={() => toggleTag(t,foodTags,setFoodTags)} />
                  ))}
                </div>
              </motion.div>
            )}
          </SCard>

          {/* Driver rating */}
          <SCard title="🛵 Tài xế giao hàng">
            <div style={{ display:"flex",alignItems:"center",gap:9,marginBottom:12,
              padding:"8px 10px",background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.06)",borderRadius:10 }}>
              <div style={{ width:34,height:34,borderRadius:10,
                background:"rgba(62,207,110,0.1)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:17 }}>
                🛵
              </div>
              <div>
                <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:600 }}>
                  {ORDER.driver.name}
                </div>
                <div style={{ color:"#6a5a40",fontSize:8.5,marginTop:1 }}>
                  {ORDER.driver.plate} · ⭐ {ORDER.driver.rating}
                </div>
              </div>
            </div>
            <StarRow value={driverStar} onChange={setDriverStar} />
            {driverStar > 0 && (
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                style={{ marginTop:12 }}>
                <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                  {DRIVER_TAGS.map(t => (
                    <TagChip key={t} label={t}
                      on={driverTags.includes(t)}
                      onClick={() => toggleTag(t,driverTags,setDriverTags)} />
                  ))}
                </div>
              </motion.div>
            )}
          </SCard>

          {/* Comment */}
          <SCard title="💬 Nhận xét thêm (tùy chọn)">
            <textarea value={comment} onChange={e=>setComment(e.target.value)}
              placeholder="Chia sẻ trải nghiệm của bạn..."
              rows={3}
              style={{ width:"100%",background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.08)",borderRadius:11,
                padding:"10px 12px",color:"#f8f0e0",fontSize:11.5,
                fontFamily:"Lexend",outline:"none",resize:"none",
                lineHeight:1.6 }} />
            <div style={{ textAlign:"right",color:"#6a5a40",fontSize:8,marginTop:4 }}>
              {comment.length}/300
            </div>
          </SCard>

          {/* Photo upload */}
          <SCard title="📷 Ảnh thực tế (tùy chọn)">
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {photos.map((p,i) => (
                <div key={i} style={{ position:"relative",
                  width:70,height:70,borderRadius:10,overflow:"hidden",
                  border:"1px solid rgba(255,255,255,0.1)" }}>
                  <img src={p} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                  <button onClick={() => setPhotos(prev=>prev.filter((_,j)=>j!==i))}
                    style={{ position:"absolute",top:3,right:3,
                      width:18,height:18,borderRadius:"50%",border:"none",
                      background:"rgba(0,0,0,0.65)",color:"#fff",
                      fontSize:10,cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center" }}>
                    ✕
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <div onClick={() => fileRef.current?.click()}
                  style={{ width:70,height:70,borderRadius:10,cursor:"pointer",
                    background:"rgba(255,255,255,0.03)",
                    border:"1.5px dashed rgba(255,255,255,0.1)",
                    display:"flex",flexDirection:"column",
                    alignItems:"center",justifyContent:"center",gap:4 }}>
                  <span style={{ fontSize:20 }}>📷</span>
                  <span style={{ color:"#6a5a40",fontSize:7.5 }}>Thêm ảnh</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple
              onChange={handlePhoto} style={{ display:"none" }} />
            <div style={{ color:"#6a5a40",fontSize:8,marginTop:7 }}>
              Tối đa 3 ảnh · Ảnh thực tế giúp khách khác tham khảo tốt hơn
            </div>
          </SCard>

          {/* Tip */}
          <SCard title="💝 Tip cho tài xế (tùy chọn)">
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {TIP_OPTIONS.map(v => (
                <div key={v} onClick={() => setTip(v)}
                  style={{ padding:"6px 12px",borderRadius:9,cursor:"pointer",
                    background:tip===v?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                    border:`1px solid ${tip===v?"rgba(255,107,0,0.4)":"rgba(255,255,255,0.08)"}`,
                    color:tip===v?"#FF8C00":"#6a5a40",
                    fontSize:9.5,fontWeight:tip===v?600:400,
                    transition:"all .15s" }}>
                  {fmt(v)}
                </div>
              ))}
            </div>
            {tip > 0 && (
              <div style={{ marginTop:8,color:"#3ecf6e",fontSize:9.5 }}>
                🎉 Tài xế sẽ nhận được {fmt(tip)} — cảm ơn bạn đã hào phóng!
              </div>
            )}
          </SCard>

        </div>

        {/* Submit button */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,
          padding:"12px 16px 24px",
          background:"linear-gradient(to top,#080806 70%,transparent)",
          zIndex:50 }}>
          <button onClick={() => canSubmit && setSubmitted(true)}
            disabled={!canSubmit}
            style={{ width:"100%",height:50,borderRadius:14,border:"none",
              background:canSubmit
                ?"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)"
                :"rgba(255,255,255,0.07)",
              color:canSubmit?"#fff":"#6a5a40",
              fontSize:13,fontWeight:700,fontFamily:"Lexend",
              cursor:canSubmit?"pointer":"not-allowed",
              position:"relative",overflow:"hidden",
              boxShadow:canSubmit?"0 4px 20px rgba(255,107,0,0.4)":"none",
              transition:"all .25s" }}>
            {canSubmit && (
              <div style={{ position:"absolute",top:0,left:"-60%",width:"35%",height:"100%",
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                animation:"shimmer 2.5s infinite" }} />
            )}
            <span style={{ position:"relative",zIndex:1 }}>
              {!canSubmit
                ? "Vui lòng cho điểm trước khi gửi"
                : `⭐ Gửi đánh giá${tip>0?" + Tip "+fmt(tip):""}`}
            </span>
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Sub components ────────────────────────────────────────
function SCard({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.04)",
      border:"1px solid rgba(255,255,255,0.07)",
      borderRadius:14,padding:"13px 14px",marginBottom:10 }}>
      <div style={{ color:"#b0956a",fontSize:10,fontWeight:700,
        textTransform:"uppercase",letterSpacing:.5,marginBottom:12 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function TagChip({ label, on, onClick }: { label:string; on:boolean; onClick:()=>void }) {
  return (
    <div onClick={onClick}
      style={{ padding:"4px 11px",borderRadius:20,cursor:"pointer",
        background:on?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
        border:`1px solid ${on?"rgba(255,107,0,0.4)":"rgba(255,255,255,0.08)"}`,
        color:on?"#FF8C00":"#6a5a40",
        fontSize:9.5,fontWeight:on?600:400,
        transition:"all .15s" }}>
      {label}
    </div>
  )
}
