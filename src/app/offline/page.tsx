"use client"
import { useEffect, useState } from "react"

export default function OfflinePage() {
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    document.title = "Mất kết nối — Goi"
  }, [])

  const retry = () => {
    setRetrying(true)
    setTimeout(() => window.location.href = "/", 400)
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      `}</style>

      <div style={{ minHeight:"100dvh", background:"#080806", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 20px", textAlign:"center" }}>

        {/* icon */}
        <div style={{ fontSize:72, marginBottom:24, animation:"float 3s ease-in-out infinite" }}>📡</div>

        {/* title */}
        <div style={{ color:"#f8f0e0", fontSize:20, fontWeight:800, marginBottom:8 }}>
          Không có kết nối mạng
        </div>
        <div style={{ color:"#6a5a40", fontSize:13, lineHeight:1.6, maxWidth:280, marginBottom:32 }}>
          Vui lòng kiểm tra Wi-Fi hoặc dữ liệu di động rồi thử lại.
        </div>

        {/* dots indicator */}
        <div style={{ display:"flex", gap:6, marginBottom:32 }}>
          {[0, 0.2, 0.4].map((d, i) => (
            <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:"rgba(255,107,0,0.4)", animation:`pulse 1.4s ${d}s infinite` }} />
          ))}
        </div>

        {/* retry button */}
        <button onClick={retry} disabled={retrying}
          style={{ position:"relative", overflow:"hidden", height:50, padding:"0 32px", borderRadius:14, border:"none", background:"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)", color:"#fff", fontSize:13, fontWeight:800, cursor: retrying ? "default" : "pointer", fontFamily:"Lexend", boxShadow:"0 4px 20px rgba(255,107,0,0.4)", opacity: retrying ? 0.7 : 1, transition:"opacity .2s" }}>
          {retrying ? "Đang thử lại..." : "🔄 Thử lại"}
        </button>

        {/* tip */}
        <div style={{ marginTop:48, padding:"14px 18px", borderRadius:14, background:"rgba(255,107,0,0.06)", border:"1px dashed rgba(255,107,0,0.2)", maxWidth:300 }}>
          <div style={{ color:"#FF8C00", fontSize:11, fontWeight:700, marginBottom:4 }}>💡 Mẹo</div>
          <div style={{ color:"#6a5a40", fontSize:10, lineHeight:1.6 }}>
            Trang chủ và thực đơn vẫn có thể xem khi mất mạng nhờ bộ nhớ đệm. Chỉ đặt đơn mới cần kết nối.
          </div>
        </div>

        {/* logo */}
        <div style={{ position:"absolute", bottom:24, display:"flex", alignItems:"center", gap:8, opacity:.35 }}>
          <span style={{ fontSize:16 }}>🛵</span>
          <span style={{ color:"#f8f0e0", fontSize:11, fontWeight:700 }}>Goi · Krông Pắc</span>
        </div>
      </div>
    </>
  )
}
