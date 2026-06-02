"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

function makeCode(uid: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let hash = 0
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash) + uid.charCodeAt(i)
    hash |= 0
  }
  let code = "GN"
  let n = Math.abs(hash)
  for (let i = 0; i < 6; i++) {
    code += chars[n % chars.length]
    n = Math.floor(n / chars.length) || (n + 7919)
  }
  return code
}

export default function InvitePage() {
  const router = useRouter()
  const [code,        setCode]        = useState("")
  const [totalUses,   setTotalUses]   = useState(0)
  const [totalEarned, setTotalEarned] = useState(0)
  const [copied,      setCopied]      = useState(false)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }

      const { data: existing } = await supabase
        .from("referral_codes")
        .select("code, total_uses, total_earned")
        .eq("user_id", user.id)
        .maybeSingle()

      if (existing) {
        setCode(existing.code)
        setTotalUses(existing.total_uses ?? 0)
        setTotalEarned(existing.total_earned ?? 0)
      } else {
        const generated = makeCode(user.id)
        const { data: inserted } = await supabase
          .from("referral_codes")
          .insert({ user_id: user.id, code: generated })
          .select("code")
          .single()
        setCode(inserted?.code ?? generated)
      }
      setLoading(false)
    }
    init()
  }, [router])

  // Link trỏ về trang chủ (đăng nhập) kèm mã ref
  const shareUrl  = typeof window !== "undefined"
    ? `${window.location.origin}/?ref=${code}`
    : `https://giaonhanh.app/?ref=${code}`
  const shareText = `Dùng mã ${code} để nhận 5.000 XU khi đặt đơn đầu trên Giao Nhanh (từ 50.000đ)! 🎁`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Giao Nhanh — Mã giới thiệu", text: shareText, url: shareUrl })
      } catch { /* user dismissed */ }
    } else {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#080806", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#6a5a40", fontSize: 13, fontFamily: "'Lexend',sans-serif" }}>Đang tải...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#080806", fontFamily: "'Lexend',sans-serif", paddingBottom: 100 }}>

      {/* Header — có safe-area-inset-top để tránh notch/status bar */}
      <div style={{
        paddingTop: "env(safe-area-inset-top, 16px)",
        background: "rgba(8,8,6,0.95)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
          <button onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f8f0e0", fontSize: 16, cursor: "pointer" }}>
            ←
          </button>
          <span style={{ color: "#f8f0e0", fontWeight: 700, fontSize: 16 }}>Mời bạn bè</span>
        </div>
      </div>

      <div style={{ padding: "20px 16px 0" }}>

        {/* Hero card */}
        <div style={{ background: "linear-gradient(135deg,#081a10,#0d2d18,#081510)", border: "1px solid rgba(62,207,110,0.3)", borderRadius: 20, padding: "28px 20px 24px", textAlign: "center", marginBottom: 16, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle,rgba(62,207,110,0.2),transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -30, left: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle,rgba(62,207,110,0.1),transparent 70%)", pointerEvents: "none" }} />

          <div style={{ fontSize: 48, marginBottom: 10 }}>🎁</div>
          <div style={{ color: "#f8f0e0", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            Mời bạn — Cùng nhận xu!
          </div>

          {/* Reward callout */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(62,207,110,0.12)", border: "1px solid rgba(62,207,110,0.35)", borderRadius: 12, padding: "8px 16px", marginBottom: 10 }}>
            <span style={{ color: "#3ecf6e", fontSize: 20, fontWeight: 800 }}>5.000 XU</span>
            <span style={{ color: "#6a8a70", fontSize: 11 }}>mỗi người</span>
          </div>

          <div style={{ color: "#6a8a70", fontSize: 11, lineHeight: 1.7 }}>
            Cả bạn và bạn bè cùng nhận <strong style={{ color: "#3ecf6e" }}>5.000 XU</strong><br />
            khi đơn đầu tiên của bạn bè hoàn thành ≥ 50.000đ
          </div>
        </div>

        {/* Mã giới thiệu */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "18px 16px", marginBottom: 12 }}>
          <div style={{ color: "#6a5a40", fontSize: 10, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Mã giới thiệu của bạn</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, background: "rgba(62,207,110,0.07)", border: "1px solid rgba(62,207,110,0.25)", borderRadius: 12, padding: "14px 16px" }}>
              <span style={{ background: "linear-gradient(90deg,#3ecf6e,#27ae60)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontSize: 24, fontWeight: 800, letterSpacing: 4 }}>
                {code}
              </span>
            </div>
            <button onClick={handleCopy}
              style={{ width: 48, height: 48, borderRadius: 12, background: copied ? "rgba(62,207,110,0.15)" : "rgba(62,207,110,0.08)", border: `1px solid ${copied ? "rgba(62,207,110,0.5)" : "rgba(62,207,110,0.2)"}`, color: "#3ecf6e", fontSize: 18, cursor: "pointer", flexShrink: 0, transition: "all .2s" }}>
              {copied ? "✓" : "📋"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Đã giới thiệu", value: `${totalUses} người`, icon: "👥" },
            { label: "XU đã kiếm",    value: `${(totalEarned).toLocaleString("vi-VN")} XU`, icon: "🪙" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 800, marginBottom: 2 }}>{s.value}</div>
              <div style={{ color: "#6a5a40", fontSize: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Share button */}
        <button onClick={handleShare}
          style={{ width: "100%", height: 52, borderRadius: 14, background: "linear-gradient(90deg,#27ae60,#3ecf6e)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend", marginBottom: 20, boxShadow: "0 4px 20px rgba(62,207,110,0.35)" }}>
          🔗 Chia sẻ mã với bạn bè
        </button>

        {/* Cách hoạt động */}
        <div style={{ background: "rgba(62,207,110,0.04)", border: "1px solid rgba(62,207,110,0.12)", borderRadius: 16, padding: "16px 16px 12px", marginBottom: 16 }}>
          <div style={{ color: "#3ecf6e", fontSize: 11, fontWeight: 700, marginBottom: 14 }}>⚡ Cách hoạt động</div>
          {[
            { step: "1", icon: "📤", text: "Chia sẻ mã hoặc link với bạn bè" },
            { step: "2", icon: "📲", text: "Bạn bè đăng ký và nhập mã khi thanh toán đơn đầu" },
            { step: "3", icon: "✅", text: "Đơn hoàn thành ≥ 50.000đ → cả 2 nhận 5.000 XU" },
            { step: "4", icon: "🪙", text: "XU dùng để thanh toán các đơn hàng tiếp theo" },
          ].map(({ step, icon, text }) => (
            <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3ecf6e", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                {step}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, marginRight: 6 }}>{icon}</span>
                <span style={{ color: "#b0956a", fontSize: 12 }}>{text}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Điều khoản */}
        <div style={{ color: "#6a5a40", fontSize: 10, lineHeight: 1.8, textAlign: "center" }}>
          • Mỗi tài khoản chỉ được nhận thưởng giới thiệu 1 lần<br />
          • XU không quy đổi thành tiền mặt<br />
          • Giao Nhanh có quyền thu hồi XU nếu phát hiện gian lận
        </div>

      </div>
    </div>
  )
}
