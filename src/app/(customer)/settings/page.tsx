"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

/* ── helpers ── */
type Section = "notifications" | "security" | "payment" | "privacy" | "preferences" | "support" | "about" | "account"
type TierLevel = "bronze" | "silver" | "gold" | "platinum"

const TIER_CFG: Record<TierLevel, { label: string; color: string; icon: string }> = {
  bronze:   { label: "Bronze",   color: "#cd7f32", icon: "🥉" },
  silver:   { label: "Silver",   color: "#a8a9ad", icon: "🥈" },
  gold:     { label: "Gold",     color: "#f5c542", icon: "🥇" },
  platinum: { label: "Platinum", color: "#b464ff", icon: "💎" },
}

function Toggle({ on, onToggle, color = "#3ecf6e" }: { on: boolean; onToggle: () => void; color?: string }) {
  return (
    <button onClick={onToggle} style={{
      width: 46, height: 26, borderRadius: 13, flexShrink: 0, cursor: "pointer", border: "none",
      background: on ? color : "rgba(255,255,255,0.1)",
      position: "relative", transition: "background .25s",
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3, left: on ? 23 : 3,
        transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
      }} />
    </button>
  )
}

function Row({
  icon, label, sub, children, danger = false, onClick, arrow = false,
}: {
  icon: string; label: string; sub?: string; children?: React.ReactNode
  danger?: boolean; onClick?: () => void; arrow?: boolean
}) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "13px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: danger ? "rgba(255,64,64,0.1)" : "rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: danger ? "#ff4040" : "#f8f0e0", fontSize: 13, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
      {arrow && <div style={{ color: "#6a5a40", fontSize: 16, marginLeft: 4 }}>›</div>}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: "#6a5a40", fontSize: 9, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>{title}</div>
      <div style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "0 14px", overflow: "hidden",
      }}>
        {children}
      </div>
    </div>
  )
}

/* ── password sheet ── */
function PwSheet({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [old, setOld] = useState(""); const [nw, setNw] = useState(""); const [cf, setCf] = useState("")
  const [err, setErr] = useState(""); const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  const labels = ["Nhập mật khẩu hiện tại", "Nhập mật khẩu mới", "Xác nhận mật khẩu mới"]
  const vals = [old, nw, cf]; const sets = [setOld, setNw, setCf]

  const next = async () => {
    setErr("")
    if (step === 1 && !old.trim()) return setErr("Vui lòng nhập mật khẩu hiện tại")
    if (step === 2 && nw.length < 6)  return setErr("Mật khẩu mới tối thiểu 6 ký tự")
    if (step === 3) {
      if (nw !== cf) return setErr("Mật khẩu xác nhận không khớp")
      setSaving(true)
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: nw })
      setSaving(false)
      if (error) return setErr("Lỗi: " + error.message)
      onClose()
      return
    }
    setStep(s => (s + 1) as 1 | 2 | 3)
  }

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{
        position: "fixed", inset: 0, top: 0, zIndex: 90,
        background: "rgba(8,8,6,0.7)", backdropFilter: "blur(6px)",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}>
      <div style={{
        background: "#0e0b07", borderTop: "1px solid rgba(255,107,0,0.3)",
        borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>🔑 Đổi mật khẩu</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        {/* step dots */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 22 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: s < 3 ? 1 : 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: step >= s ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)",
                border: `2px solid ${step >= s ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.1)"}`,
                color: step >= s ? "#FF8C00" : "#6a5a40",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800,
              }}>{s}</div>
              {s < 3 && <div style={{ flex: 1, height: 2, background: step > s ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.06)" }} />}
            </div>
          ))}
        </div>
        <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 10 }}>{labels[step - 1]}</div>
        <div style={{ position: "relative" }}>
          <input
            type={show ? "text" : "password"}
            value={vals[step - 1]}
            onChange={e => sets[step - 1](e.target.value)}
            onKeyDown={e => e.key === "Enter" && next()}
            placeholder="••••••••"
            autoFocus
            style={{
              width: "100%", height: 48, padding: "0 48px 0 16px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,107,0,0.25)",
              borderRadius: 12, color: "#f8f0e0", fontSize: 14, fontFamily: "Lexend",
            }}
          />
          <button onClick={() => setShow(s => !s)} style={{
            position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "#6a5a40", fontSize: 16, cursor: "pointer",
          }}>{show ? "🙈" : "👁"}</button>
        </div>
        {err && <div style={{ color: "#ff4040", fontSize: 11, marginTop: 8 }}>⚠ {err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginTop: 16 }}>
          <button onClick={step > 1 ? () => setStep(s => (s - 1) as 1 | 2 | 3) : onClose}
            style={{ height: 46, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#b0956a", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>
            {step > 1 ? "← Quay lại" : "Hủy"}
          </button>
          <button onClick={next} disabled={saving} style={{
            height: 46, borderRadius: 12, border: "none",
            background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
            color: "#fff", fontSize: 13, fontWeight: 800, cursor: saving ? "default" : "pointer", fontFamily: "Lexend",
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "Đang lưu..." : step === 3 ? "✓ Xác nhận" : "Tiếp theo →"}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ── session list sheet ── */
function SessionSheet({ onClose }: { onClose: () => void }) {
  const SESSIONS = [
    { device: "iPhone 14 Pro", browser: "Safari · iOS", location: "Phước An, Đắk Lắk", time: "Hoạt động ngay bây giờ", current: true },
    { device: "Chrome · Windows", browser: "Chrome 124", location: "Phước An, Đắk Lắk", time: "2 ngày trước", current: false },
    { device: "Samsung Galaxy", browser: "Samsung Internet", location: "Buôn Ma Thuột", time: "5 ngày trước", current: false },
  ]
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position: "fixed", inset: 0, top: 0, zIndex: 90, background: "rgba(8,8,6,0.7)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#0e0b07", borderTop: "1px solid rgba(255,107,0,0.3)", borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>📱 Phiên đăng nhập</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        {SESSIONS.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < SESSIONS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.current ? "rgba(62,207,110,0.1)" : "rgba(255,255,255,0.05)", border: s.current ? "1px solid rgba(62,207,110,0.25)" : "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              {s.device.includes("iPhone") || s.device.includes("Galaxy") ? "📱" : "💻"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 600 }}>{s.device}</span>
                {s.current && <span style={{ background: "rgba(62,207,110,0.12)", border: "1px solid rgba(62,207,110,0.3)", borderRadius: 5, padding: "1px 7px", color: "#3ecf6e", fontSize: 8, fontWeight: 700 }}>Hiện tại</span>}
              </div>
              <div style={{ color: "#6a5a40", fontSize: 10 }}>{s.browser} · {s.location}</div>
              <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 2 }}>{s.time}</div>
            </div>
            {!s.current && (
              <button style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend", flexShrink: 0 }}>Đăng xuất</button>
            )}
          </div>
        ))}
        <button style={{ width: "100%", height: 44, borderRadius: 12, background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend", marginTop: 16 }}>
          🚪 Đăng xuất tất cả thiết bị khác
        </button>
      </div>
    </motion.div>
  )
}

/* ── payment sheet ── */
function PaymentSheet({ onClose, walletBalance }: { onClose: () => void; walletBalance: number }) {
  const [selected, setSelected] = useState("cash")
  const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"
  const METHODS = [
    { id: "cash",   icon: "💵", label: "Tiền mặt",      sub: "Thanh toán khi nhận hàng" },
    { id: "vietqr", icon: "🏦", label: "VietQR",        sub: "Chuyển khoản ngân hàng" },
    { id: "momo",   icon: "🟣", label: "MoMo",          sub: "Ví điện tử MoMo" },
    { id: "wallet", icon: "👛", label: "Ví Giao Nhanh", sub: `Số dư: ${fmt(walletBalance)}` },
  ]
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position: "fixed", inset: 0, top: 0, zIndex: 90, background: "rgba(8,8,6,0.7)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#0e0b07", borderTop: "1px solid rgba(255,107,0,0.3)", borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>💳 Phương thức thanh toán</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 14 }}>Chọn phương thức mặc định khi đặt đơn</div>
        {METHODS.map(m => (
          <div key={m.id} onClick={() => setSelected(m.id)} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            borderRadius: 12, marginBottom: 8, cursor: "pointer",
            background: selected === m.id ? "rgba(255,107,0,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${selected === m.id ? "rgba(255,107,0,0.35)" : "rgba(255,255,255,0.07)"}`,
          }}>
            <span style={{ fontSize: 22 }}>{m.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 600 }}>{m.label}</div>
              <div style={{ color: "#6a5a40", fontSize: 10 }}>{m.sub}</div>
            </div>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              border: `2px solid ${selected === m.id ? "#FF8C00" : "rgba(255,255,255,0.15)"}`,
              background: selected === m.id ? "rgba(255,107,0,0.2)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {selected === m.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF8C00" }} />}
            </div>
          </div>
        ))}
        <button onClick={onClose} style={{ width: "100%", height: 48, borderRadius: 14, border: "none", background: "linear-gradient(90deg,#FF6B00,#FF8C00)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Lexend", marginTop: 8 }}>
          ✓ Lưu thay đổi
        </button>
      </div>
    </motion.div>
  )
}

/* ── main ── */
export default function CustomerSettingsPage() {
  /* realtime data */
  const [userId,        setUserId]        = useState<string | null>(null)
  const [fullName,      setFullName]      = useState("Đang tải...")
  const [phone,         setPhone]         = useState("")
  const [walletBalance, setWalletBalance] = useState(0)
  const [loyaltyPoints, setLoyaltyPoints] = useState(0)
  const [tier,          setTier]          = useState<TierLevel>("bronze")
  const [dataLoading,   setDataLoading]   = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const [
        { data: profile },
        { data: wallet },
        { data: loyalty },
      ] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("id", user.id).single(),
        supabase.from("wallets").select("balance").eq("user_id", user.id).eq("type", "customer").single(),
        supabase.from("loyalty_points").select("total_points, tier").eq("user_id", user.id).single(),
      ])
      if (profile) {
        setFullName(profile.full_name ?? "Khách hàng")
        setPhone(profile.phone ?? "")
      }
      if (wallet) setWalletBalance(wallet.balance ?? 0)
      if (loyalty) {
        setLoyaltyPoints(loyalty.total_points ?? 0)
        setTier((loyalty.tier as TierLevel) ?? "bronze")
      }
      setDataLoading(false)
    })
  }, [])

  const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"
  const tierCfg = TIER_CFG[tier]

  /* notification toggles */
  const [notif, setNotif] = useState({
    orderUpdates:   true,
    orderAccepted:  true,
    driverNear:     true,
    promotions:     true,
    flashSale:      false,
    newVoucher:     true,
    loyalty:        true,
    systemAlerts:   true,
    sound:          true,
    vibration:      true,
  })

  /* privacy toggles */
  const [privacy, setPrivacy] = useState({
    shareLocation:  true,
    shareAnalytics: false,
    personalized:   true,
    reviewVisible:  true,
  })

  /* preferences */
  const [prefs, setPrefs] = useState({
    language:    "vi",
    darkMode:    true,
    reducedAnim: false,
    autoFill:    true,
    saveHistory: true,
  })

  /* sheet states */
  const [showPw, setShowPw]         = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const [showPayment, setShowPayment]   = useState(false)
  const [showDelete, setShowDelete]     = useState(false)
  const [toast, setToast]               = useState("")

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200) }

  const nt = (key: keyof typeof notif) => setNotif(p => ({ ...p, [key]: !p[key] }))
  const pv = (key: keyof typeof privacy) => setPrivacy(p => ({ ...p, [key]: !p[key] }))
  const pf = (key: keyof typeof prefs) => setPrefs(p => ({ ...p, [key]: !(p[key] as boolean) }))

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{display:none}
        input{font-family:'Lexend',sans-serif;outline:none}
        button{font-family:'Lexend',sans-serif}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 999, whiteSpace: "nowrap", background: "rgba(62,207,110,0.15)", border: "1px solid rgba(62,207,110,0.35)", borderRadius: 12, padding: "7px 18px", color: "#3ecf6e", fontSize: 11, fontWeight: 600, backdropFilter: "blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ minHeight: "100dvh", background: "#080806", paddingBottom: 100 }}>

        {/* header — safe area */}
        <div style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(8,8,6,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingTop: "env(safe-area-inset-top)" }}>
          <div style={{ height: 56, padding: "0 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/profile" style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#f8f0e0", fontSize: 15 }}>←</a>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>Cài đặt</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 16px 0" }}>

          {/* profile summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 16, marginBottom: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: "rgba(255,107,0,0.15)", border: "2px solid rgba(255,107,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 800 }}>{dataLoading ? "Đang tải..." : fullName}</div>
              <div style={{ color: "#6a5a40", fontSize: 10 }}>{phone} · Khách hàng</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                <span style={{ background: `${tierCfg.color}18`, border: `1px solid ${tierCfg.color}44`, borderRadius: 5, padding: "1px 8px", color: tierCfg.color, fontSize: 8, fontWeight: 700 }}>{tierCfg.icon} {tierCfg.label}</span>
                <span style={{ color: "#6a5a40", fontSize: 9 }}>· {dataLoading ? "—" : loyaltyPoints.toLocaleString("vi-VN")} điểm</span>
              </div>
            </div>
            <a href="/profile" style={{ padding: "7px 12px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#b0956a", fontSize: 10, fontWeight: 700, textDecoration: "none" }}>Sửa hồ sơ</a>
          </div>

          {/* NOTIFICATIONS */}
          <SectionCard title="Thông báo">
            <Row icon="🔔" label="Cập nhật đơn hàng" sub="Trạng thái đơn, tài xế nhận đơn, giao hàng">
              <Toggle on={notif.orderUpdates} onToggle={() => nt("orderUpdates")} />
            </Row>
            <Row icon="🛵" label="Tài xế sắp đến" sub="Thông báo khi tài xế còn ~5 phút đến">
              <Toggle on={notif.driverNear} onToggle={() => nt("driverNear")} />
            </Row>
            <Row icon="🏷" label="Khuyến mãi & Voucher" sub="Mã giảm giá, ưu đãi cửa hàng">
              <Toggle on={notif.promotions} onToggle={() => nt("promotions")} />
            </Row>
            <Row icon="⚡" label="Flash Sale" sub="Thông báo khi có sale trong giờ">
              <Toggle on={notif.flashSale} onToggle={() => nt("flashSale")} color="#FFB347" />
            </Row>
            <Row icon="🎁" label="Voucher mới" sub="Nhận ngay khi hệ thống phát mã">
              <Toggle on={notif.newVoucher} onToggle={() => nt("newVoucher")} />
            </Row>
            <Row icon="⭐" label="Điểm tích lũy" sub="Nhận điểm, lên hạng, đổi quà">
              <Toggle on={notif.loyalty} onToggle={() => nt("loyalty")} color="#b464ff" />
            </Row>
            <Row icon="📢" label="Thông báo hệ thống" sub="Cập nhật ứng dụng, bảo trì">
              <Toggle on={notif.systemAlerts} onToggle={() => nt("systemAlerts")} color="#4a8ff5" />
            </Row>
            <Row icon="🔊" label="Âm thanh thông báo" sub="Phát âm khi có thông báo mới">
              <Toggle on={notif.sound} onToggle={() => nt("sound")} />
            </Row>
            <Row icon="📳" label="Rung khi thông báo" sub="Rung thiết bị khi nhận thông báo">
              <Toggle on={notif.vibration} onToggle={() => nt("vibration")} />
            </Row>
          </SectionCard>

          {/* SECURITY */}
          <SectionCard title="Bảo mật & Tài khoản">
            <Row icon="🔑" label="Đổi mật khẩu" sub="Cập nhật mật khẩu đăng nhập" onClick={() => setShowPw(true)} arrow />
            <Row icon="📱" label="Phiên đăng nhập" sub="Quản lý thiết bị đang đăng nhập" onClick={() => setShowSessions(true)} arrow />
            <Row icon="🛡" label="Xác thực 2 lớp" sub="Bảo vệ tài khoản bằng OTP qua SMS">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "rgba(255,64,64,0.1)", border: "1px solid rgba(255,64,64,0.25)", borderRadius: 6, padding: "2px 8px", color: "#ff4040", fontSize: 8, fontWeight: 700 }}>Chưa bật</span>
                <div style={{ color: "#6a5a40", fontSize: 14 }}>›</div>
              </div>
            </Row>
            <Row icon="🗑" label="Xóa tài khoản" sub="Xóa vĩnh viễn tài khoản và dữ liệu" danger onClick={() => setShowDelete(true)} arrow />
          </SectionCard>

          {/* PAYMENT */}
          <SectionCard title="Thanh toán">
            <Row icon="💳" label="Phương thức mặc định" sub="Tiền mặt · Thay đổi" onClick={() => setShowPayment(true)} arrow />
            <Row
              icon="👛"
              label="Ví Giao Nhanh"
              sub={dataLoading ? "Đang tải..." : `Số dư: ${fmt(walletBalance)}`}
              onClick={() => { window.location.href = "/wallet" }}
              arrow
            />
            <Row
              icon="🎖"
              label="Điểm tích lũy"
              sub={dataLoading ? "Đang tải..." : `${loyaltyPoints.toLocaleString("vi-VN")} điểm · Xem lịch sử`}
              onClick={() => { window.location.href = "/wallet/points" }}
              arrow
            />
            <Row icon="🎟" label="Kho voucher" sub="Xem tất cả mã giảm giá" onClick={() => { window.location.href = "/vouchers" }} arrow />
          </SectionCard>

          {/* PRIVACY */}
          <SectionCard title="Quyền riêng tư">
            <Row icon="📍" label="Chia sẻ vị trí" sub="Cho phép app truy cập GPS để giao hàng">
              <Toggle on={privacy.shareLocation} onToggle={() => pv("shareLocation")} />
            </Row>
            <Row icon="📊" label="Phân tích sử dụng" sub="Giúp cải thiện trải nghiệm ứng dụng">
              <Toggle on={privacy.shareAnalytics} onToggle={() => pv("shareAnalytics")} color="#4a8ff5" />
            </Row>
            <Row icon="🎯" label="Cá nhân hóa gợi ý" sub="Đề xuất món ăn, quán gần bạn theo lịch sử">
              <Toggle on={privacy.personalized} onToggle={() => pv("personalized")} />
            </Row>
            <Row icon="⭐" label="Đánh giá công khai" sub="Hiển thị tên bạn trong đánh giá quán">
              <Toggle on={privacy.reviewVisible} onToggle={() => pv("reviewVisible")} />
            </Row>
          </SectionCard>

          {/* PREFERENCES */}
          <SectionCard title="Giao diện & Ứng dụng">
            <Row icon="🌙" label="Giao diện tối" sub="Dark mode (mặc định)">
              <Toggle on={prefs.darkMode} onToggle={() => pf("darkMode")} />
            </Row>
            <Row icon="✨" label="Hiệu ứng chuyển trang" sub="Animation khi điều hướng">
              <Toggle on={!prefs.reducedAnim} onToggle={() => pf("reducedAnim")} />
            </Row>
            <Row icon="💾" label="Tự điền địa chỉ" sub="Gợi ý địa chỉ đã dùng gần đây">
              <Toggle on={prefs.autoFill} onToggle={() => pf("autoFill")} />
            </Row>
            <Row icon="📜" label="Lưu lịch sử đặt hàng" sub="Đề xuất đặt lại món yêu thích">
              <Toggle on={prefs.saveHistory} onToggle={() => pf("saveHistory")} />
            </Row>
            <Row icon="🌐" label="Ngôn ngữ" sub="Tiếng Việt" onClick={() => fire("Hiện tại chỉ hỗ trợ Tiếng Việt")} arrow />
            <Row icon="📍" label="Địa chỉ đã lưu" sub="Quản lý nhà, cơ quan..." onClick={() => { window.location.href = "/addresses" }} arrow />
          </SectionCard>

          {/* SUPPORT */}
          <SectionCard title="Hỗ trợ">
            <Row icon="❓" label="Câu hỏi thường gặp" sub="FAQ · Hướng dẫn sử dụng" onClick={() => fire("Đang mở trang FAQ...")} arrow />
            <Row icon="💬" label="Chat với hỗ trợ" sub="Phản hồi trong vòng 30 phút" onClick={() => window.open("https://zalo.me/0000000000", "_blank")} arrow />
            <Row icon="⚠️" label="Báo cáo vấn đề" sub="Đơn hàng sai, tài xế vi phạm..." onClick={() => window.open("https://zalo.me/0000000000", "_blank")} arrow />
            <Row icon="⭐" label="Đánh giá ứng dụng" sub="Để lại nhận xét trên trình duyệt" onClick={() => fire("Cảm ơn bạn đã đánh giá!")} arrow />
          </SectionCard>

          {/* ABOUT */}
          <SectionCard title="Về ứng dụng">
            <Row icon="🚀" label="Giao Nhanh" sub="Phiên bản 1.0.0 · Build 100" />
            <Row icon="📄" label="Điều khoản dịch vụ" onClick={() => fire("Đang mở điều khoản...")} arrow />
            <Row icon="🔏" label="Chính sách quyền riêng tư" onClick={() => fire("Đang mở chính sách...")} arrow />
            <Row icon="⚖️" label="Giấy phép mã nguồn" onClick={() => fire("Đang mở giấy phép...")} arrow />
            <Row icon="📬" label="Liên hệ" sub="giaonhanh.phuocan@gmail.com" />
          </SectionCard>

          {/* ACCOUNT */}
          <SectionCard title="Tài khoản">
            <Row icon="🚪" label="Đăng xuất" sub="Đăng xuất khỏi thiết bị này" danger
              onClick={async () => { const sb = createClient(); await sb.auth.signOut(); window.location.href = "/login" }} arrow />
          </SectionCard>
        </div>
      </div>

      {/* sheets */}
      <AnimatePresence>
        {showPw       && <PwSheet onClose={() => { setShowPw(false); fire("Đã đổi mật khẩu thành công") }} />}
        {showSessions && <SessionSheet onClose={() => setShowSessions(false)} />}
        {showPayment  && <PaymentSheet onClose={() => setShowPayment(false)} walletBalance={walletBalance} />}
      </AnimatePresence>

      {/* delete confirm */}
      <AnimatePresence>
        {showDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(8,8,6,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: .9, opacity: 0 }}
              style={{ background: "#0e0b07", border: "1px solid rgba(255,64,64,0.3)", borderRadius: 20, padding: 24, maxWidth: 340, width: "100%" }}>
              <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>⚠️</div>
              <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>Xóa tài khoản?</div>
              <div style={{ color: "#6a5a40", fontSize: 11, textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>
                Toàn bộ lịch sử đơn hàng, điểm tích lũy và voucher sẽ bị xóa vĩnh viễn. Hành động này <strong style={{ color: "#ff4040" }}>không thể hoàn tác</strong>.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button onClick={() => setShowDelete(false)} style={{ height: 44, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#b0956a", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>
                  Hủy
                </button>
                <button style={{ height: 44, borderRadius: 12, background: "rgba(255,64,64,0.12)", border: "1px solid rgba(255,64,64,0.3)", color: "#ff4040", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>
                  Xóa tài khoản
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
