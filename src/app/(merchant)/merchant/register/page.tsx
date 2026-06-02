"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const ALL_DAYS = ["T2","T3","T4","T5","T6","T7","CN"]
const STEPS = ["Thông tin cơ bản","Địa điểm & giờ mở","Xác nhận & gửi"]

interface Form {
  name:string; phone:string; description:string
  address:string; openTime:string; closeTime:string; days:string[]
}

export default function MerchantRegisterPage() {
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<Form>({ name:"",phone:"",description:"",address:"",openTime:"07:00",closeTime:"22:00",days:["T2","T3","T4","T5","T6","T7","CN"] })

  const update = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const toggleDay = (d: string) => setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x=>x!==d) : [...f.days,d] }))
  const canNext = () => {
    if (step===0) return !!(form.name && form.phone)
    if (step===1) return !!(form.address && form.days.length)
    return true
  }

  if (submitted) return (
    <>
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html,body{background:#080806;font-family:'Lexend',sans-serif}`}</style>
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,gap:16 }}>
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:"spring",damping:10,stiffness:150 }}
          style={{ width:88,height:88,borderRadius:24,background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:42 }}>✅</motion.div>
        <div style={{ textAlign:"center" }}>
          <div style={{ color:"#f8f0e0",fontSize:20,fontWeight:800,marginBottom:8 }}>Đã gửi đơn đăng ký!</div>
          <div style={{ color:"#6a5a40",fontSize:11,lineHeight:1.7 }}>Chúng tôi sẽ xem xét và liên hệ trong vòng</div>
          <div style={{ color:"#FF8C00",fontSize:14,fontWeight:700 }}>1-2 ngày làm việc</div>
        </div>
        <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,width:"100%",maxWidth:340 }}>
          {[["Tên cửa hàng",form.name],["Số điện thoại",form.phone],["Địa chỉ",form.address]].map(([k,v]) => (
            <div key={k} style={{ display:"flex",justifyContent:"space-between",gap:12,marginBottom:8,paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ color:"#6a5a40",fontSize:9,flexShrink:0 }}>{k}</span>
              <span style={{ color:"#b0956a",fontSize:9,fontWeight:600,textAlign:"right" }}>{v}</span>
            </div>
          ))}
        </div>
        <a href="/" style={{ textDecoration:"none",padding:"12px 24px",borderRadius:14,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#b0956a",fontSize:11,fontWeight:700 }}>Về trang chủ</a>
      </div>
    </>
  )

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        input,textarea{outline:none;font-family:'Lexend',sans-serif}
      `}</style>
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"calc(env(safe-area-inset-top) + 14px) 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
            <button onClick={() => step>0?setStep(s=>s-1):history.back()}
              style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#f8f0e0" }}>←</button>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:15,fontWeight:800 }}>Đăng ký cửa hàng</div>
              <div style={{ color:"#6a5a40",fontSize:9 }}>Bước {step+1} / {STEPS.length} — {STEPS[step]}</div>
            </div>
          </div>
          <div style={{ height:3,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden" }}>
            <motion.div style={{ height:"100%",borderRadius:2,background:"linear-gradient(90deg,#FF6B00,#FFB347)" }} animate={{ width:`${((step+1)/STEPS.length)*100}%` }} transition={{ duration:.3 }} />
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"16px 16px 120px" }}>
          <AnimatePresence mode="wait">

            {step===0 && (
              <motion.div key="s0" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:6 }}>TÊN CỬA HÀNG *</label>
                  <input value={form.name} onChange={e=>update("name",e.target.value)} placeholder="VD: Bún Bò Huế Ngon..." style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",color:"#f8f0e0",fontSize:13 }} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:6 }}>SỐ ĐIỆN THOẠI *</label>
                  <input value={form.phone} onChange={e=>update("phone",e.target.value)} placeholder="0901 234 567" type="tel" style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",color:"#f8f0e0",fontSize:13 }} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:6 }}>MÔ TẢ (tùy chọn)</label>
                  <textarea value={form.description} onChange={e=>update("description",e.target.value)} placeholder="Đặc sản, phong cách phục vụ..." rows={3} style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",color:"#f8f0e0",fontSize:12,resize:"none",fontFamily:"Lexend" }} />
                </div>
                <div style={{ background:"rgba(74,143,245,0.07)",border:"1px solid rgba(74,143,245,0.2)",borderRadius:12,padding:"12px 14px" }}>
                  <div style={{ color:"#4a8ff5",fontSize:10,fontWeight:700,marginBottom:4 }}>ℹ️ Hoa hồng Giao Nhanh</div>
                  <div style={{ color:"#6a5a40",fontSize:9,lineHeight:1.7 }}>Thu <strong style={{ color:"#b0956a" }}>15% hoa hồng</strong> trên mỗi đơn. Không phí đăng ký. Thanh toán cuối tháng.</div>
                </div>
              </motion.div>
            )}

            {step===1 && (
              <motion.div key="s1" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:6 }}>ĐỊA CHỈ CỬA HÀNG *</label>
                  <input value={form.address} onChange={e=>update("address",e.target.value)} placeholder="VD: 22 Lê Hồng Phong, Phước An..." style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",color:"#f8f0e0",fontSize:12,marginBottom:8 }} />
                  <button style={{ width:"100%",padding:"10px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px dashed rgba(255,255,255,0.12)",color:"#6a5a40",fontSize:10,cursor:"pointer",fontFamily:"Lexend" }}>📍 Chọn vị trí trên bản đồ</button>
                </div>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:12 }}>
                  <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:12 }}>🕐 Giờ mở cửa</div>
                  <div style={{ display:"flex",gap:5,marginBottom:12,flexWrap:"wrap" }}>
                    {ALL_DAYS.map(d => (
                      <button key={d} onClick={()=>toggleDay(d)}
                        style={{ width:36,height:36,borderRadius:9,background:form.days.includes(d)?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",border:form.days.includes(d)?"1px solid rgba(255,107,0,0.35)":"1px solid rgba(255,255,255,0.06)",color:form.days.includes(d)?"#FF8C00":"#6a5a40",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"Lexend" }}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#6a5a40",fontSize:8,marginBottom:4 }}>Mở cửa</div>
                      <input type="time" value={form.openTime} onChange={e=>update("openTime",e.target.value)} style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 10px",color:"#f8f0e0",fontSize:12,colorScheme:"dark" }} />
                    </div>
                    <div style={{ color:"#6a5a40",fontSize:12,marginTop:14 }}>→</div>
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#6a5a40",fontSize:8,marginBottom:4 }}>Đóng cửa</div>
                      <input type="time" value={form.closeTime} onChange={e=>update("closeTime",e.target.value)} style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 10px",color:"#f8f0e0",fontSize:12,colorScheme:"dark" }} />
                    </div>
                  </div>
                </div>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px dashed rgba(255,255,255,0.12)",borderRadius:14,padding:24,display:"flex",flexDirection:"column",alignItems:"center",gap:8,cursor:"pointer" }}>
                  <span style={{ fontSize:32 }}>🖼️</span>
                  <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:600 }}>Tải ảnh bìa cửa hàng</div>
                  <div style={{ color:"#6a5a40",fontSize:9 }}>Ảnh đẹp giúp thu hút nhiều khách hơn</div>
                </div>
              </motion.div>
            )}

            {step===2 && (
              <motion.div key="s2" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:800,marginBottom:4 }}>Xem lại thông tin</div>
                <div style={{ color:"#6a5a40",fontSize:10,marginBottom:16 }}>Kiểm tra trước khi gửi đăng ký</div>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:16,marginBottom:12 }}>
                  <div style={{ display:"flex",gap:12,alignItems:"center",marginBottom:16 }}>
                    <div style={{ width:56,height:56,borderRadius:14,background:"rgba(255,107,0,0.1)",border:"1px solid rgba(255,107,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28 }}>
                      🏪
                    </div>
                    <div>
                      <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:800 }}>{form.name || "Tên cửa hàng"}</div>
                    </div>
                  </div>
                  {[["Số ĐT",form.phone],["Địa chỉ",form.address||"Chưa nhập"],["Giờ mở",`${form.openTime} – ${form.closeTime}`],["Ngày mở",form.days.join(", ")||"Chưa chọn"]].map(([k,v]) => (
                    <div key={k} style={{ display:"flex",justifyContent:"space-between",gap:12,marginBottom:8,paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ color:"#6a5a40",fontSize:9,flexShrink:0 }}>{k}</span>
                      <span style={{ color:"#b0956a",fontSize:9,fontWeight:600,textAlign:"right" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:"rgba(255,107,0,0.05)",border:"1px solid rgba(255,107,0,0.15)",borderRadius:12,padding:12 }}>
                  <div style={{ color:"#6a5a40",fontSize:9,lineHeight:1.8 }}>
                    Bằng cách gửi, bạn đồng ý với <span style={{ color:"#FF8C00" }}>Điều khoản dịch vụ</span> và <span style={{ color:"#FF8C00" }}>Chính sách hoa hồng 15%</span> của Giao Nhanh.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTA */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(8,8,6,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.07)",padding:"12px 16px 28px",zIndex:10 }}>
          <button disabled={!canNext()} onClick={() => step<STEPS.length-1?setStep(s=>s+1):setSubmitted(true)}
            style={{ width:"100%",height:52,borderRadius:14,background:canNext()?"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)":"rgba(255,255,255,0.06)",border:"none",cursor:canNext()?"pointer":"not-allowed",color:canNext()?"#fff":"#6a5a40",fontSize:14,fontWeight:800,fontFamily:"Lexend",boxShadow:canNext()?"0 4px 24px rgba(255,107,0,0.45)":"none",transition:"all .2s" }}>
            {step<STEPS.length-1?"Tiếp tục →":"✅ Gửi đăng ký"}
          </button>
        </div>
      </div>
    </>
  )
}
