"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface Notif {
  id: string
  type: "order" | "promo" | "system" | "ride"
  title: string
  body: string
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

const TYPE_CFG: Record<Notif["type"], { icon: string; color: string; bg: string; label: string }> = {
  order:  { icon: "📦", color: "#FF8C00", bg: "rgba(255,140,0,0.1)",   label: "Đơn hàng"   },
  ride:   { icon: "🛵", color: "#3ecf6e", bg: "rgba(62,207,110,0.1)",  label: "Chuyến xe"  },
  system: { icon: "⚙️", color: "#4a8ff5", bg: "rgba(74,143,245,0.1)", label: "Hệ thống"   },
  promo:  { icon: "🎁", color: "#b464ff", bg: "rgba(180,100,255,0.1)", label: "Khuyến mãi" },
}

function fmtTime(iso: string): string {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60)    return "Vừa xong"
  if (diff < 3600)  return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return d.toLocaleDateString("vi-VN")
}

export default function DriverNotificationsPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [notifs,  setNotifs]  = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<"all" | Notif["type"]>("all")

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, data, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)

    setNotifs((data ?? []) as Notif[])
    setLoading(false)
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id)
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    const ids = notifs.filter(n => !n.is_read).map(n => n.id)
    if (!ids.length) return
    await supabase.from("notifications").update({ is_read: true }).in("id", ids)
    setNotifs(ns => ns.map(n => ({ ...n, is_read: true })))
  }

  const filtered   = filter === "all" ? notifs : notifs.filter(n => n.type === filter)
  const unreadCnt  = notifs.filter(n => !n.is_read).length

  return (
    <div style={{ minHeight:"100dvh", background:"#080806", display:"flex", flexDirection:"column", fontFamily:"'Lexend',sans-serif" }}>

      {/* Header */}
      <div style={{ background:"rgba(8,8,6,0.96)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,107,0,0.08)", padding:"0 16px", height:56, flexShrink:0, display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => router.back()}
          style={{ width:36, height:36, borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, cursor:"pointer", color:"#f8f0e0" }}>
          ←
        </button>
        <div style={{ flex:1 }}>
          <div style={{ color:"#6a5a40", fontSize:9 }}>Tài xế</div>
          <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}>
            Thông báo
            {unreadCnt > 0 && (
              <span style={{ background:"#ff4040", borderRadius:9, minWidth:18, height:18, padding:"0 5px", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:"#fff" }}>{unreadCnt}</span>
            )}
          </div>
        </div>
        {unreadCnt > 0 && (
          <button onClick={markAllRead}
            style={{ padding:"6px 12px", borderRadius:8, background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.25)", color:"#FF8C00", fontSize:10, fontWeight:700, cursor:"pointer" }}>
            Đọc hết
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div style={{ display:"flex", gap:6, padding:"10px 16px", overflowX:"auto", flexShrink:0, borderBottom:"1px solid rgba(255,255,255,0.05)" } as React.CSSProperties}>
        {([["all","Tất cả","#6a5a40"], ...Object.entries(TYPE_CFG).map(([k,v]) => [k, v.label, v.color])] as [string,string,string][]).map(([k, label, color]) => (
          <button key={k} onClick={() => setFilter(k as typeof filter)}
            style={{ flexShrink:0, padding:"5px 13px", borderRadius:20, fontSize:10, fontWeight: filter===k ? 700 : 400, cursor:"pointer",
              background: filter===k ? `${color}18` : "rgba(255,255,255,0.04)",
              border: filter===k ? `1px solid ${color}50` : "1px solid rgba(255,255,255,0.06)",
              color: filter===k ? color : "#6a5a40" }}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:"10px 14px 40px" }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height:72, borderRadius:14, background:"rgba(255,255,255,0.04)", marginBottom:8, animation:"pulse 1.5s infinite" }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔔</div>
            <div style={{ color:"#6a5a40", fontSize:13 }}>Chưa có thông báo nào</div>
          </div>
        ) : filtered.map(n => {
          const cfg = TYPE_CFG[n.type] ?? TYPE_CFG.system
          return (
            <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
              style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"12px 14px", borderRadius:14, marginBottom:8,
                cursor: n.is_read ? "default" : "pointer",
                background: n.is_read ? "rgba(255,255,255,0.03)" : "rgba(255,107,0,0.05)",
                border: n.is_read ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(255,107,0,0.2)",
                transition:"all .15s" }}>
              <div style={{ width:40, height:40, borderRadius:12, background:cfg.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                {cfg.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                  <div style={{ color:"#f8f0e0", fontSize:12, fontWeight: n.is_read ? 500 : 700, lineHeight:1.4 }}>{n.title}</div>
                  {!n.is_read && <div style={{ width:8, height:8, borderRadius:"50%", background:"#FF6B00", flexShrink:0, marginTop:3 }} />}
                </div>
                <div style={{ color:"#b0956a", fontSize:10, lineHeight:1.5, marginTop:3 }}>{n.body}</div>
                <div style={{ color:"#6a5a40", fontSize:9, marginTop:5 }}>{fmtTime(n.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:.3} }`}</style>
    </div>
  )
}
