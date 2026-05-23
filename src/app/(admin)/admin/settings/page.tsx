"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

type SettingSection = "pricing" | "commission" | "area" | "features" | "account" | "maintenance"
type ServiceType    = "food" | "delivery_pkg" | "errand" | "motorbike" | "taxi"

interface ToggleSetting { key: string; label: string; description: string; value: boolean }

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
  const [pricing, setPricing] = useState<Record<ServiceType, { rows: string[]; extra: string }>>({
    food:         { rows: ["15000","12000","10000","9000","8000","7500","7000","6500","6000","5500"], extra: "5000" },
    delivery_pkg: { rows: ["18000","15000","12000","10000","9000","8500","8000","7500","7000","6500"], extra: "6000" },
    errand:       { rows: ["20000","17000","14000","12000","11000","10000","9000","8500","8000","7500"], extra: "7000" },
    motorbike:    { rows: ["10000","8000","7000","6500","6000","5500","5000","4800","4600","4500"],    extra: "4000" },
    taxi:         { rows: ["15000","13000","11000","10000","9500","9000","8500","8000","7500","7000"], extra: "6500" },
  })

  const SERVICE_META: Record<ServiceType, { label: string; icon: string; color: string; desc: string }> = {
    food:         { label: "Giao đồ ăn",  icon: "🍜", color: "#FF6B00", desc: "Giao thức ăn từ cửa hàng đến khách" },
    delivery_pkg: { label: "Giao hàng",   icon: "📦", color: "#4a8ff5", desc: "Giao bưu kiện, hàng hóa thông thường" },
    errand:       { label: "Mua hộ",      icon: "🛒", color: "#3ecf6e", desc: "Tài xế mua hàng theo yêu cầu và giao" },
    motorbike:    { label: "Xe ôm",       icon: "🏍️", color: "#b464ff", desc: "Đặt xe ôm di chuyển cá nhân" },
    taxi:         { label: "Taxi",         icon: "🚗", color: "#f5c542", desc: "Đặt taxi 4 chỗ / 7 chỗ" },
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

  /* ── Delivery adjustments ── */
  const [deliverySettings, setDeliverySettings] = useState({
    maxRadius: "10", rushHourMultiplier: "1.3", rainMultiplier: "1.2", minDriverRating: "4.0",
  })

  /* ── New: hours, weather, night surcharge ── */
  const [appHours,        setAppHours]        = useState({ open: "07:00", close: "21:00" })
  const [weatherSurcharge, setWeatherSurcharge] = useState<{ enabled: boolean; type: "percent"|"fixed"; value: string }>({ enabled: false, type: "percent", value: "20" })
  const [nightSurcharge,  setNightSurcharge]  = useState<{ enabled: boolean; start: string; end: string; fee: string }>({ enabled: false, start: "22:00", end: "05:00", fee: "5000" })

  /* ── Load all settings from Supabase on mount ── */
  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient()
      const { data } = await supabase.from("app_settings").select("key, value")
      if (!data) return
      const map = Object.fromEntries(data.map(r => [r.key, r.value]))
      if (map.pricing)          setPricing(map.pricing)
      if (map.commission)       setCommissionSettings(map.commission)
      if (map.features) {
        const f = map.features as Record<string, boolean>
        setFeatures(prev => prev.map(item => ({ ...item, value: f[item.key] ?? item.value })))
      }
      if (map.area)             setAreaSettings(map.area)
      if (map.delivery)         setDeliverySettings(map.delivery)
      if (map.app_hours)        setAppHours(map.app_hours)
      if (map.weather_surcharge) setWeatherSurcharge(map.weather_surcharge)
      if (map.night_surcharge)  setNightSurcharge(map.night_surcharge)
    }
    loadSettings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Commission ── */
  const [commissionSettings, setCommissionSettings] = useState({
    defaultRate: "15", minRate: "10", maxRate: "25",
    driverSharePercent: "80", platformSharePercent: "20", loyaltyPointsRate: "1",
  })

  /* ── Features ── */
  const [features, setFeatures] = useState<ToggleSetting[]>([
    { key:"maintenance_mode",  label:"Chế độ bảo trì",          description:"Tắt ứng dụng với khách hàng, chỉ admin có thể vào",              value:false },
    { key:"new_user_register", label:"Cho đăng ký mới",          description:"Cho phép khách hàng mới đăng ký tài khoản",                      value:true  },
    { key:"driver_register",   label:"Tuyển tài xế mới",         description:"Cho phép tài xế nộp đơn đăng ký",                                value:true  },
    { key:"merchant_register", label:"Tuyển merchant mới",       description:"Cho phép cửa hàng đăng ký tham gia",                              value:true  },
    { key:"flash_sale",        label:"Flash Sale",                description:"Bật tính năng Flash Sale trên trang chủ",                         value:true  },
    { key:"loyalty_program",   label:"Chương trình tích điểm",   description:"Khách hàng tích điểm từ mỗi đơn hàng",                           value:true  },
    { key:"surge_pricing",     label:"Giá tăng theo nhu cầu",    description:"Tự động tăng phí ship khi nhu cầu cao hoặc trời mưa",            value:false },
    { key:"ride_service",      label:"Dịch vụ xe ôm / Taxi",     description:"Cho phép đặt xe ôm và taxi",                                     value:true  },
    { key:"errand_service",    label:"Dịch vụ mua hộ / giao hộ", description:"Cho phép đặt dịch vụ mua hộ và giao hộ",                        value:true  },
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
      const featuresMap = Object.fromEntries(features.map(f => [f.key, f.value]))
      const upsertRows = [
        { key: "pricing",           value: pricing },
        { key: "commission",        value: commissionSettings },
        { key: "features",          value: featuresMap },
        { key: "area",              value: areaSettings },
        { key: "delivery",          value: deliverySettings },
        { key: "app_hours",         value: appHours },
        { key: "weather_surcharge", value: weatherSurcharge },
        { key: "night_surcharge",   value: nightSurcharge },
      ]
      await supabase.from("app_settings")
        .upsert(upsertRows.map(r => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "key" })

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
    { key:"features",    label:"Tính năng",        icon:"⚙️" },
    { key:"account",     label:"Tài khoản admin",  icon:"👤" },
    { key:"maintenance", label:"Bảo trì",          icon:"🔧" },
  ]

  const renderInput = (label: string, desc: string, value: string, onChange: (v: string) => void, unit: string, type = "number") => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ flex:1 }}>
        <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600, marginBottom:2 }}>{label}</div>
        <div style={{ color:"#6a5a40", fontSize:10 }}>{desc}</div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <input type={type} value={value} onChange={e=>onChange(e.target.value)}
          style={{ width:90, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, textAlign:"right" }} />
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
                        <input type="number" value={price} placeholder={isEmpty && i > 0 ? eff : ""} onChange={e => updateKmPrice(activeService, i, e.target.value)}
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
                    <input type="number" value={pricing[activeService].extra} onChange={e => setPricing(p => ({ ...p, [activeService]: { ...p[activeService], extra: e.target.value } }))}
                      style={{ width:90, padding:"7px 10px", background:"rgba(255,107,0,0.08)", border:"1px solid rgba(255,107,0,0.25)", borderRadius:8, color:"#FF8C00", fontSize:12, textAlign:"right", fontFamily:"Lexend", outline:"none" }} />
                  </div>
                  <div style={{ textAlign:"right", paddingRight:8 }}><span style={{ fontSize:10, color:"#6a5a40" }}>cộng thêm mỗi km</span></div>
                </div>
              </div>

              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px", marginBottom:14 }}>
                <div style={{ padding:"12px 0 4px", color:"#f0eaff", fontSize:12, fontWeight:700 }}>🛵 Điều chỉnh & hệ số</div>
                {renderInput("Bán kính tối đa",         "Khoảng cách tối đa hệ thống chấp nhận đơn",          deliverySettings.maxRadius,          v => setDeliverySettings(p=>({...p,maxRadius:v})),          "km")}
                {renderInput("Hệ số giờ cao điểm",      "Nhân phí trong giờ cao điểm (7-9h, 11-13h, 17-19h)",deliverySettings.rushHourMultiplier, v => setDeliverySettings(p=>({...p,rushHourMultiplier:v})), "x")}
                {renderInput("Hệ số trời mưa",          "Nhân phí khi thời tiết xấu",                         deliverySettings.rainMultiplier,     v => setDeliverySettings(p=>({...p,rainMultiplier:v})),     "x")}
                {renderInput("Rating tài xế tối thiểu", "Điểm đánh giá tối thiểu để nhận đơn",                deliverySettings.minDriverRating,    v => setDeliverySettings(p=>({...p,minDriverRating:v})),    "⭐")}
              </div>

              {/* App hours */}
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px", marginBottom:14 }}>
                <div style={{ padding:"12px 0 4px", color:"#f0eaff", fontSize:12, fontWeight:700 }}>🕐 Khung giờ hoạt động app</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600, marginBottom:2 }}>Giờ mở cửa</div>
                    <div style={{ color:"#6a5a40", fontSize:10 }}>App bắt đầu nhận đơn từ giờ này</div>
                  </div>
                  <input type="time" value={appHours.open} onChange={e => setAppHours(p=>({...p, open: e.target.value}))}
                    style={{ padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, fontFamily:"Lexend", colorScheme:"dark" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600, marginBottom:2 }}>Giờ đóng cửa</div>
                    <div style={{ color:"#6a5a40", fontSize:10 }}>App ngừng nhận đơn sau giờ này</div>
                  </div>
                  <input type="time" value={appHours.close} onChange={e => setAppHours(p=>({...p, close: e.target.value}))}
                    style={{ padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, fontFamily:"Lexend", colorScheme:"dark" }} />
                </div>
              </div>

              {/* Weather surcharge */}
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px", marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0 8px" }}>
                  <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>⛈️ Phụ phí thời tiết xấu</div>
                  <button onClick={() => setWeatherSurcharge(p=>({...p, enabled: !p.enabled}))}
                    style={{ width:48, height:26, borderRadius:13, background: weatherSurcharge.enabled ? "#3ecf6e" : "rgba(255,255,255,0.08)", border:"none", cursor:"pointer", position:"relative", flexShrink:0, transition:"background .2s" }}>
                    <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left: weatherSurcharge.enabled ? 25 : 3, transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }} />
                  </button>
                </div>
                {weatherSurcharge.enabled && (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600 }}>Loại phụ phí</div>
                      <div style={{ display:"flex", gap:6 }}>
                        {(["percent","fixed"] as const).map(t => (
                          <button key={t} onClick={() => setWeatherSurcharge(p=>({...p, type: t}))}
                            style={{ padding:"5px 14px", borderRadius:8, border: weatherSurcharge.type===t ? "1.5px solid rgba(255,107,0,0.5)" : "1.5px solid rgba(255,255,255,0.1)", background: weatherSurcharge.type===t ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.03)", color: weatherSurcharge.type===t ? "#FF8C00" : "#6a5a40", fontSize:11, fontWeight: weatherSurcharge.type===t ? 700 : 400, cursor:"pointer", fontFamily:"Lexend" }}>
                            {t === "percent" ? "%" : "Tiền cố định"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0 14px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                      <div>
                        <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600, marginBottom:2 }}>Giá trị phụ phí</div>
                        <div style={{ color:"#6a5a40", fontSize:10 }}>{weatherSurcharge.type === "percent" ? "Phần trăm cộng thêm vào cước" : "Số tiền cộng thêm cố định"}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <input type="number" value={weatherSurcharge.value} onChange={e => setWeatherSurcharge(p=>({...p, value: e.target.value}))}
                          style={{ width:90, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, textAlign:"right" }} />
                        <span style={{ color:"#6a5a40", fontSize:11, minWidth:24 }}>{weatherSurcharge.type === "percent" ? "%" : "đ"}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Night surcharge */}
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px", marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0 8px" }}>
                  <div style={{ color:"#f0eaff", fontSize:12, fontWeight:700 }}>🌙 Phụ phí đêm khuya</div>
                  <button onClick={() => setNightSurcharge(p=>({...p, enabled: !p.enabled}))}
                    style={{ width:48, height:26, borderRadius:13, background: nightSurcharge.enabled ? "#3ecf6e" : "rgba(255,255,255,0.08)", border:"none", cursor:"pointer", position:"relative", flexShrink:0, transition:"background .2s" }}>
                    <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left: nightSurcharge.enabled ? 25 : 3, transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }} />
                  </button>
                </div>
                {nightSurcharge.enabled && (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                      <div>
                        <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600, marginBottom:2 }}>Bắt đầu từ</div>
                        <div style={{ color:"#6a5a40", fontSize:10 }}>Giờ bắt đầu tính phụ phí đêm</div>
                      </div>
                      <input type="time" value={nightSurcharge.start} onChange={e => setNightSurcharge(p=>({...p, start: e.target.value}))}
                        style={{ padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, fontFamily:"Lexend", colorScheme:"dark" }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                      <div>
                        <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600, marginBottom:2 }}>Đến hết</div>
                        <div style={{ color:"#6a5a40", fontSize:10 }}>Giờ kết thúc phụ phí đêm (hôm sau)</div>
                      </div>
                      <input type="time" value={nightSurcharge.end} onChange={e => setNightSurcharge(p=>({...p, end: e.target.value}))}
                        style={{ padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, fontFamily:"Lexend", colorScheme:"dark" }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0 14px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                      <div>
                        <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600, marginBottom:2 }}>Phụ phí thêm</div>
                        <div style={{ color:"#6a5a40", fontSize:10 }}>Số tiền cộng thêm vào mỗi đơn trong khung giờ này</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <input type="number" value={nightSurcharge.fee} onChange={e => setNightSurcharge(p=>({...p, fee: e.target.value}))}
                          style={{ width:90, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, textAlign:"right" }} />
                        <span style={{ color:"#6a5a40", fontSize:11, minWidth:24 }}>đ</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

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
            </div>
          )}

          {/* COMMISSION */}
          {activeSection === "commission" && (
            <div style={{ animation:"fadeUp .3s ease" }}>
              <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>💰 Hoa hồng</div>
              <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Tỉ lệ hoa hồng mặc định và chia sẻ doanh thu</div>
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px" }}>
                {renderInput("Tỉ lệ hoa hồng mặc định",   "Áp dụng cho cửa hàng mới, chưa đàm phán riêng",           commissionSettings.defaultRate,          v => setCommissionSettings(p=>({...p,defaultRate:v})),          "%")}
                {renderInput("Tỉ lệ tối thiểu",             "Không được đặt dưới mức này cho bất kỳ cửa hàng",         commissionSettings.minRate,              v => setCommissionSettings(p=>({...p,minRate:v})),              "%")}
                {renderInput("Tỉ lệ tối đa",                "Không được vượt mức này trong hợp đồng",                  commissionSettings.maxRate,              v => setCommissionSettings(p=>({...p,maxRate:v})),              "%")}
                {renderInput("Phần tài xế hưởng",           "% từ phí giao hàng thuộc về tài xế",                      commissionSettings.driverSharePercent,   v => setCommissionSettings(p=>({...p,driverSharePercent:v})),   "%")}
                {renderInput("Phần nền tảng",                "% từ phí giao hàng thuộc về nền tảng",                    commissionSettings.platformSharePercent, v => setCommissionSettings(p=>({...p,platformSharePercent:v})), "%")}
                {renderInput("Tích điểm",                    "Số điểm thưởng cho mỗi 10.000đ chi tiêu",                 commissionSettings.loyaltyPointsRate,    v => setCommissionSettings(p=>({...p,loyaltyPointsRate:v})),    "điểm/10k")}
              </div>
            </div>
          )}

          {/* AREA */}
          {activeSection === "area" && (
            <div style={{ animation:"fadeUp .3s ease" }}>
              <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>🗺️ Khu vực hoạt động</div>
              <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Tọa độ trung tâm, bán kính phủ sóng, múi giờ</div>
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px" }}>
                {renderInput("Vĩ độ trung tâm (Lat)",   "Tọa độ vĩ độ trung tâm khu vực phục vụ",              areaSettings.centerLat,      v => setAreaSettings(p=>({...p,centerLat:v})),      "°N","text")}
                {renderInput("Kinh độ trung tâm (Lng)", "Tọa độ kinh độ trung tâm khu vực phục vụ",             areaSettings.centerLng,      v => setAreaSettings(p=>({...p,centerLng:v})),      "°E","text")}
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
