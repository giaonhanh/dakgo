"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SHOP_CATEGORIES } from "@/lib/categories"
import { createClient } from "@/lib/supabase/client"
import AddressPicker from "@/components/map/AddressPicker"
import type { AddressPickerResult } from "@/types"

const ALL_DAYS = ["T2","T3","T4","T5","T6","T7","CN"]
const STEPS = ["Thông tin quán","Địa điểm & giờ","Tài khoản","Xác nhận & gửi"]

interface Form {
  name: string; phone: string; categories: string[]; description: string
  address: string; lat: number | null; lng: number | null
  openTime: string; closeTime: string; days: string[]
  email: string; password: string; confirmPassword: string
}

export default function MerchantRegisterPage() {
  const [step,       setStep]       = useState(0)
  const [submitted,  setSubmitted]  = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError,setSubmitError]= useState("")
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [form, setForm] = useState<Form>({
    name:"", phone:"", categories:[], description:"",
    address:"", lat:null, lng:null, openTime:"07:00", closeTime:"22:00", days:[...ALL_DAYS],
    email:"", password:"", confirmPassword:"",
  })

  const update = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const toggleDay = (d: string) => setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x=>x!==d) : [...f.days, d] }))
  const toggleCat = (v: string) => setForm(f => ({ ...f, categories: f.categories.includes(v) ? f.categories.filter(x=>x!==v) : [...f.categories, v] }))

  const canNext = () => {
    if (step===0) return !!(form.name && form.phone && form.categories.length > 0)
    if (step===1) return !!(form.address && form.lat && form.lng && form.days.length)
    if (step===2) return !!(form.email && form.password.length >= 6 && form.password === form.confirmPassword)
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError("")
    const supabase = createClient()

    // 1. Tạo tài khoản
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name, role: "merchant" } }
    })
    if (authErr) {
      if (authErr.message.includes("already registered")) setSubmitError("Email này đã có tài khoản. Dùng email khác hoặc đăng nhập.")
      else setSubmitError(authErr.message)
      setSubmitting(false); return
    }
    const userId = authData.user?.id
    if (!userId) { setSubmitError("Không thể tạo tài khoản. Thử lại sau."); setSubmitting(false); return }

    // 2. Insert shop
    const { error: shopErr } = await supabase.from("shops").insert({
      owner_id: userId,
      name: form.name,
      phone: form.phone,
      description: form.description || null,
      address: form.address,
      lat: form.lat,
      lng: form.lng,
      location: form.lat && form.lng ? `POINT(${form.lng} ${form.lat})` : null,
      category: form.categories[0] ?? "khac",
      categories: form.categories,
      opening_hours: { open: form.openTime, close: form.closeTime },
      status: "pending",
      is_open: false,
    })
    if (shopErr) {
      setSubmitError("Tạo tài khoản thành công nhưng lỗi lưu thông tin quán. Liên hệ hỗ trợ.")
      setSubmitting(false); return
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) return (
    <>
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html,body{background:#080806;font-family:'Lexend',sans-serif}`}</style>
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,gap:16 }}>
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:"spring",damping:10,stiffness:150 }}
          style={{ width:88,height:88,borderRadius:24,background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:42 }}>✅</motion.div>
        <div style={{ textAlign:"center" }}>
          <div style={{ color:"#f8f0e0",fontSize:20,fontWeight:800,marginBottom:8 }}>Đã gửi đơn đăng ký!</div>
          <div style={{ color:"#6a5a40",fontSize:11,lineHeight:1.7 }}>Chúng tôi sẽ xem xét và liên hệ qua</div>
          <div style={{ color:"#FF8C00",fontSize:13,fontWeight:700,marginBottom:4 }}>{form.email}</div>
          <div style={{ color:"#6a5a40",fontSize:11 }}>trong vòng <strong style={{ color:"#FF8C00" }}>1–2 ngày làm việc</strong></div>
        </div>
        <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,width:"100%",maxWidth:340 }}>
          {[
            ["Tên cửa hàng", form.name],
            ["Loại hình", form.categories.map(v=>SHOP_CATEGORIES.find(c=>c.value===v)?.label).filter(Boolean).join(", ") || "—"],
            ["Số điện thoại", form.phone],
            ["Địa chỉ", form.address],
            ["Email đăng nhập", form.email],
          ].map(([k,v]) => (
            <div key={k} style={{ display:"flex",justifyContent:"space-between",gap:12,marginBottom:8,paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ color:"#6a5a40",fontSize:9,flexShrink:0 }}>{k}</span>
              <span style={{ color:"#b0956a",fontSize:9,fontWeight:600,textAlign:"right" }}>{v}</span>
            </div>
          ))}
        </div>
        <a href="/merchant/login" style={{ textDecoration:"none",padding:"12px 24px",borderRadius:14,background:"linear-gradient(90deg,#FF6B00,#FF8C00)",color:"#fff",fontSize:12,fontWeight:700 }}>Đăng nhập cửa hàng →</a>
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
            <button onClick={() => step>0 ? setStep(s=>s-1) : history.back()}
              style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#f8f0e0" }}>←</button>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:15,fontWeight:800 }}>Đăng ký cửa hàng</div>
              <div style={{ color:"#6a5a40",fontSize:9 }}>Bước {step+1} / {STEPS.length} — {STEPS[step]}</div>
            </div>
          </div>
          <div style={{ height:3,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden" }}>
            <motion.div style={{ height:"100%",borderRadius:2,background:"linear-gradient(90deg,#FF6B00,#FFB347)" }}
              animate={{ width:`${((step+1)/STEPS.length)*100}%` }} transition={{ duration:.3 }} />
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"16px 16px 120px" }}>
          <AnimatePresence mode="wait">

            {/* Bước 0: Thông tin quán */}
            {step===0 && (
              <motion.div key="s0" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:6 }}>TÊN CỬA HÀNG *</label>
                  <input value={form.name} onChange={e=>update("name",e.target.value)} placeholder="VD: Bún Bò Huế Ngon..."
                    style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",color:"#f8f0e0",fontSize:13 }} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:6 }}>SỐ ĐIỆN THOẠI *</label>
                  <input value={form.phone} onChange={e=>update("phone",e.target.value)} placeholder="0901 234 567" type="tel"
                    style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",color:"#f8f0e0",fontSize:13 }} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:4 }}>
                    LOẠI HÌNH * <span style={{ color:"#4a8ff5" }}>(chọn nhiều)</span>
                  </label>
                  <div style={{ color:"#6a5a40",fontSize:8,marginBottom:8 }}>Chọn tất cả loại món quán bạn phục vụ</div>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7 }}>
                    {SHOP_CATEGORIES.map(c => {
                      const active = form.categories.includes(c.value)
                      return (
                        <button key={c.value} onClick={()=>toggleCat(c.value)}
                          style={{ background:active?c.color:"rgba(255,255,255,0.04)",
                            border:active?"1px solid rgba(255,107,0,0.4)":"1px solid rgba(255,255,255,0.08)",
                            borderRadius:12,padding:"10px 6px",display:"flex",flexDirection:"column",
                            alignItems:"center",gap:5,cursor:"pointer",fontFamily:"Lexend",
                            transition:"all .15s",position:"relative" }}>
                          {active && <div style={{ position:"absolute",top:4,right:4,width:12,height:12,borderRadius:99,background:"#FF6B00",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",fontWeight:800 }}>✓</div>}
                          <span style={{ fontSize:22 }}>{c.emoji}</span>
                          <span style={{ fontSize:8,fontWeight:600,color:active?"#FF8C00":"#6a5a40",textAlign:"center",lineHeight:1.3 }}>{c.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:6 }}>MÔ TẢ (tùy chọn)</label>
                  <textarea value={form.description} onChange={e=>update("description",e.target.value)}
                    placeholder="Đặc sản, phong cách phục vụ..." rows={3}
                    style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",color:"#f8f0e0",fontSize:12,resize:"none",fontFamily:"Lexend" }} />
                </div>
                <div style={{ background:"rgba(74,143,245,0.07)",border:"1px solid rgba(74,143,245,0.2)",borderRadius:12,padding:"12px 14px" }}>
                  <div style={{ color:"#4a8ff5",fontSize:10,fontWeight:700,marginBottom:4 }}>ℹ️ Hoa hồng DakGo</div>
                  <div style={{ color:"#6a5a40",fontSize:9,lineHeight:1.7 }}>Thu <strong style={{ color:"#b0956a" }}>15% hoa hồng</strong> trên mỗi đơn. Không phí đăng ký. Thanh toán cuối tháng.</div>
                </div>
              </motion.div>
            )}

            {/* Bước 1: Địa điểm & giờ */}
            {step===1 && (
              <motion.div key="s1" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:6 }}>ĐỊA CHỈ CỬA HÀNG *</label>
                  <button onClick={() => setShowLocationPicker(true)}
                    style={{ width:"100%",textAlign:"left",background:"rgba(255,255,255,0.04)",
                      border:`1px solid ${form.lat ? "rgba(62,207,110,0.3)" : "rgba(255,107,0,0.3)"}`,
                      borderRadius:12,padding:"12px 14px",color:form.address?"#f8f0e0":"#6a5a40",
                      fontSize:12,marginBottom:4,cursor:"pointer",fontFamily:"Lexend",
                      display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:14 }}>📍</span>
                    <span style={{ flex:1 }}>{form.address || "Chọn vị trí quán trên bản đồ"}</span>
                  </button>
                  <div style={{ color: form.lat ? "#3ecf6e" : "#FF8C00",fontSize:8 }}>
                    {form.lat ? "✓ Đã xác định vị trí trên bản đồ" : "⚠️ Bắt buộc chọn đúng vị trí — tài xế sẽ dựa vào đây để tới lấy hàng"}
                  </div>
                </div>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:12 }}>
                  <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700,marginBottom:12 }}>🕐 Giờ mở cửa</div>
                  <div style={{ display:"flex",gap:5,marginBottom:12,flexWrap:"wrap" }}>
                    {ALL_DAYS.map(d => (
                      <button key={d} onClick={()=>toggleDay(d)}
                        style={{ width:36,height:36,borderRadius:9,
                          background:form.days.includes(d)?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                          border:form.days.includes(d)?"1px solid rgba(255,107,0,0.35)":"1px solid rgba(255,255,255,0.06)",
                          color:form.days.includes(d)?"#FF8C00":"#6a5a40",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"Lexend" }}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#6a5a40",fontSize:8,marginBottom:4 }}>Mở cửa</div>
                      <input type="time" value={form.openTime} onChange={e=>update("openTime",e.target.value)}
                        style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 10px",color:"#f8f0e0",fontSize:12,colorScheme:"dark" }} />
                    </div>
                    <div style={{ color:"#6a5a40",fontSize:12,marginTop:14 }}>→</div>
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#6a5a40",fontSize:8,marginBottom:4 }}>Đóng cửa</div>
                      <input type="time" value={form.closeTime} onChange={e=>update("closeTime",e.target.value)}
                        style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 10px",color:"#f8f0e0",fontSize:12,colorScheme:"dark" }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bước 2: Tạo tài khoản */}
            {step===2 && (
              <motion.div key="s2" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div style={{ background:"rgba(255,107,0,0.06)",border:"1px solid rgba(255,107,0,0.2)",borderRadius:14,padding:"14px 16px",marginBottom:16 }}>
                  <div style={{ color:"#FF8C00",fontSize:11,fontWeight:700,marginBottom:4 }}>🔐 Tạo tài khoản đăng nhập</div>
                  <div style={{ color:"#6a5a40",fontSize:9,lineHeight:1.7 }}>Email và mật khẩu để bạn đăng nhập quản lý cửa hàng sau khi được duyệt.</div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:6 }}>EMAIL *</label>
                  <input value={form.email} onChange={e=>update("email",e.target.value)}
                    placeholder="email@example.com" type="email" autoComplete="email"
                    style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",color:"#f8f0e0",fontSize:13 }} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:6 }}>MẬT KHẨU * <span style={{ color:"#4a5040" }}>(tối thiểu 6 ký tự)</span></label>
                  <input value={form.password} onChange={e=>update("password",e.target.value)}
                    placeholder="••••••••" type="password" autoComplete="new-password"
                    style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${form.password && form.password.length < 6 ? "rgba(255,96,96,0.4)" : "rgba(255,255,255,0.08)"}`,borderRadius:12,padding:"12px 14px",color:"#f8f0e0",fontSize:13 }} />
                  {form.password.length > 0 && form.password.length < 6 && (
                    <div style={{ color:"#ff6060",fontSize:8,marginTop:4 }}>Mật khẩu phải có ít nhất 6 ký tự</div>
                  )}
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#6a5a40",fontSize:9,fontWeight:600,display:"block",marginBottom:6 }}>XÁC NHẬN MẬT KHẨU *</label>
                  <input value={form.confirmPassword} onChange={e=>update("confirmPassword",e.target.value)}
                    placeholder="••••••••" type="password" autoComplete="new-password"
                    style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${form.confirmPassword && form.confirmPassword !== form.password ? "rgba(255,96,96,0.4)" : "rgba(255,255,255,0.08)"}`,borderRadius:12,padding:"12px 14px",color:"#f8f0e0",fontSize:13 }} />
                  {form.confirmPassword && form.confirmPassword !== form.password && (
                    <div style={{ color:"#ff6060",fontSize:8,marginTop:4 }}>Mật khẩu không khớp</div>
                  )}
                  {form.confirmPassword && form.confirmPassword === form.password && form.password.length >= 6 && (
                    <div style={{ color:"#3ecf6e",fontSize:8,marginTop:4 }}>✓ Mật khẩu khớp</div>
                  )}
                </div>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px 12px" }}>
                  <div style={{ color:"#6a5a40",fontSize:8,lineHeight:1.8 }}>
                    Đã có tài khoản? <a href="/merchant/login" style={{ color:"#FF8C00",textDecoration:"none" }}>Đăng nhập tại đây</a>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bước 3: Xác nhận */}
            {step===3 && (
              <motion.div key="s3" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:800,marginBottom:4 }}>Xem lại thông tin</div>
                <div style={{ color:"#6a5a40",fontSize:10,marginBottom:16 }}>Kiểm tra trước khi gửi đăng ký</div>
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:16,marginBottom:12 }}>
                  <div style={{ display:"flex",gap:12,alignItems:"center",marginBottom:16 }}>
                    <div style={{ width:56,height:56,borderRadius:14,background:"rgba(255,107,0,0.1)",border:"1px solid rgba(255,107,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28 }}>
                      {SHOP_CATEGORIES.find(c=>c.value===form.categories[0])?.emoji ?? "🏪"}
                    </div>
                    <div>
                      <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:800 }}>{form.name || "Tên cửa hàng"}</div>
                      <div style={{ color:"#6a5a40",fontSize:9,marginTop:2 }}>{form.categories.map(v=>SHOP_CATEGORIES.find(c=>c.value===v)?.label).join(", ")}</div>
                    </div>
                  </div>
                  {[
                    ["Số ĐT",     form.phone],
                    ["Địa chỉ",   form.address || "Chưa nhập"],
                    ["Giờ mở",    `${form.openTime} – ${form.closeTime}`],
                    ["Ngày mở",   form.days.join(", ") || "Chưa chọn"],
                    ["Email",     form.email],
                  ].map(([k,v]) => (
                    <div key={k} style={{ display:"flex",justifyContent:"space-between",gap:12,marginBottom:8,paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ color:"#6a5a40",fontSize:9,flexShrink:0 }}>{k}</span>
                      <span style={{ color:"#b0956a",fontSize:9,fontWeight:600,textAlign:"right" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:"rgba(255,107,0,0.05)",border:"1px solid rgba(255,107,0,0.15)",borderRadius:12,padding:12 }}>
                  <div style={{ color:"#6a5a40",fontSize:9,lineHeight:1.8 }}>
                    Bằng cách gửi, bạn đồng ý với <span style={{ color:"#FF8C00" }}>Điều khoản dịch vụ</span> và <span style={{ color:"#FF8C00" }}>Chính sách hoa hồng 15%</span> của DakGo.
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* CTA */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(8,8,6,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.07)",padding:"12px 16px 28px",zIndex:10 }}>
          {submitError && (
            <div style={{ color:"#ff6060",fontSize:10,textAlign:"center",marginBottom:8,lineHeight:1.5 }}>{submitError}</div>
          )}
          <button disabled={!canNext() || submitting}
            onClick={() => step < STEPS.length-1 ? setStep(s=>s+1) : handleSubmit()}
            style={{ width:"100%",height:52,borderRadius:14,
              background: canNext()&&!submitting ? "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)" : "rgba(255,255,255,0.06)",
              border:"none", cursor: canNext()&&!submitting ? "pointer" : "not-allowed",
              color: canNext()&&!submitting ? "#fff" : "#6a5a40",
              fontSize:14, fontWeight:800, fontFamily:"Lexend",
              boxShadow: canNext()&&!submitting ? "0 4px 24px rgba(255,107,0,0.45)" : "none",
              transition:"all .2s" }}>
            {submitting ? "⏳ Đang gửi..." : step < STEPS.length-1 ? "Tiếp tục →" : "✅ Gửi đăng ký"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showLocationPicker && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:"fixed",inset:0,zIndex:300 }}>
            <AddressPicker
              height="100dvh"
              initialLat={form.lat ?? undefined}
              initialLng={form.lng ?? undefined}
              onClose={() => setShowLocationPicker(false)}
              onConfirm={(result: AddressPickerResult) => {
                setForm(f => ({ ...f, address: result.address, lat: result.lat, lng: result.lng }))
                setShowLocationPicker(false)
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
