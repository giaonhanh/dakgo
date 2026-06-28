"use client"

// src/app/(customer)/review/[orderId]/page.tsx

import { useState, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

const FOOD_TAGS   = ["Món ngon","Đúng mô tả","Phần nhiều","Giá hợp lý","Đóng gói đẹp"]
const DRIVER_TAGS = ["Giao nhanh","Đúng giờ","Thân thiện","Chuyên nghiệp","Cẩn thận"]
const TIP_OPTIONS = [0, 5000, 10000, 20000, 50000]
const fmt = (n:number) => n === 0 ? "Không tip" : n.toLocaleString("vi-VN")+"đ"

interface OrderData {
  id: string; shopId: string; shopName: string; shopEmoji: string
  items: string[]; total: number; driverId: string | null
  driver: { name: string; plate: string; rating: number } | null
  createdAt: string; payMethod: string
}


function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

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
        fontSize: 11,fontWeight:on?600:400,
        transition:"all .15s" }}>
      {label}
    </div>
  )
}

export default function ReviewPage() {
  const params   = useParams()
  const orderId  = params?.orderId as string | undefined
  const supabase = createClient()

  const [order,      setOrder]      = useState<OrderData | null>(null)
  const [userId,     setUserId]     = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [foodStar,   setFoodStar]   = useState(0)
  const [driverStar, setDriverStar] = useState(0)
  const [foodTags,   setFoodTags]   = useState<string[]>([])
  const [driverTags, setDriverTags] = useState<string[]>([])
  const [comment,    setComment]    = useState("")
  const [tip,        setTip]        = useState(0)
  const [photos,     setPhotos]     = useState<string[]>([])
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [submitted,  setSubmitted]  = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr,  setSubmitErr]  = useState("")
  const [earnedXu,   setEarnedXu]  = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !orderId) { setLoading(false); return }
      setUserId(user.id)

      const { data } = await supabase
        .from("orders")
        .select(`
          id, total_amount, created_at, driver_id, shop_id, pay_method,
          shops(id, name),
          order_items(name),
          drivers(id, license_plate, rating_avg)
        `)
        .eq("id", orderId)
        .single()

      if (!data) { setLoading(false); return }

      const shop      = Array.isArray(data.shops) ? data.shops[0] : data.shops
      const driverRow = Array.isArray(data.drivers) ? data.drivers[0] : data.drivers
      let driverName  = "Tài xế"
      if (data.driver_id) {
        const { data: dp } = await supabase
          .from("profiles").select("full_name").eq("id", data.driver_id).single()
        driverName = dp?.full_name ?? "Tài xế"
      }
      const items = (data.order_items ?? []) as { name: string }[]

      setOrder({
        id: data.id,
        shopId: data.shop_id ?? "",
        shopName: shop?.name ?? "Cửa hàng",
        shopEmoji: "🍽️",
        items: items.map(i => i.name),
        total: data.total_amount,
        driverId: data.driver_id ?? null,
        driver: driverRow ? {
          name: driverName,
          plate: driverRow.license_plate ?? "",
          rating: Number(driverRow.rating_avg ?? 5),
        } : null,
        createdAt: fmtDate(data.created_at),
        payMethod: data.pay_method ?? "cash",
      })
      setLoading(false)
    }
    load()
  }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTag = (tag:string, list:string[], set:(_:string[])=>void) =>
    set(list.includes(tag) ? list.filter(t=>t!==tag) : [...list,tag])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (photos.length + files.length > 3) return
    files.forEach(f => {
      const url = URL.createObjectURL(f)
      setPhotos(prev => [...prev, url])
      setPhotoFiles(prev => [...prev, f])
    })
  }

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_,i) => i !== idx))
    setPhotoFiles(prev => prev.filter((_,i) => i !== idx))
  }

  const canSubmit = foodStar > 0 && driverStar > 0

  const handleSubmit = async () => {
    if (!canSubmit || !orderId || !userId || !order || submitting) return
    setSubmitting(true)
    setSubmitErr("")
    try {
      // Upload photos
      const uploadedUrls: string[] = []
      for (let i = 0; i < photoFiles.length; i++) {
        const file = photoFiles[i]
        const ext  = file.name.split(".").pop() || "jpg"
        const path = `review-photos/${orderId}/${i}.${ext}`
        const { error } = await supabase.storage
          .from("review-photos").upload(path, file, { upsert: true })
        if (!error) {
          const { data: pub } = supabase.storage.from("review-photos").getPublicUrl(path)
          uploadedUrls.push(pub.publicUrl)
        }
      }

      const { error: insertErr } = await supabase.from("reviews").insert({
        order_id:     orderId,
        reviewer_id:  userId,
        shop_id:      order.shopId || null,
        driver_id:    order.driverId,
        food_rating:  foodStar,
        driver_rating: driverStar,
        comment:      comment || null,
        images:       uploadedUrls.length > 0 ? uploadedUrls : null,
        tip_amount:   tip,
      })

      if (insertErr) {
        console.error("[review] insert error:", insertErr.code, insertErr.message, insertErr.details)
        setSubmitErr(
          insertErr.code === "23505"
            ? "Đơn này đã được đánh giá rồi."
            : `Không thể lưu đánh giá: ${insertErr.message}`
        )
        return
      }

      // Xử lý tip payment (chỉ khi tip > 0 và không phải COD)
      if (tip > 0 && order.payMethod !== "cash") {
        const tipRes = await fetch("/api/reviews/tip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId, tip_amount: tip }),
        })
        if (!tipRes.ok) {
          const tipData = await tipRes.json()
          if (tipData?.insufficient) {
            setSubmitErr(`Đánh giá đã lưu, nhưng ${tipData.error}. Nạp thêm ví để tip lần sau nhé!`)
            setSubmitted(true)
            return
          }
        }
      }

      // Thưởng xu DakGo sau khi review thành công
      const rewardRes = await fetch("/api/reviews/reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, has_photo: uploadedUrls.length > 0 }),
      })
      if (rewardRes.ok) {
        const rewardData = await rewardRes.json()
        if (!rewardData.skipped) setEarnedXu(rewardData.xu ?? 0)
      }

      setSubmitted(true)
    } catch (e) {
      console.error("[review] unexpected error:", e)
      setSubmitErr("Có lỗi xảy ra, vui lòng thử lại.")
    } finally {
      setSubmitting(false)
    }
  }

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
        {earnedXu > 0 && (
          <motion.div initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
            transition={{ type:"spring", damping:12, delay:0.3 }}
            style={{ display:"flex",alignItems:"center",gap:6,marginTop:4,
              background:"rgba(180,100,255,0.12)",border:"1px solid rgba(180,100,255,0.3)",
              borderRadius:10,padding:"8px 16px" }}>
            <span style={{ fontSize:16 }}>🎁</span>
            <span style={{ color:"#b464ff",fontSize:12,fontWeight:700 }}>
              +{earnedXu.toLocaleString("vi-VN")} xu DakGo đã vào ví!
            </span>
          </motion.div>
        )}
        <a href="/orders" style={{ marginTop:8,padding:"11px 28px",
          borderRadius:12,border:"none",textDecoration:"none",
          background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
          color:"#fff",fontSize:12,fontWeight:700,fontFamily:"Lexend" }}>
          Về trang đơn hàng →
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ position:"fixed",inset:0,background:"#080806",
        display:"flex",alignItems:"center",justifyContent:"center",
        fontFamily:"'Lexend',sans-serif",color:"#6a5a40",fontSize:12 }}>
        Đang tải...
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
          padding:"calc(env(safe-area-inset-top) + 12px) 16px 12px",flexShrink:0,zIndex:40 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <a href="/orders" style={{ width:32,height:32,borderRadius:9,
              textDecoration:"none",background:"rgba(255,255,255,0.05)",
              border:"1px solid rgba(255,255,255,0.08)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:15,fontWeight:700 }}>Đánh giá đơn hàng</div>
              <div style={{ color:"#6a5a40",fontSize: 11,marginTop:1 }}>
                #{orderId?.slice(0,8).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px 100px",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* Order summary */}
          {order && (
            <div style={{ background:"rgba(255,255,255,0.05)",
              border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:13,padding:"11px 13px",marginBottom:14,
              display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:40,height:40,borderRadius:11,flexShrink:0,
                background:"rgba(255,107,0,0.08)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>
                {order.shopEmoji}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:"#f8f0e0",fontSize:11.5,fontWeight:600 }}>{order.shopName}</div>
                <div style={{ color:"#6a5a40",fontSize: 11,marginTop:2 }}>
                  {order.items.join(" · ")}
                </div>
                <div style={{ color:"#6a5a40",fontSize: 11,marginTop:2 }}>
                  {order.createdAt} · {order.total.toLocaleString("vi-VN")}đ
                </div>
              </div>
            </div>
          )}

          {/* Food rating */}
          <SCard title="🍽️ Chất lượng món ăn">
            <StarRow value={foodStar} onChange={setFoodStar} />
            {foodStar > 0 && (
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                style={{ marginTop:12 }}>
                <div style={{ color:"#6a5a40",fontSize: 11,marginBottom:7 }}>
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
            {order?.driver && (
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
                    {order.driver.name}
                  </div>
                  <div style={{ color:"#6a5a40",fontSize: 11,marginTop:1 }}>
                    {order.driver.plate} · ⭐ {order.driver.rating}
                  </div>
                </div>
              </div>
            )}
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
            <div style={{ textAlign:"right",color:"#6a5a40",fontSize: 11,marginTop:4 }}>
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
                  <button onClick={() => removePhoto(i)}
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
                  <span style={{ color:"#6a5a40",fontSize: 10 }}>Thêm ảnh</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple
              onChange={handlePhoto} style={{ display:"none" }} />
            <div style={{ color:"#6a5a40",fontSize: 11,marginTop:7 }}>
              Tối đa 3 ảnh · Ảnh thực tế giúp khách khác tham khảo tốt hơn
            </div>
          </SCard>

          {/* Tip — chỉ hiện khi thanh toán ví/QR, ẩn với COD */}
          {order && order.payMethod !== "cash" && <SCard title="💝 Tip cho tài xế (tùy chọn)">
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {TIP_OPTIONS.map(v => (
                <div key={v} onClick={() => setTip(v)}
                  style={{ padding:"6px 12px",borderRadius:9,cursor:"pointer",
                    background:tip===v?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                    border:`1px solid ${tip===v?"rgba(255,107,0,0.4)":"rgba(255,255,255,0.08)"}`,
                    color:tip===v?"#FF8C00":"#6a5a40",
                    fontSize: 11,fontWeight:tip===v?600:400,
                    transition:"all .15s" }}>
                  {fmt(v)}
                </div>
              ))}
            </div>
            {tip > 0 && (
              <div style={{ marginTop:8,color:"#3ecf6e",fontSize: 11 }}>
                🎉 Tài xế sẽ nhận được {fmt(tip)} — cảm ơn bạn đã hào phóng!
              </div>
            )}
          </SCard>}

        </div>

        {/* Submit button */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,
          padding:"12px 16px 24px",
          background:"linear-gradient(to top,#080806 70%,transparent)",
          zIndex:50 }}>
          {submitErr && (
            <div style={{ background:"rgba(255,64,64,0.1)", border:"1px solid rgba(255,64,64,0.35)",
              borderRadius:10, padding:"9px 12px", marginBottom:10, color:"#ff8080", fontSize:11 }}>
              ⚠️ {submitErr}
            </div>
          )}
          <button onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            style={{ width:"100%",height:50,borderRadius:14,border:"none",
              background:canSubmit
                ?"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)"
                :"rgba(255,255,255,0.07)",
              color:canSubmit?"#fff":"#6a5a40",
              fontSize:13,fontWeight:700,fontFamily:"Lexend",
              cursor:canSubmit&&!submitting?"pointer":"not-allowed",
              position:"relative",overflow:"hidden",
              boxShadow:canSubmit?"0 4px 20px rgba(255,107,0,0.4)":"none",
              transition:"all .25s",
              opacity: submitting ? 0.7 : 1 }}>
            {canSubmit && !submitting && (
              <div style={{ position:"absolute",top:0,left:"-60%",width:"35%",height:"100%",
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                animation:"shimmer 2.5s infinite" }} />
            )}
            <span style={{ position:"relative",zIndex:1 }}>
              {submitting
                ? "Đang gửi..."
                : !canSubmit
                ? "Vui lòng cho điểm trước khi gửi"
                : `⭐ Gửi đánh giá${tip>0?" + Tip "+fmt(tip):""}`}
            </span>
          </button>
        </div>
      </div>
    </>
  )
}
