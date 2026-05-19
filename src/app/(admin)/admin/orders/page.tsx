"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type OrderStatus = "pending"|"preparing"|"delivering"|"delivered"|"cancelled"

interface Order {
  id: string; customer: string; shop: string; driver: string|null
  status: OrderStatus; total: number; time: string; items: number; address: string
}

const ORDERS: Order[] = [
  { id:"GN2851", customer:"Nguyễn Thị A", shop:"Bún Bò Huế Ngon",  driver:"Trần Văn Bình",  status:"delivering", total:220000, time:"15:32", items:3, address:"22 Lê Hồng Phong" },
  { id:"GN2850", customer:"Lê Văn B",     shop:"Cơm Tấm Sài Gòn",  driver:"Phạm Thị Dung",  status:"preparing",  total:85000,  time:"15:28", items:1, address:"18 Trần Phú" },
  { id:"GN2849", customer:"Phạm Thị C",   shop:"Quán Cà Phê Nhớ",  driver:null,              status:"pending",    total:45000,  time:"15:15", items:2, address:"5 Nguyễn Văn Cừ" },
  { id:"GN2848", customer:"Hoàng Văn D",  shop:"Bánh Mì Thanh Nga", driver:"Lê Văn Cường",   status:"delivered",  total:30000,  time:"14:55", items:1, address:"10 Hùng Vương" },
  { id:"GN2847", customer:"Trần Thị E",   shop:"Bún Bò Huế Ngon",  driver:"Trần Văn Bình",  status:"cancelled",  total:160000, time:"14:30", items:2, address:"44 Phan Đình Phùng" },
  { id:"GN2846", customer:"Vũ Văn F",     shop:"Gà Rán KFC Phước",  driver:"Nguyễn Văn An",  status:"delivered",  total:115000, time:"13:50", items:4, address:"3 Đinh Tiên Hoàng" },
]

const STATUS_CFG: Record<OrderStatus, { label:string; color:string; bg:string }> = {
  pending:    { label:"Chờ xử lý",  color:"#FFB347", bg:"rgba(255,179,71,0.1)" },
  preparing:  { label:"Đang nấu",   color:"#4a8ff5", bg:"rgba(74,143,245,0.1)" },
  delivering: { label:"Đang giao",  color:"#FF8C00", bg:"rgba(255,140,0,0.1)" },
  delivered:  { label:"Đã giao",    color:"#3ecf6e", bg:"rgba(62,207,110,0.1)" },
  cancelled:  { label:"Đã hủy",     color:"#ff4040", bg:"rgba(255,64,64,0.1)" },
}
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<"all"|OrderStatus>("all")
  const [selected, setSelected] = useState<Order|null>(null)
  const [search, setSearch] = useState("")

  const shown = ORDERS
    .filter(o => filter==="all" || o.status===filter)
    .filter(o => !search || o.id.includes(search.toUpperCase()) || o.customer.toLowerCase().includes(search.toLowerCase()) || o.shop.toLowerCase().includes(search.toLowerCase()))

  const todayTotal = ORDERS.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+o.total,0)

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        input{outline:none;font-family:'Lexend',sans-serif}
      `}</style>
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"52px 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
            <a href="/admin" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Quản lý đơn hàng</div>
              <div style={{ color:"#6a5a40",fontSize:9 }}>{ORDERS.length} đơn hôm nay · {fmt(todayTotal)}</div>
            </div>
          </div>

          {/* Search */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"10px 14px",display:"flex",gap:8,alignItems:"center",marginBottom:10 }}>
            <span style={{ color:"#6a5a40",fontSize:14 }}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã đơn, khách hàng, quán..." style={{ flex:1,background:"none",border:"none",color:"#f8f0e0",fontSize:11 }} />
          </div>

          {/* Filter tabs */}
          <div style={{ display:"flex",gap:5,overflowX:"auto" }}>
            {(["all","pending","preparing","delivering","delivered","cancelled"] as const).map(f => (
              <button key={f} onClick={()=>setFilter(f)} style={{ flexShrink:0,padding:"5px 10px",borderRadius:8,background:filter===f?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",border:filter===f?"1px solid rgba(255,107,0,0.35)":"1px solid rgba(255,255,255,0.06)",color:filter===f?"#FF8C00":"#6a5a40",fontSize:9,fontWeight:filter===f?700:400,cursor:"pointer",fontFamily:"Lexend",whiteSpace:"nowrap" }}>
                {f==="all"?"Tất cả":STATUS_CFG[f].label}
              </button>
            ))}
          </div>
        </div>

        {/* Order list */}
        <div style={{ flex:1,overflowY:"auto",padding:"10px 16px 20px" }}>
          {shown.map(order => {
            const cfg = STATUS_CFG[order.status]
            return (
              <div key={order.id} onClick={()=>setSelected(order)} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:12,marginBottom:8,cursor:"pointer" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    <span style={{ color:"#FF8C00",fontSize:12,fontWeight:800 }}>#{order.id}</span>
                    <span style={{ background:cfg.bg,color:cfg.color,borderRadius:6,padding:"2px 7px",fontSize:8,fontWeight:700 }}>{cfg.label}</span>
                  </div>
                  <span style={{ color:"#6a5a40",fontSize:9 }}>{order.time}</span>
                </div>
                <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:600,marginBottom:3 }}>{order.customer}</div>
                <div style={{ color:"#6a5a40",fontSize:9,marginBottom:3 }}>🏪 {order.shop} · {order.items} món</div>
                <div style={{ color:"#6a5a40",fontSize:9,marginBottom:6 }}>📍 {order.address}</div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div style={{ color:"#6a5a40",fontSize:9 }}>
                    {order.driver ? `🛵 ${order.driver}` : "⏳ Chưa có tài xế"}
                  </div>
                  <span style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontSize:13,fontWeight:800 }}>{fmt(order.total)}</span>
                </div>
              </div>
            )
          })}
          {shown.length===0 && (
            <div style={{ textAlign:"center",padding:"40px 0",color:"#6a5a40",fontSize:11 }}>
              Không tìm thấy đơn hàng nào
            </div>
          )}
        </div>

        {/* Detail modal */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={()=>setSelected(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:50,backdropFilter:"blur(4px)" }} />
              <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }} transition={{ type:"spring",damping:22,stiffness:300 }} style={{ position:"fixed",bottom:0,left:0,right:0,background:"#0e0c09",borderRadius:"20px 20px 0 0",border:"1px solid rgba(255,255,255,0.08)",padding:"20px 16px 32px",zIndex:51 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
                  <div>
                    <div style={{ color:"#FF8C00",fontSize:16,fontWeight:800 }}>#{selected.id}</div>
                    <div style={{ color:"#6a5a40",fontSize:9 }}>{selected.time} · {STATUS_CFG[selected.status].label}</div>
                  </div>
                  <button onClick={()=>setSelected(null)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#6a5a40",fontSize:16,cursor:"pointer" }}>×</button>
                </div>
                {[
                  ["Khách hàng", selected.customer],
                  ["Cửa hàng", selected.shop],
                  ["Tài xế", selected.driver||"Chưa phân công"],
                  ["Địa chỉ giao", selected.address],
                  ["Số món", `${selected.items} món`],
                  ["Tổng tiền", fmt(selected.total)],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:"flex",justifyContent:"space-between",gap:12,marginBottom:8,paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color:"#6a5a40",fontSize:9,flexShrink:0 }}>{k}</span>
                    <span style={{ color:"#f8f0e0",fontSize:9,fontWeight:600,textAlign:"right" }}>{v}</span>
                  </div>
                ))}
                {(selected.status==="pending"||selected.status==="preparing") && (
                  <button style={{ width:"100%",height:44,borderRadius:12,background:"rgba(255,64,64,0.08)",border:"1px solid rgba(255,64,64,0.2)",color:"#ff4040",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",marginTop:8 }}>
                    ❌ Hủy đơn
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
