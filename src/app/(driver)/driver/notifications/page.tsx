"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface Notif {
  id:         string
  type:       string
  title:      string
  body:       string
  is_read:    boolean
  created_at: string
  data:       Record<string, unknown> | null
}

function getIcon(type: string) {
  switch (type) {
    case "order":  return { icon: "📦", bg: "rgba(62,207,110,0.12)",  color: "#3ecf6e" }
    case "ride":   return { icon: "🛵", bg: "rgba(255,107,0,0.12)",   color: "#FF8C00" }
    case "promo":  return { icon: "🎁", bg: "rgba(180,100,255,0.12)", color: "#b464ff" }
    default:       return { icon: "🔔", bg: "rgba(74,143,245,0.12)",  color: "#4a8ff5" }
  }
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60)    return "Vừa xong"
  if (diff < 3600)  return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  if (diff < 172800) return "Hôm qua"
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
}

export default function DriverNotificationsPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [notifs,  setNotifs]  = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, is_read, created_at, data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    setNotifs(data ?? [])
    setLoading(false)

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
  }

  const unreadCount = notifs.filter(n => !n.is_read).length

  return (
    <div style={{ minHeight: "100dvh", background: "#080806", fontFamily: "'Lexend',sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0} @keyframes pulse{0%,100%{opacity:.6}50%{opacity:.3}}`}</style>

      <div style={{ background: "rgba(8,8,6,0.96)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,107,0,0.08)", paddingTop: "env(safe-area-inset-top)", flexShrink: 0 }}>
        <div style={{ height: 56, padding: "0 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", color: "#f8f0e0", flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>Thông báo</div>
            {unreadCount > 0 && <div style={{ color: "#6a5a40", fontSize: 9 }}>{unreadCount} chưa đọc</div>}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 100px" }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 72, borderRadius: 14, background: "rgba(255,255,255,0.04)", marginBottom: 8, animation: "pulse 1.5s infinite" }} />
          ))
        ) : notifs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <div style={{ color: "#6a5a40", fontSize: 13 }}>Chưa có thông báo</div>
          </div>
        ) : notifs.map(n => {
          const meta = getIcon(n.type)
          return (
            <div key={n.id} style={{ marginBottom: 8, borderRadius: 14, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start",
              background: n.is_read ? "rgba(255,255,255,0.03)" : "rgba(255,107,0,0.04)",
              border: n.is_read ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(255,107,0,0.15)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: meta.bg,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                {meta.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                  <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 700, flex: 1, marginRight: 8 }}>{n.title}</div>
                  {!n.is_read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF6B00", flexShrink: 0, marginTop: 2 }} />}
                </div>
                <div style={{ color: "#b0956a", fontSize: 10, marginBottom: 4, lineHeight: 1.4 }}>{n.body}</div>
                <div style={{ color: "#6a5a40", fontSize: 9 }}>{fmtTime(n.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>

      <nav style={{ position: "fixed", bottom: "calc(12px + env(safe-area-inset-bottom))", left: 14, right: 14, height: 56, borderRadius: 9999, zIndex: 50,
        background: "rgba(8,8,6,0.92)", backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,107,0,0.2)", boxShadow: "0 0 20px rgba(255,107,0,0.1)",
        display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px" }}>
        {[
          { href: "/driver",          icon: "🏠", label: "Trang chủ" },
          { href: "/driver/orders",   icon: "📋", label: "Đơn hàng"  },
          { href: "/driver/earnings", icon: "📊", label: "Thu nhập"  },
          { href: "/driver/profile",  icon: "👤", label: "Hồ sơ"     },
        ].map(tab => (
          <a key={tab.href} href={tab.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textDecoration: "none", padding: "6px 12px", borderRadius: 20 }}>
            <span style={{ fontSize: 17 }}>{tab.icon}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: "#6a5a40" }}>{tab.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
