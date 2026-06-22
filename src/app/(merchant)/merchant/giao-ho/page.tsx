"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Package, MapPin, User, Phone, StickyNote, CheckCircle2, Loader2 } from "lucide-react"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import { createClient } from "@/lib/supabase/client"
import { getRouteKm, calcDeliveryFeeFromPricing } from "@/lib/vietmapRoute"
import AddressPicker from "@/components/map/AddressPicker"
import type { AddressPickerResult } from "@/types"

const BANKS = [
  { bin: "970436", name: "Vietcombank (VCB)" },
  { bin: "970415", name: "VietinBank (CTG)" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970407", name: "Techcombank (TCB)" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970416", name: "ACB" },
  { bin: "970403", name: "Sacombank (STB)" },
  { bin: "970423", name: "TPBank" },
  { bin: "970432", name: "VPBank" },
  { bin: "970443", name: "SHB" },
  { bin: "970437", name: "HDBank" },
  { bin: "970448", name: "OCB" },
  { bin: "970426", name: "MSB" },
  { bin: "970449", name: "LienVietPostBank" },
  { bin: "970431", name: "Eximbank" },
  { bin: "970428", name: "Nam A Bank" },
  { bin: "970440", name: "SeABank" },
]

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
  const [bankBin,     setBankBin]     = useState("")
  const [bankName,    setBankName]    = useState("")
  const [bankAccount, setBankAccount] = useState("")
  const [bankHolder,  setBankHolder]  = useState("")
  const [qrUrl,       setQrUrl]       = useState<string | null>(null)
  const [qrUploading, setQrUploading] = useState(false)
  const [qrDecoding,  setQrDecoding]  = useState(false)
  const [cropSrc,     setCropSrc]     = useState<string | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const [crop,        setCrop]        = useState({ x: 0, y: 0 })
  const [zoom,        setZoom]        = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
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

  // Crop ảnh từ croppedAreaPixels (react-easy-crop)
  const getCroppedBlob = (imageSrc: string, pixels: Area): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = 400; canvas.height = 400
        canvas.getContext("2d")!.drawImage(img, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, 400, 400)
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("crop failed")), "image/webp", 0.92)
      }
      img.onerror = reject
      img.src = imageSrc
    })

  // Parse chuỗi VietQR/EMVCo → {bin, account, holder}
  const parseVietQR = (data: string): { bin?: string; account?: string; holder?: string } => {
    const result: { bin?: string; account?: string; holder?: string } = {}
    let i = 0
    while (i + 4 <= data.length) {
      const tag = data.slice(i, i + 2)
      const len = parseInt(data.slice(i + 2, i + 4), 10)
      if (isNaN(len) || i + 4 + len > data.length) break
      const val = data.slice(i + 4, i + 4 + len)
      if (tag === "38") {
        // NAPAS sub-fields: 01=BIN, 02=account
        let j = 0
        while (j + 4 <= val.length) {
          const st = val.slice(j, j + 2)
          const sl = parseInt(val.slice(j + 2, j + 4), 10)
          if (isNaN(sl)) break
          const sv = val.slice(j + 4, j + 4 + sl)
          if (st === "01") result.bin = sv
          if (st === "02") result.account = sv
          j += 4 + sl
        }
      }
      if (tag === "59") result.holder = val
      i += 4 + len
    }
    return result
  }

  // Decode QR từ blob → parse VietQR
  const decodeQRFromBlob = async (blob: Blob): Promise<{ bin?: string; account?: string; holder?: string } | null> => {
    try {
      const jsQR = (await import("jsqr")).default
      const img  = new Image()
      const url  = URL.createObjectURL(blob)
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url })
      const canvas = document.createElement("canvas")
      canvas.width = img.width; canvas.height = img.height
      canvas.getContext("2d")!.drawImage(img, 0, 0)
      const d = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const qr = jsQR(d.data, d.width, d.height)
      return qr ? parseVietQR(qr.data) : null
    } catch { return null }
  }

  // Mở file → hiện cropper
  const handleFileSelect = (file: File) => {
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
    setShowCropper(true)
  }

  const onCropComplete = useCallback((_: Area, pixels: Area) => { setCroppedArea(pixels) }, [])

  // Xác nhận crop → upload → decode QR → auto-fill
  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedArea || !shopId) return
    setShowCropper(false)
    setQrUploading(true)
    try {
      const blob = await getCroppedBlob(cropSrc, croppedArea)
      const path = `${shopId}/payment-qr`
      const { error } = await supabase.storage.from("shops").upload(path, blob, { upsert: true, contentType: "image/webp" })
      if (error) { fireToast("❌ Lỗi upload QR: " + error.message); return }
      const { data: { publicUrl } } = supabase.storage.from("shops").getPublicUrl(path)
      setQrUrl(`${publicUrl}?t=${Date.now()}`)

      // Decode QR → auto-fill bank fields
      setQrDecoding(true)
      const info = await decodeQRFromBlob(blob)
      setQrDecoding(false)
      if (info?.bin) {
        const bank = BANKS.find(b => b.bin === info.bin)
        setBankBin(info.bin)
        setBankName(bank?.name ?? info.bin)
      }
      if (info?.account) setBankAccount(info.account)
      if (info?.holder)  setBankHolder(info.holder)
      if (info?.bin && info?.account) {
        fireToast("✅ Đọc QR thành công — đã điền thông tin tài khoản")
      }
    } finally {
      setQrUploading(false)
      setQrDecoding(false)
      URL.revokeObjectURL(cropSrc)
      setCropSrc(null)
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
        note: [
          bankAccount ? `__BANK__:${JSON.stringify({ bin: bankBin, name: bankName, account: bankAccount, holder: bankHolder })}` : "",
          `Quán: ${shopName}`,
          note ? `Ghi chú: ${note}` : "",
        ].filter(Boolean).join("\n") || null,
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
            onClick={() => { setSuccess(false); setRecipientName(""); setRecipientPhone(""); setDelivery(""); setDeliveryCoord(null); setPkgDesc(""); setNote(""); setCodEnabled(false); setCodAmount(""); setBankAccount(""); setBankBin(""); setBankName(""); setBankHolder(""); setQrUrl(null) }}
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

              {/* ── Số tiền ── */}
              <div>
                <label style={lbl}>Số tiền thu hộ *</label>
                <input value={codAmount}
                  onChange={e => { const r = e.target.value.replace(/\D/g, ""); setCodAmount(r ? Number(r).toLocaleString("vi-VN") : "") }}
                  placeholder="0đ" inputMode="numeric"
                  style={{ ...inp, borderColor: "rgba(62,207,110,0.3)" }} />
                <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 5 }}>
                  Tài xế sẽ thu tiền của người nhận và trả lại cho quán sau khi giao thành công.
                </div>
              </div>

              {/* ── QR Upload — ĐẦU TIÊN ── */}
              <div>
                <label style={lbl}>Upload mã QR nhận tiền</label>
                {/* Note tự điền */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(74,143,245,0.07)", border: "1px solid rgba(74,143,245,0.2)", borderRadius: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 14 }}>💡</span>
                  <span style={{ color: "#4a8ff5", fontSize: 11, lineHeight: 1.5 }}>
                    Upload QR ngân hàng — app sẽ <b>tự đọc và điền</b> số tài khoản, tên chủ tài khoản bên dưới, không cần nhập tay.
                  </span>
                </div>

                <input ref={qrInputRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = "" }} />

                {qrUrl ? (
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ position: "relative", width: 90, height: 90, borderRadius: 10, overflow: "hidden", border: "2px solid rgba(62,207,110,0.4)", flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrUrl} alt="QR" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {["tl","tr","bl","br"].map(p => (
                        <div key={p} style={{ position:"absolute", top:p[0]==="t"?4:"auto", bottom:p[0]==="b"?4:"auto", left:p[1]==="l"?4:"auto", right:p[1]==="r"?4:"auto", width:12, height:12,
                          borderTop:p[0]==="t"?"2px solid #3ecf6e":"none", borderBottom:p[0]==="b"?"2px solid #3ecf6e":"none",
                          borderLeft:p[1]==="l"?"2px solid #3ecf6e":"none", borderRight:p[1]==="r"?"2px solid #3ecf6e":"none" }} />
                      ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      {qrDecoding
                        ? <div style={{ color: "#4a8ff5", fontSize: 12 }}>🔍 Đang đọc QR...</div>
                        : <div style={{ color: "#3ecf6e", fontSize: 12, fontWeight: 600 }}>✅ Đã upload QR</div>
                      }
                      <button onClick={() => qrInputRef.current?.click()}
                        style={{ marginTop: 6, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 10px", color: "#b0956a", fontSize: 11, fontFamily: "Lexend", cursor: "pointer" }}>
                        Đổi ảnh
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => qrInputRef.current?.click()} disabled={qrUploading}
                    style={{ width: "100%", background: "rgba(62,207,110,0.06)", border: "1.5px dashed rgba(62,207,110,0.3)", borderRadius: 12, padding: "16px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    {qrUploading
                      ? <div style={{ color: "#3ecf6e", fontSize: 12 }}>Đang xử lý...</div>
                      : <>
                          <div style={{ position: "relative", width: 72, height: 72, border: "2px dashed rgba(62,207,110,0.5)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {["tl","tr","bl","br"].map(p => (
                              <div key={p} style={{ position:"absolute", top:p[0]==="t"?-2:"auto", bottom:p[0]==="b"?-2:"auto", left:p[1]==="l"?-2:"auto", right:p[1]==="r"?-2:"auto", width:14, height:14, borderRadius:2,
                                borderTop:p[0]==="t"?"3px solid #3ecf6e":"none", borderBottom:p[0]==="b"?"3px solid #3ecf6e":"none",
                                borderLeft:p[1]==="l"?"3px solid #3ecf6e":"none", borderRight:p[1]==="r"?"3px solid #3ecf6e":"none" }} />
                            ))}
                            <span style={{ fontSize: 28 }}>📷</span>
                          </div>
                          <div style={{ color: "#3ecf6e", fontSize: 12, fontWeight: 600 }}>Chụp / chọn ảnh QR ngân hàng</div>
                          <div style={{ color: "#6a5a40", fontSize: 11, textAlign: "center" }}>Kéo, zoom để căn QR vào đúng khung · App tự đọc và điền thông tin</div>
                        </>
                    }
                  </button>
                )}
              </div>

              {/* ── Thông tin tài khoản — CÓ THỂ TỰ NHẬP — */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                <label style={lbl}>Thông tin tài khoản nhận tiền</label>
                <div style={{ color: "#6a5a40", fontSize: 11, marginBottom: 8 }}>
                  Tự động điền từ QR ở trên · Hoặc nhập tay nếu muốn
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <select value={bankBin}
                    onChange={e => { const o = e.target.options[e.target.selectedIndex]; setBankBin(e.target.value); setBankName(o.text) }}
                    style={{ ...inp, borderColor: bankBin ? "rgba(62,207,110,0.3)" : "rgba(255,255,255,0.1)", appearance: "none",
                      backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236a5a40' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E\")",
                      backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center" }}>
                    <option value="">-- Chọn ngân hàng --</option>
                    {BANKS.map(b => <option key={b.bin} value={b.bin}>{b.name}</option>)}
                  </select>
                  <input value={bankAccount} onChange={e => setBankAccount(e.target.value.replace(/\D/g, ""))}
                    placeholder="Số tài khoản" inputMode="numeric"
                    style={{ ...inp, borderColor: bankAccount ? "rgba(62,207,110,0.3)" : "rgba(255,255,255,0.1)" }} />
                  <input value={bankHolder} onChange={e => setBankHolder(e.target.value.toUpperCase())}
                    placeholder="TÊN CHỦ TÀI KHOẢN (IN HOA)"
                    style={{ ...inp, borderColor: bankHolder ? "rgba(62,207,110,0.3)" : "rgba(255,255,255,0.1)" }} />
                </div>
                {bankBin && bankAccount && (
                  <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(62,207,110,0.08)", borderRadius: 8, color: "#3ecf6e", fontSize: 11 }}>
                    ✅ Tài xế sẽ bấm "Chuyển khoản ngay" → mở thẳng app ngân hàng, điền sẵn {fmt(codValue || 0)}
                  </div>
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

      {/* ── Cropper Modal ── */}
      <AnimatePresence>
        {showCropper && cropSrc && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(8,8,6,0.9)", borderBottom: "1px solid rgba(255,107,0,0.2)", flexShrink: 0 }}>
              <button onClick={() => { setShowCropper(false); URL.revokeObjectURL(cropSrc); setCropSrc(null) }}
                style={{ background: "none", border: "none", color: "#b0956a", fontSize: 13, fontFamily: "Lexend", cursor: "pointer" }}>
                ✕ Huỷ
              </button>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 700 }}>Căn mã QR vào khung</div>
                <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 2 }}>Kéo để di chuyển · Pinch/scroll để zoom</div>
              </div>
              <button onClick={handleCropConfirm}
                style={{ background: "linear-gradient(135deg,#FF6B00,#FF8C00)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 13, fontFamily: "Lexend", fontWeight: 700, cursor: "pointer" }}>
                Dùng ảnh
              </button>
            </div>

            {/* Cropper area */}
            <div style={{ position: "relative", flex: 1 }}>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid={true}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: { background: "#000" },
                  cropAreaStyle: { border: "2px solid #3ecf6e", boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)" },
                }}
              />
            </div>

            {/* Zoom slider */}
            <div style={{ padding: "14px 24px", background: "rgba(8,8,6,0.9)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <span style={{ color: "#6a5a40", fontSize: 12 }}>🔍</span>
              <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#FF6B00" }} />
              <span style={{ color: "#6a5a40", fontSize: 12 }}>🔍+</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
