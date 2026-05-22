"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

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

/* ── hours sheet ── */
function HoursSheet({ onClose }: { onClose: () => void }) {
  const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
  const [hours, setHours] = useState(
    DAYS.map(d => ({ day: d, open: true, from: "07:00", to: "21:00" }))
  )
  const toggle = (i: number) => setHours(h => h.map((x, j) => j === i ? { ...x, open: !x.open } : x))
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(8,8,6,0.75)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#0e0b07", borderTop: "1px solid rgba(255,107,0,0.3)", borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)", maxHeight: "88dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>🕐 Giờ hoạt động</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        {hours.map((h, i) => (
          <div key={h.day} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < hours.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div style={{ width: 56, color: h.open ? "#f8f0e0" : "#6a5a40", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{h.day}</div>
            <Toggle on={h.open} onToggle={() => toggle(i)} />
            {h.open ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                <input type="time" value={h.from} onChange={e => setHours(a => a.map((x, j) => j === i ? { ...x, from: e.target.value } : x))}
                  style={{ flex: 1, height: 34, padding: "0 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 8, color: "#f8f0e0", fontSize: 11, fontFamily: "Lexend", colorScheme: "dark" }} />
                <span style={{ color: "#6a5a40", fontSize: 10 }}>–</span>
                <input type="time" value={h.to} onChange={e => setHours(a => a.map((x, j) => j === i ? { ...x, to: e.target.value } : x))}
                  style={{ flex: 1, height: 34, padding: "0 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 8, color: "#f8f0e0", fontSize: 11, fontFamily: "Lexend", colorScheme: "dark" }} />
              </div>
            ) : (
              <div style={{ flex: 1, color: "#6a5a40", fontSize: 10 }}>Đóng cửa</div>
            )}
          </div>
        ))}
        <button onClick={onClose} style={{ width: "100%", height: 48, borderRadius: 14, border: "none", background: "linear-gradient(90deg,#FF6B00,#FF8C00)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Lexend", marginTop: 16 }}>✓ Lưu giờ hoạt động</button>
      </div>
    </motion.div>
  )
}

/* ── main ── */
export default function MerchantSettingsPage() {
  /* shop settings */
  const [shop, setShop] = useState({
    autoAccept:     false,
    busyMode:       false,
    preorderAllow:  true,
    showRating:     true,
    showSoldCount:  true,
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
    showPhone:      false,
    analytics:      true,
  })

  /* sheets */
  const [showPw,    setShowPw]    = useState(false)
  const [showHours, setShowHours] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [toast, setToast]           = useState("")

  const fire = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200) }
  const sw = (k: keyof typeof shop)  => setShop(p => ({ ...p, [k]: !p[k] }))
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
            style={{ position: "fixed", top: 62, left: "50%", transform: "translateX(-50%)", zIndex: 999, whiteSpace: "nowrap", background: "rgba(62,207,110,0.15)", border: "1px solid rgba(62,207,110,0.35)", borderRadius: 12, padding: "7px 18px", color: "#3ecf6e", fontSize: 11, fontWeight: 600, backdropFilter: "blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ minHeight: "100dvh", background: "#080806", paddingBottom: 24 }}>

        {/* header */}
        <div style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(8,8,6,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/merchant" style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#f8f0e0", fontSize: 15 }}>←</a>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>⚙️ Cài đặt cửa hàng</div>
        </div>

        <div style={{ padding: "14px 16px 0" }}>

          {/* shop summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 16, marginBottom: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: "rgba(255,107,0,0.15)", border: "2px solid rgba(255,107,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>🍜</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 800 }}>Bún Bò Huế Ngon</div>
              <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 2 }}>22 Lê Hồng Phong, Phước An</div>
              <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                <span style={{ background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.25)", borderRadius: 5, padding: "1px 8px", color: "#3ecf6e", fontSize: 8, fontWeight: 700 }}>🟢 Đang mở</span>
                <span style={{ background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 5, padding: "1px 8px", color: "#FF8C00", fontSize: 8, fontWeight: 700 }}>⭐ 4.8</span>
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
              <div style={{ color: "#4a8ff5", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Hoa hồng nền tảng: 15%</div>
              <div style={{ color: "#6a5a40", fontSize: 10, lineHeight: 1.5 }}>Áp dụng cho mỗi đơn hàng. Thanh toán hàng tuần vào thứ Hai. Muốn điều chỉnh? Liên hệ admin để đàm phán.</div>
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
            <Row icon="🔥" label="Hiện số lượng đã bán" sub="Hiển thị 'Đã bán X' trên từng món" last>
              <Toggle on={shop.showSoldCount} onToggle={() => sw("showSoldCount")} />
            </Row>
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
            <Row icon="📞" label="Hiện số điện thoại" sub="Khách có thể gọi trực tiếp cho quán">
              <Toggle on={priv.showPhone} onToggle={() => sp("showPhone")} />
            </Row>
            <Row icon="📊" label="Chia sẻ dữ liệu phân tích" sub="Giúp tối ưu đề xuất món & quảng cáo" last>
              <Toggle on={priv.analytics} onToggle={() => sp("analytics")} color="#4a8ff5" />
            </Row>
          </Section>

          {/* cash model info */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: "#6a5a40", fontSize: 9, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", paddingLeft: 4, marginBottom: 8 }}>Cơ chế thu tiền</div>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden" }}>

              {/* flow steps */}
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>💵 Luồng tiền — Tiền mặt</div>
                {[
                  { step: "1", icon: "🛒", color: "#4a8ff5", label: "Khách đặt đơn",          sub: "Khách chọn thanh toán tiền mặt khi nhận hàng"                },
                  { step: "2", icon: "✅", color: "#FFB347", label: "Quán xác nhận & chuẩn bị", sub: "Chuẩn bị đơn sau khi xác nhận"                              },
                  { step: "3", icon: "🛵", color: "#FF8C00", label: "Tài xế đến lấy hàng",     sub: "Tài xế trả tiền mặt (đã trừ hoa hồng 15%) cho quán"          },
                  { step: "4", icon: "📦", color: "#3ecf6e", label: "Tài xế giao khách",        sub: "Khách trả toàn bộ tiền mặt cho tài xế (gồm phí giao hàng)"  },
                ].map((s, i, arr) => (
                  <div key={s.step} style={{ display: "flex", gap: 12, paddingBottom: i < arr.length - 1 ? 12 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: `rgba(${s.color === "#4a8ff5" ? "74,143,245" : s.color === "#FFB347" ? "255,179,71" : s.color === "#FF8C00" ? "255,140,0" : "62,207,110"},0.15)`, border: `1.5px solid ${s.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{s.icon}</div>
                      {i < arr.length - 1 && <div style={{ width: 1.5, flex: 1, background: "rgba(255,255,255,0.07)", marginTop: 4, minHeight: 16 }} />}
                    </div>
                    <div style={{ paddingBottom: i < arr.length - 1 ? 0 : 0 }}>
                      <div style={{ color: s.color, fontSize: 11, fontWeight: 700 }}>Bước {s.step}: {s.label}</div>
                      <div style={{ color: "#6a5a40", fontSize: 9.5, marginTop: 2, lineHeight: 1.5 }}>{s.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* example calc */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#b0956a", fontSize: 10, fontWeight: 700, marginBottom: 10 }}>📊 Ví dụ: Đơn 100.000đ — không có voucher</div>
                {[
                  { label: "Tiền hàng (khách trả)",   value: "100.000đ", color: "#f8f0e0",  bold: false },
                  { label: "Hoa hồng Giao Nhanh 15%", value: "−15.000đ", color: "#ff4040",  bold: false },
                  { label: "✓ Quán thực nhận",         value: "85.000đ",  color: "#3ecf6e",  bold: true  },
                  { label: "Phí giao hàng (tài xế giữ)", value: "+15.000đ–18.000đ", color: "#6a5a40", bold: false },
                ].map((r, i) => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: i === 2 ? "1px solid rgba(62,207,110,0.25)" : i === 3 ? "1px solid rgba(255,255,255,0.05)" : "none", marginTop: i === 2 ? 4 : 0 }}>
                    <span style={{ color: r.bold ? "#3ecf6e" : "#6a5a40", fontSize: r.bold ? 12 : 10, fontWeight: r.bold ? 800 : 400 }}>{r.label}</span>
                    <span style={{ color: r.color, fontSize: r.bold ? 14 : 11, fontWeight: r.bold ? 800 : 600 }}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* voucher note */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#b0956a", fontSize: 10, fontWeight: 700, marginBottom: 10 }}>🎟 Ví dụ: Đơn 100.000đ — có voucher 10.000đ</div>
                {[
                  { label: "Tiền hàng",               value: "100.000đ", color: "#f8f0e0",  bold: false },
                  { label: "Hoa hồng 15%",            value: "−15.000đ", color: "#ff4040",  bold: false },
                  { label: "Voucher giảm giá",         value: "−10.000đ", color: "#FFB347",  bold: false },
                  { label: "✓ Quán thực nhận",         value: "75.000đ",  color: "#3ecf6e",  bold: true  },
                ].map((r, i) => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: i === 3 ? "1px solid rgba(62,207,110,0.25)" : "none", marginTop: i === 3 ? 4 : 0 }}>
                    <span style={{ color: r.bold ? "#3ecf6e" : "#6a5a40", fontSize: r.bold ? 12 : 10, fontWeight: r.bold ? 800 : 400 }}>{r.label}</span>
                    <span style={{ color: r.color, fontSize: r.bold ? 14 : 11, fontWeight: r.bold ? 800 : 600 }}>{r.value}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(255,179,71,0.06)", border: "1px solid rgba(255,179,71,0.15)" }}>
                  <div style={{ color: "#6a5a40", fontSize: 9, lineHeight: 1.5 }}>⚠️ Voucher do <strong style={{ color: "#FFB347" }}>quán tạo ra</strong> sẽ bị trừ vào doanh thu của quán. Voucher do Giao Nhanh tài trợ sẽ không trừ.</div>
                </div>
              </div>

              {/* revenue link */}
              <div onClick={() => { window.location.href = "/merchant/revenue" }}
                style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(62,207,110,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📈</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 600 }}>Xem báo cáo doanh thu</div>
                  <div style={{ color: "#6a5a40", fontSize: 10 }}>Chi tiết từng đơn: thực nhận, hoa hồng, voucher</div>
                </div>
                <div style={{ color: "#6a5a40", fontSize: 16 }}>›</div>
              </div>
            </div>
          </div>

          {/* security */}
          <Section title="Bảo mật">
            <Row icon="🔑" label="Đổi mật khẩu" sub="Cập nhật mật khẩu đăng nhập" onClick={() => setShowPw(true)} arrow />
            <Row icon="📱" label="Phiên đăng nhập" sub="Quản lý thiết bị đang đăng nhập" onClick={() => fire("Tính năng đang phát triển...")} arrow />
            <Row icon="🛡" label="Xác thực 2 lớp" sub="Bảo vệ bằng OTP qua SMS" onClick={() => fire("Tính năng đang phát triển...")} arrow last />
          </Section>

          {/* support */}
          <Section title="Hỗ trợ">
            <Row icon="❓" label="Câu hỏi thường gặp" sub="Hướng dẫn chủ cửa hàng" onClick={() => fire("Đang mở FAQ...")} arrow />
            <Row icon="💬" label="Chat với hỗ trợ" sub="Phản hồi trong vòng 30 phút" onClick={() => fire("Đang kết nối...")} arrow />
            <Row icon="⚠️" label="Báo cáo vấn đề" sub="Đơn hàng sai, tài xế vi phạm..." onClick={() => fire("Đang mở form...")} arrow />
            <Row icon="📝" label="Quy tắc merchant" sub="Chính sách, điều khoản đối tác" onClick={() => fire("Đang mở tài liệu...")} arrow last />
          </Section>

          {/* about */}
          <Section title="Về ứng dụng">
            <Row icon="🚀" label="Giao Nhanh Merchant" sub="Phiên bản 1.0.0" />
            <Row icon="⚖️" label="Điều khoản & Chính sách" onClick={() => fire("Đang mở...")} arrow />
            <Row icon="📬" label="Liên hệ" sub="giaonhanh.phuocan@gmail.com" last />
          </Section>

          {/* account / danger */}
          <Section title="Tài khoản">
            <Row icon="🚪" label="Đăng xuất" sub="Đăng xuất khỏi thiết bị này" danger onClick={() => fire("Đang đăng xuất...")} arrow />
            <Row icon="🗑" label="Xóa tài khoản merchant" sub="Xóa shop và dữ liệu vĩnh viễn" danger onClick={() => setShowDelete(true)} arrow last />
          </Section>
        </div>
      </div>

      {/* sheets */}
      <AnimatePresence>
        {showPw    && <PwSheet    onClose={() => setShowPw(false)}    />}
        {showHours && <HoursSheet onClose={() => setShowHours(false)} />}
      </AnimatePresence>

      {/* delete confirm */}
      <AnimatePresence>
        {showDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(8,8,6,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ background: "#0e0b07", border: "1px solid rgba(255,64,64,0.3)", borderRadius: 20, padding: 24, maxWidth: 340, width: "100%" }}>
              <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>⚠️</div>
              <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>Xóa cửa hàng?</div>
              <div style={{ color: "#6a5a40", fontSize: 11, textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>
                Toàn bộ thực đơn, lịch sử đơn hàng và đánh giá sẽ bị xóa vĩnh viễn. <strong style={{ color: "#ff4040" }}>Không thể hoàn tác.</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button onClick={() => setShowDelete(false)} style={{ height: 44, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#b0956a", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>Hủy</button>
                <button style={{ height: 44, borderRadius: 12, background: "rgba(255,64,64,0.12)", border: "1px solid rgba(255,64,64,0.3)", color: "#ff4040", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>Xóa cửa hàng</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
