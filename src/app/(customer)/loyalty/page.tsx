"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type TierLevel = "bronze" | "silver" | "gold" | "platinum"
interface PointTx {
  id: string
  points: number
  reason: string
  orderId: string | null
  time: string
}
interface Reward {
  id: string
  title: string
  points: number
  icon: string
  category: "voucher" | "gift" | "cash"
  available: boolean
}


const TIER_CFG: Record<TierLevel, {
  label: string; icon: string; color: string; bg: string; border: string
  min: number; max: number; nextTier: string | null; nextMin: number | null
}> = {
  bronze:   { label:"Bronze",   icon:"??", color:"#cd7f32", bg:"linear-gradient(135deg,#1a0f05,#2a1a09)", border:"rgba(205,127,50,0.35)", min:0,    max:999,  nextTier:"Silver",   nextMin:1000 },
  silver:   { label:"Silver",   icon:"??", color:"#b464ff", bg:"linear-gradient(135deg,#0d0a1a,#160d2a)", border:"rgba(180,100,255,0.35)", min:1000, max:4999, nextTier:"Gold",     nextMin:5000 },
  gold:     { label:"Gold",     icon:"??", color:"#f5c542", bg:"linear-gradient(135deg,#1a1200,#2d1f00)", border:"rgba(245,197,66,0.35)", min:5000, max:14999,nextTier:"Platinum", nextMin:15000},
  platinum: { label:"Platinum", icon:"??", color:"#4a8ff5", bg:"linear-gradient(135deg,#050d1a,#0a1530)", border:"rgba(74,143,245,0.35)", min:15000,max:99999,nextTier:null,       nextMin:null },
}

const HISTORY: PointTx[] = [
  { id:"p8", points:+120, reason:"�on h�ng #GN2851 th�nh c�ng", orderId:"GN2851", time:"H�m nay � 22:05"     },
  { id:"p7", points:-500, reason:"�?i voucher Free Ship",       orderId:null,     time:"H�m nay � 18:00"     },
  { id:"p6", points:+85,  reason:"�on h�ng #GN2849 th�nh c�ng", orderId:"GN2849", time:"H�m qua � 21:50"     },
  { id:"p5", points:+200, reason:"Bonus th�ng 5 t? GiaoNhanh",  orderId:null,     time:"15/05 � 09:00"       },
  { id:"p4", points:+63,  reason:"�on h�ng #GN2840 th�nh c�ng", orderId:"GN2840", time:"3 ng�y tru?c � 12:05"},
  { id:"p3", points:-300, reason:"�?i qu�: Ly cafe mi?n ph�",   orderId:null,     time:"5 ng�y tru?c � 14:30"},
  { id:"p2", points:+108, reason:"�on h�ng #GN2820 th�nh c�ng", orderId:"GN2820", time:"1 tu?n tru?c"        },
  { id:"p1", points:+500, reason:"Bonus ch�o m?ng th�nh vi�n",  orderId:null,     time:"2 tu?n tru?c"        },
]

const REWARDS: Reward[] = [
  { id:"r1", title:"Voucher gi?m 20%",            points:500,  icon:"???", category:"voucher", available:true  },
  { id:"r2", title:"Mi?n ph� giao h�ng 1 don",    points:300,  icon:"??", category:"voucher", available:true  },
  { id:"r3", title:"Ly cafe t?i Highlands",        points:800,  icon:"?", category:"gift",    available:true  },
  { id:"r4", title:"Voucher gi?m 50.000d",         points:1000, icon:"??", category:"voucher", available:true  },
  { id:"r5", title:"Ho�n ti?n 20.000d v�o v�",     points:2000, icon:"??", category:"cash",    available:true  },
  { id:"r6", title:"�o thun GiaoNhanh",            points:5000, icon:"??", category:"gift",    available:false },
]

const REWARD_CFG: Record<Reward["category"], { color: string; bg: string }> = {
  voucher: { color:"#FF8C00", bg:"rgba(255,140,0,0.1)" },
  gift:    { color:"#b464ff", bg:"rgba(180,100,255,0.1)" },
  cash:    { color:"#3ecf6e", bg:"rgba(62,207,110,0.1)" },
}

export default function LoyaltyPage() {
  const [points, setPoints] = useState(2480)
  const [tab, setTab] = useState<"rewards" | "history">("rewards")
  const [redeemId, setRedeemId] = useState<string | null>(null)
  const [toast, setToast] = useState("")

  const tier: TierLevel = points >= 5000 ? "platinum" : points >= 2000 ? "gold" : points >= 1000 ? "silver" : "bronze"

  const fireToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 2500)
  }

  const tierCfg = TIER_CFG[tier]
  const progressPct = tierCfg.nextMin
    ? Math.min(100, ((points - tierCfg.min) / (tierCfg.nextMin - tierCfg.min)) * 100)
    : 100
  const pointsToNext = tierCfg.nextMin ? tierCfg.nextMin - points : 0

  const redeemReward = REWARDS.find(r => r.id === redeemId)

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%;overflow:hidden}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(180,100,255,0.25);border-radius:2px}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
        @keyframes tierGlow{0%,100%{box-shadow:0 0 20px rgba(180,100,255,0.3)}50%{box-shadow:0 0 40px rgba(180,100,255,0.5)}}
        @keyframes progressFill{from{width:0}to{width:var(--pct)}}
      `}</style>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-14 }}
            style={{ position:"fixed", top:52, left:"50%", transform:"translateX(-50%)",
              zIndex:999, whiteSpace:"nowrap",
              background:"rgba(62,207,110,0.15)", border:"1px solid rgba(62,207,110,0.35)",
              borderRadius:12, padding:"7px 18px",
              color:"#3ecf6e", fontSize:11, fontWeight:600, backdropFilter:"blur(10px)" }}>
            ? {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Redeem Confirm Modal */}
      <AnimatePresence>
        {redeemId && redeemReward && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setRedeemId(null)}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
                zIndex:90, backdropFilter:"blur(4px)" }} />
            <motion.div initial={{ opacity:0, scale:0.88, y:30 }}
              animate={{ opacity:1, scale:1, y:0 }}
              exit={{ opacity:0, scale:0.88, y:30 }}
              transition={{ type:"spring", damping:24, stiffness:300 }}
              style={{ position:"fixed", top:"50%", left:"50%",
                transform:"translate(-50%,-50%)", width:"calc(100% - 40px)",
                maxWidth:340, zIndex:91,
                background:"#0e0c09", border:"1px solid rgba(180,100,255,0.3)",
                borderRadius:20, padding:24 }}>
              <div style={{ textAlign:"center", marginBottom:20 }}>
                <div style={{ fontSize:52, marginBottom:10 }}>{redeemReward.icon}</div>
                <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700, marginBottom:6 }}>
                  {redeemReward.title}
                </div>
                <div style={{ color:"#6a5a40", fontSize:10 }}>
                  B?n s? d�ng <strong style={{ color:"#b464ff" }}>{redeemReward.points.toLocaleString()} di?m</strong> d? d?i qu� n�y.
                </div>
              </div>
              <div style={{ background:"rgba(180,100,255,0.07)",
                border:"1px solid rgba(180,100,255,0.2)",
                borderRadius:12, padding:"10px 14px", marginBottom:16,
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ color:"#6a5a40", fontSize:9 }}>�i?m hi?n t?i</span>
                <span style={{ color:"#b464ff", fontSize:14, fontWeight:700 }}>
                  {points.toLocaleString()} di?m
                </span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                background:"rgba(255,255,255,0.03)",
                border:"1px solid rgba(255,255,255,0.07)",
                borderRadius:12, padding:"10px 14px", marginBottom:20 }}>
                <span style={{ color:"#6a5a40", fontSize:9 }}>�i?m sau khi d?i</span>
                <span style={{ color:"#f8f0e0", fontSize:14, fontWeight:700 }}>
                  {(points - redeemReward.points).toLocaleString()} di?m
                </span>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setRedeemId(null)}
                  style={{ flex:1, height:44, borderRadius:12,
                    background:"rgba(255,255,255,0.05)",
                    border:"1px solid rgba(255,255,255,0.1)",
                    color:"#b0956a", fontSize:11, fontWeight:600,
                    fontFamily:"Lexend", cursor:"pointer" }}>
                  Hu?
                </button>
                <button onClick={() => {
                  setPoints(p => p - redeemReward.points)
                  setRedeemId(null)
                  fireToast(`�?i ${redeemReward.title} th�nh c�ng!`)
                }} style={{ flex:2, height:44, borderRadius:12, border:"none",
                  background:"linear-gradient(90deg,#b464ff,#d484ff)",
                  color:"#fff", fontSize:11, fontWeight:700,
                  fontFamily:"Lexend", cursor:"pointer",
                  boxShadow:"0 3px 14px rgba(180,100,255,0.35)" }}>
                  ?? X�c nh?n d?i di?m
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div style={{ position:"fixed", inset:0, background:"#080806",
        display:"flex", flexDirection:"column", fontFamily:"'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)", backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          padding:"calc(env(safe-area-inset-top) + 12px) 16px 12px", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/profile" style={{ width:32, height:32, borderRadius:9, textDecoration:"none",
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>?</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>�i?m Thu?ng</div>
              <div style={{ color:"#6a5a40", fontSize:9 }}>T�ch di?m � L�n h?ng � �?i qu�</div>
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px 88px",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* Tier Card */}
          <div style={{ background:tierCfg.bg, border:`1px solid ${tierCfg.border}`,
            borderRadius:20, padding:"20px 18px", marginBottom:12,
            position:"relative", overflow:"hidden",
            animation:"tierGlow 3s infinite" }}>
            <div style={{ position:"absolute", top:-30, right:-30,
              width:140, height:140,
              background:`radial-gradient(circle,${tierCfg.color}33 0%,transparent 65%)` }} />
            <div style={{ position:"absolute", top:0, left:"-100%", width:"50%", height:"100%",
              background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)",
              animation:"shimmer 5s infinite" }} />

            <div style={{ position:"relative", zIndex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <div style={{ width:52, height:52, borderRadius:14,
                  background:`${tierCfg.color}20`, border:`2px solid ${tierCfg.color}50`,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>
                  {tierCfg.icon}
                </div>
                <div>
                  <div style={{ color:"#6a5a40", fontSize:9, marginBottom:2 }}>H?ng th�nh vi�n</div>
                  <div style={{ color:tierCfg.color, fontSize:20, fontWeight:800, lineHeight:1 }}>
                    {tierCfg.label}
                  </div>
                </div>
                <div style={{ marginLeft:"auto",
                  background:`${tierCfg.color}15`, border:`1px solid ${tierCfg.color}40`,
                  borderRadius:8, padding:"4px 10px",
                  color:tierCfg.color, fontSize:10, fontWeight:700 }}>
                  #{["bronze","silver","gold","platinum"].indexOf(tier) + 1}/4
                </div>
              </div>

              <div style={{ fontSize:38, fontWeight:800, lineHeight:1, marginBottom:4,
                background:`linear-gradient(135deg,${tierCfg.color},#fff)`,
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                backgroundClip:"text" }}>
                {points.toLocaleString()}
                <span style={{ fontSize:14, fontWeight:400, WebkitTextFillColor:"unset",
                  background:"none", color:"#6a5a40", marginLeft:6 }}>di?m</span>
              </div>

              {tierCfg.nextTier && (
                <>
                  <div style={{ height:6, borderRadius:3,
                    background:"rgba(255,255,255,0.1)", marginBottom:6, overflow:"hidden" }}>
                    <motion.div
                      initial={{ width:0 }}
                      animate={{ width:`${progressPct}%` }}
                      transition={{ duration:1.2, ease:"easeOut", delay:0.3 }}
                      style={{ height:"100%", borderRadius:3,
                        background:`linear-gradient(90deg,${tierCfg.color},${tierCfg.color}cc)` }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"#6a5a40", fontSize:8 }}>
                      {tierCfg.label} � {tierCfg.min.toLocaleString()} di?m
                    </span>
                    <span style={{ color:tierCfg.color, fontSize:8, fontWeight:600 }}>
                      C�n {pointsToNext.toLocaleString()} di?m ? {tierCfg.nextTier} {TIER_CFG[tierCfg.nextTier?.toLowerCase() as TierLevel]?.icon ?? ""}
                    </span>
                  </div>
                </>
              )}
              {!tierCfg.nextTier && (
                <div style={{ color:tierCfg.color, fontSize:9, fontWeight:600 }}>
                  ?? B?n dang ? h?ng cao nh?t!
                </div>
              )}
            </div>
          </div>

          {/* Tier benefits */}
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <div style={{ color:"#b0956a", fontSize:9, fontWeight:600, marginBottom:10 }}>
              Quy?n l?i h?ng {tierCfg.label} {tierCfg.icon}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
              {[
                { icon:"??", text:"T�ch 1 di?m / 10.000d" },
                { icon:"??", text:"Qu� sinh nh?t d?c bi?t" },
                { icon:"??", text:"Uu ti�n gh�p don" },
                { icon:"?", text:"H? tr? uu ti�n 24/7" },
              ].map(b => (
                <div key={b.text} style={{ display:"flex", alignItems:"center", gap:7,
                  background:"rgba(255,255,255,0.03)", borderRadius:9,
                  padding:"7px 9px", border:"1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize:15 }}>{b.icon}</span>
                  <span style={{ color:"#b0956a", fontSize:8.5, lineHeight:1.3 }}>{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:6, marginBottom:12 }}>
            {([["rewards","?? �?i qu�"],["history","?? L?ch s?"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ flex:1, height:36, borderRadius:10,
                  background:tab===k?"rgba(180,100,255,0.15)":"rgba(255,255,255,0.04)",
                  border:`1px solid ${tab===k?"rgba(180,100,255,0.4)":"rgba(255,255,255,0.07)"}`,
                  color:tab===k?"#b464ff":"#6a5a40",
                  fontSize:10, fontWeight:tab===k?700:400, cursor:"pointer", fontFamily:"Lexend",
                  transition:"all .15s" }}>
                {l}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "rewards" && (
              <motion.div key="rewards"
                initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {REWARDS.map(r => {
                    const cfg = REWARD_CFG[r.category]
                    const canRedeem = r.available && points >= r.points
                    return (
                      <div key={r.id} style={{ background:"rgba(255,255,255,0.03)",
                        border:`1px solid ${canRedeem?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.05)"}`,
                        borderRadius:14, padding:"12px 13px",
                        display:"flex", alignItems:"center", gap:12,
                        opacity:r.available?1:0.5 }}>
                        <div style={{ width:44, height:44, borderRadius:12,
                          background:cfg.bg,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:22, flexShrink:0 }}>
                          {r.icon}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ color:"#f8f0e0", fontSize:11.5, fontWeight:600,
                            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {r.title}
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                            <span style={{ fontSize:7.5, padding:"1px 6px", borderRadius:4,
                              background:cfg.bg, color:cfg.color, fontWeight:600 }}>
                              {r.category === "voucher" ? "Voucher" : r.category === "gift" ? "Qu� t?ng" : "Ho�n ti?n"}
                            </span>
                          </div>
                          <div style={{ color:"#b464ff", fontSize:11, fontWeight:700, marginTop:3 }}>
                            ?? {r.points.toLocaleString()} di?m
                          </div>
                        </div>
                        <button
                          disabled={!canRedeem}
                          onClick={() => setRedeemId(r.id)}
                          style={{ height:36, padding:"0 14px", borderRadius:10, border:"none",
                            background:canRedeem
                              ?"linear-gradient(90deg,#b464ff,#d484ff)"
                              :"rgba(255,255,255,0.06)",
                            color:canRedeem?"#fff":"#6a5a40",
                            fontSize:9.5, fontWeight:700, fontFamily:"Lexend",
                            cursor:canRedeem?"pointer":"not-allowed",
                            boxShadow:canRedeem?"0 2px 10px rgba(180,100,255,0.3)":"none",
                            flexShrink:0 }}>
                          {!r.available ? "H?t" : canRedeem ? "�?i" : "Thi?u di?m"}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {tab === "history" && (
              <motion.div key="history"
                initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}>
                <div style={{ background:"rgba(255,255,255,0.03)",
                  border:"1px solid rgba(255,255,255,0.07)",
                  borderRadius:14, overflow:"hidden" }}>
                  {HISTORY.map((tx, i) => (
                    <div key={tx.id}
                      style={{ display:"flex", alignItems:"center", gap:10,
                        padding:"10px 13px",
                        borderBottom:i<HISTORY.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}>
                      <div style={{ width:34, height:34, borderRadius:10, flexShrink:0,
                        background:tx.points>0?"rgba(180,100,255,0.1)":"rgba(255,64,64,0.1)",
                        display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
                        {tx.points > 0 ? "??" : "??"}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:"#f8f0e0", fontSize:10.5, fontWeight:500,
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {tx.reason}
                        </div>
                        <div style={{ color:"#6a5a40", fontSize:8, marginTop:2 }}>{tx.time}</div>
                      </div>
                      <div style={{ color:tx.points>0?"#b464ff":"#ff6060",
                        fontSize:13, fontWeight:700, flexShrink:0 }}>
                        {tx.points > 0 ? "+" : ""}{tx.points.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Nav */}
        <div style={{ position:"absolute", bottom:"max(16px,env(safe-area-inset-bottom))",left:14, right:14, height:56,
          background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999,
          display:"flex", alignItems:"center", justifyContent:"space-around",
          padding:"0 6px", zIndex:50, boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            { icon:"??", label:"Trang ch?", href:"/",        active:false },
            { icon:"??", label:"�on h�ng",  href:"/orders",  active:false },
            { icon:"??", label:"Gi? h�ng",  href:"/cart",    active:false },
            { icon:"??", label:"C�i d?t",   href:"/profile",active:false },
          ].map(tab => (
            <a key={tab.href} href={tab.href}
              style={{ textDecoration:"none", display:"flex", flexDirection:"column",
                alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18,
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
