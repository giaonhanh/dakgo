"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

type RTab = "shops" | "drivers"
type StarFilter = "all" | 1 | 2 | 3 | 4 | 5

interface ReviewRow {
  id: string
  targetId: string       // shop_id or driver_id
  targetName: string
  targetAvatar: string
  reviewerName: string
  orderId: string
  orderTotal: number
  foodRating: number | null
  driverRating: number | null
  rating: number         // whichever is relevant
  comment: string | null
  images: string[]
  tipAmount: number
  createdAt: string
  flagged: boolean
  rewarded: boolean
}

const NAV_ITEMS = [
  { icon:"🏠",  label:"Dashboard",   href:"/admin"               },
  { icon:"🏍️", label:"Tài xế",      href:"/admin/drivers"       },
  { icon:"🏪",  label:"Cửa hàng",    href:"/admin/merchants"     },
  { icon:"📦",  label:"Đơn hàng",    href:"/admin/orders"        },
  { icon:"👥",  label:"Khách hàng",  href:"/admin/users"         },
  { icon:"⭐",  label:"Đánh giá",    href:"/admin/reviews", active:true },
  { icon:"💰",  label:"Tài chính",   href:"/admin/finance"       },
  { icon:"🗺️", label:"Bản đồ live", href:"/admin/map"           },
  { icon:"🏷️", label:"Khuyến mãi",  href:"/admin/promotions"    },
  { icon:"⚖️",  label:"Tranh chấp",  href:"/admin/disputes"      },
  { icon:"📣",  label:"Thông báo",   href:"/admin/notifications" },
  { icon:"⚙️",  label:"Cài đặt",     href:"/admin/settings"      },
]

const fmt     = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN")

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span style={{ display:"inline-flex", gap:1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize:size, color: i <= rating ? "#f5c542" : "rgba(255,255,255,0.14)" }}>★</span>
      ))}
    </span>
  )
}

export default function AdminReviewsPage() {
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tab,         setTab]         = useState<RTab>("shops")
  const [shopReviews, setShopReviews] = useState<ReviewRow[]>([])
  const [drvReviews,  setDrvReviews]  = useState<ReviewRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [starFilter,  setStarFilter]  = useState<StarFilter>("all")
  const [search,      setSearch]      = useState("")
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [toast,       setToast]       = useState("")
  const [toastOk,     setToastOk]     = useState(true)
  const [actionModal, setActionModal] = useState<{ id:string; type:"warn"|"reward"; name:string } | null>(null)
  const [actionNote,  setActionNote]  = useState("")

  const fireToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3000)
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    // Shop reviews
    const { data: sr } = await supabase
      .from("reviews")
      .select(`
        id, food_rating, driver_rating, comment, images, tip_amount, created_at,
        shops!inner(id, name, logo_url),
        profiles!reviewer_id(full_name),
        orders!inner(id, total_amount)
      `)
      .not("shop_id", "is", null)
      .order("created_at", { ascending:false })
      .limit(100)

    if (sr) {
      setShopReviews(sr.map(r => {
        const shop   = (r.shops as unknown as Record<string, unknown>)
        const rev    = (r.profiles as unknown as Record<string, unknown>)
        const order  = (r.orders  as unknown as Record<string, unknown>)
        return {
          id:           r.id,
          targetId:     (shop?.id as string) ?? "",
          targetName:   (shop?.name as string) ?? "Cửa hàng",
          targetAvatar: (shop?.logo_url as string) ?? "",
          reviewerName: (rev?.full_name as string) ?? "Khách hàng",
          orderId:      (order?.id as string) ?? "",
          orderTotal:   (order?.total_amount as number) ?? 0,
          foodRating:   r.food_rating,
          driverRating: r.driver_rating,
          rating:       r.food_rating ?? 0,
          comment:      r.comment,
          images:       (r.images as string[]) ?? [],
          tipAmount:    r.tip_amount ?? 0,
          createdAt:    r.created_at,
          flagged:      false,
          rewarded:     false,
        }
      }))
    }

    // Driver reviews
    const { data: dr } = await supabase
      .from("reviews")
      .select(`
        id, food_rating, driver_rating, comment, images, tip_amount, created_at,
        drivers!inner(id),
        profiles!driver_id(full_name, avatar_url),
        profiles!reviewer_id(full_name),
        orders!inner(id, total_amount)
      `)
      .not("driver_id", "is", null)
      .not("driver_rating", "is", null)
      .order("created_at", { ascending:false })
      .limit(100)

    if (dr) {
      setDrvReviews(dr.map(r => {
        const drvProf = (r["profiles!driver_id"] as unknown as Record<string, unknown>)
        const rev     = (r["profiles!reviewer_id"] as unknown as Record<string, unknown>)
        const order   = (r.orders as unknown as Record<string, unknown>)
        return {
          id:           r.id,
          targetId:     (r.drivers as unknown as Record<string, unknown>)?.id as string ?? "",
          targetName:   (drvProf?.full_name as string) ?? "Tài xế",
          targetAvatar: (drvProf?.avatar_url as string) ?? "",
          reviewerName: (rev?.full_name as string) ?? "Khách hàng",
          orderId:      (order?.id as string) ?? "",
          orderTotal:   (order?.total_amount as number) ?? 0,
          foodRating:   r.food_rating,
          driverRating: r.driver_rating,
          rating:       r.driver_rating ?? 0,
          comment:      r.comment,
          images:       (r.images as string[]) ?? [],
          tipAmount:    r.tip_amount ?? 0,
          createdAt:    r.created_at,
          flagged:      false,
          rewarded:     false,
        }
      }))
    }

    setLoading(false)
  }

  const rows      = tab === "shops" ? shopReviews : drvReviews
  const setRows   = tab === "shops" ? setShopReviews : setDrvReviews

  const filtered  = rows
    .filter(r => starFilter === "all" ? true : r.rating === starFilter)
    .filter(r => !search || r.targetName.toLowerCase().includes(search.toLowerCase()) || r.reviewerName.toLowerCase().includes(search.toLowerCase()))

  const avgAll    = rows.length > 0 ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0
  const lowCount  = rows.filter(r => r.rating <= 2).length
  const highCount = rows.filter(r => r.rating >= 4).length

  const execAction = async () => {
    if (!actionModal) return
    const note = actionNote.trim()
    if (actionModal.type === "warn") {
      // Create notification for the target
      await supabase.from("notifications").insert({
        user_id: actionModal.id,
        type: "system",
        title: "⚠️ Cảnh báo từ Admin",
        body: note || `Bạn nhận được đánh giá thấp. Vui lòng cải thiện chất lượng dịch vụ.`,
      })
      setRows(rs => rs.map(r => r.targetId === actionModal.id ? { ...r, flagged:true } : r))
      fireToast(`⚠️ Đã gửi cảnh báo tới ${actionModal.name}`, false)
    } else {
      await supabase.from("notifications").insert({
        user_id: actionModal.id,
        type: "system",
        title: "🏆 Khen thưởng từ Admin",
        body: note || `Chúc mừng! Bạn được khen thưởng vì chất lượng dịch vụ xuất sắc.`,
      })
      setRows(rs => rs.map(r => r.targetId === actionModal.id ? { ...r, rewarded:true } : r))
      fireToast(`🏆 Đã gửi khen thưởng tới ${actionModal.name}`)
    }
    setActionModal(null)
    setActionNote("")
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#06050a;font-family:'Lexend',sans-serif;height:100%;overflow:hidden}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        input,select,textarea{outline:none;font-family:'Lexend',sans-serif}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .rv-row:hover{background:rgba(255,107,0,0.03)!important;border-color:rgba(255,107,0,0.16)!important}
        .sidebar-link:hover{background:rgba(255,107,0,0.08)!important}
        .action-btn:hover{filter:brightness(1.2);transform:scale(1.03)}
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
            style={{ position:"fixed", top:70, left:"50%", transform:"translateX(-50%)", zIndex:200,
              background: toastOk ? "rgba(62,207,110,0.15)" : "rgba(255,64,64,0.15)",
              border:`1px solid ${toastOk ? "rgba(62,207,110,0.35)" : "rgba(255,64,64,0.35)"}`,
              borderRadius:12, padding:"8px 20px", color: toastOk ? "#3ecf6e" : "#ff4040",
              fontSize:11, fontWeight:600, backdropFilter:"blur(12px)", whiteSpace:"nowrap" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display:"flex", height:"100vh", background:"#06050a", color:"#f0eaff", overflow:"hidden" }}>

        {/* SIDEBAR */}
        <div style={{ width:sidebarOpen?220:60, flexShrink:0, background:"rgba(10,9,18,0.97)",
          backdropFilter:"blur(20px)", borderRight:"1px solid rgba(255,107,0,0.1)",
          display:"flex", flexDirection:"column", transition:"width 0.25s ease", overflow:"hidden", zIndex:50 }}>
          <div style={{ height:56, display:"flex", alignItems:"center", padding:"0 14px", gap:10,
            flexShrink:0, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ width:30, height:30, borderRadius:9, flexShrink:0,
              background:"linear-gradient(135deg,#FF6B00,#FF8C00,#FFB347)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🚀</div>
            {sidebarOpen && (
              <div>
                <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700 }}>Giao Nhanh</div>
                <div style={{ fontSize:8, fontWeight:700, padding:"1px 5px",
                  background:"rgba(180,100,255,0.15)", border:"1px solid rgba(180,100,255,0.3)",
                  borderRadius:4, color:"#b464ff", display:"inline-block" }}>ADMIN</div>
              </div>
            )}
          </div>
          <nav style={{ flex:1, padding:"10px 8px", overflowY:"auto" }}>
            {NAV_ITEMS.map(item => (
              <a key={item.href} href={item.href} style={{ textDecoration:"none" }}>
                <div className="sidebar-link" style={{ display:"flex", alignItems:"center", gap:10,
                  padding: sidebarOpen ? "8px 10px" : "8px", borderRadius:10, marginBottom:3,
                  cursor:"pointer", transition:"all 0.2s",
                  background: item.active ? "rgba(255,107,0,0.12)" : "transparent",
                  borderLeft: item.active ? "2px solid #FF6B00" : "2px solid transparent",
                  justifyContent: sidebarOpen ? "flex-start" : "center" }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
                  {sidebarOpen && <span style={{ fontSize:11, whiteSpace:"nowrap",
                    fontWeight: item.active ? 600 : 400,
                    color: item.active ? "#FF8C00" : "rgba(144,128,176,0.8)" }}>{item.label}</span>}
                </div>
              </a>
            ))}
          </nav>
          <div onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ height:44, display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", borderTop:"1px solid rgba(255,255,255,0.06)", color:"rgba(144,128,176,0.5)", fontSize:14 }}>
            {sidebarOpen ? "◀" : "▶"}
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Top bar */}
          <div style={{ height:56, flexShrink:0, display:"flex", alignItems:"center",
            justifyContent:"space-between", padding:"0 20px",
            background:"rgba(10,9,18,0.85)", backdropFilter:"blur(12px)",
            borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <div style={{ color:"rgba(144,128,176,0.45)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Admin / Quản lý</div>
              <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>⭐ Đánh giá & Nhận xét</div>
            </div>
            <div style={{ color:"rgba(144,128,176,0.4)", fontSize:9 }}>Phước An · {new Date().toLocaleDateString("vi-VN")}</div>
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:16 }}>

            {/* KPI row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
              {[
                { icon:"⭐", label:`TB ${tab==="shops"?"quán":"tài xế"}`, value:avgAll.toFixed(1), sub:`${rows.length} đánh giá`, c:"#f5c542", bg:"rgba(245,197,66,0.07)", bd:"rgba(245,197,66,0.2)" },
                { icon:"😊", label:"Đánh giá tốt",  value:String(highCount), sub:"4–5 sao", c:"#3ecf6e", bg:"rgba(62,207,110,0.07)", bd:"rgba(62,207,110,0.2)" },
                { icon:"😞", label:"Đánh giá thấp", value:String(lowCount),  sub:"1–2 sao", c:"#ff4040", bg:"rgba(255,64,64,0.07)",   bd:"rgba(255,64,64,0.2)"   },
                { icon:"💝", label:"Tip nhận được", value:fmt(rows.reduce((s,r)=>s+r.tipAmount,0)), sub:"Tổng cộng", c:"#b464ff", bg:"rgba(180,100,255,0.07)", bd:"rgba(180,100,255,0.2)" },
              ].map((k,i) => (
                <div key={i} style={{ background:k.bg, border:`1px solid ${k.bd}`, borderRadius:13, padding:"11px 12px",
                  animation:"fadeUp .35s ease both", animationDelay:`${i*0.06}s` }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:k.bg, border:`1px solid ${k.bd}`,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, marginBottom:6 }}>{k.icon}</div>
                  <div style={{ color:k.c, fontSize:20, fontWeight:800, lineHeight:1, marginBottom:2 }}>{k.value}</div>
                  <div style={{ color:"rgba(240,234,255,0.55)", fontSize:9 }}>{k.label}</div>
                  <div style={{ color:"rgba(144,128,176,0.4)", fontSize:8, marginTop:2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Tabs + search */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
              borderRadius:13, padding:"11px 13px", marginBottom:12 }}>
              <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                {([
                  { key:"shops",   label:`🏪 Cửa hàng (${shopReviews.length})` },
                  { key:"drivers", label:`🏍️ Tài xế (${drvReviews.length})` },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => { setTab(t.key); setStarFilter("all"); setSearch("") }}
                    style={{ flex:1, height:36, borderRadius:9, cursor:"pointer", fontFamily:"Lexend",
                      background: tab===t.key ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                      border: tab===t.key ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.07)",
                      color: tab===t.key ? "#FF8C00" : "rgba(144,128,176,0.6)", fontSize:10, fontWeight: tab===t.key ? 700 : 400 }}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1, display:"flex", alignItems:"center", gap:8,
                  background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:9, padding:"7px 11px" }}>
                  <span style={{ color:"rgba(144,128,176,0.5)", fontSize:14 }}>🔍</span>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={tab==="shops" ? "Tìm tên quán, khách hàng..." : "Tìm tên tài xế, khách hàng..."}
                    style={{ flex:1, background:"transparent", border:"none", color:"#f0eaff", fontSize:11 }} />
                  {search && <span onClick={() => setSearch("")} style={{ color:"rgba(144,128,176,0.4)", cursor:"pointer" }}>✕</span>}
                </div>
                <div style={{ display:"flex", gap:5 }}>
                  {(["all",5,4,3,2,1] as StarFilter[]).map(s => (
                    <button key={String(s)} onClick={() => setStarFilter(s)}
                      style={{ padding:"5px 10px", borderRadius:8, cursor:"pointer", fontFamily:"Lexend", fontSize:9,
                        fontWeight: starFilter===s ? 700 : 400,
                        background: starFilter===s ? "rgba(245,197,66,0.12)" : "rgba(255,255,255,0.04)",
                        border: starFilter===s ? "1px solid rgba(245,197,66,0.35)" : "1px solid rgba(255,255,255,0.07)",
                        color: starFilter===s ? "#f5c542" : "rgba(144,128,176,0.5)" }}>
                      {s==="all" ? "Tất cả" : `${s}★`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Review list */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:13, overflow:"hidden" }}>
              {/* Header */}
              <div style={{ display:"grid", gridTemplateColumns:"44px 1.4fr 1fr 80px 80px 1fr 160px", gap:8,
                padding:"9px 14px", borderBottom:"1px solid rgba(255,255,255,0.07)",
                background:"rgba(255,255,255,0.02)" }}>
                {["","Đánh giá cho","Từ khách","Sao","Tip","Nhận xét","Thao tác"].map(h => (
                  <div key={h} style={{ color:"rgba(144,128,176,0.4)", fontSize:7.5, textTransform:"uppercase", letterSpacing:0.5, fontWeight:700 }}>{h}</div>
                ))}
              </div>

              {loading ? (
                <div style={{ padding:"40px 0", textAlign:"center", color:"rgba(144,128,176,0.35)", fontSize:11 }}>Đang tải...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding:"40px 0", textAlign:"center", color:"rgba(144,128,176,0.35)", fontSize:11 }}>Không có đánh giá nào</div>
              ) : filtered.map((rv, idx) => {
                const isOpen = expanded === rv.id
                return (
                  <div key={rv.id}>
                    <div className="rv-row" onClick={() => setExpanded(p => p===rv.id ? null : rv.id)}
                      style={{ display:"grid", gridTemplateColumns:"44px 1.4fr 1fr 80px 80px 1fr 160px", gap:8,
                        padding:"10px 14px", borderBottom: idx < filtered.length-1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        cursor:"pointer", alignItems:"center",
                        background: rv.flagged ? "rgba(255,64,64,0.03)" : rv.rewarded ? "rgba(245,197,66,0.03)" : "transparent",
                        transition:"all 0.15s" }}>

                      {/* Avatar */}
                      <div style={{ width:36, height:36, borderRadius:10,
                        background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:18, overflow:"hidden", flexShrink:0 }}>
                        {rv.targetAvatar
                          ? <img src={rv.targetAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                          : tab==="shops" ? "🏪" : "🏍️"}
                      </div>

                      {/* Target name */}
                      <div style={{ minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                          <span style={{ color:"#f0eaff", fontSize:11, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {rv.targetName}
                          </span>
                          {rv.flagged  && <span style={{ background:"rgba(255,64,64,0.1)", border:"1px solid rgba(255,64,64,0.3)", borderRadius:4, padding:"1px 5px", color:"#ff4040", fontSize:7, fontWeight:700, flexShrink:0 }}>⚠️ Cảnh báo</span>}
                          {rv.rewarded && <span style={{ background:"rgba(245,197,66,0.1)", border:"1px solid rgba(245,197,66,0.3)", borderRadius:4, padding:"1px 5px", color:"#f5c542", fontSize:7, fontWeight:700, flexShrink:0 }}>🏆 Khen</span>}
                        </div>
                        <div style={{ color:"rgba(144,128,176,0.4)", fontSize:8, marginTop:2 }}>{fmtDate(rv.createdAt)}</div>
                      </div>

                      {/* Reviewer */}
                      <div style={{ color:"rgba(240,234,255,0.6)", fontSize:10 }}>{rv.reviewerName}</div>

                      {/* Stars */}
                      <div><Stars rating={rv.rating} size={11} /></div>

                      {/* Tip */}
                      <div style={{ color: rv.tipAmount > 0 ? "#f5c542" : "rgba(144,128,176,0.3)", fontSize:9, fontWeight: rv.tipAmount > 0 ? 700 : 400 }}>
                        {rv.tipAmount > 0 ? fmt(rv.tipAmount) : "—"}
                      </div>

                      {/* Comment */}
                      <div style={{ color:"rgba(176,149,106,0.65)", fontSize:9, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {rv.comment ? `"${rv.comment}"` : <span style={{ color:"rgba(144,128,176,0.3)" }}>Không có nhận xét</span>}
                      </div>

                      {/* Actions */}
                      <div style={{ display:"flex", gap:5 }} onClick={e => e.stopPropagation()}>
                        <button className="action-btn"
                          onClick={() => setActionModal({ id:rv.targetId, type:"warn", name:rv.targetName })}
                          style={{ padding:"4px 8px", borderRadius:6, cursor:"pointer", fontFamily:"Lexend",
                            background:"rgba(255,64,64,0.08)", border:"1px solid rgba(255,64,64,0.2)",
                            color:"#ff4040", fontSize:8, fontWeight:700 }}>⚠️ Cảnh báo</button>
                        <button className="action-btn"
                          onClick={() => setActionModal({ id:rv.targetId, type:"reward", name:rv.targetName })}
                          style={{ padding:"4px 8px", borderRadius:6, cursor:"pointer", fontFamily:"Lexend",
                            background:"rgba(245,197,66,0.08)", border:"1px solid rgba(245,197,66,0.25)",
                            color:"#f5c542", fontSize:8, fontWeight:700 }}>🏆 Khen</button>
                      </div>
                    </div>

                    {/* Expanded row */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div key="exp" initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
                          exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }} style={{ overflow:"hidden" }}>
                          <div style={{ padding:"10px 14px 12px", borderBottom:"1px solid rgba(255,255,255,0.04)",
                            background:"rgba(255,255,255,0.015)" }}>
                            {rv.comment && (
                              <div style={{ marginBottom: rv.images.length > 0 ? 10 : 0,
                                background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)",
                                borderRadius:9, padding:"8px 12px", color:"#b0956a", fontSize:10, lineHeight:1.6 }}>
                                💬 "{rv.comment}"
                              </div>
                            )}
                            {rv.images.length > 0 && (
                              <div style={{ display:"flex", gap:8 }}>
                                {rv.images.map((img, i) => (
                                  <img key={i} src={img} alt="" style={{ width:72, height:72, borderRadius:9,
                                    objectFit:"cover", border:"1px solid rgba(255,255,255,0.08)" }} />
                                ))}
                              </div>
                            )}
                            <div style={{ marginTop:8, display:"flex", gap:10 }}>
                              <span style={{ color:"rgba(144,128,176,0.4)", fontSize:8 }}>
                                Đơn #{rv.orderId.slice(0,8).toUpperCase()} · {fmt(rv.orderTotal)}
                              </span>
                              {tab==="shops" && rv.driverRating !== null && (
                                <span style={{ color:"rgba(144,128,176,0.4)", fontSize:8 }}>
                                  · Tài xế: {rv.driverRating}★
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}

              <div style={{ padding:"8px 14px", borderTop:"1px solid rgba(255,255,255,0.05)",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ color:"rgba(144,128,176,0.35)", fontSize:8 }}>
                  Hiển thị {filtered.length} / {rows.length} đánh giá
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action modal (warn / reward) ── */}
      <AnimatePresence>
        {actionModal && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => { setActionModal(null); setActionNote("") }}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:70, backdropFilter:"blur(6px)" }} />
            <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.9 }}
              transition={{ type:"spring", damping:22, stiffness:350 }}
              style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
                width:360, background:"#0d0b19", borderRadius:18, padding:"22px 20px 18px", zIndex:71,
                border: actionModal.type==="warn" ? "1px solid rgba(255,64,64,0.25)" : "1px solid rgba(245,197,66,0.25)" }}>
              <div style={{ fontSize:40, textAlign:"center", marginBottom:8 }}>
                {actionModal.type==="warn" ? "⚠️" : "🏆"}
              </div>
              <div style={{ color:"#f0eaff", fontSize:14, fontWeight:800, textAlign:"center", marginBottom:4 }}>
                {actionModal.type==="warn" ? "Gửi cảnh báo" : "Gửi khen thưởng"}
              </div>
              <div style={{ fontSize:11, fontWeight:700, textAlign:"center", marginBottom:14,
                background: actionModal.type==="warn" ? "rgba(255,64,64,0.08)" : "rgba(245,197,66,0.08)",
                border: actionModal.type==="warn" ? "1px solid rgba(255,64,64,0.2)" : "1px solid rgba(245,197,66,0.2)",
                borderRadius:7, padding:"5px 10px",
                color: actionModal.type==="warn" ? "#ff4040" : "#f5c542" }}>
                {actionModal.name}
              </div>
              <div style={{ color:"rgba(144,128,176,0.5)", fontSize:9.5, marginBottom:6 }}>
                Nội dung thông báo (để trống dùng mặc định)
              </div>
              <textarea value={actionNote} onChange={e => setActionNote(e.target.value)}
                placeholder={actionModal.type==="warn"
                  ? "VD: Nhận nhiều đánh giá 1–2 sao trong tuần qua. Vui lòng cải thiện dịch vụ."
                  : "VD: Chúc mừng! Bạn đạt 5 sao liên tiếp trong tháng này."}
                style={{ width:"100%", minHeight:72, background:"rgba(255,255,255,0.04)",
                  border: actionModal.type==="warn" ? "1px solid rgba(255,64,64,0.2)" : "1px solid rgba(245,197,66,0.2)",
                  borderRadius:11, color:"#f0eaff", fontSize:10, padding:"8px 12px",
                  resize:"none", fontFamily:"Lexend", marginBottom:14 }} />
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => { setActionModal(null); setActionNote("") }}
                  style={{ flex:1, height:40, borderRadius:10, cursor:"pointer", fontFamily:"Lexend",
                    background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)",
                    color:"rgba(144,128,176,0.6)", fontSize:11, fontWeight:600 }}>Hủy</button>
                <button onClick={execAction}
                  style={{ flex:2, height:40, borderRadius:10, border:"none", cursor:"pointer", fontFamily:"Lexend",
                    background: actionModal.type==="warn" ? "rgba(255,64,64,0.15)" : "rgba(245,197,66,0.15)",
                    outline: actionModal.type==="warn" ? "1px solid rgba(255,64,64,0.35)" : "1px solid rgba(245,197,66,0.35)",
                    color: actionModal.type==="warn" ? "#ff4040" : "#f5c542",
                    fontSize:12, fontWeight:800 }}>
                  {actionModal.type==="warn" ? "⚠️ Gửi cảnh báo" : "🏆 Gửi khen thưởng"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
