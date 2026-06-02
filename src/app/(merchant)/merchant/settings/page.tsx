"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getAdminContact } from "@/lib/adminContact"
import { createClient } from "@/lib/supabase/client"

/* ── helpers ── */
function Toggle({ on, onToggle, color = "#3ecf6e" }: { on: boolean; onToggle: () => void; color?: string }) {
  return (
    <button onClick={onToggle} style={{
      width: 46, height: 26, borderRadius: 13, flexShrink: 0, cursor: "pointer", border: "none",
      background: on ? color : "rgba(255,255,255,0.1)", position: "relative", transition: "background .25s",
    }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,0.35)" }} />
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: "#6a5a40", fontSize: 9, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", paddingLeft: 4, marginBottom: 8 }}>{title}</div>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "0 14px" }}>
        {children}
      </div>
    </div>
  )
}

function Row({ icon, label, sub, children, danger = false, onClick, arrow = false, last = false }: {
  icon: string; label: string; sub?: string; children?: React.ReactNode; danger?: boolean; onClick?: () => void; arrow?: boolean; last?: boolean
}) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.05)", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: danger ? "rgba(255,64,64,0.1)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: danger ? "#ff4040" : "#f8f0e0", fontSize: 13, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
      {arrow && <div style={{ color: "#6a5a40", fontSize: 16 }}>›</div>}
    </div>
  )
}

/* ── password sheet ── */
function PwSheet({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [vals, setVals] = useState(["", "", ""])
  const [err, setErr] = useState(""); const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const labels = ["Mật khẩu hiện tại", "Mật khẩu mới (tối thiểu 6 ký tự)", "Xác nhận mật khẩu mới"]
  const setVal = (v: string) => setVals(a => { const n = [...a]; n[step - 1] = v; return n })
  const next = async () => {
    setErr("")
    if (step === 1 && !vals[0]) return setErr("Vui lòng nhập mật khẩu hiện tại")
    if (step === 2 && vals[1].length < 6) return setErr("Tối thiểu 6 ký tự")
    if (step === 3) {
      if (vals[1] !== vals[2]) return setErr("Mật khẩu không khớp")
      setSaving(true)
      const { error } = await supabase.auth.updateUser({ password: vals[1] })
      setSaving(false)
      if (error) return setErr("Không thể đổi mật khẩu. Thử lại sau.")
      onClose(); return
    }
    setStep(s => (s + 1) as 1 | 2 | 3)
  }
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(8,8,6,0.75)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#0e0b07", borderTop: "1px solid rgba(255,107,0,0.3)", borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>🔑 Đổi mật khẩu</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: s < 3 ? 1 : 0 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: step >= s ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)", border: `2px solid ${step >= s ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.1)"}`, color: step >= s ? "#FF8C00" : "#6a5a40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{s}</div>
              {s < 3 && <div style={{ flex: 1, height: 2, background: step > s ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.06)" }} />}
            </div>
          ))}
        </div>
        <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 8 }}>{labels[step - 1]}</div>
        <div style={{ position: "relative" }}>
          <input type={show ? "text" : "password"} value={vals[step - 1]} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && next()} placeholder="••••••••" autoFocus
            style={{ width: "100%", height: 48, padding: "0 48px 0 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,107,0,0.25)", borderRadius: 12, color: "#f8f0e0", fontSize: 14, fontFamily: "Lexend" }} />
          <button onClick={() => setShow(s => !s)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>{show ? "🙈" : "👁"}</button>
        </div>
        {err && <div style={{ color: "#ff4040", fontSize: 11, marginTop: 8 }}>⚠ {err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginTop: 16 }}>
          <button onClick={step > 1 ? () => setStep(s => (s - 1) as 1 | 2 | 3) : onClose} style={{ height: 46, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#b0956a", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>{step > 1 ? "← Quay lại" : "Hủy"}</button>
          <button onClick={next} disabled={saving} style={{ height: 46, borderRadius: 12, border: "none", background: saving ? "rgba(255,255,255,0.08)" : "linear-gradient(90deg,#FF6B00,#FF8C00)", color: saving ? "#6a5a40" : "#fff", fontSize: 13, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "Lexend" }}>{saving ? "Đang lưu..." : step === 3 ? "✓ Xác nhận" : "Tiếp theo →"}</button>
        </div>
      </div>
    </motion.div>
  )
}

/* ── hours sheet ── */
const HOURS_KEY = "merchant_shop_hours"
const DAYS_LABEL = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]

export type TimeSlot  = { from: string; to: string }
export type DayHours  = { day: string; open: boolean; slots: TimeSlot[] }

const DEFAULT_HOURS: DayHours[] = DAYS_LABEL.map(d => ({
  day: d, open: true, slots: [{ from: "07:00", to: "21:00" }],
}))

function loadHours(): DayHours[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(HOURS_KEY) : null
    if (s) {
      const parsed = JSON.parse(s)
      // backward compat: old format used {from, to} directly
      return parsed.map((d: DayHours & { from?: string; to?: string }) => ({
        day:   d.day,
        open:  d.open,
        slots: d.slots ?? [{ from: d.from ?? "07:00", to: d.to ?? "21:00" }],
      }))
    }
  } catch { /* ignore */ }
  return DEFAULT_HOURS
}

const timeInputStyle: React.CSSProperties = {
  flex: 1, height: 34, padding: "0 8px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,107,0,0.2)",
  borderRadius: 8, color: "#f8f0e0", fontSize: 11, fontFamily: "Lexend", colorScheme: "dark",
}

/* ── hours sheet ── */
function HoursSheet({ onClose }: { onClose: () => void }) {
  const [hours, setHours] = useState<DayHours[]>(loadHours)

  const toggle    = (i: number) =>
    setHours(h => h.map((x, j) => j === i ? { ...x, open: !x.open } : x))

  const addSlot   = (i: number) =>
    setHours(h => h.map((x, j) => j === i
      ? { ...x, slots: [...x.slots, { from: "14:00", to: "21:00" }] } : x))

  const removeSlot = (i: number, si: number) =>
    setHours(h => h.map((x, j) => j === i
      ? { ...x, slots: x.slots.filter((_, k) => k !== si) } : x))

  const updateSlot = (i: number, si: number, field: keyof TimeSlot, val: string) =>
    setHours(h => h.map((x, j) => j === i
      ? { ...x, slots: x.slots.map((s, k) => k === si ? { ...s, [field]: val } : s) } : x))

  const handleSave = () => {
    localStorage.setItem(HOURS_KEY, JSON.stringify(hours))
    onClose()
  }

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(8,8,6,0.75)",
        backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#0e0b07", borderTop: "1px solid rgba(255,107,0,0.3)",
        borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)",
        maxHeight: "88dvh", overflowY: "auto" }}>

        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>🕐 Giờ hoạt động từng ngày</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none",
            borderRadius: 8, width: 30, height: 30, color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ color: "#6a5a40", fontSize: 9, marginBottom: 16 }}>
          Mỗi ngày có thể có 2 khung giờ — VD: 07:00–11:00 và 14:00–21:00 (nghỉ trưa).
        </div>

        {hours.map((h, i) => (
          <div key={h.day} style={{ padding: "10px 0",
            borderBottom: i < hours.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>

            {/* Day header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: h.open ? 8 : 0 }}>
              <div style={{ width: 56, color: h.open ? "#f8f0e0" : "#6a5a40",
                fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{h.day}</div>
              <Toggle on={h.open} onToggle={() => toggle(i)} />
              {!h.open && <div style={{ color: "#6a5a40", fontSize: 10 }}>Nghỉ cả ngày</div>}
            </div>

            {/* Time slots */}
            {h.open && (
              <div style={{ paddingLeft: 66 }}>
                {h.slots.map((slot, si) => (
                  <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ color: "#6a5a40", fontSize: 9, width: 12 }}>{si + 1}</span>
                    <input type="time" value={slot.from}
                      onChange={e => updateSlot(i, si, "from", e.target.value)}
                      style={timeInputStyle} />
                    <span style={{ color: "#6a5a40", fontSize: 10 }}>–</span>
                    <input type="time" value={slot.to}
                      onChange={e => updateSlot(i, si, "to", e.target.value)}
                      style={timeInputStyle} />
                    {h.slots.length > 1 && (
                      <button onClick={() => removeSlot(i, si)}
                        style={{ width: 26, height: 26, borderRadius: 7, border: "none",
                          background: "rgba(255,64,64,0.1)", color: "#ff4040",
                          fontSize: 13, cursor: "pointer", flexShrink: 0 }}>×</button>
                    )}
                  </div>
                ))}
                {h.slots.length < 2 && (
                  <button onClick={() => addSlot(i)}
                    style={{ marginTop: 2, padding: "4px 10px", borderRadius: 7, border: "none",
                      background: "rgba(255,255,255,0.04)", color: "#6a5a40",
                      fontSize: 9, cursor: "pointer", fontFamily: "Lexend" }}>
                    + Thêm khung giờ 2 (có nghỉ trưa)
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        <button onClick={handleSave}
          style={{ width: "100%", height: 48, borderRadius: 14, border: "none",
            background: "linear-gradient(90deg,#FF6B00,#FF8C00)", color: "#fff",
            fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Lexend", marginTop: 16 }}>
          ✓ Lưu giờ hoạt động
        </button>
      </div>
    </motion.div>
  )
}

/* ── prep time sheet ── */
function PrepTimeSheet({ value, onSelect, onClose }: { value: string; onSelect: (v: string) => void; onClose: () => void }) {
  const OPTIONS = ["5–10", "10–15", "15–20", "20–30", "30–45"]
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(8,8,6,0.75)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#0e0b07", borderTop: "1px solid rgba(255,107,0,0.3)", borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 24px)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>⏱️ Thời gian chuẩn bị đơn</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ color: "#6a5a40", fontSize: 10, lineHeight: 1.6, marginBottom: 18 }}>
          Thời gian từ khi nhận đơn đến khi tài xế đến lấy hàng. Thông tin này hiển thị cho khách hàng trên trang quán.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {OPTIONS.map(o => (
            <button key={o} onClick={() => { onSelect(o); onClose() }}
              style={{ padding: "10px 18px", borderRadius: 12,
                background: value === o ? "rgba(255,107,0,0.14)" : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${value === o ? "rgba(255,107,0,0.45)" : "rgba(255,255,255,0.08)"}`,
                color: value === o ? "#FF8C00" : "#b0956a",
                fontSize: 13, fontWeight: value === o ? 700 : 400, cursor: "pointer", fontFamily: "Lexend" }}>
              {o} phút
            </button>
          ))}
        </div>
        <div style={{ padding: "10px 12px", background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.15)", borderRadius: 10 }}>
          <div style={{ color: "#6a5a40", fontSize: 9.5 }}>
            💡 Đang chọn: <strong style={{ color: "#FF8C00" }}>{value} phút</strong> — khách thấy chip này trên trang quán của bạn.
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ── main ── */
export default function MerchantSettingsPage() {
  /* shop settings */
  const [shop, setShop] = useState(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("merchant_shop_settings") : null
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return { autoAccept: false, busyMode: false, preorderAllow: true, showRating: true, showSoldCount: true }
  })

  /* notification settings */
  const [notif, setNotif] = useState({
    soundNewOrder:  true,
    vibration:      true,
    orderPopup:     true,
    orderUpdates:   true,
    promotions:     true,
    systemAlerts:   true,
    weeklySummary:  true,
  })

  /* privacy */
  const [priv, setPriv] = useState({
    showAddress:    true,
    analytics:      true,
  })

  /* sheets */
  const [prepTime,      setPrepTime]      = useState(() => {
    try { return localStorage.getItem("merchant_prep_time") ?? "10–15" } catch { return "10–15" }
  })
  const [showPw,        setShowPw]        = useState(false)
  const [showHours,     setShowHours]     = useState(false)
  const [showPrepSheet, setShowPrepSheet] = useState(false)
  const [toast, setToast]           = useState("")
  const [adminContactLink, setAdminContactLink] = useState("mailto:giaonhanh.phuocan@gmail.com")
  const [adminPhone,       setAdminPhone]       = useState("")
  const [shopName,         setShopName]         = useState("")
  const [shopAddress,      setShopAddress]      = useState("")
  const [shopIsOpen,       setShopIsOpen]       = useState(false)
  const [shopRating,       setShopRating]       = useState<number | null>(null)
  const [shopCommission,   setShopCommission]   = useState(15)

  useEffect(() => {
    getAdminContact().then(c => {
      setAdminContactLink(c.contactLink)
      setAdminPhone(c.phone)
    })
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from("shops").select("name, address, is_open, rating_avg, commission_rate").eq("owner_id", user.id).maybeSingle()
        .then(({ data }) => {
          if (!data) return
          setShopName(data.name ?? "")
          setShopAddress(data.address ?? "")
          setShopIsOpen(data.is_open ?? false)
          setShopRating(data.rating_avg ?? null)
          setShopCommission(data.commission_rate ?? 15)
        })
    })
  }, [])

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200) }

  const sw = (k: keyof typeof shop) => setShop(p => {
    const next = { ...p, [k]: !p[k] }
    try { localStorage.setItem("merchant_shop_settings", JSON.stringify(next)) } catch { /* ignore */ }
    return next
  })
  const sn = (k: keyof typeof notif) => setNotif(p => ({ ...p, [k]: !p[k] }))
  const sp = (k: keyof typeof priv)  => setPriv(p => ({ ...p, [k]: !p[k] }))

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{display:none}
        input{font-family:'Lexend',sans-serif;outline:none}
        button{font-family:'Lexend',sans-serif}
      `}</style>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ position: "fixed", top: "calc(env(safe-area-inset-top) + 62px)", left: "50%", transform: "translateX(-50%)", zIndex: 999, whiteSpace: "nowrap", background: "rgba(62,207,110,0.15)", border: "1px solid rgba(62,207,110,0.35)", borderRadius: 12, padding: "7px 18px", color: "#3ecf6e", fontSize: 11, fontWeight: 600, backdropFilter: "blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ minHeight: "100dvh", background: "#080806", paddingBottom: 24 }}>

        {/* header */}
        <div style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(8,8,6,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingTop: "env(safe-area-inset-top)" }}>
          <div style={{ height: 56, padding: "0 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/merchant" style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#f8f0e0", fontSize: 15 }}>←</a>
            <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>⚙️ Cài đặt cửa hàng</div>
          </div>
        </div>

        <div style={{ padding: "14px 16px 0" }}>

          {/* shop summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 16, marginBottom: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: "rgba(255,107,0,0.15)", border: "2px solid rgba(255,107,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>🍜</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 800 }}>{shopName || "Cửa hàng"}</div>
              <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 2 }}>{shopAddress || "Chưa cập nhật địa chỉ"}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                <span style={{ background: shopIsOpen ? "rgba(62,207,110,0.1)" : "rgba(255,64,64,0.08)", border: `1px solid ${shopIsOpen ? "rgba(62,207,110,0.25)" : "rgba(255,64,64,0.2)"}`, borderRadius: 5, padding: "1px 8px", color: shopIsOpen ? "#3ecf6e" : "#ff4040", fontSize: 8, fontWeight: 700 }}>{shopIsOpen ? "🟢 Đang mở" : "🔴 Đóng cửa"}</span>
                {shopRating && <span style={{ background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 5, padding: "1px 8px", color: "#FF8C00", fontSize: 8, fontWeight: 700 }}>⭐ {shopRating.toFixed(1)}</span>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <a href="/merchant/profile" style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#b0956a", fontSize: 9, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>Sửa hồ sơ</a>
              <a href="/merchant/shop-preview" style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)", color: "#FF8C00", fontSize: 9, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>👁 Xem trước</a>
            </div>
          </div>

          {/* commission info */}
          <div style={{ background: "rgba(74,143,245,0.06)", border: "1px solid rgba(74,143,245,0.18)", borderRadius: 14, padding: "12px 14px", marginBottom: 18, display: "flex", gap: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>📊</span>
            <div>
              <div style={{ color: "#4a8ff5", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Hoa hồng nền tảng: {shopCommission}%</div>
              <div style={{ color: "#6a5a40", fontSize: 10, lineHeight: 1.5 }}>Áp dụng cho mỗi đơn hàng. Thanh toán ngay khi tài xế nhận đơn. Liên hệ Admin để đàm phán điều chỉnh nếu có nhu cầu.</div>
            </div>
          </div>

          {/* shop operation */}
          <Section title="Vận hành cửa hàng">
            <Row icon="⚡" label="Tự động nhận đơn" sub="Nhận ngay mà không cần xác nhận thủ công">
              <Toggle on={shop.autoAccept} onToggle={() => sw("autoAccept")} />
            </Row>
            <Row icon="😓" label="Chế độ bận" sub="Tạm ngừng nhận đơn mới (vẫn hiển thị)">
              <Toggle on={shop.busyMode} onToggle={() => sw("busyMode")} color="#FFB347" />
            </Row>
            <Row icon="📅" label="Cho phép đặt trước" sub="Khách đặt đơn cho giờ sau / ngày hôm sau">
              <Toggle on={shop.preorderAllow} onToggle={() => sw("preorderAllow")} />
            </Row>
            <Row icon="⭐" label="Hiện đánh giá trên shop" sub="Hiển thị sao và nhận xét khách hàng">
              <Toggle on={shop.showRating} onToggle={() => sw("showRating")} />
            </Row>
            <Row icon="🔥" label="Hiện số lượng đã bán" sub="Hiển thị 'Đã bán X' trên từng món">
              <Toggle on={shop.showSoldCount} onToggle={() => sw("showSoldCount")} />
            </Row>
            <Row icon="⏱️" label="Thời gian chuẩn bị đơn" sub={`${prepTime} phút · hiển thị cho khách trên trang quán`} onClick={() => setShowPrepSheet(true)} arrow last />
          </Section>

          {/* hours */}
          <Section title="Lịch hoạt động">
            <Row icon="🕐" label="Giờ mở cửa từng ngày" sub="T2-T6: 07:00–21:00 · T7-CN: 07:00–22:00" onClick={() => setShowHours(true)} arrow last />
          </Section>

          {/* quick links */}
          <Section title="Quản lý">
            <Row icon="🍽️" label="Quản lý thực đơn" sub="Thêm, sửa, xóa món ăn" onClick={() => { window.location.href = "/merchant/menu" }} arrow />
            <Row icon="🏷️" label="Khuyến mãi & Voucher" sub="Tạo mã giảm giá cho cửa hàng" onClick={() => { window.location.href = "/merchant/promotions" }} arrow />
            <Row icon="📈" label="Doanh thu & Báo cáo" sub="Thống kê theo ngày / tuần / tháng" onClick={() => { window.location.href = "/merchant/revenue" }} arrow last />
          </Section>

          {/* notifications */}
          <Section title="Thông báo">
            <Row icon="🔊" label="Âm thanh đơn mới" sub="Phát âm báo khi có đơn hàng mới">
              <Toggle on={notif.soundNewOrder} onToggle={() => sn("soundNewOrder")} />
            </Row>
            <Row icon="📳" label="Rung khi có đơn" sub="Rung thiết bị khi nhận đơn mới">
              <Toggle on={notif.vibration} onToggle={() => sn("vibration")} />
            </Row>
            <Row icon="📲" label="Popup toàn màn hình" sub="Hiển thị đơn ngay khi mở app">
              <Toggle on={notif.orderPopup} onToggle={() => sn("orderPopup")} />
            </Row>
            <Row icon="📦" label="Cập nhật đơn hàng" sub="Trạng thái: tài xế đến, đã lấy hàng...">
              <Toggle on={notif.orderUpdates} onToggle={() => sn("orderUpdates")} />
            </Row>
            <Row icon="📣" label="Tin khuyến mãi từ hệ thống" sub="Chiến dịch đặc biệt, sự kiện flash sale">
              <Toggle on={notif.promotions} onToggle={() => sn("promotions")} color="#b464ff" />
            </Row>
            <Row icon="📊" label="Tổng kết tuần" sub="Báo cáo doanh thu gửi qua email / app">
              <Toggle on={notif.weeklySummary} onToggle={() => sn("weeklySummary")} color="#FFB347" />
            </Row>
            <Row icon="📢" label="Thông báo hệ thống" sub="Cập nhật ứng dụng, bảo trì" last>
              <Toggle on={notif.systemAlerts} onToggle={() => sn("systemAlerts")} color="#4a8ff5" />
            </Row>
          </Section>

          {/* privacy */}
          <Section title="Quyền riêng tư">
            <Row icon="📍" label="Hiện địa chỉ cụ thể" sub="Khách thấy số nhà, tên đường">
              <Toggle on={priv.showAddress} onToggle={() => sp("showAddress")} />
            </Row>
            <Row icon="📊" label="Chia sẻ dữ liệu phân tích" sub="Giúp tối ưu đề xuất món & quảng cáo" last>
              <Toggle on={priv.analytics} onToggle={() => sp("analytics")} color="#4a8ff5" />
            </Row>
          </Section>

          {/* security */}
          <Section title="Bảo mật">
            <Row icon="🔑" label="Đổi mật khẩu" sub="Cập nhật mật khẩu đăng nhập" onClick={() => setShowPw(true)} arrow />
            <Row icon="📱" label="Phiên đăng nhập" sub="Quản lý thiết bị đang đăng nhập" onClick={() => fire("Tính năng đang phát triển...")} arrow />
            <Row icon="🛡" label="Xác thực 2 lớp" sub="Bảo vệ bằng OTP qua SMS" onClick={() => fire("Tính năng đang phát triển...")} arrow last />
          </Section>

          {/* support */}
          <Section title="Hỗ trợ">
            <Row icon="❓" label="Câu hỏi thường gặp" sub="Hướng dẫn chủ cửa hàng" onClick={() => fire("Đang mở FAQ...")} arrow />
            <Row icon="📞" label="Liên hệ admin" sub="Hỗ trợ, xóa tài khoản / cửa hàng" onClick={() => { if (adminContactLink) window.open(adminContactLink, "_blank"); else fire("Đang kết nối...") }} arrow />
            <Row icon="⚠️" label="Báo cáo vấn đề" sub="Đơn hàng sai, tài xế vi phạm..." onClick={() => fire("Đang mở form...")} arrow />
            <Row icon="⚖️" label="Quy tắc & Chính sách" sub="Điều khoản, chính sách đối tác" onClick={() => fire("Đang mở tài liệu...")} arrow last />
          </Section>

          {/* about + account merged */}
          <Section title="Về ứng dụng & Tài khoản">
            <Row icon="🚀" label="Giao Nhanh Merchant" sub="Phiên bản 1.0.0" />
            <Row icon="🚪" label="Đăng xuất" sub="Đăng xuất khỏi thiết bị này" danger onClick={async () => { const sb = createClient(); await sb.auth.signOut(); window.location.href = "/login" }} arrow last />
          </Section>
        </div>
      </div>

      {/* sheets */}
      <AnimatePresence>
        {showPw        && <PwSheet      onClose={() => setShowPw(false)}        />}
        {showHours     && <HoursSheet   onClose={() => setShowHours(false)}     />}
        {showPrepSheet && <PrepTimeSheet value={prepTime} onSelect={v => { setPrepTime(v); try { localStorage.setItem("merchant_prep_time", v) } catch { /* ignore */ } }} onClose={() => setShowPrepSheet(false)} />}
      </AnimatePresence>
    </>
  )
}
