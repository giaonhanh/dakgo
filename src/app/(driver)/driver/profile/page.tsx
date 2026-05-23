"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
      <div style={{ color: "#6a5a40", fontSize: 9, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", padding: "0 4px", marginBottom: 8 }}>{title}</div>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "0 14px" }}>
        {children}
      </div>
    </div>
  )
}

function Row({ icon, label, sub, children, danger = false, onClick, arrow = false }: {
  icon: string; label: string; sub?: string; children?: React.ReactNode; danger?: boolean; onClick?: () => void; arrow?: boolean
}) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: onClick ? "pointer" : "default" }}>
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
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [vals, setVals] = useState(["", "", ""])
  const [err, setErr] = useState(""); const [show, setShow] = useState(false)
  const labels = ["Mật khẩu hiện tại", "Mật khẩu mới (tối thiểu 6 ký tự)", "Xác nhận mật khẩu mới"]
  const setVal = (v: string) => setVals(a => { const n = [...a]; n[step - 1] = v; return n })
  const next = () => {
    setErr("")
    if (step === 1 && !vals[0]) return setErr("Vui lòng nhập mật khẩu hiện tại")
    if (step === 2 && vals[1].length < 6) return setErr("Tối thiểu 6 ký tự")
    if (step === 3) { if (vals[1] !== vals[2]) return setErr("Mật khẩu không khớp"); onClose(); return }
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
          <button onClick={next} style={{ height: 46, borderRadius: 12, border: "none", background: "linear-gradient(90deg,#FF6B00,#FF8C00)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Lexend" }}>{step === 3 ? "✓ Xác nhận" : "Tiếp theo →"}</button>
        </div>
      </div>
    </motion.div>
  )
}

/* ── vehicle edit sheet ── */
function VehicleSheet({ onClose }: { onClose: () => void }) {
  const [type, setType]   = useState("motorbike")
  const [plate, setPlate] = useState("47B1-23456")
  const [model, setModel] = useState("Honda Wave Alpha 2022")
  const TYPES = [
    { id: "motorbike", icon: "🛵", label: "Xe máy" },
    { id: "electric",  icon: "⚡", label: "Xe điện" },
    { id: "bicycle",   icon: "🚲", label: "Xe đạp" },
  ]
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(8,8,6,0.75)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#0e0b07", borderTop: "1px solid rgba(255,107,0,0.3)", borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>🛵 Cập nhật phương tiện</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} style={{ flex: 1, height: 56, borderRadius: 12, background: type === t.id ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${type === t.id ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.08)"}`, color: type === t.id ? "#FF8C00" : "#6a5a40", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        {[{ label: "Biển số xe", value: plate, set: setPlate, ph: "VD: 47B1-23456" }, { label: "Model xe", value: model, set: setModel, ph: "VD: Honda Wave Alpha 2022" }].map(f => (
          <div key={f.label} style={{ marginBottom: 12 }}>
            <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>{f.label}</div>
            <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={{ width: "100%", height: 44, padding: "0 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 11, color: "#f8f0e0", fontSize: 13, fontFamily: "Lexend" }} />
          </div>
        ))}
        <button onClick={onClose} style={{ width: "100%", height: 48, borderRadius: 14, border: "none", background: "linear-gradient(90deg,#FF6B00,#FF8C00)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Lexend", marginTop: 8 }}>✓ Lưu thay đổi</button>
      </div>
    </motion.div>
  )
}

/* ── bank sheet ── */
function BankSheet({ onClose }: { onClose: () => void }) {
  const BANKS = ["Vietcombank", "BIDV", "Agribank", "Techcombank", "MB Bank", "VPBank", "ACB", "VietinBank"]
  const [bank, setBank]   = useState("Vietcombank")
  const [acct, setAcct]   = useState("")
  const [name, setName]   = useState("")
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(8,8,6,0.75)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#0e0b07", borderTop: "1px solid rgba(255,107,0,0.3)", borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)", maxHeight: "85dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>🏦 Tài khoản ngân hàng</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ background: "rgba(74,143,245,0.08)", border: "1px solid rgba(74,143,245,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10 }}>
          <span style={{ fontSize: 16 }}>ℹ️</span>
          <span style={{ color: "#4a8ff5", fontSize: 10, lineHeight: 1.5 }}>Thu nhập được chuyển khoản mỗi thứ 2 hàng tuần sau khi khấu trừ hoa hồng nền tảng.</span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 8 }}>Ngân hàng</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {BANKS.map(b => (
              <button key={b} onClick={() => setBank(b)} style={{ padding: "6px 12px", borderRadius: 9, background: bank === b ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${bank === b ? "rgba(255,107,0,0.35)" : "rgba(255,255,255,0.08)"}`, color: bank === b ? "#FF8C00" : "#6a5a40", fontSize: 10, fontWeight: bank === b ? 700 : 400, cursor: "pointer", fontFamily: "Lexend" }}>{b}</button>
            ))}
          </div>
        </div>
        {[{ label: "Số tài khoản", value: acct, set: setAcct, ph: "VD: 1234567890" }, { label: "Tên chủ tài khoản", value: name, set: setName, ph: "VD: PHAM HONG MY" }].map(f => (
          <div key={f.label} style={{ marginBottom: 12 }}>
            <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>{f.label}</div>
            <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={{ width: "100%", height: 44, padding: "0 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 11, color: "#f8f0e0", fontSize: 13, fontFamily: "Lexend" }} />
          </div>
        ))}
        <button onClick={onClose} style={{ width: "100%", height: 48, borderRadius: 14, border: "none", background: "linear-gradient(90deg,#FF6B00,#FF8C00)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Lexend", marginTop: 8 }}>✓ Lưu tài khoản</button>
      </div>
    </motion.div>
  )
}

/* ── document sheet ── */
function DocSheet({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const DOCS = [
    { id: "cccd",    icon: "🪪", label: "CMND / CCCD",   status: "verified",  exp: "15/07/2029" },
    { id: "license", icon: "📋", label: "Bằng lái xe",    status: "verified",  exp: "30/12/2027" },
    { id: "regist",  icon: "📄", label: "Đăng ký xe",     status: "verified",  exp: "20/03/2026" },
    { id: "insure",  icon: "🛡", label: "Bảo hiểm xe",    status: "expiring",  exp: "10/06/2025" },
    { id: "avatar",  icon: "🤳", label: "Ảnh chân dung",  status: "verified",  exp: "" },
  ]
  const statusCfg = {
    verified: { color: "#3ecf6e", bg: "rgba(62,207,110,0.1)",   bd: "rgba(62,207,110,0.25)",  label: "✅ Đã xác minh" },
    expiring: { color: "#FFB347", bg: "rgba(255,179,71,0.1)",   bd: "rgba(255,179,71,0.25)",  label: "⏳ Sắp hết hạn" },
    pending:  { color: "#4a8ff5", bg: "rgba(74,143,245,0.1)",   bd: "rgba(74,143,245,0.25)",  label: "⏺ Đang duyệt" },
    rejected: { color: "#ff4040", bg: "rgba(255,64,64,0.1)",    bd: "rgba(255,64,64,0.25)",   label: "❌ Bị từ chối" },
  }
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(8,8,6,0.75)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setTimeout(() => setUploading(null), 2000) } e.target.value = "" }} />
      <div style={{ background: "#0e0b07", borderTop: "1px solid rgba(255,107,0,0.3)", borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)", maxHeight: "85dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>📄 Giấy tờ tài xế</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        {DOCS.map((d, i) => {
          const sc = statusCfg[d.status as keyof typeof statusCfg]
          return (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < DOCS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{d.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 600 }}>{d.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ background: sc.bg, border: `1px solid ${sc.bd}`, borderRadius: 5, padding: "1px 7px", color: sc.color, fontSize: 8, fontWeight: 700 }}>{sc.label}</span>
                  {d.exp && <span style={{ color: "#6a5a40", fontSize: 9 }}>HH: {d.exp}</span>}
                </div>
              </div>
              <button onClick={() => { setUploading(d.id); fileRef.current?.click() }} style={{ padding: "6px 12px", borderRadius: 9, background: d.status === "expiring" ? "rgba(255,179,71,0.1)" : "rgba(255,255,255,0.06)", border: `1px solid ${d.status === "expiring" ? "rgba(255,179,71,0.3)" : "rgba(255,255,255,0.1)"}`, color: d.status === "expiring" ? "#FFB347" : "#6a5a40", fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>
                {uploading === d.id ? "⏳" : "↑ Cập nhật"}
              </button>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ── main ── */
export default function DriverProfilePage() {
  const supabase = createClient()
  const [name, setName]       = useState("")
  const [phone, setPhone]     = useState("")
  const [userId, setUserId]   = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [avatar, setAvatar]   = useState<string | null>(null)
  const avatarRef             = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase.from("profiles").select("full_name, phone").eq("id", user.id).single()
        .then(({ data }) => {
          if (!data) return
          setName(data.full_name ?? "")
          setPhone(data.phone ?? "")
        })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* work settings */
  const [work, setWork] = useState({
    soundNewOrder:    true,
    vibrationOrder:   true,
    showPopup:        true,
    autoOnline:       false,
    nightMode:        false,
  })

  /* notification settings */
  const [notif, setNotif] = useState({
    orderAlerts: true,
    earnings:    true,
    promos:      false,
    system:      true,
  })

  /* sheets */
  const [showPw,      setShowPw]      = useState(false)
  const [showVehicle, setShowVehicle] = useState(false)
  const [showBank,    setShowBank]    = useState(false)
  const [showDocs,    setShowDocs]    = useState(false)
  const [toast, setToast]             = useState("")

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200) }
  const wk = (k: keyof typeof work)   => setWork(p => ({ ...p, [k]: !p[k] }))
  const nt = (k: keyof typeof notif)  => setNotif(p => ({ ...p, [k]: !p[k] }))

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
            style={{ position: "fixed", top: 62, left: "50%", transform: "translateX(-50%)", zIndex: 999, whiteSpace: "nowrap", background: "rgba(62,207,110,0.15)", border: "1px solid rgba(62,207,110,0.35)", borderRadius: 12, padding: "7px 18px", color: "#3ecf6e", fontSize: 11, fontWeight: 600, backdropFilter: "blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={avatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setAvatar(URL.createObjectURL(f)); e.target.value = "" }} />

      <div style={{ minHeight: "100dvh", background: "#080806", paddingBottom: 100 }}>

        {/* header */}
        <div style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(8,8,6,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/driver" style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#f8f0e0", fontSize: 15 }}>←</a>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>Hồ sơ & Cài đặt</div>
          <button onClick={async () => {
            if (editing && userId) {
              const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", userId)
              fire(error ? "❌ Lỗi lưu thông tin" : "Đã lưu thông tin!")
            }
            setEditing(e => !e)
          }}
            style={{ padding: "7px 14px", borderRadius: 9, background: editing ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.06)", border: editing ? "1px solid rgba(255,107,0,0.3)" : "1px solid rgba(255,255,255,0.1)", color: editing ? "#FF8C00" : "#6a5a40", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            {editing ? "💾 Lưu" : "✏️ Sửa"}
          </button>
        </div>

        <div style={{ padding: "16px 16px 0" }}>

          {/* avatar + stats */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 24px" }}>
            <div onClick={() => avatarRef.current?.click()} style={{ position: "relative", marginBottom: 14, cursor: "pointer" }}>
              <div style={{ width: 90, height: 90, borderRadius: 24, background: "linear-gradient(135deg,rgba(255,107,0,0.2),rgba(255,107,0,0.05))", border: "2.5px solid rgba(255,107,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, overflow: "hidden" }}>
                {avatar ? <img src={avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🧑‍💼"}
              </div>
              <div style={{ position: "absolute", bottom: -4, right: -4, width: 28, height: 28, borderRadius: 9, background: "rgba(255,107,0,0.12)", border: "2px solid #080806", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📷</div>
            </div>
            {editing ? (
              <input value={name} onChange={e => setName(e.target.value)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,107,0,0.3)", borderRadius: 10, padding: "6px 14px", color: "#f8f0e0", fontSize: 16, fontWeight: 800, textAlign: "center", marginBottom: 8 }} />
            ) : (
              <div style={{ color: "#f8f0e0", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{name}</div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
              <span style={{ background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.3)", borderRadius: 6, padding: "2px 10px", color: "#3ecf6e", fontSize: 9, fontWeight: 700 }}>🟢 Đang hoạt động</span>
              <span style={{ color: "#6a5a40", fontSize: 9 }}>· Tham gia 01/03/2024</span>
            </div>
            {/* quick stats */}
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              {[
                { icon: "⭐", val: "4.9", label: "Đánh giá" },
                { icon: "📦", val: "312", label: "Chuyến" },
                { icon: "💰", val: "245k", label: "Hôm nay" },
                { icon: "🗺", val: "38km", label: "Quãng đường" },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 16, marginBottom: 3 }}>{s.icon}</div>
                  <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 800 }}>{s.val}</div>
                  <div style={{ color: "#6a5a40", fontSize: 8 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* personal info */}
          <Section title="Thông tin cá nhân">
            <Row icon="👤" label="Họ và tên" sub={name} />
            <Row icon="📞" label="Số điện thoại" sub={phone} />
            <Row icon="🪪" label="CMND / CCCD" sub="••• ••• 6789" />
          </Section>

          {/* vehicle & docs */}
          <Section title="Phương tiện & Giấy tờ">
            <Row icon="🛵" label="Thông tin xe" sub="Honda Wave Alpha · 47B1-23456" onClick={() => setShowVehicle(true)} arrow />
            <Row icon="📄" label="Giấy tờ & Hồ sơ" sub="5 giấy tờ · 1 sắp hết hạn" onClick={() => setShowDocs(true)} arrow>
              <span style={{ background: "rgba(255,179,71,0.12)", border: "1px solid rgba(255,179,71,0.3)", borderRadius: 5, padding: "2px 7px", color: "#FFB347", fontSize: 8, fontWeight: 700 }}>1 sắp hết hạn</span>
            </Row>
          </Section>

          {/* earnings shortcut */}
          <Section title="Thu nhập">
            <Row icon="💰" label="Xem thu nhập chi tiết" sub="Tuần · Tháng · Lịch sử chuyến đi" onClick={() => { window.location.href = "/driver/earnings" }} arrow />
            <Row icon="🏦" label="Tài khoản ngân hàng" sub="Vietcombank · Chưa liên kết" onClick={() => setShowBank(true)} arrow>
              <span style={{ background: "rgba(255,64,64,0.1)", border: "1px solid rgba(255,64,64,0.2)", borderRadius: 5, padding: "2px 7px", color: "#ff4040", fontSize: 8, fontWeight: 700 }}>Chưa liên kết</span>
            </Row>
          </Section>

          {/* work settings */}
          <Section title="Cài đặt công việc">
            <Row icon="🔊" label="Âm thanh đơn mới" sub="Phát âm khi có đơn mới đến">
              <Toggle on={work.soundNewOrder} onToggle={() => wk("soundNewOrder")} />
            </Row>
            <Row icon="📳" label="Rung khi có đơn" sub="Rung thiết bị khi nhận đơn mới">
              <Toggle on={work.vibrationOrder} onToggle={() => wk("vibrationOrder")} />
            </Row>
            <Row icon="📲" label="Hiển thị popup đơn hàng" sub="Popup toàn màn hình khi có đơn mới">
              <Toggle on={work.showPopup} onToggle={() => wk("showPopup")} />
            </Row>
            <Row icon="⚡" label="Tự động online khi mở app" sub="Tự bật trạng thái khi khởi động app">
              <Toggle on={work.autoOnline} onToggle={() => wk("autoOnline")} color="#FFB347" />
            </Row>
            <Row icon="🌙" label="Chế độ ban đêm (22h–6h)" sub="Không nhận đơn trong khung giờ này">
              <Toggle on={work.nightMode} onToggle={() => wk("nightMode")} color="#b464ff" />
            </Row>
          </Section>

          {/* notification settings */}
          <Section title="Thông báo">
            <Row icon="📦" label="Cập nhật đơn hàng" sub="Trạng thái giao hàng, xác nhận">
              <Toggle on={notif.orderAlerts} onToggle={() => nt("orderAlerts")} />
            </Row>
            <Row icon="💰" label="Thông báo thu nhập" sub="Tổng kết ca, chuyển khoản thành công">
              <Toggle on={notif.earnings} onToggle={() => nt("earnings")} />
            </Row>
            <Row icon="🎁" label="Ưu đãi tài xế" sub="Bonus, thưởng hiệu suất">
              <Toggle on={notif.promos} onToggle={() => nt("promos")} color="#b464ff" />
            </Row>
            <Row icon="📢" label="Thông báo hệ thống" sub="Cập nhật app, bảo trì">
              <Toggle on={notif.system} onToggle={() => nt("system")} color="#4a8ff5" />
            </Row>
          </Section>

          {/* security */}
          <Section title="Bảo mật">
            <Row icon="🔑" label="Đổi mật khẩu" sub="Cập nhật mật khẩu đăng nhập" onClick={() => setShowPw(true)} arrow />
            <Row icon="📱" label="Phiên đăng nhập" sub="1 thiết bị đang hoạt động" onClick={() => fire("Tính năng đang phát triển...")} arrow />
            <Row icon="🛡" label="Xác thực 2 lớp" sub="Bảo vệ tài khoản bằng OTP" onClick={() => fire("Tính năng đang phát triển...")} arrow />
          </Section>

          {/* support */}
          <Section title="Hỗ trợ">
            <Row icon="❓" label="Câu hỏi thường gặp" sub="Hướng dẫn tài xế" onClick={() => fire("Đang mở FAQ...")} arrow />
            <Row icon="💬" label="Chat với hỗ trợ" sub="Phản hồi trong vòng 30 phút" onClick={() => fire("Đang kết nối...")} arrow />
            <Row icon="⚠️" label="Báo cáo vấn đề" sub="Khiếu nại, sự cố khi giao hàng" onClick={() => fire("Đang mở form...")} arrow />
            <Row icon="📝" label="Quy tắc tài xế" sub="Chính sách, điều khoản dịch vụ" onClick={() => fire("Đang mở tài liệu...")} arrow />
          </Section>

          {/* about */}
          <Section title="Về ứng dụng">
            <Row icon="🚀" label="Giao Nhanh Tài xế" sub="Phiên bản 1.0.0" />
            <Row icon="⚖️" label="Điều khoản & Chính sách" onClick={() => fire("Đang mở...")} arrow />
          </Section>

          {/* account */}
          <Section title="Tài khoản">
            <Row icon="🚪" label="Đăng xuất" sub="Đăng xuất khỏi thiết bị này" danger onClick={() => fire("Đang đăng xuất...")} arrow />
          </Section>
        </div>
      </div>

      {/* bottom nav */}
      <nav style={{ position: "fixed", bottom: 12, left: 14, right: 14, height: 56, borderRadius: 9999, zIndex: 50, background: "rgba(8,8,6,0.92)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,107,0,0.2)", boxShadow: "0 0 20px rgba(255,107,0,0.1)", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px" }}>
        {[
          { href: "/driver",          icon: "🏠", label: "Trang chủ", active: false },
          { href: "/driver/earnings", icon: "📊", label: "Thu nhập",  active: false },
          { href: "/driver/profile",  icon: "👤", label: "Hồ sơ",     active: true  },
        ].map(tab => (
          <a key={tab.href} href={tab.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textDecoration: "none", padding: "6px 16px", borderRadius: 20, background: tab.active ? "rgba(255,107,0,0.1)" : "transparent" }}>
            <span style={{ fontSize: 17 }}>{tab.icon}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: tab.active ? "#FF8C00" : "#6a5a40" }}>{tab.label}</span>
          </a>
        ))}
      </nav>

      <AnimatePresence>
        {showPw      && <PwSheet      onClose={() => setShowPw(false)}      />}
        {showVehicle && <VehicleSheet onClose={() => setShowVehicle(false)} />}
        {showBank    && <BankSheet    onClose={() => setShowBank(false)}    />}
        {showDocs    && <DocSheet     onClose={() => setShowDocs(false)}    />}
      </AnimatePresence>
    </>
  )
}
