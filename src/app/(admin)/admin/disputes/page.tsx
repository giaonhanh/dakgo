"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"


interface BlacklistEntry {
  id: string
  userId: string
  userName: string
  userPhone: string
  reason: string
  autoTriggered: boolean
  createdAt: string
}

export default function AdminDisputesPage() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<BlacklistEntry | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: rows } = await supabase
        .from("blacklist")
        .select("id, user_id, reason, auto_triggered, created_at")
        .order("created_at", { ascending: false })

      if (!rows || rows.length === 0) { setLoading(false); return }

      const ids = rows.map(r => r.user_id)
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids)
      const profMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

      setEntries(rows.map(r => {
        const p = profMap[r.user_id] ?? {}
        return {
          id: r.id,
          userId: r.user_id,
          userName: (p as { full_name?: string }).full_name ?? "Người dùng",
          userPhone: (p as { phone?: string }).phone ?? "—",
          reason: r.reason,
          autoTriggered: r.auto_triggered,
          createdAt: new Date(r.created_at).toLocaleString("vi-VN"),
        }
      }))
      setLoading(false)
    }
    load()
  }, [])

  const unlockUser = async (entry: BlacklistEntry) => {
    const supabase = createClient()
    await supabase.from("blacklist").delete().eq("id", entry.id)
    await supabase.from("profiles").update({ is_active: true }).eq("id", entry.userId)
    setEntries(p => p.filter(e => e.id !== entry.id))
    setSelected(null)
  }

  const shown = entries.filter(e =>
    !search ||
    e.userName.toLowerCase().includes(search.toLowerCase()) ||
    e.userPhone.includes(search) ||
    e.reason.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .kpi-card { animation: fadeUp 0.4s ease both; }
        .kpi-card:hover { transform: translateY(-2px); border-color: rgba(255,107,0,0.35) !important; transition: all 0.2s; }
        .dispute-row:hover { background: rgba(255,255,255,0.04) !important; }
        input { font-family: 'Lexend', sans-serif; outline: none; }
      `}</style>
      <AdminShell
        pageTitle="⚖️ Tranh chấp & Blacklist"
        pageSubtitle="Người dùng bị khóa · Hủy đơn quá mức"
        actions={entries.length > 0 ? (
          <div style={{ padding: "6px 16px", borderRadius: 8, background: "rgba(255,64,64,0.1)", border: "1px solid rgba(255,64,64,0.25)", color: "#ff4040", fontSize: 12, fontWeight: 700 }}>
            🚫 {entries.length} người dùng bị khóa
          </div>
        ) : undefined}
      >
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", height: "100%" }}>

            {/* KPI */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Tổng bị khóa",   value: entries.length,                                    icon: "🚫", color: "#ff4040" },
                { label: "Tự động (hủy đơn)", value: entries.filter(e => e.autoTriggered).length,    icon: "🤖", color: "#FFB347" },
                { label: "Khóa thủ công",   value: entries.filter(e => !e.autoTriggered).length,     icon: "👤", color: "#4a8ff5" },
                { label: "Hôm nay",         value: entries.filter(e => new Date(e.createdAt).toDateString() === new Date().toDateString()).length, icon: "📅", color: "#3ecf6e" },
              ].map((k, i) => (
                <div key={k.label} className="kpi-card" style={{ animationDelay: `${i * 0.06}s`, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{k.icon}</div>
                  <div style={{ color: k.color, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{k.value}</div>
                  <div style={{ color: "#6a5a40", fontSize: 10 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Search */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#6a5a40" }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, SĐT, lý do khóa..." style={{ flex: 1, background: "none", border: "none", color: "#f0eaff", fontSize: 12 }} />
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "40px 0", textAlign: "center", color: "#6a5a40", fontSize: 11 }}>
                Đang tải...
              </div>
            ) : shown.length === 0 ? (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "60px 0", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ color: "#3ecf6e", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Không có tranh chấp nào</div>
                <div style={{ color: "#6a5a40", fontSize: 11 }}>Tất cả người dùng đang hoạt động bình thường</div>
              </div>
            ) : (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.8fr 120px 1.8fr 120px 110px 80px", padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Người dùng", "SĐT", "Lý do khóa", "Thời gian", "Loại", "Thao tác"].map(h => (
                    <span key={h} style={{ color: "#6a5a40", fontSize: 10, fontWeight: 600 }}>{h}</span>
                  ))}
                </div>
                {shown.map((e, idx) => (
                  <div key={e.id} className="dispute-row" onClick={() => setSelected(e)} style={{ display: "grid", gridTemplateColumns: "1.8fr 120px 1.8fr 120px 110px 80px", padding: "13px 20px", borderBottom: idx < shown.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", alignItems: "center", cursor: "pointer", transition: "background 0.15s" }}>
                    <span style={{ color: "#f0eaff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.userName}</span>
                    <span style={{ color: "#6a5a40", fontSize: 10 }}>{e.userPhone}</span>
                    <span style={{ color: "#b0956a", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.reason}>{e.reason}</span>
                    <span style={{ color: "#6a5a40", fontSize: 9 }}>{e.createdAt}</span>
                    <span style={{ padding: "3px 10px", borderRadius: 7, background: e.autoTriggered ? "rgba(255,179,71,0.1)" : "rgba(74,143,245,0.1)", color: e.autoTriggered ? "#FFB347" : "#4a8ff5", fontSize: 9, fontWeight: 700, width: "fit-content" }}>
                      {e.autoTriggered ? "🤖 Tự động" : "👤 Thủ công"}
                    </span>
                    <span onClick={ev => { ev.stopPropagation(); unlockUser(e) }} style={{ padding: "4px 10px", borderRadius: 7, background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)", color: "#3ecf6e", fontSize: 9, fontWeight: 700, cursor: "pointer", width: "fit-content" }}>
                      🔓 Mở khóa
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        {/* Detail drawer */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, backdropFilter: "blur(4px)" }} />
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 24, stiffness: 300 }} style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 380, background: "#0d0b12", borderLeft: "1px solid rgba(255,107,0,0.15)", zIndex: 101, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ color: "#ff4040", fontSize: 14, fontWeight: 800, marginBottom: 4 }}>🚫 {selected.userName}</div>
                    <div style={{ color: "#6a5a40", fontSize: 10 }}>{selected.userPhone} · {selected.createdAt}</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                  <div style={{ padding: "12px", background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)", borderRadius: 10, marginBottom: 14 }}>
                    <div style={{ color: "#ff4040", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      {selected.autoTriggered ? "🤖 Khóa tự động" : "👤 Khóa thủ công"}
                    </div>
                    <div style={{ color: "#b0956a", fontSize: 11 }}>{selected.reason}</div>
                  </div>
                  {[
                    ["Người dùng",   selected.userName],
                    ["Số điện thoại",selected.userPhone],
                    ["Thời gian khóa",selected.createdAt],
                    ["Loại",         selected.autoTriggered ? "Tự động (hệ thống)" : "Thủ công (admin)"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ color: "#6a5a40", fontSize: 11 }}>{k}</span>
                      <span style={{ color: "#f0eaff", fontSize: 11, fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
                  <button onClick={() => { unlockUser(selected) }} style={{ flex: 1, height: 44, borderRadius: 12, background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.25)", color: "#3ecf6e", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>
                    🔓 Mở khóa tài khoản
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </AdminShell>
    </>
  )
}
