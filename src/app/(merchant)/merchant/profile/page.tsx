"use client"

import { useState } from "react"
import Link from "next/link"

const SHOP = {
  name:        "Bún Bò Huế Ngon",
  category:    "🍜 Bún / Phở",
  phone:       "0901234567",
  address:     "22 Lê Hồng Phong, Phước An, Krông Pắc",
  openTime:    "06:30",
  closeTime:   "21:00",
  days:        ["T2","T3","T4","T5","T6","T7","CN"] as string[],
  rating:      4.8,
  totalReview: 124,
  joined:      "01/02/2024",
  commission:  15,
  isOpen:      true,
}

const ALL_DAYS    = ["T2","T3","T4","T5","T6","T7","CN"]
const AVATAR_LIST = ["🍜","🍗","🍕","🥗","🍱","🥤","🧁","🍛","🥩","🦐","🍔","🌮"]

type ToastType = "success" | "error" | "info"
interface Toast { id: number; msg: string; type: ToastType }
interface FormErrors { name: string; phone: string; address: string }

export default function MerchantProfilePage() {
  // Core state
  const [isOpen, setIsOpen]         = useState(SHOP.isOpen)
  const [editing, setEditing]       = useState(false)
  const [name, setName]             = useState(SHOP.name)
  const [phone, setPhone]           = useState(SHOP.phone)
  const [address, setAddress]       = useState(SHOP.address)
  const [openTime, setOpenTime]     = useState(SHOP.openTime)
  const [closeTime, setCloseTime]   = useState(SHOP.closeTime)
  const [days, setDays]             = useState<string[]>(SHOP.days)
  const [avatar, setAvatar]         = useState("🍜")

  // UI state
  const [showAvatarPicker, setShowAvatarPicker]   = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showPwSheet, setShowPwSheet]             = useState(false)
  const [toasts, setToasts]   = useState<Toast[]>([])
  const [errors, setErrors]   = useState<FormErrors>({ name:"", phone:"", address:"" })

  // Password change state
  const [pwStep, setPwStep]   = useState<1|2|3>(1)
  const [pwOld, setPwOld]     = useState("")
  const [pwNew, setPwNew]     = useState("")
  const [pwCfm, setPwCfm]     = useState("")
  const [pwErr, setPwErr]     = useState("")
  const [pwLoading, setPwLoading] = useState(false)

  // ── Helpers ──────────────────────────────────────────────────────
  const addToast = (msg: string, type: ToastType = "success") => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }

  const clearError = (key: keyof FormErrors) =>
    setErrors(e => ({ ...e, [key]: "" }))

  const toggleDay = (d: string) =>
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  // ── Handlers ──────────────────────────────────────────────────────
  const handleToggleOpen = () => {
    const next = !isOpen
    setIsOpen(next)
    // TODO: await supabase.from("shops").update({ is_open: next }).eq("id", shopId)
    addToast(next ? "🟢 Cửa hàng đang mở cửa" : "🔴 Cửa hàng đã đóng cửa", next ? "success" : "info")
  }

  const handleStartEdit = () => {
    setErrors({ name:"", phone:"", address:"" })
    setEditing(true)
  }

  const handleSave = () => {
    const next: FormErrors = { name:"", phone:"", address:"" }
    let valid = true
    if (!name.trim())    { next.name    = "Không được để trống"; valid = false }
    if (!phone.trim())   { next.phone   = "Không được để trống"; valid = false }
    if (!address.trim()) { next.address = "Không được để trống"; valid = false }
    setErrors(next)
    if (!valid) { addToast("❌ Vui lòng điền đầy đủ thông tin", "error"); return }

    // TODO: await supabase.from("shops").update({ name, phone, address, opening_hours: { days, openTime, closeTime } }).eq("id", shopId)
    setEditing(false)
    addToast("✅ Đã lưu thông tin cửa hàng")
  }

  const handleLogout = () => {
    // TODO: await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const openPwSheet = () => {
    setPwStep(1); setPwOld(""); setPwNew(""); setPwCfm(""); setPwErr("")
    setShowPwSheet(true)
  }

  const handlePwNext = async () => {
    setPwErr("")
    if (pwStep === 1) {
      if (!pwOld.trim()) { setPwErr("Vui lòng nhập mật khẩu hiện tại"); return }
      // TODO: verify old password via supabase.auth.signInWithPassword
      setPwStep(2)
    } else if (pwStep === 2) {
      if (pwNew.length < 6) { setPwErr("Mật khẩu mới phải ít nhất 6 ký tự"); return }
      if (pwNew === pwOld)   { setPwErr("Mật khẩu mới phải khác mật khẩu cũ"); return }
      setPwStep(3)
    } else {
      if (pwCfm !== pwNew) { setPwErr("Mật khẩu xác nhận không khớp"); return }
      setPwLoading(true)
      try {
        // TODO: await supabase.auth.updateUser({ password: pwNew })
        await new Promise(r => setTimeout(r, 800)) // simulate API
        setShowPwSheet(false)
        addToast("✅ Đã đổi mật khẩu thành công")
      } catch {
        setPwErr("Có lỗi xảy ra, vui lòng thử lại")
      } finally {
        setPwLoading(false)
      }
    }
  }

  // ── Toast color helpers ───────────────────────────────────────────
  const toastBg  = (t: ToastType) => t === "success" ? "rgba(62,207,110,0.15)"  : t === "error" ? "rgba(255,64,64,0.15)"  : "rgba(74,143,245,0.15)"
  const toastBdr = (t: ToastType) => t === "success" ? "rgba(62,207,110,0.4)"   : t === "error" ? "rgba(255,64,64,0.4)"   : "rgba(74,143,245,0.4)"
  const toastClr = (t: ToastType) => t === "success" ? "#3ecf6e"                : t === "error" ? "#ff4040"               : "#4a8ff5"

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806}
        input{outline:none}
        input[type="time"]::-webkit-calendar-picker-indicator{filter:invert(1);opacity:0.5;cursor:pointer}
      `}</style>

      {/* ── Toast stack ────────────────────────────────────────────── */}
      <div style={{ position:"fixed",top:60,left:16,right:16,zIndex:200,
        display:"flex",flexDirection:"column",gap:8,pointerEvents:"none" }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background:toastBg(t.type), border:`1px solid ${toastBdr(t.type)}`,
            borderRadius:12, padding:"10px 14px",
            color:toastClr(t.type), fontSize:12, fontWeight:600,
            backdropFilter:"blur(8px)",
          }}>{t.msg}</div>
        ))}
      </div>

      <div style={{ position:"fixed",inset:0,background:"#080806",
        display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ padding:"52px 16px 16px",
          borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <Link href="/merchant" style={{ width:36,height:36,borderRadius:10,
              background:"rgba(255,255,255,0.06)",
              display:"flex",alignItems:"center",justifyContent:"center",
              textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</Link>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Hồ sơ cửa hàng</div>
            </div>
            <button onClick={editing ? handleSave : handleStartEdit}
              style={{ background:editing?"rgba(255,107,0,0.1)":"rgba(255,255,255,0.06)",
                border:editing?"1px solid rgba(255,107,0,0.3)":"1px solid rgba(255,255,255,0.08)",
                borderRadius:10, padding:"6px 14px",
                color:editing?"#FF8C00":"#b0956a",
                fontSize:10, fontWeight:700, cursor:"pointer" }}>
              {editing ? "💾 Lưu" : "✏️ Sửa"}
            </button>
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"16px 16px 40px" }}>

          {/* ── Avatar + stats ─────────────────────────────────────── */}
          <div style={{ textAlign:"center",marginBottom:20 }}>
            <div style={{ position:"relative",display:"inline-block",marginBottom:14 }}>
              {/* Avatar — clickable in edit mode */}
              <div onClick={() => editing && setShowAvatarPicker(true)}
                style={{ width:88,height:88,borderRadius:24,
                  background:"linear-gradient(135deg,rgba(255,107,0,0.2),rgba(255,107,0,0.05))",
                  border:`2px solid ${editing ? "rgba(255,107,0,0.55)" : "rgba(255,107,0,0.3)"}`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:42,
                  cursor:editing ? "pointer" : "default",
                  position:"relative",overflow:"hidden" }}>
                {avatar}
                {editing && (
                  <div style={{ position:"absolute",bottom:0,left:0,right:0,
                    background:"rgba(0,0,0,0.55)",fontSize:9,color:"#fff",
                    padding:"3px 0",fontWeight:600,textAlign:"center" }}>Đổi</div>
                )}
              </div>
              {/* Online dot */}
              <div style={{ position:"absolute",bottom:-4,right:-4,
                width:22,height:22,borderRadius:7,
                background:isOpen ? "#3ecf6e" : "#6a5a40",
                border:"3px solid #080806" }} />
            </div>

            <div style={{ color:"#f8f0e0",fontSize:17,fontWeight:800,marginBottom:4 }}>{name}</div>
            <div style={{ color:"#6a5a40",fontSize:10,marginBottom:10 }}>{SHOP.category}</div>

            {/* Stats row */}
            <div style={{ display:"flex",justifyContent:"center",gap:16,marginBottom:14 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#FF8C00",fontSize:14,fontWeight:700 }}>⭐ {SHOP.rating}</div>
                <div style={{ color:"#6a5a40",fontSize:10 }}>Điểm sao</div>
              </div>
              <div style={{ width:1,background:"rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>{SHOP.totalReview}</div>
                <div style={{ color:"#6a5a40",fontSize:10 }}>Lượt đánh giá</div>
              </div>
              <div style={{ width:1,background:"rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>{SHOP.commission}%</div>
                <div style={{ color:"#6a5a40",fontSize:10 }}>Hoa hồng</div>
              </div>
            </div>

            {/* Open/close toggle */}
            <button onClick={handleToggleOpen}
              style={{ background:isOpen ? "rgba(62,207,110,0.1)" : "rgba(255,255,255,0.06)",
                border:isOpen ? "1px solid rgba(62,207,110,0.3)" : "1px solid rgba(255,255,255,0.1)",
                borderRadius:10, padding:"8px 20px",
                color:isOpen ? "#3ecf6e" : "#6a5a40",
                fontSize:11, fontWeight:700, cursor:"pointer" }}>
              {isOpen ? "🟢 Đang mở cửa" : "🔴 Đang đóng cửa"}
            </button>
          </div>

          {/* ── Shop info form ─────────────────────────────────────── */}
          <div style={{ background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14, padding:14, marginBottom:10 }}>
            <div style={{ color:"#6a5a40",fontSize:10,fontWeight:600,marginBottom:12 }}>
              THÔNG TIN CỬA HÀNG
            </div>

            {([
              { label:"Tên cửa hàng",  value:name,    key:"name"    as const, setter: setName    },
              { label:"Số điện thoại", value:phone,   key:"phone"   as const, setter: setPhone   },
              { label:"Địa chỉ",       value:address, key:"address" as const, setter: setAddress },
              { label:"Ngày tham gia", value:SHOP.joined, key: null, setter: null },
            ] as Array<{ label:string; value:string; key: keyof FormErrors | null; setter: ((v:string) => void) | null }>)
              .map(({ label, value, key, setter }, idx, arr) => {
                const isLast   = idx === arr.length - 1
                const hasError = key ? errors[key] : ""
                return (
                  <div key={label} style={{ marginBottom: isLast ? 0 : 10 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",
                      alignItems:"center",
                      paddingBottom: isLast ? 0 : 10,
                      borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ color:"#6a5a40",fontSize:10,flexShrink:0,marginRight:8 }}>{label}</span>
                      {editing && setter && key ? (
                        <input value={value}
                          onChange={e => { setter(e.target.value); clearError(key) }}
                          style={{ background:"rgba(255,255,255,0.06)",
                            border:`1px solid ${hasError ? "rgba(255,64,64,0.5)" : "rgba(255,107,0,0.3)"}`,
                            borderRadius:8, padding:"4px 10px",
                            color:"#f8f0e0", fontSize:10, textAlign:"right",
                            maxWidth:200, width:"100%" }} />
                      ) : (
                        <span style={{ color:"#f8f0e0",fontSize:10,fontWeight:600,
                          textAlign:"right",maxWidth:200 }}>{value}</span>
                      )}
                    </div>
                    {hasError && (
                      <div style={{ color:"#ff4040",fontSize:9,textAlign:"right",marginTop:3 }}>
                        {hasError}
                      </div>
                    )}
                  </div>
                )
              })
            }
          </div>

          {/* ── Opening hours ──────────────────────────────────────── */}
          <div style={{ background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14, padding:14, marginBottom:10 }}>
            <div style={{ color:"#6a5a40",fontSize:10,fontWeight:600,marginBottom:12 }}>
              GIỜ MỞ CỬA {editing && <span style={{ color:"#FF8C00",fontSize:9,fontWeight:500 }}>— nhấn ngày để bật/tắt</span>}
            </div>

            {/* Day chips */}
            <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:10 }}>
              {ALL_DAYS.map(d => (
                <button key={d} onClick={editing ? () => toggleDay(d) : undefined}
                  style={{ width:34,height:34,borderRadius:8,
                    background:days.includes(d) ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                    border:days.includes(d) ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.06)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    color:days.includes(d) ? "#FF8C00" : "#6a5a40",
                    fontSize:10, fontWeight:700,
                    cursor:editing ? "pointer" : "default" }}>
                  {d}
                </button>
              ))}
            </div>

            {/* Time range */}
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <span style={{ color:"#6a5a40",fontSize:10 }}>Giờ:</span>
              {editing ? (
                <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                  <input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)}
                    style={{ background:"rgba(255,255,255,0.06)",
                      border:"1px solid rgba(255,107,0,0.3)",borderRadius:8,
                      padding:"3px 8px",color:"#f8f0e0",fontSize:11,fontWeight:700,
                      colorScheme:"dark" } as React.CSSProperties} />
                  <span style={{ color:"#6a5a40" }}>–</span>
                  <input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)}
                    style={{ background:"rgba(255,255,255,0.06)",
                      border:"1px solid rgba(255,107,0,0.3)",borderRadius:8,
                      padding:"3px 8px",color:"#f8f0e0",fontSize:11,fontWeight:700,
                      colorScheme:"dark" } as React.CSSProperties} />
                </div>
              ) : (
                <span style={{ color:"#f8f0e0",fontSize:11,fontWeight:700 }}>
                  {openTime} – {closeTime}
                </span>
              )}
            </div>
          </div>

          {/* ── Quick links ────────────────────────────────────────── */}
          {[
            { icon:"🍜", label:"Quản lý menu",     sub:"Thêm, sửa, xóa món",    href:"/merchant/menu" },
            { icon:"👁",  label:"Xem trước cửa hàng", sub:"Khách nhìn thấy thế này", href:"/merchant/shop-preview" },
            { icon:"📊", label:"Doanh thu",         sub:"Xem báo cáo & thống kê",  href:"/merchant/revenue" },
          ].map(({ icon, label, sub, href }) => (
            <Link key={label} href={href}
              style={{ display:"flex",alignItems:"center",gap:12,
                background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:14, padding:14, marginBottom:8, textDecoration:"none" }}>
              <div style={{ width:40,height:40,borderRadius:11,
                background:"rgba(255,107,0,0.1)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>
                {icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:600 }}>{label}</div>
                <div style={{ color:"#6a5a40",fontSize:10,marginTop:2 }}>{sub}</div>
              </div>
              <span style={{ color:"#6a5a40",fontSize:16 }}>›</span>
            </Link>
          ))}

          {/* Password change button */}
          <button onClick={openPwSheet}
            style={{ width:"100%",display:"flex",alignItems:"center",gap:12,
              background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:14, padding:14, marginBottom:8, textAlign:"left", cursor:"pointer" }}>
            <div style={{ width:40,height:40,borderRadius:11,
              background:"rgba(74,143,245,0.1)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>🔑</div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:600 }}>Đổi mật khẩu</div>
              <div style={{ color:"#6a5a40",fontSize:10,marginTop:2 }}>Cập nhật mật khẩu tài khoản</div>
            </div>
            <span style={{ color:"#6a5a40",fontSize:16 }}>›</span>
          </button>

          {/* Logout */}
          <button onClick={() => setShowLogoutConfirm(true)}
            style={{ width:"100%",height:48,borderRadius:14,
              background:"rgba(255,64,64,0.08)",border:"1px solid rgba(255,64,64,0.2)",
              color:"#ff4040",fontSize:12,fontWeight:700,cursor:"pointer",marginTop:8 }}>
            🚪 Đăng xuất
          </button>
        </div>

        {/* ── Avatar picker sheet ────────────────────────────────── */}
        {showAvatarPicker && (
          <>
            <div onClick={() => setShowAvatarPicker(false)}
              style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",
                zIndex:50,backdropFilter:"blur(4px)" }} />
            <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"#0e0c09",
              borderRadius:"20px 20px 0 0",border:"1px solid rgba(255,255,255,0.08)",
              padding:"20px 16px 32px",zIndex:51 }}>
              <div style={{ display:"flex",justifyContent:"space-between",
                alignItems:"center",marginBottom:14 }}>
                <div style={{ color:"#f8f0e0",fontSize:13,fontWeight:800 }}>Chọn icon cửa hàng</div>
                <button onClick={() => setShowAvatarPicker(false)}
                  style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.06)",
                    border:"none",color:"#6a5a40",fontSize:16,cursor:"pointer" }}>×</button>
              </div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center" }}>
                {AVATAR_LIST.map(e => (
                  <button key={e} onClick={() => { setAvatar(e); setShowAvatarPicker(false) }}
                    style={{ width:52,height:52,borderRadius:12,
                      background:avatar === e ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                      border:avatar === e ? "1px solid rgba(255,107,0,0.4)" : "1px solid rgba(255,255,255,0.06)",
                      fontSize:26,cursor:"pointer" }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Logout confirm sheet ───────────────────────────────── */}
        {showLogoutConfirm && (
          <>
            <div onClick={() => setShowLogoutConfirm(false)}
              style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",
                zIndex:50,backdropFilter:"blur(4px)" }} />
            <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"#0e0c09",
              borderRadius:"20px 20px 0 0",border:"1px solid rgba(255,255,255,0.08)",
              padding:"24px 16px 36px",zIndex:51 }}>
              <div style={{ textAlign:"center",marginBottom:20 }}>
                <div style={{ fontSize:36,marginBottom:10 }}>🚪</div>
                <div style={{ color:"#f8f0e0",fontSize:15,fontWeight:800,marginBottom:6 }}>Đăng xuất?</div>
                <div style={{ color:"#6a5a40",fontSize:11 }}>Bạn sẽ cần đăng nhập lại để tiếp tục.</div>
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={() => setShowLogoutConfirm(false)}
                  style={{ flex:1,height:48,borderRadius:12,
                    background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",
                    color:"#b0956a",fontSize:12,fontWeight:700,cursor:"pointer" }}>Hủy</button>
                <button onClick={handleLogout}
                  style={{ flex:1,height:48,borderRadius:12,
                    background:"rgba(255,64,64,0.12)",border:"1px solid rgba(255,64,64,0.3)",
                    color:"#ff4040",fontSize:12,fontWeight:700,cursor:"pointer" }}>
                  🚪 Đăng xuất
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Password change sheet ──────────────────────────────── */}
        {showPwSheet && (
          <>
            <div onClick={() => setShowPwSheet(false)}
              style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
                zIndex:50,backdropFilter:"blur(4px)" }} />
            <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"#0e0c09",
              borderRadius:"22px 22px 0 0",border:"1px solid rgba(74,143,245,0.2)",
              padding:"20px 18px 36px",zIndex:51 }}>

              {/* Drag handle */}
              <div style={{ width:36,height:4,background:"rgba(255,255,255,0.12)",borderRadius:2,margin:"0 auto 16px" }} />

              {/* Step indicators */}
              <div style={{ display:"flex",alignItems:"center",gap:6,justifyContent:"center",marginBottom:18 }}>
                {([1,2,3] as const).map(s => (
                  <div key={s} style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <div style={{ width:26,height:26,borderRadius:13,
                      background:pwStep >= s ? "rgba(74,143,245,0.2)" : "rgba(255,255,255,0.05)",
                      border:`1px solid ${pwStep >= s ? "rgba(74,143,245,0.5)" : "rgba(255,255,255,0.08)"}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      color:pwStep >= s ? "#4a8ff5" : "#6a5a40",fontSize:10,fontWeight:700 }}>
                      {pwStep > s ? "✓" : s}
                    </div>
                    {s < 3 && <div style={{ width:20,height:1,background:pwStep > s ? "rgba(74,143,245,0.4)" : "rgba(255,255,255,0.08)" }} />}
                  </div>
                ))}
              </div>

              {/* Step title */}
              <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:800,marginBottom:4,textAlign:"center" }}>
                {pwStep === 1 ? "🔑 Xác nhận mật khẩu cũ" : pwStep === 2 ? "🆕 Nhập mật khẩu mới" : "✅ Xác nhận mật khẩu mới"}
              </div>
              <div style={{ color:"#6a5a40",fontSize:10,textAlign:"center",marginBottom:20 }}>
                {pwStep === 1 ? "Nhập mật khẩu hiện tại của bạn" : pwStep === 2 ? "Ít nhất 6 ký tự, khác mật khẩu cũ" : "Nhập lại mật khẩu mới để xác nhận"}
              </div>

              {/* Input */}
              <input
                type="password"
                value={pwStep === 1 ? pwOld : pwStep === 2 ? pwNew : pwCfm}
                onChange={e => {
                  setPwErr("")
                  if (pwStep === 1) setPwOld(e.target.value)
                  else if (pwStep === 2) setPwNew(e.target.value)
                  else setPwCfm(e.target.value)
                }}
                placeholder={pwStep === 1 ? "Mật khẩu hiện tại" : pwStep === 2 ? "Mật khẩu mới" : "Nhập lại mật khẩu mới"}
                style={{ width:"100%",background:"rgba(255,255,255,0.05)",
                  border:`1px solid ${pwErr ? "rgba(255,64,64,0.5)" : "rgba(74,143,245,0.3)"}`,
                  borderRadius:12,padding:"12px 14px",color:"#f8f0e0",fontSize:14,
                  fontFamily:"Lexend",marginBottom:6,boxSizing:"border-box" }} />

              {pwErr && (
                <div style={{ color:"#ff4040",fontSize:10,marginBottom:10,textAlign:"center" }}>⚠ {pwErr}</div>
              )}

              <div style={{ display:"flex",gap:8,marginTop:8 }}>
                <button onClick={() => { if (pwStep > 1) setPwStep(s => (s - 1) as 1|2|3); else setShowPwSheet(false) }}
                  style={{ flex:1,height:46,borderRadius:12,
                    background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                    color:"#b0956a",fontSize:12,fontWeight:700,cursor:"pointer" }}>
                  {pwStep === 1 ? "Huỷ" : "← Quay lại"}
                </button>
                <button onClick={handlePwNext} disabled={pwLoading}
                  style={{ flex:2,height:46,borderRadius:12,border:"none",
                    background:"linear-gradient(90deg,#4a8ff5,#6a9ff5)",
                    color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",
                    opacity:pwLoading?0.7:1 }}>
                  {pwLoading ? "Đang xử lý..." : pwStep === 3 ? "🔐 Đổi mật khẩu" : "Tiếp theo →"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
