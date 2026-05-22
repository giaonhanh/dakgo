"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

interface Driver {
  id: string
  name: string
  phone: string
  vehicle: string
  plate: string
  joinedDate: string
  status: "pending" | "approved"
  rating: number | null
  trips: number
  idOk: boolean
  licenseOk: boolean
}

const STATUS_LABEL: Record<Driver["status"], string> = {
  pending:  "Chờ duyệt",
  approved: "Đã duyệt",
}
const STATUS_COLOR: Record<Driver["status"], string> = {
  pending:  "255,179,71",
  approved: "62,207,110",
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [filter, setFilter] = useState<"all" | Driver["status"]>("all")
  const [selected, setSelected] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const supabase = createClient()
    const { data: rows } = await supabase
      .from("drivers")
      .select("id, vehicle_type, vehicle_model, license_plate, id_card_number, license_number, status, rating_avg, total_trips, is_approved, created_at")
      .order("created_at", { ascending: false })

    if (!rows || rows.length === 0) { setLoading(false); return }

    const ids = rows.map(r => r.id)
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids)
    const profMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    setDrivers(rows.map(r => {
      const prof = profMap[r.id]
      return {
        id: r.id,
        name:     prof?.full_name ?? "Chưa cập nhật",
        phone:    prof?.phone ?? "—",
        vehicle:  [r.vehicle_type, r.vehicle_model].filter(Boolean).join(" ") || "—",
        plate:    r.license_plate ?? "—",
        joinedDate: new Date(r.created_at).toLocaleDateString("vi-VN"),
        status:   r.is_approved ? "approved" : "pending",
        rating:   r.rating_avg ?? null,
        trips:    r.total_trips ?? 0,
        idOk:     !!r.id_card_number,
        licenseOk: !!r.license_number,
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
            <div key={driver.id} onClick={() => setSelected(driver)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, marginBottom: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: "rgba(255,107,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🧑‍💼</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700 }}>{driver.name}</span>
                    <span style={{ background: `rgba(${STATUS_COLOR[driver.status]},0.1)`, border: `1px solid rgba(${STATUS_COLOR[driver.status]},0.3)`, borderRadius: 6, padding: "2px 8px", color: `rgba(${STATUS_COLOR[driver.status]},1)`, fontSize: 8, fontWeight: 700 }}>
                      {STATUS_LABEL[driver.status]}
                    </span>
                  </div>
                  <div style={{ color: "#6a5a40", fontSize: 9 }}>{driver.vehicle} · {driver.plate}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <span style={{ color: driver.idOk ? "#3ecf6e" : "#ff4040", fontSize: 8 }}>{driver.idOk ? "✅ CMND" : "❌ CMND"}</span>
                    <span style={{ color: driver.licenseOk ? "#3ecf6e" : "#ff4040", fontSize: 8 }}>{driver.licenseOk ? "✅ Bằng lái" : "❌ Bằng lái"}</span>
                    {driver.rating && <span style={{ color: "#FF8C00", fontSize: 8 }}>⭐ {driver.rating} · {driver.trips} chuyến</span>}
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

        {/* Detail modal */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, backdropFilter: "blur(4px)" }} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 22, stiffness: 300 }} style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0e0c09", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.08)", padding: "20px 16px 32px", zIndex: 51 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 800 }}>{selected.name}</div>
                  <button onClick={() => setSelected(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
                </div>
                {[
                  ["Số ĐT",       selected.phone],
                  ["Phương tiện", selected.vehicle],
                  ["Biển số",     selected.plate],
                  ["Ngày đăng ký",selected.joinedDate],
                  ["Trạng thái",  STATUS_LABEL[selected.status]],
                  ["CMND/CCCD",   selected.idOk ? "✅ Đã cung cấp" : "❌ Chưa có"],
                  ["Bằng lái",    selected.licenseOk ? "✅ Đã cung cấp" : "❌ Chưa có"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color: "#6a5a40", fontSize: 9 }}>{k}</span>
                    <span style={{ color: "#f8f0e0", fontSize: 9, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                {selected.status === "pending" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => { approve(selected.id); setSelected(null) }} disabled={saving} style={{ flex: 1, height: 44, borderRadius: 12, background: "rgba(62,207,110,0.12)", border: "1px solid rgba(62,207,110,0.35)", color: "#3ecf6e", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>✅ Phê duyệt tài xế</button>
                    <button onClick={() => { reject(selected.id); setSelected(null) }} disabled={saving} style={{ flex: 1, height: 44, borderRadius: 12, background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>❌ Từ chối</button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
