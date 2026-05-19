"use client"

import React, { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

// --- Types ---
interface NotifSettings {
  order:  boolean
  promo:  boolean
  system: boolean
  driver: boolean
}

type PwStep = "current" | "new" | "confirm"

// --- Data ---
const USER = {
  name:        "Nguyễn Minh Tuấn",
  phone:       "0901 234 567",
  email:       "",
  avatarUrl:   "",
  tier:        "Silver",
  points:      1840,   // điểm tích từ đơn hàng — dùng xét hạng
  walletXu:   185000,  // xu nạp vào ví — dùng thanh toán
  nextTier:    "Gold",
  nextPts:     5000,
  joinDate:    "Tháng 3, 2024",
  totalOrders: 42,
}

const TIER_CFG = {
  Bronze:   { color: "#CD7F32", bg: "rgba(205,127,50,0.12)",  bd: "rgba(205,127,50,0.3)",  icon: "🥉" },
  Silver:   { color: "#b0b8c1", bg: "rgba(176,184,193,0.12)", bd: "rgba(176,184,193,0.3)", icon: "🥈" },
  Gold:     { color: "#FFD700", bg: "rgba(255,215,0,0.12)",   bd: "rgba(255,215,0,0.3)",   icon: "🥇" },
  Platinum: { color: "#b464ff", bg: "rgba(180,100,255,0.12)", bd: "rgba(180,100,255,0.3)", icon: "💎" },
}

const NOTIF_ROWS = [
  { key: "order"  as const, icon: "📦", label: "Đơn hàng",   sub: "Trạng thái giao hàng, tài xế đến" },
  { key: "driver" as const, icon: "🏍️", label: "Tài xế",     sub: "Tài xế nhận đơn, ETA" },
  { key: "promo"  as const, icon: "🏷️", label: "Khuyến mãi", sub: "Voucher mới, flash sale" },
  { key: "system" as const, icon: "⚙️", label: "Hệ thống",   sub: "Cập nhật, bảo trì" },
]

const initials = (name: string) =>
  name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase()

// --- Sub-components ---
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 6px" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      <span style={{
        color: "#6a5a40", fontSize: 8.5, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap",
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  )
}

function SettingRow({ icon, label, sub, right, onClick, danger }: {
  icon: string; label: string; sub?: string
  right?: React.ReactNode; onClick?: () => void; danger?: boolean
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: danger ? "#ff6060" : "#f8f0e0", fontSize: 11.5, fontWeight: 500 }}>
          {label}
        </div>
        {sub && <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 1 }}>{sub}</div>}
      </div>
      {right !== undefined
        ? right
        : onClick
          ? <span style={{ color: "#6a5a40", fontSize: 13 }}>›</span>
          : null
      }
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{
        width: 40, height: 22, borderRadius: 11, cursor: "pointer",
        background: on ? "linear-gradient(90deg,#FF6B00,#FF8C00)" : "rgba(255,255,255,0.1)",
        border: `1px solid ${on ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.12)"}`,
        position: "relative", transition: "all .25s", flexShrink: 0,
        boxShadow: on ? "0 0 8px rgba(255,107,0,0.3)" : "none",
      }}
    >
      <div style={{
        position: "absolute", top: 2,
        left: on ? 20 : 2, width: 16, height: 16, borderRadius: "50%",
        background: "#fff", transition: "left .25s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }} />
    </div>
  )
}

function InputField({ label, value, onChange, type = "text", placeholder, icon }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; icon?: string
}) {
  const [focus, setFocus] = useState(false)
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ color: "rgba(176,149,106,0.6)", fontSize: 9.5, display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${focus ? "rgba(255,107,0,0.55)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 12, padding: "0 12px", height: 44,
        transition: "all .2s",
        boxShadow: focus ? "0 0 0 3px rgba(255,107,0,0.09)" : "none",
      }}>
        {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "#f8f0e0", fontSize: 12, fontFamily: "Lexend",
          }}
        />
      </div>
    </div>
  )
}

// --- Main ---
export default function ProfilePage() {
  const router  = useRouter()
  const supabase = createClient()

  const [name,       setName]       = useState(USER.name)
  const [email,      setEmail]      = useState(USER.email)
  const [avatarUrl,  setAvatarUrl]  = useState(USER.avatarUrl)
  const [notif,      setNotif]      = useState<NotifSettings>({ order: true, promo: false, system: true, driver: true })
  const [showPw,     setShowPw]     = useState(false)
  const [pwStep,     setPwStep]     = useState<PwStep>("current")
  const [curPw,      setCurPw]      = useState("")
  const [newPw,      setNewPw]      = useState("")
  const [confirmPw,  setConfirmPw]  = useState("")
  const [showLogout, setShowLogout] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [toast,      setToast]      = useState("")
  const [editMode,   setEditMode]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const tier = TIER_CFG[USER.tier as keyof typeof TIER_CFG]
  const pct  = Math.round((USER.points / USER.nextPts) * 100)

  const pwStepLabel: Record<PwStep, string> = {
    current: "Nhập mật khẩu hiện tại",
    new:     "Nhập mật khẩu mới",
    confirm: "Xác nhận mật khẩu mới",
  }
  const pwStepPct: Record<PwStep, number> = { current: 33, new: 66, confirm: 100 }
  const pwStepNum: Record<PwStep, number> = { current: 1,  new: 2,  confirm: 3  }

  const pwValue    = pwStep === "current" ? curPw    : pwStep === "new" ? newPw    : confirmPw
  const pwOnChange = pwStep === "current" ? setCurPw : pwStep === "new" ? setNewPw : setConfirmPw

  const fireToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 2400)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUrl(URL.createObjectURL(file))
    fireToast("Đã cập nhật ảnh đại diện")
  }

  const handleSave = () => {
    setEditMode(false)
    fireToast("Đã lưu thông tin cá nhân")
  }

  const handlePwNext = () => {
    if (pwStep === "current") {
      if (!curPw) return
      setPwStep("new")
    } else if (pwStep === "new") {
      if (newPw.length < 8) { fireToast("Mật khẩu phải có ít nhất 8 ký tự"); return }
      setPwStep("confirm")
    } else {
      if (newPw !== confirmPw) { fireToast("Mật khẩu xác nhận không khớp"); return }
      fireToast("Đã đổi mật khẩu thành công!")
      setShowPw(false)
      setPwStep("current")
      setCurPw(""); setNewPw(""); setConfirmPw("")
    }
  }

  const handleLogout = async () => {
    fireToast("Đã đăng xuất")
    setShowLogout(false)
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const CARD_STYLE: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14, padding: "2px 13px",
  }

  return (
    <>
      <style>{`
        @keyframes shimmer      { 0% { left: -60%; } 100% { left: 120%; } }
        @keyframes purplePulse  { 0%,100% { box-shadow: 0 0 16px rgba(180,100,255,0.2) } 50% { box-shadow: 0 0 28px rgba(180,100,255,0.38) } }
        @keyframes goldPulse    { 0%,100% { box-shadow: 0 0 16px rgba(245,197,66,0.15) } 50% { box-shadow: 0 0 28px rgba(245,197,66,0.3)  } }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            style={{
              position: "fixed", top: 52, left: "50%", transform: "translateX(-50%)",
              zIndex: 999, whiteSpace: "nowrap",
              background: "rgba(62,207,110,0.15)", border: "1px solid rgba(62,207,110,0.35)",
              borderRadius: 12, padding: "7px 18px", color: "#3ecf6e",
              fontSize: 11, fontWeight: 600, backdropFilter: "blur(10px)",
            }}
          >
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Đổi mật khẩu — 3 bước */}
      <AnimatePresence>
        {showPw && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowPw(false); setPwStep("current") }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 190, backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 191,
                background: "#0e0c09", border: "1px solid rgba(255,107,0,0.15)",
                borderRadius: "20px 20px 0 0", padding: "20px 18px 36px",
              }}
            >
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 18px" }} />
              <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Đổi mật khẩu</div>

              {/* Progress bar */}
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
                <motion.div
                  animate={{ width: `${pwStepPct[pwStep]}%` }}
                  transition={{ duration: 0.3 }}
                  style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#FF6B00,#FF8C00)" }}
                />
              </div>

              <div style={{ color: "#b0956a", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                Bước {pwStepNum[pwStep]}/3 · {pwStepLabel[pwStep]}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={pwStep}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}
                >
                  <InputField
                    label={pwStepLabel[pwStep]}
                    type="password"
                    placeholder="••••••••"
                    icon="🔒"
                    value={pwValue}
                    onChange={pwOnChange}
                  />
                  {pwStep === "new" && newPw.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 3, marginTop: -4 }}>
                        {[1, 2, 3].map(i => (
                          <div key={i} style={{
                            flex: 1, height: 3, borderRadius: 2,
                            background: newPw.length >= i * 4
                              ? i === 1 ? "#ff4040" : i === 2 ? "#f5c542" : "#3ecf6e"
                              : "rgba(255,255,255,0.07)",
                            transition: "background .2s",
                          }} />
                        ))}
                      </div>
                      <div style={{ color: "#6a5a40", fontSize: 8, marginTop: 4 }}>
                        {newPw.length < 4 ? "Yếu" : newPw.length < 8 ? "Trung bình" : "Mạnh"}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <button
                onClick={handlePwNext}
                style={{
                  width: "100%", height: 46, borderRadius: 12, border: "none",
                  background: "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
                  color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "Lexend",
                  cursor: "pointer", position: "relative", overflow: "hidden",
                  boxShadow: "0 3px 14px rgba(255,107,0,0.35)",
                }}
              >
                <div style={{
                  position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                  background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                  animation: "shimmer 2.5s infinite",
                }} />
                <span style={{ position: "relative", zIndex: 1 }}>
                  {pwStep === "confirm" ? "✓ Xác nhận đổi mật khẩu" : "Tiếp theo →"}
                </span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Xác nhận đăng xuất */}
      <AnimatePresence>
        {showLogout && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowLogout(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 190, backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 191,
                background: "#0e0c09", border: "1px solid rgba(255,107,0,0.15)",
                borderRadius: "20px 20px 0 0", padding: "20px 18px 36px",
              }}
            >
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 18px" }} />
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🚪</div>
                <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Đăng xuất?</div>
                <div style={{ color: "#6a5a40", fontSize: 10 }}>Bạn sẽ cần đăng nhập lại để sử dụng app</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowLogout(false)}
                  style={{
                    flex: 1, height: 44, borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                    color: "#b0956a", fontSize: 12, fontWeight: 600, fontFamily: "Lexend", cursor: "pointer",
                  }}
                >Hủy</button>
                <button
                  onClick={handleLogout}
                  style={{
                    flex: 1, height: 44, borderRadius: 12, border: "none",
                    background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
                    color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "Lexend", cursor: "pointer",
                  }}
                >Đăng xuất</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Xác nhận xóa tài khoản */}
      <AnimatePresence>
        {showDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDelete(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 190, backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 191,
                background: "#0e0c09", border: "1px solid rgba(255,64,64,0.2)",
                borderRadius: "20px 20px 0 0", padding: "20px 18px 36px",
              }}
            >
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 18px" }} />
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
                <div style={{ color: "#ff6060", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Xóa tài khoản?</div>
                <div style={{ color: "#6a5a40", fontSize: 10, lineHeight: 1.6 }}>
                  Toàn bộ lịch sử đơn hàng, điểm tích lũy và thông tin<br />
                  của bạn sẽ bị xóa vĩnh viễn. Không thể khôi phục.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowDelete(false)}
                  style={{
                    flex: 1, height: 44, borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                    color: "#b0956a", fontSize: 12, fontWeight: 600, fontFamily: "Lexend", cursor: "pointer",
                  }}
                >Giữ lại</button>
                <button
                  onClick={() => { fireToast("Đã gửi yêu cầu xóa tài khoản"); setShowDelete(false) }}
                  style={{
                    flex: 1, height: 44, borderRadius: 12, border: "none",
                    background: "linear-gradient(90deg,#ff4040,#ff6060)",
                    color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "Lexend", cursor: "pointer",
                  }}
                >Xóa tài khoản</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Root — zIndex 60 che FloatingBottomMenu (z-50) của layout */}
      <div style={{
        position: "fixed", inset: 0, background: "#080806", zIndex: 60,
        display: "flex", flexDirection: "column", fontFamily: "'Lexend',sans-serif",
      }}>

        {/* Header */}
        <div style={{
          background: "rgba(8,8,6,0.96)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "44px 16px 12px", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => router.back()}
              style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, cursor: "pointer", color: "#FF8C00",
              }}
            >←</button>
            <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 700 }}>
              Hồ sơ cá nhân
            </div>
            <button
              onClick={() => editMode ? handleSave() : setEditMode(true)}
              style={{
                padding: "6px 14px", borderRadius: 9, cursor: "pointer",
                background: editMode ? "linear-gradient(90deg,#FF6B00,#FF8C00)" : "rgba(255,107,0,0.1)",
                border: editMode ? "none" : "1px solid rgba(255,107,0,0.25)",
                color: editMode ? "#fff" : "#FF8C00",
                fontSize: 10, fontWeight: 700, fontFamily: "Lexend", transition: "all .2s",
              }}
            >
              {editMode ? "✓ Lưu" : "✏️ Sửa"}
            </button>
          </div>
        </div>

        {/* Scroll body */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "0 16px 88px",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}>

          {/* Avatar + Name + Stats */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 14px", position: "relative" }}>
            <div style={{
              position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
              width: 160, height: 160,
              background: "radial-gradient(circle,rgba(255,107,0,0.1) 0%,transparent 65%)",
              pointerEvents: "none",
            }} />

            {/* Avatar */}
            <div style={{ position: "relative", marginBottom: 10 }}>
              <div style={{
                width: 80, height: 80, borderRadius: 24,
                background: avatarUrl ? "transparent" : "rgba(255,107,0,0.12)",
                border: "2px solid rgba(255,107,0,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", boxShadow: "0 0 20px rgba(255,107,0,0.2)",
              }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="Ảnh đại diện" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{
                      fontSize: 28, fontWeight: 800,
                      background: "linear-gradient(135deg,#FF6B00,#FFB347)",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                    } as React.CSSProperties}>
                      {initials(name)}
                    </span>
                }
              </div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  position: "absolute", bottom: -2, right: -2,
                  width: 24, height: 24, borderRadius: 8,
                  background: "linear-gradient(135deg,#FF6B00,#FF8C00)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 12, boxShadow: "0 2px 8px rgba(255,107,0,0.4)",
                }}
              >📷</div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
            </div>

            {!editMode ? (
              <>
                <div style={{ color: "#f8f0e0", fontSize: 16, fontWeight: 700, marginBottom: 3 }}>{name}</div>
                <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 8 }}>{USER.phone}</div>
              </>
            ) : (
              <div style={{ width: "100%", maxWidth: 280, marginBottom: 8 }}>
                <InputField label="Họ và tên" value={name} onChange={setName} icon="👤" placeholder="Nguyễn Văn A" />
              </div>
            )}

            {/* Tier badge */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: tier.bg, border: `1px solid ${tier.bd}`,
              borderRadius: 9, padding: "4px 12px",
            }}>
              <span style={{ fontSize: 14 }}>{tier.icon}</span>
              <span style={{ color: tier.color, fontSize: 10, fontWeight: 700 }}>{USER.tier} Member</span>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
              {[
                { val: USER.totalOrders.toString(), label: "Tổng đơn" },
                { val: `${USER.points.toLocaleString()}`, label: "Điểm GN" },
                { val: `Từ ${USER.joinDate.split(" ")[1]}`, label: "Thành viên" },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 700 }}>{s.val}</div>
                  <div style={{ color: "#6a5a40", fontSize: 8, marginTop: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── XU CARD ── */}
          <motion.div whileTap={{ scale: 0.98 }} onClick={() => router.push("/wallet/xu")}
            style={{
              background: "linear-gradient(135deg,#0d0a1a,#160d2a,#080612)",
              border: "1px solid rgba(180,100,255,0.32)", borderRadius: 16,
              padding: "14px", marginBottom: 8,
              position: "relative", overflow: "hidden", cursor: "pointer",
              animation: "purplePulse 3s infinite",
            }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100,
              background: "radial-gradient(circle,rgba(180,100,255,0.18) 0%,transparent 65%)" }} />
            <div style={{ position: "absolute", top: 0, left: "-100%", width: "50%", height: "100%",
              background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)",
              animation: "shimmer 4s infinite" }} />
            <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: "rgba(180,100,255,0.55)", fontSize: 8, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>
                  💳 Xu Giao Nhanh
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 3 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1,
                    background: "linear-gradient(135deg,#b464ff,#d484ff,#e8a4ff)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } as React.CSSProperties}>
                    {USER.walletXu.toLocaleString("vi-VN")}
                  </span>
                  <span style={{ color: "#b464ff", fontSize: 12, fontWeight: 600 }}>xu</span>
                </div>
                <div style={{ color: "rgba(180,100,255,0.4)", fontSize: 8 }}>
                  Nạp VietQR · rút · dùng thanh toán đơn hàng
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); router.push("/wallet/xu") }}
                style={{
                  padding: "5px 11px", borderRadius: 7, cursor: "pointer", flexShrink: 0,
                  background: "rgba(180,100,255,0.14)", border: "1px solid rgba(180,100,255,0.3)",
                  color: "#b464ff", fontSize: 8.5, fontWeight: 700, fontFamily: "Lexend",
                }}>Chi tiết →</button>
            </div>
          </motion.div>

          {/* ── ĐIỂM CARD ── */}
          <motion.div whileTap={{ scale: 0.98 }} onClick={() => router.push("/wallet/points")}
            style={{
              background: "linear-gradient(135deg,#1a1200,#251800,#0d0900)",
              border: "1px solid rgba(245,197,66,0.3)", borderRadius: 16,
              padding: "14px", marginBottom: 4,
              position: "relative", overflow: "hidden", cursor: "pointer",
              animation: "goldPulse 3s infinite",
            }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100,
              background: "radial-gradient(circle,rgba(245,197,66,0.12) 0%,transparent 65%)" }} />
            <div style={{ position: "absolute", top: 0, left: "-100%", width: "50%", height: "100%",
              background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)",
              animation: "shimmer 4.5s infinite" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ color: "rgba(245,197,66,0.6)", fontSize: 8, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>
                    ⭐ Điểm Tích Lũy
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 3 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1,
                      background: "linear-gradient(135deg,#F5C542,#FFB347,#FF8C00)",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } as React.CSSProperties}>
                      {USER.points.toLocaleString("vi-VN")}
                    </span>
                    <span style={{ color: "#F5C542", fontSize: 12, fontWeight: 600 }}>điểm</span>
                  </div>
                  <div style={{ color: "rgba(245,197,66,0.4)", fontSize: 8 }}>
                    Tích từ đơn hàng · đổi xu & voucher
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); router.push("/wallet/points") }}
                    style={{
                      padding: "5px 11px", borderRadius: 7, cursor: "pointer",
                      background: "rgba(245,197,66,0.12)", border: "1px solid rgba(245,197,66,0.28)",
                      color: "#F5C542", fontSize: 8.5, fontWeight: 700, fontFamily: "Lexend",
                    }}>Chi tiết →</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 13 }}>{tier.icon}</span>
                    <span style={{ color: "#F5C542", fontSize: 8.5, fontWeight: 700 }}>{USER.tier} Member</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 7 }}>{USER.points.toLocaleString()} điểm</span>
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 7 }}>{USER.nextTier} · {USER.nextPts.toLocaleString()}</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  style={{ height: "100%", background: "linear-gradient(90deg,#F5C542,#FFB347)", borderRadius: 2 }} />
              </div>
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 7, marginTop: 4 }}>
                Tích thêm <strong style={{ color: "#F5C542" }}>{(USER.nextPts - USER.points).toLocaleString()} điểm</strong> để lên {USER.nextTier}
              </div>
            </div>
          </motion.div>

          {/* Thông tin cá nhân */}
          <SectionLabel>Thông tin cá nhân</SectionLabel>
          <div style={CARD_STYLE}>
            {editMode ? (
              <div style={{ padding: "10px 0" }}>
                <InputField label="Họ và tên" value={name} onChange={setName} icon="👤" placeholder="Nguyễn Văn A" />
                <InputField label="Email (tùy chọn)" value={email} onChange={setEmail} icon="📧" placeholder="email@gmail.com" type="email" />
              </div>
            ) : (
              <>
                <SettingRow icon="👤" label="Họ và tên"
                  right={<span style={{ color: "#b0956a", fontSize: 10 }}>{name}</span>}
                />
                <SettingRow icon="📱" label="Số điện thoại" sub="Không thể thay đổi"
                  right={<span style={{ color: "#b0956a", fontSize: 10 }}>{USER.phone}</span>}
                />
                <SettingRow icon="📧" label="Email"
                  right={<span style={{ color: email ? "#b0956a" : "#FF8C00", fontSize: 10 }}>{email || "Thêm email"}</span>}
                  onClick={() => setEditMode(true)}
                />
              </>
            )}
          </div>

          {/* Bảo mật */}
          <SectionLabel>Bảo mật</SectionLabel>
          <div style={CARD_STYLE}>
            <SettingRow icon="🔒" label="Đổi mật khẩu" sub="Cập nhật mật khẩu định kỳ để bảo mật"
              onClick={() => { setShowPw(true); setPwStep("current") }}
            />
            <SettingRow icon="🛡️" label="Xác thực 2 bước" sub="Chưa bật"
              right={
                <span style={{
                  background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.25)",
                  borderRadius: 5, padding: "2px 7px", color: "#f5c542", fontSize: 8, fontWeight: 600,
                }}>Sắp có</span>
              }
            />
          </div>

          {/* Thông báo */}
          <SectionLabel>Thông báo</SectionLabel>
          <div style={CARD_STYLE}>
            {NOTIF_ROWS.map(n => (
              <SettingRow key={n.key} icon={n.icon} label={n.label} sub={n.sub}
                right={
                  <Toggle
                    on={notif[n.key]}
                    onChange={v => setNotif(prev => ({ ...prev, [n.key]: v }) as NotifSettings)}
                  />
                }
              />
            ))}
          </div>

          {/* Liên kết nhanh */}
          <SectionLabel>Liên kết nhanh</SectionLabel>
          <div style={CARD_STYLE}>
            <SettingRow icon="📍" label="Địa chỉ lưu" sub="Quản lý địa chỉ nhà, công ty" onClick={() => router.push("/addresses")} />
            <SettingRow icon="🎟️" label="Voucher của tôi" onClick={() => router.push("/vouchers")} />
            <SettingRow icon="💼" label="Ví của tôi" sub={`${USER.walletXu.toLocaleString()} xu · ${USER.points.toLocaleString()} điểm`} onClick={() => router.push("/wallet")} />
            <SettingRow icon="🌐" label="Ngôn ngữ"
              right={<span style={{ color: "#b0956a", fontSize: 10 }}>Tiếng Việt</span>}
            />
          </div>

          {/* Hỗ trợ */}
          <SectionLabel>Hỗ trợ</SectionLabel>
          <div style={CARD_STYLE}>
            <SettingRow icon="💬" label="Chat hỗ trợ" sub="Phản hồi trong vòng 5 phút"
              onClick={() => fireToast("Đang kết nối hỗ trợ viên...")}
            />
            <SettingRow icon="📄" label="Điều khoản sử dụng" onClick={() => {}} />
            <SettingRow icon="🔐" label="Chính sách bảo mật" onClick={() => {}} />
            <SettingRow icon="ℹ️" label="Phiên bản app"
              right={<span style={{ color: "#6a5a40", fontSize: 10 }}>v1.0.0</span>}
            />
          </div>

          {/* Tài khoản */}
          <SectionLabel>Tài khoản</SectionLabel>
          <div style={{ ...CARD_STYLE, marginBottom: 6 }}>
            <SettingRow icon="🚪" label="Đăng xuất" onClick={() => setShowLogout(true)} />
            <SettingRow icon="🗑️" label="Xóa tài khoản" sub="Hành động này không thể khôi phục"
              danger onClick={() => setShowDelete(true)}
            />
          </div>

        </div>

        {/* Bottom Nav */}
        <div style={{
          position: "absolute", bottom:"max(16px,env(safe-area-inset-bottom))",left:14, right: 14, height: 56,
          background: "rgba(8,8,6,0.92)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,107,0,0.2)", borderRadius: 9999,
          display: "flex", alignItems: "center", justifyContent: "space-around",
          padding: "0 6px", zIndex: 50, boxShadow: "0 0 20px rgba(255,107,0,0.1)",
        }}>
          {([
            { icon: "🏠", label: "Trang chủ", href: "/",        active: false },
            { icon: "📋", label: "Đơn hàng",  href: "/orders",  active: false },
            { icon: "🛒", label: "Giỏ hàng",  href: "/cart",    active: false },
            { icon: "⚙️", label: "Cài đặt",  href: "/settings", active: true  },
          ] as const).map(tab => (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              style={{
                background: tab.active ? "rgba(255,107,0,0.12)" : "transparent",
                border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 2, padding: "5px 11px", borderRadius: 18,
                transform: tab.active ? "translateY(-2px)" : "translateY(0)",
                transition: "all .2s", position: "relative", fontFamily: "Lexend",
              }}
            >
              <span style={{ fontSize: 19, filter: tab.active ? "drop-shadow(0 0 4px rgba(255,107,0,0.6))" : "none" }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: 7.5, color: tab.active ? "#FF8C00" : "#6a5a40", fontWeight: tab.active ? 600 : 400 }}>
                {tab.label}
              </span>
              {tab.active && (
                <div style={{
                  position: "absolute", bottom: -2, width: 28, height: 3, borderRadius: 2,
                  background: "radial-gradient(ellipse,rgba(255,107,0,0.9) 0%,transparent 70%)",
                  filter: "blur(1px)",
                }} />
              )}
            </button>
          ))}
        </div>

      </div>
    </>
  )
}
