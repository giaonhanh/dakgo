"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Tab      = "login" | "register"
type RegStep  = "role" | "form"
type RoleKey  = "customer" | "driver_moto" | "driver_taxi" | "merchant"

const VN_PHONE = /^0[3-9][0-9]{8}$/

function phoneToEmail(phone: string) {
  return `${phone.replace(/\s/g, "")}@giaonhanh.local`
}

const ROLES = [
  { key: "customer",    icon: "👤", label: "Khách hàng",    sub: "Đặt đồ ăn, gọi xe, mua hộ",      color: "#FF8C00", bg: "rgba(255,107,0,0.10)",  bd: "rgba(255,107,0,0.30)"  },
  { key: "driver_moto", icon: "🛵", label: "Tài xế Xe ôm",  sub: "Giao hàng & đưa đón bằng xe máy", color: "#3ecf6e", bg: "rgba(62,207,110,0.10)", bd: "rgba(62,207,110,0.30)" },
  { key: "driver_taxi", icon: "🚕", label: "Tài xế Taxi",   sub: "Đưa đón khách bằng ô tô",         color: "#4a8ff5", bg: "rgba(74,143,245,0.10)", bd: "rgba(74,143,245,0.30)" },
  { key: "merchant",   icon: "🏪", label: "Chủ cửa hàng",  sub: "Bán hàng, nhận đơn qua app",      color: "#b464ff", bg: "rgba(180,100,255,0.10)", bd: "rgba(180,100,255,0.30)" },
] as const

// ── Reusable Input ─────────────────────────────────────────
function Field({ label, icon, type = "text", placeholder, value, onChange, focused, onFocus, onBlur, suffix }: {
  label: string; icon: string; type?: string; placeholder: string
  value: string; onChange: (v: string) => void
  focused: boolean; onFocus: () => void; onBlur: () => void
  suffix?: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ color: "rgba(176,149,106,0.55)", fontSize: 11, display: "block", marginBottom: 4 }}>{label}</label>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${focused ? "rgba(255,107,0,0.55)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 12, padding: "0 12px", height: 44,
        transition: "all 0.2s",
        boxShadow: focused ? "0 0 0 3px rgba(255,107,0,0.09)" : "none",
      }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
        <input
          type={type} value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={onFocus} onBlur={onBlur}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "#f8f0e0", fontSize: 12.5, fontFamily: "Lexend",
          }}
        />
        {suffix}
      </div>
    </div>
  )
}

// ── CTA Button ─────────────────────────────────────────────
function CTABtn({ label, onClick, loading }: { label: string; onClick?: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%", height: 48, borderRadius: 13, border: "none", marginBottom: 10,
        background: "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
        color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "Lexend",
        cursor: loading ? "not-allowed" : "pointer",
        position: "relative", overflow: "hidden",
        boxShadow: "0 4px 18px rgba(255,107,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: loading ? 0.7 : 1,
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
        background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)",
        animation: "shimmer 2.5s infinite", pointerEvents: "none",
      }} />
      <span style={{ position: "relative", zIndex: 1 }}>{loading ? "Đang xử lý..." : label}</span>
    </button>
  )
}

// ── Footer link ────────────────────────────────────────────
function FooterLink({ q, a, onClick }: { q: string; a: string; onClick: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "rgba(106,90,64,0.6)", fontSize: 11 }}>{q}</span>
      <button onClick={onClick} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "#FF8C00", fontSize: 11, fontWeight: 600, fontFamily: "Lexend",
      }}>{a}</button>
    </div>
  )
}

// ── Upload placeholder ─────────────────────────────────────
function UploadBox({ label }: { label: string }) {
  return (
    <div style={{
      marginBottom: 10, border: "1px dashed rgba(255,255,255,0.09)",
      borderRadius: 10, padding: "9px 12px", cursor: "pointer",
      background: "rgba(255,255,255,0.02)",
      display: "flex", alignItems: "center", gap: 7,
    }}>
      <span style={{ fontSize: 14 }}>📎</span>
      <span style={{ color: "rgba(176,149,106,0.4)", fontSize: 11 }}>{label}</span>
    </div>
  )
}

// ── Chip selector ──────────────────────────────────────────
function ChipGroup({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ color: "rgba(176,149,106,0.55)", fontSize: 11, display: "block", marginBottom: 5 }}>{label}</label>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {options.map(o => (
          <div key={o} onClick={() => onChange(o)} style={{
            padding: "5px 11px", borderRadius: 8, cursor: "pointer",
            background: value === o ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${value === o ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.08)"}`,
            color: value === o ? "#FF8C00" : "rgba(176,149,106,0.6)",
            fontSize: 11, fontWeight: value === o ? 600 : 400,
            transition: "all 0.15s",
          }}>{o}</div>
        ))}
      </div>
    </div>
  )
}

// ── Section divider ────────────────────────────────────────
function Divider({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "12px 0 9px" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
      <span style={{ color, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.06)" }} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════
function LoginContent() {
  const params = useSearchParams()
  const supabase = createClient()

  const [phase,   setPhase]   = useState<"splash" | "auth">("splash")
  const [tab,     setTab]     = useState<Tab>("login")
  const [regStep, setRegStep] = useState<RegStep>("role")
  const [role,    setRole]    = useState<RoleKey | null>(null)

  // fields
  const [name,        setName]        = useState("")
  const [phone,       setPhone]       = useState("")
  const [password,    setPassword]    = useState("")
  const [showPass,    setShowPass]    = useState(false)
  const [plate,       setPlate]       = useState("")
  const [carModel,    setCarModel]    = useState("")
  const [shopName,    setShopName]    = useState("")
  const [shopAddr,    setShopAddr]    = useState("")
  const [vehicleType, setVehicleType] = useState("")
  const [seats,       setSeats]       = useState("")
  const [shopCat,     setShopCat]     = useState("")

  // focus
  const [fName,  setFName]  = useState(false)
  const [fPhone, setFPhone] = useState(false)
  const [fPass,  setFPass]  = useState(false)
  const [fPlate, setFPlate] = useState(false)
  const [fCar,   setFCar]   = useState(false)
  const [fShop,  setFShop]  = useState(false)
  const [fAddr,  setFAddr]  = useState(false)

  // async state
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const [success, setSuccess] = useState("")

  const submitting    = useRef(false)
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    document.cookie = "dev_role=; path=/; max-age=0"
    if (params.get("error") === "suspended") {
      setError("Tài khoản của bạn đã bị tạm khóa. Liên hệ hỗ trợ để biết thêm.")
    }
    const t = setTimeout(() => setPhase("auth"), 3000)
    return () => {
      clearTimeout(t)
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [params])

  const selectedRole = ROLES.find(r => r.key === role)
  const isDriver     = role === "driver_moto" || role === "driver_taxi"

  function switchTab(t: Tab) {
    if (redirectTimer.current) clearTimeout(redirectTimer.current)
    setTab(t); setRegStep("role"); setRole(null)
    setError(""); setSuccess("")
    setName(""); setPhone(""); setPassword("")
    setShowPass(false)
  }

  async function handleLogin() {
    if (submitting.current) return
    if (!VN_PHONE.test(phone.replace(/\s/g, ""))) { setError("Số điện thoại không hợp lệ (VD: 0987654321)"); return }
    if (!password) { setError("Vui lòng nhập mật khẩu"); return }
    submitting.current = true
    setLoading(true); setError("")
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(phone), password,
      })
      if (err || !data.user) { setError("Số điện thoại hoặc mật khẩu không đúng"); return }

      // Nếu có redirect param (vd: chia sẽ link shop) → vào thẳng đó
      const redirectTo = params.get("redirect")
      if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
        window.location.href = redirectTo
      } else {
        // Để middleware server-side đọc profile và redirect đúng dashboard
        window.location.href = "/"
      }
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  async function handleRegister() {
    if (submitting.current) return
    if (!VN_PHONE.test(phone.replace(/\s/g, ""))) { setError("Số điện thoại không hợp lệ"); return }
    if (!name.trim())        { setError("Vui lòng nhập tên của bạn"); return }
    if (password.length < 6) { setError("Mật khẩu tối thiểu 6 ký tự"); return }
    if (!role)               { setError("Vui lòng chọn vai trò"); return }

    const cleanPhone = phone.replace(/\s/g, "")

    submitting.current = true
    setLoading(true); setError("")
    try {
      // Gọi API route (service role) để tạo user + profile + driver/shop — bypass RLS và email confirmation
      const res = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          phone:       cleanPhone,
          password,
          name:        name.trim(),
          role,
          vehicleType: vehicleType || undefined,
          plate:       plate.trim() || undefined,
          carModel:    carModel.trim() || undefined,
          shopName:    shopName.trim() || undefined,
          shopAddr:    shopAddr.trim() || undefined,
          shopCat:     shopCat || undefined,
        }),
      })

      const json = await res.json() as { error?: string; success?: boolean; role?: string }

      if (!res.ok) {
        if (res.status === 409) {
          setError("Số điện thoại này đã được đăng ký. Vui lòng đăng nhập.")
        } else {
          setError("Đăng ký thất bại. Vui lòng thử lại.")
        }
        return
      }

      // Đăng nhập ngay để lấy session (user đã auto-confirm từ API)
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(cleanPhone),
        password,
      })

      if (signInErr) {
        // User đã tạo thành công nhưng sign-in thất bại — chuyển sang tab đăng nhập
        setSuccess("Tạo tài khoản thành công! Vui lòng đăng nhập.")
        redirectTimer.current = setTimeout(() => switchTab("login"), 1500)
        return
      }

      const dbRole     = json.role ?? "customer"
      const redirectTo = params.get("redirect")
      const dest = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") && dbRole === "customer"
        ? redirectTo
        : dbRole === "driver" ? "/driver" : dbRole === "merchant" ? "/merchant" : "/"
      setSuccess("Đăng ký thành công! Đang chuyển hướng...")
      redirectTimer.current = setTimeout(() => { window.location.href = dest }, 1200)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  return (
    <>
      <style>{`
                *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body { background:#080806; font-family:'Lexend',sans-serif; height:100%; overflow:hidden; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:rgba(255,107,0,0.3); border-radius:2px; }
        @keyframes goldGlow {
          0%,100% { box-shadow:0 0 20px rgba(255,107,0,.5),0 0 40px rgba(255,140,0,.3); }
          50%     { box-shadow:0 0 30px rgba(255,107,0,.8),0 0 60px rgba(255,140,0,.5); }
        }
        @keyframes logoShine { 0%{left:-80%} 100%{left:120%} }
        @keyframes shimmer   { 0%{left:-60%} 100%{left:120%} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .role-card:hover { transform:translateY(-2px); transition:all .2s; }
      `}</style>

      <div style={{
        position: "fixed", inset: 0,
        background: "linear-gradient(160deg, #0e0c09 0%, #151210 50%, #080806 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}>
        {/* Ambient glow — điểm nhấn cam nhẹ ở giữa */}
        <div style={{
          position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,107,0,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <AnimatePresence mode="wait">

          {/* ══ SPLASH ══ */}
          {phase === "splash" && (
            <motion.div key="splash"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: .95 }} transition={{ duration: .4 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 88, height: 88, borderRadius: 24,
                background: "#FF681A",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", overflow: "hidden",
                boxShadow: "0 0 0 4px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.4)",
              }}>
                <Image src="/icon-512.png" alt="Giao Nhanh" width={72} height={72} style={{ objectFit: "contain" }} priority />
                <div style={{
                  position: "absolute", top: 0, left: "-80%", width: "50%", height: "100%",
                  background: "linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)",
                  animation: "logoShine 2s ease-in-out infinite",
                }} />
              </div>
              <div style={{
                fontSize: 32, fontWeight: 800, letterSpacing: 2, color: "#fff",
                textShadow: "0 2px 12px rgba(0,0,0,0.3)",
              }}>GIAO NHANH</div>
              <div style={{ color: "rgba(176,149,106,0.9)", fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>
                Giao hàng · Mua hộ · Xe ôm · Taxi<br />tại Krông Pắc, Đắk Lắk
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[0, .2, .4].map((d, i) => (
                  <motion.div key={i}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,107,0,0.7)" }}
                    animate={{ opacity: [.3, 1, .3], scale: [.8, 1.2, .8] }}
                    transition={{ duration: 1, delay: d, repeat: Infinity }} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ══ AUTH ══ */}
          {phase === "auth" && (
            <motion.div key="auth"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .5, ease: [.34, 1.56, .64, 1] }}
              style={{
                width: "100%", maxWidth: 400, padding: "0 18px",
                display: "flex", flexDirection: "column", alignItems: "center",
                maxHeight: "100dvh", overflowY: "auto",
              }}>

              {/* Logo */}
              <motion.div
                initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: .1, type: "spring", damping: 12 }}
                style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: "#FF681A",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 10, position: "relative", overflow: "hidden",
                  boxShadow: "0 0 0 3px rgba(255,255,255,0.3), 0 6px 20px rgba(0,0,0,0.4)",
                }}>
                <Image src="/icon-512.png" alt="Giao Nhanh" width={44} height={44} style={{ objectFit: "contain" }} />
                <div style={{
                  position: "absolute", top: 0, left: "-80%", width: "50%", height: "100%",
                  background: "linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)",
                  animation: "logoShine 3s ease-in-out infinite",
                }} />
              </motion.div>

              <div style={{
                fontSize: 20, fontWeight: 800, letterSpacing: 2, marginBottom: 3,
                color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,0.25)",
              }}>GIAO NHANH</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, marginBottom: 18, textAlign: "center" }}>
                Giao hàng · Xe ôm · Taxi tại Krông Pắc
              </div>

              {/* Card */}
              <div style={{
                width: "100%",
                background: "rgba(0,0,0,0.25)",
                backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 20, padding: "18px 16px", marginBottom: 14,
              }}>
                {/* Tabs */}
                <div style={{
                  display: "flex", gap: 4, background: "rgba(255,255,255,.04)",
                  borderRadius: 12, padding: 3, marginBottom: 16,
                }}>
                  {(["login", "register"] as Tab[]).map(t => (
                    <button key={t} onClick={() => switchTab(t)} style={{
                      flex: 1, height: 32, borderRadius: 9, border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 600, fontFamily: "Lexend", transition: "all .2s",
                      background: tab === t ? "linear-gradient(135deg,#FF6B00,#FF8C00)" : "transparent",
                      color: tab === t ? "#fff" : "rgba(176,149,106,.7)",
                      boxShadow: tab === t ? "0 2px 10px rgba(255,107,0,.3)" : "none",
                    }}>{t === "login" ? "Đăng nhập" : "Đăng ký"}</button>
                  ))}
                </div>

                {/* Error / Success */}
                {error   && <p style={{ color: "#ff4040", fontSize: 11, marginBottom: 10, paddingLeft: 2 }}>{error}</p>}
                {success && <p style={{ color: "#3ecf6e", fontSize: 11, marginBottom: 10, paddingLeft: 2 }}>{success}</p>}

                <AnimatePresence mode="wait">

                  {/* ─── ĐĂNG NHẬP ─── */}
                  {tab === "login" && (
                    <motion.div key="lf"
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }} transition={{ duration: .2 }}>
                      <Field label="Số điện thoại" icon="📱" type="tel" placeholder="0901 234 567"
                        value={phone} onChange={v => { setPhone(v); setError("") }}
                        focused={fPhone} onFocus={() => setFPhone(true)} onBlur={() => setFPhone(false)} />
                      <Field label="Mật khẩu" icon="🔒" type={showPass ? "text" : "password"}
                        placeholder="••••••••" value={password} onChange={v => { setPassword(v); setError("") }}
                        focused={fPass} onFocus={() => setFPass(true)} onBlur={() => setFPass(false)}
                        suffix={
                          <button onClick={() => setShowPass(!showPass)} style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 13, color: "rgba(106,90,64,.8)", padding: 4,
                          }}>{showPass ? "🙈" : "👁️"}</button>
                        } />
                      <div style={{ textAlign: "right", marginBottom: 13 }}>
                        <button style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "rgba(255,140,0,.55)", fontSize: 11, fontFamily: "Lexend",
                        }}>Quên mật khẩu?</button>
                      </div>
                      <CTABtn label="🚀 Đăng nhập" onClick={handleLogin} loading={loading} />
                      <FooterLink q="Chưa có tài khoản?" a="Đăng ký ngay →" onClick={() => switchTab("register")} />
                    </motion.div>
                  )}

                  {/* ─── ĐĂNG KÝ: BƯỚC 1 — Chọn vai trò ─── */}
                  {tab === "register" && regStep === "role" && (
                    <motion.div key="rs"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }} transition={{ duration: .2 }}>
                      <div style={{ color: "rgba(176,149,106,.6)", fontSize: 10, textAlign: "center", marginBottom: 13 }}>
                        Bạn muốn tham gia với tư cách nào?
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                        {ROLES.map((r, i) => (
                          <div key={r.key} className="role-card"
                            onClick={() => { setRole(r.key as RoleKey); setRegStep("form") }}
                            style={{
                              background: r.bg, border: `1px solid ${r.bd.replace(".30", ".18")}`,
                              borderRadius: 13, padding: "12px 9px",
                              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                              cursor: "pointer",
                              animation: `fadeUp .3s ease ${i * .07}s both`,
                            }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 12,
                              background: r.bg, border: `1px solid ${r.bd}`,
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                            }}>{r.icon}</div>
                            <div style={{ color: r.color, fontSize: 10, fontWeight: 700, textAlign: "center" }}>{r.label}</div>
                            <div style={{ color: "rgba(176,149,106,.45)", fontSize: 10, textAlign: "center", lineHeight: 1.4 }}>{r.sub}</div>
                          </div>
                        ))}
                      </div>
                      <FooterLink q="Đã có tài khoản?" a="Đăng nhập →" onClick={() => switchTab("login")} />
                    </motion.div>
                  )}

                  {/* ─── ĐĂNG KÝ: BƯỚC 2 — Form ─── */}
                  {tab === "register" && regStep === "form" && selectedRole && (
                    <motion.div key="rf"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }} transition={{ duration: .2 }}>

                      {/* Badge vai trò */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 9, marginBottom: 14,
                        background: selectedRole.bg, border: `1px solid ${selectedRole.bd}`,
                        borderRadius: 12, padding: "9px 12px",
                      }}>
                        <span style={{ fontSize: 20 }}>{selectedRole.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: selectedRole.color, fontSize: 11, fontWeight: 700 }}>{selectedRole.label}</div>
                          <div style={{ color: "rgba(176,149,106,.45)", fontSize: 11, marginTop: 1 }}>{selectedRole.sub}</div>
                        </div>
                        <button onClick={() => setRegStep("role")} style={{
                          background: "none", border: "1px solid rgba(255,255,255,.07)",
                          cursor: "pointer", color: "rgba(176,149,106,.5)",
                          fontSize: 10, fontFamily: "Lexend", padding: "3px 8px", borderRadius: 6,
                        }}>← Đổi</button>
                      </div>

                      {/* Fields chung */}
                      <Field label="Họ và tên" icon="👤" placeholder="Nguyễn Văn A"
                        value={name} onChange={v => { setName(v); setError("") }}
                        focused={fName} onFocus={() => setFName(true)} onBlur={() => setFName(false)} />
                      <Field label="Số điện thoại" icon="📱" type="tel" placeholder="0901 234 567"
                        value={phone} onChange={v => { setPhone(v); setError("") }}
                        focused={fPhone} onFocus={() => setFPhone(true)} onBlur={() => setFPhone(false)} />
                      <Field label="Mật khẩu" icon="🔒" type={showPass ? "text" : "password"}
                        placeholder="Tối thiểu 6 ký tự" value={password} onChange={v => { setPassword(v); setError("") }}
                        focused={fPass} onFocus={() => setFPass(true)} onBlur={() => setFPass(false)}
                        suffix={
                          <button onClick={() => setShowPass(!showPass)} style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 13, color: "rgba(106,90,64,.8)", padding: 4,
                          }}>{showPass ? "🙈" : "👁️"}</button>
                        } />

                      {/* ── TÀI XẾ XE ÔM ── */}
                      {role === "driver_moto" && <>
                        <Divider label="🛵 Thông tin xe máy" color="rgba(62,207,110,.6)" />
                        <Field label="Biển số xe" icon="🔖" placeholder="47B-12345"
                          value={plate} onChange={setPlate}
                          focused={fPlate} onFocus={() => setFPlate(true)} onBlur={() => setFPlate(false)} />
                        <ChipGroup label="Loại xe" options={["Xe số", "Xe tay ga", "Xe điện"]}
                          value={vehicleType} onChange={setVehicleType} />
                        <UploadBox label="📷 Ảnh CMND + Bằng lái xe (upload sau khi đăng ký)" />
                      </>}

                      {/* ── TÀI XẾ TAXI ── */}
                      {role === "driver_taxi" && <>
                        <Divider label="🚕 Thông tin xe ô tô" color="rgba(74,143,245,.6)" />
                        <Field label="Biển số xe" icon="🔖" placeholder="47A-56789"
                          value={plate} onChange={setPlate}
                          focused={fPlate} onFocus={() => setFPlate(true)} onBlur={() => setFPlate(false)} />
                        <Field label="Dòng xe" icon="🚗" placeholder="Toyota Vios 2022"
                          value={carModel} onChange={setCarModel}
                          focused={fCar} onFocus={() => setFCar(true)} onBlur={() => setFCar(false)} />
                        <ChipGroup label="Số chỗ ngồi" options={["4 chỗ", "5 chỗ", "7 chỗ"]}
                          value={seats} onChange={setSeats} />
                        <UploadBox label="📷 CMND + Bằng lái + Đăng kiểm xe (upload sau)" />
                      </>}

                      {/* ── CHỦ CỬA HÀNG ── */}
                      {role === "merchant" && <>
                        <Divider label="🏪 Thông tin cửa hàng" color="rgba(180,100,255,.6)" />
                        <Field label="Tên cửa hàng" icon="🏪" placeholder="Quán Bún Bò Huế Ngon"
                          value={shopName} onChange={setShopName}
                          focused={fShop} onFocus={() => setFShop(true)} onBlur={() => setFShop(false)} />
                        <Field label="Địa chỉ" icon="📍" placeholder="147 Trần Phú, Phước An"
                          value={shopAddr} onChange={setShopAddr}
                          focused={fAddr} onFocus={() => setFAddr(true)} onBlur={() => setFAddr(false)} />
                        <ChipGroup label="Loại cửa hàng"
                          options={["🍜 Đồ ăn", "🥤 Đồ uống", "🛒 Tạp hóa", "🎁 Khác"]}
                          value={shopCat} onChange={setShopCat} />
                        <UploadBox label="📋 Giấy phép kinh doanh (upload sau khi đăng ký)" />
                      </>}

                      {/* Ghi chú duyệt tài khoản */}
                      {(isDriver || role === "merchant") && (
                        <div style={{
                          background: "rgba(245,197,66,.07)", border: "1px solid rgba(245,197,66,.2)",
                          borderRadius: 10, padding: "9px 11px", marginBottom: 12,
                          display: "flex", gap: 7, alignItems: "flex-start",
                        }}>
                          <span style={{ fontSize: 13 }}>⏳</span>
                          <div style={{ color: "rgba(245,197,66,.65)", fontSize: 11, lineHeight: 1.6 }}>
                            Tài khoản sẽ được <strong style={{ color: "#f5c542" }}>Admin xét duyệt trong 24h</strong>.
                            Bạn nhận thông báo qua SMS khi được phê duyệt.
                          </div>
                        </div>
                      )}

                      <CTABtn
                        label={
                          role === "customer"    ? "✨ Tạo tài khoản" :
                          role === "driver_moto" ? "🛵 Đăng ký tài xế xe ôm" :
                          role === "driver_taxi" ? "🚕 Đăng ký tài xế taxi" :
                                                   "🏪 Đăng ký cửa hàng"
                        }
                        onClick={handleRegister}
                        loading={loading}
                      />
                      <FooterLink q="Đã có tài khoản?" a="Đăng nhập →" onClick={() => switchTab("login")} />
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* Social — chỉ ở tab login */}
              {tab === "login" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .2 }}
                  style={{ width: "100%", paddingBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.07)" }} />
                    <span style={{ color: "rgba(106,90,64,.5)", fontSize: 11 }}>hoặc đăng nhập với</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.07)" }} />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { icon: "💬", name: "Zalo",     c: "rgba(0,120,240,.15)",  bd: "rgba(0,120,240,.3)"  },
                      { icon: "📘", name: "Facebook", c: "rgba(24,119,242,.15)", bd: "rgba(24,119,242,.3)" },
                    ].map(s => (
                      <button key={s.name}
                        onClick={() => setError(`Tính năng đăng nhập ${s.name} đang phát triển.`)}
                        style={{
                          flex: 1, height: 42, borderRadius: 11, border: `1px solid ${s.bd}`,
                          background: s.c, backdropFilter: "blur(8px)", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          color: "#f8f0e0", fontSize: 11, fontWeight: 500, fontFamily: "Lexend",
                        }}>
                        <span style={{ fontSize: 15 }}>{s.icon}</span>{s.name}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}


              <p style={{ color: "rgba(255,255,255,.14)", fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 20 }}>
                GIAO NHANH · KRÔNG PẮC
              </p>

            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080806" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "2px solid rgba(255,107,0,0.3)", borderTopColor: "#FF6B00",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

