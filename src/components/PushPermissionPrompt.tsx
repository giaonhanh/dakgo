"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { usePushNotification } from "@/hooks/usePushNotification"

// Thay đổi version key để buộc re-prompt toàn bộ user đã cài trước đó
const PROMPT_KEY = "push_prompted_v2"

export default function PushPermissionPrompt() {
  const [show, setShow]     = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isDenied, setIsDenied] = useState(false)
  const { requestPermission } = usePushNotification()

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) return

    if (localStorage.getItem(PROMPT_KEY)) return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      const perm = typeof Notification !== "undefined" ? Notification.permission : "default"

      if (perm === "granted") {
        // Đã cấp quyền → subscribe lại lặng lẽ (reset subscription mới)
        localStorage.setItem(PROMPT_KEY, "1")
        requestPermission(user.id).catch(() => {})
        return
      }

      if (perm === "denied") {
        // Đã từ chối ở browser → chỉ nhắc nhở bật lại trong cài đặt
        setIsDenied(true)
        setShow(true)
        return
      }

      // default → hiện modal xin quyền
      setShow(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAllow = async () => {
    setShow(false)
    localStorage.setItem(PROMPT_KEY, "1")
    if (userId) await requestPermission(userId)
  }

  const handleLater = () => {
    setShow(false)
    localStorage.setItem(PROMPT_KEY, "1")
  }

  if (!show) return null

  // Trường hợp user đã từ chối ở browser trước đó → hướng dẫn bật lại
  if (isDenied) return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10001,
      background: "rgba(8,8,6,0.96)", backdropFilter: "blur(8px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Lexend',sans-serif", padding: "0 32px",
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: 24, marginBottom: 24,
        background: "rgba(255,107,0,0.1)",
        border: "1.5px solid rgba(255,107,0,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 40, boxShadow: "0 0 40px rgba(255,107,0,0.12)",
      }}>🔕</div>

      <div style={{
        color: "#f8f0e0", fontSize: 20, fontWeight: 800,
        textAlign: "center", marginBottom: 10, lineHeight: 1.3,
      }}>
        Thông báo bị tắt
      </div>

      <div style={{
        color: "#6a5a40", fontSize: 12, textAlign: "center",
        lineHeight: 1.8, marginBottom: 32, maxWidth: 300,
      }}>
        Bạn đã từ chối quyền thông báo trước đó.{"\n"}
        Để nhận thông báo đơn hàng, vào{" "}
        <span style={{ color: "#b0956a" }}>Cài đặt trình duyệt</span>{" "}
        → tìm Giao Nhanh → bật Thông báo.
      </div>

      <button
        onClick={handleLater}
        style={{
          width: "100%", maxWidth: 300, height: 46, borderRadius: 13, border: "none",
          background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
          color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
          fontFamily: "'Lexend',sans-serif",
        }}
      >
        Đã hiểu
      </button>
    </div>
  )

  // Trường hợp chưa cấp quyền → hỏi lần đầu / reset
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10001,
      background: "rgba(8,8,6,0.96)", backdropFilter: "blur(8px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Lexend',sans-serif", padding: "0 32px",
    }}>
      <div style={{
        width: 96, height: 96, borderRadius: 28, marginBottom: 24,
        background: "linear-gradient(135deg,rgba(255,107,0,0.18),rgba(255,107,0,0.06))",
        border: "1.5px solid rgba(255,107,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 44, boxShadow: "0 0 40px rgba(255,107,0,0.15)",
      }}>🔔</div>

      <div style={{
        color: "#f8f0e0", fontSize: 20, fontWeight: 800,
        textAlign: "center", marginBottom: 10, lineHeight: 1.3,
      }}>
        Nhận thông báo đơn hàng
      </div>

      <div style={{
        color: "#6a5a40", fontSize: 12, textAlign: "center",
        lineHeight: 1.8, marginBottom: 32, maxWidth: 300,
      }}>
        Giao Nhanh sẽ thông báo ngay khi{"\n"}
        <span style={{ color: "#b0956a" }}>đơn hàng được xác nhận</span>,{" "}
        <span style={{ color: "#b0956a" }}>tài xế đến lấy</span> và{" "}
        <span style={{ color: "#b0956a" }}>giao hàng thành công</span> —
        kể cả khi bạn không mở app.
      </div>

      <button
        onClick={handleAllow}
        style={{
          width: "100%", maxWidth: 300, height: 52, borderRadius: 14, border: "none",
          background: "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
          color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
          fontFamily: "'Lexend',sans-serif",
          boxShadow: "0 4px 24px rgba(255,107,0,0.4)", marginBottom: 10,
        }}
      >
        🔔 Bật thông báo
      </button>

      <button
        onClick={handleLater}
        style={{
          width: "100%", maxWidth: 300, height: 44, borderRadius: 12,
          background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
          color: "#6a5a40", fontSize: 12, cursor: "pointer",
          fontFamily: "'Lexend',sans-serif",
        }}
      >
        Để sau
      </button>

      <div style={{
        color: "rgba(106,90,64,0.5)", fontSize: 9.5,
        marginTop: 16, textAlign: "center",
      }}>
        Chỉ thông báo về đơn hàng · Không spam
      </div>
    </div>
  )
}
