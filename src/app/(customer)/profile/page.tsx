"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

interface NotifSettings {
  order:  boolean
  promo:  boolean
  system: boolean
  driver: boolean
}

type PwStep = "current" | "new" | "confirm"

const TIER_CFG = {
  bronze:   { color: "#CD7F32", bg: "rgba(205,127,50,0.12)",  bd: "rgba(205,127,50,0.3)",  icon: "🥉", label: "Bronze" },
  silver:   { color: "#b0b8c1", bg: "rgba(176,184,193,0.12)", bd: "rgba(176,184,193,0.3)", icon: "🥈", label: "Silver" },
  gold:     { color: "#FFD700", bg: "rgba(255,215,0,0.12)",   bd: "rgba(255,215,0,0.3)",   icon: "🥇", label: "Gold" },
  platinum: { color: "#b464ff", bg: "rgba(180,100,255,0.12)", bd: "rgba(180,100,255,0.3)", icon: "💎", label: "Platinum" },
}

const NEXT_TIER: Record<string, string> = {
  bronze: "Silver", silver: "Gold", gold: "Platinum", platinum: "Platinum",
}
const NEXT_PTS: Record<string, number> = {
  bronze: 500, silver: 1000, gold: 2000, platinum: 2000,
}

const NOTIF_ROWS = [
  { key: "order"  as const, icon: "📦", label: "Đơn hàng",   sub: "Trạng thái giao hàng, tài xế đến" },
  { key: "driver" as const, icon: "🏍️", label: "Tài xế",     sub: "Tài xế nhận đơn, ETA" },
  { key: "promo"  as const, icon: "🏷️", label: "Khuyến mãi", sub: "Voucher mới, flash sale" },
  { key: "system" as const, icon: "⚙️", label: "Hệ thống",   sub: "Cập nhật, bảo trì" },
]

const initials = (name: string) =>
  name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase()

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 6px" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      <span style={{ color: "#6a5a40", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>
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
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: onClick ? "pointer" : "default" }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: danger ? "#ff6060" : "#f8f0e0", fontSize: 11.5, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>{sub}</div>}
      </div>
      {right !== undefined ? right : onClick ? <span style={{ color: "#6a5a40", fontSize: 13 }}>›</span> : null}
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width: 40, height: 22, borderRadius: 11, cursor: "pointer", background: on ? "linear-gradient(90deg,#FF6B00,#FF8C00)" : "rgba(255,255,255,0.1)", border: `1px solid ${on ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.12)"}`, position: "relative", transition: "all .25s", flexShrink: 0, boxShadow: on ? "0 0 8px rgba(255,107,0,0.3)" : "none" }}>
      <div style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .25s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
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
      <label style={{ color: "rgba(176,149,106,0.6)", fontSize: 11, display: "block", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${focus ? "rgba(255,107,0,0.55)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "0 12px", height: 44, transition: "all .2s", boxShadow: focus ? "0 0 0 3px rgba(255,107,0,0.09)" : "none" }}>
        {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
        <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f8f0e0", fontSize: 12, fontFamily: "Lexend" }} />
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const router   = useRouter()
  const supabase = createClient()

  const [loading,     setLoading]     = useState(true)
  const [userId,      setUserId]      = useState("")
  const [name,        setName]        = useState("")
  const [phone,       setPhone]       = useState("")
  const [email,       setEmail]       = useState("")
  const [avatarUrl,   setAvatarUrl]   = useState("")
  const [tier,        setTier]        = useState("bronze")
  const [points,      setPoints]      = useState(0)
  const [walletXu,         setWalletXu]         = useState(0)
  const [totalOrders,      setTotalOrders]      = useState(0)
  const [activeOrderCount, setActiveOrderCount] = useState(0)
  const [joinYear,    setJoinYear]    = useState("")
  const [notif,       setNotif]       = useState<NotifSettings>({ order: true, promo: false, system: true, driver: true })
  const [showPw,      setShowPw]      = useState(false)
  const [pwStep,      setPwStep]      = useState<PwStep>("current")
  const [curPw,       setCurPw]       = useState("")
  const [newPw,       setNewPw]       = useState("")
  const [confirmPw,   setConfirmPw]   = useState("")
  const [showLogout,  setShowLogout]  = useState(false)
  const [showDelete,  setShowDelete]  = useState(false)
  const [toast,       setToast]       = useState("")
  const [editMode,    setEditMode]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace("/login"); return }
    setUserId(user.id)

    const [
      { data: profile },
      { data: loyalty },
      { data: wallet },
      { data: orderCount },
      { data: activeCount },
    ] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, avatar_url, created_at").eq("id", user.id).single(),
      supabase.from("loyalty_points").select("total_points, tier").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallets").select("balance").eq("user_id", user.id).eq("type", "customer").maybeSingle(),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", user.id).neq("status", "cancelled"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", user.id).in("status", ["pending","accepted","preparing","ready","delivering"]),
    ])

    setName(profile?.full_name ?? "")
    setPhone(profile?.phone ?? "")
    setEmail(user.email ?? "")
    setAvatarUrl(profile?.avatar_url ?? "")
    setJoinYear(profile?.created_at ? new Date(profile.created_at).getFullYear().toString() : "")
    setTier(loyalty?.tier ?? "bronze")
    setPoints(loyalty?.total_points ?? 0)
    setWalletXu(wallet?.balance ?? 0)
    setTotalOrders((orderCount as { count?: number } | null)?.count ?? 0)
    setActiveOrderCount((activeCount as { count?: number } | null)?.count ?? 0)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    router.refresh()
    void load()
    const onVisible = () => { if (document.visibilityState === "visible") void load() }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [load, router])

  const tierCfg  = TIER_CFG[tier as keyof typeof TIER_CFG] ?? TIER_CFG.bronze
  const nextTier = NEXT_TIER[tier] ?? "Gold"
  const nextPts  = NEXT_PTS[tier] ?? 1000
  const pct      = Math.min(Math.round((points / nextPts) * 100), 100)

  const pwStepLabel: Record<PwStep, string> = { current: "Nhập mật khẩu hiện tại", new: "Nhập mật khẩu mới", confirm: "Xác nhận mật khẩu mới" }
  const pwStepPct:   Record<PwStep, number> = { current: 33, new: 66, confirm: 100 }
  const pwStepNum:   Record<PwStep, number> = { current: 1,  new: 2,  confirm: 3  }
  const pwValue    = pwStep === "current" ? curPw    : pwStep === "new" ? newPw    : confirmPw
  const pwOnChange = pwStep === "current" ? setCurPw : pwStep === "new" ? setNewPw : setConfirmPw

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2400) }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    const ext  = file.name.split(".").pop()
    const path = `avatars/${userId}.${ext}`
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true })
    if (error) { fireToast("Lỗi tải ảnh lên"); return }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path)
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId)
    setAvatarUrl(publicUrl)
    fireToast("Đã cập nhật ảnh đại diện")
  }

  const handleSave = async () => {
    if (!userId) return
    await supabase.from("profiles").update({ full_name: name }).eq("id", userId)
    setEditMode(false)
    fireToast("Đã lưu thông tin cá nhân")
  }

  const handlePwNext = async () => {
    if (pwStep === "current") {
      if (!curPw) return
      setPwStep("new")
    } else if (pwStep === "new") {
      if (newPw.length < 8) { fireToast("Mật khẩu phải có ít nhất 8 ký tự"); return }
      setPwStep("confirm")
    } else {
      if (newPw !== confirmPw) { fireToast("Mật khẩu xác nhận không khớp"); return }
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) { fireToast("Lỗi đổi mật khẩu"); return }
      fireToast("Đã đổi mật khẩu thành công!")
      setShowPw(false); setPwStep("current"); setCurPw(""); setNewPw(""); setConfirmPw("")
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const CARD_STYLE: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "2px 13px" }

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#080806", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Lexend" }}>
        <div style={{ color: "#6a5a40", fontSize: 12 }}>Đang tải hồ sơ...</div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes shimmer     { 0% { left: -60%; } 100% { left: 120%; } }
        @keyframes purplePulse { 0%,100% { box-shadow: 0 0 16px rgba(180,100,255,0.2) } 50% { box-shadow: 0 0 28px rgba(180,100,255,0.38) } }
        @keyframes goldPulse   { 0%,100% { box-shadow: 0 0 16px rgba(245,197,66,0.15) } 50% { box-shadow: 0 0 28px rgba(245,197,66,0.3)  } }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            style={{ position: "fixed", top: 52, left: "50%", transform: "translateX(-50%)", zIndex: 999, whiteSpace: "nowrap", background: "rgba(62,207,110,0.15)", border: "1px solid rgba(62,207,110,0.35)", borderRadius: 12, padding: "7px 18px", color: "#3ecf6e", fontSize: 11, fontWeight: 600, backdropFilter: "blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Đổi mật khẩu */}
      <AnimatePresence>
        {showPw && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowPw(false); setPwStep("current") }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 190, backdropFilter: "blur(4px)" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 320 }} style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 191, background: "#0e0c09", border: "1px solid rgba(255,107,0,0.15)", borderRadius: "20px 20px 0 0", padding: "20px 18px 36px" }}>
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 18px" }} />
              <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Đổi mật khẩu</div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
                <motion.div animate={{ width: `${pwStepPct[pwStep]}%` }} transition={{ duration: 0.3 }} style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#FF6B00,#FF8C00)" }} />
              </div>
              <div style={{ color: "#b0956a", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                Bước {pwStepNum[pwStep]}/3 · {pwStepLabel[pwStep]}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={pwStep} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}>
                  <InputField label={pwStepLabel[pwStep]} type="password" placeholder="••••••••" icon="🔒" value={pwValue} onChange={pwOnChange} />
                  {pwStep === "new" && newPw.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 3, marginTop: -4 }}>
                        {[1,2,3].map(i => (
                          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: newPw.length >= i*4 ? i===1?"#ff4040":i===2?"#f5c542":"#3ecf6e" : "rgba(255,255,255,0.07)", transition: "background .2s" }} />
                        ))}
                      </div>
                      <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 4 }}>{newPw.length < 4 ? "Yếu" : newPw.length < 8 ? "Trung bình" : "Mạnh"}</div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              <button onClick={handlePwNext} style={{ width: "100%", height: 46, borderRadius: 12, border: "none", background: "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)", color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "Lexend", cursor: "pointer", position: "relative", overflow: "hidden", boxShadow: "0 3px 14px rgba(255,107,0,0.35)" }}>
                <div style={{ position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)", animation: "shimmer 2.5s infinite" }} />
                <span style={{ position: "relative", zIndex: 1 }}>{pwStep === "confirm" ? "✓ Xác nhận đổi mật khẩu" : "Tiếp theo →"}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Xác nhận đăng xuất */}
      <AnimatePresence>
        {showLogout && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLogout(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 190, backdropFilter: "blur(4px)" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 320 }} style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 191, background: "#0e0c09", border: "1px solid rgba(255,107,0,0.15)", borderRadius: "20px 20px 0 0", padding: "20px 18px 36px" }}>
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 18px" }} />
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🚪</div>
                <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Đăng xuất?</div>
                <div style={{ color: "#6a5a40", fontSize: 10 }}>Bạn sẽ cần đăng nhập lại để sử dụng app</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowLogout(false)} style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#b0956a", fontSize: 12, fontWeight: 600, fontFamily: "Lexend", cursor: "pointer" }}>Hủy</button>
                <button onClick={handleLogout} style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: "linear-gradient(90deg,#FF6B00,#FF8C00)", color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "Lexend", cursor: "pointer" }}>Đăng xuất</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Xác nhận xóa tài khoản */}
      <AnimatePresence>
        {showDelete && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDelete(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 190, backdropFilter: "blur(4px)" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 320 }} style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 191, background: "#0e0c09", border: "1px solid rgba(255,64,64,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 18px 36px" }}>
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 18px" }} />
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
                <div style={{ color: "#ff6060", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Xóa tài khoản?</div>
                <div style={{ color: "#6a5a40", fontSize: 10, lineHeight: 1.6 }}>Toàn bộ lịch sử đơn hàng, điểm tích lũy và thông tin<br />của bạn sẽ bị xóa vĩnh viễn. Không thể khôi phục.</div>
              </div>

              {/* Cảnh báo đơn đang chạy */}
              {activeOrderCount > 0 && (
                <div style={{ background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🚫</span>
                  <div>
                    <div style={{ color: "#ff6060", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>Đang có {activeOrderCount} đơn hàng đang xử lý</div>
                    <div style={{ color: "#6a5a40", fontSize: 11, lineHeight: 1.5 }}>Vui lòng chờ đơn hoàn thành hoặc hủy đơn trước khi xóa tài khoản.</div>
                  </div>
                </div>
              )}

              {/* Cảnh báo xu còn trong ví */}
              {walletXu > 0 && (
                <div style={{ background: "rgba(255,179,71,0.08)", border: "1px solid rgba(255,179,71,0.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🪙</span>
                  <div>
                    <div style={{ color: "#FFB347", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>Còn {walletXu.toLocaleString("vi-VN")}đ xu trong ví</div>
                    <div style={{ color: "#6a5a40", fontSize: 11, lineHeight: 1.5 }}>Xu sẽ <strong style={{ color: "#ff6060" }}>không được hoàn trả</strong> khi xóa tài khoản. Vui lòng dùng hết xu trước khi thực hiện.</div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowDelete(false)} style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#b0956a", fontSize: 12, fontWeight: 600, fontFamily: "Lexend", cursor: "pointer" }}>Giữ lại</button>
                <button
                  disabled={activeOrderCount > 0}
                  onClick={() => { fireToast("Đã gửi yêu cầu xóa tài khoản"); setShowDelete(false) }}
                  style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: activeOrderCount > 0 ? "rgba(255,64,64,0.2)" : "linear-gradient(90deg,#ff4040,#ff6060)", color: activeOrderCount > 0 ? "#6a5a40" : "#fff", fontSize: 12, fontWeight: 700, fontFamily: "Lexend", cursor: activeOrderCount > 0 ? "not-allowed" : "pointer" }}>
                  {activeOrderCount > 0 ? "Không thể xóa" : "Xóa tài khoản"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div style={{ position: "fixed", inset: 0, background: "#080806", zIndex: 60, display: "flex", flexDirection: "column", fontFamily: "'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background: "rgba(8,8,6,0.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.back()} style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer", color: "#FF8C00" }}>←</button>
            <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 700 }}>Hồ sơ cá nhân</div>
            <button onClick={() => editMode ? handleSave() : setEditMode(true)} style={{ padding: "6px 14px", borderRadius: 9, cursor: "pointer", background: editMode ? "linear-gradient(90deg,#FF6B00,#FF8C00)" : "rgba(255,107,0,0.1)", border: editMode ? "none" : "1px solid rgba(255,107,0,0.25)", color: editMode ? "#fff" : "#FF8C00", fontSize: 10, fontWeight: 700, fontFamily: "Lexend", transition: "all .2s" }}>
              {editMode ? "✓ Lưu" : "✏️ Sửa"}
            </button>
          </div>
        </div>

        {/* Scroll body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 88px", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>

          {/* Avatar + Name + Stats */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 14px", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 160, height: 160, background: "radial-gradient(circle,rgba(255,107,0,0.1) 0%,transparent 65%)", pointerEvents: "none" }} />

            <div style={{ position: "relative", marginBottom: 10 }}>
              <div style={{ width: 80, height: 80, borderRadius: 24, background: avatarUrl ? "transparent" : "rgba(255,107,0,0.12)", border: "2px solid rgba(255,107,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 0 20px rgba(255,107,0,0.2)" }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="Ảnh đại diện" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(135deg,#FF6B00,#FFB347)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } as React.CSSProperties}>{initials(name || "GN")}</span>
                }
              </div>
              <div onClick={() => fileRef.current?.click()} style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: 8, background: "linear-gradient(135deg,#FF6B00,#FF8C00)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, boxShadow: "0 2px 8px rgba(255,107,0,0.4)" }}>📷</div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
            </div>

            {!editMode ? (
              <>
                <div style={{ color: "#f8f0e0", fontSize: 16, fontWeight: 700, marginBottom: 3 }}>{name || "Chưa cập nhật"}</div>
                <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 8 }}>{phone}</div>
              </>
            ) : (
              <div style={{ width: "100%", maxWidth: 280, marginBottom: 8 }}>
                <InputField label="Họ và tên" value={name} onChange={setName} icon="👤" placeholder="Nguyễn Văn A" />
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 6, background: tierCfg.bg, border: `1px solid ${tierCfg.bd}`, borderRadius: 9, padding: "4px 12px" }}>
              <span style={{ fontSize: 14 }}>{tierCfg.icon}</span>
              <span style={{ color: tierCfg.color, fontSize: 10, fontWeight: 700 }}>{tierCfg.label} Member</span>
            </div>

            <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
              {[
                { val: totalOrders.toString(), label: "Tổng đơn" },
                { val: points.toLocaleString("vi-VN"), label: "Điểm GN" },
                { val: joinYear ? `Từ ${joinYear}` : "—", label: "Thành viên" },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 700 }}>{s.val}</div>
                  <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* XU CARD */}
          <motion.div whileTap={{ scale: 0.98 }} onClick={() => router.push("/wallet/xu")}
            style={{ background: "linear-gradient(135deg,#0d0a1a,#160d2a,#080612)", border: "1px solid rgba(180,100,255,0.32)", borderRadius: 16, padding: "14px", marginBottom: 8, position: "relative", overflow: "hidden", cursor: "pointer", animation: "purplePulse 3s infinite" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: "radial-gradient(circle,rgba(180,100,255,0.18) 0%,transparent 65%)" }} />
            <div style={{ position: "absolute", top: 0, left: "-100%", width: "50%", height: "100%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)", animation: "shimmer 4s infinite" }} />
            <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: "rgba(180,100,255,0.55)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>💳 Xu Giao Nhanh</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 3 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, background: "linear-gradient(135deg,#b464ff,#d484ff,#e8a4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } as React.CSSProperties}>
                    {walletXu.toLocaleString("vi-VN")}
                  </span>
                  <span style={{ color: "#b464ff", fontSize: 12, fontWeight: 600 }}>xu</span>
                </div>
                <div style={{ color: "rgba(180,100,255,0.4)", fontSize: 11 }}>Nạp VietQR · rút · dùng thanh toán đơn hàng</div>
              </div>
              <button onClick={e => { e.stopPropagation(); router.push("/wallet/xu") }} style={{ padding: "5px 11px", borderRadius: 7, cursor: "pointer", flexShrink: 0, background: "rgba(180,100,255,0.14)", border: "1px solid rgba(180,100,255,0.3)", color: "#b464ff", fontSize: 11, fontWeight: 700, fontFamily: "Lexend" }}>Chi tiết →</button>
            </div>
          </motion.div>

          {/* ĐIỂM CARD */}
          <motion.div whileTap={{ scale: 0.98 }} onClick={() => router.push("/wallet/points")}
            style={{ background: "linear-gradient(135deg,#1a1200,#251800,#0d0900)", border: "1px solid rgba(245,197,66,0.3)", borderRadius: 16, padding: "14px", marginBottom: 4, position: "relative", overflow: "hidden", cursor: "pointer", animation: "goldPulse 3s infinite" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: "radial-gradient(circle,rgba(245,197,66,0.12) 0%,transparent 65%)" }} />
            <div style={{ position: "absolute", top: 0, left: "-100%", width: "50%", height: "100%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)", animation: "shimmer 4.5s infinite" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ color: "rgba(245,197,66,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>⭐ Điểm Tích Lũy</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 3 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, background: "linear-gradient(135deg,#F5C542,#FFB347,#FF8C00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } as React.CSSProperties}>
                      {points.toLocaleString("vi-VN")}
                    </span>
                    <span style={{ color: "#F5C542", fontSize: 12, fontWeight: 600 }}>điểm</span>
                  </div>
                  <div style={{ color: "rgba(245,197,66,0.4)", fontSize: 11 }}>Tích từ đơn hàng · đổi xu & voucher</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); router.push("/wallet/points") }} style={{ padding: "5px 11px", borderRadius: 7, cursor: "pointer", background: "rgba(245,197,66,0.12)", border: "1px solid rgba(245,197,66,0.28)", color: "#F5C542", fontSize: 11, fontWeight: 700, fontFamily: "Lexend" }}>Chi tiết →</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 13 }}>{tierCfg.icon}</span>
                    <span style={{ color: "#F5C542", fontSize: 11, fontWeight: 700 }}>{tierCfg.label} Member</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>{points.toLocaleString()} điểm</span>
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>{nextTier} · {nextPts.toLocaleString()}</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, ease: "easeOut" }} style={{ height: "100%", background: "linear-gradient(90deg,#F5C542,#FFB347)", borderRadius: 2 }} />
              </div>
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, marginTop: 4 }}>
                Tích thêm <strong style={{ color: "#F5C542" }}>{Math.max(0, nextPts - points).toLocaleString()} điểm</strong> để lên {nextTier}
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
                <SettingRow icon="👤" label="Họ và tên" right={<span style={{ color: "#b0956a", fontSize: 10 }}>{name || "Chưa cập nhật"}</span>} />
                <SettingRow icon="📱" label="Số điện thoại" sub="Không thể thay đổi" right={<span style={{ color: "#b0956a", fontSize: 10 }}>{phone}</span>} />
                <SettingRow icon="📧" label="Email" right={<span style={{ color: email ? "#b0956a" : "#FF8C00", fontSize: 10 }}>{email || "Thêm email"}</span>} onClick={() => setEditMode(true)} />
              </>
            )}
          </div>

          {/* Bảo mật */}
          <SectionLabel>Bảo mật</SectionLabel>
          <div style={CARD_STYLE}>
            <SettingRow icon="🔒" label="Đổi mật khẩu" sub="Cập nhật mật khẩu định kỳ để bảo mật" onClick={() => { setShowPw(true); setPwStep("current") }} />
            <SettingRow icon="🛡️" label="Xác thực 2 bước" sub="Chưa bật" right={<span style={{ background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.25)", borderRadius: 5, padding: "2px 7px", color: "#f5c542", fontSize: 11, fontWeight: 600 }}>Sắp có</span>} />
          </div>

          {/* Thông báo */}
          <SectionLabel>Thông báo</SectionLabel>
          <div style={CARD_STYLE}>
            {NOTIF_ROWS.map(n => (
              <SettingRow key={n.key} icon={n.icon} label={n.label} sub={n.sub} right={<Toggle on={notif[n.key]} onChange={v => setNotif(prev => ({ ...prev, [n.key]: v }) as NotifSettings)} />} />
            ))}
          </div>

          {/* Liên kết nhanh */}
          <SectionLabel>Liên kết nhanh</SectionLabel>
          <div style={CARD_STYLE}>
            <SettingRow icon="📍" label="Địa chỉ lưu" sub="Quản lý địa chỉ nhà, công ty" onClick={() => router.push("/addresses")} />
            <SettingRow icon="🎟️" label="Voucher của tôi" onClick={() => router.push("/vouchers")} />
            <SettingRow icon="🎁" label="Mời bạn bè" sub="Chia sẻ mã — cả 2 nhận 5.000 XU" onClick={() => router.push("/invite")} />
            <SettingRow icon="💼" label="Ví của tôi" sub={`${walletXu.toLocaleString("vi-VN")} xu · ${points.toLocaleString("vi-VN")} điểm`} onClick={() => router.push("/wallet")} />
            <SettingRow icon="🌐" label="Ngôn ngữ" right={<span style={{ color: "#b0956a", fontSize: 10 }}>Tiếng Việt</span>} />
          </div>

          {/* Hỗ trợ */}
          <SectionLabel>Hỗ trợ</SectionLabel>
          <div style={CARD_STYLE}>
            <SettingRow icon="💬" label="Chat hỗ trợ" sub="Phản hồi trong vòng 5 phút" onClick={() => fireToast("Đang kết nối hỗ trợ viên...")} />
            <SettingRow icon="📄" label="Điều khoản sử dụng" onClick={() => {}} />
            <SettingRow icon="🔐" label="Chính sách bảo mật" onClick={() => {}} />
            <SettingRow icon="ℹ️" label="Phiên bản app" right={<span style={{ color: "#6a5a40", fontSize: 10 }}>v1.0.0</span>} />
          </div>

          {/* Tài khoản */}
          <SectionLabel>Tài khoản</SectionLabel>
          <div style={{ ...CARD_STYLE, marginBottom: 6 }}>
            <SettingRow icon="🚪" label="Đăng xuất" onClick={() => setShowLogout(true)} />
            <SettingRow icon="🗑️" label="Xóa tài khoản" sub="Hành động này không thể khôi phục" danger onClick={() => setShowDelete(true)} />
          </div>

        </div>

        {/* Bottom Nav */}
        <div style={{ position: "fixed", bottom: "max(16px,env(safe-area-inset-bottom))", left: 14, right: 14, height: 56, background: "rgba(8,8,6,0.92)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 6px", zIndex: 70, boxShadow: "0 0 20px rgba(255,107,0,0.1)" }}>
          {([
            { icon: "🏠", label: "Trang chủ", href: "/",        active: false },
            { icon: "📋", label: "Đơn hàng",  href: "/orders",  active: false },
            { icon: "🛒", label: "Giỏ hàng",  href: "/cart",    active: false },
            { icon: "⚙️", label: "Cài đặt",   href: "/settings", active: true  },
          ] as const).map(tab => (
            <button key={tab.href} onClick={() => router.push(tab.href)} style={{ background: tab.active ? "rgba(255,107,0,0.12)" : "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "5px 11px", borderRadius: 18, transform: tab.active ? "translateY(-2px)" : "translateY(0)", transition: "all .2s", position: "relative", fontFamily: "Lexend" }}>
              <span style={{ fontSize: 19, filter: tab.active ? "drop-shadow(0 0 4px rgba(255,107,0,0.6))" : "none" }}>{tab.icon}</span>
              <span style={{ fontSize: 10, color: tab.active ? "#FF8C00" : "#6a5a40", fontWeight: tab.active ? 600 : 400 }}>{tab.label}</span>
              {tab.active && <div style={{ position: "absolute", bottom: -2, width: 28, height: 3, borderRadius: 2, background: "radial-gradient(ellipse,rgba(255,107,0,0.9) 0%,transparent 70%)", filter: "blur(1px)" }} />}
            </button>
          ))}
        </div>

      </div>
    </>
  )
}
