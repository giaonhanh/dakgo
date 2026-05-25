"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

interface Review {
  id: string
  orderId: string
  orderTotal: number
  customerName: string
  customerAvatar: string | null
  driverRating: number | null
  comment: string | null
  tipAmount: number
  createdAt: string
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div style={{ display:"flex", gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize:size, color: i <= rating ? "#f5c542" : "rgba(255,255,255,0.12)" }}>★</span>
      ))}
    </div>
  )
}

export default function DriverReviewsPage() {
  const supabase = createClient()
  const [reviews,  setReviews]  = useState<Review[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<"all"|1|2|3|4|5>("all")
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: rows } = await supabase
        .from("reviews")
        .select(`
          id, driver_rating, comment, tip_amount, created_at,
          orders!inner(id, total_amount),
          profiles!reviewer_id(full_name, avatar_url)
        `)
        .eq("driver_id", user.id)
        .not("driver_rating", "is", null)
        .order("created_at", { ascending: false })
        .limit(60)

      if (!rows) { setLoading(false); return }

      setReviews(rows.map(r => {
        const order   = (r.orders as unknown as Record<string, unknown>)
        const profile = (r.profiles as unknown as Record<string, unknown>)
        return {
          id:            r.id,
          orderId:       (order?.id as string) ?? "",
          orderTotal:    (order?.total_amount as number) ?? 0,
          customerName:  (profile?.full_name as string) ?? "Khách hàng",
          customerAvatar:(profile?.avatar_url as string | null) ?? null,
          driverRating:  r.driver_rating,
          comment:       r.comment,
          tipAmount:     r.tip_amount ?? 0,
          createdAt:     r.created_at,
        }
      }))
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rated     = reviews.filter(r => r.driverRating !== null)
  const avg       = rated.length > 0 ? rated.reduce((s, r) => s + (r.driverRating ?? 0), 0) / rated.length : 0
  const totalTips = reviews.reduce((s, r) => s + r.tipAmount, 0)
  const countStar = (s: number) => rated.filter(r => r.driverRating === s).length
  const shown     = reviews.filter(r => filter === "all" ? true : r.driverRating === filter)

  return (
    <>
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html,body{background:#080806;font-family:'Lexend',sans-serif}::-webkit-scrollbar{display:none}`}</style>

      <div style={{ position:"fixed", inset:0, background:"#080806", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"calc(env(safe-area-inset-top) + 12px) 16px 12px", background:"rgba(8,8,6,0.97)",
          backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/driver" style={{ width:36, height:36, borderRadius:10, background:"rgba(255,255,255,0.06)",
              display:"flex", alignItems:"center", justifyContent:"center",
              textDecoration:"none", color:"#f8f0e0", fontSize:16, flexShrink:0 }}>←</a>
            <div>
              <div style={{ color:"#f8f0e0", fontSize:16, fontWeight:800 }}>Đánh giá của tôi</div>
              <div style={{ color:"#6a5a40", fontSize:9 }}>{rated.length} lượt đánh giá · TB {avg.toFixed(1)} ★</div>
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px 28px" }}>

          {/* Stats */}
          {!loading && rated.length > 0 && (
            <div style={{ background:"rgba(245,197,66,0.05)", border:"1px solid rgba(245,197,66,0.18)",
              borderRadius:16, padding:"14px 16px", marginBottom:14 }}>
              <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                <div style={{ textAlign:"center", flexShrink:0 }}>
                  <div style={{ fontSize:42, fontWeight:800, lineHeight:1,
                    background:"linear-gradient(135deg,#f5c542,#FFB347)",
                    WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
                    {avg.toFixed(1)}
                  </div>
                  <div style={{ display:"flex", justifyContent:"center", gap:2, margin:"4px 0 2px" }}>
                    {[1,2,3,4,5].map(i => (
                      <span key={i} style={{ fontSize:11, color: i <= Math.round(avg) ? "#f5c542" : "rgba(255,255,255,0.12)" }}>★</span>
                    ))}
                  </div>
                  <div style={{ color:"#6a5a40", fontSize:8 }}>{rated.length} lượt</div>
                </div>

                <div style={{ flex:1 }}>
                  {[5,4,3,2,1].map(s => {
                    const cnt = countStar(s)
                    const pct = rated.length > 0 ? cnt / rated.length : 0
                    return (
                      <div key={s} onClick={() => setFilter(filter === s ? "all" : s as 1|2|3|4|5)}
                        style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, cursor:"pointer" }}>
                        <span style={{ color:"#f5c542", fontSize:9, width:8, textAlign:"right" }}>{s}</span>
                        <span style={{ fontSize:10, color:"#f5c542" }}>★</span>
                        <div style={{ flex:1, height:5, borderRadius:3, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                          <div style={{ width:`${pct*100}%`, height:"100%", borderRadius:3,
                            background: s >= 4 ? "#3ecf6e" : s === 3 ? "#f5c542" : "#ff4040",
                            transition:"width .5s" }} />
                        </div>
                        <span style={{ color:"#6a5a40", fontSize:8, width:16, textAlign:"right" }}>{cnt}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {totalTips > 0 && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid rgba(245,197,66,0.12)",
                  display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:14 }}>💝</span>
                  <div>
                    <div style={{ color:"#f5c542", fontSize:11, fontWeight:700 }}>Tip nhận được: {fmt(totalTips)}</div>
                    <div style={{ color:"#6a5a40", fontSize:8 }}>Khách hàng cảm ơn bạn</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filter */}
          {reviews.length > 0 && (
            <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:12, scrollbarWidth:"none" } as React.CSSProperties}>
              {([
                { key:"all", label:`Tất cả (${reviews.length})` },
                { key:5, label:"5 ★" }, { key:4, label:"4 ★" },
                { key:3, label:"3 ★" }, { key:2, label:"2 ★" }, { key:1, label:"1 ★" },
              ] as { key:"all"|1|2|3|4|5; label:string }[]).map(f => (
                <button key={String(f.key)} onClick={() => setFilter(f.key)}
                  style={{ flexShrink:0, padding:"5px 13px", borderRadius:20, cursor:"pointer",
                    fontFamily:"Lexend", fontSize:9, fontWeight: filter===f.key ? 700 : 400,
                    background: filter===f.key ? "rgba(245,197,66,0.12)" : "rgba(255,255,255,0.04)",
                    border: filter===f.key ? "1px solid rgba(245,197,66,0.35)" : "1px solid rgba(255,255,255,0.06)",
                    color: filter===f.key ? "#f5c542" : "#6a5a40" }}>
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* List */}
          {loading ? (
            <div style={{ textAlign:"center", padding:"48px 0", color:"#6a5a40", fontSize:11 }}>Đang tải...</div>
          ) : shown.length === 0 ? (
            <div style={{ textAlign:"center", padding:"52px 0" }}>
              <div style={{ fontSize:40, marginBottom:10 }}>{reviews.length === 0 ? "🌟" : "🔍"}</div>
              <div style={{ color:"#6a5a40", fontSize:12 }}>
                {reviews.length === 0 ? "Chưa có đánh giá nào" : "Không có đánh giá ở mức sao này"}
              </div>
            </div>
          ) : shown.map((rv, idx) => {
            const s   = rv.driverRating ?? 0
            const ok  = s >= 4
            const isOpen = expanded === rv.id
            return (
              <motion.div key={rv.id}
                initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                transition={{ delay: idx * 0.04 }}
                style={{ marginBottom:10, borderRadius:14, overflow:"hidden",
                  background: ok ? "rgba(62,207,110,0.04)" : s===3 ? "rgba(245,197,66,0.04)" : "rgba(255,64,64,0.04)",
                  border:`1px solid ${ok ? "rgba(62,207,110,0.14)" : s===3 ? "rgba(245,197,66,0.14)" : "rgba(255,64,64,0.14)"}` }}>

                <div onClick={() => setExpanded(p => p===rv.id ? null : rv.id)}
                  style={{ padding:"11px 13px", cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:11, flexShrink:0,
                      background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.2)",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, overflow:"hidden" }}>
                      {rv.customerAvatar
                        ? <img src={rv.customerAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        : "👤"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ color:"#f8f0e0", fontSize:11, fontWeight:700 }}>{rv.customerName}</span>
                        <span style={{ color:"#3a2c1a", fontSize:8 }}>{fmtDate(rv.createdAt)}</span>
                      </div>
                      <div style={{ marginBottom:4 }}><Stars rating={s} size={13} /></div>
                      {rv.comment && (
                        <div style={{ color:"#b0956a", fontSize:10, lineHeight:1.5,
                          overflow: isOpen ? "visible" : "hidden",
                          display: isOpen ? "block" : "-webkit-box",
                          WebkitLineClamp: isOpen ? undefined : 2,
                          WebkitBoxOrient: "vertical" } as React.CSSProperties}>
                          "{rv.comment}"
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <span style={{ fontSize:18 }}>{ok ? "😊" : s===3 ? "😐" : "😞"}</span>
                      <span style={{ color:"#3a2c1a", fontSize:11, display:"inline-block",
                        transform: isOpen ? "rotate(180deg)" : "none", transition:"transform .2s" }}>⌾</span>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div key="d" initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
                      exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }} style={{ overflow:"hidden" }}>
                      <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)", padding:"10px 13px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8,
                          padding:"6px 10px", borderRadius:8,
                          background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.05)" }}>
                          <span style={{ fontSize:12 }}>🛍️</span>
                          <div style={{ flex:1 }}>
                            <div style={{ color:"#6a5a40", fontSize:8 }}>Đơn hàng</div>
                            <div style={{ color:"#b0956a", fontSize:9, fontWeight:600 }}>
                              #{rv.orderId.slice(0,8).toUpperCase()} · {fmt(rv.orderTotal)}
                            </div>
                          </div>
                          {rv.tipAmount > 0 && (
                            <div style={{ textAlign:"right" }}>
                              <div style={{ color:"#f5c542", fontSize:9, fontWeight:700 }}>💝 Tip</div>
                              <div style={{ color:"#f5c542", fontSize:10, fontWeight:800 }}>{fmt(rv.tipAmount)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>
    </>
  )
}
