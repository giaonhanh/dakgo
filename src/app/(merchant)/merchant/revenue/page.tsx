"use client"

import { useState } from "react"

const DAILY = [
  { day:"T2", revenue:1250000, orders:28 },
  { day:"T3", revenue:1680000, orders:37 },
  { day:"T4", revenue:980000,  orders:22 },
  { day:"T5", revenue:2100000, orders:46 },
  { day:"T6", revenue:1870000, orders:41 },
  { day:"T7", revenue:2850000, orders:63 },
  { day:"CN", revenue:1540000, orders:34 },
]

const TOP_ITEMS = [
  { name:"Bún bò đặc biệt", qty:89, revenue:4005000, pct:32 },
  { name:"Chả chiên giòn",  qty:156, revenue:2340000, pct:22 },
  { name:"Bún bò thường",   qty:67, revenue:2345000, pct:19 },
  { name:"Trà đá",          qty:201, revenue:1005000, pct:14 },
  { name:"Sinh tố bơ",      qty:42, revenue:1050000, pct:10 },
]

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"
const maxRev = Math.max(...DAILY.map(d => d.revenue))

export default function MerchantRevenuePage() {
  const [period, setPeriod] = useState<"week"|"month">("week")

  const weekTotal  = DAILY.reduce((s,d) => s+d.revenue, 0)
  const weekOrders = DAILY.reduce((s,d) => s+d.orders, 0)
  const commission = Math.round(weekTotal * 0.15)
  const netRevenue = weekTotal - commission

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
      `}</style>
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"52px 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
            <a href="/merchant" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Doanh thu</div>
              <div style={{ color:"#6a5a40",fontSize:9 }}>Bún Bò Huế Ngon</div>
            </div>
          </div>
          <div style={{ display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:10,padding:2,gap:2 }}>
            {(["week","month"] as const).map(p => (
              <button key={p} onClick={()=>setPeriod(p)} style={{ flex:1,height:32,borderRadius:8,background:period===p?"rgba(255,107,0,0.15)":"transparent",border:period===p?"1px solid rgba(255,107,0,0.3)":"1px solid transparent",cursor:"pointer",color:period===p?"#FF8C00":"#6a5a40",fontSize:10,fontWeight:period===p?700:500,fontFamily:"Lexend",transition:"all .2s" }}>
                {p==="week"?"Tuần này":"Tháng này"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px 20px" }}>

          {/* Revenue summary */}
          <div style={{ background:"rgba(255,107,0,0.05)",border:"1px solid rgba(255,107,0,0.15)",borderRadius:16,padding:"20px",marginBottom:12,textAlign:"center" }}>
            <div style={{ color:"#6a5a40",fontSize:9,marginBottom:6 }}>Doanh thu {period==="week"?"tuần này":"tháng này"}</div>
            <div style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontSize:28,fontWeight:800,marginBottom:10 }}>
              {fmt(period==="week"?weekTotal:weekTotal*4)}
            </div>
            <div style={{ display:"flex",justifyContent:"center",gap:16 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0",fontSize:13,fontWeight:700 }}>{period==="week"?weekOrders:weekOrders*4}</div>
                <div style={{ color:"#6a5a40",fontSize:8 }}>Đơn hàng</div>
              </div>
              <div style={{ width:1,background:"rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#ff4040",fontSize:13,fontWeight:700 }}>−{fmt(period==="week"?commission:commission*4)}</div>
                <div style={{ color:"#6a5a40",fontSize:8 }}>Hoa hồng 15%</div>
              </div>
              <div style={{ width:1,background:"rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#3ecf6e",fontSize:13,fontWeight:700 }}>{fmt(period==="week"?netRevenue:netRevenue*4)}</div>
                <div style={{ color:"#6a5a40",fontSize:8 }}>Thực nhận</div>
              </div>
            </div>
          </div>

          {/* Bar chart */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:12 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:14 }}>📊 Doanh thu theo ngày</div>
            <div style={{ display:"flex",gap:5,alignItems:"flex-end",height:90 }}>
              {DAILY.map((d, i) => {
                const h = Math.max(4, Math.round((d.revenue / maxRev) * 82))
                const isToday = i === 6
                return (
                  <div key={d.day} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                    <div style={{ color:"#6a5a40",fontSize:7 }}>{d.orders}</div>
                    <div style={{ width:"100%",height:h,borderRadius:"4px 4px 0 0",background:isToday?"linear-gradient(180deg,#FF6B00,#FF8C00)":"rgba(255,107,0,0.2)" }} />
                    <div style={{ color:isToday?"#FF8C00":"#6a5a40",fontSize:8,fontWeight:isToday?700:400 }}>{d.day}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color:"#6a5a40",fontSize:8 }}>Thấp: {fmt(Math.min(...DAILY.map(d=>d.revenue)))}</span>
              <span style={{ color:"#FF8C00",fontSize:8,fontWeight:700 }}>Cao: {fmt(maxRev)}</span>
            </div>
          </div>

          {/* Top items */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,overflow:"hidden",marginBottom:12 }}>
            <div style={{ padding:"14px 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700 }}>🏆 Món bán chạy nhất</div>
            </div>
            {TOP_ITEMS.map((item, i) => (
              <div key={item.name} style={{ padding:"10px 14px",borderBottom:i<TOP_ITEMS.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    <span style={{ color:["#f5c542","#b0956a","#FF8C00"][i]||"#6a5a40",fontSize:12 }}>
                      {["🥇","🥈","🥉"][i]||`${i+1}.`}
                    </span>
                    <span style={{ color:"#f8f0e0",fontSize:10.5,fontWeight:600 }}>{item.name}</span>
                  </div>
                  <span style={{ color:"#3ecf6e",fontSize:10,fontWeight:700 }}>{fmt(item.revenue)}</span>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ flex:1,height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden" }}>
                    <div style={{ width:`${item.pct}%`,height:"100%",borderRadius:2,background:"linear-gradient(90deg,#FF6B00,#FFB347)" }} />
                  </div>
                  <span style={{ color:"#6a5a40",fontSize:8,flexShrink:0 }}>{item.qty} suất · {item.pct}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Payout info */}
          <div style={{ background:"rgba(62,207,110,0.05)",border:"1px solid rgba(62,207,110,0.15)",borderRadius:14,padding:14 }}>
            <div style={{ color:"#3ecf6e",fontSize:11,fontWeight:700,marginBottom:6 }}>💳 Thanh toán tháng này</div>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
              <span style={{ color:"#6a5a40",fontSize:10 }}>Dự kiến nhận</span>
              <span style={{ color:"#3ecf6e",fontSize:12,fontWeight:800 }}>{fmt(netRevenue*4)}</span>
            </div>
            <div style={{ color:"#6a5a40",fontSize:8.5,lineHeight:1.6 }}>Thanh toán vào ngày 5 hàng tháng qua tài khoản đã đăng ký.</div>
          </div>
        </div>
      </div>
    </>
  )
}
