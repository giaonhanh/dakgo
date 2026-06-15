"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

type SettingSection = "pricing" | "commission" | "area" | "services" | "features" | "account" | "maintenance"
type ServiceType    = "food" | "delivery_pkg" | "errand" | "motorbike" | "taxi" | "taxi7"

interface ToggleSetting { key: string; label: string; description: string; value: boolean }
interface SvcToggle { key: string; label: string; icon: string; color: string; enabled: boolean; reason: string; customerMsg: string }

const SERVICE_PRESETS: Record<string, { label: string; msg: string }[]> = {
  motorbike: [
    { label:"Tài xế bận hết",  msg:"Hiện không có tài xế xe ôm khả dụng trong khu vực. Vui lòng thử lại sau ít phút." },
    { label:"Quá tải đơn",     msg:"Dịch vụ xe ôm đang quá tải, tạm ngưng nhận đơn mới. Xin lỗi vì sự bất tiện." },
    { label:"Ngoài giờ",       msg:"Dịch vụ xe ôm hoạt động từ 07:00 – 21:00. Vui lòng quay lại trong giờ phục vụ." },
    { label:"Bảo trì",         msg:"Dịch vụ xe ôm đang bảo trì, sẽ hoạt động trở lại sớm." },
    { label:"Tạm nghỉ",        msg:"Dịch vụ xe ôm tạm ngừng phục vụ. Xin lỗi vì sự bất tiện." },
  ],
  taxi_4cho: [
    { label:"Tài xế bận hết",  msg:"Toàn bộ tài xế taxi 4 chỗ đang bận. Vui lòng thử lại sau hoặc chọn xe 7 chỗ." },
    { label:"Quá tải đơn",     msg:"Dịch vụ taxi 4 chỗ đang quá tải, tạm ngưng nhận đơn mới." },
    { label:"Không có xe",     msg:"Không có xe taxi 4 chỗ khả dụng trong khu vực lúc này." },
    { label:"Ngoài giờ",       msg:"Dịch vụ taxi 4 chỗ hoạt động từ 07:00 – 21:00." },
    { label:"Bảo trì",         msg:"Dịch vụ taxi 4 chỗ đang bảo trì, sẽ hoạt động trở lại sớm." },
  ],
  taxi_7cho: [
    { label:"Tài xế bận hết",  msg:"Toàn bộ xe 7 chỗ đang bận. Vui lòng thử lại sau ít phút." },
    { label:"Quá tải đơn",     msg:"Dịch vụ taxi 7 chỗ đang quá tải, tạm ngưng nhận đơn mới." },
    { label:"Không có xe",     msg:"Không có xe 7 chỗ khả dụng trong khu vực lúc này." },
    { label:"Ngoài giờ",       msg:"Dịch vụ taxi 7 chỗ hoạt động từ 07:00 – 21:00." },
    { label:"Bảo trì",         msg:"Dịch vụ taxi 7 chỗ đang bảo trì, sẽ hoạt động trở lại sớm." },
  ],
  mua_ho: [
    { label:"Tài xế bận hết",  msg:"Tất cả tài xế đang bận, không nhận đơn mua hộ lúc này. Vui lòng thử lại sau." },
    { label:"Quá tải đơn",     msg:"Dịch vụ mua hộ đang quá tải, tạm ngưng nhận đơn mới." },
    { label:"Chợ đóng cửa",    msg:"Chợ và siêu thị trong khu vực đã đóng cửa. Vui lòng đặt lại vào sáng sớm." },
    { label:"Ngoài giờ",       msg:"Dịch vụ mua hộ hoạt động từ 07:00 – 21:00." },
    { label:"Tạm nghỉ",        msg:"Dịch vụ mua hộ tạm ngừng phục vụ hôm nay. Xin lỗi vì sự bất tiện." },
  ],
  giao_ho: [
    { label:"Tài xế bận hết",  msg:"Tất cả tài xế đang bận, không nhận đơn giao hộ lúc này. Vui lòng thử lại sau." },
    { label:"Quá tải đơn",     msg:"Dịch vụ giao hộ đang quá tải, tạm ngưng nhận đơn mới." },
    { label:"Ngoài khu vực",   msg:"Khu vực giao nhận hiện không được hỗ trợ. Vui lòng thử lại sau." },
    { label:"Ngoài giờ",       msg:"Dịch vụ giao hộ hoạt động từ 07:00 – 21:00." },
    { label:"Tạm nghỉ",        msg:"Dịch vụ giao hộ tạm ngừng phục vụ hôm nay. Xin lỗi vì sự bất tiện." },
  ],
}

export default function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingSection>("pricing")
  const [activeService, setActiveService]  = useState<ServiceType>("food")
  const [saved, setSaved]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  /* ── Account (real data from Supabase) ── */
  const [adminId,          setAdminId]          = useState("")
  const [adminName,        setAdminName]        = useState("")
  const [adminEmail,       setAdminEmail]       = useState("")
  const [adminPhone,       setAdminPhone]       = useState("")
  const [adminContactLink, setAdminContactLink] = useState("")
  const [curPw, setCurPw]  = useState("")
  const [newPw, setNewPw]  = useState("")
  const [cfmPw, setCfmPw]  = useState("")
  const [pwMsg, setPwMsg]  = useState("")

  /* ── Admin wallet ── */
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [walletId,      setWalletId]      = useState<string | null>(null)
  const [topupAmt,      setTopupAmt]      = useState("2000000")
  const [topupSaving,   setTopupSaving]   = useState(false)
  const [topupMsg,      setTopupMsg]      = useState("")

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    async function loadAccount() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setAdminId(user.id)
      setAdminEmail(user.email ?? "")

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle()

      setAdminName(prof?.full_name ?? "")
      setAdminPhone(prof?.phone ?? "")
      setAdminContactLink(localStorage.getItem("admin_contact_link") ?? "")

      // Load wallet
      const { data: wallet } = await supabase
        .from("wallets").select("id,balance").eq("user_id", user.id).eq("type", "customer").maybeSingle()
      setWalletBalance(wallet?.balance ?? 0)
      setWalletId(wallet?.id ?? null)
    }
    loadAccount()
  }, [])

  /* ── Pricing ── */
  const [pricing, setPricing] = useState<Record<ServiceType, { rows: string[]; extra: string; weightMid?: string; weightHeavy?: string }>>({
    food:         { rows: ["15000","12000","10000","9000","8000","7500","7000","6500","6000","5500"], extra: "5000" },
    delivery_pkg: { rows: ["18000","15000","12000","10000","9000","8500","8000","7500","7000","6500"], extra: "6000", weightMid: "5000", weightHeavy: "10000" },
    errand:       { rows: ["20000","17000","14000","12000","11000","10000","9000","8500","8000","7500"], extra: "7000", weightMid: "5000", weightHeavy: "10000" },
    motorbike:    { rows: ["10000","8000","7000","6500","6000","5500","5000","4800","4600","4500"],    extra: "4000" },
    taxi:         { rows: ["15000","13000","11000","10000","9500","9000","8500","8000","7500","7000"], extra: "6500" },
    taxi7:        { rows: ["20000","17000","14000","12000","11000","10000","9500","9000","8500","8000"], extra: "7500" },
  })

  const SERVICE_META: Record<ServiceType, { label: string; icon: string; color: string; desc: string }> = {
    food:         { label: "Giao đồ ăn",  icon: "🍜", color: "#FF6B00", desc: "Giao thức ăn từ cửa hàng đến khách" },
    delivery_pkg: { label: "Giao hàng",   icon: "📦", color: "#4a8ff5", desc: "Giao bưu kiện, hàng hóa thông thường" },
    errand:       { label: "Mua hộ",      icon: "🛒", color: "#3ecf6e", desc: "Tài xế mua hàng theo yêu cầu và giao" },
    motorbike:    { label: "Xe ôm",      icon: "🏍️", color: "#b464ff", desc: "Đặt xe ôm di chuyển cá nhân" },
    taxi:         { label: "Taxi 4 chỗ", icon: "🚕", color: "#f5c542", desc: "Đặt taxi Sedan 4 chỗ" },
    taxi7:        { label: "Taxi 7 chỗ", icon: "🚙", color: "#3ecf6e", desc: "Đặt taxi SUV / 7 chỗ" },
  }

  const updateKmPrice = (service: ServiceType, kmIndex: number, value: string) =>
    setPricing(p => ({ ...p, [service]: { ...p[service], rows: p[service].rows.map((r, i) => i === kmIndex ? value : r) } }))

  const calcExampleFare = (service: ServiceType, distKm: number): number => {
    const { rows, extra } = pricing[service]
    let total = 0
    for (let i = 0; i < Math.min(distKm, 10); i++) {
      let price = 0
      for (let j = i; j >= 0; j--) {
        if (rows[j] && rows[j] !== "") { price = parseInt(rows[j]) || 0; break }
      }
      total += price
    }
    if (distKm > 10) total += (distKm - 10) * (parseInt(extra) || 0)
    return total
  }

  /* ── Taxi-specific pricing ── */
  interface TaxiVehicle { baseFare: number; perKm: number; perKmOver30: number; commissionRate: number }
  interface TaxiRoute   { id: string; from: string; to: string; oneWay: number; twoWay: number; note: string }
  const [taxiCfg, setTaxiCfg] = useState<{ taxi4: TaxiVehicle; taxi7: TaxiVehicle }>({
    taxi4: { baseFare: 15000, perKm: 12000, perKmOver30: 10000, commissionRate: 10 },
    taxi7: { baseFare: 20000, perKm: 15000, perKmOver30: 12000, commissionRate: 10 },
  })
  const [taxiRoutes, setTaxiRoutes] = useState<TaxiRoute[]>([
    { id: "1", from: "Phước An", to: "BMT (Buôn Ma Thuột)", oneWay: 300000, twoWay: 400000, note: "" },
  ])
  const [taxiWaiting, setTaxiWaiting] = useState({ freeMinutes: 90, extraHourFee: 50000, doubleAfterHours: 3 })

  /* ── Per-service: giờ hoạt động + đêm khuya + thời tiết xấu ── */
  interface SvcTime {
    hours:   { open: string; close: string; allDay: boolean }
    night:   { enabled: boolean; start: string; end: string; type: "percent"|"per_km"|"flat"; value: number }
    weather: { enabled: boolean; type: "percent"|"fixed"; value: number }
  }
  const SVC_TIME_DEFAULT: SvcTime = {
    hours:   { open: "07:00", close: "21:00", allDay: false },
    night:   { enabled: false, start: "22:00", end: "05:00", type: "percent", value: 20 },
    weather: { enabled: false, type: "percent", value: 20 },
  }
  const [svcTime, setSvcTimeState] = useState<Record<string, SvcTime>>({
    food:         { ...SVC_TIME_DEFAULT },
    delivery_pkg: { ...SVC_TIME_DEFAULT },
    errand:       { ...SVC_TIME_DEFAULT },
    motorbike:    { ...SVC_TIME_DEFAULT, hours: { open: "06:00", close: "21:00", allDay: false } },
    taxi:         { ...SVC_TIME_DEFAULT, hours: { open: "00:00", close: "23:59", allDay: true } },
    taxi7:        { ...SVC_TIME_DEFAULT, hours: { open: "00:00", close: "23:59", allDay: true } },
  })
  const setSvcTime = (svc: string, field: keyof SvcTime, val: Partial<SvcTime[keyof SvcTime]>) =>
    setSvcTimeState(p => ({ ...p, [svc]: { ...p[svc], [field]: { ...(p[svc]?.[field] as object), ...val } } }))

  // service toggle key → svcTime key
  const SVC_TOGGLE_TO_TIME_KEY: Record<string, string> = {
    motorbike: "motorbike", taxi_4cho: "taxi", taxi_7cho: "taxi7",
    mua_ho: "errand", giao_ho: "delivery_pkg",
  }
  const isInHoursNow = (svcKey: string): boolean => {
    const t = svcTime[svcKey]
    if (!t) return true
    const { allDay, open, close } = t.hours
    if (allDay) return true
    const now = new Date()
    const vnMin = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes()
    const [oh, om] = open.split(":").map(Number)
    const [ch, cm] = close.split(":").map(Number)
    const oMin = (oh ?? 0) * 60 + (om ?? 0)
    const cMin = (ch ?? 0) * 60 + (cm ?? 0)
    return oMin <= cMin ? vnMin >= oMin && vnMin < cMin : vnMin >= oMin || vnMin < cMin
  }

  const calcTaxiFare = (v: TaxiVehicle, km: number, night: SvcTime["night"]): number => {
    const base = Math.min(km - 1, 29)
    const over = Math.max(0, km - 30)
    let total = v.baseFare + base * v.perKm + over * (v.perKmOver30 ?? v.perKm)
    if (night.enabled) {
      if (night.type === "percent") total = Math.round(total * (1 + night.value / 100))
      else if (night.type === "per_km") total = total + km * night.value
      else total = total + night.value
    }
    return Math.round(total / 1000) * 1000
  }

  /* ── Delivery adjustments ── */
  const [deliverySettings, setDeliverySettings] = useState({
    maxRadius: "10", rushHourMultiplier: "1.3", rainMultiplier: "1.2", minDriverRating: "4.0",
  })

  /* ── Load all settings from Supabase on mount ── */
  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient()
      const { data } = await supabase.from("app_settings").select("key, value")
      if (!data) return
      const map = Object.fromEntries(data.map(r => [r.key, r.value]))
      if (map.pricing)          setPricing(prev => ({ ...prev, ...(map.pricing as typeof prev) }))
      if (map.commission) {
        const c = map.commission as Record<string, unknown>
        setCommissionSettings(prev => ({
          ...prev,
          // Legacy fields
          ...(typeof c.defaultRate === "string"          ? { defaultRate:          c.defaultRate }          : {}),
          ...(typeof c.minRate === "string"              ? { minRate:              c.minRate }              : {}),
          ...(typeof c.maxRate === "string"              ? { maxRate:              c.maxRate }              : {}),
          ...(typeof c.driverSharePercent === "string"   ? { driverSharePercent:   c.driverSharePercent }   : {}),
          ...(typeof c.platformSharePercent === "string" ? { platformSharePercent: c.platformSharePercent } : {}),
          ...(typeof c.loyaltyPointsRate === "string"    ? { loyaltyPointsRate:    c.loyaltyPointsRate }    : {}),
          // Hoa hồng thực tế (dùng bởi SQL functions)
          ...(c.driver_rate !== undefined ? { driverRate: String(c.driver_rate) } : {}),
          ...(c.shop_rate   !== undefined ? { shopRate:   String(c.shop_rate)   } : {}),
        }))
      }
      if (map.features) {
        const f = map.features as Record<string, boolean>
        setFeatures(prev => prev.map(item => ({ ...item, value: f[item.key] ?? item.value })))
      }
      if (map.service_toggles) {
        const st = map.service_toggles as Record<string, { enabled?: boolean; reason?: string; customerMsg?: string }>
        setServiceToggles(prev => prev.map(item => {
          const saved = st[item.key]
          if (!saved) return item
          return { ...item, enabled: saved.enabled ?? true, reason: saved.reason ?? "", customerMsg: saved.customerMsg ?? "" }
        }))
      }
      if (map.area)             setAreaSettings(map.area)
      if (map.delivery)         setDeliverySettings(map.delivery)
      if (map.taxi_pricing) {
        const tp = map.taxi_pricing as Record<string, unknown>
        if (tp.taxi4)       setTaxiCfg(p => ({ ...p, taxi4: tp.taxi4 as TaxiVehicle }))
        if (tp.taxi7)       setTaxiCfg(p => ({ ...p, taxi7: tp.taxi7 as TaxiVehicle }))
        if (tp.fixedRoutes) setTaxiRoutes(tp.fixedRoutes as TaxiRoute[])
        if (tp.waiting)     setTaxiWaiting(tp.waiting as typeof taxiWaiting)
        // migrate old taxiNight into svcTime
        if (tp.nightSurcharge) setSvcTimeState(p => ({ ...p, taxi: { ...p.taxi, night: tp.nightSurcharge as SvcTime["night"] }, taxi7: { ...p.taxi7, night: tp.nightSurcharge as SvcTime["night"] } }))
      }
      if (map.service_time_pricing) {
        setSvcTimeState(p => ({ ...p, ...(map.service_time_pricing as Record<string, SvcTime>) }))
      } else {
        // migrate legacy service_hours
        if (map.service_hours) {
          const sh = map.service_hours as Record<string, { open:string; close:string; allDay:boolean }>
          setSvcTimeState(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, sh[k] ? { ...v, hours: sh[k] } : v])))
        }
      }
    }
    loadSettings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Commission ── */
  const [commissionSettings, setCommissionSettings] = useState({
    defaultRate: "15", minRate: "10", maxRate: "25",
    driverSharePercent: "80", platformSharePercent: "20", loyaltyPointsRate: "1",
    // Hoa hồng thực tế đọc/ghi bởi SQL functions (get_driver_commission_rate, get_shop_commission_rate)
    driverRate: "15", shopRate: "15",
  })
  const [applyingCommission, setApplyingCommission] = useState(false)
  const [applyCommissionMsg, setApplyCommissionMsg] = useState("")

  const handleApplyCommissionToAllShops = async () => {
    const rate = parseInt(commissionSettings.defaultRate)
    if (!rate || rate <= 0 || rate > 100) { setApplyCommissionMsg("⚠️ Tỉ lệ không hợp lệ"); return }
    setApplyingCommission(true); setApplyCommissionMsg("")
    const supabase = createClient()
    const { data: updatedShops, error } = await supabase.from("shops")
      .update({ commission_rate: rate, updated_at: new Date().toISOString() })
      .eq("status", "approved")
      .eq("is_negotiated_commission", false)
      .select("id")
    const count = updatedShops?.length ?? 0
    if (error) {
      setApplyCommissionMsg("❌ Lỗi: " + error.message)
    } else {
      setApplyCommissionMsg(`✅ Đã cập nhật ${count} cửa hàng → ${rate}%`)
    }
    setApplyingCommission(false)
    setTimeout(() => setApplyCommissionMsg(""), 5000)
  }

  /* ── Service Toggles ── */
  const [serviceToggles, setServiceToggles] = useState<SvcToggle[]>([
    { key:"motorbike", label:"Xe ôm",      icon:"🛵", color:"#4a8ff5", enabled:true, reason:"", customerMsg:"" },
    { key:"taxi_4cho", label:"Taxi 4 chỗ", icon:"🚕", color:"#FF8C00", enabled:true, reason:"", customerMsg:"" },
    { key:"taxi_7cho", label:"Taxi 7 chỗ", icon:"🚙", color:"#b464ff", enabled:true, reason:"", customerMsg:"" },
    { key:"mua_ho",    label:"Mua hộ",     icon:"🛒", color:"#3ecf6e", enabled:true, reason:"", customerMsg:"" },
    { key:"giao_ho",   label:"Giao hộ",    icon:"📦", color:"#FFB347", enabled:true, reason:"", customerMsg:"" },
  ])

  const toggleService = (key: string) =>
    setServiceToggles(p => p.map(s => s.key === key
      ? s.enabled
        ? { ...s, enabled: false, reason: "", customerMsg: "" }  // tắt → chờ chọn lý do
        : { ...s, enabled: true,  reason: "", customerMsg: "" }  // bật → xóa lý do
      : s
    ))

  const setServiceReason = (key: string, label: string, msg: string) =>
    setServiceToggles(p => p.map(s => s.key === key ? { ...s, reason: label, customerMsg: msg } : s))

  /* ── Features ── */
  const [features, setFeatures] = useState<ToggleSetting[]>([
    { key:"maintenance_mode",  label:"Chế độ bảo trì",          description:"Tắt ứng dụng với khách hàng, chỉ admin có thể vào",              value:false },
    { key:"new_user_register", label:"Cho đăng ký mới",          description:"Cho phép khách hàng mới đăng ký tài khoản",                      value:true  },
    { key:"driver_register",   label:"Tuyển tài xế mới",         description:"Cho phép tài xế nộp đơn đăng ký",                                value:true  },
    { key:"merchant_register", label:"Tuyển merchant mới",       description:"Cho phép cửa hàng đăng ký tham gia",                              value:true  },
    { key:"flash_sale",        label:"Flash Sale",                description:"Bật tính năng Flash Sale trên trang chủ",                         value:true  },
    { key:"loyalty_program",   label:"Chương trình tích điểm",   description:"Khách hàng tích điểm từ mỗi đơn hàng",                           value:true  },
    { key:"surge_pricing",     label:"Giá tăng theo nhu cầu",    description:"Tự động tăng phí ship khi nhu cầu cao hoặc trời mưa",            value:false },
    { key:"wallet_topup",      label:"Nạp ví điện tử",           description:"Cho phép nạp tiền vào ví qua VietQR / MoMo",                    value:false },
  ])

  /* ── Area ── */
  const [areaSettings, setAreaSettings] = useState({
    centerLat: "12.6521", centerLng: "108.5073",
    serviceName: "Phước An, Krông Pắc, Đắk Lắk",
    coverageRadius: "10", timezone: "Asia/Ho_Chi_Minh",
  })

  const toggleFeature = (key: string) =>
    setFeatures(p => p.map(f => f.key === key ? { ...f, value: !f.value } : f))

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = createClient()

      // Persist profile
      if (adminId) {
        await supabase.from("profiles")
          .update({ full_name: adminName, phone: adminPhone })
          .eq("id", adminId)
      }
      if (adminContactLink) localStorage.setItem("admin_contact_link", adminContactLink)
      else localStorage.removeItem("admin_contact_link")

      // Persist all app settings to Supabase
      const featuresMap      = Object.fromEntries(features.map(f => [f.key, f.value]))
      const serviceToggleMap = Object.fromEntries(serviceToggles.map(s => [s.key, { enabled: s.enabled, reason: s.reason, customerMsg: s.customerMsg }]))
      const upsertRows = [
        { key: "pricing",           value: pricing },
        { key: "commission",        value: {
          ...commissionSettings,
          // Đảm bảo SQL functions đọc được đúng key
          driver_rate: parseFloat(commissionSettings.driverRate) || 15,
          shop_rate:   parseFloat(commissionSettings.shopRate)   || 15,
        }},
        { key: "features",          value: featuresMap },
        { key: "service_toggles",   value: serviceToggleMap },
        { key: "area",              value: areaSettings },
        { key: "delivery",          value: deliverySettings },
        { key: "taxi_pricing",          value: { taxi4: taxiCfg.taxi4, taxi7: taxiCfg.taxi7, fixedRoutes: taxiRoutes, waiting: taxiWaiting } },
        { key: "service_time_pricing",  value: svcTime },
      ]
      const { error: saveErr } = await supabase.from("app_settings")
        .upsert(upsertRows.map(r => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "key" })

      if (saveErr) {
        alert(`Lỗi lưu cài đặt: ${saveErr.message}`)
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePw = async () => {
    setPwMsg("")
    if (!newPw || newPw.length < 6) { setPwMsg("Mật khẩu mới tối thiểu 6 ký tự"); return }
    if (newPw !== cfmPw) { setPwMsg("Mật khẩu xác nhận không khớp"); return }
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) { setPwMsg("Lỗi: " + error.message) } else {
      setPwMsg("✅ Đã đổi mật khẩu thành công")
      setCurPw(""); setNewPw(""); setCfmPw("")
    }
  }

  const handleTopup = async () => {
    if (!adminId || !topupAmt) return
    const amt = parseInt(topupAmt)
    if (!amt || amt <= 0 || amt > 100_000_000) return
    setTopupSaving(true)
    setTopupMsg("")
    const supabase = createClient()
    const newBalance = (walletBalance ?? 0) + amt
    const { data: wallet, error: we } = await supabase
      .from("wallets")
      .upsert({ user_id: adminId, type: "customer", balance: newBalance, updated_at: new Date().toISOString() }, { onConflict: "user_id,type" })
      .select("id").single()
    if (we || !wallet) { setTopupMsg("❌ Lỗi nạp xu: " + (we?.message ?? "")); setTopupSaving(false); return }
    await supabase.from("transactions").insert({
      wallet_id: wallet.id, type: "topup", amount: amt,
      balance_after: newBalance, note: "Admin nạp xu hệ thống",
    })
    setWalletBalance(newBalance)
    setWalletId(wallet.id)
    setTopupMsg(`✅ Đã nạp ${amt.toLocaleString("vi-VN")} xu · Số dư: ${newBalance.toLocaleString("vi-VN")}`)
    setTimeout(() => setTopupMsg(""), 5000)
    setTopupSaving(false)
  }

  const SECTIONS: { key: SettingSection; label: string; icon: string }[] = [
    { key:"pricing",     label:"Cước & Phí",      icon:"💵" },
    { key:"commission",  label:"Hoa hồng",        icon:"💰" },
    { key:"area",        label:"Khu vực",          icon:"🗺️" },
    { key:"services",    label:"Dịch vụ",          icon:"🔌" },
    { key:"features",    label:"Tính năng",        icon:"⚙️" },
    { key:"account",     label:"Tài khoản admin",  icon:"👤" },
    { key:"maintenance", label:"Bảo trì",          icon:"🔧" },
  ]

  const fmtNum = (v: string) => { const n = v.replace(/\D/g,""); return n ? Number(n).toLocaleString("vi-VN") : "" }
  const rawNum = (v: string) => v.replace(/\./g,"").replace(/[^\d]/g,"")

  const renderInput = (label: string, desc: string, value: string, onChange: (v: string) => void, unit: string, isNum = true) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ flex:1 }}>
        <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600, marginBottom:2 }}>{label}</div>
        <div style={{ color:"#6a5a40", fontSize:10 }}>{desc}</div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <input type="text" inputMode={isNum ? "numeric" : "text"}
          value={isNum ? fmtNum(value) : value}
          onChange={e => onChange(isNum ? rawNum(e.target.value) : e.target.value)}
          style={{ width:90, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, textAlign:"right", fontFamily:"Lexend", outline:"none" }} />
        {unit && <span style={{ color:"#6a5a40", fontSize:11, minWidth:24 }}>{unit}</span>}
      </div>
    </div>
  )

  const SaveButton = () => (
    <button onClick={handleSave} disabled={saving}
      style={{ padding:"8px 20px", borderRadius:10, background: saved ? "rgba(62,207,110,0.2)" : "linear-gradient(90deg,#FF6B00,#FF8C00)", border: saved ? "1px solid rgba(62,207,110,0.4)" : "none", color: saved ? "#3ecf6e" : "#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", transition:"all .3s", animation: saved ? "savedPop .3s ease" : "none", opacity: saving ? 0.6 : 1 }}>
      {saved ? "✅ Đã lưu!" : saving ? "Đang lưu..." : "💾 Lưu"}
    </button>
  )

  const renderHoursBlock = (svc: string) => {
    const t = svcTime[svc] ?? SVC_TIME_DEFAULT
    const h = t.hours
    const inHours = isInHoursNow(svc)
    const toggle = (style: object) => ({ width:48, height:26, borderRadius:13, border:"none", cursor:"pointer", position:"relative" as const, flexShrink:0, transition:"background .2s", ...style })
    const knob = (on: boolean) => ({ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute" as const, top:3, left: on ? 25 : 3, transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,0.4)" })
    return (
      <div style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${inHours ? "rgba(62,207,110,0.2)" : "rgba(255,107,0,0.2)"}`, borderRadius:14, padding:"0 16px", marginBottom:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0 6px" }}>
          <div>
            <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>🕐 Giờ hoạt động</div>
            <div style={{ marginTop:3, fontSize:10, color: inHours ? "#3ecf6e" : "#FF6B00", fontWeight:600 }}>
              {inHours ? "🟢 Đang trong giờ phục vụ" : "🔴 Ngoài giờ — sẽ tự động khoá"}
            </div>
          </div>
          <button onClick={() => setSvcTime(svc, "hours", { allDay: !h.allDay })}
            style={{ ...toggle({ background: h.allDay ? "#3ecf6e" : "rgba(255,255,255,0.08)" }) }}>
            <div style={knob(h.allDay)} />
          </button>
        </div>
        {h.allDay ? (
          <div style={{ color:"#3ecf6e", fontSize:11, paddingBottom:10 }}>✓ 24/24 — Hoạt động liên tục</div>
        ) : (
          <div style={{ display:"flex", gap:12, padding:"8px 0 10px" }}>
            <div style={{ flex:1 }}>
              <div style={{ color:"#6a5a40", fontSize:10, marginBottom:3 }}>Mở cửa</div>
              <input type="time" value={h.open} onChange={e => setSvcTime(svc, "hours", { open: e.target.value })}
                style={{ width:"100%", padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, fontFamily:"Lexend", colorScheme:"dark" as const, boxSizing:"border-box" as const }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#6a5a40", fontSize:10, marginBottom:3 }}>Đóng cửa</div>
              <input type="time" value={h.close} onChange={e => setSvcTime(svc, "hours", { close: e.target.value })}
                style={{ width:"100%", padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, fontFamily:"Lexend", colorScheme:"dark" as const, boxSizing:"border-box" as const }} />
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderSvcTimeBlock = (svc: string) => {
    const t = svcTime[svc] ?? SVC_TIME_DEFAULT
    const h = t.hours; const n = t.night; const w = t.weather
    const toggle = (style: object) => ({ width:48, height:26, borderRadius:13, border:"none", cursor:"pointer", position:"relative" as const, flexShrink:0, transition:"background .2s", ...style })
    const knob = (on: boolean) => ({ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute" as const, top:3, left: on ? 25 : 3, transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,0.4)" })
    void h
    return (
      <>
        {/* Phụ phí đêm khuya */}
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px", marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0 8px" }}>
            <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>🌙 Phụ phí đêm khuya</div>
            <button onClick={() => setSvcTime(svc, "night", { enabled: !n.enabled })} style={{ ...toggle({ background: n.enabled ? "#3ecf6e" : "rgba(255,255,255,0.08)" }) }}>
              <div style={knob(n.enabled)} />
            </button>
          </div>
          {n.enabled && (
            <>
              <div style={{ display:"flex", gap:16, padding:"10px 0", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ flex:1 }}>
                  <div style={{ color:"#6a5a40", fontSize:10, marginBottom:4 }}>Từ</div>
                  <input type="time" value={n.start} onChange={e => setSvcTime(svc, "night", { start: e.target.value })} style={{ width:"100%", padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, fontFamily:"Lexend", colorScheme:"dark", boxSizing:"border-box" as const }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ color:"#6a5a40", fontSize:10, marginBottom:4 }}>Đến</div>
                  <input type="time" value={n.end} onChange={e => setSvcTime(svc, "night", { end: e.target.value })} style={{ width:"100%", padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, fontFamily:"Lexend", colorScheme:"dark", boxSizing:"border-box" as const }} />
                </div>
              </div>
              <div style={{ display:"flex", gap:6, padding:"10px 0", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                {(["percent","per_km","flat"] as const).map(tp => (
                  <button key={tp} onClick={() => setSvcTime(svc, "night", { type: tp })} style={{ flex:1, padding:"6px 0", borderRadius:8, cursor:"pointer", fontFamily:"Lexend", fontSize:10, fontWeight: n.type===tp ? 700 : 400, background: n.type===tp ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)", border:`1px solid ${n.type===tp ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.08)"}`, color: n.type===tp ? "#FF8C00" : "#6a5a40" }}>
                    {tp==="percent" ? "% cước" : tp==="per_km" ? "đ/km" : "Cố định"}
                  </button>
                ))}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0 14px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ color:"#f0eaff", fontSize:12 }}>
                  {n.type==="percent" ? "Phụ thu %" : n.type==="per_km" ? "Cộng thêm mỗi km" : "Tiền cố định/chuyến"}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <input type="number" value={n.value} step={n.type==="percent" ? 5 : 1000} onChange={e => setSvcTime(svc, "night", { value: Number(e.target.value) })} style={{ width:90, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, textAlign:"right" as const }} />
                  <span style={{ color:"#6a5a40", fontSize:11 }}>{n.type==="percent" ? "%" : "đ"}</span>
                </div>
              </div>
            </>
          )}
        </div>
        {/* Phụ phí thời tiết xấu */}
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px", marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0 8px" }}>
            <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>⛈️ Phụ phí thời tiết xấu</div>
            <button onClick={() => setSvcTime(svc, "weather", { enabled: !w.enabled })} style={{ ...toggle({ background: w.enabled ? "#3ecf6e" : "rgba(255,255,255,0.08)" }) }}>
              <div style={knob(w.enabled)} />
            </button>
          </div>
          {w.enabled && (
            <>
              <div style={{ display:"flex", gap:8, padding:"10px 0", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                {(["percent","fixed"] as const).map(tp => (
                  <button key={tp} onClick={() => setSvcTime(svc, "weather", { type: tp })} style={{ flex:1, padding:"6px 0", borderRadius:8, cursor:"pointer", fontFamily:"Lexend", fontSize:11, fontWeight: w.type===tp ? 700 : 400, background: w.type===tp ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)", border:`1px solid ${w.type===tp ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.08)"}`, color: w.type===tp ? "#FF8C00" : "#6a5a40" }}>{tp==="percent" ? "% tổng cước" : "Cộng thêm cố định"}</button>
                ))}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0 14px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ color:"#f0eaff", fontSize:12 }}>{w.type==="percent" ? "Phụ thu %" : "Số tiền cộng thêm"}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <input type="number" value={w.value} step={w.type==="percent" ? 5 : 1000} onChange={e => setSvcTime(svc, "weather", { value: Number(e.target.value) })} style={{ width:90, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, textAlign:"right" as const }} />
                  <span style={{ color:"#6a5a40", fontSize:11 }}>{w.type==="percent" ? "%" : "đ"}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </>
    )
  }

  return (
    <AdminShell
      pageTitle="⚙️ Cài đặt hệ thống"
      pageSubtitle="Cấu hình · Tính năng · Khu vực · Tài khoản"
      actions={<SaveButton />}
    >
      {/* Inner layout: section tabs + content */}
      <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", height:"100%", overflow:"hidden" }}>

        {/* Section tabs */}
        {isMobile ? (
          /* Mobile: horizontal scroll tabs */
          <div style={{ display:"flex", gap:6, padding:"10px 12px", overflowX:"auto", flexShrink:0, borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.02)" }}>
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:20, border: activeSection===s.key ? "1.5px solid rgba(255,107,0,0.4)" : "1.5px solid rgba(255,255,255,0.08)", background: activeSection===s.key ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.03)", color: activeSection===s.key ? "#FF8C00" : "#6a5a40", fontSize:11, fontWeight: activeSection===s.key ? 700 : 400, cursor:"pointer", fontFamily:"Lexend", whiteSpace:"nowrap", flexShrink:0 }}>
                <span style={{ fontSize:15 }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          /* PC: vertical tabs */
          <div style={{ width:200, borderRight:"1px solid rgba(255,255,255,0.06)", padding:"12px 10px", overflowY:"auto", flexShrink:0 }}>
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                style={{ width:"100%", height:44, borderRadius:10, marginBottom:4, background: activeSection===s.key ? "rgba(255,107,0,0.12)" : "transparent", border: activeSection===s.key ? "1px solid rgba(255,107,0,0.3)" : "1px solid transparent", color: activeSection===s.key ? "#FF8C00" : "#6a5a40", fontSize:12, fontWeight: activeSection===s.key ? 700 : 400, cursor:"pointer", fontFamily:"Lexend", display:"flex", alignItems:"center", gap:8, padding:"0 12px" }}>
                <span style={{ fontSize:16 }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ flex:1, overflowY:"auto", padding: isMobile ? "16px 14px" : "24px 32px" }}>

          {/* PRICING */}
          {activeSection === "pricing" && (
            <div style={{ animation:"fadeUp .3s ease" }}>
              <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>💵 Cài đặt cước dịch vụ</div>
              <div style={{ color:"#6a5a40", fontSize:11, marginBottom:16 }}>Giá cước từng km. Ô trống = dùng giá km trước đó.</div>

              <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
                {(Object.keys(SERVICE_META) as ServiceType[]).map(svc => {
                  const m = SERVICE_META[svc]; const isAct = activeService === svc
                  return (
                    <button key={svc} onClick={() => setActiveService(svc)} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:20, border: isAct ? `1.5px solid ${m.color}` : "1.5px solid rgba(255,255,255,0.08)", background: isAct ? `${m.color}1a` : "rgba(255,255,255,0.03)", color: isAct ? m.color : "#6a5a40", fontSize:11, fontWeight: isAct ? 700 : 400, cursor:"pointer", fontFamily:"Lexend" }}>
                      <span>{m.icon}</span>{m.label}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginBottom:16, padding:"10px 14px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, color:"#6a5a40", fontSize:11 }}>
                {SERVICE_META[activeService].icon} {SERVICE_META[activeService].desc}
              </div>

              {/* ── Taxi: simple pricing inputs ── */}
              {(activeService === "taxi" || activeService === "taxi7") ? (() => {
                const v = activeService === "taxi" ? "taxi4" : "taxi7"
                const vc = taxiCfg[v]
                const setVC = (k: keyof TaxiVehicle, val: number) => setTaxiCfg(p => ({ ...p, [v]: { ...p[v], [k]: val } }))
                const ipt = (lbl: string, val: number, unit: string, step: number, setter: (n: number) => void) => (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 20px", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600 }}>{lbl}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <input type="number" value={val} step={step} min={0}
                        onChange={e => setter(Number(e.target.value))}
                        style={{ width:100, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, color:"#f0eaff", fontSize:13, textAlign:"right", fontFamily:"Lexend", outline:"none", fontWeight:700 }} />
                      <span style={{ color:"#6a5a40", fontSize:11, minWidth:32 }}>{unit}</span>
                    </div>
                  </div>
                )
                return (
                  <>
                    <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden", marginBottom:14 }}>
                      <div style={{ padding:"10px 20px", background:"rgba(255,255,255,0.04)", borderBottom:"1px solid rgba(255,255,255,0.07)", color:"#6a5a40", fontSize:10, fontWeight:700 }}>
                        CƯỚC CƠ BẢN — {activeService === "taxi" ? "TAXI 4 CHỖ" : "TAXI 7 CHỖ"}
                      </div>
                      {ipt("💰 Giá mở cửa (bao gồm 1km đầu)", vc.baseFare, "đ", 1000, v => setVC("baseFare", v))}
                      {ipt("📏 Giá mỗi km (1–30km)", vc.perKm, "đ/km", 1000, v => setVC("perKm", v))}
                      {ipt("🛣️ Giá mỗi km (trên 30km)", vc.perKmOver30 ?? vc.perKm, "đ/km", 1000, v => setVC("perKmOver30", v))}
                      {ipt("🏦 Hoa hồng app", vc.commissionRate, "%", 1, v => setVC("commissionRate", v))}
                      <div style={{ padding:"10px 20px", background:"rgba(255,107,0,0.04)", borderTop:"1px solid rgba(255,107,0,0.1)", fontSize:11, color:"#6a5a40" }}>
                        5km: <strong style={{ color:"#FF8C00" }}>{calcTaxiFare(vc, 5, { ...svcTime[v].night, enabled: false }).toLocaleString("vi-VN")}đ</strong>
                        {" · "}10km: <strong style={{ color:"#FF8C00" }}>{calcTaxiFare(vc, 10, { ...svcTime[v].night, enabled: false }).toLocaleString("vi-VN")}đ</strong>
                        {" · "}30km: <strong style={{ color:"#FF8C00" }}>{calcTaxiFare(vc, 30, { ...svcTime[v].night, enabled: false }).toLocaleString("vi-VN")}đ</strong>
                        {" · "}50km: <strong style={{ color:"#FF8C00" }}>{calcTaxiFare(vc, 50, { ...svcTime[v].night, enabled: false }).toLocaleString("vi-VN")}đ</strong>
                      </div>
                    </div>

                    {renderSvcTimeBlock(v)}

                    {/* Thời gian chờ */}
                    <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px", marginBottom:14 }}>
                      <div style={{ padding:"12px 0 4px", color:"#f0eaff", fontSize:12, fontWeight:700 }}>⏱️ Quy tắc thời gian chờ</div>
                      {[
                        { lbl:"Miễn phí (phút đầu)", k:"freeMinutes" as const, unit:"phút", step:15 },
                        { lbl:"Phụ phí mỗi giờ thêm", k:"extraHourFee" as const, unit:"đ/giờ", step:10000 },
                        { lbl:"Tính 2 chuyến sau (giờ)", k:"doubleAfterHours" as const, unit:"giờ", step:1 },
                      ].map(row => (
                        <div key={row.k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ color:"#f0eaff", fontSize:12 }}>{row.lbl}</div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <input type="number" value={taxiWaiting[row.k]} step={row.step} min={0}
                              onChange={e => setTaxiWaiting(p => ({ ...p, [row.k]: Number(e.target.value) }))}
                              style={{ width:90, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, textAlign:"right" }} />
                            <span style={{ color:"#6a5a40", fontSize:11, minWidth:32 }}>{row.unit}</span>
                          </div>
                        </div>
                      ))}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, padding:"12px 0" }}>
                        {[
                          { label:`≤${taxiWaiting.freeMinutes}ph`, desc:"Miễn phí", color:"#3ecf6e" },
                          { label:`+1 giờ`, desc:`+${taxiWaiting.extraHourFee.toLocaleString("vi-VN")}đ`, color:"#FFB347" },
                          { label:`+2 giờ`, desc:`+${(taxiWaiting.extraHourFee*2).toLocaleString("vi-VN")}đ`, color:"#FF8C00" },
                          { label:`>${taxiWaiting.doubleAfterHours}h`, desc:"2 chuyến 🔴", color:"#ff6060" },
                        ].map(r => (
                          <div key={r.label} style={{ background:"rgba(0,0,0,0.2)", borderRadius:8, padding:"7px 6px", textAlign:"center" }}>
                            <div style={{ color:"#6a5a40", fontSize:9 }}>{r.label}</div>
                            <div style={{ color:r.color, fontSize:10, fontWeight:700, marginTop:2 }}>{r.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chuyến cố định */}
                    <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px", marginBottom:14 }}>
                      <div style={{ padding:"12px 0 4px", color:"#f0eaff", fontSize:12, fontWeight:700 }}>📍 Chuyến cố định</div>
                      <div style={{ color:"#6a5a40", fontSize:10, paddingBottom:10 }}>Giá trọn gói — không tính theo km.</div>
                      {taxiRoutes.map(r => (
                        <div key={r.id} style={{ background:"rgba(0,0,0,0.2)", borderRadius:10, padding:"10px 12px", marginBottom:8, border:"1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                            {[["Điểm đi", "from", r.from], ["Điểm đến", "to", r.to]].map(([lbl, k, val]) => (
                              <div key={k as string}>
                                <div style={{ color:"#6a5a40", fontSize:9, marginBottom:3 }}>{lbl}</div>
                                <input value={val as string} onChange={e => setTaxiRoutes(p => p.map(x => x.id===r.id ? {...x, [k as string]: e.target.value} : x))}
                                  style={{ width:"100%", padding:"6px 8px", borderRadius:7, boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,107,0,0.2)", color:"#f0eaff", fontSize:12, fontFamily:"Lexend", outline:"none" }} />
                              </div>
                            ))}
                            {[["1 chiều (đ)", "oneWay", r.oneWay], ["2 chiều (đ)", "twoWay", r.twoWay]].map(([lbl, k, val]) => (
                              <div key={k as string}>
                                <div style={{ color:"#6a5a40", fontSize:9, marginBottom:3 }}>{lbl}</div>
                                <input type="number" value={val as number} step={10000}
                                  onChange={e => setTaxiRoutes(p => p.map(x => x.id===r.id ? {...x, [k as string]: Number(e.target.value)} : x))}
                                  style={{ width:"100%", padding:"6px 8px", borderRadius:7, boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,107,0,0.2)", color:"#f0eaff", fontSize:12, fontFamily:"Lexend", outline:"none" }} />
                              </div>
                            ))}
                          </div>
                          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                            <input value={r.note} onChange={e => setTaxiRoutes(p => p.map(x => x.id===r.id ? {...x, note: e.target.value} : x))}
                              placeholder="Ghi chú (tuỳ chọn)..."
                              style={{ flex:1, padding:"5px 8px", borderRadius:7, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#6a5a40", fontSize:11, fontFamily:"Lexend", outline:"none" }} />
                            <span style={{ fontSize:10, color:"#3ecf6e", whiteSpace:"nowrap" }}>
                              TX: {Math.round(r.oneWay*(1-vc.commissionRate/100)).toLocaleString("vi-VN")}đ
                            </span>
                            <button onClick={() => setTaxiRoutes(p => p.filter(x => x.id !== r.id))}
                              style={{ background:"rgba(255,64,64,0.1)", border:"1px solid rgba(255,64,64,0.2)", borderRadius:6, padding:"4px 8px", cursor:"pointer", color:"#ff6060", fontSize:11, fontFamily:"Lexend" }}>✕</button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => setTaxiRoutes(p => [...p, { id: Date.now().toString(), from:"", to:"", oneWay:0, twoWay:0, note:"" }])}
                        style={{ width:"100%", padding:"9px 0", borderRadius:9, border:"1px dashed rgba(255,107,0,0.3)", background:"rgba(255,107,0,0.04)", color:"#FF8C00", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"Lexend", marginBottom:4 }}>
                        + Thêm chuyến cố định
                      </button>
                    </div>

                    {/* Bảng giá ví dụ taxi */}
                    <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 20px", marginBottom:14 }}>
                      <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700, marginBottom:12 }}>📊 Bảng giá ví dụ — {activeService === "taxi" ? "Taxi 4 chỗ" : "Taxi 7 chỗ"}</div>
                      <div style={{ overflowX:"auto" }}>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                          <thead>
                            <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                              {["Km", "Giá khách", "Tài xế nhận", svcTime[v].night.enabled ? "🌙 Đêm" : ""].filter(Boolean).map(h => (
                                <th key={h} style={{ padding:"6px 8px", color:"#6a5a40", fontWeight:600, textAlign: h==="Km" ? "left" : "right" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[1,2,3,5,7,10,15,20,25,30,40,50].map((km, i) => {
                              const fare  = calcTaxiFare(vc, km, { ...svcTime[v].night, enabled: false })
                              const faren = calcTaxiFare(vc, km, svcTime[v].night)
                              const drv   = Math.round(fare * (1 - vc.commissionRate / 100))
                              return (
                                <tr key={km} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)", background: km > 30 ? "rgba(255,107,0,0.04)" : i%2===0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                                  <td style={{ padding:"6px 8px", color: km > 30 ? "#FF8C00" : "#6a5a40", fontWeight:700 }}>{km} km{km > 30 ? " 🛣️" : ""}</td>
                                  <td style={{ padding:"6px 8px", color:"#f5c542", textAlign:"right", fontWeight:700 }}>{fare.toLocaleString("vi-VN")}đ</td>
                                  <td style={{ padding:"6px 8px", color:"#3ecf6e", textAlign:"right" }}>{drv.toLocaleString("vi-VN")}đ</td>
                                  {svcTime[v].night.enabled && <td style={{ padding:"6px 8px", color:"#9080c0", textAlign:"right" }}>{faren.toLocaleString("vi-VN")}đ</td>}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )
              })() : (
              <>
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden", marginBottom:14 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 2fr", padding:"10px 20px", background:"rgba(255,255,255,0.04)", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ color:"#6a5a40", fontSize:10, fontWeight:700 }}>KHOẢNG CÁCH</span>
                  <span style={{ color:"#6a5a40", fontSize:10, fontWeight:700, textAlign:"right" }}>GIÁ (đ/km)</span>
                  <span style={{ color:"#6a5a40", fontSize:10, fontWeight:700, textAlign:"right", paddingRight:8 }}>GHI CHÚ</span>
                </div>
                {pricing[activeService].rows.map((price, i) => {
                  const isEmpty = price === ""
                  let eff = price
                  if (isEmpty && i > 0) { for (let j = i-1; j>=0; j--) if (pricing[activeService].rows[j] !== "") { eff = pricing[activeService].rows[j]; break } }
                  return (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 2fr", alignItems:"center", padding:"11px 20px", borderBottom:"1px solid rgba(255,255,255,0.05)", background: isEmpty ? "rgba(255,255,255,0.01)" : "transparent" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ width:28, height:28, borderRadius:8, background:`${SERVICE_META[activeService].color}1a`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:SERVICE_META[activeService].color, flexShrink:0 }}>{i+1}</span>
                        <span style={{ color:"#f0eaff", fontSize:12 }}>Km {i+1}</span>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <input type="text" inputMode="numeric"
                          value={fmtNum(price)}
                          placeholder={isEmpty && i > 0 ? fmtNum(eff) : ""}
                          onChange={e => updateKmPrice(activeService, i, rawNum(e.target.value))}
                          style={{ width:90, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:`1px solid ${isEmpty && i > 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)"}`, borderRadius:8, color: isEmpty ? "#6a5a40" : "#f0eaff", fontSize:12, textAlign:"right", fontFamily:"Lexend", outline:"none" }} />
                      </div>
                      <div style={{ textAlign:"right", paddingRight:8 }}>
                        {i === 1 && <span style={{ fontSize:10, color:"#6a5a40" }}>Bỏ trống = dùng giá km 1</span>}
                        {i > 1 && isEmpty && <span style={{ fontSize:10, color:"#6a5a40", fontStyle:"italic" }}>→ {parseInt(eff||"0").toLocaleString("vi-VN")}đ</span>}
                      </div>
                    </div>
                  )
                })}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 2fr", alignItems:"center", padding:"11px 20px", background:"rgba(255,107,0,0.03)", borderTop:"1px solid rgba(255,107,0,0.1)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ width:28, height:28, borderRadius:8, background:"rgba(255,107,0,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:"#FF8C00", flexShrink:0 }}>11+</span>
                    <span style={{ color:"#FF8C00", fontSize:12, fontWeight:600 }}>Km 11 trở đi</span>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <input type="text" inputMode="numeric"
                      value={fmtNum(pricing[activeService].extra)}
                      onChange={e => setPricing(p => ({ ...p, [activeService]: { ...p[activeService], extra: rawNum(e.target.value) } }))}
                      style={{ width:90, padding:"7px 10px", background:"rgba(255,107,0,0.08)", border:"1px solid rgba(255,107,0,0.25)", borderRadius:8, color:"#FF8C00", fontSize:12, textAlign:"right", fontFamily:"Lexend", outline:"none" }} />
                  </div>
                  <div style={{ textAlign:"right", paddingRight:8 }}><span style={{ fontSize:10, color:"#6a5a40" }}>cộng thêm mỗi km</span></div>
                </div>
              </div>

              {/* Weight surcharge — chỉ cho delivery_pkg và errand */}
              {(activeService === "delivery_pkg" || activeService === "errand") && (
                <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px", marginBottom:14 }}>
                  <div style={{ padding:"12px 0 4px", color:"#f0eaff", fontSize:12, fontWeight:700 }}>⚖️ Phụ thu theo cân nặng</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                    <div>
                      <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600 }}>Hàng nặng 3–5kg</div>
                      <div style={{ color:"#6a5a40", fontSize:10 }}>Phụ phí cộng thêm ngoài phí vận chuyển</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <input type="text" inputMode="numeric"
                        value={fmtNum(pricing[activeService].weightMid ?? "5000")}
                        onChange={e => setPricing(p => ({ ...p, [activeService]: { ...p[activeService], weightMid: rawNum(e.target.value) } }))}
                        style={{ width:90, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, color:"#f0eaff", fontSize:12, textAlign:"right", fontFamily:"Lexend", outline:"none" }} />
                      <span style={{ color:"#6a5a40", fontSize:10 }}>đ</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0" }}>
                    <div>
                      <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600 }}>Hàng nặng 5–10kg</div>
                      <div style={{ color:"#6a5a40", fontSize:10 }}>Phụ phí cộng thêm ngoài phí vận chuyển</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <input type="text" inputMode="numeric"
                        value={fmtNum(pricing[activeService].weightHeavy ?? "15000")}
                        onChange={e => setPricing(p => ({ ...p, [activeService]: { ...p[activeService], weightHeavy: rawNum(e.target.value) } }))}
                        style={{ width:90, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, color:"#f0eaff", fontSize:12, textAlign:"right", fontFamily:"Lexend", outline:"none" }} />
                      <span style={{ color:"#6a5a40", fontSize:10 }}>đ</span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px", marginBottom:14 }}>
                <div style={{ padding:"12px 0 4px", color:"#f0eaff", fontSize:12, fontWeight:700 }}>🛵 Điều chỉnh & hệ số</div>
                {renderInput("Bán kính tối đa",         "Khoảng cách tối đa hệ thống chấp nhận đơn", deliverySettings.maxRadius,      v => setDeliverySettings(p=>({...p,maxRadius:v})),      "km")}
                {renderInput("Rating tài xế tối thiểu", "Điểm đánh giá tối thiểu để nhận đơn",      deliverySettings.minDriverRating, v => setDeliverySettings(p=>({...p,minDriverRating:v})), "⭐")}
              </div>

              {renderSvcTimeBlock(activeService)}

              <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 20px" }}>
                <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700, marginBottom:12 }}>📊 Ví dụ tính cước</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
                  {[1, 3, 5, 8, 12].map(dist => (
                    <div key={dist} style={{ textAlign:"center", padding:"10px 8px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10 }}>
                      <div style={{ color:"#6a5a40", fontSize:10, marginBottom:4 }}>{dist} km</div>
                      <div style={{ color:SERVICE_META[activeService].color, fontSize:12, fontWeight:700 }}>{calcExampleFare(activeService, dist).toLocaleString("vi-VN")}đ</div>
                    </div>
                  ))}
                </div>
              </div>
              </>
              )}
            </div>
          )}

          {/* COMMISSION */}
          {activeSection === "commission" && (
            <div style={{ animation:"fadeUp .3s ease" }}>
              <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>💰 Hoa hồng</div>
              <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Tỉ lệ hoa hồng mặc định và chia sẻ doanh thu</div>

              {/* ── Hoa hồng thực tế (dùng bởi hệ thống) ── */}
              <div style={{ marginBottom:12, padding:"12px 16px", background:"rgba(255,107,0,0.06)", border:"1px solid rgba(255,107,0,0.2)", borderRadius:14 }}>
                <div style={{ color:"#FF8C00", fontSize:11, fontWeight:700, marginBottom:2 }}>⚙️ Hoa hồng hệ thống (toàn cầu)</div>
                <div style={{ color:"#6a5a40", fontSize:10, marginBottom:12 }}>Áp dụng cho tài xế / quán chưa có tỉ lệ riêng. Tài xế và quán có thể có override riêng trong trang Tài xế / Cửa hàng.</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div>
                    <div style={{ color:"#b0956a", fontSize:9, marginBottom:4 }}>🛵 Hoa hồng tài xế (% phí ship)</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <input type="number" min="0" max="100" value={commissionSettings.driverRate}
                        onChange={e => setCommissionSettings(p=>({...p, driverRate: e.target.value}))}
                        style={{ flex:1, height:36, padding:"0 10px", borderRadius:8, border:"1px solid rgba(255,107,0,0.3)", background:"rgba(255,107,0,0.06)", color:"#FF8C00", fontSize:14, fontWeight:700, fontFamily:"Lexend", outline:"none" }} />
                      <span style={{ color:"#6a5a40", fontSize:12 }}>%</span>
                    </div>
                    <div style={{ color:"#6a5a40", fontSize:9, marginTop:4 }}>Trừ vào ví tài xế khi nhận đơn</div>
                  </div>
                  <div>
                    <div style={{ color:"#b0956a", fontSize:9, marginBottom:4 }}>🏪 Hoa hồng quán (% tiền đồ ăn)</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <input type="number" min="0" max="100" value={commissionSettings.shopRate}
                        onChange={e => setCommissionSettings(p=>({...p, shopRate: e.target.value}))}
                        style={{ flex:1, height:36, padding:"0 10px", borderRadius:8, border:"1px solid rgba(62,207,110,0.3)", background:"rgba(62,207,110,0.06)", color:"#3ecf6e", fontSize:14, fontWeight:700, fontFamily:"Lexend", outline:"none" }} />
                      <span style={{ color:"#6a5a40", fontSize:12 }}>%</span>
                    </div>
                    <div style={{ color:"#6a5a40", fontSize:9, marginTop:4 }}>Trừ ví merchant khi đơn hoàn thành</div>
                  </div>
                </div>
              </div>

              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px" }}>
                {renderInput("Tỉ lệ hoa hồng mặc định",   "Áp dụng cho cửa hàng mới, chưa đàm phán riêng",           commissionSettings.defaultRate,          v => setCommissionSettings(p=>({...p,defaultRate:v})),          "%")}
                {renderInput("Tỉ lệ tối thiểu",             "Không được đặt dưới mức này cho bất kỳ cửa hàng",         commissionSettings.minRate,              v => setCommissionSettings(p=>({...p,minRate:v})),              "%")}
                {renderInput("Tỉ lệ tối đa",                "Không được vượt mức này trong hợp đồng",                  commissionSettings.maxRate,              v => setCommissionSettings(p=>({...p,maxRate:v})),              "%")}
                {renderInput("Phần tài xế hưởng",           "% từ phí giao hàng thuộc về tài xế",                      commissionSettings.driverSharePercent,   v => setCommissionSettings(p=>({...p,driverSharePercent:v})),   "%")}
                {renderInput("Phần nền tảng",                "% từ phí giao hàng thuộc về nền tảng",                    commissionSettings.platformSharePercent, v => setCommissionSettings(p=>({...p,platformSharePercent:v})), "%")}
                {renderInput("Tích điểm",                    "Số điểm thưởng cho mỗi 10.000đ chi tiêu",                 commissionSettings.loyaltyPointsRate,    v => setCommissionSettings(p=>({...p,loyaltyPointsRate:v})),    "điểm/10k")}
              </div>
              <div style={{ marginTop:14, padding:"14px 16px", background:"rgba(255,107,0,0.05)", border:"1px solid rgba(255,107,0,0.15)", borderRadius:12 }}>
                <div style={{ color:"#FF8C00", fontSize:11, fontWeight:700, marginBottom:6 }}>⚡ Áp dụng hoa hồng cho cửa hàng</div>
                <div style={{ color:"#6a5a40", fontSize:10, marginBottom:12 }}>Cập nhật tỉ lệ hoa hồng mặc định ({commissionSettings.defaultRate}%) cho tất cả cửa hàng đang hoạt động. <strong style={{ color:"#FFB347" }}>Cửa hàng có hoa hồng thoả thuận riêng sẽ không bị ảnh hưởng.</strong></div>
                <button onClick={handleApplyCommissionToAllShops} disabled={applyingCommission}
                  style={{ height:34, padding:"0 18px", borderRadius:9, border:"none", background:"linear-gradient(90deg,#FF6B00,#FF8C00)", color:"#fff", fontSize:11, fontWeight:700, cursor:applyingCommission?"not-allowed":"pointer", opacity:applyingCommission?0.6:1 }}>
                  {applyingCommission ? "Đang cập nhật..." : `Áp dụng ${commissionSettings.defaultRate}% cho tất cả cửa hàng`}
                </button>
                {applyCommissionMsg && <div style={{ marginTop:8, fontSize:10, color: applyCommissionMsg.startsWith("✅") ? "#3ecf6e" : "#ff4040" }}>{applyCommissionMsg}</div>}
              </div>
            </div>
          )}

          {/* AREA */}
          {activeSection === "area" && (
            <div style={{ animation:"fadeUp .3s ease" }}>
              <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>🗺️ Khu vực hoạt động</div>
              <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Tọa độ trung tâm, bán kính phủ sóng, múi giờ</div>
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px" }}>
                {renderInput("Vĩ độ trung tâm (Lat)",   "Tọa độ vĩ độ trung tâm khu vực phục vụ",              areaSettings.centerLat,      v => setAreaSettings(p=>({...p,centerLat:v})),      "°N",false)}
                {renderInput("Kinh độ trung tâm (Lng)", "Tọa độ kinh độ trung tâm khu vực phục vụ",             areaSettings.centerLng,      v => setAreaSettings(p=>({...p,centerLng:v})),      "°E",false)}
                {renderInput("Bán kính phủ sóng",       "Bán kính tính từ trung tâm để tìm quán gần nhất",      areaSettings.coverageRadius, v => setAreaSettings(p=>({...p,coverageRadius:v})), "km")}
              </div>
              <div style={{ marginTop:14, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 20px" }}>
                <div style={{ color:"#6a5a40", fontSize:10, marginBottom:8 }}>Tên khu vực hiển thị</div>
                <input value={areaSettings.serviceName} onChange={e=>setAreaSettings(p=>({...p,serviceName:e.target.value}))} style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
              </div>
              <div style={{ marginTop:12, padding:"14px 16px", background:"rgba(74,143,245,0.06)", border:"1px solid rgba(74,143,245,0.15)", borderRadius:12 }}>
                <div style={{ color:"#4a8ff5", fontSize:11, fontWeight:700 }}>ℹ️ Phước An, Krông Pắc, Đắk Lắk</div>
                <div style={{ color:"#6a5a40", fontSize:10, marginTop:4 }}>Tọa độ hiện tại: 12.6521°N, 108.5073°E · Múi giờ: GMT+7</div>
              </div>
            </div>
          )}

          {/* SERVICES */}
          {activeSection === "services" && (
            <div style={{ animation:"fadeUp .3s ease" }}>
              <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>🔌 Dịch vụ</div>
              <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Cài giờ hoạt động — hệ thống tự khoá ngoài giờ. Tắt thủ công khi cần thiết.</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {serviceToggles.map(s => {
                  const presets = SERVICE_PRESETS[s.key] ?? []
                  const needReason = !s.enabled && !s.reason
                  return (
                    <div key={s.key} style={{ borderRadius:16, border:`1px solid ${s.enabled ? "rgba(62,207,110,0.2)" : needReason ? "rgba(255,179,71,0.4)" : "rgba(255,64,64,0.25)"}`, background: s.enabled ? "rgba(62,207,110,0.04)" : "rgba(255,64,64,0.04)", overflow:"hidden", transition:"all .2s" }}>

                      {/* Header row */}
                      <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px" }}>
                        <div style={{ width:44, height:44, borderRadius:12, background:`${s.color}18`, border:`1px solid ${s.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                          {s.icon}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700, marginBottom:2 }}>{s.label}</div>
                          <div style={{ color:"#6a5a40", fontSize:10 }}>
                            {s.enabled ? "Đang phục vụ" : s.reason ? `Lý do: ${s.reason}` : "⚠️ Chưa chọn lý do tắt"}
                          </div>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flexShrink:0 }}>
                          <button onClick={() => toggleService(s.key)} style={{ width:52, height:28, borderRadius:14, border:"none", cursor:"pointer", position:"relative", transition:"background .2s", background: s.enabled ? "#3ecf6e" : "rgba(255,255,255,0.1)" }}>
                            <div style={{ position:"absolute", top:3, left: s.enabled ? 26 : 3, width:22, height:22, borderRadius:11, background:"#fff", transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }} />
                          </button>
                          <span style={{ fontSize:9, fontWeight:700, color: s.enabled ? "#3ecf6e" : "#ff4040" }}>
                            {s.enabled ? "Mở" : "Tắt"}
                          </span>
                        </div>
                      </div>

                      {/* Giờ hoạt động — luôn hiện */}
                      {SVC_TOGGLE_TO_TIME_KEY[s.key] && (
                        <div style={{ padding:"0 16px 14px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ color:"#6a5a40", fontSize:9, fontWeight:600, margin:"10px 0 8px", textTransform:"uppercase", letterSpacing:".05em" }}>
                            Giờ hoạt động (tự động khoá ngoài giờ):
                          </div>
                          {renderHoursBlock(SVC_TOGGLE_TO_TIME_KEY[s.key])}
                        </div>
                      )}

                      {/* Preset reason picker — chỉ hiện khi dịch vụ bị tắt thủ công */}
                      {!s.enabled && (
                        <div style={{ padding:"0 16px 14px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ color:"#6a5a40", fontSize:9, fontWeight:600, margin:"10px 0 8px", textTransform:"uppercase", letterSpacing:".05em" }}>
                            Lý do tắt thủ công (hiển thị cho khách):
                          </div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                            {presets.map(p => {
                              const active = s.reason === p.label
                              return (
                                <button key={p.label} onClick={() => setServiceReason(s.key, p.label, p.msg)}
                                  style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${active ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)", color: active ? "#FF8C00" : "#6a5a40", fontSize:10, fontWeight: active ? 700 : 400, cursor:"pointer", fontFamily:"Lexend", transition:"all .15s" }}>
                                  {active ? "✓ " : ""}{p.label}
                                </button>
                              )
                            })}
                          </div>
                          {s.reason && (
                            <div style={{ marginTop:10, padding:"8px 12px", borderRadius:10, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
                              <div style={{ color:"#6a5a40", fontSize:9, marginBottom:3 }}>Khách sẽ thấy:</div>
                              <div style={{ color:"#b0956a", fontSize:10, lineHeight:1.5 }}>"{s.customerMsg}"</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop:16, padding:"12px 14px", borderRadius:12, background:"rgba(255,179,71,0.08)", border:"1px solid rgba(255,179,71,0.2)" }}>
                <div style={{ color:"#FFB347", fontSize:11, fontWeight:600, marginBottom:4 }}>💡 Lưu ý</div>
                <div style={{ color:"#6a5a40", fontSize:10, lineHeight:1.6 }}>
                  Giờ hoạt động: hệ thống tự động khoá dịch vụ khi ngoài giờ, khách thấy thông báo ngay trên trang chủ.<br/>
                  Tắt thủ công: ghi đè tất cả, dịch vụ bị khoá cho đến khi bật lại. Nhấn <b style={{color:"#f0eaff"}}>Lưu</b> để áp dụng.
                </div>
              </div>
            </div>
          )}

          {/* FEATURES */}
          {activeSection === "features" && (
            <div style={{ animation:"fadeUp .3s ease" }}>
              <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>⚙️ Bật/Tắt tính năng</div>
              <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Feature flags — thay đổi có hiệu lực ngay lập tức</div>
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
                {features.map((f, i) => (
                  <div key={f.key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom: i < features.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: f.key==="maintenance_mode" && f.value ? "rgba(255,64,64,0.04)" : "transparent" }}>
                    <div>
                      <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600, marginBottom:2 }}>{f.label}</div>
                      <div style={{ color:"#6a5a40", fontSize:10 }}>{f.description}</div>
                    </div>
                    <button onClick={() => toggleFeature(f.key)} style={{ width:48, height:26, borderRadius:13, background: f.value ? (f.key==="maintenance_mode" ? "#ff4040" : "#3ecf6e") : "rgba(255,255,255,0.08)", border:"none", cursor:"pointer", position:"relative", flexShrink:0, transition:"background .2s" }}>
                      <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left: f.value ? 25 : 3, transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACCOUNT — real Supabase data */}
          {activeSection === "account" && (
            <div style={{ animation:"fadeUp .3s ease" }}>
              <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>👤 Tài khoản quản trị</div>
              <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Thông tin liên hệ admin · Bảo mật tài khoản</div>

              {/* ── HUY HIỆU ADMIN ── */}
              <div style={{ background:"linear-gradient(135deg,#0e0819,#1a0b2e,#0f1420)", border:"1px solid rgba(180,100,255,0.35)", borderRadius:18, padding:"22px", marginBottom:14, position:"relative", overflow:"hidden" }}>
                {/* Shimmer */}
                <div style={{ position:"absolute", top:0, left:"-80%", width:"50%", height:"100%", background:"linear-gradient(90deg,transparent,rgba(180,100,255,0.1),transparent)", animation:"shimmer 4s infinite", pointerEvents:"none" }} />
                {/* Glow orbs */}
                <div style={{ position:"absolute", top:-30, right:-30, width:120, height:120, borderRadius:"50%", background:"rgba(180,100,255,0.1)", filter:"blur(28px)", pointerEvents:"none" }} />
                <div style={{ position:"absolute", bottom:-20, left:-10, width:90, height:90, borderRadius:"50%", background:"rgba(255,107,0,0.1)", filter:"blur(24px)", pointerEvents:"none" }} />

                <div style={{ display:"flex", gap:18, alignItems:"center", position:"relative" }}>
                  {/* Avatar */}
                  <div style={{ position:"relative", flexShrink:0 }}>
                    <div style={{ width:76, height:76, borderRadius:22, background:"linear-gradient(135deg,#b464ff,#FF6B00,#FFB347)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:38, boxShadow:"0 0 32px rgba(180,100,255,0.45),0 0 12px rgba(255,107,0,0.3)" }}>👑</div>
                    <div style={{ position:"absolute", bottom:2, right:2, width:16, height:16, borderRadius:"50%", background:"#3ecf6e", border:"2.5px solid #0e0819", boxShadow:"0 0 8px #3ecf6e" }} />
                  </div>

                  <div style={{ flex:1 }}>
                    <div style={{ color:"#f8f0e8", fontSize:20, fontWeight:800, marginBottom:5 }}>{adminName || "Quản trị viên"}</div>
                    <div style={{ color:"rgba(180,100,255,0.65)", fontSize:10, marginBottom:8 }}>{adminEmail}</div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <span style={{ padding:"3px 12px", borderRadius:20, background:"linear-gradient(90deg,rgba(180,100,255,0.3),rgba(255,107,0,0.2))", border:"1px solid rgba(180,100,255,0.5)", color:"#f8f0e8", fontSize:9, fontWeight:800, letterSpacing:1.5 }}>⚡ SUPER ADMIN</span>
                      <span style={{ padding:"3px 9px", borderRadius:20, background:"rgba(62,207,110,0.1)", border:"1px solid rgba(62,207,110,0.3)", color:"#3ecf6e", fontSize:9, fontWeight:700 }}>● Đang online</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop:14, padding:"8px 12px", background:"rgba(255,255,255,0.04)", borderRadius:10, display:"flex", justifyContent:"space-between", alignItems:"center", position:"relative" }}>
                  <span style={{ color:"rgba(180,100,255,0.5)", fontSize:9, fontWeight:600, letterSpacing:0.5 }}>ADMIN ID</span>
                  <span style={{ color:"rgba(180,100,255,0.8)", fontSize:9, fontFamily:"monospace", letterSpacing:2 }}>{adminId ? adminId.slice(0,8).toUpperCase() : "..."}</span>
                </div>
              </div>

              {/* ── VÍ XU ADMIN ── */}
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px", marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div>
                    <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700 }}>💰 Ví xu hệ thống</div>
                    <div style={{ color:"#6a5a40", fontSize:10, marginTop:2 }}>Dùng cho thử nghiệm &amp; phát thưởng nội bộ</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#FFB347", fontSize:22, fontWeight:800 }}>{walletBalance !== null ? walletBalance.toLocaleString("vi-VN") : "—"}</div>
                    <div style={{ color:"#6a5a40", fontSize:9 }}>xu</div>
                  </div>
                </div>

                {/* Quick amounts */}
                <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                  {[["100000","+100k"],["500000","+500k"],["1000000","+1M"],["2000000","+2M"]].map(([amt,label]) => (
                    <button key={amt} onClick={() => setTopupAmt(amt)}
                      style={{ flex:1, padding:"7px 0", borderRadius:9, cursor:"pointer", fontFamily:"Lexend",
                        background: topupAmt===amt ? "rgba(255,107,0,0.14)" : "rgba(255,255,255,0.04)",
                        border: topupAmt===amt ? "1px solid rgba(255,107,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                        color: topupAmt===amt ? "#FF8C00" : "#6a5a40", fontSize:10, fontWeight: topupAmt===amt ? 800 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>

                <div style={{ display:"flex", gap:8 }}>
                  <input type="number" value={topupAmt} onChange={e => setTopupAmt(e.target.value)} placeholder="Nhập số xu..."
                    style={{ flex:1, padding:"9px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                  <button onClick={handleTopup} disabled={topupSaving || !topupAmt || parseInt(topupAmt) <= 0}
                    style={{ padding:"9px 20px", borderRadius:10, background:"linear-gradient(90deg,#FF6B00,#FF8C00)", border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", opacity: topupSaving ? 0.6 : 1, whiteSpace:"nowrap" }}>
                    {topupSaving ? "Đang nạp..." : "⚡ Nạp xu"}
                  </button>
                </div>
                {topupMsg && <div style={{ marginTop:8, color: topupMsg.startsWith("✅") ? "#3ecf6e" : "#ff4040", fontSize:11, fontWeight:600 }}>{topupMsg}</div>}
              </div>

              {/* Profile */}
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px", marginBottom:14 }}>
                <div style={{ display:"flex", gap:16, marginBottom:20, alignItems:"center" }}>
                  <div style={{ width:64, height:64, borderRadius:16, background:"linear-gradient(135deg,#FF6B00,#FFB347)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>👑</div>
                  <div>
                    <div style={{ color:"#f0eaff", fontSize:16, fontWeight:800 }}>{adminName || "Quản trị viên"}</div>
                    <div style={{ color:"#6a5a40", fontSize:11 }}>{adminEmail}</div>
                    <span style={{ padding:"2px 10px", borderRadius:6, background:"rgba(255,107,0,0.1)", color:"#FF8C00", fontSize:10, fontWeight:700 }}>Super Admin</span>
                  </div>
                </div>

                {[
                  { label:"Họ tên",        value: adminName,  onChange: setAdminName,  type:"text",  placeholder:"Quản trị viên" },
                  { label:"Email",          value: adminEmail, onChange: setAdminEmail, type:"email", placeholder:"email@gmail.com", disabled: true },
                  { label:"Số điện thoại", value: adminPhone, onChange: setAdminPhone, type:"tel",   placeholder:"0901234567" },
                ].map(f => (
                  <div key={f.label} style={{ marginBottom:12 }}>
                    <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>{f.label}</div>
                    <input type={f.type} value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
                      disabled={f.disabled}
                      style={{ width:"100%", padding:"10px 14px", background: f.disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color: f.disabled ? "#6a5a40" : "#f0eaff", fontSize:12, opacity: f.disabled ? 0.6 : 1 }} />
                  </div>
                ))}
              </div>

              {/* Liên hệ hỗ trợ — propagates to all "contact admin" buttons */}
              <div style={{ background:"rgba(255,107,0,0.05)", border:"1px solid rgba(255,107,0,0.2)", borderRadius:14, padding:"20px", marginBottom:14 }}>
                <div style={{ color:"#FF8C00", fontSize:13, fontWeight:700, marginBottom:6 }}>📞 Link liên hệ admin</div>
                <div style={{ color:"#6a5a40", fontSize:10, marginBottom:14, lineHeight:1.6 }}>
                  URL này hiển thị trong nút "Liên hệ admin" ở trang merchant và khách hàng.<br />
                  Để trống → dùng <code style={{ color:"#FFB347" }}>tel:{adminPhone || "số điện thoại"}</code><br />
                  Ví dụ: <code style={{ color:"#FFB347" }}>https://zalo.me/84{adminPhone.replace(/^0/,"")}</code>
                </div>
                <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>Link liên hệ (Zalo / Facebook / tel:)</div>
                <input type="url" value={adminContactLink} onChange={e => setAdminContactLink(e.target.value)}
                  placeholder={adminPhone ? `https://zalo.me/84${adminPhone.replace(/^0/,"")}` : "https://zalo.me/84..."}
                  style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,107,0,0.2)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                {adminPhone && !adminContactLink && (
                  <div style={{ marginTop:8, display:"flex", gap:8 }}>
                    {[
                      { label:"📞 Dùng tel:", val: `tel:${adminPhone}` },
                      { label:"💬 Dùng Zalo", val: `https://zalo.me/${adminPhone.replace(/^0/,"84")}` },
                    ].map(opt => (
                      <button key={opt.val} onClick={() => setAdminContactLink(opt.val)}
                        style={{ padding:"5px 10px", borderRadius:8, background:"rgba(255,107,0,0.08)", border:"1px solid rgba(255,107,0,0.2)", color:"#FF8C00", fontSize:9, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Password change */}
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px" }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700, marginBottom:12 }}>🔐 Đổi mật khẩu</div>
                {[
                  { label:"Mật khẩu hiện tại",    value: curPw, onChange: setCurPw },
                  { label:"Mật khẩu mới (≥6 ký tự)", value: newPw, onChange: setNewPw },
                  { label:"Xác nhận mật khẩu mới", value: cfmPw, onChange: setCfmPw },
                ].map(f => (
                  <div key={f.label} style={{ marginBottom:10 }}>
                    <div style={{ color:"#6a5a40", fontSize:10, marginBottom:5 }}>{f.label}</div>
                    <input type="password" value={f.value} onChange={e => f.onChange(e.target.value)} placeholder="••••••••"
                      style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                  </div>
                ))}
                {pwMsg && <div style={{ color: pwMsg.startsWith("✅") ? "#3ecf6e" : "#ff4040", fontSize:11, marginBottom:8 }}>{pwMsg}</div>}
                <button onClick={handleChangePw} style={{ marginTop:4, padding:"9px 20px", borderRadius:10, background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.25)", color:"#FF8C00", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                  Đổi mật khẩu
                </button>
              </div>
            </div>
          )}

          {/* MAINTENANCE */}
          {activeSection === "maintenance" && (
            <div style={{ animation:"fadeUp .3s ease" }}>
              <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>🔧 Bảo trì hệ thống</div>
              <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Công cụ xóa cache, backup dữ liệu và cập nhật hệ thống</div>

              <div style={{ padding:"16px 20px", background:"rgba(255,64,64,0.06)", border:"1px solid rgba(255,64,64,0.15)", borderRadius:14, marginBottom:14 }}>
                <div style={{ color:"#ff4040", fontSize:13, fontWeight:700, marginBottom:4 }}>⚠️ Vùng nguy hiểm</div>
                <div style={{ color:"#6a5a40", fontSize:11, marginBottom:14 }}>Các hành động này không thể hoàn tác. Hãy chắc chắn trước khi thực hiện.</div>
                <div style={{ display:"flex", gap:10 }}>
                  <button style={{ padding:"9px 16px", borderRadius:10, background:"rgba(255,64,64,0.1)", border:"1px solid rgba(255,64,64,0.25)", color:"#ff4040", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>🗑️ Xóa cache</button>
                  <button style={{ padding:"9px 16px", borderRadius:10, background:"rgba(255,64,64,0.1)", border:"1px solid rgba(255,64,64,0.25)", color:"#ff4040", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>🔄 Reset dữ liệu test</button>
                </div>
              </div>

              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 20px", marginBottom:14 }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700, marginBottom:14 }}>💾 Backup dữ liệu</div>
                {[
                  { label:"Backup gần nhất",     value:"— (chưa cấu hình)" },
                  { label:"Kích thước",          value:"—" },
                  { label:"Số lần backup/ngày",  value:"Chưa bật" },
                  { label:"Lưu trữ",             value:"Supabase Storage" },
                ].map(item => (
                  <div key={item.label} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color:"#6a5a40", fontSize:11 }}>{item.label}</span>
                    <span style={{ color:"#f0eaff", fontSize:11, fontWeight:600 }}>{item.value}</span>
                  </div>
                ))}
                <button style={{ marginTop:14, padding:"9px 20px", borderRadius:10, background:"rgba(74,143,245,0.1)", border:"1px solid rgba(74,143,245,0.25)", color:"#4a8ff5", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>📥 Tạo backup thủ công</button>
              </div>

              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 20px" }}>
                <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700, marginBottom:14 }}>📊 Trạng thái hệ thống</div>
                {[
                  { service:"Supabase Database", status:"online" },
                  { service:"Supabase Auth",     status:"online" },
                  { service:"Supabase Realtime", status:"online" },
                  { service:"Firebase FCM",      status:"online" },
                  { service:"ESMS OTP",          status:"online" },
                  { service:"Vercel Edge",       status:"online" },
                ].map(s => (
                  <div key={s.service} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:"#3ecf6e", display:"inline-block", boxShadow:"0 0 5px #3ecf6e" }} />
                      <span style={{ color:"#f0eaff", fontSize:11 }}>{s.service}</span>
                    </div>
                    <span style={{ color:"#3ecf6e", fontSize:10 }}>● online</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </AdminShell>
  )
}
