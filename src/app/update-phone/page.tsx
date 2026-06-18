"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function UpdatePhonePage() {
  const router  = useRouter()
  const [phone,   setPhone]   = useState("")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  async function handleSubmit() {
    const cleaned = phone.replace(/\D/g, "")
    if (cleaned.length < 9) { setError("Số điện thoại không hợp lệ"); return }
    setLoading(true); setError("")
    try {
      const res  = await fetch("/api/auth/update-phone", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: cleaned }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Có lỗi xảy ra"); return }
      router.replace("/")
    } catch {
      setError("Không thể kết nối. Thử lại sau.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"#080806",
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"24px 20px", fontFamily:"Lexend" }}>

      {/* Icon */}
      <div style={{ width:64, height:64, borderRadius:18,
        background:"rgba(255,107,0,0.12)", border:"1px solid rgba(255,107,0,0.3)",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:28, marginBottom:16 }}>📱</div>

      <div style={{ color:"#f8f0e0", fontSize:18, fontWeight:800, marginBottom:6 }}>
        Cập nhật số điện thoại
      </div>
      <div style={{ color:"#6a5a40", fontSize:11, textAlign:"center",
        marginBottom:28, maxWidth:280, lineHeight:1.6 }}>
        Tài xế cần SĐT của bạn để liên hệ khi giao hàng.<br/>
        Vui lòng nhập số điện thoại thật.
      </div>

      <div style={{ width:"100%", maxWidth:320, display:"flex", flexDirection:"column", gap:12 }}>

        <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,107,0,0.25)",
          borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ color:"#FF8C00", fontSize:13, fontWeight:700 }}>🇻🇳 +84</span>
          <div style={{ width:1, height:16, background:"rgba(255,107,0,0.2)" }} />
          <input
            type="tel" placeholder="Nhập số điện thoại" value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            autoFocus
            style={{ flex:1, background:"none", border:"none", outline:"none",
              color:"#f8f0e0", fontSize:14, fontFamily:"Lexend",
              letterSpacing:"0.5px" }}
          />
        </div>

        {error && (
          <div style={{ background:"rgba(255,64,64,0.1)", border:"1px solid rgba(255,64,64,0.3)",
            borderRadius:10, padding:"9px 12px", color:"#ff8080", fontSize:11 }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading || phone.replace(/\D/g,"").length < 9}
          style={{ height:50, borderRadius:14, border:"none",
            background: (!loading && phone.replace(/\D/g,"").length >= 9)
              ? "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)"
              : "rgba(255,255,255,0.07)",
            color: (!loading && phone.replace(/\D/g,"").length >= 9) ? "#fff" : "#6a5a40",
            fontSize:13, fontWeight:700, fontFamily:"Lexend", cursor:"pointer",
            boxShadow: phone.replace(/\D/g,"").length >= 9 ? "0 4px 20px rgba(255,107,0,0.4)" : "none",
            transition:"all .2s", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Đang lưu..." : "✅ Xác nhận"}
        </button>

        <div style={{ color:"rgba(106,90,64,0.45)", fontSize:9, textAlign:"center" }}>
          Số điện thoại chỉ dùng để liên hệ giao hàng, không chia sẻ bên thứ ba
        </div>
      </div>
    </div>
  )
}
