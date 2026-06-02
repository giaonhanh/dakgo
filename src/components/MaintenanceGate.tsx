"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "maintenance">("loading")

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("app_settings").select("value").eq("key", "features").maybeSingle(),
      supabase.auth.getUser(),
    ]).then(async ([{ data: setting }, { data: { user } }]) => {
      const features = setting?.value as Record<string, boolean> | null
      const isMaintenance = features?.maintenance_mode === true
      if (!isMaintenance) { setStatus("ok"); return }

      // Admin luôn bypass
      if (user) {
        const { data: profile } = await supabase
          .from("profiles").select("role").eq("id", user.id).maybeSingle()
        if ((profile as { role?: string } | null)?.role === "admin") {
          setStatus("ok"); return
        }
      }
      setStatus("maintenance")
    }).catch(() => setStatus("ok")) // Nếu lỗi → không chặn
  }, [])

  if (status === "loading") return null

  if (status === "maintenance") return (
    <div style={{
      minHeight: "100dvh", background: "#080806",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Lexend',sans-serif", padding: "0 24px", textAlign: "center",
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: 24, marginBottom: 24,
        background: "rgba(255,107,0,0.1)", border: "1.5px solid rgba(255,107,0,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40,
        boxShadow: "0 0 40px rgba(255,107,0,0.12)",
      }}>🔧</div>
      <div style={{ color: "#f8f0e0", fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
        Đang bảo trì
      </div>
      <div style={{ color: "#6a5a40", fontSize: 13, lineHeight: 1.7, maxWidth: 280, marginBottom: 32 }}>
        Giao Nhanh đang được nâng cấp để phục vụ bạn tốt hơn.
        Vui lòng quay lại sau ít phút.
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          height: 46, padding: "0 28px", borderRadius: 13, border: "none",
          background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
          color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}
      >
        🔄 Kiểm tra lại
      </button>
      <div style={{ color: "rgba(106,90,64,0.4)", fontSize: 9.5, marginTop: 24 }}>
        Giao Nhanh · Krông Pắc, Đắk Lắk
      </div>
    </div>
  )

  return <>{children}</>
}
