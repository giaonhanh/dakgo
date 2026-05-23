"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

type Audience = "all" | "customers" | "drivers" | "merchants"

interface HistoryItem {
  title: string
  body: string
  type: string
  sentCount: number
  openedCount: number
  sentAt: string
}

const AUDIENCE_META: Record<Audience, { label: string; icon: string; color: string }> = {
  all:       { label:"Tất cả",     icon:"👥", color:"#f0eaff" },
  customers: { label:"Khách hàng", icon:"🧑", color:"#4a8ff5" },
  drivers:   { label:"Tài xế",     icon:"🛵", color:"#FF8C00" },
  merchants: { label:"Cửa hàng",   icon:"🏪", color:"#3ecf6e" },
}

export default function AdminNotificationsPage() {
  const [audience,      setAudience]      = useState<Audience>("all")
  const [title,         setTitle]         = useState("")
  const [body,          setBody]          = useState("")
  const [scheduleTime,  setScheduleTime]  = useState("")
  const [filterAud,     setFilterAud]     = useState<"all" | Audience>("all")
  const [sending,       setSending]       = useState(false)
  const [sendMsg,       setSendMsg]       = useState("")
  const [loading,       setLoading]       = useState(true)
  const [isMobile,      setIsMobile]      = useState(false)

  /* Real data from Supabase */
  const [counts,  setCounts]  = useState({ all: 0, customers: 0, drivers: 0, merchants: 0 })
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()

    const [all, cust, drv, merch, notifData] = await Promise.all([
      supabase.from("profiles").select("id", { count:"exact", head:true }).eq("is_active", true),
      supabase.from("profiles").select("id", { count:"exact", head:true }).eq("role","customer").eq("is_active", true),
      supabase.from("profiles").select("id", { count:"exact", head:true }).eq("role","driver").eq("is_active", true),
      supabase.from("profiles").select("id", { count:"exact", head:true }).eq("role","merchant").eq("is_active", true),
      supabase.from("notifications").select("title,body,type,is_read,created_at").order("created_at",{ ascending:false }).limit(200),
    ])

    setCounts({
      all:       all.count  ?? 0,
      customers: cust.count ?? 0,
      drivers:   drv.count  ?? 0,
      merchants: merch.count ?? 0,
    })

    if (notifData.data) {
      const map = new Map<string, HistoryItem>()
      for (const n of notifData.data) {
        if (!map.has(n.title)) {
          map.set(n.title, { title: n.title, body: n.body, type: n.type, sentCount: 0, openedCount: 0, sentAt: n.created_at })
        }
        const entry = map.get(n.title)!
        entry.sentCount++
        if (n.is_read) entry.openedCount++
      }
      setHistory(Array.from(map.values()).slice(0, 20))
    }
    setLoading(false)
  }

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) { setSendMsg("⚠️ Vui lòng nhập tiêu đề và nội dung"); return }
    setSending(true); setSendMsg("")
    const supabase = createClient()

    let query = supabase.from("profiles").select("id").eq("is_active", true)
    if (audience === "customers") query = query.eq("role","customer")
    else if (audience === "drivers")   query = query.eq("role","driver")
    else if (audience === "merchants") query = query.eq("role","merchant")

    const { data: users } = await query
    if (!users || users.length === 0) { setSendMsg("⚠️ Không có người dùng để gửi"); setSending(false); return }

    const rows = users.map(u => ({
      user_id: u.id,
      type: "system" as const,
      title,
      body,
      data: { sent_by: "admin", audience },
    }))

    const { error } = await supabase.from("notifications").insert(rows)
    if (error) {
      setSendMsg("❌ Lỗi: " + error.message)
    } else {
      setSendMsg(`✅ Đã gửi đến ${users.length} người`)
      setTitle(""); setBody(""); setScheduleTime("")
      await loadData()
    }
    setSending(false)
  }

  const totalSent   = history.reduce((s, n) => s + n.sentCount, 0)
  const totalOpened = history.reduce((s, n) => s + n.openedCount, 0)
  const openRate    = totalSent ? Math.round((totalOpened / totalSent) * 100) : 0

  const shownHistory = filterAud === "all" ? history : history.filter(n => {
    if (filterAud === "customers") return n.type === "promo" || n.type === "system"
    return true
  })

  const AudienceCount = (aud: Audience) => loading ? "..." : counts[aud].toLocaleString("vi-VN")

  return (
    <AdminShell
      pageTitle="📣 Thông báo"
      pageSubtitle="Push notification · Broadcast · Lên lịch gửi"
    >
      <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", height:"100%", overflow:"hidden" }}>

        {/* Compose panel */}
        <div style={{ width: isMobile ? "100%" : 420, flexShrink:0, borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)", borderBottom: isMobile ? "1px solid rgba(255,255,255,0.06)" : "none", display:"flex", flexDirection:"column", overflow: isMobile ? "visible" : "hidden", maxHeight: isMobile ? "none" : "100%" }}>
          <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
            <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>Soạn thông báo mới</div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>

            {/* KPI */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
              {[
                { label:"Đã gửi (tổng)", value: totalSent },
                { label:"Đã mở",         value: totalOpened },
                { label:"Tỉ lệ mở",      value: `${openRate}%` },
              ].map(k => (
                <div key={k.label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"12px" }}>
                  <div style={{ color:"#FF8C00", fontSize:18, fontWeight:800 }}>{k.value}</div>
                  <div style={{ color:"#6a5a40", fontSize:9, marginTop:3 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Audience */}
            <div style={{ marginBottom:14 }}>
              <div style={{ color:"#6a5a40", fontSize:10, marginBottom:8 }}>Đối tượng nhận</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                {(Object.entries(AUDIENCE_META) as [Audience, typeof AUDIENCE_META[Audience]][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setAudience(key)}
                    style={{ height:48, borderRadius:10, background: audience===key ? `${cfg.color}18` : "rgba(255,255,255,0.03)", border: audience===key ? `1px solid ${cfg.color}40` : "1px solid rgba(255,255,255,0.07)", color: audience===key ? cfg.color : "#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend", fontWeight: audience===key ? 700 : 400, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                    <span style={{ fontSize:16 }}>{cfg.icon}</span>
                    <div style={{ textAlign:"left" }}>
                      <div style={{ fontSize:11 }}>{cfg.label}</div>
                      <div style={{ fontSize:9, opacity:0.7 }}>{AudienceCount(key)} người</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom:12 }}>
              <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Tiêu đề (max 50 ký tự)</div>
              <input value={title} onChange={e=>setTitle(e.target.value.slice(0,50))} placeholder="⚡ Flash Sale cuối tuần!"
                style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
              <div style={{ textAlign:"right", color:"#6a5a40", fontSize:9, marginTop:3 }}>{title.length}/50</div>
            </div>

            {/* Body */}
            <div style={{ marginBottom:12 }}>
              <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Nội dung (max 200 ký tự)</div>
              <textarea value={body} onChange={e=>setBody(e.target.value.slice(0,200))} placeholder="Nhập nội dung thông báo..." rows={4}
                style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12, resize:"none", fontFamily:"Lexend" }} />
              <div style={{ textAlign:"right", color:"#6a5a40", fontSize:9, marginTop:3 }}>{body.length}/200</div>
            </div>

            {/* Schedule */}
            <div style={{ marginBottom:16 }}>
              <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Lên lịch gửi (để trống = gửi ngay)</div>
              <input type="datetime-local" value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)}
                style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12, colorScheme:"dark" }} />
            </div>

            {/* Preview */}
            {(title || body) && (
              <div style={{ padding:"12px", background:"rgba(255,255,255,0.04)", borderRadius:12, border:"1px solid rgba(255,255,255,0.08)", marginBottom:14 }}>
                <div style={{ color:"#6a5a40", fontSize:9, marginBottom:8 }}>Preview thông báo</div>
                <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#FF6B00,#FFB347)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🚀</div>
                  <div>
                    <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700, marginBottom:2 }}>{title || "Tiêu đề..."}</div>
                    <div style={{ color:"#b0956a", fontSize:10 }}>{body || "Nội dung thông báo..."}</div>
                    <div style={{ color:"#6a5a40", fontSize:9, marginTop:4 }}>Giao Nhanh · vừa xong</div>
                  </div>
                </div>
              </div>
            )}

            {sendMsg && (
              <div style={{ marginBottom:10, padding:"8px 12px", borderRadius:8, background: sendMsg.startsWith("✅") ? "rgba(62,207,110,0.08)" : "rgba(255,64,64,0.08)", border: `1px solid ${sendMsg.startsWith("✅") ? "rgba(62,207,110,0.25)" : "rgba(255,64,64,0.2)"}`, color: sendMsg.startsWith("✅") ? "#3ecf6e" : "#ff4040", fontSize:11 }}>
                {sendMsg}
              </div>
            )}

            {/* Send buttons */}
            <div style={{ display:"flex", gap:8 }}>
              <button disabled={sending} style={{ flex:1, height:42, borderRadius:11, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#6a5a40", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                💾 Lưu nháp
              </button>
              <button onClick={handleSend} disabled={sending}
                style={{ flex:2, height:42, borderRadius:11, background: sending ? "rgba(255,107,0,0.3)" : "linear-gradient(90deg,#FF6B00,#FF8C00)", border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor: sending ? "not-allowed" : "pointer", fontFamily:"Lexend" }}>
                {sending ? "Đang gửi..." : scheduleTime ? "🕐 Lên lịch gửi" : "📣 Gửi ngay"} → {loading ? "..." : counts[audience].toLocaleString("vi-VN")} người
              </button>
            </div>
          </div>
        </div>

        {/* History panel */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
            <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>Lịch sử thông báo</div>
            <div style={{ display:"flex", gap:6 }}>
              {(["all","customers","drivers","merchants"] as const).map(f => (
                <button key={f} onClick={() => setFilterAud(f)}
                  style={{ padding:"5px 10px", borderRadius:7, background: filterAud===f ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: filterAud===f ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: filterAud===f ? "#FF8C00" : "#6a5a40", fontSize:10, cursor:"pointer", fontFamily:"Lexend", fontWeight: filterAud===f ? 700 : 400 }}>
                  {f === "all" ? "Tất cả" : AUDIENCE_META[f].label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"12px 20px" }}>
            {loading ? (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#6a5a40", fontSize:11 }}>Đang tải...</div>
            ) : shownHistory.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#6a5a40", fontSize:11 }}>Chưa có thông báo nào</div>
            ) : shownHistory.map((n, idx) => {
              const rate = n.sentCount ? Math.round((n.openedCount / n.sentCount) * 100) : 0
              return (
                <div key={idx} style={{ padding:"14px", borderRadius:12, marginBottom:8, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div style={{ flex:1, marginRight:12 }}>
                      <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700, marginBottom:2 }}>{n.title}</div>
                      <div style={{ color:"#6a5a40", fontSize:10 }}>{n.body}</div>
                    </div>
                    <span style={{ padding:"2px 8px", borderRadius:6, background:"rgba(62,207,110,0.1)", color:"#3ecf6e", fontSize:9, fontWeight:700, whiteSpace:"nowrap" }}>Đã gửi</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", gap:12 }}>
                      <span style={{ color:"#6a5a40", fontSize:10 }}>📤 {n.sentCount} gửi</span>
                      <span style={{ color:"#3ecf6e", fontSize:10 }}>📖 {rate}% mở</span>
                    </div>
                    <span style={{ color:"#6a5a40", fontSize:9 }}>{new Date(n.sentAt).toLocaleString("vi-VN")}</span>
                  </div>
                  {n.sentCount > 0 && (
                    <div style={{ marginTop:8, height:3, borderRadius:2, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${rate}%`, background:"linear-gradient(90deg,#FF6B00,#3ecf6e)", borderRadius:2 }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
