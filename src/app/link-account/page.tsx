"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LinkAccountPage() {
  const router = useRouter()
  const [phone,    setPhone]    = useState("")
  const [password, setPassword] = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const [showPass, setShowPass] = useState(false)

  async function handleLink() {
    if (!phone || !password) { setError("Vui lòng nhập đủ thông tin"); return }
    setLoading(true); setError("")
    try {
      const res  = await fetch("/api/auth/link-zalo", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Có lỗi xảy ra"); return }
      // Redirect theo role
      const role = data.role
      router.replace(
        role === "driver" ? "/driver" :
        role === "merchant" ? "/merchant" :
        role === "admin" ? "/admin" : "/"
      )
    } catch {
      setError("Không thể kết nối. Thử lại sau.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    router.replace("/update-phone")
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"#080806",
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"24px 20px", fontFamily:"Lexend" }}>

      {/* Logo */}
      <div style={{ fontSize:40, marginBottom:8 }}>💬</div>
      <div style={{ color:"#FF8C00", fontSize:18, fontWeight:800, marginBottom:4 }}>
        Đăng nhập Zalo thành công!
      </div>
      <div style={{ color:"#6a5a40", fontSize:11, textAlign:"center", marginBottom:28, maxWidth:280 }}>
        Bạn đã có tài khoản DakGo trước đó?<br/>
        Nhập SĐT + mật khẩu để gộp xu và lịch sử đơn hàng
      </div>

      {/* Form */}
      <div style={{ width:"100%", maxWidth:320, display:"flex", flexDirection:"column", gap:12 }}>

        {/* SĐT */}
        <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,107,0,0.2)",
          borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ color:"#6a5a40", fontSize:14 }}>📱</span>
          <input
            type="tel" placeholder="Số điện thoại" value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{ flex:1, background:"none", border:"none", outline:"none",
              color:"#f8f0e0", fontSize:13, fontFamily:"Lexend" }}
          />
        </div>

        {/* Mật khẩu */}
        <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,107,0,0.2)",
          borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ color:"#6a5a40", fontSize:14 }}>🔒</span>
          <input
            type={showPass ? "text" : "password"} placeholder="Mật khẩu tài khoản cũ" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLink()}
            style={{ flex:1, background:"none", border:"none", outline:"none",
              color:"#f8f0e0", fontSize:13, fontFamily:"Lexend" }}
          />
          <button onClick={() => setShowPass(s => !s)}
            style={{ background:"none", border:"none", cursor:"pointer",
              color:"#6a5a40", fontSize:14, padding:0 }}>
            {showPass ? "🙈" : "👁️"}
          </button>
        </div>

        {error && (
          <div style={{ background:"rgba(255,64,64,0.1)", border:"1px solid rgba(255,64,64,0.3)",
            borderRadius:10, padding:"9px 12px", color:"#ff8080", fontSize:11 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Gộp tài khoản */}
        <button onClick={handleLink} disabled={loading}
          style={{ height:48, borderRadius:14, border:"none", cursor:"pointer",
            background: loading ? "rgba(255,255,255,0.07)" : "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
            color: loading ? "#6a5a40" : "#fff",
            fontSize:13, fontWeight:700, fontFamily:"Lexend",
            boxShadow: loading ? "none" : "0 4px 20px rgba(255,107,0,0.4)",
            transition:"all .2s", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Đang xác nhận..." : "🔗 Gộp tài khoản"}
        </button>

        {/* Bỏ qua */}
        <button onClick={handleSkip}
          style={{ height:40, borderRadius:12, border:"1px solid rgba(255,255,255,0.08)",
            background:"transparent", cursor:"pointer",
            color:"#6a5a40", fontSize:11, fontFamily:"Lexend" }}>
          Bỏ qua — dùng tài khoản Zalo mới
        </button>

        <div style={{ color:"rgba(106,90,64,0.5)", fontSize:9.5, textAlign:"center", marginTop:4 }}>
          Xu và lịch sử đơn của tài khoản SĐT sẽ được giữ nguyên
        </div>
      </div>
    </div>
  )
}
