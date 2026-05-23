"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

interface Driver {
  id: string
  name: string
  phone: string
  avatarUrl: string | null
  vehicle: string
  vehicleType: string
  vehicleModel: string | null
  plate: string
  joinedDate: string
  status: "pending" | "approved"
  rating: number | null
  trips: number
  idCardNumber: string | null
  licenseNumber: string | null
  xuBalance: number
  xuWalletId: string | null
}

const STATUS_LABEL: Record<Driver["status"], string> = {
  pending:  "Chờ duyệt",
  approved: "Đã duyệt",
}
const STATUS_COLOR: Record<Driver["status"], string> = {
  pending:  "255,179,71",
  approved: "62,207,110",
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function AdminDriversPage() {
  const [drivers, setDrivers]   = useState<Driver[]>([])
  const [filter, setFilter]     = useState<"all" | Driver["status"]>("all")
  const [selected, setSelected] = useState<Driver | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  /* xu panel state */
  const [xuTab, setXuTab]     = useState<"topup" | "withdraw">("topup")
  const [xuAmount, setXuAmount] = useState("")
  const [xuNote, setXuNote]   = useState("")
  const [xuSaving, setXuSaving] = useState(false)
  const [xuToast, setXuToast] = useState("")

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data: rows } = await supabase
      .from("drivers")
      .select("id, vehicle_type, vehicle_model, license_plate, id_card_number, license_number, status, rating_avg, total_trips, is_approved, created_at")
      .order("created_at", { ascending: false })

    if (!rows || rows.length === 0) { setLoading(false); return }

    const ids = rows.map(r => r.id)

    const [{ data: profiles }, { data: wallets }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, avatar_url").in("id", ids),
      supabase.from("wallets").select("id, user_id, balance").in("user_id", ids).eq("type", "driver"),
    ])

    const profMap   = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    const walletMap = Object.fromEntries((wallets ?? []).map(w => [w.user_id, w]))

    setDrivers(rows.map(r => {
      const prof   = profMap[r.id]
      const wallet = walletMap[r.id]
      return {
        id:            r.id,
        name:          prof?.full_name ?? "Chưa cập nhật",
        phone:         prof?.phone ?? "—",
        avatarUrl:     prof?.avatar_url ?? null,
        vehicle:       [r.vehicle_type, r.vehicle_model].filter(Boolean).join(" ") || "—",
        vehicleType:   r.vehicle_type ?? "—",
        vehicleModel:  r.vehicle_model ?? null,
        plate:         r.license_plate ?? "—",
        joinedDate:    new Date(r.created_at).toLocaleDateString("vi-VN"),
        status:        r.is_approved ? "approved" : "pending",
        rating:        r.rating_avg ?? null,
        trips:         r.total_trips ?? 0,
        idCardNumber:  r.id_card_number ?? null,
        licenseNumber: r.license_number ?? null,
        xuBalance:     wallet?.balance ?? 0,
        xuWalletId:    wallet?.id ?? null,
      }
    }))
    setLoading(false)
  }

  const approve = async (id: string) => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from("drivers").update({ is_approved: true, approved_at: new Date().toISOString() }).eq("id", id)
    setDrivers(p => p.map(d => d.id === id ? { ...d, status: "approved" } : d))
    if (selected?.id === id) setSelected(p => p ? { ...p, status: "approved" } : p)
    setSaving(false)
  }

  const reject = async (id: string) => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from("profiles").update({ is_active: false }).eq("id", id)
    setDrivers(p => p.filter(d => d.id !== id))
    if (selected?.id === id) setSelected(null)
    setSaving(false)
  }

  const fireXuToast = (msg: string) => {
    setXuToast(msg)
    setTimeout(() => setXuToast(""), 2500)
  }

  const handleXuAction = async () => {
    if (!selected) return
    const amt = parseInt(xuAmount.replace(/\D/g, ""), 10)
    if (!amt || amt <= 0) return fireXuToast("Số tiền không hợp lệ")
    if (xuTab === "withdraw" && amt > selected.xuBalance) return fireXuToast("Số xu không đủ để rút")

    setXuSaving(true)
    const supabase = createClient()

    let walletId = selected.xuWalletId

    if (!walletId) {
      const { data: newWallet } = await supabase
        .from("wallets")
        .insert({ user_id: selected.id, type: "driver", balance: 0 })
        .select("id")
        .single()
      walletId = newWallet?.id ?? null
    }

    if (!walletId) { fireXuToast("Lỗi tạo ví"); setXuSaving(false); return }

    const delta      = xuTab === "topup" ? amt : -amt
    const newBalance = selected.xuBalance + delta

    await supabase.from("wallets").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", walletId)
    await supabase.from("transactions").insert({
      wallet_id:     walletId,
      type:          xuTab === "topup" ? "topup" : "withdrawal",
      amount:        amt,
      balance_after: newBalance,
      ref_type:      "admin_manual",
      note:          xuNote || (xuTab === "topup" ? "Admin nạp xu thủ công" : "Admin rút xu thủ công"),
    })

    const updated = { ...selected, xuBalance: newBalance, xuWalletId: walletId }
    setSelected(updated)
    setDrivers(p => p.map(d => d.id === selected.id ? { ...d, xuBalance: newBalance, xuWalletId: walletId } : d))
    setXuAmount("")
    setXuNote("")
    fireXuToast(xuTab === "topup" ? `✅ Đã nạp ${fmt(amt)}` : `✅ Đã rút ${fmt(amt)}`)
    setXuSaving(false)
  }

  const shown = filter === "all" ? drivers : drivers.filter(d => d.status === filter)
  const counts = {
    pending:  drivers.filter(d => d.status === "pending").length,
    approved: drivers.filter(d => d.status === "approved").length,
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{display:none}
        input{font-family:'Lexend',sans-serif;outline:none}
      `}</style>
      <div style={{ position: "fixed", inset: 0, background: "#080806", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "52px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <a href="/admin" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#f8f0e0", fontSize: 16 }}>←</a>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 16, fontWeight: 800 }}>Quản lý tài xế</div>
              <div style={{ color: "#6a5a40", fontSize: 9 }}>
                {loading ? "Đang tải..." : `${drivers.length} tài xế · ${counts.pending} chờ duyệt`}
              </div>
            </div>
          </div>

          {!loading && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[
                { key: "pending",  label: "Chờ duyệt", bg: "rgba(255,179,71,0.1)",  border: "rgba(255,179,71,0.25)",  color: "#FFB347" },
                { key: "approved", label: "Đã duyệt",  bg: "rgba(62,207,110,0.1)", border: "rgba(62,207,110,0.25)", color: "#3ecf6e" },
              ].map(({ key, label, bg, border, color }) => (
                <div key={key} style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "8px", textAlign: "center" }}>
                  <div style={{ color, fontSize: 18, fontWeight: 800 }}>{counts[key as Driver["status"]]}</div>
                  <div style={{ color: "#6a5a40", fontSize: 7, marginTop: 1 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 5 }}>
            {(["all", "pending", "approved"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ flex: 1, height: 30, borderRadius: 8, background: filter === f ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)", border: filter === f ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.06)", color: filter === f ? "#FF8C00" : "#6a5a40", fontSize: 9, fontWeight: filter === f ? 700 : 400, cursor: "pointer", fontFamily: "Lexend" }}>
                {f === "all" ? "Tất cả" : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 20px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 11 }}>Đang tải tài xế...</div>
          ) : shown.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 11 }}>Không có tài xế nào</div>
          ) : shown.map(driver => (
            <div key={driver.id} onClick={() => { setSelected(driver); setXuAmount(""); setXuNote("") }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, marginBottom: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: "rgba(255,107,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, overflow: "hidden" }}>
                  {driver.avatarUrl
                    ? <img src={driver.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : "🧑‍💼"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700 }}>{driver.name}</span>
                    <span style={{ background: `rgba(${STATUS_COLOR[driver.status]},0.1)`, border: `1px solid rgba(${STATUS_COLOR[driver.status]},0.3)`, borderRadius: 6, padding: "2px 8px", color: `rgba(${STATUS_COLOR[driver.status]},1)`, fontSize: 8, fontWeight: 700 }}>
                      {STATUS_LABEL[driver.status]}
                    </span>
                  </div>
                  <div style={{ color: "#6a5a40", fontSize: 9 }}>{driver.vehicle} · {driver.plate}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <span style={{ color: driver.idCardNumber ? "#3ecf6e" : "#ff4040", fontSize: 8 }}>{driver.idCardNumber ? "✅ CMND" : "❌ CMND"}</span>
                    <span style={{ color: driver.licenseNumber ? "#3ecf6e" : "#ff4040", fontSize: 8 }}>{driver.licenseNumber ? "✅ Bằng lái" : "❌ Bằng lái"}</span>
                    {driver.rating && <span style={{ color: "#FF8C00", fontSize: 8 }}>⭐ {driver.rating} · {driver.trips} chuyến</span>}
                    <span style={{ color: "#b464ff", fontSize: 8 }}>🪙 {fmt(driver.xuBalance)}</span>
                  </div>
                </div>
              </div>
              {driver.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={e => { e.stopPropagation(); approve(driver.id) }} disabled={saving} style={{ flex: 1, height: 36, borderRadius: 10, background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.3)", color: "#3ecf6e", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>✅ Phê duyệt</button>
                  <button onClick={e => { e.stopPropagation(); reject(driver.id) }} disabled={saving} style={{ flex: 1, height: 36, borderRadius: 10, background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>❌ Từ chối</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Detail bottom sheet */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, backdropFilter: "blur(4px)" }} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 22, stiffness: 300 }}
                style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0e0c09", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.08)", zIndex: 51, maxHeight: "88dvh", display: "flex", flexDirection: "column" }}>

                {/* Sheet header */}
                <div style={{ padding: "16px 16px 0", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 800 }}>Chi tiết tài xế</div>
                    <button onClick={() => setSelected(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
                  </div>

                  {/* Avatar + name */}
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                    <div style={{ width: 60, height: 60, borderRadius: 16, flexShrink: 0, background: "rgba(255,107,0,0.1)", border: "2px solid rgba(255,107,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, overflow: "hidden" }}>
                      {selected.avatarUrl
                        ? <img src={selected.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : "🧑‍💼"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>{selected.name}</div>
                      <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 2 }}>{selected.phone}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                        <span style={{ background: `rgba(${STATUS_COLOR[selected.status]},0.1)`, border: `1px solid rgba(${STATUS_COLOR[selected.status]},0.25)`, borderRadius: 6, padding: "2px 8px", color: `rgb(${STATUS_COLOR[selected.status]})`, fontSize: 8, fontWeight: 700 }}>
                          {STATUS_LABEL[selected.status]}
                        </span>
                        {selected.rating && (
                          <span style={{ background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 6, padding: "2px 8px", color: "#FF8C00", fontSize: 8, fontWeight: 700 }}>
                            ⭐ {selected.rating} · {selected.trips} chuyến
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scrollable body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 32px" }}>

                  {/* Thông tin xe */}
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "0 14px", marginBottom: 10 }}>
                    <div style={{ padding: "10px 0 4px", color: "#FF8C00", fontSize: 10, fontWeight: 700 }}>🏍️ Phương tiện</div>
                    {[
                      ["Loại xe",       selected.vehicleType],
                      ["Model",         selected.vehicleModel ?? "Chưa cập nhật"],
                      ["Biển số",       selected.plate],
                      ["Ngày đăng ký",  selected.joinedDate],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ color: "#6a5a40", fontSize: 9 }}>{k}</span>
                        <span style={{ color: "#f8f0e0", fontSize: 9, fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ height: 4 }} />
                  </div>

                  {/* Giấy tờ */}
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "0 14px", marginBottom: 10 }}>
                    <div style={{ padding: "10px 0 4px", color: "#4a8ff5", fontSize: 10, fontWeight: 700 }}>📋 Giấy tờ pháp lý</div>
                    {[
                      ["CMND / CCCD",  selected.idCardNumber  ?? "❌ Chưa cung cấp"],
                      ["Số bằng lái",  selected.licenseNumber ?? "❌ Chưa cung cấp"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ color: "#6a5a40", fontSize: 9 }}>{k}</span>
                        <span style={{ color: (v as string).startsWith("❌") ? "#ff4040" : "#3ecf6e", fontSize: 9, fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ height: 4 }} />
                  </div>

                  {/* Xu / Ví */}
                  <div style={{ background: "rgba(180,100,255,0.05)", border: "1px solid rgba(180,100,255,0.2)", borderRadius: 14, padding: "14px 14px 12px", marginBottom: 10 }}>
                    <div style={{ color: "#b464ff", fontSize: 10, fontWeight: 700, marginBottom: 10 }}>🪙 Ví xu tài xế</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <span style={{ color: "#6a5a40", fontSize: 10 }}>Số dư hiện tại</span>
                      <span style={{ color: "#b464ff", fontSize: 18, fontWeight: 800 }}>{fmt(selected.xuBalance)}</span>
                    </div>

                    {/* Topup / Withdraw tabs */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                      {([["topup", "💰 Nạp xu", "#3ecf6e"], ["withdraw", "📤 Rút xu", "#ff4040"]] as const).map(([key, label, color]) => (
                        <button key={key} onClick={() => setXuTab(key)} style={{ flex: 1, height: 34, borderRadius: 9, background: xuTab === key ? `rgba(${color === "#3ecf6e" ? "62,207,110" : "255,64,64"},0.12)` : "rgba(255,255,255,0.04)", border: xuTab === key ? `1px solid ${color}55` : "1px solid rgba(255,255,255,0.07)", color: xuTab === key ? color : "#6a5a40", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="number"
                      value={xuAmount}
                      onChange={e => setXuAmount(e.target.value)}
                      placeholder="Số tiền (VND)"
                      style={{ width: "100%", height: 40, padding: "0 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(180,100,255,0.25)", borderRadius: 9, color: "#f8f0e0", fontSize: 12, marginBottom: 8 }}
                    />
                    <input
                      type="text"
                      value={xuNote}
                      onChange={e => setXuNote(e.target.value)}
                      placeholder="Ghi chú (không bắt buộc)"
                      style={{ width: "100%", height: 36, padding: "0 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, color: "#f8f0e0", fontSize: 11, marginBottom: 10 }}
                    />

                    <button onClick={handleXuAction} disabled={xuSaving || !xuAmount}
                      style={{ width: "100%", height: 40, borderRadius: 10, border: "none", background: xuTab === "topup" ? "linear-gradient(90deg,#3ecf6e,#2aad58)" : "linear-gradient(90deg,#ff4040,#cc2020)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend", opacity: (!xuAmount || xuSaving) ? 0.5 : 1 }}>
                      {xuSaving ? "Đang xử lý..." : xuTab === "topup" ? "✅ Xác nhận nạp xu" : "📤 Xác nhận rút xu"}
                    </button>

                    {xuToast && (
                      <div style={{ marginTop: 8, textAlign: "center", color: xuToast.startsWith("✅") ? "#3ecf6e" : "#ff4040", fontSize: 11, fontWeight: 600 }}>
                        {xuToast}
                      </div>
                    )}
                  </div>

                  {/* Approve / reject */}
                  {selected.status === "pending" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { approve(selected.id); setSelected(null) }} disabled={saving} style={{ flex: 1, height: 44, borderRadius: 12, background: "rgba(62,207,110,0.12)", border: "1px solid rgba(62,207,110,0.35)", color: "#3ecf6e", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>✅ Phê duyệt tài xế</button>
                      <button onClick={() => { reject(selected.id); setSelected(null) }} disabled={saving} style={{ flex: 1, height: 44, borderRadius: 12, background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>❌ Từ chối</button>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
