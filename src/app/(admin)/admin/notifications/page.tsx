"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

type Audience   = "all" | "customers" | "drivers" | "merchants"
type NotifType  = "promo" | "system" | "order" | "ride"

interface HistoryItem {
  id: string; title: string; body: string; type: string
  audience: string; imageUrl: string | null
  sentCount: number; openedCount: number; sentAt: string; scheduled: boolean
}

interface ScheduledItem {
  id: string; title: string; body: string; type: string
  audience: string; image_url: string | null; scheduled_at: string
}

const AUDIENCE_CFG: Record<Audience, { label: string; icon: string; color: string }> = {
  all:       { label: "Tất cả",     icon: "👥", color: "#f0eaff" },
  customers: { label: "Khách hàng", icon: "🧑", color: "#4a8ff5" },
  drivers:   { label: "Tài xế",     icon: "🛵", color: "#FF8C00" },
  merchants: { label: "Cửa hàng",   icon: "🏪", color: "#3ecf6e" },
}

const TYPE_CFG: Record<NotifType, { label: string; color: string }> = {
  promo:  { label: "🎁 Ưu đãi",        color: "#b464ff" },
  system: { label: "📢 Hệ thống",       color: "#4a8ff5" },
  order:  { label: "📦 Đơn hàng",       color: "#FF8C00" },
  ride:   { label: "🛵 Đặt xe",         color: "#3ecf6e" },
}

const IMAGE_SIZES = [
  { label: "Icon thông báo",  size: "192 × 192 px",  note: "PNG, nền trong suốt — hiện trong khay thông báo" },
  { label: "Badge (Android)", size: "96 × 96 px",    note: "PNG trắng nền trong suốt — status bar" },
  { label: "Ảnh banner lớn",  size: "1440 × 756 px", note: "PNG/JPG tỉ lệ 2:1 — hiện bên dưới nội dung" },
]

export default function AdminNotificationsPage() {
  const supabase  = createClient()
  const imageRef  = useRef<HTMLInputElement>(null)

  const [audience,     setAudience]     = useState<Audience>("all")
  const [notifType,    setNotifType]    = useState<NotifType>("system")
  const [title,        setTitle]        = useState("")
  const [body,         setBody]         = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [imageUrl,     setImageUrl]     = useState("")
  const [imagePreview, setImagePreview] = useState("")
  const [uploading,    setUploading]    = useState(false)

  const [filterAud,   setFilterAud]   = useState<"all" | Audience>("all")
  const [sending,     setSending]     = useState(false)
  const [sendMsg,     setSendMsg]     = useState("")
  const [loading,     setLoading]     = useState(true)
  const [isMobile,    setIsMobile]    = useState(false)

  const [counts,    setCounts]    = useState({ all: 0, customers: 0, drivers: 0, merchants: 0 })
  const [history,   setHistory]   = useState<HistoryItem[]>([])
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    const [all, cust, drv, merch, notifData, schedData] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").eq("is_active", true),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "driver").eq("is_active", true),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "merchant").eq("is_active", true),
      supabase.from("notifications").select("title,body,type,is_read,created_at,data").order("created_at", { ascending: false }).limit(300),
      supabase.from("notification_schedules").select("*").is("sent_at", null).order("scheduled_at", { ascending: true }),
    ])

    setCounts({ all: all.count ?? 0, customers: cust.count ?? 0, drivers: drv.count ?? 0, merchants: merch.count ?? 0 })

    if (notifData.data) {
      const map = new Map<string, HistoryItem>()
      for (const n of notifData.data) {
        const d = (n.data ?? {}) as Record<string, string>
        // chỉ nhóm thông báo do admin gửi (có sent_by)
        const sentBy = d.sent_by ?? ""
        if (!sentBy.startsWith("admin")) continue
        const audience = d.audience ?? "all"
        const key = n.title + "|" + audience
        if (!map.has(key)) {
          map.set(key, { id: key, title: n.title, body: n.body, type: n.type, audience, imageUrl: d.image_url ?? null, sentCount: 0, openedCount: 0, sentAt: n.created_at, scheduled: false })
        }
        const entry = map.get(key)!
        entry.sentCount++
        if (n.is_read) entry.openedCount++
      }
      setHistory(Array.from(map.values()).slice(0, 20))
    }

    setScheduled((schedData.data ?? []) as ScheduledItem[])
    setLoading(false)
  }

  /* ── image upload ── */
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""
    if (!f) return
    setImagePreview(URL.createObjectURL(f))
    setUploading(true)
    const path = `notifications/${Date.now()}_${f.name.replace(/\s/g, "_")}`
    const { error } = await supabase.storage.from("notification-images").upload(path, f, { contentType: f.type })
    if (error) { setSendMsg("❌ Upload ảnh thất bại: " + error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from("notification-images").getPublicUrl(path)
    setImageUrl(publicUrl)
    setUploading(false)
  }

  /* ── send / schedule ── */
  const handleSend = async () => {
    if (!title.trim() || !body.trim()) { setSendMsg("⚠️ Vui lòng nhập tiêu đề và nội dung"); return }

    const isScheduled = scheduleTime && new Date(scheduleTime) > new Date()

    if (isScheduled) {
      /* Lưu vào notification_schedules */
      const { error } = await supabase.from("notification_schedules").insert({
        audience, title: title.trim(), body: body.trim(),
        type: notifType, image_url: imageUrl || null,
        scheduled_at: new Date(scheduleTime).toISOString(),
      })
      if (error) { setSendMsg("❌ Lỗi lưu lịch: " + error.message); return }
      const d = new Date(scheduleTime).toLocaleString("vi-VN")
      setSendMsg(`🕐 Đã lên lịch gửi vào ${d}`)
      setTitle(""); setBody(""); setScheduleTime(""); setImageUrl(""); setImagePreview("")
      await loadData()
      return
    }

    setSending(true); setSendMsg("")
    try {
      const res = await fetch("/api/admin/notify-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), audience, type: notifType, image_url: imageUrl || null }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setSendMsg("❌ " + (json.error ?? "Không gửi được"))
      } else if (json.count === 0) {
        setSendMsg("⚠️ Không có người dùng để gửi")
      } else {
        setSendMsg(`✅ Đã gửi đến ${json.count} người`)
        setTitle(""); setBody(""); setScheduleTime(""); setImageUrl(""); setImagePreview("")
        await loadData()
      }
    } catch { setSendMsg("❌ Lỗi kết nối server") }
    setSending(false)
  }

  /* ── delete scheduled ── */
  const deleteScheduled = async (id: string) => {
    await supabase.from("notification_schedules").delete().eq("id", id)
    setScheduled(p => p.filter(s => s.id !== id))
  }

  /* ── delete history item (xoá tất cả notification rows cùng title+audience) ── */
  const deleteHistory = async (item: HistoryItem) => {
    const admin = createClient()
    await admin.from("notifications")
      .delete()
      .eq("title", item.title)
      .filter("data->>audience", "eq", item.audience)
    setHistory(p => p.filter(h => h.id !== item.id))
  }

  const totalSent   = history.reduce((s, n) => s + n.sentCount, 0)
  const totalOpened = history.reduce((s, n) => s + n.openedCount, 0)
  const openRate    = totalSent ? Math.round((totalOpened / totalSent) * 100) : 0

  const shownHistory = filterAud === "all" ? history : history.filter(n => n.audience === filterAud)

  return (
    <AdminShell pageTitle="📣 Thông báo" pageSubtitle="Push notification · Broadcast · Lên lịch gửi">
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: isMobile ? "auto" : "100%", overflow: isMobile ? "visible" : "hidden" }}>

        {/* ── Compose panel ── */}
        <div style={{ width: isMobile ? "100%" : 440, flexShrink: 0, borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)", borderBottom: isMobile ? "1px solid rgba(255,255,255,0.06)" : "none", display: "flex", flexDirection: "column", overflow: isMobile ? "visible" : "hidden", maxHeight: isMobile ? "none" : "100%" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <div style={{ color: "#f0eaff", fontSize: 13, fontWeight: 700 }}>Soạn thông báo mới</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

            {/* KPI */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
              {[{ label: "Đã gửi", value: totalSent }, { label: "Đã mở", value: totalOpened }, { label: "Tỉ lệ mở", value: `${openRate}%` }].map(k => (
                <div key={k.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12 }}>
                  <div style={{ color: "#FF8C00", fontSize: 18, fontWeight: 800 }}>{k.value}</div>
                  <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 3 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Audience */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 8 }}>Đối tượng nhận</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {(Object.entries(AUDIENCE_CFG) as [Audience, typeof AUDIENCE_CFG[Audience]][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setAudience(key)}
                    style={{ height: 46, borderRadius: 10, background: audience === key ? `${cfg.color}18` : "rgba(255,255,255,0.03)", border: audience === key ? `1px solid ${cfg.color}40` : "1px solid rgba(255,255,255,0.07)", color: audience === key ? cfg.color : "#6a5a40", fontSize: 11, cursor: "pointer", fontFamily: "Lexend", fontWeight: audience === key ? 700 : 400, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 11 }}>{cfg.label}</div>
                      <div style={{ fontSize: 9, opacity: 0.7 }}>{loading ? "..." : counts[key].toLocaleString("vi-VN")} người</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Loại thông báo */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 8 }}>Loại thông báo</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(Object.entries(TYPE_CFG) as [NotifType, typeof TYPE_CFG[NotifType]][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setNotifType(key)}
                    style={{ padding: "7px 13px", borderRadius: 9, background: notifType === key ? `${cfg.color}20` : "rgba(255,255,255,0.04)", border: notifType === key ? `1px solid ${cfg.color}55` : "1px solid rgba(255,255,255,0.08)", color: notifType === key ? cfg.color : "#6a5a40", fontSize: 10, fontWeight: notifType === key ? 700 : 400, cursor: "pointer", fontFamily: "Lexend" }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>Tiêu đề (max 50 ký tự)</div>
              <input value={title} onChange={e => setTitle(e.target.value.slice(0, 50))} placeholder="⚡ Flash Sale cuối tuần!"
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0eaff", fontSize: 12, fontFamily: "Lexend" }} />
              <div style={{ textAlign: "right", color: "#6a5a40", fontSize: 9, marginTop: 3 }}>{title.length}/50</div>
            </div>

            {/* Body */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>Nội dung (max 200 ký tự)</div>
              <textarea value={body} onChange={e => setBody(e.target.value.slice(0, 200))} placeholder="Nhập nội dung thông báo..." rows={3}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0eaff", fontSize: 12, resize: "none", fontFamily: "Lexend" }} />
              <div style={{ textAlign: "right", color: "#6a5a40", fontSize: 9, marginTop: 3 }}>{body.length}/200</div>
            </div>

            {/* Image upload */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>Ảnh / Icon thông báo (không bắt buộc)</div>

              {/* size guide */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ color: "rgba(144,128,176,0.6)", fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 7 }}>📐 Kích thước chuẩn</div>
                {IMAGE_SIZES.map(s => (
                  <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                    <span style={{ color: "#6a5a40", fontSize: 9 }}>{s.label}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#f0eaff", fontSize: 9, fontWeight: 700 }}>{s.size}</div>
                      <div style={{ color: "rgba(106,90,64,0.6)", fontSize: 8 }}>{s.note}</div>
                    </div>
                  </div>
                ))}
              </div>

              <input ref={imageRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageFile} />

              {imagePreview ? (
                <div style={{ position: "relative", marginBottom: 4 }}>
                  <img src={imagePreview} alt="preview" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)" }} />
                  <button onClick={() => { setImageUrl(""); setImagePreview("") }}
                    style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 6, background: "rgba(8,8,6,0.8)", border: "1px solid rgba(255,255,255,0.15)", color: "#ff4040", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  {uploading && (
                    <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: "rgba(8,8,6,0.6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF8C00", fontSize: 11 }}>⏳ Đang upload...</div>
                  )}
                </div>
              ) : (
                <button onClick={() => imageRef.current?.click()}
                  style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", color: "#6a5a40", fontSize: 11, cursor: "pointer", fontFamily: "Lexend" }}>
                  📎 Chọn ảnh để tải lên
                </button>
              )}
            </div>

            {/* Schedule */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>Lên lịch gửi (để trống = gửi ngay)</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                  style={{ flex: 1, boxSizing: "border-box", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${scheduleTime ? "rgba(255,193,7,0.35)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, color: scheduleTime ? "#f5c542" : "#f0eaff", fontSize: 12, colorScheme: "dark", fontFamily: "Lexend" }} />
                {scheduleTime && (
                  <button onClick={() => setScheduleTime("")}
                    style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: "rgba(255,64,64,0.1)", border: "1px solid rgba(255,64,64,0.25)", color: "#ff4040", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                )}
              </div>
              {scheduleTime && (
                <div style={{ color: "#f5c542", fontSize: 9, marginTop: 4 }}>
                  🕐 Sẽ gửi vào {new Date(scheduleTime).toLocaleString("vi-VN")}
                </div>
              )}
            </div>

            {/* Preview */}
            {(title || body) && (
              <div style={{ padding: 12, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 14 }}>
                <div style={{ color: "#6a5a40", fontSize: 9, marginBottom: 8 }}>Preview thông báo</div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#FF6B00,#FFB347)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                    {imagePreview ? <img src={imagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🚀"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#f0eaff", fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{title || "Tiêu đề..."}</div>
                    <div style={{ color: "#b0956a", fontSize: 10 }}>{body || "Nội dung thông báo..."}</div>
                    <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 4 }}>DakGo · vừa xong</div>
                  </div>
                </div>
                {imagePreview && <img src={imagePreview} alt="banner" style={{ width: "100%", marginTop: 8, borderRadius: 8, maxHeight: 80, objectFit: "cover" }} />}
              </div>
            )}

            {sendMsg && (
              <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: sendMsg.startsWith("✅") || sendMsg.startsWith("🕐") ? "rgba(62,207,110,0.08)" : "rgba(255,64,64,0.08)", border: `1px solid ${sendMsg.startsWith("✅") || sendMsg.startsWith("🕐") ? "rgba(62,207,110,0.25)" : "rgba(255,64,64,0.2)"}`, color: sendMsg.startsWith("✅") || sendMsg.startsWith("🕐") ? "#3ecf6e" : "#ff4040", fontSize: 11 }}>
                {sendMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSend} disabled={sending || uploading}
                style={{ flex: 1, height: 42, borderRadius: 11, background: sending ? "rgba(255,107,0,0.3)" : "linear-gradient(90deg,#FF6B00,#FF8C00)", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: sending || uploading ? "not-allowed" : "pointer", fontFamily: "Lexend" }}>
                {sending ? "Đang gửi..." : scheduleTime ? `🕐 Lên lịch → ${loading ? "..." : counts[audience].toLocaleString("vi-VN")} người` : `📣 Gửi ngay → ${loading ? "..." : counts[audience].toLocaleString("vi-VN")} người`}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right panel: Scheduled + History ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: isMobile ? "visible" : "hidden" }}>

          {/* Scheduled queue */}
          {scheduled.length > 0 && (
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
              <div style={{ padding: "12px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "#f0eaff", fontSize: 12, fontWeight: 700 }}>🕐 Chờ gửi ({scheduled.length})</div>
              </div>
              <div style={{ maxHeight: 180, overflowY: "auto", padding: "0 16px 12px" }}>
                {scheduled.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, marginBottom: 6, background: "rgba(255,193,7,0.06)", border: "1px solid rgba(255,193,7,0.18)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                      <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 2 }}>
                        {AUDIENCE_CFG[s.audience as Audience]?.label ?? s.audience} · {new Date(s.scheduled_at).toLocaleString("vi-VN")}
                      </div>
                    </div>
                    <button onClick={() => deleteScheduled(s.id)}
                      style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,64,64,0.1)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History header */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div style={{ color: "#f0eaff", fontSize: 13, fontWeight: 700 }}>Lịch sử đã gửi</div>
            <div style={{ display: "flex", gap: 5 }}>
              {(["all", "customers", "drivers", "merchants"] as const).map(f => (
                <button key={f} onClick={() => setFilterAud(f)}
                  style={{ padding: "4px 9px", borderRadius: 7, background: filterAud === f ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: filterAud === f ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.08)", color: filterAud === f ? "#FF8C00" : "#6a5a40", fontSize: 9.5, cursor: "pointer", fontFamily: "Lexend", fontWeight: filterAud === f ? 700 : 400 }}>
                  {f === "all" ? "Tất cả" : AUDIENCE_CFG[f].label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 11 }}>Đang tải...</div>
            ) : shownHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 11 }}>Chưa có thông báo nào</div>
            ) : shownHistory.map((n, idx) => {
              const rate = n.sentCount ? Math.round((n.openedCount / n.sentCount) * 100) : 0
              const audCfg = AUDIENCE_CFG[n.audience as Audience] ?? AUDIENCE_CFG.all
              return (
                <div key={idx} style={{ padding: 14, borderRadius: 12, marginBottom: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                    {n.imageUrl && <img src={n.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#f0eaff", fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{n.title}</div>
                      <div style={{ color: "#6a5a40", fontSize: 10 }}>{n.body}</div>
                    </div>
                    <span style={{ padding: "2px 7px", borderRadius: 6, background: `${audCfg.color}18`, color: audCfg.color, fontSize: 8.5, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{audCfg.icon} {audCfg.label}</span>
                    <button onClick={() => deleteHistory(n)}
                      style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 13, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ color: "#6a5a40", fontSize: 10 }}>📤 {n.sentCount} gửi</span>
                      <span style={{ color: "#3ecf6e", fontSize: 10 }}>📖 {rate}% mở</span>
                    </div>
                    <span style={{ color: "#6a5a40", fontSize: 9 }}>{new Date(n.sentAt).toLocaleString("vi-VN")}</span>
                  </div>
                  {n.sentCount > 0 && (
                    <div style={{ marginTop: 7, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${rate}%`, background: "linear-gradient(90deg,#FF6B00,#3ecf6e)", borderRadius: 2 }} />
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

