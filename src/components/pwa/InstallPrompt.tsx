"use client"
import { motion, AnimatePresence } from "framer-motion"
import { usePWAInstall, Platform } from "@/hooks/usePWAInstall"

/* ── hướng dẫn từng nền tảng ── */
const STEPS: Record<string, { title: string; steps: { icon: string; text: string }[]; note?: string }> = {
  "ios-safari": {
    title: "📲 Cài Giao Nhanh lên iPhone / iPad",
    steps: [
      { icon: "⬆️", text: 'Nhấn nút Chia sẻ ở thanh dưới Safari (biểu tượng hình vuông có mũi tên)' },
      { icon: "➕", text: 'Cuộn xuống, chọn "Thêm vào Màn hình chính"' },
      { icon: "✅", text: 'Nhấn "Thêm" ở góc trên bên phải' },
    ],
  },
  "ios-other": {
    title: "📲 Cài Giao Nhanh lên iPhone / iPad",
    steps: [
      { icon: "🌐", text: "Trình duyệt bạn đang dùng chưa hỗ trợ cài đặt PWA" },
      { icon: "🧭", text: 'Mở lại trang này bằng Safari rồi làm theo hướng dẫn' },
    ],
    note: "Chỉ Safari mới hỗ trợ cài ứng dụng lên iPhone / iPad",
  },
  "android-chrome": {
    title: "📲 Thêm Giao Nhanh vào màn hình",
    steps: [
      { icon: "⚡", text: "Mở nhanh như app thật, không cần vào trình duyệt" },
      { icon: "📶", text: "Vẫn dùng được khi mạng yếu nhờ cache thông minh" },
      { icon: "🔔", text: "Nhận thông báo đơn hàng ngay khi app đóng" },
    ],
  },
  "desktop": {
    title: "💻 Cài Giao Nhanh trên máy tính",
    steps: [
      { icon: "⚡", text: "Mở nhanh từ taskbar / dock, không cần trình duyệt" },
      { icon: "🔔", text: "Nhận thông báo đơn hàng trên desktop" },
      { icon: "📶", text: "Hoạt động cả khi mất kết nối tạm thời" },
    ],
  },
}

/* ── full modal ── */
function InstallModal({ platform, onInstall, onConfirm, onDismiss }: {
  platform: Platform
  onInstall: () => void
  onConfirm: () => void
  onDismiss: () => void
}) {
  const cfg = STEPS[platform] ?? STEPS["android-chrome"]
  const isIOS = platform === "ios-safari" || platform === "ios-other"
  const isIOSOther = platform === "ios-other"

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(8,8,6,0.82)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={e => e.target === e.currentTarget && onDismiss()}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        style={{ background: "linear-gradient(180deg,#0f0d09,#080806)", borderTop: "1px solid rgba(255,107,0,0.3)", borderRadius: "24px 24px 0 0", padding: "24px 20px calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#FF6B00,#FF8C00)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0, boxShadow: "0 4px 18px rgba(255,107,0,0.4)" }}>🛵</div>
          <div>
            <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>{cfg.title}</div>
            <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 4 }}>Giao hàng · Mua hộ · Xe ôm · Taxi — Krông Pắc</div>
          </div>
          <button onClick={onDismiss} style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: "#6a5a40", fontSize: 18, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {cfg.steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {isIOS && (
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,107,0,0.15)", border: "1px solid rgba(255,107,0,0.3)", color: "#FF8C00", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {i + 1}
                </div>
              )}
              <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
              <span style={{ color: "#b0956a", fontSize: 12, lineHeight: 1.5 }}>{s.text}</span>
            </div>
          ))}
        </div>

        {/* iOS Safari note */}
        {isIOS && platform === "ios-safari" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 12px", borderRadius: 10, background: "rgba(255,107,0,0.06)", border: "1px dashed rgba(255,107,0,0.2)" }}>
            <span style={{ fontSize: 14 }}>💡</span>
            <span style={{ color: "#b0956a", fontSize: 9, lineHeight: 1.5 }}>Nút Chia sẻ nằm ở giữa thanh công cụ dưới cùng của Safari — biểu tượng hình vuông có mũi tên lên</span>
          </div>
        )}

        {cfg.note && (
          <div style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 10, background: "rgba(74,143,245,0.07)", border: "1px solid rgba(74,143,245,0.15)" }}>
            <span style={{ color: "#4a8ff5", fontSize: 10 }}>ℹ️ {cfg.note}</span>
          </div>
        )}

        {/* buttons */}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: isIOS && !isIOSOther ? "1fr 1fr" : "1fr" }}>
          {isIOS && !isIOSOther && (
            <button onClick={onConfirm} style={{ height: 50, borderRadius: 14, border: "1px solid rgba(62,207,110,0.3)", background: "rgba(62,207,110,0.08)", color: "#3ecf6e", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>
              ✓ Đã cài xong
            </button>
          )}
          {!isIOS && (
            <button onClick={onInstall} style={{ height: 50, borderRadius: 14, border: "none", background: "linear-gradient(90deg,#FF6B00,#FF8C00)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Lexend", position: "relative", overflow: "hidden", boxShadow: "0 4px 18px rgba(255,107,0,0.4)" }}>
              <span style={{ position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)", animation: "shimmer 2.5s infinite" }} />
              <span style={{ position: "relative", zIndex: 1 }}>📲 Cài đặt ngay</span>
            </button>
          )}
          <button onClick={onDismiss} style={{ height: 50, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#6a5a40", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Lexend" }}>
            {isIOSOther ? "Đã hiểu" : "Để sau"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── reminder bar (lần 2+) ── */
function ReminderBar({ platform, onInstall, onDismiss }: {
  platform: Platform
  onInstall: () => void
  onDismiss: () => void
}) {
  const isIOS = platform === "ios-safari" || platform === "ios-other"
  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      style={{ position: "fixed", bottom: 80, left: 14, right: 14, zIndex: 60, borderRadius: 16, background: "rgba(8,8,6,0.95)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,107,0,0.25)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#FF6B00,#FF8C00)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🛵</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 700 }}>Thêm vào màn hình chính</div>
        <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 1 }}>Mở nhanh · Nhận thông báo · Dùng offline</div>
      </div>
      <button onClick={isIOS ? onInstall : onInstall} style={{ padding: "7px 12px", borderRadius: 10, border: "none", background: "linear-gradient(90deg,#FF6B00,#FF8C00)", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend", whiteSpace: "nowrap" }}>
        {isIOS ? "Xem cách cài" : "Cài ngay"}
      </button>
      <button onClick={onDismiss} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "rgba(255,255,255,0.06)", color: "#6a5a40", fontSize: 14, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
    </motion.div>
  )
}

/* ── export chính ── */
export default function InstallPrompt() {
  const { platform, showModal, showReminder, installed, install, confirmInstalled, dismiss } = usePWAInstall()
  if (installed) return null

  return (
    <>
      <style>{`@keyframes shimmer{0%{left:-60%}100%{left:120%}}`}</style>
      <AnimatePresence>
        {showModal && (
          <InstallModal
            key="modal"
            platform={platform}
            onInstall={install}
            onConfirm={confirmInstalled}
            onDismiss={dismiss}
          />
        )}
        {showReminder && !showModal && (
          <ReminderBar
            key="reminder"
            platform={platform}
            onInstall={() => { dismiss(); setTimeout(() => { localStorage.removeItem("pwa_dismissed"); window.location.reload() }, 50) }}
            onDismiss={dismiss}
          />
        )}
      </AnimatePresence>
    </>
  )
}
