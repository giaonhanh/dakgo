"use client"

import { useState } from "react"

const NAV_ITEMS = [
  { icon: "🏠",  label: "Dashboard",    href: "/admin",               active: false },
  { icon: "🏍️", label: "Tài xế",        href: "/admin/drivers",       active: false },
  { icon: "🏪",  label: "Cửa hàng",      href: "/admin/merchants",     active: false },
  { icon: "📦",  label: "Đơn hàng",      href: "/admin/orders",        active: false },
  { icon: "👥",  label: "Khách hàng",    href: "/admin/users",         active: false },
  { icon: "💰",  label: "Tài chính",     href: "/admin/finance",       active: false },
  { icon: "🗺️", label: "Bản đồ live",   href: "/admin/map",           active: false },
  { icon: "🏷️", label: "Khuyến mãi",    href: "/admin/promotions",    active: false },
  { icon: "⚖️",  label: "Tranh chấp",    href: "/admin/disputes",      active: false },
  { icon: "📣",  label: "Thông báo",     href: "/admin/notifications", active: false },
  { icon: "⚙️",  label: "Cài đặt",       href: "/admin/settings",      active: true  },
]

type SettingSection = "delivery" | "commission" | "area" | "features" | "account" | "maintenance"

interface ToggleSetting {
  key: string; label: string; description: string; value: boolean
}

interface InputSetting {
  key: string; label: string; description: string; value: string; unit: string; type?: string
}

export default function AdminSettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeSection, setActiveSection] = useState<SettingSection>("delivery")
  const [saved, setSaved] = useState(false)

  // Delivery settings
  const [deliverySettings, setDeliverySettings] = useState({
    baseFee: "15000",
    feePerKm: "4500",
    freeShipRadius: "1.5",
    maxRadius: "10",
    rushHourMultiplier: "1.3",
    rainMultiplier: "1.2",
    minDriverRating: "4.0",
  })

  // Commission settings
  const [commissionSettings, setCommissionSettings] = useState({
    defaultRate: "15",
    minRate: "10",
    maxRate: "25",
    driverSharePercent: "80",
    platformSharePercent: "20",
    loyaltyPointsRate: "1",
  })

  // Feature flags
  const [features, setFeatures] = useState<ToggleSetting[]>([
    { key:"maintenance_mode",  label:"Chế độ bảo trì",          description:"Tắt ứng dụng với khách hàng, chỉ admin có thể vào",             value:false },
    { key:"new_user_register", label:"Cho đăng ký mới",          description:"Cho phép khách hàng mới đăng ký tài khoản",                     value:true  },
    { key:"driver_register",   label:"Tuyển tài xế mới",         description:"Cho phép tài xế nộp đơn đăng ký",                               value:true  },
    { key:"merchant_register", label:"Tuyển merchant mới",       description:"Cho phép cửa hàng đăng ký tham gia",                             value:true  },
    { key:"flash_sale",        label:"Flash Sale",                description:"Bật tính năng Flash Sale trên trang chủ",                        value:true  },
    { key:"loyalty_program",   label:"Chương trình tích điểm",   description:"Khách hàng tích điểm từ mỗi đơn hàng",                          value:true  },
    { key:"surge_pricing",     label:"Giá tăng theo nhu cầu",    description:"Tự động tăng phí ship khi nhu cầu cao hoặc trời mưa",           value:false },
    { key:"ride_service",      label:"Dịch vụ xe ôm / Taxi",     description:"Cho phép đặt xe ôm và taxi",                                    value:true  },
    { key:"errand_service",    label:"Dịch vụ mua hộ / giao hộ", description:"Cho phép đặt dịch vụ mua hộ và giao hộ",                       value:true  },
    { key:"wallet_topup",      label:"Nạp ví điện tử",           description:"Cho phép nạp tiền vào ví qua VietQR / MoMo",                   value:false },
  ])

  // Area settings
  const [areaSettings, setAreaSettings] = useState({
    centerLat: "12.6521",
    centerLng: "108.5073",
    serviceName: "Phước An, Krông Pắc, Đắk Lắk",
    coverageRadius: "10",
    timezone: "Asia/Ho_Chi_Minh",
  })

  const toggleFeature = (key: string) => {
    setFeatures(p => p.map(f => f.key===key ? {...f, value:!f.value} : f))
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const SECTIONS: { key: SettingSection; label: string; icon: string }[] = [
    { key:"delivery",    label:"Phí giao hàng",  icon:"🛵" },
    { key:"commission",  label:"Hoa hồng",       icon:"💰" },
    { key:"area",        label:"Khu vực",         icon:"🗺️" },
    { key:"features",    label:"Tính năng",       icon:"⚙️" },
    { key:"account",     label:"Tài khoản admin", icon:"👤" },
    { key:"maintenance", label:"Bảo trì",         icon:"🔧" },
  ]

  const renderInput = (label: string, desc: string, value: string, onChange: (v:string)=>void, unit: string, type = "number") => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ flex:1 }}>
        <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600, marginBottom:2 }}>{label}</div>
        <div style={{ color:"#6a5a40", fontSize:10 }}>{desc}</div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <input type={type} value={value} onChange={e=>onChange(e.target.value)} style={{ width:90, padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f0eaff", fontSize:12, textAlign:"right" }} />
        {unit && <span style={{ color:"#6a5a40", fontSize:11, minWidth:24 }}>{unit}</span>}
      </div>
    </div>
  )

  return (
    <>
      <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #06050a; font-family: 'Lexend', sans-serif; height: 100%; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,107,0,0.3); border-radius: 2px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes savedPop { 0%{transform:scale(.8);opacity:0} 50%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; }
        .section-tab:hover { background: rgba(255,255,255,0.05) !important; }
        input { font-family: 'Lexend', sans-serif; outline: none; }
      `}</style>

      <div style={{ display:"flex", height:"100vh", background:"#06050a", color:"#f0eaff", overflow:"hidden" }}>

        {/* SIDEBAR */}
        <div style={{ width: sidebarOpen ? 220 : 60, flexShrink:0, background:"rgba(12,11,20,0.95)", backdropFilter:"blur(20px)", borderRight:"1px solid rgba(255,107,0,0.12)", display:"flex", flexDirection:"column", transition:"width 0.25s ease", overflow:"hidden", zIndex:50 }}>
          <div style={{ height:56, display:"flex", alignItems:"center", padding:"0 14px", borderBottom:"1px solid rgba(255,255,255,0.06)", gap:10, flexShrink:0 }}>
            <div style={{ width:30, height:30, borderRadius:9, flexShrink:0, background:"linear-gradient(135deg,#FF6B00,#FF8C00,#FFB347)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🚀</div>
            {sidebarOpen && <div><div style={{ color:"#f0eaff", fontSize:13, fontWeight:800, lineHeight:1 }}>GiaoNhanh</div><div style={{ color:"#6a5a40", fontSize:9 }}>Admin Panel</div></div>}
          </div>
          <nav style={{ flex:1, padding:"8px", overflowY:"auto" }}>
            {NAV_ITEMS.map(item => (
              <a key={item.href} href={item.href} className="sidebar-link" style={{ display:"flex", alignItems:"center", gap:10, height:40, borderRadius:10, padding:"0 10px", marginBottom:2, textDecoration:"none", background: item.active ? "rgba(255,107,0,0.12)" : "transparent", borderLeft: item.active ? "2px solid #FF6B00" : "2px solid transparent", color: item.active ? "#FF8C00" : "#6a5a40", fontSize:12, fontWeight: item.active ? 700 : 400, whiteSpace:"nowrap", overflow:"hidden", transition:"all 0.2s" }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </a>
            ))}
          </nav>
          <button onClick={() => setSidebarOpen(p => !p)} style={{ margin:"8px", height:36, borderRadius:10, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#6a5a40", fontSize:16, cursor:"pointer", flexShrink:0 }}>
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* MAIN */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Top bar */}
          <div style={{ height:56, borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", flexShrink:0 }}>
            <div>
              <div style={{ color:"#f0eaff", fontSize:16, fontWeight:800 }}>⚙️ Cài đặt hệ thống</div>
              <div style={{ color:"#6a5a40", fontSize:10 }}>Cấu hình · Tính năng · Khu vực · Tài khoản</div>
            </div>
            <button onClick={handleSave} style={{ padding:"8px 24px", borderRadius:10, background: saved ? "rgba(62,207,110,0.2)" : "linear-gradient(90deg,#FF6B00,#FF8C00)", border: saved ? "1px solid rgba(62,207,110,0.4)" : "none", color: saved ? "#3ecf6e" : "#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", transition:"all 0.3s", animation: saved ? "savedPop 0.3s ease" : "none" }}>
              {saved ? "✅ Đã lưu!" : "💾 Lưu thay đổi"}
            </button>
          </div>

          {/* Content */}
          <div style={{ flex:1, display:"grid", gridTemplateColumns:"200px 1fr", overflow:"hidden" }}>

            {/* Section tabs */}
            <div style={{ borderRight:"1px solid rgba(255,255,255,0.06)", padding:"12px 10px", overflowY:"auto" }}>
              {SECTIONS.map(s => (
                <button key={s.key} onClick={() => setActiveSection(s.key)} className="section-tab" style={{ width:"100%", height:44, borderRadius:10, marginBottom:4, background: activeSection===s.key ? "rgba(255,107,0,0.12)" : "transparent", border: activeSection===s.key ? "1px solid rgba(255,107,0,0.3)" : "1px solid transparent", color: activeSection===s.key ? "#FF8C00" : "#6a5a40", fontSize:12, fontWeight: activeSection===s.key ? 700 : 400, cursor:"pointer", fontFamily:"Lexend", display:"flex", alignItems:"center", gap:8, padding:"0 12px", transition:"all 0.2s" }}>
                  <span style={{ fontSize:16 }}>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Settings content */}
            <div style={{ overflowY:"auto", padding:"24px 32px" }}>

              {/* DELIVERY */}
              {activeSection === "delivery" && (
                <div style={{ animation:"fadeUp 0.3s ease" }}>
                  <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>🛵 Phí giao hàng</div>
                  <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Cấu hình phí cơ bản, phí theo km và các hệ số nhân</div>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px" }}>
                    {renderInput("Phí giao hàng cơ bản", "Phí cố định cho mỗi đơn giao, không tính theo km",       deliverySettings.baseFee,           v => setDeliverySettings(p=>({...p,baseFee:v})),           "đ"  )}
                    {renderInput("Phí theo km",           "Phí tính thêm cho mỗi km vượt qua bán kính miễn phí",   deliverySettings.feePerKm,          v => setDeliverySettings(p=>({...p,feePerKm:v})),          "đ/km")}
                    {renderInput("Bán kính miễn phí",     "Bán kính (km) áp dụng phí cơ bản, không tính thêm",    deliverySettings.freeShipRadius,    v => setDeliverySettings(p=>({...p,freeShipRadius:v})),    "km" )}
                    {renderInput("Bán kính tối đa",       "Khoảng cách giao hàng tối đa hệ thống chấp nhận",      deliverySettings.maxRadius,         v => setDeliverySettings(p=>({...p,maxRadius:v})),         "km" )}
                    {renderInput("Hệ số giờ cao điểm",    "Nhân phí trong giờ cao điểm (7-9h, 11-13h, 17-19h)",   deliverySettings.rushHourMultiplier, v => setDeliverySettings(p=>({...p,rushHourMultiplier:v})), "x"  )}
                    {renderInput("Hệ số trời mưa",        "Nhân phí khi điều kiện thời tiết xấu",                 deliverySettings.rainMultiplier,    v => setDeliverySettings(p=>({...p,rainMultiplier:v})),    "x"  )}
                    {renderInput("Đánh giá tài xế tối thiểu","Điểm đánh giá tối thiểu để tài xế nhận đơn",       deliverySettings.minDriverRating,   v => setDeliverySettings(p=>({...p,minDriverRating:v})),   "⭐" )}
                  </div>
                </div>
              )}

              {/* COMMISSION */}
              {activeSection === "commission" && (
                <div style={{ animation:"fadeUp 0.3s ease" }}>
                  <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>💰 Hoa hồng</div>
                  <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Tỉ lệ hoa hồng mặc định và chia sẻ doanh thu</div>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px" }}>
                    {renderInput("Tỉ lệ hoa hồng mặc định",  "Áp dụng cho cửa hàng mới, chưa đàm phán riêng",          commissionSettings.defaultRate,         v => setCommissionSettings(p=>({...p,defaultRate:v})),         "%" )}
                    {renderInput("Tỉ lệ tối thiểu",           "Không được đặt tỉ lệ dưới mức này cho bất kỳ cửa hàng", commissionSettings.minRate,             v => setCommissionSettings(p=>({...p,minRate:v})),             "%" )}
                    {renderInput("Tỉ lệ tối đa",              "Không được vượt mức này trong hợp đồng với cửa hàng",   commissionSettings.maxRate,             v => setCommissionSettings(p=>({...p,maxRate:v})),             "%" )}
                    {renderInput("Phần tài xế hưởng",         "% từ phí giao hàng thuộc về tài xế",                    commissionSettings.driverSharePercent,  v => setCommissionSettings(p=>({...p,driverSharePercent:v})),  "%" )}
                    {renderInput("Phần nền tảng",              "% từ phí giao hàng thuộc về nền tảng",                  commissionSettings.platformSharePercent, v => setCommissionSettings(p=>({...p,platformSharePercent:v})), "%" )}
                    {renderInput("Tích điểm",                  "Số điểm thưởng cho mỗi 10.000đ chi tiêu",               commissionSettings.loyaltyPointsRate,   v => setCommissionSettings(p=>({...p,loyaltyPointsRate:v})),   "điểm/10k")}
                  </div>
                </div>
              )}

              {/* AREA */}
              {activeSection === "area" && (
                <div style={{ animation:"fadeUp 0.3s ease" }}>
                  <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>🗺️ Khu vực hoạt động</div>
                  <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Tọa độ trung tâm, bán kính phủ sóng, múi giờ</div>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"0 20px" }}>
                    {renderInput("Vĩ độ trung tâm (Lat)",    "Tọa độ vĩ độ của trung tâm khu vực phục vụ",            areaSettings.centerLat,      v => setAreaSettings(p=>({...p,centerLat:v})),      "°N", "text" )}
                    {renderInput("Kinh độ trung tâm (Lng)",  "Tọa độ kinh độ của trung tâm khu vực phục vụ",          areaSettings.centerLng,      v => setAreaSettings(p=>({...p,centerLng:v})),      "°E", "text" )}
                    {renderInput("Bán kính phủ sóng",        "Bán kính tính từ trung tâm để tìm kiếm quán gần nhất",  areaSettings.coverageRadius, v => setAreaSettings(p=>({...p,coverageRadius:v})), "km"  )}
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
                <div style={{ animation:"fadeUp 0.3s ease" }}>
                  <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>⚙️ Bật/Tắt tính năng</div>
                  <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Feature flags — thay đổi có hiệu lực ngay lập tức</div>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
                    {features.map((f, i) => (
                      <div key={f.key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom: i<features.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: f.key==="maintenance_mode" && f.value ? "rgba(255,64,64,0.04)" : "transparent" }}>
                        <div>
                          <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600, marginBottom:2 }}>{f.label}</div>
                          <div style={{ color:"#6a5a40", fontSize:10 }}>{f.description}</div>
                        </div>
                        <button onClick={() => toggleFeature(f.key)} style={{ width:48, height:26, borderRadius:13, background: f.value ? (f.key==="maintenance_mode" ? "#ff4040" : "#3ecf6e") : "rgba(255,255,255,0.08)", border:"none", cursor:"pointer", position:"relative", flexShrink:0, transition:"background 0.2s" }}>
                          <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left: f.value ? 25 : 3, transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACCOUNT */}
              {activeSection === "account" && (
                <div style={{ animation:"fadeUp 0.3s ease" }}>
                  <div style={{ color:"#f0eaff", fontSize:15, fontWeight:700, marginBottom:4 }}>👤 Tài khoản quản trị</div>
                  <div style={{ color:"#6a5a40", fontSize:11, marginBottom:20 }}>Thông tin và bảo mật tài khoản admin</div>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px" }}>
                    <div style={{ display:"flex", gap:16, marginBottom:20, alignItems:"center" }}>
                      <div style={{ width:64, height:64, borderRadius:16, background:"linear-gradient(135deg,#FF6B00,#FFB347)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>👑</div>
                      <div>
                        <div style={{ color:"#f0eaff", fontSize:16, fontWeight:800 }}>Quản trị viên</div>
                        <div style={{ color:"#6a5a40", fontSize:11 }}>hongmy.daklak@gmail.com</div>
                        <span style={{ padding:"2px 10px", borderRadius:6, background:"rgba(255,107,0,0.1)", color:"#FF8C00", fontSize:10, fontWeight:700 }}>Super Admin</span>
                      </div>
                    </div>
                    {[
                      { label:"Họ tên",        placeholder:"Quản trị viên",         type:"text"     },
                      { label:"Email",          placeholder:"hongmy.daklak@gmail.com", type:"email"  },
                      { label:"Số điện thoại", placeholder:"0901234567",             type:"tel"      },
                    ].map(f => (
                      <div key={f.label} style={{ marginBottom:12 }}>
                        <div style={{ color:"#6a5a40", fontSize:10, marginBottom:6 }}>{f.label}</div>
                        <input type={f.type} placeholder={f.placeholder} style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px", marginTop:14 }}>
                    <div style={{ color:"#f0eaff", fontSize:13, fontWeight:700, marginBottom:12 }}>🔐 Đổi mật khẩu</div>
                    {["Mật khẩu hiện tại","Mật khẩu mới","Xác nhận mật khẩu mới"].map(l => (
                      <div key={l} style={{ marginBottom:10 }}>
                        <div style={{ color:"#6a5a40", fontSize:10, marginBottom:5 }}>{l}</div>
                        <input type="password" placeholder="••••••••" style={{ width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"#f0eaff", fontSize:12 }} />
                      </div>
                    ))}
                    <button style={{ marginTop:8, padding:"9px 20px", borderRadius:10, background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.25)", color:"#FF8C00", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>Đổi mật khẩu</button>
                  </div>
                </div>
              )}

              {/* MAINTENANCE */}
              {activeSection === "maintenance" && (
                <div style={{ animation:"fadeUp 0.3s ease" }}>
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
                      { label:"Backup gần nhất",  value:"17/05/2025 02:00 AM", ok:true },
                      { label:"Kích thước",       value:"256 MB",              ok:true },
                      { label:"Số lần backup/ngày",value:"4 lần",             ok:true },
                      { label:"Lưu trữ",           value:"Supabase Storage",  ok:true },
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
                      { service:"Supabase Database", status:"online", latency:"12ms"  },
                      { service:"Supabase Auth",     status:"online", latency:"8ms"   },
                      { service:"Supabase Realtime", status:"online", latency:"5ms"   },
                      { service:"Firebase FCM",      status:"online", latency:"45ms"  },
                      { service:"ESMS OTP",          status:"online", latency:"320ms" },
                      { service:"Vercel Edge",       status:"online", latency:"3ms"   },
                    ].map(s => (
                      <div key={s.service} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ width:7, height:7, borderRadius:"50%", background:"#3ecf6e", display:"inline-block", boxShadow:"0 0 5px #3ecf6e" }} />
                          <span style={{ color:"#f0eaff", fontSize:11 }}>{s.service}</span>
                        </div>
                        <span style={{ color:"#3ecf6e", fontSize:10 }}>{s.latency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
