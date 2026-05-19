"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Driver {
  id: string; name: string; phone: string; vehicle: string; plate: string
  joinedDate: string; status: "pending"|"approved"|"rejected"
  rating: number|null; trips: number; idOk: boolean; licenseOk: boolean
}

const INIT_DRIVERS: Driver[] = [
  { id:"D001", name:"Nguyễn Văn An",  phone:"0901234567", vehicle:"Honda Wave",     plate:"47B1-11111", joinedDate:"12/05/2025", status:"pending",  rating:null, trips:0,  idOk:true,  licenseOk:false },
  { id:"D002", name:"Trần Thị Bình",  phone:"0912345678", vehicle:"Yamaha Exciter", plate:"47B1-22222", joinedDate:"10/05/2025", status:"pending",  rating:null, trips:0,  idOk:true,  licenseOk:true },
  { id:"D003", name:"Lê Văn Cường",   phone:"0923456789", vehicle:"Honda Air Blade",plate:"47B1-33333", joinedDate:"05/05/2025", status:"approved", rating:4.8, trips:45, idOk:true,  licenseOk:true },
  { id:"D004", name:"Phạm Thị Dung",  phone:"0934567890", vehicle:"Suzuki Raider",  plate:"47B1-44444", joinedDate:"01/05/2025", status:"approved", rating:4.9, trips:78, idOk:true,  licenseOk:true },
  { id:"D005", name:"Hoàng Văn Em",   phone:"0945678901", vehicle:"Honda Winner",   plate:"47B1-55555", joinedDate:"28/04/2025", status:"rejected", rating:null, trips:0,  idOk:false, licenseOk:false },
]

const STATUS_LABEL: Record<Driver["status"], string> = {
  pending:  "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
}
const STATUS_COLOR: Record<Driver["status"], string> = {
  pending:  "255,179,71",
  approved: "62,207,110",
  rejected: "255,64,64",
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>(INIT_DRIVERS)
  const [filter, setFilter] = useState<"all"|Driver["status"]>("all")
  const [selected, setSelected] = useState<Driver|null>(null)

  const approve = (id: string) => setDrivers(p => p.map(d => d.id===id?{...d,status:"approved"}:d))
  const reject  = (id: string) => setDrivers(p => p.map(d => d.id===id?{...d,status:"rejected"}:d))

  const shown = filter==="all" ? drivers : drivers.filter(d => d.status===filter)
  const counts = {
    pending:  drivers.filter(d=>d.status==="pending").length,
    approved: drivers.filter(d=>d.status==="approved").length,
    rejected: drivers.filter(d=>d.status==="rejected").length,
  }

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
            <a href="/admin" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Quản lý tài xế</div>
              <div style={{ color:"#6a5a40",fontSize:9 }}>{drivers.length} tài xế · {counts.pending} chờ duyệt</div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:"flex",gap:8,marginBottom:14 }}>
            {[
              { key:"pending",  label:"Chờ duyệt", bg:"rgba(255,179,71,0.1)",  border:"rgba(255,179,71,0.25)",  color:"#FFB347" },
              { key:"approved", label:"Đã duyệt",  bg:"rgba(62,207,110,0.1)", border:"rgba(62,207,110,0.25)", color:"#3ecf6e" },
              { key:"rejected", label:"Từ chối",   bg:"rgba(255,64,64,0.1)",  border:"rgba(255,64,64,0.25)",  color:"#ff4040" },
            ].map(({ key, label, bg, border, color }) => (
              <div key={key} style={{ flex:1,background:bg,border:`1px solid ${border}`,borderRadius:10,padding:"8px",textAlign:"center" }}>
                <div style={{ color,fontSize:18,fontWeight:800 }}>{counts[key as Driver["status"]]}</div>
                <div style={{ color:"#6a5a40",fontSize:7,marginTop:1 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div style={{ display:"flex",gap:5 }}>
            {(["all","pending","approved","rejected"] as const).map(f => (
              <button key={f} onClick={()=>setFilter(f)} style={{ flex:1,height:30,borderRadius:8,background:filter===f?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",border:filter===f?"1px solid rgba(255,107,0,0.35)":"1px solid rgba(255,255,255,0.06)",color:filter===f?"#FF8C00":"#6a5a40",fontSize:9,fontWeight:filter===f?700:400,cursor:"pointer",fontFamily:"Lexend" }}>
                {f==="all"?"Tất cả":STATUS_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Driver list */}
        <div style={{ flex:1,overflowY:"auto",padding:"10px 16px 20px" }}>
          {shown.map(driver => (
            <div key={driver.id} onClick={()=>setSelected(driver)} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:12,marginBottom:8,cursor:"pointer" }}>
              <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                <div style={{ width:44,height:44,borderRadius:12,flexShrink:0,background:"rgba(255,107,0,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>🧑‍💼</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3 }}>
                    <span style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>{driver.name}</span>
                    <span style={{ background:`rgba(${STATUS_COLOR[driver.status]},0.1)`,border:`1px solid rgba(${STATUS_COLOR[driver.status]},0.3)`,borderRadius:6,padding:"2px 8px",color:`rgba(${STATUS_COLOR[driver.status]},1)`,fontSize:8,fontWeight:700 }}>
                      {STATUS_LABEL[driver.status]}
                    </span>
                  </div>
                  <div style={{ color:"#6a5a40",fontSize:9 }}>{driver.vehicle} · {driver.plate}</div>
                  <div style={{ display:"flex",gap:8,marginTop:4 }}>
                    <span style={{ color:driver.idOk?"#3ecf6e":"#ff4040",fontSize:8 }}>{driver.idOk?"✅ CMND":"❌ CMND"}</span>
                    <span style={{ color:driver.licenseOk?"#3ecf6e":"#ff4040",fontSize:8 }}>{driver.licenseOk?"✅ Bằng lái":"❌ Bằng lái"}</span>
                    {driver.rating && <span style={{ color:"#FF8C00",fontSize:8 }}>⭐ {driver.rating} · {driver.trips} chuyến</span>}
                  </div>
                </div>
              </div>
              {driver.status === "pending" && (
                <div style={{ display:"flex",gap:8,marginTop:10 }}>
                  <button onClick={e=>{e.stopPropagation();approve(driver.id)}} style={{ flex:1,height:36,borderRadius:10,background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.3)",color:"#3ecf6e",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Lexend" }}>✅ Phê duyệt</button>
                  <button onClick={e=>{e.stopPropagation();reject(driver.id)}} style={{ flex:1,height:36,borderRadius:10,background:"rgba(255,64,64,0.08)",border:"1px solid rgba(255,64,64,0.2)",color:"#ff4040",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Lexend" }}>❌ Từ chối</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Detail modal */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={()=>setSelected(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:50,backdropFilter:"blur(4px)" }} />
              <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }} transition={{ type:"spring",damping:22,stiffness:300 }} style={{ position:"fixed",bottom:0,left:0,right:0,background:"#0e0c09",borderRadius:"20px 20px 0 0",border:"1px solid rgba(255,255,255,0.08)",padding:"20px 16px 32px",zIndex:51 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
                  <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:800 }}>{selected.name}</div>
                  <button onClick={()=>setSelected(null)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#6a5a40",fontSize:16,cursor:"pointer" }}>×</button>
                </div>
                {[
                  ["ID tài xế", selected.id],
                  ["Số ĐT", selected.phone],
                  ["Phương tiện", selected.vehicle],
                  ["Biển số", selected.plate],
                  ["Ngày đăng ký", selected.joinedDate],
                  ["Trạng thái", STATUS_LABEL[selected.status]],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:"flex",justifyContent:"space-between",marginBottom:8,paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color:"#6a5a40",fontSize:9 }}>{k}</span>
                    <span style={{ color:"#f8f0e0",fontSize:9,fontWeight:600 }}>{v}</span>
                  </div>
                ))}
                {selected.status==="pending" && (
                  <div style={{ display:"flex",gap:8,marginTop:12 }}>
                    <button onClick={()=>{approve(selected.id);setSelected(null)}} style={{ flex:1,height:44,borderRadius:12,background:"rgba(62,207,110,0.12)",border:"1px solid rgba(62,207,110,0.35)",color:"#3ecf6e",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Lexend" }}>✅ Phê duyệt tài xế</button>
                    <button onClick={()=>{reject(selected.id);setSelected(null)}} style={{ flex:1,height:44,borderRadius:12,background:"rgba(255,64,64,0.08)",border:"1px solid rgba(255,64,64,0.2)",color:"#ff4040",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Lexend" }}>❌ Từ chối</button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
