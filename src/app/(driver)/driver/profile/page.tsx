"use client"

import { useState } from "react"

const DRIVER = {
  name: "Trần Văn Bình",
  phone: "0901234567",
  vehicle: "Xe máy",
  plate: "47B1-23456",
  model: "Honda Wave Alpha 2022",
  rating: 4.9,
  trips: 312,
  joinedDate: "01/03/2024",
}

export default function DriverProfilePage() {
  const [status, setStatus] = useState<"online"|"offline">("online")
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(DRIVER.name)
  const [phone, setPhone] = useState(DRIVER.phone)

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
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <a href="/driver" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Hồ sơ tài xế</div>
            </div>
            <button onClick={() => setEditing(e => !e)}
              style={{ background:editing?"rgba(255,107,0,0.1)":"rgba(255,255,255,0.06)",border:editing?"1px solid rgba(255,107,0,0.3)":"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"6px 14px",color:editing?"#FF8C00":"#b0956a",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Lexend" }}>
              {editing ? "💾 Lưu" : "✏️ Sửa"}
            </button>
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"16px 16px 40px" }}>

          {/* Avatar */}
          <div style={{ textAlign:"center",marginBottom:20 }}>
            <div style={{ position:"relative",display:"inline-block",marginBottom:12 }}>
              <div style={{ width:88,height:88,borderRadius:24,background:"linear-gradient(135deg,rgba(255,107,0,0.2),rgba(255,107,0,0.05))",border:"2px solid rgba(255,107,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:42 }}>🧑‍💼</div>
              <div style={{ position:"absolute",bottom:-4,right:-4,width:22,height:22,borderRadius:7,background:status==="online"?"#3ecf6e":"#6a5a40",border:"3px solid #080806" }} />
            </div>
            <div style={{ color:"#f8f0e0",fontSize:18,fontWeight:800,marginBottom:4 }}>{name}</div>
            <div style={{ display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,107,0,0.07)",border:"1px solid rgba(255,107,0,0.2)",borderRadius:8,padding:"4px 12px",marginBottom:14 }}>
              <span style={{ color:"#FF8C00",fontSize:10 }}>⭐ {DRIVER.rating}</span>
              <span style={{ color:"rgba(255,255,255,0.1)" }}>·</span>
              <span style={{ color:"#6a5a40",fontSize:9 }}>{DRIVER.trips} chuyến</span>
            </div>
            <div>
              <button onClick={() => setStatus(s => s==="online"?"offline":"online")}
                style={{ background:status==="online"?"rgba(62,207,110,0.1)":"rgba(255,255,255,0.06)",border:status==="online"?"1px solid rgba(62,207,110,0.3)":"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 20px",color:status==="online"?"#3ecf6e":"#6a5a40",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Lexend" }}>
                {status==="online"?"🟢 Đang online":"⚫ Đang offline"}
              </button>
            </div>
          </div>

          {/* Personal Info */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#6a5a40",fontSize:9,fontWeight:600,marginBottom:12 }}>THÔNG TIN CÁ NHÂN</div>
            {[
              { label:"Họ và tên", value:name, set:editing?setName:undefined },
              { label:"Số điện thoại", value:phone, set:editing?setPhone:undefined },
              { label:"Ngày tham gia", value:DRIVER.joinedDate, set:undefined },
            ].map(({ label, value, set }) => (
              <div key={label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ color:"#6a5a40",fontSize:10 }}>{label}</span>
                {set ? (
                  <input value={value} onChange={e=>set(e.target.value)} style={{ background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,107,0,0.3)",borderRadius:8,padding:"4px 10px",color:"#f8f0e0",fontSize:10,textAlign:"right",width:150 }} />
                ) : (
                  <span style={{ color:"#f8f0e0",fontSize:10,fontWeight:600 }}>{value}</span>
                )}
              </div>
            ))}
          </div>

          {/* Vehicle */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#6a5a40",fontSize:9,fontWeight:600,marginBottom:12 }}>PHƯƠNG TIỆN</div>
            {[
              { label:"Loại xe", value:DRIVER.vehicle },
              { label:"Biển số", value:DRIVER.plate },
              { label:"Model", value:DRIVER.model },
            ].map(({ label, value }) => (
              <div key={label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ color:"#6a5a40",fontSize:10 }}>{label}</span>
                <span style={{ color:"#f8f0e0",fontSize:10,fontWeight:600 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Documents */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:16 }}>
            <div style={{ color:"#6a5a40",fontSize:9,fontWeight:600,marginBottom:12 }}>GIẤY TỜ</div>
            {[
              { label:"CMND/CCCD", sub:"••• ••• 6789", status:"✅ Đã xác minh" },
              { label:"Bằng lái xe", sub:"Hạng A1", status:"✅ Đã xác minh" },
              { label:"Đăng ký xe", sub:DRIVER.plate, status:"✅ Đã xác minh" },
            ].map(({ label, sub, status }) => (
              <div key={label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <div>
                  <div style={{ color:"#b0956a",fontSize:10,marginBottom:2 }}>{label}</div>
                  <div style={{ color:"#6a5a40",fontSize:8 }}>{sub}</div>
                </div>
                <span style={{ color:"#3ecf6e",fontSize:9 }}>{status}</span>
              </div>
            ))}
          </div>

          <a href="/driver/earnings" style={{ display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px",marginBottom:10,textDecoration:"none" }}>
            <span style={{ fontSize:20 }}>💰</span>
            <span style={{ color:"#f8f0e0",fontSize:11,fontWeight:600,flex:1 }}>Xem thu nhập</span>
            <span style={{ color:"#6a5a40",fontSize:14 }}>›</span>
          </a>

          <button style={{ width:"100%",height:48,borderRadius:14,background:"rgba(255,64,64,0.08)",border:"1px solid rgba(255,64,64,0.2)",color:"#ff4040",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Lexend" }}>
            🚪 Đăng xuất
          </button>
        </div>
      </div>
    </>
  )
}
