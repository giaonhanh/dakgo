"use client"

import { useState } from "react"

const WEEKLY = [
  { day:"T2", amount:185000, trips:8 },
  { day:"T3", amount:242000, trips:11 },
  { day:"T4", amount:165000, trips:7 },
  { day:"T5", amount:310000, trips:14 },
  { day:"T6", amount:280000, trips:12 },
  { day:"T7", amount:420000, trips:18 },
  { day:"CN", amount:198000, trips:9 },
]

const TRIPS = [
  { id:"T001", from:"Quán Bún Bò Huế Ngon", to:"22 Lê Hồng Phong", time:"15:32", amount:25000, type:"food" },
  { id:"T002", from:"Chợ Phước An", to:"18 Trần Phú", time:"14:10", amount:18000, type:"errand" },
  { id:"T003", from:"Quán Cơm Tấm Sài Gòn", to:"5 Nguyễn Văn Cừ", time:"12:45", amount:32000, type:"food" },
  { id:"T004", from:"10 Hùng Vương → Trường THPT", to:"Phường 2", time:"11:20", amount:22000, type:"ride" },
  { id:"T005", from:"Quán Phở 24 Ngon", to:"44 Phan Đình Phùng", time:"10:05", amount:28000, type:"food" },
]

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"
const maxAmt = Math.max(...WEEKLY.map(d => d.amount))

const TYPE_ICON: Record<string, string> = { food:"🍜", errand:"🛍️", ride:"🛵" }
const TYPE_COLOR: Record<string, string> = { food:"255,140,0", errand:"62,207,110", ride:"74,143,245" }

export default function DriverEarningsPage() {
  const [period, setPeriod] = useState<"today"|"week"|"month">("week")

  const earnings = {
    today: WEEKLY[6].amount,
    week:  WEEKLY.reduce((s,d) => s+d.amount, 0),
    month: WEEKLY.reduce((s,d) => s+d.amount, 0) * 4 + 125000,
  }
  const trips = { today:9, week:79, month:312 }

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
      `}</style>
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"52px 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
            <a href="/driver" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Thu nhập</div>
              <div style={{ color:"#6a5a40",fontSize:9 }}>Thống kê & lịch sử chuyến</div>
            </div>
            <button style={{ background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.25)",borderRadius:10,padding:"6px 14px",color:"#3ecf6e",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Lexend" }}>
              Rút tiền
            </button>
          </div>
          <div style={{ display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:10,padding:2,gap:2 }}>
            {(["today","week","month"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ flex:1,height:32,borderRadius:8,background:period===p?"rgba(255,107,0,0.15)":"transparent",border:period===p?"1px solid rgba(255,107,0,0.3)":"1px solid transparent",cursor:"pointer",color:period===p?"#FF8C00":"#6a5a40",fontSize:10,fontWeight:period===p?700:500,fontFamily:"Lexend",transition:"all .2s" }}>
                {p==="today"?"Hôm nay":p==="week"?"Tuần này":"Tháng này"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px 20px" }}>

          {/* Big number */}
          <div style={{ textAlign:"center",padding:"24px 0",background:"rgba(255,107,0,0.05)",border:"1px solid rgba(255,107,0,0.15)",borderRadius:16,marginBottom:12 }}>
            <div style={{ color:"#6a5a40",fontSize:9,marginBottom:6 }}>
              {period==="today"?"Thu nhập hôm nay":period==="week"?"Thu nhập tuần này":"Thu nhập tháng này"}
            </div>
            <div style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontSize:32,fontWeight:800,marginBottom:12 }}>
              {fmt(earnings[period])}
            </div>
            <div style={{ display:"flex",justifyContent:"center",gap:20 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>{trips[period]}</div>
                <div style={{ color:"#6a5a40",fontSize:8 }}>Chuyến</div>
              </div>
              <div style={{ width:1,background:"rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>⭐ 4.9</div>
                <div style={{ color:"#6a5a40",fontSize:8 }}>Đánh giá TB</div>
              </div>
              <div style={{ width:1,background:"rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>98%</div>
                <div style={{ color:"#6a5a40",fontSize:8 }}>Hoàn thành</div>
              </div>
            </div>
          </div>

          {/* Bar chart */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:12 }}>
            <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:14 }}>📊 Thu nhập theo ngày (tuần này)</div>
            <div style={{ display:"flex",gap:5,alignItems:"flex-end",height:80 }}>
              {WEEKLY.map((d, i) => {
                const h = Math.max(4, Math.round((d.amount / maxAmt) * 72))
                const isToday = i === 6
                return (
                  <div key={d.day} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                    <div style={{ width:"100%",height:h,borderRadius:"4px 4px 0 0",background:isToday?"linear-gradient(180deg,#FF6B00,#FF8C00)":"rgba(255,107,0,0.2)",transition:"height .3s" }} />
                    <div style={{ color:isToday?"#FF8C00":"#6a5a40",fontSize:8,fontWeight:isToday?700:400 }}>{d.day}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color:"#6a5a40",fontSize:8 }}>Thấp: {fmt(Math.min(...WEEKLY.map(d=>d.amount)))}</span>
              <span style={{ color:"#FF8C00",fontSize:8,fontWeight:700 }}>Cao: {fmt(maxAmt)}</span>
            </div>
          </div>

          {/* Trip list */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,overflow:"hidden" }}>
            <div style={{ padding:"14px 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700 }}>🧾 Chuyến gần đây</div>
            </div>
            {TRIPS.map((trip, i) => (
              <div key={trip.id} style={{ padding:"10px 14px",borderBottom:i<TRIPS.length-1?"1px solid rgba(255,255,255,0.04)":"none",display:"flex",gap:10,alignItems:"center" }}>
                <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,background:`rgba(${TYPE_COLOR[trip.type]},0.1)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>
                  {TYPE_ICON[trip.type]}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ color:"#f8f0e0",fontSize:10.5,fontWeight:600,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{trip.from}</div>
                  <div style={{ color:"#6a5a40",fontSize:9 }}>→ {trip.to} · {trip.time}</div>
                </div>
                <div style={{ color:"#3ecf6e",fontSize:12,fontWeight:700,flexShrink:0 }}>+{fmt(trip.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
