"use client"

import React, { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import AddressPicker from "@/components/map/AddressPicker"
import { createClient } from "@/lib/supabase/client"
import type { AddressPickerResult } from "@/types"

// --- Types ---
interface Address {
  id:          string
  label:       string
  customLabel: string
  address:     string
  lat:         number
  lng:         number
  isDefault:   boolean
}

type LabelType = "Nhà" | "Công ty" | "Khác"

const LABEL_CFG: Record<LabelType, { icon: string; color: string; bg: string; bd: string }> = {
  "Nhà":     { icon: "🏠", color: "#FF8C00", bg: "rgba(255,107,0,0.10)",  bd: "rgba(255,107,0,0.30)"   },
  "Công ty": { icon: "🏢", color: "#4a8ff5", bg: "rgba(74,143,245,0.10)", bd: "rgba(74,143,245,0.30)"  },
  "Khác":    { icon: "📍", color: "#b464ff", bg: "rgba(180,100,255,0.10)",bd: "rgba(180,100,255,0.30)" },
}

const LABEL_TYPES: LabelType[] = ["Nhà", "Công ty", "Khác"]

interface VmSuggestion {
  refId:    string
  name:     string
  fullAddr: string   // toàn bộ địa chỉ: số nhà, đường, Kp, xã, huyện, tỉnh
}

const VM_KEY = process.env.NEXT_PUBLIC_VIETMAP_SERVICES_KEY ?? ""
const VM_CTX = "Phước An, Krông Pắc, Đắk Lắk"
const VM_LAT = 12.7107
const VM_LNG = 108.3034

// --- Sub-components ---
function LabelBadge({ label }: { label: string }) {
  const cfg = LABEL_CFG[label as LabelType] ?? LABEL_CFG["Khác"]
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      background: cfg.bg, border: `1px solid ${cfg.bd}`,
      borderRadius: 7, padding: "2px 8px", flexShrink: 0,
    }}>
      <span style={{ fontSize: 11 }}>{cfg.icon}</span>
      <span style={{ color: cfg.color, fontSize: 9, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

function FormInput({ label, value, onChange, placeholder, icon, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; icon?: string; type?: string
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
            color: "#f8f0e0", fontSize: 12, fontFamily: "'Lexend', sans-serif",
          }}
        />
      </div>
    </div>
  )
}

// --- Main ---
export default function AddressesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [addresses,    setAddresses]    = useState<Address[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [userId,       setUserId]       = useState<string | null>(null)
  const [showForm,     setShowForm]     = useState(false)
  const [editId,       setEditId]       = useState<string | null>(null)
  const [showDelete,   setShowDelete]   = useState<string | null>(null)
  const [toast,        setToast]        = useState("")
  const [showFullMap,  setShowFullMap]  = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data } = await supabase
        .from("saved_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
      if (data) {
        setAddresses(data.map(r => ({
          id: r.id, label: r.label, customLabel: "",
          address: r.address, lat: r.lat, lng: r.lng, isDefault: r.is_default,
        })))
      }
      setLoading(false)
    }
    load()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Form fields
  const [formLabel,    setFormLabel]    = useState<LabelType>("Nhà")
  const [formCustom,   setFormCustom]   = useState("")
  const [formAddress,  setFormAddress]  = useState("")
  const [formLat,      setFormLat]      = useState(12.683)
  const [formLng,      setFormLng]      = useState(108.483)
  const [formDefault,  setFormDefault]  = useState(false)

  // Search
  const [searchQuery,   setSearchQuery]   = useState("")
  const [searchResults, setSearchResults] = useState<VmSuggestion[]>([])
  const [searching,     setSearching]     = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fireToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 2400)
  }

  const resetForm = () => {
    setFormLabel("Nhà"); setFormCustom(""); setFormAddress("")
    setFormLat(12.683); setFormLng(108.483); setFormDefault(false)
    setSearchQuery(""); setSearchResults([]); setEditId(null)
  }

  const openAdd = () => { resetForm(); setShowForm(true) }

  const openEdit = (addr: Address) => {
    setEditId(addr.id)
    setFormLabel(addr.label as LabelType)
    setFormCustom(addr.customLabel)
    setFormAddress(addr.address)
    setFormLat(addr.lat)
    setFormLng(addr.lng)
    setFormDefault(addr.isDefault)
    setShowForm(true)
  }

  const handleSearch = (q: string) => {
    setSearchQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.length < 3) { setSearchResults([]); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const query = q.toLowerCase().includes("krông pắc") || q.toLowerCase().includes("đắk lắk")
          ? q : `${q} ${VM_CTX}`
        const params = new URLSearchParams({
          apikey: VM_KEY, text: query,
          "focus.point.lat": VM_LAT.toString(),
          "focus.point.lon": VM_LNG.toString(),
        })
        const res  = await fetch(`https://maps.vietmap.vn/api/autocomplete/v3?${params}`)
        const data = await res.json() as Array<{ ref_id: string; display: string; name?: string }>
        const suggestions: VmSuggestion[] = data.slice(0, 6).map(item => {
          const parts = item.display.split(", ")
          return {
            refId:    item.ref_id,
            name:     item.name || parts[0] || item.display,
            fullAddr: parts.join(", "),
          }
        })
        setSearchResults(suggestions)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 500)
  }

  const selectResult = async (s: VmSuggestion) => {
    setSearchResults([])
    setSearchQuery(s.fullAddr)
    setFormAddress(s.fullAddr)
    // Lấy toạ độ chính xác từ VietMap place detail
    try {
      const res  = await fetch(`https://maps.vietmap.vn/api/place/v3?apikey=${VM_KEY}&refid=${s.refId}`)
      const data = await res.json() as { lat?: number; lng?: number; display?: string }
      if (data.lat && data.lng) {
        setFormLat(data.lat)
        setFormLng(data.lng)
      }
      if (data.display) {
        setFormAddress(data.display)
        setSearchQuery(data.display)
      }
    } catch { /* giữ nguyên địa chỉ text nếu lỗi */ }
  }

  const saveAddress = async () => {
    if (!formAddress.trim()) { fireToast("Vui lòng nhập địa chỉ"); return }
    if (!userId) return
    const label = formLabel === "Khác" && formCustom.trim() ? formCustom.trim() : formLabel
    setSaving(true)
    try {
      if (formDefault) {
        await supabase.from("saved_addresses")
          .update({ is_default: false })
          .eq("user_id", userId)
      }
      if (editId) {
        const { error } = await supabase.from("saved_addresses").update({
          label, address: formAddress, lat: formLat, lng: formLng, is_default: formDefault,
        }).eq("id", editId)
        if (error) throw error
        setAddresses(prev => prev.map(a => {
          if (formDefault && a.id !== editId) return { ...a, isDefault: false }
          if (a.id === editId) return { ...a, label, customLabel: formCustom, address: formAddress, lat: formLat, lng: formLng, isDefault: formDefault }
          return a
        }))
        fireToast("Đã cập nhật địa chỉ")
      } else {
        const { data, error } = await supabase.from("saved_addresses").insert({
          user_id: userId, label, address: formAddress,
          lat: formLat, lng: formLng, is_default: formDefault,
        }).select().single()
        if (error) throw error
        const newAddr: Address = {
          id: data.id, label, customLabel: formCustom,
          address: formAddress, lat: formLat, lng: formLng, isDefault: formDefault,
        }
        setAddresses(prev =>
          formDefault
            ? [...prev.map(a => ({ ...a, isDefault: false })), newAddr]
            : [...prev, newAddr]
        )
        fireToast("Đã thêm địa chỉ mới")
      }
    } catch {
      fireToast("Không thể lưu địa chỉ. Thử lại sau.")
    } finally {
      setSaving(false)
    }
    setShowForm(false)
    resetForm()
  }

  const setDefault = async (id: string) => {
    if (!userId) return
    try {
      await supabase.from("saved_addresses").update({ is_default: false }).eq("user_id", userId)
      await supabase.from("saved_addresses").update({ is_default: true }).eq("id", id)
      setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })))
      fireToast("Đã đặt làm địa chỉ mặc định")
    } catch {
      fireToast("Không thể cập nhật. Thử lại sau.")
    }
  }

  const deleteAddress = async (id: string) => {
    try {
      const { error } = await supabase.from("saved_addresses").delete().eq("id", id)
      if (error) throw error
      setAddresses(prev => prev.filter(a => a.id !== id))
      setShowDelete(null)
      fireToast("Đã xóa địa chỉ")
    } catch {
      fireToast("Không thể xóa địa chỉ. Thử lại sau.")
    }
  }

  const displayLabel = (a: Address) =>
    a.label === "Khác" && a.customLabel ? a.customLabel : a.label

  return (
    <>
      <style>{`
        * { -ms-overflow-style: none; scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
        @keyframes shimmer { 0% { left: -60%; } 100% { left: 120%; } }
        @keyframes spin    { to { transform: rotate(360deg); } }
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

      {/* Delete confirm sheet */}
      <AnimatePresence>
        {showDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDelete(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 180, backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 190,
                background: "#0e0c09", border: "1px solid rgba(255,64,64,0.2)",
                borderRadius: "20px 20px 0 0", padding: "20px 18px 36px",
              }}
            >
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 18px" }} />
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🗑️</div>
                <div style={{ color: "#ff6060", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                  Xóa địa chỉ này?
                </div>
                <div style={{ color: "#6a5a40", fontSize: 9.5 }}>
                  {addresses.find(a => a.id === showDelete)?.address}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowDelete(null)}
                  style={{
                    flex: 1, height: 44, borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                    color: "#b0956a", fontSize: 12, fontWeight: 600,
                    fontFamily: "'Lexend', sans-serif", cursor: "pointer",
                  }}
                >Hủy</button>
                <button
                  onClick={() => deleteAddress(showDelete!)}
                  style={{
                    flex: 1, height: 44, borderRadius: 12, border: "none",
                    background: "linear-gradient(90deg,#ff4040,#ff6060)",
                    color: "#fff", fontSize: 12, fontWeight: 700,
                    fontFamily: "'Lexend', sans-serif", cursor: "pointer",
                  }}
                >🗑️ Xóa địa chỉ</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Full-screen AddressPicker overlay */}
      <AnimatePresence>
        {showFullMap && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 220 }}
          >
            <AddressPicker
              height="100dvh"
              initialLat={formLat}
              initialLng={formLng}
              onClose={() => setShowFullMap(false)}
              onConfirm={(result: AddressPickerResult) => {
                setFormLat(result.lat)
                setFormLng(result.lng)
                setFormAddress(result.address)
                setSearchQuery(result.address)
                setSearchResults([])
                setShowFullMap(false)
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit form sheet */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowForm(false); resetForm() }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 180, backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 190,
                background: "#0e0c09", border: "1px solid rgba(255,107,0,0.18)",
                borderRadius: "22px 22px 0 0",
                maxHeight: "92vh", display: "flex", flexDirection: "column",
              }}
            >
              {/* Sheet header */}
              <div style={{ padding: "14px 18px 0", flexShrink: 0 }}>
                <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 14px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700 }}>
                    {editId ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới"}
                  </div>
                  <button
                    onClick={() => { setShowForm(false); resetForm() }}
                    style={{
                      width: 28, height: 28, borderRadius: 8, border: "none",
                      background: "rgba(255,255,255,0.07)", color: "#6a5a40",
                      fontSize: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >✕</button>
                </div>
              </div>

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 28px" } as React.CSSProperties}>

                {/* Label type */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: "rgba(176,149,106,0.6)", fontSize: 9.5, marginBottom: 7 }}>
                    Loại địa chỉ
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {LABEL_TYPES.map(l => {
                      const cfg = LABEL_CFG[l]
                      const on  = formLabel === l
                      return (
                        <button
                          key={l}
                          onClick={() => setFormLabel(l)}
                          style={{
                            flex: 1, height: 40, borderRadius: 11,
                            background: on ? cfg.bg : "rgba(255,255,255,0.04)",
                            border: on ? `1.5px solid ${cfg.bd}` : "1px solid rgba(255,255,255,0.08)",
                            cursor: "pointer", fontFamily: "'Lexend', sans-serif",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                            transition: "all .15s",
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                          <span style={{ color: on ? cfg.color : "#6a5a40", fontSize: 10, fontWeight: on ? 600 : 400 }}>
                            {l}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <AnimatePresence>
                    {formLabel === "Khác" && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: "hidden", marginTop: 8 }}
                      >
                        <FormInput
                          label="Tên gọi tùy chỉnh"
                          value={formCustom}
                          onChange={setFormCustom}
                          placeholder="VD: Nhà bà ngoại, Gym..."
                          icon="✏️"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Address search */}
                <div style={{ marginBottom: 12, position: "relative" }}>
                  <div style={{ color: "rgba(176,149,106,0.6)", fontSize: 9.5, marginBottom: 5 }}>Địa chỉ</div>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: 12, padding: "0 12px", height: 44,
                    }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>🔍</span>
                      <input
                        value={searchQuery}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Tìm địa chỉ..."
                        style={{
                          flex: 1, background: "transparent", border: "none",
                          outline: "none", color: "#f8f0e0", fontSize: 12,
                          fontFamily: "'Lexend', sans-serif",
                        }}
                      />
                      {searching && (
                        <div style={{
                          width: 14, height: 14, borderRadius: "50%",
                          border: "2px solid rgba(255,107,0,0.3)", borderTopColor: "#FF6B00",
                          animation: "spin 1s linear infinite", flexShrink: 0,
                        }} />
                      )}
                    </div>

                    <AnimatePresence>
                      {searchResults.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          style={{
                            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 10,
                            background: "#131110", border: "1px solid rgba(255,107,0,0.2)",
                            borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
                          }}
                        >
                          {searchResults.map((s, i) => (
                            <div
                              key={s.refId}
                              onClick={() => void selectResult(s)}
                              style={{
                                padding: "10px 12px", cursor: "pointer",
                                borderBottom: i < searchResults.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                                display: "flex", alignItems: "flex-start", gap: 8,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,107,0,0.06)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>📍</span>
                              <div>
                                <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 600, lineHeight: 1.4 }}>
                                  {s.name}
                                </div>
                                <div style={{ color: "#6a5a40", fontSize: 9.5, lineHeight: 1.5, marginTop: 2 }}>
                                  {s.fullAddr}
                                </div>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {formAddress && (
                    <div style={{
                      marginTop: 8, padding: "8px 11px",
                      background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.15)",
                      borderRadius: 9, display: "flex", alignItems: "center", gap: 7,
                    }}>
                      <span style={{ fontSize: 12, flexShrink: 0 }}>📍</span>
                      <span style={{ color: "#b0956a", fontSize: 9, lineHeight: 1.4 }}>{formAddress}</span>
                    </div>
                  )}
                </div>

                {/* Map picker button */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: "rgba(176,149,106,0.6)", fontSize: 9.5, marginBottom: 6 }}>
                    Chọn trên bản đồ
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowFullMap(true)}
                    style={{
                      width: "100%", height: 54, borderRadius: 12, cursor: "pointer",
                      background: "linear-gradient(135deg,rgba(255,215,0,0.06),rgba(255,107,0,0.06))",
                      border: "1px dashed rgba(255,215,0,0.3)", fontFamily: "'Lexend', sans-serif",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>🗺️</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 700 }}>Mở bản đồ đầy đủ</div>
                      <div style={{ color: "#6a5a40", fontSize: 8.5 }}>
                        {formLat !== 12.683
                          ? `${formLat.toFixed(4)}, ${formLng.toFixed(4)}`
                          : "Kéo ghim vàng để chọn vị trí chính xác"}
                      </div>
                    </div>
                    <span style={{ color: "rgba(255,215,0,0.5)", fontSize: 13, marginLeft: "auto" }}>→</span>
                  </motion.button>
                </div>

                {/* Coordinates */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[
                    { label: "Vĩ độ (Lat)", val: formLat.toFixed(5) },
                    { label: "Kinh độ (Lng)", val: formLng.toFixed(5) },
                  ].map((c, i) => (
                    <div key={i} style={{
                      flex: 1, background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 9, padding: "6px 10px",
                    }}>
                      <div style={{ color: "#6a5a40", fontSize: 8 }}>{c.label}</div>
                      <div style={{ color: "#b0956a", fontSize: 10, fontWeight: 600, fontFamily: "monospace", marginTop: 1 }}>
                        {c.val}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Set as default toggle */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 11, marginBottom: 16,
                }}>
                  <div>
                    <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 500 }}>Đặt làm địa chỉ mặc định</div>
                    <div style={{ color: "#6a5a40", fontSize: 8.5, marginTop: 1 }}>Tự động điền khi đặt hàng</div>
                  </div>
                  <div
                    onClick={() => setFormDefault(!formDefault)}
                    style={{
                      width: 40, height: 22, borderRadius: 11, cursor: "pointer",
                      background: formDefault ? "linear-gradient(90deg,#FF6B00,#FF8C00)" : "rgba(255,255,255,0.1)",
                      border: `1px solid ${formDefault ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.12)"}`,
                      position: "relative", transition: "all .25s", flexShrink: 0,
                      boxShadow: formDefault ? "0 0 8px rgba(255,107,0,0.3)" : "none",
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 2,
                      left: formDefault ? 20 : 2, width: 16, height: 16, borderRadius: "50%",
                      background: "#fff", transition: "left .25s",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    }} />
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={saveAddress}
                  disabled={saving}
                  style={{
                    width: "100%", height: 48, borderRadius: 13, border: "none",
                    background: "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    fontFamily: "'Lexend', sans-serif", cursor: saving ? "not-allowed" : "pointer",
                    position: "relative", overflow: "hidden",
                    boxShadow: "0 4px 18px rgba(255,107,0,0.4)",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {!saving && <div style={{
                    position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                    background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)",
                    animation: "shimmer 2.5s infinite",
                  }} />}
                  <span style={{ position: "relative", zIndex: 1 }}>
                    {saving ? "Đang lưu..." : editId ? "✓ Lưu thay đổi" : "＋ Thêm địa chỉ"}
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Root */}
      <div style={{
        position: "fixed", inset: 0, background: "#080806",
        display: "flex", flexDirection: "column", fontFamily: "'Lexend', sans-serif",
        zIndex: 60,
      }}>

        {/* Header */}
        <div style={{
          background: "rgba(8,8,6,0.96)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => router.back()}
              style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, cursor: "pointer", color: "#f8f0e0",
              }}
            >←</button>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 700 }}>Địa chỉ lưu</div>
              <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 1 }}>
                {addresses.length} địa chỉ đã lưu
              </div>
            </div>
            <button
              onClick={openAdd}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "7px 13px", borderRadius: 10, border: "none",
                background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
                color: "#fff", fontSize: 10, fontWeight: 700,
                fontFamily: "'Lexend', sans-serif", cursor: "pointer",
                position: "relative", overflow: "hidden",
                boxShadow: "0 2px 10px rgba(255,107,0,0.35)",
              }}
            >
              <div style={{
                position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                animation: "shimmer 2.5s infinite",
              }} />
              <span style={{ position: "relative", zIndex: 1, fontSize: 13 }}>+</span>
              <span style={{ position: "relative", zIndex: 1 }}>Thêm mới</span>
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 88px" } as React.CSSProperties}>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2].map(i => (
                <div key={i} style={{
                  height: 120, borderRadius: 16,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                  animation: "pulse 1.5s infinite",
                }} />
              ))}
            </div>
          )}

          {!loading && addresses.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: 280, gap: 12,
              }}
            >
              <span style={{ fontSize: 48 }}>🗺️</span>
              <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 600 }}>Chưa có địa chỉ lưu</div>
              <div style={{ color: "#6a5a40", fontSize: 10, textAlign: "center", lineHeight: 1.6 }}>
                Thêm địa chỉ để đặt hàng nhanh hơn<br />mà không cần nhập lại mỗi lần
              </div>
              <button
                onClick={openAdd}
                style={{
                  marginTop: 4, padding: "10px 24px", borderRadius: 11, border: "none",
                  background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
                  color: "#fff", fontSize: 11, fontWeight: 700,
                  fontFamily: "'Lexend', sans-serif", cursor: "pointer",
                  boxShadow: "0 3px 12px rgba(255,107,0,0.35)",
                }}
              >＋ Thêm địa chỉ đầu tiên</button>
            </motion.div>
          )}

          {!loading && <AnimatePresence>
            {addresses.map((addr, idx) => (
              <motion.div
                key={addr.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.05 }}
                style={{ marginBottom: 10 }}
              >
                <div style={{
                  background: addr.isDefault ? "rgba(255,107,0,0.06)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${addr.isDefault ? "rgba(255,107,0,0.25)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 16, padding: "13px 14px",
                }}>
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <LabelBadge label={displayLabel(addr)} />
                    {addr.isDefault && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.25)",
                        borderRadius: 6, padding: "2px 8px", flexShrink: 0,
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3ecf6e", boxShadow: "0 0 4px #3ecf6e" }} />
                        <span style={{ color: "#3ecf6e", fontSize: 8.5, fontWeight: 600 }}>Mặc định</span>
                      </div>
                    )}
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => openEdit(addr)}
                      style={{
                        width: 30, height: 30, borderRadius: 9, border: "none",
                        background: "rgba(255,255,255,0.05)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, cursor: "pointer",
                      }}
                    >✏️</button>
                    {!addr.isDefault && (
                      <button
                        onClick={() => setShowDelete(addr.id)}
                        style={{
                          width: 30, height: 30, borderRadius: 9, border: "none",
                          background: "rgba(255,64,64,0.08)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, cursor: "pointer",
                        }}
                      >🗑️</button>
                    )}
                  </div>

                  {/* Address text */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📍</span>
                    <div style={{ color: "#b0956a", fontSize: 10.5, lineHeight: 1.5 }}>{addr.address}</div>
                  </div>

                  {/* Coordinates */}
                  <div style={{ display: "flex", gap: 6, marginBottom: addr.isDefault ? 0 : 10 }}>
                    {[
                      { k: "Lat", v: addr.lat.toFixed(4) },
                      { k: "Lng", v: addr.lng.toFixed(4) },
                    ].map(c => (
                      <div key={c.k} style={{
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 7, padding: "4px 9px",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <span style={{ color: "#6a5a40", fontSize: 8 }}>{c.k}</span>
                        <span style={{ color: "#b0956a", fontSize: 8.5, fontFamily: "monospace", fontWeight: 600 }}>{c.v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Set default button */}
                  {!addr.isDefault && (
                    <button
                      onClick={() => setDefault(addr.id)}
                      style={{
                        width: "100%", height: 32, borderRadius: 9,
                        border: "1px solid rgba(255,107,0,0.2)",
                        background: "rgba(255,107,0,0.06)",
                        color: "#FF8C00", fontSize: 9.5, fontWeight: 600,
                        fontFamily: "'Lexend', sans-serif", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      }}
                    >⭐ Đặt làm địa chỉ mặc định</button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>}

          {!loading && addresses.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12, padding: "10px 13px", marginBottom: 6,
            }}>
              <p style={{ margin: 0, color: "#6a5a40", fontSize: 8.5, lineHeight: 1.6 }}>
                💡 Địa chỉ mặc định sẽ tự động điền khi bạn đặt hàng. Bạn có thể lưu tối đa 5 địa chỉ.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <div style={{
          position: "absolute", bottom:"max(16px,env(safe-area-inset-bottom))",left:14, right: 14, height: 56,
          background: "rgba(8,8,6,0.92)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,107,0,0.2)", borderRadius: 9999,
          display: "flex", alignItems: "center", justifyContent: "space-around",
          zIndex: 50, boxShadow: "0 0 20px rgba(255,107,0,0.1)",
        }}>
          {([
            { icon: "🏠", label: "Trang chủ", href: "/",        active: false },
            { icon: "📋", label: "Đơn hàng",  href: "/orders",  active: false },
            { icon: "🛒", label: "Giỏ hàng",  href: "/cart",    active: false },
            { icon: "⚙️", label: "Cài đặt",   href: "/settings", active: true  },
          ] as const).map(tab => (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              style={{
                flex: 1, height: "100%", background: "none", border: "none",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 2, cursor: "pointer",
                borderRadius: 9999, position: "relative",
              }}
            >
              {tab.active && (
                <div style={{
                  position: "absolute", inset: "6px 8px",
                  background: "rgba(255,107,0,0.1)", borderRadius: 9999,
                }} />
              )}
              <span style={{
                fontSize: 20, position: "relative",
                filter: tab.active ? "drop-shadow(0 0 4px rgba(255,107,0,0.6))" : "none",
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: 9, fontWeight: tab.active ? 700 : 400,
                color: tab.active ? "#FF8C00" : "#6a5a40",
                position: "relative",
              }}>
                {tab.label}
              </span>
              {tab.active && (
                <div style={{
                  position: "absolute", bottom: 4, width: 28, height: 3, borderRadius: 2,
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
