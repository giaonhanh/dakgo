"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

type PtsTxType = "order_complete" | "bonus" | "redeem" | string
interface PtsTx {
  id: string; type: PtsTxType; label: string
  points: number; time: string
}

const REDEEM_RATE = 100 // 100 điểm = 1.000 xu

const TIERS_DATA = [
  { id:"bronze",   name:"Đồng",     icon:"🥉", min:0,     max:999,      color:"#CD7F32", bg:"rgba(205,127,50,0.12)",  benefits:["Tích điểm cơ bản","Hỗ trợ thường"] },
  { id:"silver",   name:"Bạc",      icon:"🥈", min:1000,  max:4999,     color:"#9CA3AF", bg:"rgba(156,163,175,0.12)", benefits:["+5% điểm mỗi đơn","Hỗ trợ ưu tiên","Sinh nhật bonus"] },
  { id:"gold",     name:"Vàng",     icon:"🥇", min:5000,  max:19999,    color:"#F5C542", bg:"rgba(245,197,66,0.12)",  benefits:["+10% điểm mỗi đơn","Ưu tiên tài xế","Giảm phí ship 5%"] },
  { id:"platinum", name:"Bạch Kim", icon:"💎", min:20000, max:Infinity, color:"#b464ff", bg:"rgba(180,100,255,0.12)", benefits:["+20% điểm mỗi đơn","Freeship mỗi tuần","VIP support 24/7"] },
]

const REWARD_VOUCHERS = [
  { id:"R001", title:"Freeship đơn tiếp theo", icon:"🚀", type:"freeship" as const, value:15000, pointCost:200, stock:50, minTier:"Đồng"  },
  { id:"R002", title:"Giảm 20k đơn từ 100k",  icon:"💳", type:"fixed"    as const, value:20000, pointCost:300, stock:30, minTier:"Bạc"   },
  { id:"R003", title:"Giảm 10% tối đa 30k",   icon:"%",  type:"percent"  as const, value:10,    pointCost:500, stock:20, minTier:"Bạc"   },
  { id:"R004", title:"Giảm 50k đơn từ 200k",  icon:"🎁", type:"fixed"    as const, value:50000, pointCost:800, stock:10, minTier:"Vàng"  },
]

const PTS_TX_CFG: Record<string, { icon:string; color:string; bg:string; label:string }> = {
  order_complete: { icon:"🛒", color:"#F5C542", bg:"rgba(245,197,66,0.1)",  label:"Đơn hàng"   },
  bonus:          { icon:"🎁", color:"#FFB347", bg:"rgba(255,179,71,0.12)", label:"Admin cộng" },
  redeem:         { icon:"🔄", color:"#b464ff", bg:"rgba(180,100,255,0.1)", label:"Đổi điểm"   },
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 86400)  return `Hôm nay · ${new Date(dateStr).toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" })}`
  if (diff < 172800) return "Hôm qua"
  return `${Math.floor(diff/86400)} ngày trước`
}

export default function PointsPage() {
  const supabase = createClient()
  const [userEarned, setUserEarned] = useState(0)
  const [ptsTxs,     setPtsTxs]    = useState<PtsTx[]>([])
  const [showRedeem,  setShowRedeem]  = useState(false)
  const [redeemInput, setRedeemInput] = useState("")
  const [filterType,  setFilterType]  = useState<string>("all")
  const [toast,       setToast]       = useState("")

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: pts } = await supabase
        .from("loyalty_points").select("total_points").eq("user_id", user.id).maybeSingle()
      if (pts) setUserEarned(pts.total_points)
      const { data: txData } = await supabase
        .from("point_transactions")
        .select("id,points,reason,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30)
      setPtsTxs((txData ?? []).map((t: {id:string;points:number;reason:string;created_at:string}) => ({
        id: t.id, type: t.reason, label: PTS_TX_CFG[t.reason]?.label ?? t.reason,
        points: t.points, time: timeAgo(t.created_at),
      })))
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const CUR_IDX  = Math.max(0, TIERS_DATA.findIndex(t => userEarned >= t.min && userEarned <= t.max))
  const CUR_TIER = TIERS_DATA[CUR_IDX]
  const NXT_TIER = TIERS_DATA[CUR_IDX + 1] ?? null
  const TIER_PCT = NXT_TIER ? Math.round((userEarned - CUR_TIER.min) / (NXT_TIER.min - CUR_TIER.min) * 100) : 100

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2400) }
  const filtered = ptsTxs.filter(t => filterType === "all" || t.type === filterType)

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
        html, body { background: #080806; font-family: 'Lexend', sans-serif; height: 100%; overflow: hidden }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-thumb { background: rgba(245,197,66,0.25); border-radius: 2px }
        @keyframes shimmer   { 0% { left: -60% } 100% { left: 120% } }
        @keyframes goldPulse { 0%,100% { box-shadow: 0 0 16px rgba(245,197,66,0.25) } 50% { box-shadow: 0 0 30px rgba(245,197,66,0.45) } }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-14 }}
            style={{ position:"fixed", top:52, left:"50%", transform:"translateX(-50%)",
              zIndex:999, whiteSpace:"nowrap",
              background:"rgba(245,197,66,0.12)", border:"1px solid rgba(245,197,66,0.3)",
              borderRadius:12, padding:"7px 18px", color:"#F5C542",
              fontSize:11, fontWeight:600, backdropFilter:"blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Đổi điểm → Xu Sheet ── */}
      <AnimatePresence>
        {showRedeem && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setShowRedeem(false)}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:90, backdropFilter:"blur(4px)" }} />
            <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
              transition={{ type:"spring", damping:27, stiffness:300 }}
              style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:91,
                background:"#0e0c09", border:"1px solid rgba(245,197,66,0.22)",
                borderRadius:"22px 22px 0 0", padding:"20px 18px 36px" }}>
              <div style={{ width:36, height:4, background:"rgba(255,255,255,0.12)",
                borderRadius:2, margin:"0 auto 16px" }} />
              <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:700, marginBottom:4 }}>
                🔄 Đổi điểm thành xu
              </div>
              <div style={{ color:"#6a5a40", fontSize:9, marginBottom:14 }}>
                Tỷ lệ: {REDEEM_RATE} điểm = 1.000 xu · Bạn có{" "}
                <span style={{ color:"#F5C542", fontWeight:700 }}>{userEarned.toLocaleString()} điểm</span>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:7, marginBottom:12 }}>
                {[200, 500, 1000].filter(v => v <= userEarned).map(v => (
                  <div key={v} onClick={() => setRedeemInput(String(v))}
                    style={{ height:52, borderRadius:11, cursor:"pointer",
                      background: redeemInput===String(v) ? "rgba(245,197,66,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${redeemInput===String(v) ? "rgba(245,197,66,0.4)" : "rgba(255,255,255,0.08)"}`,
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                      color: redeemInput===String(v) ? "#F5C542" : "#b0956a",
                      fontSize:10, fontWeight: redeemInput===String(v) ? 700 : 400, transition:"all .15s" }}>
                    <span>{v.toLocaleString()} điểm</span>
                    <span style={{ fontSize:8, opacity:0.6, marginTop:1 }}>→ {(v*10).toLocaleString()} xu</span>
                  </div>
                ))}
              </div>

              <GInput label="Hoặc nhập số điểm muốn đổi" value={redeemInput}
                onChange={setRedeemInput} placeholder={`Tối đa ${userEarned.toLocaleString()} · bội số ${REDEEM_RATE}`}
                icon="⭐" type="number" />

              {redeemInput && parseInt(redeemInput) > 0 && (
                <div style={{ background:"rgba(245,197,66,0.07)", border:"1px solid rgba(245,197,66,0.2)",
                  borderRadius:10, padding:"10px 13px", marginBottom:14,
                  display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ color:"#6a5a40", fontSize:9 }}>Bạn nhận được</div>
                    <div style={{ color:"#b464ff", fontSize:14, fontWeight:700, marginTop:1 }}>
                      {((parseInt(redeemInput)||0)*10).toLocaleString()} xu
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#6a5a40", fontSize:9 }}>Điểm còn lại</div>
                    <div style={{ color:"#F5C542", fontSize:13, fontWeight:700, marginTop:1 }}>
                      {(userEarned - (parseInt(redeemInput)||0)).toLocaleString()} điểm
                    </div>
                  </div>
                </div>
              )}

              <button onClick={() => {
                const pts = parseInt(redeemInput) || 0
                if (pts <= 0) { fireToast("Nhập số điểm muốn đổi"); return }
                if (pts > userEarned) { fireToast("Không đủ điểm"); return }
                if (pts % REDEEM_RATE !== 0) { fireToast(`Phải là bội số của ${REDEEM_RATE} điểm`); return }
                fireToast(`Đổi thành công ${pts.toLocaleString()} điểm → ${(pts*10).toLocaleString()} xu!`)
                setShowRedeem(false); setRedeemInput("")
              }} style={{ width:"100%", height:46, borderRadius:12, border:"none",
                background:"linear-gradient(90deg,#F5C542,#FFB347)",
                color:"#1a1200", fontSize:12, fontWeight:800, fontFamily:"Lexend",
                cursor:"pointer", boxShadow:"0 3px 14px rgba(245,197,66,0.3)" }}>
                ✨ Xác nhận đổi điểm
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── ROOT ── */}
      <div style={{ position:"fixed", inset:0, background:"#080806",
        display:"flex", flexDirection:"column", fontFamily:"'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)", backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          padding:"calc(env(safe-area-inset-top) + 12px) 16px 12px", flexShrink:0, zIndex:40 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/wallet" style={{ width:32, height:32, borderRadius:9, textDecoration:"none",
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>⭐ Điểm Tích Lũy</div>
              <div style={{ color:"#6a5a40", fontSize:9, marginTop:1 }}>Tích từ đơn hàng · Đổi xu & voucher</div>
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px 88px",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* Balance card */}
          <div style={{ background:"linear-gradient(135deg,#1a1200,#251800,#0d0900)",
            border:"1px solid rgba(245,197,66,0.32)", borderRadius:18,
            padding:"18px 16px", marginBottom:12,
            position:"relative", overflow:"hidden", animation:"goldPulse 3s infinite" }}>
            <div style={{ position:"absolute", top:-20, right:-20, width:120, height:120,
              background:"radial-gradient(circle,rgba(245,197,66,0.18) 0%,transparent 65%)" }} />
            <div style={{ position:"absolute", top:0, left:"-100%", width:"50%", height:"100%",
              background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)",
              animation:"shimmer 4s infinite" }} />

            <div style={{ color:"rgba(245,197,66,0.55)", fontSize:10, marginBottom:4, position:"relative", zIndex:1 }}>
              Điểm hiện có
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4, position:"relative", zIndex:1 }}>
              <div style={{ fontSize:36, fontWeight:800, lineHeight:1,
                background:"linear-gradient(135deg,#F5C542,#FFB347,#FF8C00)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
                {userEarned.toLocaleString("vi-VN")}
              </div>
              <span style={{ color:"#F5C542", fontSize:16, fontWeight:600 }}>điểm</span>
            </div>
            <div style={{ color:"rgba(245,197,66,0.4)", fontSize:10, marginBottom:12, position:"relative", zIndex:1 }}>
              dùng xét hạng · đổi xu (100đ = 1.000xu) · đổi voucher
            </div>
            <div style={{ display:"flex", gap:6, position:"relative", zIndex:1 }}>
              <div style={{ background:CUR_TIER.bg, border:`1px solid ${CUR_TIER.color}55`,
                borderRadius:7, padding:"3px 9px", color:CUR_TIER.color, fontSize:9, fontWeight:600 }}>
                {CUR_TIER.icon} {CUR_TIER.name} Member
              </div>
              <div style={{ background:"rgba(255,255,255,0.07)", borderRadius:7, padding:"3px 9px",
                color:"rgba(255,255,255,0.35)", fontSize:9 }}>
                {REDEEM_RATE} điểm = 1.000 xu
              </div>
            </div>
          </div>

          {/* ── Hạng thành viên ── */}
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:16, padding:"14px 14px 12px", marginBottom:12 }}>
            <div style={{ color:"#b0956a", fontSize:10, fontWeight:600, marginBottom:14 }}>🏆 Hạng thành viên</div>

            {/* 4-tier roadmap */}
            <div style={{ position:"relative", display:"flex", justifyContent:"space-between",
              alignItems:"flex-start", marginBottom:14 }}>
              <div style={{ position:"absolute", top:21, left:"11%", right:"11%", height:2,
                background:"rgba(255,255,255,0.08)", zIndex:0 }} />
              {TIERS_DATA.map((tier, i) => {
                const isCurrent = i === CUR_IDX
                const isPast    = i < CUR_IDX
                return (
                  <div key={tier.id} style={{ display:"flex", flexDirection:"column", alignItems:"center",
                    flex:1, position:"relative", zIndex:1 }}>
                    <div style={{ width:isCurrent?46:36, height:isCurrent?46:36, borderRadius:"50%",
                      background: isPast||isCurrent ? tier.bg : "rgba(255,255,255,0.04)",
                      border: `2px solid ${isPast||isCurrent ? tier.color : "rgba(255,255,255,0.08)"}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:isCurrent?22:16, margin:"0 auto",
                      boxShadow: isCurrent ? `0 0 18px ${tier.color}55` : "none" }}>
                      {tier.icon}
                    </div>
                    <div style={{ color:isPast||isCurrent ? tier.color : "#3a2c1c",
                      fontSize:isCurrent?9.5:8, fontWeight:isCurrent?700:400, marginTop:4, textAlign:"center" }}>
                      {tier.name}
                    </div>
                    {isCurrent && <div style={{ color:"rgba(255,255,255,0.3)", fontSize:7, marginTop:1 }}>← bạn</div>}
                  </div>
                )
              })}
            </div>

            {/* Progress bar */}
            {NXT_TIER && (
              <div style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ color:CUR_TIER.color, fontSize:8.5, fontWeight:600 }}>
                    {CUR_TIER.icon} {CUR_TIER.name} · {userEarned.toLocaleString("vi-VN")} điểm
                  </span>
                  <span style={{ color:NXT_TIER.color, fontSize:8.5 }}>
                    {NXT_TIER.icon} {NXT_TIER.name} · {NXT_TIER.min.toLocaleString("vi-VN")} điểm
                  </span>
                </div>
                <div style={{ height:7, background:"rgba(255,255,255,0.07)", borderRadius:4, overflow:"hidden" }}>
                  <motion.div initial={{ width:0 }} animate={{ width:`${TIER_PCT}%` }}
                    transition={{ duration:1.2, ease:"easeOut" }}
                    style={{ height:"100%", background:`linear-gradient(90deg,${CUR_TIER.color},${NXT_TIER.color})`, borderRadius:4 }} />
                </div>
                <div style={{ color:"#6a5a40", fontSize:8.5, marginTop:5, textAlign:"center" }}>
                  Tích thêm {(NXT_TIER.min - userEarned).toLocaleString("vi-VN")} điểm để lên hạng {NXT_TIER.name} {NXT_TIER.icon}
                </div>
              </div>
            )}

            {/* Quyền lợi */}
            <div style={{ background:CUR_TIER.bg, border:`1px solid ${CUR_TIER.color}35`, borderRadius:11, padding:"10px 12px" }}>
              <div style={{ color:CUR_TIER.color, fontSize:9, fontWeight:700, marginBottom:7 }}>
                {CUR_TIER.icon} Quyền lợi hạng {CUR_TIER.name}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 8px", marginBottom:NXT_TIER?8:0 }}>
                {CUR_TIER.benefits.map(b => (
                  <div key={b} style={{ color:"rgba(255,255,255,0.65)", fontSize:8.5 }}>✓ {b}</div>
                ))}
              </div>
              {NXT_TIER && (
                <div style={{ paddingTop:7, borderTop:`1px solid ${CUR_TIER.color}22` }}>
                  <div style={{ color:"rgba(255,255,255,0.3)", fontSize:8, marginBottom:3 }}>
                    🔓 Mở khóa ở hạng {NXT_TIER.name}:
                  </div>
                  <div style={{ color:"rgba(255,255,255,0.35)", fontSize:8 }}>
                    {NXT_TIER.benefits.join(" · ")}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Đổi điểm ── */}
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:16, padding:"14px 14px 12px", marginBottom:12 }}>
            <div style={{ color:"#b0956a", fontSize:10, fontWeight:600, marginBottom:12 }}>🎁 Đổi điểm</div>

            {/* Đổi điểm → xu */}
            <div onClick={() => setShowRedeem(true)}
              style={{ background:"rgba(245,197,66,0.07)", border:"1px solid rgba(245,197,66,0.2)",
                borderRadius:12, padding:"12px 13px", marginBottom:10, cursor:"pointer",
                display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:11, background:"rgba(245,197,66,0.15)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:21, flexShrink:0 }}>💸</div>
              <div style={{ flex:1 }}>
                <div style={{ color:"#f8f0e0", fontSize:11, fontWeight:600, marginBottom:2 }}>Đổi điểm thành xu</div>
                <div style={{ color:"#6a5a40", fontSize:8.5 }}>
                  {REDEEM_RATE} điểm = 1.000 xu · dùng thanh toán ngay
                </div>
              </div>
              <div style={{ background:"linear-gradient(90deg,#F5C542,#FFB347)", borderRadius:8,
                padding:"5px 11px", color:"#1a1200", fontSize:9, fontWeight:800, flexShrink:0 }}>
                Đổi →
              </div>
            </div>

            {/* Đổi điểm → voucher */}
            <div style={{ color:"#b0956a", fontSize:9, fontWeight:600, marginBottom:8 }}>🎫 Đổi điểm lấy voucher</div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {REWARD_VOUCHERS.map(rv => {
                const canRedeem = userEarned >= rv.pointCost
                return (
                  <div key={rv.id}
                    style={{ background: canRedeem ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${canRedeem ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}`,
                      borderRadius:11, padding:"10px 12px", display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:9,
                      background: canRedeem ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:18, flexShrink:0 }}>{rv.icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color: canRedeem ? "#f8f0e0" : "#6a5a40", fontSize:10, fontWeight:500,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{rv.title}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                        <span style={{ color:"#F5C542", fontSize:8.5, fontWeight:600 }}>
                          {rv.pointCost.toLocaleString()} điểm
                        </span>
                        <span style={{ color:"#6a5a40", fontSize:7.5 }}>Hạng tối thiểu: {rv.minTier}</span>
                      </div>
                    </div>
                    <button onClick={() => {
                      if (!canRedeem) { fireToast(`Cần thêm ${(rv.pointCost-userEarned).toLocaleString()} điểm`); return }
                      fireToast(`Đã đổi voucher "${rv.title}" thành công!`)
                    }} style={{ height:30, padding:"0 12px", borderRadius:8, border:"none",
                      cursor: canRedeem ? "pointer" : "not-allowed", fontFamily:"Lexend",
                      fontSize:9, fontWeight:700, flexShrink:0,
                      background: canRedeem ? "linear-gradient(90deg,#FF6B00,#FF8C00)" : "rgba(255,255,255,0.06)",
                      color: canRedeem ? "#fff" : "#3a2c1c",
                      boxShadow: canRedeem ? "0 2px 8px rgba(255,107,0,0.3)" : "none" }}>
                      {canRedeem ? "Đổi ngay" : "Chưa đủ"}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Transaction section */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ color:"#b0956a", fontSize:10, fontWeight:600 }}>Lịch sử điểm</div>
          </div>

          {/* Filter chips */}
          <div style={{ display:"flex", gap:5, overflowX:"auto",
            scrollbarWidth:"none", marginBottom:10, paddingBottom:2 } as React.CSSProperties}>
            {[
              { v:"all",      l:"Tất cả" },
              { v:"order",    l:"Đơn hàng" },
              { v:"bonus",    l:"Admin cộng" },
              { v:"minigame", l:"Mini game" },
              { v:"redeem",   l:"Đổi điểm" },
            ].map(f => (
              <div key={f.v} onClick={() => setFilterType(f.v as PtsTxType|"all")}
                style={{ padding:"4px 11px", borderRadius:20, cursor:"pointer", flexShrink:0,
                  background: filterType===f.v ? "rgba(245,197,66,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${filterType===f.v ? "rgba(245,197,66,0.35)" : "rgba(255,255,255,0.07)"}`,
                  color: filterType===f.v ? "#F5C542" : "#6a5a40",
                  fontSize:9, fontWeight: filterType===f.v ? 600 : 400, transition:"all .15s" }}>
                {f.l}
              </div>
            ))}
          </div>

          {/* Transaction list */}
          <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:14, overflow:"hidden" }}>
            <AnimatePresence>
              {filtered.map((tx, i) => {
                const cfg = PTS_TX_CFG[tx.type]
                return (
                  <motion.div key={tx.id} initial={{ opacity:0 }} animate={{ opacity:1 }}
                    transition={{ delay:i*0.03 }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 13px",
                      borderBottom: i < filtered.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <div style={{ width:34, height:34, borderRadius:10, background:cfg.bg,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                      {cfg.icon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:"#f8f0e0", fontSize:10.5, fontWeight:500,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {tx.label}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                        <span style={{ color:"#6a5a40", fontSize:8 }}>{tx.time}</span>
                        <span style={{ fontSize:7.5, fontWeight:600, padding:"1px 5px", borderRadius:4,
                          background:cfg.bg, color:cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ color:"#6a5a40", fontSize:7.5, marginTop:1 }}>
                        {tx.label}
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ color: tx.points > 0 ? "#F5C542" : "#b464ff", fontSize:11, fontWeight:700 }}>
                        {tx.points > 0 ? "+" : ""}{tx.points.toLocaleString("vi-VN")}
                      </div>
                      <div style={{ color:"rgba(245,197,66,0.45)", fontSize:8 }}>điểm</div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Nav */}
        <div style={{ position:"absolute", bottom:"max(16px,env(safe-area-inset-bottom))", left:14, right:14, height:56,
          background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999,
          display:"flex", alignItems:"center", justifyContent:"space-around",
          padding:"0 6px", zIndex:50, boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            { icon:"🏠", label:"Trang chủ", href:"/",        active:false },
            { icon:"📋", label:"Đơn hàng",  href:"/orders",  active:false },
            { icon:"🛒", label:"Giỏ hàng",  href:"/cart",    active:false },
            { icon:"⚙️", label:"Cài đặt",   href:"/settings",active:false },
          ].map(tab => (
            <a key={tab.href} href={tab.href} style={{ textDecoration:"none",
              display:"flex", flexDirection:"column", alignItems:"center", gap:2,
              padding:"5px 11px", borderRadius:18,
              background: tab.active ? "rgba(255,107,0,0.12)" : "transparent" }}>
              <span style={{ fontSize:19 }}>{tab.icon}</span>
              <span style={{ fontSize:7.5, color:"#6a5a40" }}>{tab.label}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}

function GInput({ label, value, onChange, placeholder, icon, type="text" }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; icon?: string; type?: string
}) {
  const [f, setF] = useState(false)
  return (
    <div style={{ marginBottom:12 }}>
      {label && <label style={{ color:"rgba(245,197,66,0.55)", fontSize:9.5, display:"block", marginBottom:4 }}>{label}</label>}
      <div style={{ display:"flex", alignItems:"center", gap:8,
        background:"rgba(255,255,255,0.04)",
        border: `1px solid ${f ? "rgba(245,197,66,0.5)" : "rgba(255,255,255,0.08)"}`,
        borderRadius:12, padding:"0 12px", height:44, transition:"all .2s",
        boxShadow: f ? "0 0 0 3px rgba(245,197,66,0.08)" : "none" }}>
        {icon && <span style={{ fontSize:15 }}>{icon}</span>}
        <input type={type} value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setF(true)} onBlur={() => setF(false)}
          style={{ flex:1, background:"transparent", border:"none", outline:"none",
            color:"#f8f0e0", fontSize:12, fontFamily:"Lexend" }} />
      </div>
    </div>
  )
}
