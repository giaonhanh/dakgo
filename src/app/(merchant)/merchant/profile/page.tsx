"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { SHOP_CATEGORIES, getCategoryByValue, normalizeCategoryValue } from "@/lib/categories"

/* ── hours types & helpers ── */
type TimeSlot = { from: string; to: string }
type DayHours = { day: string; open: boolean; slots: TimeSlot[] }

const DAYS_LABEL = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
const DEFAULT_HOURS: DayHours[] = DAYS_LABEL.map(d => ({
  day: d, open: true, slots: [{ from: "07:00", to: "21:00" }],
}))

function normalizeHours(raw: unknown): DayHours[] {
  if (!raw) return DEFAULT_HOURS
  if (Array.isArray(raw)) {
    return (raw as DayHours[]).map(d => ({
      day: d.day, open: d.open ?? true,
      slots: d.slots?.length ? d.slots : [{ from: "07:00", to: "21:00" }],
    }))
  }
  const obj = raw as Record<string, unknown>
  if (obj.open && obj.close) {
    return DAYS_LABEL.map(d => ({
      day: d, open: true,
      slots: [{ from: obj.open as string, to: obj.close as string }],
    }))
  }
  return DEFAULT_HOURS
}

function summarizeHours(hours: DayHours[]): string {
  const open = hours.filter(h => h.open)
  if (!open.length) return "Nghỉ tất cả các ngày"
  const first = open[0].slots[0]
  const allSame = open.every(h => h.slots[0]?.from === first?.from && h.slots[0]?.to === first?.to)
  if (allSame && first) return `${open.map(h => h.day.replace("Thứ ", "T")).join("·")}: ${first.from}–${first.to}`
  return `${open.length}/7 ngày · ${first?.from ?? ""}–${first?.to ?? ""}`
}

const timeInputStyle: React.CSSProperties = {
  flex: 1, height: 34, padding: "0 8px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,107,0,0.2)",
  borderRadius: 8, color: "#f8f0e0", fontSize: 11, fontFamily: "Lexend", colorScheme: "dark",
}

function HoursToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 46, height: 26, borderRadius: 13, flexShrink: 0, cursor: "pointer", border: "none",
      background: on ? "#3ecf6e" : "rgba(255,255,255,0.1)", position: "relative", transition: "background .25s",
    }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,0.35)" }} />
    </button>
  )
}

function HoursSheet({ onClose, shopId, initialHours, onSaved }: {
  onClose: () => void; shopId: string | null
  initialHours: DayHours[]; onSaved: (h: DayHours[]) => void
}) {
  const supabase = createClient()
  const [hours,  setHours]  = useState<DayHours[]>(initialHours)
  const [saving, setSaving] = useState(false)

  const toggle     = (i: number) =>
    setHours(h => h.map((x, j) => j === i ? { ...x, open: !x.open } : x))
  const addSlot    = (i: number) =>
    setHours(h => h.map((x, j) => j === i
      ? { ...x, slots: [...x.slots, { from: "14:00", to: "21:00" }] } : x))
  const removeSlot = (i: number, si: number) =>
    setHours(h => h.map((x, j) => j === i
      ? { ...x, slots: x.slots.filter((_, k) => k !== si) } : x))
  const updateSlot = (i: number, si: number, field: keyof TimeSlot, val: string) =>
    setHours(h => h.map((x, j) => j === i
      ? { ...x, slots: x.slots.map((s, k) => k === si ? { ...s, [field]: val } : s) } : x))

  const handleSave = async () => {
    if (!shopId) return
    setSaving(true)
    const { error } = await supabase.from("shops")
      .update({ opening_hours: hours, updated_at: new Date().toISOString() })
      .eq("id", shopId)
    setSaving(false)
    if (error) { alert("Lỗi lưu: " + error.message); return }
    onSaved(hours)
    onClose()
  }

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(8,8,6,0.75)",
        backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#0e0b07", borderTop: "1px solid rgba(255,107,0,0.3)",
        borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)",
        maxHeight: "88dvh", overflowY: "auto" }}>

        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <div style={{ flex: 1, color: "#f8f0e0", fontSize: 15, fontWeight: 800 }}>🕐 Giờ hoạt động từng ngày</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none",
            borderRadius: 8, width: 30, height: 30, color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ color: "#6a5a40", fontSize: 9, marginBottom: 16 }}>
          Mỗi ngày có thể có 2 khung giờ — VD: 07:00–11:00 và 14:00–21:00 (nghỉ trưa).
        </div>

        {hours.map((h, i) => (
          <div key={h.day} style={{ padding: "10px 0",
            borderBottom: i < hours.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: h.open ? 8 : 0 }}>
              <div style={{ width: 56, color: h.open ? "#f8f0e0" : "#6a5a40",
                fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{h.day}</div>
              <HoursToggle on={h.open} onToggle={() => toggle(i)} />
              {!h.open && <div style={{ color: "#6a5a40", fontSize: 10 }}>Nghỉ cả ngày</div>}
            </div>
            {h.open && (
              <div style={{ paddingLeft: 66 }}>
                {h.slots.map((slot, si) => (
                  <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ color: "#6a5a40", fontSize: 9, width: 12 }}>{si + 1}</span>
                    <input type="time" value={slot.from}
                      onChange={e => updateSlot(i, si, "from", e.target.value)} style={timeInputStyle} />
                    <span style={{ color: "#6a5a40", fontSize: 10 }}>–</span>
                    <input type="time" value={slot.to}
                      onChange={e => updateSlot(i, si, "to", e.target.value)} style={timeInputStyle} />
                    {h.slots.length > 1 && (
                      <button onClick={() => removeSlot(i, si)}
                        style={{ width: 26, height: 26, borderRadius: 7, border: "none",
                          background: "rgba(255,64,64,0.1)", color: "#ff4040",
                          fontSize: 13, cursor: "pointer", flexShrink: 0 }}>×</button>
                    )}
                  </div>
                ))}
                {h.slots.length < 2 && (
                  <button onClick={() => addSlot(i)}
                    style={{ marginTop: 2, padding: "4px 10px", borderRadius: 7, border: "none",
                      background: "rgba(255,255,255,0.04)", color: "#6a5a40",
                      fontSize: 9, cursor: "pointer", fontFamily: "Lexend" }}>
                    + Thêm khung giờ 2 (có nghỉ trưa)
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        <button onClick={handleSave} disabled={saving}
          style={{ width: "100%", height: 48, borderRadius: 14, border: "none",
            background: saving ? "rgba(255,255,255,0.08)" : "linear-gradient(90deg,#FF6B00,#FF8C00)",
            color: saving ? "#6a5a40" : "#fff",
            fontSize: 13, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "Lexend", marginTop: 16 }}>
          {saving ? "Đang lưu..." : "✓ Lưu giờ hoạt động"}
        </button>
      </div>
    </motion.div>
  )
}

const MapPicker = dynamic(() => import("@/components/merchant/MapPicker"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#080806", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 32 }}>🗺️</div>
      <div style={{ color: "#6a5a40", fontSize: 12, fontFamily: "Lexend" }}>Đang tải bản đồ...</div>
    </div>
  ),
})

function toSlug(text: string): string {
  return text.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "")
}

const AVATAR_LIST = ["🍜","🍗","🍕","🥗","🍱","🥤","🧁","🍛","🥩","🦐","🍔","🌮"]

type ToastType = "success" | "error" | "info"
interface Toast { id: number; msg: string; type: ToastType }

export default function MerchantProfilePage() {
  const supabase = createClient()

  const [shopId,      setShopId]      = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [isOpen,      setIsOpen]      = useState(false)
  const [name,        setName]        = useState("")
  const [phone,       setPhone]       = useState("")
  const [description, setDescription] = useState("")
  const [address,     setAddress]     = useState("")
  const [categories,  setCategories]  = useState<string[]>([])
  const [avatar,      setAvatar]      = useState("🍜")
  const [rating,      setRating]      = useState<number | null>(null)
  const [totalReview, setTotalReview] = useState(0)
  const [commission,  setCommission]  = useState(15)
  const [joined,      setJoined]      = useState("")
  const [lat,         setLat]         = useState<number | null>(null)
  const [lng,         setLng]         = useState<number | null>(null)
  const [logoUrl,     setLogoUrl]     = useState<string | null>(null)
  const [coverUrl,    setCoverUrl]    = useState<string | null>(null)
  const [slug,        setSlug]        = useState("")
  const [slugErr,     setSlugErr]     = useState("")
  const [slugSaving,  setSlugSaving]  = useState(false)
  const [slugSaved,   setSlugSaved]   = useState(false)
  const [slugCopied,  setSlugCopied]  = useState(false)
  const savedSlugRef = useRef("")  // slug đang lưu trong DB
  const coverInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef  = useRef<HTMLInputElement>(null)

  // Track original values to detect changes
  const origRef = useRef({ name: "", address: "" })
  const [dirty, setDirty] = useState(false)

  const [hours,            setHours]            = useState<DayHours[]>(DEFAULT_HOURS)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showMapPicker,    setShowMapPicker]    = useState(false)
  const [showHours,        setShowHours]        = useState(false)
  const [toasts,           setToasts]           = useState<Toast[]>([])

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const [{ data: profile }, { data: shop }] = await Promise.all([
          supabase.from("profiles").select("created_at").eq("id", user.id).single(),
          supabase.from("shops")
            .select("id,name,phone,address,description,category,categories,is_open,rating_avg,total_reviews,commission_rate,lat,lng,logo_url,cover_image_url,slug,opening_hours")
            .eq("owner_id", user.id)
            .single(),
        ])

        if (profile?.created_at) {
          setJoined(new Date(profile.created_at).toLocaleDateString("vi-VN"))
        }
        if (shop) {
          setShopId(shop.id)
          setName(shop.name ?? "")
          setPhone(shop.phone ?? "")
          setDescription((shop as Record<string,unknown>).description as string ?? "")
          setAddress(shop.address ?? "")
          origRef.current = { name: shop.name ?? "", address: shop.address ?? "" }
          const rawCats: string[] = Array.isArray(shop.categories) && shop.categories.length > 0
            ? shop.categories
            : shop.category ? [shop.category] : []
          setCategories(rawCats.map((v: string) => normalizeCategoryValue(v)))
          setIsOpen(shop.is_open ?? false)
          setRating(shop.rating_avg ?? null)
          setTotalReview(shop.total_reviews ?? 0)
          setCommission(shop.commission_rate ?? 15)
          if (shop.lat && shop.lng) {
            setLat(shop.lat as number)
            setLng(shop.lng as number)
          }
          setLogoUrl((shop as Record<string,unknown>).logo_url as string ?? null)
          setCoverUrl((shop as Record<string,unknown>).cover_image_url as string ?? null)
          setHours(normalizeHours((shop as Record<string,unknown>).opening_hours))
          const loadedSlug = (shop as Record<string,unknown>).slug as string ?? ""
          setSlug(loadedSlug)
          savedSlugRef.current = loadedSlug
          if (loadedSlug) setSlugSaved(true)
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkDirty = (n: string, a: string) => {
    const o = origRef.current
    setDirty(n !== o.name || a !== o.address)
  }

  const addToast = (msg: string, type: ToastType = "success") => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }

  const handleToggleOpen = async () => {
    const next = !isOpen
    setIsOpen(next)
    if (shopId) {
      const { error } = await supabase.from("shops").update({ is_open: next }).eq("id", shopId)
      if (error) { setIsOpen(!next); addToast("❌ Không thể cập nhật trạng thái", "error"); return }
    }
    addToast(next ? "🟢 Cửa hàng đang mở cửa" : "🔴 Cửa hàng đã đóng cửa", next ? "success" : "info")
  }

  const handleMapConfirm = async (pickedLat: number, pickedLng: number, geocodedAddr: string) => {
    setLat(pickedLat)
    setLng(pickedLng)
    if (geocodedAddr) {
      setAddress(geocodedAddr)
      checkDirty(name, geocodedAddr)
    }
    setShowMapPicker(false)

    if (shopId) {
      const { error } = await supabase.from("shops").update({
        location:   `SRID=4326;POINT(${pickedLng} ${pickedLat})`,
        lat:        pickedLat,
        lng:        pickedLng,
        ...(geocodedAddr ? { address: geocodedAddr } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", shopId)
      if (error) addToast("❌ Lỗi lưu tọa độ: " + error.message, "error")
      else {
        addToast("📍 Đã lưu vị trí trên bản đồ")
        if (geocodedAddr) origRef.current.address = geocodedAddr
        checkDirty(name, geocodedAddr || address)
      }
    }
  }

  const compressImage = (file: File, maxW: number, maxH: number, quality: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement("canvas")
        canvas.width = w; canvas.height = h
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h)
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("compress failed")), "image/webp", quality)
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })

  const handleImageUpload = async (file: File, type: "logo" | "cover") => {
    if (!shopId) return
    const [maxW, maxH] = type === "cover" ? [1200, 480] : [400, 400]
    const compressed = await compressImage(file, maxW, maxH, 0.92).catch(() => file)
    const path = `${shopId}/${type}`
    const { error: upErr } = await supabase.storage.from("shops").upload(path, compressed, { upsert: true, contentType: "image/webp" })
    if (upErr) { addToast("❌ Lỗi upload: " + upErr.message, "error"); return }
    const { data: { publicUrl } } = supabase.storage.from("shops").getPublicUrl(path)
    const urlWithBust = `${publicUrl}?t=${Date.now()}`
    const col = type === "logo" ? "logo_url" : "cover_image_url"
    const { error } = await supabase.from("shops").update({ [col]: urlWithBust }).eq("id", shopId)
    if (error) { addToast("❌ Lỗi lưu ảnh: " + error.message, "error"); return }
    if (type === "logo") setLogoUrl(urlWithBust)
    else setCoverUrl(urlWithBust)
    addToast(type === "logo" ? "✅ Đã cập nhật ảnh đại diện" : "✅ Đã cập nhật ảnh bìa")
  }

  const handleSlugSave = async () => {
    if (!shopId || !slug) return
    if (slug.length < 3) { setSlugErr("Tối thiểu 3 ký tự"); return }
    setSlugSaving(true); setSlugErr("")
    const oldSlug = savedSlugRef.current
    const payload: Record<string, unknown> = { slug }
    if (oldSlug && oldSlug !== slug) payload.previous_slug = oldSlug
    const { error } = await supabase.from("shops").update(payload).eq("id", shopId)
    setSlugSaving(false)
    if (error) {
      if (error.code === "23505") { setSlugErr("Link đã có người dùng, thử link khác nhé!"); return }
      setSlugErr("Lỗi: " + error.message); return
    }
    savedSlugRef.current = slug
    setSlugSaved(true)
    addToast("✅ Đã lưu link cửa hàng")
  }

  const handleSave = async () => {
    if (!name.trim())    { addToast("❌ Tên cửa hàng không được để trống", "error"); return }
    if (!address.trim()) { addToast("❌ Địa chỉ không được để trống", "error"); return }

    setSaving(true)
    if (shopId) {
      const payload: Record<string, unknown> = {
        name, description, address, categories,
        category: categories[0] ?? "khac",
        updated_at: new Date().toISOString(),
      }
      if (lat !== null && lng !== null) {
        payload.location = `SRID=4326;POINT(${lng} ${lat})`
        payload.lat = lat
        payload.lng = lng
      }
      const { error } = await supabase.from("shops").update(payload).eq("id", shopId)
      if (error) { addToast("❌ Lỗi lưu: " + error.message, "error"); setSaving(false); return }
    }
    origRef.current = { name, address }
    setDirty(false)
    setSaving(false)
    addToast("✅ Đã lưu thông tin cửa hàng")
  }

  const toastBg  = (t: ToastType) => t === "success" ? "rgba(62,207,110,0.15)"  : t === "error" ? "rgba(255,64,64,0.15)"  : "rgba(74,143,245,0.15)"
  const toastBdr = (t: ToastType) => t === "success" ? "rgba(62,207,110,0.4)"   : t === "error" ? "rgba(255,64,64,0.4)"   : "rgba(74,143,245,0.4)"
  const toastClr = (t: ToastType) => t === "success" ? "#3ecf6e"                : t === "error" ? "#ff4040"               : "#4a8ff5"

  if (loading) return (
    <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12 }}>
      <div style={{ fontSize:32 }}>🏪</div>
      <div style={{ color:"#6a5a40",fontSize:12 }}>Đang tải hồ sơ...</div>
    </div>
  )

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        input,textarea{outline:none;font-family:'Lexend',sans-serif}
        textarea{resize:none}
      `}</style>

      {/* Toast stack */}
      <div style={{ position:"fixed",top:"calc(env(safe-area-inset-top) + 64px)",left:16,right:16,zIndex:200,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none" }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background:toastBg(t.type), border:`1px solid ${toastBdr(t.type)}`, borderRadius:12, padding:"10px 14px", color:toastClr(t.type), fontSize:12, fontWeight:600, backdropFilter:"blur(8px)" }}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Map Picker overlay */}
      {showMapPicker && (
        <MapPicker
          initialLat={lat}
          initialLng={lng}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"calc(env(safe-area-inset-top) + 14px) 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <Link href="/merchant" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</Link>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Hồ sơ cửa hàng</div>
            </div>
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"16px 16px 100px" }}>

          {/* Ảnh bìa + logo */}
          <div style={{ marginBottom:16 }}>
            {/* Cover image */}
            <div style={{ position:"relative", height:130, borderRadius:14, overflow:"hidden", background:"linear-gradient(135deg,#1a0d00,#2d1500)", marginBottom:10, cursor:"pointer" }}
              onClick={() => coverInputRef.current?.click()}>
              {coverUrl
                ? <img src={coverUrl} alt="cover" style={{ width:"100%",height:"100%",objectFit:"cover",opacity:0.85 }} />
                : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6 }}>
                    <div style={{ fontSize:26 }}>🖼️</div>
                    <div style={{ color:"#6a5a40",fontSize:10,fontWeight:600 }}>Nhấn để thêm ảnh bìa</div>
                  </div>
              }
              <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.55)",padding:"6px 0",textAlign:"center",fontSize:9,color:"#fff",fontWeight:600 }}>
                📷 Đổi ảnh bìa
              </div>
            </div>
            <input ref={coverInputRef} type="file" accept="image/*" style={{ display:"none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "cover"); e.target.value="" }} />

            {/* Logo + stats row */}
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              {/* Logo */}
              <div style={{ position:"relative", flexShrink:0 }}>
                <div onClick={() => logoInputRef.current?.click()}
                  style={{ width:72,height:72,borderRadius:18,background:logoUrl?"transparent":"linear-gradient(135deg,rgba(255,107,0,0.2),rgba(255,107,0,0.05))",border:"2px solid rgba(255,107,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",position:"relative" }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="logo" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                    : <span style={{ fontSize:32 }}>{avatar}</span>
                  }
                  <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.6)",fontSize:8,color:"#fff",padding:"2px 0",textAlign:"center",fontWeight:600 }}>Đổi</div>
                </div>
                <div style={{ position:"absolute",bottom:-3,right:-3,width:18,height:18,borderRadius:6,background:isOpen?"#3ecf6e":"#6a5a40",border:"2px solid #080806" }} />
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display:"none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "logo"); e.target.value="" }} />

              {/* Info */}
              <div style={{ flex:1 }}>
                <div style={{ color:"#f8f0e0",fontSize:15,fontWeight:800,marginBottom:2 }}>{name || "Chưa đặt tên"}</div>
                <div style={{ color:"#6a5a40",fontSize:10,marginBottom:8 }}>
                  {categories.length > 0 ? categories.map(v => `${getCategoryByValue(v).emoji} ${getCategoryByValue(v).label}`).join(", ") : "Chưa chọn loại hình"}
                </div>
                <div style={{ display:"flex", gap:12 }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ color:"#FF8C00",fontSize:12,fontWeight:700 }}>⭐ {rating?.toFixed(1) ?? "—"}</div>
                    <div style={{ color:"#6a5a40",fontSize:9 }}>Sao</div>
                  </div>
                  <div style={{ width:1,background:"rgba(255,255,255,0.06)" }} />
                  <div style={{ textAlign:"center" }}>
                    <div style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>{totalReview}</div>
                    <div style={{ color:"#6a5a40",fontSize:9 }}>Đánh giá</div>
                  </div>
                  <div style={{ width:1,background:"rgba(255,255,255,0.06)" }} />
                  <div style={{ textAlign:"center" }}>
                    <div style={{ color:"#f8f0e0",fontSize:12,fontWeight:700 }}>{commission}%</div>
                    <div style={{ color:"#6a5a40",fontSize:9 }}>Hoa hồng</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Open toggle + emoji picker */}
            <div style={{ display:"flex",gap:8,marginTop:10 }}>
              <button onClick={handleToggleOpen}
                style={{ flex:1,background:isOpen?"rgba(62,207,110,0.1)":"rgba(255,255,255,0.06)",border:isOpen?"1px solid rgba(62,207,110,0.3)":"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 0",color:isOpen?"#3ecf6e":"#6a5a40",fontSize:11,fontWeight:700,cursor:"pointer" }}>
                {isOpen ? "🟢 Đang mở cửa" : "🔴 Đang đóng cửa"}
              </button>
              {!logoUrl && (
                <button onClick={() => setShowAvatarPicker(true)}
                  style={{ padding:"8px 14px",borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"#b0956a",fontSize:11,fontWeight:600,cursor:"pointer" }}>
                  {avatar} Đổi icon
                </button>
              )}
            </div>
          </div>

          {/* Link cửa hàng */}
          <div style={{ background:"rgba(255,107,0,0.06)",border:"1px solid rgba(255,107,0,0.18)",borderRadius:14,padding:14,marginBottom:14 }}>
            <div style={{ color:"#FF8C00",fontSize:11,fontWeight:700,marginBottom:10 }}>🔗 Link cửa hàng</div>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
              <div style={{ flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,107,0,0.25)",borderRadius:10,overflow:"hidden",display:"flex",alignItems:"center" }}>
                <span style={{ padding:"0 8px",color:"#6a5a40",fontSize:10,whiteSpace:"nowrap",borderRight:"1px solid rgba(255,255,255,0.06)" }}>/s/</span>
                <input
                  value={slug}
                  onChange={e => { setSlugErr(""); setSlugSaved(false); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"").replace(/-+/g,"-")) }}
                  placeholder={toSlug(name) || "tencuahang"}
                  style={{ flex:1,height:38,padding:"0 10px",background:"none",border:"none",color:"#f8f0e0",fontSize:12,fontFamily:"Lexend",outline:"none" }}
                />
                {slug && name && slug !== toSlug(name) && (
                  <button onClick={() => setSlug(toSlug(name))} style={{ padding:"0 8px",background:"none",border:"none",color:"#6a5a40",fontSize:11,cursor:"pointer" }}>↺</button>
                )}
              </div>
              <button onClick={slugSaved ? () => setSlugSaved(false) : handleSlugSave}
                disabled={slugSaving}
                style={{ padding:"0 14px",height:38,borderRadius:10,
                  background: slugSaving||(!slug&&!slugSaved) ? "rgba(255,255,255,0.06)" : slugSaved ? "rgba(62,207,110,0.12)" : "linear-gradient(90deg,#FF6B00,#FF8C00)",
                  border: slugSaved ? "1px solid rgba(62,207,110,0.3)" : "1px solid transparent",
                  color: slugSaving||(!slug&&!slugSaved) ? "#6a5a40" : slugSaved ? "#3ecf6e" : "#fff",
                  fontSize:11,fontWeight:700,cursor:slugSaving?"not-allowed":"pointer",flexShrink:0,fontFamily:"Lexend" }}>
                {slugSaving ? "..." : slugSaved ? "✓ Thay đổi" : "Lưu"}
              </button>
            </div>
            {slugErr && <div style={{ color:"#ff4040",fontSize:10,marginBottom:6 }}>⚠ {slugErr}</div>}
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <div style={{ flex:1,color:"#6a5a40",fontSize:10 }}>
                <span style={{ color:"#b0956a" }}>www.dakgo.com/s/</span>
                <span style={{ color:"#FF8C00",fontWeight:600 }}>{slug || toSlug(name) || "tencuahang"}</span>
              </div>
              <button
                onClick={async () => {
                  if (!slugSaved) return
                  await navigator.clipboard.writeText(`https://www.dakgo.com/s/${slug}`)
                  setSlugCopied(true)
                  setTimeout(() => setSlugCopied(false), 2000)
                }}
                disabled={!slugSaved}
                style={{ padding:"4px 10px",borderRadius:7,border:"none",
                  background: slugCopied ? "rgba(62,207,110,0.12)" : !slugSaved ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
                  color: slugCopied ? "#3ecf6e" : !slugSaved ? "#3a2a1a" : "#6a5a40",
                  fontSize:9,fontWeight:700,cursor:slugSaved?"pointer":"not-allowed",fontFamily:"Lexend" }}>
                {slugCopied ? "✓ Đã copy" : "📋 Copy"}
              </button>
            </div>
            <div style={{ color:"#6a5a40",fontSize:9,marginTop:6,lineHeight:1.5 }}>
              {slugSaved
                ? "💡 Chia sẻ link này lên Zalo/FB — khách bấm vào sẽ thấy trang quán và đặt hàng ngay."
                : "⚠️ Nhập link và bấm Lưu trước khi chia sẻ."}
            </div>
          </div>

          {/* Shop info — always editable */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#6a5a40",fontSize:10,fontWeight:600,marginBottom:12 }}>THÔNG TIN CỬA HÀNG</div>

            {/* Tên */}
            <div style={{ marginBottom:10 }}>
              <div style={{ color:"#6a5a40",fontSize:9,marginBottom:4 }}>Tên cửa hàng</div>
              <input value={name} onChange={e => { setName(e.target.value); checkDirty(e.target.value, address) }}
                placeholder="Tên cửa hàng..."
                style={{ width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,107,0,0.25)",borderRadius:8,padding:"8px 10px",color:"#f8f0e0",fontSize:12,fontWeight:600 }} />
            </div>

            {/* Mô tả */}
            <div style={{ marginBottom:10 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                <div style={{ color:"#6a5a40",fontSize:9 }}>Mô tả quán</div>
                <div style={{ color:"#6a5a40",fontSize:9 }}>{description.length}/150</div>
              </div>
              <textarea value={description} onChange={e => { setDescription(e.target.value.slice(0,150)); checkDirty(name, address) }}
                rows={3} placeholder="Giới thiệu ngắn về quán — hiển thị khi chia sẻ link lên Zalo/FB..."
                style={{ width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,107,0,0.25)",borderRadius:8,padding:"8px 10px",color:"#f8f0e0",fontSize:11,lineHeight:1.6 }} />
            </div>

            {/* SĐT — read-only, chỉ admin thay đổi */}
            <div style={{ marginBottom:10 }}>
              <div style={{ color:"#6a5a40",fontSize:9,marginBottom:4 }}>Số điện thoại</div>
              <div style={{ display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"8px 10px" }}>
                <span style={{ flex:1,color:"#b0956a",fontSize:12 }}>{phone || "Chưa có"}</span>
                <span style={{ color:"#6a5a40",fontSize:9,background:"rgba(255,255,255,0.05)",borderRadius:5,padding:"2px 7px",flexShrink:0 }}>🔒 Chỉ Admin</span>
              </div>
              <div style={{ color:"#6a5a40",fontSize:9,marginTop:4 }}>Liên hệ Admin để thay đổi số điện thoại cửa hàng.</div>
            </div>

            {/* Địa chỉ */}
            <div style={{ marginBottom:10 }}>
              <div style={{ color:"#6a5a40",fontSize:9,marginBottom:4 }}>Địa chỉ</div>
              <textarea value={address} onChange={e => { setAddress(e.target.value); checkDirty(name, e.target.value) }}
                rows={2} placeholder="Số nhà, tên đường, phường/xã..."
                style={{ width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,107,0,0.25)",borderRadius:8,padding:"8px 10px",color:"#f8f0e0",fontSize:11,lineHeight:1.5 }} />
              <button type="button" onClick={() => setShowMapPicker(true)}
                style={{ marginTop:6,display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:8,background:"rgba(74,143,245,0.1)",border:"1px solid rgba(74,143,245,0.28)",color:"#4a8ff5",fontSize:9.5,fontWeight:700,cursor:"pointer" }}>
                📍 Chọn trên bản đồ
                {lat && lng && <span style={{ color:"#3ecf6e" }}>✓</span>}
              </button>
              {lat && lng && (
                <div style={{ color:"#3ecf6e",fontSize:8.5,marginTop:4 }}>✅ Có tọa độ · {lat.toFixed(5)}, {lng.toFixed(5)}</div>
              )}
            </div>

            {/* Loại hình — read-only */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ color:"#6a5a40",fontSize:10 }}>Loại hình</span>
              <span style={{ color:"#f8f0e0",fontSize:10,fontWeight:600,textAlign:"right" }}>
                {categories.length > 0 ? categories.map(v=>`${getCategoryByValue(v).emoji} ${getCategoryByValue(v).label}`).join(", ") : "Chưa chọn"}
              </span>
            </div>

            {/* Ngày tham gia */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,marginTop:8,borderTop:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ color:"#6a5a40",fontSize:10 }}>Ngày tham gia</span>
              <span style={{ color:"#f8f0e0",fontSize:10,fontWeight:600 }}>{joined || "—"}</span>
            </div>
          </div>

          {/* Giờ hoạt động */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#6a5a40",fontSize:10,fontWeight:600,marginBottom:10 }}>LỊCH HOẠT ĐỘNG</div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div>
                <div style={{ color:"#f8f0e0",fontSize:12,fontWeight:600,marginBottom:2 }}>🕐 Giờ mở cửa từng ngày</div>
                <div style={{ color:"#6a5a40",fontSize:10 }}>{summarizeHours(hours)}</div>
              </div>
              <button onClick={() => setShowHours(true)}
                style={{ padding:"7px 14px",borderRadius:10,background:"rgba(255,107,0,0.1)",border:"1px solid rgba(255,107,0,0.28)",color:"#FF8C00",fontSize:10,fontWeight:700,cursor:"pointer",flexShrink:0 }}>
                Chỉnh sửa
              </button>
            </div>
          </div>

        </div>

        {/* Sticky save bar — only shows when dirty */}
        {dirty && (
          <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"12px 16px calc(env(safe-area-inset-bottom) + 12px)",background:"linear-gradient(to top,#080806 60%,transparent)",borderTop:"1px solid rgba(255,107,0,0.15)" }}>
            <button onClick={handleSave} disabled={saving}
              style={{ width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,#FF6B1A,#CC4A00)",border:"none",color:"#fff",fontSize:14,fontWeight:800,cursor:saving?"not-allowed":"pointer",opacity:saving?0.7:1,letterSpacing:0.5 }}>
              {saving ? "Đang lưu..." : "💾 Lưu thay đổi"}
            </button>
          </div>
        )}

      </div>

      {/* Avatar picker */}
      {showAvatarPicker && (
        <>
          <div onClick={() => setShowAvatarPicker(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:50,backdropFilter:"blur(4px)" }} />
          <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"#0e0c09",borderRadius:"20px 20px 0 0",border:"1px solid rgba(255,255,255,0.08)",padding:"20px 16px 32px",zIndex:51 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <div style={{ color:"#f8f0e0",fontSize:13,fontWeight:800 }}>Chọn icon cửa hàng</div>
              <button onClick={() => setShowAvatarPicker(false)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#6a5a40",fontSize:16,cursor:"pointer" }}>×</button>
            </div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center" }}>
              {AVATAR_LIST.map(e => (
                <button key={e} onClick={() => { setAvatar(e); setShowAvatarPicker(false) }}
                  style={{ width:52,height:52,borderRadius:12,background:avatar===e?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",border:avatar===e?"1px solid rgba(255,107,0,0.4)":"1px solid rgba(255,255,255,0.06)",fontSize:26,cursor:"pointer" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Hours sheet */}
      <AnimatePresence>
        {showHours && (
          <HoursSheet
            onClose={() => setShowHours(false)}
            shopId={shopId}
            initialHours={hours}
            onSaved={h => { setHours(h); addToast("✅ Đã lưu giờ hoạt động") }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
