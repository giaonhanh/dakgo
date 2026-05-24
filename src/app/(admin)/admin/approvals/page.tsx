"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

// ── Types ──────────────────────────────────────────────────────

type DriverStatus = "pending" | "approved"
type ShopStatus   = "pending" | "approved" | "suspended"

interface Driver {
  id: string; name: string; phone: string
  vehicle: string; plate: string; joinedDate: string
  status: DriverStatus; rating: number | null; trips: number
  idCardNumber: string | null; licenseNumber: string | null
  commissionRate: number
}

interface Shop {
  id: string; shopName: string; ownerName: string; phone: string
  address: string; category: string; status: ShopStatus
  registeredDate: string; commissionRate: number
  rating: number | null; totalOrders: number; isOpen: boolean
}

const DRIVER_STATUS: Record<DriverStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: "Chờ duyệt",    color: "#FFB347", bg: "rgba(255,179,71,0.12)"  },
  approved: { label: "Đã duyệt",     color: "#3ecf6e", bg: "rgba(62,207,110,0.10)"  },
}

const SHOP_STATUS: Record<ShopStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: "Chờ duyệt",      color: "#FFB347", bg: "rgba(255,179,71,0.12)"  },
  approved:  { label: "Đang hoạt động", color: "#3ecf6e", bg: "rgba(62,207,110,0.10)"  },
  suspended: { label: "Tạm khóa",       color: "#ff4040", bg: "rgba(255,64,64,0.10)"   },
}

// ── Main ───────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [tab, setTab]   = useState<"drivers" | "shops">("drivers")
  const [toast, setToast] = useState("")

  // Driver state
  const [drivers, setDrivers]         = useState<Driver[]>([])
  const [driverFilter, setDriverFilter] = useState<"all" | DriverStatus>("pending")
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [driverLoading, setDriverLoading]   = useState(true)

  // Shop state
  const [shops, setShops]             = useState<Shop[]>([])
  const [shopFilter, setShopFilter]   = useState<"all" | ShopStatus>("pending")
  const [selectedShop, setSelectedShop]   = useState<Shop | null>(null)
  const [shopLoading, setShopLoading]     = useState(true)

  const [saving, setSaving] = useState(false)
  const [rejectModal, setRejectModal] = useState<{ id: string; type: "driver" | "shop"; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500) }

  // ── Load drivers ──
  useEffect(() => {
    async function loadDrivers() {
      setDriverLoading(true)
      const supabase = createClient()
      const { data: rows } = await supabase
        .from("drivers")
        .select("id, vehicle_type, vehicle_model, license_plate, id_card_number, license_number, is_approved, rating_avg, total_trips, commission_rate, created_at, profiles(full_name, phone)")
        .order("created_at", { ascending: false })

      if (!rows) { setDriverLoading(false); return }

      setDrivers(rows.map(r => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles as { full_name: string | null; phone: string } | null
        return {
          id:            r.id,
          name:          p?.full_name ?? "—",
          phone:         p?.phone ?? "—",
          vehicle:       `${r.vehicle_type}${r.vehicle_model ? " · " + r.vehicle_model : ""}`,
          plate:         r.license_plate,
          joinedDate:    new Date(r.created_at).toLocaleDateString("vi-VN"),
          status:         r.is_approved ? "approved" : "pending",
          rating:         r.rating_avg,
          trips:          r.total_trips,
          idCardNumber:   r.id_card_number,
          licenseNumber:  r.license_number,
          commissionRate: r.commission_rate ?? 20,
        }
      }))
      setDriverLoading(false)
    }
    loadDrivers()
  }, [])

  // ── Load shops ──
  useEffect(() => {
    async function loadShops() {
      setShopLoading(true)
      const supabase = createClient()
      const { data: rows } = await supabase
        .from("shops")
        .select("id, name, address, category, status, commission_rate, rating_avg, is_open, created_at, owner:profiles(full_name, phone), orders(count)")
        .order("created_at", { ascending: false })

      if (!rows) { setShopLoading(false); return }

      setShops(rows.map(r => {
        const o = Array.isArray(r.owner) ? r.owner[0] : r.owner as { full_name: string | null; phone: string } | null
        return {
          id:             r.id,
          shopName:       r.name,
          ownerName:      o?.full_name ?? "—",
          phone:          o?.phone ?? "—",
          address:        r.address,
          category:       r.category,
          status:         r.status as ShopStatus,
          registeredDate: new Date(r.created_at).toLocaleDateString("vi-VN"),
          commissionRate: r.commission_rate,
          rating:         r.rating_avg,
          totalOrders:    Array.isArray(r.orders) ? r.orders.length : 0,
          isOpen:         r.is_open,
        }
      }))
      setShopLoading(false)
    }
    loadShops()
  }, [])

  // ── Actions: Driver ──
  async function approveDriver(id: string, approve: boolean, reason?: string, commissionRate?: number) {
    setSaving(true)
    const supabase = createClient()
    const updatePayload: Record<string, unknown> = {
      is_approved: approve,
      status: "offline",
      ...(approve ? { approved_at: new Date().toISOString() } : {}),
    }
    if (approve && commissionRate !== undefined) updatePayload.commission_rate = commissionRate
    await supabase.from("drivers").update(updatePayload).eq("id", id)

    if (!approve && reason) {
      await supabase.from("notifications").insert({
        user_id: id,
        type: "system",
        title: "❌ Đơn đăng ký tài xế bị từ chối",
        body: reason,
      })
    }
    if (approve) {
      await supabase.from("notifications").insert({
        user_id: id,
        type: "system",
        title: "✅ Đơn đăng ký tài xế được duyệt",
        body: "Chúc mừng! Tài khoản tài xế của bạn đã được phê duyệt. Bạn có thể bắt đầu nhận đơn ngay.",
      })
    }

    setDrivers(prev => prev.map(d => d.id === id ? { ...d, status: approve ? "approved" : "pending" } : d))
    setSelectedDriver(prev => prev?.id === id ? { ...prev, status: approve ? "approved" : "pending" } : prev)
    fireToast(approve ? "✅ Đã duyệt tài xế" : "❌ Đã từ chối tài xế")
    setSaving(false)
  }

  // ── Actions: Shop ──
  async function updateShopStatus(id: string, status: ShopStatus, reason?: string, commissionRate?: number) {
    setSaving(true)
    const supabase = createClient()
    const updatePayload: Record<string, unknown> = { status }
    if (commissionRate !== undefined) {
      updatePayload.commission_rate = commissionRate
      updatePayload.is_negotiated_commission = true
    }
    await supabase.from("shops").update(updatePayload).eq("id", id)

    const shop = shops.find(s => s.id === id)
    const effectiveRate = commissionRate ?? shop?.commissionRate ?? 15
    if (shop) {
      const ownerId = (await supabase.from("shops").select("owner_id").eq("id", id).single()).data?.owner_id
      if (ownerId) {
        if (status === "approved") {
          await supabase.from("notifications").insert({
            user_id: ownerId, type: "system",
            title: "✅ Cửa hàng được duyệt",
            body: `Cửa hàng "${shop.shopName}" đã được phê duyệt với phí hoa hồng ${effectiveRate}%. Bạn có thể bắt đầu nhận đơn ngay.`,
          })
        } else if (status === "suspended" && reason) {
          await supabase.from("notifications").insert({
            user_id: ownerId, type: "system",
            title: "❌ Cửa hàng bị từ chối / tạm khóa",
            body: reason,
          })
        }
      }
    }

    setShops(prev => prev.map(s => s.id === id ? { ...s, status, ...(commissionRate !== undefined ? { commissionRate } : {}) } : s))
    setSelectedShop(prev => prev?.id === id ? { ...prev, status, ...(commissionRate !== undefined ? { commissionRate } : {}) } : prev)
    const msg = status === "approved" ? "✅ Đã duyệt cửa hàng" : status === "suspended" ? "🔒 Đã tạm khóa" : "⏳ Đã chuyển về chờ duyệt"
    fireToast(msg)
    setSaving(false)
  }

  // ── Filtered lists ──
  const filteredDrivers = driverFilter === "all" ? drivers : drivers.filter(d => d.status === driverFilter)
  const filteredShops   = shopFilter   === "all" ? shops   : shops.filter(s => s.status === shopFilter)

  const pendingDrivers = drivers.filter(d => d.status === "pending").length
  const pendingShops   = shops.filter(s => s.status === "pending").length

  return (
    <AdminShell
      pageTitle="✅ Phê duyệt"
      pageSubtitle="Duyệt tài xế và cửa hàng đăng ký mới"
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          {pendingDrivers > 0 && (
            <div style={{ background: "rgba(255,179,71,0.12)", border: "1px solid rgba(255,179,71,0.3)", borderRadius: 8, padding: "4px 10px", color: "#FFB347", fontSize: 11, fontWeight: 700 }}>
              🏍️ {pendingDrivers} tài xế chờ
            </div>
          )}
          {pendingShops > 0 && (
            <div style={{ background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.3)", borderRadius: 8, padding: "4px 10px", color: "#FF8C00", fontSize: 11, fontWeight: 700 }}>
              🏪 {pendingShops} cửa hàng chờ
            </div>
          )}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Tabs */}
        <div style={{ padding: "12px 24px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 4, flexShrink: 0 }}>
          {([
            { key: "drivers", label: "🏍️ Tài xế",    badge: pendingDrivers },
            { key: "shops",   label: "🏪 Cửa hàng",   badge: pendingShops  },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              height: 36, padding: "0 16px", borderRadius: "10px 10px 0 0", border: "none", cursor: "pointer",
              background: tab === t.key ? "rgba(255,107,0,0.12)" : "transparent",
              borderBottom: tab === t.key ? "2px solid #FF6B00" : "2px solid transparent",
              color: tab === t.key ? "#FF8C00" : "#6a5a40",
              fontSize: 12, fontWeight: tab === t.key ? 700 : 400,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {t.label}
              {t.badge > 0 && (
                <span style={{ background: "#FF6B00", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 9, fontWeight: 800 }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {tab === "drivers" ? (
            <DriversTab
              drivers={filteredDrivers} filter={driverFilter} loading={driverLoading}
              selected={selectedDriver} saving={saving}
              onFilterChange={setDriverFilter}
              onSelect={setSelectedDriver}
              onApprove={(id, commissionRate) => approveDriver(id, true, undefined, commissionRate)}
              onReject={(id, name) => { setRejectModal({ id, type: "driver", name }); setRejectReason("") }}
            />
          ) : (
            <ShopsTab
              shops={filteredShops} filter={shopFilter} loading={shopLoading}
              selected={selectedShop} saving={saving}
              onFilterChange={setShopFilter}
              onSelect={setSelectedShop}
              onUpdateStatus={updateShopStatus}
              onReject={(id, name) => { setRejectModal({ id, type: "shop", name }); setRejectReason("") }}
            />
          )}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 999, whiteSpace: "nowrap", background: "rgba(14,12,9,0.95)", border: "1px solid rgba(255,107,0,0.3)", borderRadius: 12, padding: "10px 20px", color: "#f8f0e0", fontSize: 12, fontWeight: 600, backdropFilter: "blur(12px)" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rejection reason modal */}
      <AnimatePresence>
        {rejectModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setRejectModal(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, backdropFilter: "blur(6px)" }} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 22, stiffness: 350 }}
              style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 380, background: "#0d0b12", borderRadius: 18, padding: "22px 20px", zIndex: 201, border: "1px solid rgba(255,64,64,0.25)" }}>
              <div style={{ fontSize: 36, textAlign: "center", marginBottom: 8 }}>❌</div>
              <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 4 }}>
                Từ chối {rejectModal.type === "driver" ? "tài xế" : "cửa hàng"}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", marginBottom: 14,
                background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)",
                borderRadius: 7, padding: "5px 10px", color: "#ff4040" }}>
                {rejectModal.name}
              </div>
              <div style={{ color: "#6a5a40", fontSize: 9.5, marginBottom: 6 }}>Lý do từ chối (bắt buộc)</div>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="VD: Hồ sơ chưa đầy đủ, biển số xe không khớp với đăng ký..."
                style={{ width: "100%", minHeight: 80, background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,64,64,0.2)", borderRadius: 11,
                  color: "#f8f0e0", fontSize: 10, padding: "8px 12px",
                  resize: "none", fontFamily: "Lexend", marginBottom: 14 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setRejectModal(null)}
                  style={{ flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                    color: "#6a5a40", fontSize: 11, fontWeight: 600 }}>Hủy</button>
                <button
                  disabled={!rejectReason.trim() || saving}
                  onClick={async () => {
                    if (rejectModal.type === "driver") {
                      await approveDriver(rejectModal.id, false, rejectReason.trim())
                    } else {
                      await updateShopStatus(rejectModal.id, "suspended", rejectReason.trim())
                    }
                    setRejectModal(null); setRejectReason("")
                  }}
                  style={{ flex: 2, height: 40, borderRadius: 10, border: "none", cursor: rejectReason.trim() ? "pointer" : "not-allowed",
                    fontFamily: "Lexend", background: rejectReason.trim() ? "rgba(255,64,64,0.18)" : "rgba(255,255,255,0.04)",
                    outline: rejectReason.trim() ? "1px solid rgba(255,64,64,0.4)" : "none",
                    color: rejectReason.trim() ? "#ff4040" : "#6a5a40", fontSize: 12, fontWeight: 800, opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Đang xử lý..." : "❌ Xác nhận từ chối"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminShell>
  )
}

// ── Drivers Tab ────────────────────────────────────────────────

function DriversTab({ drivers, filter, loading, selected, saving, onFilterChange, onSelect, onApprove, onReject }: {
  drivers: Driver[]; filter: string; loading: boolean
  selected: Driver | null; saving: boolean
  onFilterChange: (f: "all" | DriverStatus) => void
  onSelect: (d: Driver | null) => void
  onApprove: (id: string, commissionRate?: number) => void
  onReject: (id: string, name: string) => void
}) {
  const [pendingCommission, setPendingCommission] = useState(20)

  useEffect(() => {
    if (selected) setPendingCommission(selected.commissionRate)
  }, [selected?.id])

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {/* Filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {(["pending", "approved", "all"] as const).map(f => (
            <button key={f} onClick={() => onFilterChange(f)} style={{
              height: 28, padding: "0 12px", borderRadius: 8, border: "none", cursor: "pointer",
              background: filter === f ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)",
              color: filter === f ? "#FF8C00" : "#6a5a40", fontSize: 10, fontWeight: filter === f ? 700 : 400,
            }}>
              {f === "pending" ? "⏳ Chờ duyệt" : f === "approved" ? "✅ Đã duyệt" : "Tất cả"}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: "#6a5a40", fontSize: 12, textAlign: "center", paddingTop: 40 }}>Đang tải...</div>
        ) : drivers.length === 0 ? (
          <div style={{ color: "#6a5a40", fontSize: 12, textAlign: "center", paddingTop: 40 }}>Không có tài xế nào</div>
        ) : drivers.map(d => {
          const cfg = DRIVER_STATUS[d.status]
          const isActive = selected?.id === d.id
          return (
            <div key={d.id} onClick={() => onSelect(isActive ? null : d)} style={{
              padding: "12px 14px", borderRadius: 12, marginBottom: 8, cursor: "pointer",
              background: isActive ? "rgba(255,107,0,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isActive ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.06)"}`,
              transition: "all .15s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{d.name}</div>
                  <div style={{ color: "#6a5a40", fontSize: 10 }}>{d.phone} · {d.vehicle} · {d.plate}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 6, padding: "2px 8px", fontSize: 9, fontWeight: 700 }}>{cfg.label}</span>
                  {d.status === "pending" && (
                    <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => onApprove(d.id)} disabled={saving} style={{ height: 26, padding: "0 10px", borderRadius: 7, border: "none", background: "rgba(62,207,110,0.15)", color: "#3ecf6e", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Duyệt</button>
                      <button onClick={() => onReject(d.id, d.name)} disabled={saving} style={{ height: 26, padding: "0 10px", borderRadius: 7, border: "none", background: "rgba(255,64,64,0.12)", color: "#ff4040", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Từ chối</button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 5 }}>Đăng ký: {d.joinedDate} · {d.trips} chuyến · {d.rating ? `⭐ ${d.rating}` : "Chưa có đánh giá"}</div>
            </div>
          )
        })}
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            style={{ flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", background: "rgba(14,12,9,0.6)" }}>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Chi tiết tài xế</div>
                <button onClick={() => onSelect(null)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.06)", color: "#6a5a40", cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
              {[
                { label: "Họ tên",    val: selected.name       },
                { label: "SĐT",       val: selected.phone      },
                { label: "Xe",        val: selected.vehicle    },
                { label: "Biển số",   val: selected.plate      },
                { label: "CMND",      val: selected.idCardNumber ?? "—" },
                { label: "Bằng lái",  val: selected.licenseNumber ?? "—" },
                { label: "Ngày ĐK",   val: selected.joinedDate },
                { label: "Chuyến",    val: selected.trips.toString() },
                { label: "Rating",    val: selected.rating ? `⭐ ${selected.rating}` : "—" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ color: "#6a5a40", fontSize: 10 }}>{row.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{row.val}</span>
                </div>
              ))}
              {selected.status === "pending" && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(180,100,255,0.06)", border: "1px solid rgba(180,100,255,0.2)", borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ color: "rgba(180,100,255,0.8)", fontSize: 9, marginBottom: 6, fontWeight: 700 }}>💜 Phí hoa hồng khi duyệt (%)</div>
                  <input type="number" min={0} max={50} value={pendingCommission}
                    onChange={e => setPendingCommission(parseInt(e.target.value) || 0)}
                    style={{ width: "100%", height: 36, borderRadius: 8, background: "rgba(180,100,255,0.1)", border: "1px solid rgba(180,100,255,0.35)", color: "#b464ff", fontSize: 16, fontWeight: 800, textAlign: "center", padding: "0 8px", fontFamily: "Lexend" }} />
                  <div style={{ color: "rgba(180,100,255,0.4)", fontSize: 8, marginTop: 4 }}>Mặc định: {selected.commissionRate}%</div>
                </div>
              )}
              {selected.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={() => onApprove(selected.id, pendingCommission)} disabled={saving}
                    style={{ flex: 1, height: 36, borderRadius: 10, border: "none", background: "linear-gradient(90deg,#3ecf6e,#2db85a)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ✅ Duyệt ({pendingCommission}%)
                  </button>
                  <button onClick={() => onReject(selected.id, selected.name)} disabled={saving} style={{ flex: 1, height: 36, borderRadius: 10, border: "none", background: "rgba(255,64,64,0.15)", color: "#ff4040", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>❌ Từ chối</button>
                </div>
              )}
              {selected.status === "approved" && (
                <div style={{ marginTop: 16, padding: "8px 12px", borderRadius: 10, background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)", color: "#3ecf6e", fontSize: 11, textAlign: "center" }}>
                  ✅ Đã được duyệt hoạt động
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Shops Tab ──────────────────────────────────────────────────

function ShopsTab({ shops, filter, loading, selected, saving, onFilterChange, onSelect, onUpdateStatus, onReject }: {
  shops: Shop[]; filter: string; loading: boolean
  selected: Shop | null; saving: boolean
  onFilterChange: (f: "all" | ShopStatus) => void
  onSelect: (s: Shop | null) => void
  onUpdateStatus: (id: string, status: ShopStatus, reason?: string, commissionRate?: number) => void
  onReject: (id: string, name: string) => void
}) {
  const [pendingCommission, setPendingCommission] = useState(15)

  useEffect(() => {
    if (selected) setPendingCommission(selected.commissionRate)
  }, [selected?.id])

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {/* Filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {(["pending", "approved", "suspended", "all"] as const).map(f => (
            <button key={f} onClick={() => onFilterChange(f)} style={{
              height: 28, padding: "0 12px", borderRadius: 8, border: "none", cursor: "pointer",
              background: filter === f ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)",
              color: filter === f ? "#FF8C00" : "#6a5a40", fontSize: 10, fontWeight: filter === f ? 700 : 400,
            }}>
              {f === "pending" ? "⏳ Chờ duyệt" : f === "approved" ? "✅ Hoạt động" : f === "suspended" ? "🔒 Tạm khóa" : "Tất cả"}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: "#6a5a40", fontSize: 12, textAlign: "center", paddingTop: 40 }}>Đang tải...</div>
        ) : shops.length === 0 ? (
          <div style={{ color: "#6a5a40", fontSize: 12, textAlign: "center", paddingTop: 40 }}>Không có cửa hàng nào</div>
        ) : shops.map(s => {
          const cfg = SHOP_STATUS[s.status]
          const isActive = selected?.id === s.id
          return (
            <div key={s.id} onClick={() => onSelect(isActive ? null : s)} style={{
              padding: "12px 14px", borderRadius: 12, marginBottom: 8, cursor: "pointer",
              background: isActive ? "rgba(255,107,0,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isActive ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.06)"}`,
              transition: "all .15s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{s.shopName}</div>
                  <div style={{ color: "#6a5a40", fontSize: 10 }}>{s.ownerName} · {s.phone}</div>
                  <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 2 }}>{s.category} · {s.address}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 6, padding: "2px 8px", fontSize: 9, fontWeight: 700 }}>{cfg.label}</span>
                  {s.status === "pending" && (
                    <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => onUpdateStatus(s.id, "approved")} disabled={saving} style={{ height: 26, padding: "0 10px", borderRadius: 7, border: "none", background: "rgba(62,207,110,0.15)", color: "#3ecf6e", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Duyệt</button>
                      <button onClick={() => onReject(s.id, s.shopName)} disabled={saving} style={{ height: 26, padding: "0 10px", borderRadius: 7, border: "none", background: "rgba(255,64,64,0.12)", color: "#ff4040", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Từ chối</button>
                    </div>
                  )}
                  {s.status === "approved" && (
                    <button onClick={e => { e.stopPropagation(); onUpdateStatus(s.id, "suspended") }} disabled={saving} style={{ height: 22, padding: "0 8px", borderRadius: 6, border: "none", background: "rgba(255,64,64,0.1)", color: "#ff4040", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Khóa</button>
                  )}
                  {s.status === "suspended" && (
                    <button onClick={e => { e.stopPropagation(); onUpdateStatus(s.id, "approved") }} disabled={saving} style={{ height: 22, padding: "0 8px", borderRadius: 6, border: "none", background: "rgba(62,207,110,0.12)", color: "#3ecf6e", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Mở khóa</button>
                  )}
                </div>
              </div>
              <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 5 }}>
                Đăng ký: {s.registeredDate} · HH {s.commissionRate}% · {s.totalOrders} đơn{s.rating ? ` · ⭐ ${s.rating}` : ""}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            style={{ flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", background: "rgba(14,12,9,0.6)" }}>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Chi tiết cửa hàng</div>
                <button onClick={() => onSelect(null)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.06)", color: "#6a5a40", cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
              {[
                { label: "Tên quán",    val: selected.shopName         },
                { label: "Chủ quán",    val: selected.ownerName        },
                { label: "SĐT",         val: selected.phone            },
                { label: "Loại",        val: selected.category         },
                { label: "Địa chỉ",     val: selected.address          },
                { label: "Hoa hồng",    val: `${selected.commissionRate}%` },
                { label: "Tổng đơn",    val: selected.totalOrders.toString() },
                { label: "Rating",      val: selected.rating ? `⭐ ${selected.rating}` : "—" },
                { label: "Ngày ĐK",     val: selected.registeredDate   },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ color: "#6a5a40", fontSize: 10 }}>{row.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, maxWidth: 160, textAlign: "right" }}>{row.val}</span>
                </div>
              ))}
              {selected.status === "pending" && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(180,100,255,0.06)", border: "1px solid rgba(180,100,255,0.2)", borderRadius: 10 }}>
                  <div style={{ color: "rgba(180,100,255,0.8)", fontSize: 9, marginBottom: 6, fontWeight: 700 }}>💜 Phí hoa hồng khi duyệt (%)</div>
                  <input type="number" min={0} max={50} value={pendingCommission}
                    onChange={e => setPendingCommission(parseInt(e.target.value) || 0)}
                    style={{ width: "100%", height: 36, borderRadius: 8, background: "rgba(180,100,255,0.1)", border: "1px solid rgba(180,100,255,0.35)", color: "#b464ff", fontSize: 16, fontWeight: 800, textAlign: "center", padding: "0 8px", fontFamily: "Lexend" }} />
                  <div style={{ color: "rgba(180,100,255,0.4)", fontSize: 8, marginTop: 4 }}>Mặc định hệ thống: {selected.commissionRate}%</div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {selected.status !== "approved" && (
                  <button
                    onClick={() => onUpdateStatus(selected.id, "approved", undefined, selected.status === "pending" ? pendingCommission : undefined)}
                    disabled={saving}
                    style={{ flex: 1, height: 36, borderRadius: 10, border: "none", background: "linear-gradient(90deg,#3ecf6e,#2db85a)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ✅ Duyệt {selected.status === "pending" ? `(${pendingCommission}%)` : ""}
                  </button>
                )}
                {selected.status !== "suspended" && (
                  <button onClick={() => onReject(selected.id, selected.shopName)} disabled={saving} style={{ flex: 1, height: 36, borderRadius: 10, border: "none", background: "rgba(255,64,64,0.15)", color: "#ff4040", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🔒 {selected.status === "pending" ? "Từ chối" : "Khóa"}</button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
