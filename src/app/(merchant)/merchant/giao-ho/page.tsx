"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Package, MapPin, User, Phone, StickyNote, CheckCircle2, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getRouteKm, calcDeliveryFeeFromPricing } from "@/lib/vietmapRoute"
import AddressPicker from "@/components/map/AddressPicker"
import type { AddressPickerResult } from "@/types"

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

const WEIGHTS = [
  { key: "nhe",  label: "0–3kg",  emoji: "📦" },
  { key: "vua",  label: "3–5kg",  emoji: "📫" },
  { key: "nang", label: "5–10kg", emoji: "🗃️" },
] as const
type Weight = typeof WEIGHTS[number]["key"]

const inp: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
  padding: "10px 12px", color: "#f8f0e0", fontSize: 13,
  fontFamily: "Lexend", outline: "none",
}
const lbl: React.CSSProperties = { color: "#6a5a40", fontSize: 11, marginBottom: 5, fontWeight: 600, display: "block" }

export default function MerchantGiaoHoPage() {
  const router   = useRouter()
  const supabase = createClient()

  // Shop info
  const [shopId,      setShopId]      = useState("")
  const [shopAddress, setShopAddress] = useState("")
  const [shopLat,     setShopLat]     = useState(12.683)
  const [shopLng,     setShopLng]     = useState(108.483)
  const [shopName,    setShopName]    = useState("")

  // Người nhận
  const [recipientName,  setRecipientName]  = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")

  // Địa chỉ giao
  const [delivery,      setDelivery]      = useState("")
  const [deliveryCoord, setDeliveryCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [showAddrPicker, setShowAddrPicker] = useState(false)

  // Hàng hóa
  const [pkgDesc, setPkgDesc] = useState("")
  const [weight,  setWeight]  = useState<Weight>("nhe")
  const [note,    setNote]    = useState("")

  // COD — tiền hàng thu hộ
  const [codEnabled,  setCodEnabled]  = useState(false)
  const [codAmount,   setCodAmount]   = useState("")
  const [qrUrl,       setQrUrl]       = useState<string | null>(null)
  const [qrUploading, setQrUploading] = useState(false)
  const qrInputRef = useRef<HTMLInputElement>(null)

  // Pricing
  const [pricingRows,    setPricingRows]    = useState<string[]>(["18000","15000","12000","10000","9000","8500","8000","7500","7000","6500"])
  const [pricingExtra,   setPricingExtra]   = useState("6000")
  const [weightMidFee,   setWeightMidFee]   = useState(5000)
  const [weightHeavyFee, setWeightHeavyFee] = useState(10000)
  const [distanceKm,     setDistanceKm]     = useState<number | null>(null)
  const [calcingDist,    setCalcingDist]    = useState(false)

  // UI
  const [loading,  setLoading]  = useState(false)
  const [toast,    setToast]    = useState("")
  const [success,  setSuccess]  = useState(false)
  const [errandId, setErrandId] = useState("")

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  // Load shop info + pricing
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [shopRes, pricingRes] = await Promise.all([
        supabase.from("shops")
          .select("id,name,address,lat,lng")
          .eq("owner_id", user.id)
          .maybeSingle(),
        supabase.from("app_settings")
          .select("value")
          .eq("key", "pricing")
          .maybeSingle(),
      ])

      if (shopRes.data) {
        setShopId(shopRes.data.id)
        setShopName(shopRes.data.name)
        setShopAddress(shopRes.data.address ?? "")
        if (shopRes.data.lat) setShopLat(shopRes.data.lat)
        if (shopRes.data.lng) setShopLng(shopRes.data.lng)
      }

      const dp = (pricingRes.data?.value as Record<string, { rows?: string[]; extra?: string; weightMid?: string; weightHeavy?: string } | undefined> | null)?.delivery_pkg
      if (dp?.rows)        setPricingRows(dp.rows)
      if (dp?.extra)       setPricingExtra(dp.extra)
      if (dp?.weightMid)   setWeightMidFee(Number(dp.weightMid))
      if (dp?.weightHeavy) setWeightHeavyFee(Number(dp.weightHeavy))
    }
    load()
  }, [])

  // Tính khoảng cách khi có địa chỉ giao
  useEffect(() => {
    if (!deliveryCoord) { setDistanceKm(null); return }
    setCalcingDist(true)
    getRouteKm(shopLat, shopLng, deliveryCoord.lat, deliveryCoord.lng)
      .then(km => { setDistanceKm(Math.round(km * 10) / 10); setCalcingDist(false) })
      .catch(() => setCalcingDist(false))
  }, [deliveryCoord, shopLat, shopLng])

  const weightSurcharge = weight === "vua" ? weightMidFee : weight === "nang" ? weightHeavyFee : 0
  const baseFee    = calcDeliveryFeeFromPricing(distanceKm ?? 2, pricingRows, pricingExtra)
  const serviceFee = baseFee + weightSurcharge
  const codValue   = codEnabled ? (parseInt(codAmount.replace(/\D/g, "")) || 0) : 0

  // Crop ảnh về hình vuông (center crop) rồi nén
  const cropSquare = (file: File, size: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const s = Math.min(img.width, img.height)
        const sx = (img.width  - s) / 2
        const sy = (img.height - s) / 2
        const canvas = document.createElement("canvas")
        canvas.width = size; canvas.height = size
        canvas.getContext("2d")!.drawImage(img, sx, sy, s, s, 0, 0, size, size)
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("crop failed")), "image/webp", 0.92)
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })

  const handleQrUpload = async (file: File) => {
    if (!shopId) return
    setQrUploading(true)
    try {
      const blob = await cropSquare(file, 400).catch(() => file)
      const path = `${shopId}/payment-qr`
      const { error } = await supabase.storage.from("shops").upload(path, blob, { upsert: true, contentType: "image/webp" })
      if (error) { fireToast("❌ Lỗi upload QR: " + error.message); return }
      const { data: { publicUrl } } = supabase.storage.from("shops").getPublicUrl(path)
      setQrUrl(`${publicUrl}?t=${Date.now()}`)
    } finally {
      setQrUploading(false)
    }
  }

  function handleAddrPick(res: AddressPickerResult) {
    setDelivery(res.address + (res.note ? ` (${res.note})` : ""))
    setDeliveryCoord({ lat: res.lat, lng: res.lng })
    setShowAddrPicker(false)
  }

  const handleSubmit = async () => {
    if (!shopId)                  { fireToast("Không tìm thấy thông tin quán"); return }
    if (!recipientName.trim())    { fireToast("Vui lòng nhập tên người nhận"); return }
    if (!recipientPhone.trim())   { fireToast("Vui lòng nhập SĐT người nhận"); return }
    if (!delivery.trim())         { fireToast("Vui lòng nhập địa chỉ giao"); return }
    if (!pkgDesc.trim())          { fireToast("Vui lòng mô tả hàng hóa"); return }
    if (codEnabled && !codValue)  { fireToast("Vui lòng nhập số tiền thu hộ"); return }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { fireToast("Vui lòng đăng nhập lại"); setLoading(false); return }

      const { data: errand, error } = await supabase.from("errands").insert({
        customer_id:          user.id,
        type:                 "deliver_for_me",
        status:               "pending",
        pickup_address:       shopAddress,
        pickup_lat:           shopLat,
        pickup_lng:           shopLng,
        delivery_address:     delivery,
        delivery_lat:         deliveryCoord?.lat ?? shopLat,
        delivery_lng:         deliveryCoord?.lng ?? shopLng,
        package_description:  pkgDesc,
        estimated_items_cost: codValue || null,
        package_photo_url:    qrUrl || null,
        note:                 [
          `Quán: ${shopName}`,
          note ? `Ghi chú: ${note}` : "",
        ].filter(Boolean).join(" | ") || null,
        service_fee:          serviceFee,
        payment_method:       "cash",
        sender_name:          shopName,
        sender_phone:         null,
        recipient_name:       recipientName,
        recipient_phone:      recipientPhone,
      }).select("id").single()

      if (error || !errand) { fireToast("Lỗi tạo đơn: " + (error?.message ?? "Không xác định")); setLoading(false); return }

      // Dispatch tài xế
      fetch("/api/errands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "deliver_for_me",
          pickup_address:  shopAddress, pickup_lat:  shopLat,  pickup_lng:  shopLng,
          delivery_address: delivery,  delivery_lat: deliveryCoord?.lat ?? shopLat, delivery_lng: deliveryCoord?.lng ?? shopLng,
          service_fee: serviceFee,
        }),
      }).catch(() => {})

      setErrandId(errand.id.slice(0, 8).toUpperCase())
      setSuccess(true)
    } catch {
      fireToast("Lỗi không xác định, thử lại")
    } finally {
      setLoading(false)
    }
  }

  // Success screen
  if (success) {
    return (
      <div style={{ minHeight: "100vh", background: "#080806", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 20 }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
          <CheckCircle2 size={72} color="#3ecf6e" strokeWidth={1.5} />
        </motion.div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#3ecf6e", fontSize: 22, fontWeight: 700 }}>Đơn đã được tạo!</div>
          <div style={{ color: "#b0956a", fontSize: 13, marginTop: 6 }}>Mã đơn #{errandId}</div>
          <div style={{ color: "#6a5a40", fontSize: 12, marginTop: 4 }}>Đang tìm tài xế phù hợp...</div>
        </div>
        <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 320 }}>
          <button
            onClick={() => { setSuccess(false); setRecipientName(""); setRecipientPhone(""); setDelivery(""); setDeliveryCoord(null); setPkgDesc(""); setNote(""); setCodEnabled(false); setCodAmount(""); setQrUrl(null) }}
            style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid rgba(255,107,0,0.3)", background: "rgba(255,107,0,0.07)", color: "#FF8C00", fontFamily: "Lexend", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            + Tạo đơn mới
          </button>
          <button
            onClick={() => router.push("/merchant")}
            style={{ flex: 1, height: 44, borderRadius: 10, background: "linear-gradient(135deg,#FF6B00,#FF8C00)", color: "#fff", fontFamily: "Lexend", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
          >
            Về trang chính
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        input,textarea{outline:none;font-family:'Lexend',sans-serif}
        input::placeholder,textarea::placeholder{color:#4a3a28}
        input:focus{border-color:rgba(255,107,0,0.4)!important}
        textarea:focus{border-color:rgba(255,107,0,0.4)!important}
      `}</style>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(8,8,6,0.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,107,0,0.15)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#b0956a", cursor: "pointer", padding: 4, display: "flex" }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ color: "#f8f0e0", fontWeight: 700, fontSize: 16 }}>Tạo đơn Giao Hộ</div>
          <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>Giao hàng thay mặt cửa hàng</div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Lấy hàng từ quán */}
        <div style={{ background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <MapPin size={16} color="#FF8C00" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ color: "#FF8C00", fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Lấy hàng tại quán</div>
            <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 500 }}>{shopName || "Đang tải..."}</div>
            <div style={{ color: "#b0956a", fontSize: 11, marginTop: 2 }}>{shopAddress || "—"}</div>
          </div>
        </div>

        {/* Người nhận */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <User size={15} color="#FF8C00" />
            <span style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 600 }}>Người nhận</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={lbl}>Tên người nhận *</label>
              <input value={recipientName} onChange={e => setRecipientName(e.target.value)}
                placeholder="Nguyễn Văn A" style={inp} />
            </div>
            <div>
              <label style={lbl}>Số điện thoại *</label>
              <input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)}
                placeholder="0901 234 567" inputMode="tel" style={inp} />
            </div>
          </div>
        </div>

        {/* Địa chỉ giao */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <MapPin size={15} color="#4a8ff5" />
            <span style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 600 }}>Địa chỉ giao</span>
          </div>
          <button
            onClick={() => setShowAddrPicker(true)}
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: delivery ? "#f8f0e0" : "#4a3a28", fontSize: 13, fontFamily: "Lexend", textAlign: "left", cursor: "pointer" }}
          >
            {delivery || "Nhập địa chỉ hoặc chọn trên bản đồ..."}
          </button>
          {distanceKm !== null && (
            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#6a5a40", fontSize: 11 }}>📏 {distanceKm} km</span>
              <span style={{ color: "#FF8C00", fontSize: 13, fontWeight: 700 }}>
                {calcingDist ? "Đang tính..." : fmt(serviceFee)}
              </span>
            </div>
          )}
        </div>

        {/* Hàng hóa */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Package size={15} color="#b464ff" />
            <span style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 600 }}>Hàng hóa</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={lbl}>Mô tả hàng *</label>
              <textarea value={pkgDesc} onChange={e => setPkgDesc(e.target.value)}
                placeholder="VD: 2 hộp bánh kem, quần áo, điện thoại..."
                rows={2} style={{ ...inp, resize: "none" }} />
            </div>

            {/* Trọng lượng */}
            <div>
              <label style={lbl}>Trọng lượng</label>
              <div style={{ display: "flex", gap: 8 }}>
                {WEIGHTS.map(w => (
                  <button key={w.key} onClick={() => setWeight(w.key)}
                    style={{
                      flex: 1, height: 42, borderRadius: 10, border: `1px solid ${weight === w.key ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.1)"}`,
                      background: weight === w.key ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.03)",
                      color: weight === w.key ? "#FF8C00" : "#b0956a", fontSize: 11, fontFamily: "Lexend", fontWeight: 600, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                    }}>
                    <span>{w.emoji}</span>
                    <span>{w.label}</span>
                  </button>
                ))}
              </div>
              {weight !== "nhe" && (
                <div style={{ marginTop: 6, color: "#6a5a40", fontSize: 11 }}>
                  + {fmt(weight === "vua" ? weightMidFee : weightHeavyFee)} phụ phí trọng lượng
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COD — Thu hộ */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${codEnabled ? "rgba(62,207,110,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: codEnabled ? 14 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15 }}>💵</span>
              <span style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 600 }}>Thu hộ tiền hàng (COD)</span>
            </div>
            <button
              onClick={() => setCodEnabled(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                background: codEnabled ? "#3ecf6e" : "rgba(255,255,255,0.1)", transition: "background 0.2s", position: "relative",
              }}>
              <div style={{
                position: "absolute", top: 3, left: codEnabled ? 22 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s",
              }} />
            </button>
          </div>
          {codEnabled && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Số tiền */}
              <div>
                <label style={lbl}>Số tiền thu hộ *</label>
                <input
                  value={codAmount}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, "")
                    setCodAmount(raw ? Number(raw).toLocaleString("vi-VN") : "")
                  }}
                  placeholder="0đ" inputMode="numeric"
                  style={{ ...inp, borderColor: "rgba(62,207,110,0.3)" }} />
                <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 5 }}>
                  Tài xế sẽ thu tiền của người nhận và trả lại cho quán sau khi giao thành công.
                </div>
              </div>

              {/* Upload QR chuyển khoản */}
              <div>
                <label style={lbl}>Mã QR nhận tiền (tùy chọn)</label>
                <input
                  ref={qrInputRef} type="file" accept="image/*"
                  style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleQrUpload(f) }}
                />

                {qrUrl ? (
                  /* Preview QR đã upload */
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ position: "relative", width: 90, height: 90, borderRadius: 10, overflow: "hidden", border: "2px solid rgba(62,207,110,0.4)", flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrUrl} alt="QR" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {/* Khung canh góc */}
                      {["topleft","topright","bottomleft","bottomright"].map(pos => (
                        <div key={pos} style={{
                          position: "absolute",
                          top:    pos.includes("top")    ? 4 : "auto",
                          bottom: pos.includes("bottom") ? 4 : "auto",
                          left:   pos.includes("left")   ? 4 : "auto",
                          right:  pos.includes("right")  ? 4 : "auto",
                          width: 12, height: 12,
                          borderTop:    pos.includes("top")    ? "2px solid #3ecf6e" : "none",
                          borderBottom: pos.includes("bottom") ? "2px solid #3ecf6e" : "none",
                          borderLeft:   pos.includes("left")   ? "2px solid #3ecf6e" : "none",
                          borderRight:  pos.includes("right")  ? "2px solid #3ecf6e" : "none",
                        }} />
                      ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#3ecf6e", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>✅ Đã upload QR</div>
                      <div style={{ color: "#6a5a40", fontSize: 11, lineHeight: 1.5 }}>Tài xế sẽ quét mã này để chuyển khoản hoặc trả tay</div>
                      <button onClick={() => qrInputRef.current?.click()}
                        style={{ marginTop: 6, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 10px", color: "#b0956a", fontSize: 11, fontFamily: "Lexend", cursor: "pointer" }}>
                        Đổi ảnh
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Nút upload + khung hướng dẫn */
                  <button
                    onClick={() => qrInputRef.current?.click()}
                    disabled={qrUploading}
                    style={{ width: "100%", background: "rgba(62,207,110,0.06)", border: "1.5px dashed rgba(62,207,110,0.3)", borderRadius: 12, padding: "16px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    {qrUploading ? (
                      <div style={{ color: "#3ecf6e", fontSize: 12 }}>Đang xử lý...</div>
                    ) : (
                      <>
                        {/* Khung vuông giả lập QR */}
                        <div style={{ position: "relative", width: 72, height: 72, border: "2px dashed rgba(62,207,110,0.5)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {["topleft","topright","bottomleft","bottomright"].map(pos => (
                            <div key={pos} style={{
                              position: "absolute",
                              top:    pos.includes("top")    ? -2 : "auto",
                              bottom: pos.includes("bottom") ? -2 : "auto",
                              left:   pos.includes("left")   ? -2 : "auto",
                              right:  pos.includes("right")  ? -2 : "auto",
                              width: 14, height: 14,
                              borderTop:    pos.includes("top")    ? "3px solid #3ecf6e" : "none",
                              borderBottom: pos.includes("bottom") ? "3px solid #3ecf6e" : "none",
                              borderLeft:   pos.includes("left")   ? "3px solid #3ecf6e" : "none",
                              borderRight:  pos.includes("right")  ? "3px solid #3ecf6e" : "none",
                              borderRadius: 2,
                            }} />
                          ))}
                          <span style={{ fontSize: 28 }}>📷</span>
                        </div>
                        <div style={{ color: "#3ecf6e", fontSize: 12, fontWeight: 600 }}>Upload ảnh QR chuyển khoản</div>
                        <div style={{ color: "#6a5a40", fontSize: 11, textAlign: "center" }}>
                          Canh mã QR vào khung vuông · Ảnh tự cắt về hình vuông
                        </div>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Ghi chú */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <StickyNote size={15} color="#6a5a40" />
            <span style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 600 }}>Ghi chú cho tài xế</span>
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="VD: Gọi trước 5 phút, hàng dễ vỡ..."
            rows={2} style={{ ...inp, resize: "none" }} />
        </div>

        {/* Tổng phí */}
        <div style={{ background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: codValue > 0 ? 8 : 0 }}>
            <span style={{ color: "#b0956a", fontSize: 13 }}>Phí giao hàng</span>
            <span style={{ color: "#FF8C00", fontWeight: 700, fontSize: 15 }}>
              {calcingDist ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : fmt(serviceFee)}
            </span>
          </div>
          {codValue > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#b0956a", fontSize: 13 }}>Thu hộ</span>
              <span style={{ color: "#3ecf6e", fontWeight: 600, fontSize: 14 }}>{fmt(codValue)}</span>
            </div>
          )}
          {distanceKm && (
            <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 6 }}>
              Khoảng cách: {distanceKm} km {weight !== "nhe" ? `· Phụ phí nặng: ${fmt(weightSurcharge)}` : ""}
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px 28px", background: "rgba(8,8,6,0.96)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(255,107,0,0.15)" }}>
        <button
          onClick={handleSubmit} disabled={loading}
          style={{
            width: "100%", height: 50, borderRadius: 14, border: "none", cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "rgba(255,107,0,0.4)" : "linear-gradient(135deg,#FF6B00,#FF8C00)",
            color: "#fff", fontFamily: "Lexend", fontWeight: 700, fontSize: 15,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 4px 20px rgba(255,107,0,0.3)",
          }}>
          {loading ? <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Đang xử lý...</> : "🛵 Tạo đơn giao hộ"}
        </button>
      </div>

      {/* Address Picker Modal */}
      <AnimatePresence>
        {showAddrPicker && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "#080806" }}>
            <AddressPicker
              onConfirm={handleAddrPick}
              onClose={() => setShowAddrPicker(false)}
              initialLat={shopLat} initialLng={shopLng}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            style={{ position: "fixed", bottom: 90, left: 16, right: 16, background: "rgba(20,15,8,0.97)", border: "1px solid rgba(255,107,0,0.3)", borderRadius: 12, padding: "12px 16px", color: "#f8f0e0", fontSize: 13, fontFamily: "Lexend", zIndex: 200, textAlign: "center" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
