"use client"

import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

const BALANCE     = 185000
const USER_EARNED = 1840

const TIERS_DATA = [
  { id:"bronze",   name:"Đồng",     icon:"🥉", min:0,     max:999      },
  { id:"silver",   name:"Bạc",      icon:"🥈", min:1000,  max:4999     },
  { id:"gold",     name:"Vàng",     icon:"🥇", min:5000,  max:19999    },
  { id:"platinum", name:"Bạch Kim", icon:"💎", min:20000, max:Infinity },
]
const CUR_IDX  = Math.max(0, TIERS_DATA.findIndex(t => USER_EARNED >= t.min && USER_EARNED <= t.max))
const CUR_TIER = TIERS_DATA[CUR_IDX]
const NXT_TIER = TIERS_DATA[CUR_IDX + 1] ?? null
const TIER_PCT = NXT_TIER ? Math.round((USER_EARNED - CUR_TIER.min) / (NXT_TIER.min - CUR_TIER.min) * 100) : 100

export default function WalletPage() {
  const router = useRouter()

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
        html, body { background: #080806; font-family: 'Lexend', sans-serif; height: 100%; overflow: hidden }
        @keyframes shimmer { 0% { left: -60% } 100% { left: 120% } }
        @keyframes purplePulse { 0%,100% { box-shadow: 0 0 20px rgba(180,100,255,0.25) } 50% { box-shadow: 0 0 36px rgba(180,100,255,0.45) } }
        @keyframes goldPulse   { 0%,100% { box-shadow: 0 0 20px rgba(245,197,66,0.2)  } 50% { box-shadow: 0 0 36px rgba(245,197,66,0.4)  } }
      `}</style>

      <div style={{ position:"fixed", inset:0, background:"#080806",
        display:"flex", flexDirection:"column", fontFamily:"'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)", backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          padding:"44px 16px 12px", flexShrink:0, zIndex:40 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/profile" style={{ width:32, height:32, borderRadius:9, textDecoration:"none",
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>💼 Ví của tôi</div>
              <div style={{ color:"#6a5a40", fontSize:9, marginTop:1 }}>Xu thanh toán · Điểm tích lũy</div>
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"14px 14px 88px",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* ── XU CARD ── */}
          <motion.div whileTap={{ scale:0.98 }} onClick={() => router.push("/wallet/xu")}
            style={{ background:"linear-gradient(135deg,#0d0a1a,#160d2a,#080612)",
              border:"1px solid rgba(180,100,255,0.32)", borderRadius:20,
              padding:"18px 16px", marginBottom:12,
              position:"relative", overflow:"hidden", cursor:"pointer",
              animation:"purplePulse 3s infinite" }}>

            <div style={{ position:"absolute", top:-24, right:-24, width:130, height:130,
              background:"radial-gradient(circle,rgba(180,100,255,0.2) 0%,transparent 65%)" }} />
            <div style={{ position:"absolute", top:0, left:"-100%", width:"50%", height:"100%",
              background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)",
              animation:"shimmer 4s infinite" }} />

            <div style={{ position:"relative", zIndex:1 }}>
              <div style={{ color:"rgba(180,100,255,0.55)", fontSize:9, fontWeight:700,
                textTransform:"uppercase", letterSpacing:0.8, marginBottom:8 }}>
                💳 Xu Giao Nhanh
              </div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:3 }}>
                <span style={{ fontSize:36, fontWeight:800, lineHeight:1,
                  background:"linear-gradient(135deg,#b464ff,#d484ff,#e8a4ff)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
                  {BALANCE.toLocaleString("vi-VN")}
                </span>
                <span style={{ color:"#b464ff", fontSize:17, fontWeight:600 }}>xu</span>
              </div>
              <div style={{ color:"rgba(180,100,255,0.4)", fontSize:9, marginBottom:14 }}>
                = {BALANCE.toLocaleString("vi-VN")}đ · dùng thanh toán đơn hàng
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div onClick={e => { e.stopPropagation(); router.push("/wallet/xu") }}
                  style={{ height:32, padding:"0 14px", borderRadius:8,
                    background:"rgba(180,100,255,0.18)", border:"1px solid rgba(180,100,255,0.35)",
                    color:"#b464ff", fontSize:9, fontWeight:700,
                    display:"flex", alignItems:"center", cursor:"pointer" }}>
                  ➕ Nạp xu
                </div>
                <div onClick={e => { e.stopPropagation(); router.push("/wallet/xu") }}
                  style={{ height:32, padding:"0 14px", borderRadius:8,
                    background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
                    color:"rgba(180,100,255,0.6)", fontSize:9, fontWeight:700,
                    display:"flex", alignItems:"center", cursor:"pointer" }}>
                  🏦 Rút xu
                </div>
                <span style={{ marginLeft:"auto", color:"rgba(180,100,255,0.45)", fontSize:9 }}>
                  Xem lịch sử →
                </span>
              </div>
            </div>
          </motion.div>

          {/* ── ĐIỂM CARD ── */}
          <motion.div whileTap={{ scale:0.98 }} onClick={() => router.push("/wallet/points")}
            style={{ background:"linear-gradient(135deg,#1a1200,#251800,#0d0900)",
              border:"1px solid rgba(245,197,66,0.3)", borderRadius:20,
              padding:"18px 16px", marginBottom:14,
              position:"relative", overflow:"hidden", cursor:"pointer",
              animation:"goldPulse 3s infinite" }}>

            <div style={{ position:"absolute", top:-24, right:-24, width:130, height:130,
              background:"radial-gradient(circle,rgba(245,197,66,0.15) 0%,transparent 65%)" }} />
            <div style={{ position:"absolute", top:0, left:"-100%", width:"50%", height:"100%",
              background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)",
              animation:"shimmer 4.5s infinite" }} />

            <div style={{ position:"relative", zIndex:1 }}>
              <div style={{ color:"rgba(245,197,66,0.6)", fontSize:9, fontWeight:700,
                textTransform:"uppercase", letterSpacing:0.8, marginBottom:8 }}>
                ⭐ Điểm Tích Lũy
              </div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:3 }}>
                <span style={{ fontSize:36, fontWeight:800, lineHeight:1,
                  background:"linear-gradient(135deg,#F5C542,#FFB347,#FF8C00)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
                  {USER_EARNED.toLocaleString("vi-VN")}
                </span>
                <span style={{ color:"#F5C542", fontSize:17, fontWeight:600 }}>điểm</span>
              </div>
              <div style={{ color:"rgba(245,197,66,0.4)", fontSize:9, marginBottom:14 }}>
                dùng xét hạng thành viên · đổi xu & voucher
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:14 }}>
                <span style={{ fontSize:18 }}>{CUR_TIER.icon}</span>
                <span style={{ color:"#F5C542", fontSize:10, fontWeight:700 }}>{CUR_TIER.name} Member</span>
                {NXT_TIER && (
                  <span style={{ color:"rgba(245,197,66,0.4)", fontSize:8.5, marginLeft:2 }}>
                    · còn {(NXT_TIER.min - USER_EARNED).toLocaleString()} điểm → {NXT_TIER.name}
                  </span>
                )}
                <span style={{ marginLeft:"auto", color:"rgba(245,197,66,0.45)", fontSize:9 }}>
                  Đổi điểm →
                </span>
              </div>

              <div style={{ height:5, background:"rgba(255,255,255,0.07)", borderRadius:3, overflow:"hidden" }}>
                <motion.div initial={{ width:0 }} animate={{ width:`${TIER_PCT}%` }}
                  transition={{ duration:1.2, ease:"easeOut" }}
                  style={{ height:"100%", background:"linear-gradient(90deg,#F5C542,#FFB347)", borderRadius:3 }} />
              </div>
            </div>
          </motion.div>

          {/* Hướng dẫn */}
          <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)",
            borderRadius:16, padding:"14px" }}>
            <div style={{ color:"#b0956a", fontSize:9.5, fontWeight:600, marginBottom:12 }}>
              📖 Xu và Điểm khác nhau thế nào?
            </div>
            {[
              { icon:"💳", accent:"rgba(180,100,255,0.12)", border:"rgba(180,100,255,0.2)", color:"#b464ff",
                title:"Xu — dùng để thanh toán",
                desc:"Nạp xu bằng VietQR · 1 xu = 1đ · Dùng thay tiền mặt khi đặt hàng" },
              { icon:"⭐", accent:"rgba(245,197,66,0.1)",  border:"rgba(245,197,66,0.2)",  color:"#F5C542",
                title:"Điểm — tích từ đơn hàng",
                desc:"Mỗi 10.000đ = 1 điểm · Dùng đổi xu hoặc voucher giảm giá" },
              { icon:"🔄", accent:"rgba(62,207,110,0.08)", border:"rgba(62,207,110,0.15)", color:"#3ecf6e",
                title:"100 điểm → 1.000 xu",
                desc:"Đổi điểm thành xu để thanh toán · Hoặc đổi voucher freeship, giảm giá" },
            ].map(item => (
              <div key={item.title} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10, padding:"10px 10px", background:item.accent, border:`1px solid ${item.border}`, borderRadius:11 }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
                <div>
                  <div style={{ color:item.color, fontSize:10, fontWeight:600, marginBottom:2 }}>{item.title}</div>
                  <div style={{ color:"#6a5a40", fontSize:8.5, lineHeight:1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
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
              background:tab.active?"rgba(255,107,0,0.12)":"transparent" }}>
              <span style={{ fontSize:19 }}>{tab.icon}</span>
              <span style={{ fontSize:7.5, color:"#6a5a40" }}>{tab.label}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
