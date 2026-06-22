"use client"

// src/app/(driver)/register/page.tsx
// Onboarding tài xế — 4 bước
// B1: Chọn Xe máy / Taxi
// B2: Thông tin cá nhân + biển số xe
// B3: Upload CMND + Bằng lái + Ảnh chân dung
// B4: Chờ admin duyệt + timeline trạng thái

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

type Step        = 1 | 2 | 3 | 4
type VehicleType = "moto" | "taxi" | null
type DocStatus   = "idle" | "uploading" | "done" | "error"

interface DocItem {
  key:     string
  label:   string
  hint:    string
  preview?: string
  progress: number
  status:  DocStatus
}

// giấy tờ xe máy: CMND 2 mặt + bằng lái 2 mặt + selfie (upload theo thứ tự)
const MOTO_DOCS = [
  { key:"id_front",      label:"CMND/CCCD mặt trước",           hint:"Rõ 4 góc, không bị chói sáng" },
  { key:"id_back",       label:"CMND/CCCD mặt sau",             hint:"Rõ 4 góc, không bị chói sáng" },
  { key:"license_front", label:"Bằng lái xe mặt trước (A1/A2)", hint:"Còn hạn, chụp rõ thông tin" },
  { key:"license_back",  label:"Bằng lái xe mặt sau (A1/A2)",  hint:"Chụp rõ toàn bộ mặt sau bằng lái" },
  { key:"portrait",      label:"Ảnh selfie khuôn mặt",          hint:"Nhìn thẳng, rõ mặt, nền sáng, không đeo kính" },
]

// giấy tờ taxi: CMND 2 mặt + bằng lái B2 2 mặt + cà vẹt xe + bảo hiểm + selfie (upload theo thứ tự)
const TAXI_DOCS = [
  { key:"id_front",      label:"CMND/CCCD mặt trước",             hint:"Rõ 4 góc, không bị chói sáng" },
  { key:"id_back",       label:"CMND/CCCD mặt sau",               hint:"Rõ 4 góc, không bị chói sáng" },
  { key:"license_front", label:"Bằng lái xe mặt trước (B2)",      hint:"Còn hạn, chụp rõ thông tin" },
  { key:"license_back",  label:"Bằng lái xe mặt sau (B2)",       hint:"Chụp rõ toàn bộ mặt sau bằng lái" },
  { key:"reg",           label:"Cà vẹt xe / Đăng ký xe ô tô",    hint:"Còn hiệu lực, đúng tên chủ xe" },
  { key:"insurance",     label:"Bảo hiểm xe ô tô",                hint:"Còn hiệu lực, chụp rõ số hợp đồng" },
  { key:"portrait",      label:"Ảnh selfie khuôn mặt",            hint:"Nhìn thẳng, rõ mặt, nền sáng, không đeo kính" },
]

// ─── Small helpers ─────────────────────────────────────────
function ProgBar({ pct, color="#FF6B00" }:{ pct:number; color?:string }) {
  return (
    <div style={{ height:3, background:"rgba(255,255,255,0.07)", borderRadius:2, overflow:"hidden" }}>
      <motion.div animate={{ width:`${pct}%` }} transition={{ duration:.5, ease:"easeOut" }}
        style={{ height:"100%", borderRadius:2, background:`linear-gradient(90deg,${color},${color==="#3ecf6e"?"#5eeea0":"#FF8C00"})` }} />
    </div>
  )
}

function FInput({ label, value, onChange, placeholder, icon, type="text" }:{
  label:string; value:string; onChange:(v:string)=>void
  placeholder?:string; icon?:string; type?:string
}) {
  const [f,setF] = useState(false)
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ color:"rgba(176,149,106,0.6)", fontSize:9.5, display:"block", marginBottom:4 }}>{label}</label>
      <div style={{ display:"flex", alignItems:"center", gap:8,
        background:"rgba(255,255,255,0.04)",
        border:`1px solid ${f?"rgba(255,107,0,0.55)":"rgba(255,255,255,0.08)"}`,
        borderRadius:12, padding:"0 12px", height:44, transition:"all .2s",
        boxShadow:f?"0 0 0 3px rgba(255,107,0,0.09)":"none" }}>
        {icon&&<span style={{ fontSize:15 }}>{icon}</span>}
        <input type={type} value={value} placeholder={placeholder}
          onChange={e=>onChange(e.target.value)}
          onFocus={()=>setF(true)} onBlur={()=>setF(false)}
          style={{ flex:1, background:"transparent", border:"none", outline:"none",
            color:"#f8f0e0", fontSize:12, fontFamily:"Lexend" }} />
      </div>
    </div>
  )
}

function Chips({ label, opts, value, onChange }:{
  label:string; opts:string[]; value:string; onChange:(v:string)=>void
}) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ color:"rgba(176,149,106,0.6)", fontSize:9.5, display:"block", marginBottom:5 }}>{label}</label>
      <div style={{ display:"flex", gap:6 }}>
        {opts.map(o=>(
          <div key={o} onClick={()=>onChange(o)}
            style={{ flex:1, height:38, borderRadius:10, cursor:"pointer", transition:"all .15s",
              background:value===o?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
              border:`1px solid ${value===o?"rgba(255,107,0,0.4)":"rgba(255,255,255,0.08)"}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              color:value===o?"#FF8C00":"#6a5a40", fontSize:10.5, fontWeight:value===o?600:400 }}>
            {o}
          </div>
        ))}
      </div>
    </div>
  )
}

function SLabel({ children }:{ children:React.ReactNode }) {
  return <div style={{ color:"#6a5a40", fontSize:8.5, fontWeight:700,
    textTransform:"uppercase", letterSpacing:.6, marginBottom:8 }}>{children}</div>
}

function CTA({ label, onClick, disabled }:{ label:string; onClick:()=>void; disabled?:boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:"100%", height:50, borderRadius:13, border:"none", cursor:disabled?"not-allowed":"pointer",
      background:disabled?"rgba(255,255,255,0.07)":"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
      color:disabled?"#6a5a40":"#fff", fontSize:13, fontWeight:700, fontFamily:"Lexend",
      position:"relative", overflow:"hidden", transition:"all .25s",
      boxShadow:!disabled?"0 4px 18px rgba(255,107,0,0.4)":"none",
    }}>
      {!disabled&&<div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
        background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
        animation:"drShim 2.5s infinite" }} />}
      <span style={{ position:"relative", zIndex:1 }}>{label}</span>
    </button>
  )
}

function TStep({ done, active, label, sub, last }:{
  done?:boolean; active?:boolean; label:string; sub:string; last?:boolean
}) {
  return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
        <div style={{ width:16, height:16, borderRadius:"50%",
          background:done?"#3ecf6e":active?"rgba(245,197,66,0.15)":"rgba(255,255,255,0.07)",
          border:done?"none":active?"1.5px solid #f5c542":"1px solid rgba(255,255,255,0.12)",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          {done&&<span style={{ color:"#080806", fontSize:9 }}>✓</span>}
          {active&&!done&&<div style={{ width:5, height:5, borderRadius:"50%", background:"#f5c542" }} />}
        </div>
        {!last&&<div style={{ width:1, height:18, marginTop:2,
          background:done?"rgba(62,207,110,0.3)":active?"rgba(245,197,66,0.2)":"rgba(255,255,255,0.07)" }} />}
      </div>
      <div style={{ paddingBottom:last?0:14 }}>
        <div style={{ fontSize:11, fontWeight:600, marginBottom:2,
          color:done?"#3ecf6e":active?"#f5c542":"#6a5a40" }}>{label}</div>
        <div style={{ color:"#6a5a40", fontSize:9 }}>{sub}</div>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────
export default function DriverRegisterPage() {
  const [step,    setStep]    = useState<Step>(1)
  const [vehicle, setVehicle] = useState<VehicleType>(null)
  const [name,    setName]    = useState("")
  const [phone,   setPhone]   = useState("")
  const [idNum,   setIdNum]   = useState("")
  const [plate,   setPlate]   = useState("")
  const [motoType,setMotoType]= useState("Xe số")
  const [seats,   setSeats]   = useState("5 chỗ")
  const [carModel,setCarModel]= useState("")
  const [year,    setYear]    = useState("")
  const [docs,    setDocs]    = useState<Record<string,DocItem>>({})
  const [toast,   setToast]   = useState("")
  const fileRefs  = useRef<Record<string,HTMLInputElement|null>>({})

  const fireToast = (m:string) => { setToast(m); setTimeout(()=>setToast(""),2400) }

  // init docs on vehicle select
  useEffect(() => {
    if (!vehicle) return
    const list = vehicle==="moto" ? MOTO_DOCS : TAXI_DOCS
    const init: Record<string,DocItem> = {}
    list.forEach(d => { init[d.key] = { ...d, progress:0, status:"idle" } })
    setDocs(init)
  }, [vehicle])

  const docList   = vehicle==="moto" ? MOTO_DOCS : TAXI_DOCS
  const doneCount = Object.values(docs).filter(d=>d.status==="done").length
  const allDone   = doneCount===docList.length

  const handleFile = (key:string, file:File) => {
    const preview = URL.createObjectURL(file)
    setDocs(prev=>({...prev,[key]:{...prev[key],preview,progress:0,status:"uploading"}}))
    let p=0
    const iv = setInterval(()=>{
      p += Math.random()*30
      if(p>=100){
        clearInterval(iv)
        setDocs(prev=>({...prev,[key]:{...prev[key],progress:100,status:"done"}}))
        fireToast("Upload thành công!")
      } else {
        setDocs(prev=>({...prev,[key]:{...prev[key],progress:Math.round(p)}}))
      }
    },250)
  }

  const step2Valid = name && phone && idNum && plate
  const pct: Record<Step,number> = { 1:25, 2:50, 3:75, 4:100 }

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%;overflow:hidden}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        @keyframes drShim{0%{left:-60%}100%{left:120%}}
      `}</style>

      <AnimatePresence>
        {toast&&<motion.div initial={{opacity:0,y:-14}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-14}}
          style={{ position:"fixed",top:52,left:"50%",transform:"translateX(-50%)",
            zIndex:999,whiteSpace:"nowrap",background:"rgba(62,207,110,0.15)",
            border:"1px solid rgba(62,207,110,0.35)",borderRadius:12,padding:"7px 18px",
            color:"#3ecf6e",fontSize:11,fontWeight:600,backdropFilter:"blur(10px)" }}>
          ✓ {toast}
        </motion.div>}
      </AnimatePresence>

      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",fontFamily:"'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)",backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"calc(env(safe-area-inset-top) + 10px) 16px 10px",flexShrink:0,zIndex:40 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
            {step>1
              ? <button onClick={()=>setStep(p=>(p-1) as Step)} style={{ width:32,height:32,borderRadius:9,
                  border:"none",background:"rgba(255,255,255,0.05)",
                  borderWidth:1,borderStyle:"solid",borderColor:"rgba(255,255,255,0.08)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,cursor:"pointer",color:"#f8f0e0" }}>←</button>
              : <a href="/" style={{ width:32,height:32,borderRadius:9,textDecoration:"none",
                  background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>←</a>
            }
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:15,fontWeight:700 }}>Đăng ký tài xế</div>
              <div style={{ color:"#6a5a40",fontSize:9,marginTop:1 }}>
                Bước {step}/4 — {step===1?"Chọn loại xe":step===2?"Thông tin":step===3?"Upload giấy tờ":"Chờ xét duyệt"}
              </div>
            </div>
            {vehicle&&step>1&&(
              <div style={{ background:vehicle==="moto"?"rgba(255,107,0,0.1)":"rgba(74,143,245,0.1)",
                border:`1px solid ${vehicle==="moto"?"rgba(255,107,0,0.25)":"rgba(74,143,245,0.25)"}`,
                borderRadius:8,padding:"3px 10px",
                color:vehicle==="moto"?"#FF8C00":"#4a8ff5",fontSize:10,fontWeight:600 }}>
                {vehicle==="moto"?"🛵 Xe máy":"🚕 Taxi"}
              </div>
            )}
          </div>
          <ProgBar pct={pct[step]} />
        </div>

        {/* Body */}
        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px 90px",WebkitOverflowScrolling:"touch" } as React.CSSProperties}>
          <AnimatePresence mode="wait">

            {/* ── B1: Chọn xe ── */}
            {step===1&&(
              <motion.div key="s1" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:.22}}>
                <div style={{ textAlign:"center",marginBottom:20 }}>
                  <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:700,marginBottom:4 }}>Bạn muốn chạy xe gì?</div>
                  <div style={{ color:"#6a5a40",fontSize:10.5 }}>Chọn loại phương tiện bạn đang có</div>
                </div>
                {[
                  { v:"moto", icon:"🛵", label:"Xe máy", sub:"Giao hàng · Xe ôm · Mua hộ · Giao hộ",
                    tags:["📦 Giao hàng","🛵 Xe ôm","🛍 Mua hộ","📬 Giao hộ"],
                    c:"#FF8C00", bg:"rgba(255,107,0,0.08)", bd:"rgba(255,107,0,0.4)" },
                  { v:"taxi", icon:"🚕", label:"Taxi (ô tô)", sub:"Đưa đón khách bằng ô tô 4–7 chỗ ngồi",
                    tags:["🚗 Đưa đón","🪑 4–7 chỗ"],
                    c:"#4a8ff5", bg:"rgba(74,143,245,0.08)", bd:"rgba(74,143,245,0.4)" },
                ].map(opt=>(
                  <div key={opt.v} onClick={()=>setVehicle(opt.v as VehicleType)}
                    style={{ background:vehicle===opt.v?opt.bg:"rgba(255,255,255,0.04)",
                      border:`1.5px solid ${vehicle===opt.v?opt.bd:"rgba(255,255,255,0.08)"}`,
                      borderRadius:16,padding:"16px 14px",marginBottom:10,cursor:"pointer",
                      transition:"all .2s",boxShadow:vehicle===opt.v?`0 0 16px ${opt.bg}`:"none" }}>
                    <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
                      <div style={{ width:52,height:52,borderRadius:14,flexShrink:0,
                        background:vehicle===opt.v?opt.bg:"rgba(255,255,255,0.06)",
                        border:`1px solid ${vehicle===opt.v?opt.bd:"rgba(255,255,255,0.08)"}`,
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:26 }}>
                        {opt.icon}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4 }}>
                          <div style={{ color:vehicle===opt.v?opt.c:"#f8f0e0",fontSize:13,fontWeight:700 }}>{opt.label}</div>
                          <div style={{ width:18,height:18,borderRadius:"50%",
                            background:vehicle===opt.v?opt.c:"transparent",
                            border:`1.5px solid ${vehicle===opt.v?opt.c:"rgba(255,255,255,0.2)"}`,
                            display:"flex",alignItems:"center",justifyContent:"center" }}>
                            {vehicle===opt.v&&<div style={{ width:6,height:6,borderRadius:"50%",background:"#fff" }} />}
                          </div>
                        </div>
                        <div style={{ color:"#6a5a40",fontSize:10,marginBottom:8 }}>{opt.sub}</div>
                        <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                          {opt.tags.map(t=>(
                            <span key={t} style={{ background:opt.bg,border:`1px solid ${opt.bd.replace("0.4","0.2")}`,
                              borderRadius:6,padding:"2px 7px",color:opt.c,fontSize:9 }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop:10 }}>
                  <CTA label="→ Tiếp theo: Thông tin cá nhân" disabled={!vehicle} onClick={()=>setStep(2)} />
                </div>
              </motion.div>
            )}

            {/* ── B2: Thông tin ── */}
            {step===2&&(
              <motion.div key="s2" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:.22}}>
                <SLabel>Thông tin cá nhân</SLabel>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"12px 13px",marginBottom:14 }}>
                  <FInput label="Họ và tên"      value={name}   onChange={setName}   placeholder="Nguyễn Văn A"    icon="👤" />
                  <FInput label="Số điện thoại"  value={phone}  onChange={setPhone}  placeholder="0901 234 567"    icon="📱" type="tel" />
                  <FInput label="CMND / CCCD"     value={idNum}  onChange={setIdNum}  placeholder="012 345 678 901" icon="🪪" />
                </div>

                <SLabel>Thông tin phương tiện</SLabel>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"12px 13px",marginBottom:14 }}>
                  <FInput label="Biển số xe" value={plate} onChange={setPlate}
                    placeholder={vehicle==="moto"?"47B - 123.45":"47A - 567.89"} icon="🔖" />
                  {vehicle==="moto"&&(
                    <Chips label="Loại xe máy" opts={["Xe số","Tay ga","Xe điện"]} value={motoType} onChange={setMotoType} />
                  )}
                  {vehicle==="taxi"&&(
                    <>
                      <FInput label="Dòng xe (ô tô)" value={carModel} onChange={setCarModel} placeholder="Toyota Vios 2022" icon="🚗" />
                      <Chips label="Số chỗ ngồi" opts={["4 chỗ","5 chỗ","7 chỗ"]} value={seats} onChange={setSeats} />
                    </>
                  )}
                  <FInput label="Năm sản xuất" value={year} onChange={setYear} placeholder="2020" icon="📅" type="number" />
                </div>

                <CTA label="→ Tiếp theo: Upload giấy tờ" disabled={!step2Valid} onClick={()=>setStep(3)} />
              </motion.div>
            )}

            {/* ── B3: Upload ── */}
            {step===3&&(
              <motion.div key="s3" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:.22}}>
                {/* Progress */}
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:13,padding:"11px 14px",marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7 }}>
                    <span style={{ color:"#b0956a",fontSize:10,fontWeight:600 }}>Tiến độ upload giấy tờ</span>
                    <span style={{ color:allDone?"#3ecf6e":"#FF8C00",fontSize:10,fontWeight:700 }}>{doneCount}/{docList.length}</span>
                  </div>
                  <ProgBar pct={(doneCount/docList.length)*100} color={allDone?"#3ecf6e":"#FF6B00"} />
                </div>

                {/* Step hint */}
                {!allDone&&(()=>{
                  const activeDocIdx = docList.findIndex(d=>{ const dc=docs[d.key]; return !dc||dc.status!=="done" })
                  const activeDoc = docList[activeDocIdx]
                  return activeDoc ? (
                    <div style={{ background:"rgba(255,107,0,0.07)",border:"1px solid rgba(255,107,0,0.2)",
                      borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",gap:8,alignItems:"center" }}>
                      <span style={{ fontSize:13,flexShrink:0 }}>📌</span>
                      <div>
                        <div style={{ color:"#FF8C00",fontSize:9.5,fontWeight:700 }}>
                          Bước {activeDocIdx+1}/{docList.length}: {activeDoc.label}
                        </div>
                        <div style={{ color:"#b0956a",fontSize:8.5,marginTop:1 }}>
                          Hoàn thành bước này để mở khóa bước tiếp theo
                        </div>
                      </div>
                    </div>
                  ) : null
                })()}

                <SLabel>Upload giấy tờ bắt buộc (theo thứ tự)</SLabel>

                {docList.map((d,idx)=>{
                  const doc = docs[d.key] ?? { ...d, progress:0, status:"idle" as DocStatus }
                  const activeDocIdx = docList.findIndex(dd=>{ const dc=docs[dd.key]; return !dc||dc.status!=="done" })
                  const isDone    = doc.status==="done"
                  const isCurrent = idx===activeDocIdx
                  const isLocked  = activeDocIdx>=0 && idx>activeDocIdx
                  return (
                    <div key={d.key} style={{
                      background: isDone?"rgba(62,207,110,0.06)":isCurrent?"rgba(255,107,0,0.06)":"rgba(255,255,255,0.04)",
                      border:`1px solid ${isDone?"rgba(62,207,110,0.25)":isCurrent?"rgba(255,107,0,0.2)":"rgba(255,255,255,0.07)"}`,
                      borderRadius:13,padding:"11px 13px",marginBottom:8,
                      opacity:isLocked?0.4:1,
                      transition:"opacity .2s",
                    }}>
                      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                        {/* Status icon */}
                        <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,
                          background: isDone?"rgba(62,207,110,0.15)":isCurrent?"rgba(255,107,0,0.12)":isLocked?"rgba(255,255,255,0.03)":"rgba(255,255,255,0.05)",
                          border:`1px solid ${isDone?"rgba(62,207,110,0.3)":isCurrent?"rgba(255,107,0,0.25)":"rgba(255,255,255,0.07)"}`,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>
                          {isDone?"✅":doc.status==="uploading"?"⬆️":isLocked?"🔒":"📎"}
                        </div>
                        {/* Info */}
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:2 }}>
                            <div style={{ fontSize:11,fontWeight:600,
                              color:isDone?"#3ecf6e":isCurrent?"#FF8C00":isLocked?"rgba(255,255,255,0.25)":"#f8f0e0" }}>
                              {d.label}
                            </div>
                            {isCurrent&&!isDone&&(
                              <div style={{ background:"rgba(255,107,0,0.15)",border:"1px solid rgba(255,107,0,0.3)",
                                borderRadius:5,padding:"1px 6px",color:"#FF8C00",fontSize:7,fontWeight:700 }}>
                                ← HIỆN TẠI
                              </div>
                            )}
                          </div>
                          <div style={{ color:isLocked?"rgba(255,255,255,0.2)":"#6a5a40",fontSize:8.5 }}>{d.hint}</div>
                          {doc.status==="uploading"&&(
                            <div style={{ marginTop:5,height:2,background:"rgba(255,255,255,0.07)",borderRadius:1,overflow:"hidden" }}>
                              <motion.div animate={{ width:`${doc.progress}%` }}
                                style={{ height:"100%",background:"#FF8C00",borderRadius:1 }} />
                            </div>
                          )}
                          {/* Preview thumbnail */}
                          {isDone&&doc.preview&&(
                            <div style={{ marginTop:5,width:40,height:28,borderRadius:5,overflow:"hidden",border:"1px solid rgba(62,207,110,0.3)" }}>
                              <img src={doc.preview} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                            </div>
                          )}
                        </div>
                        {/* Action button */}
                        <div style={{ flexShrink:0 }}>
                          {isLocked&&(
                            <div style={{ padding:"5px 10px",borderRadius:8,background:"rgba(255,255,255,0.03)",
                              border:"1px solid rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.2)",fontSize:9 }}>
                              🔒 Khóa
                            </div>
                          )}
                          {!isLocked&&(isDone?(
                            <button onClick={()=>fileRefs.current[d.key]?.click()}
                              style={{ padding:"5px 10px",borderRadius:8,border:"none",
                                background:"rgba(255,255,255,0.05)",borderWidth:1,borderStyle:"solid",
                                borderColor:"rgba(255,255,255,0.08)",
                                color:"#6a5a40",fontSize:8.5,fontFamily:"Lexend",cursor:"pointer" }}>
                              Đổi ảnh
                            </button>
                          ):(
                            <button onClick={()=>fileRefs.current[d.key]?.click()}
                              style={{ padding:"6px 12px",borderRadius:8,border:"none",
                                background:"rgba(255,107,0,0.1)",borderWidth:1,borderStyle:"solid",
                                borderColor:"rgba(255,107,0,0.25)",
                                color:"#FF8C00",fontSize:9.5,fontWeight:600,fontFamily:"Lexend",cursor:"pointer" }}>
                              📷 Chọn ảnh
                            </button>
                          ))}
                        </div>
                      </div>
                      <input ref={el=>{ fileRefs.current[d.key]=el }} type="file" accept="image/*"
                        onChange={e=>{ const f=e.target.files?.[0]; if(f) handleFile(d.key,f) }}
                        style={{ display:"none" }} />
                    </div>
                  )
                })}

                <div style={{ background:"rgba(245,197,66,0.07)",border:"1px solid rgba(245,197,66,0.2)",
                  borderRadius:11,padding:"10px 13px",marginBottom:14,display:"flex",gap:8 }}>
                  <span style={{ fontSize:14,flexShrink:0 }}>💡</span>
                  <div style={{ color:"rgba(245,197,66,0.7)",fontSize:9.5,lineHeight:1.6 }}>
                    Ảnh phải rõ nét, đủ sáng, không bị mờ hoặc cắt góc. File JPG/PNG dưới 5MB.
                  </div>
                </div>

                <CTA
                  label={allDone?"✅ Gửi hồ sơ đăng ký":`Upload đủ để tiếp tục (${doneCount}/${docList.length})`}
                  disabled={!allDone}
                  onClick={()=>{ setStep(4); fireToast("Đã gửi hồ sơ thành công!") }} />
              </motion.div>
            )}

            {/* ── B4: Chờ duyệt ── */}
            {step===4&&(
              <motion.div key="s4" initial={{opacity:0,scale:.97}} animate={{opacity:1,scale:1}} transition={{duration:.3}}>
                <div style={{ textAlign:"center",padding:"20px 0 20px" }}>
                  <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",damping:12,delay:.1}}>
                    <div style={{ width:80,height:80,borderRadius:22,margin:"0 auto 14px",
                      background:"rgba(245,197,66,0.1)",border:"1px solid rgba(245,197,66,0.25)",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:36 }}>⏳</div>
                  </motion.div>
                  <div style={{ color:"#f8f0e0",fontSize:17,fontWeight:800,marginBottom:6 }}>Hồ sơ đã gửi thành công!</div>
                  <div style={{ color:"#6a5a40",fontSize:11,lineHeight:1.7 }}>
                    Admin đang xem xét hồ sơ của bạn.<br/>
                    Thời gian xét duyệt: <strong style={{ color:"#FFB347" }}>24–48 giờ làm việc</strong>
                  </div>
                </div>

                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"14px",marginBottom:12 }}>
                  <SLabel>Trạng thái hồ sơ</SLabel>
                  <TStep done  label="Gửi hồ sơ thành công"      sub="Hôm nay · vừa xong" />
                  <TStep done  label="Hệ thống xác nhận nhận hồ sơ" sub="Tự động · vừa xong" />
                  <TStep active label="Admin đang xét duyệt"       sub="Đang trong hàng chờ..." />
                  <TStep       label="Thông báo kết quả"           sub="Qua SMS + thông báo app" last />
                </div>

                <div style={{ background:"rgba(255,107,0,0.07)",border:"1px solid rgba(255,107,0,0.2)",
                  borderRadius:13,padding:"12px 14px",marginBottom:10 }}>
                  <div style={{ color:"#FF8C00",fontSize:10.5,fontWeight:700,marginBottom:8 }}>Trong khi chờ, bạn có thể:</div>
                  {["Đọc hướng dẫn tài xế mới trong app","Chuẩn bị giá đỡ điện thoại trên xe","Tìm hiểu khu vực Krông Pắc, Đắk Lắk","Kiểm tra sạc pin đầy cho thiết bị"].map((t,i)=>(
                    <div key={i} style={{ display:"flex",gap:8,marginBottom:5 }}>
                      <span style={{ color:"#FF8C00",fontSize:12 }}>•</span>
                      <span style={{ color:"#b0956a",fontSize:10,lineHeight:1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background:"rgba(62,207,110,0.06)",border:"1px solid rgba(62,207,110,0.18)",
                  borderRadius:13,padding:"11px 14px",marginBottom:14,display:"flex",gap:10,alignItems:"center" }}>
                  <span style={{ fontSize:20,flexShrink:0 }}>📲</span>
                  <div style={{ color:"rgba(62,207,110,0.8)",fontSize:9.5,lineHeight:1.6 }}>
                    Khi được duyệt, bạn sẽ nhận SMS và thông báo ngay trong app. Hãy mở app để bắt đầu nhận đơn!
                  </div>
                </div>

                <button onClick={()=>{ window.location.href="/" }}
                  style={{ width:"100%",height:46,borderRadius:12,border:"none",
                    background:"rgba(255,255,255,0.05)",borderWidth:1,borderStyle:"solid",
                    borderColor:"rgba(255,255,255,0.1)",
                    color:"#b0956a",fontSize:12,fontWeight:600,fontFamily:"Lexend",cursor:"pointer",marginBottom:8 }}>
                  Về trang chủ
                </button>
                <button onClick={()=>fireToast("Đang kết nối hỗ trợ viên...")}
                  style={{ width:"100%",height:42,borderRadius:12,border:"none",
                    background:"rgba(255,107,0,0.07)",borderWidth:1,borderStyle:"solid",
                    borderColor:"rgba(255,107,0,0.2)",
                    color:"#FF8C00",fontSize:11,fontWeight:600,fontFamily:"Lexend",cursor:"pointer" }}>
                  💬 Liên hệ hỗ trợ nếu cần
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Bottom Nav */}
        <div style={{ position:"absolute",bottom:16,left:14,right:14,height:56,
          background:"rgba(8,8,6,0.92)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)",borderRadius:9999,
          display:"flex",alignItems:"center",justifyContent:"space-around",
          padding:"0 6px",zIndex:50,boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            {icon:"🏠",label:"Trang chủ",href:"/"},
            {icon:"📋",label:"Đơn hàng",href:"/orders"},
            {icon:"🛒",label:"Giỏ hàng",href:"/cart"},
            {icon:"⚙️",label:"Cài đặt",href:"/settings"},
          ].map(tab=>(
            <a key={tab.href} href={tab.href}
              style={{ textDecoration:"none",display:"flex",flexDirection:"column",
                alignItems:"center",gap:2,padding:"5px 11px",borderRadius:18,transition:"all .2s" }}>
              <span style={{ fontSize:19 }}>{tab.icon}</span>
              <span style={{ fontSize:7.5,color:"#6a5a40" }}>{tab.label}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
