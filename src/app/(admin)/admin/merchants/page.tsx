"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type ShopStatus = "pending" | "approved" | "suspended"

interface Merchant {
  id: string
  shopName: string
  ownerName: string
  phone: string
  address: string
  category: string
  categoryIcon: string
  status: ShopStatus
  registeredDate: string
  commissionRate: number
  rating: number | null
  totalOrders: number
  monthlyRevenue: number
  isOpen: boolean
  hasBizLicense: boolean
  hasHealthCert: boolean
  coverColor: string
}

const MERCHANTS: Merchant[] = [
  { id:"S001", shopName:"Bún Bò Huế Ngon",   ownerName:"Trần Thị Hoa",   phone:"0901111111", address:"22 Lê Hồng Phong, Phước An", category:"Bún/Phở",   categoryIcon:"🍜", status:"approved",   registeredDate:"01/03/2025", commissionRate:15, rating:4.8, totalOrders:342, monthlyRevenue:18500000, isOpen:true,  hasBizLicense:true,  hasHealthCert:true,  coverColor:"rgba(255,107,0,0.15)"  },
  { id:"S002", shopName:"Cơm Tấm Sài Gòn",   ownerName:"Nguyễn Văn Long", phone:"0912222222", address:"18 Trần Phú, Phước An",       category:"Cơm hộp",   categoryIcon:"🍱", status:"approved",   registeredDate:"15/03/2025", commissionRate:15, rating:4.6, totalOrders:218, monthlyRevenue:12300000, isOpen:true,  hasBizLicense:true,  hasHealthCert:true,  coverColor:"rgba(62,207,110,0.12)"  },
  { id:"S003", shopName:"Trà Sữa Ding Dong",  ownerName:"Lê Thị Mai",      phone:"0923333333", address:"5 Nguyễn Văn Cừ, Phước An",  category:"Đồ uống",   categoryIcon:"🥤", status:"pending",    registeredDate:"14/05/2025", commissionRate:12, rating:null, totalOrders:0,   monthlyRevenue:0,        isOpen:false, hasBizLicense:true,  hasHealthCert:false, coverColor:"rgba(74,143,245,0.12)"  },
  { id:"S004", shopName:"Gà Rán Phước An",    ownerName:"Phạm Văn Tú",     phone:"0934444444", address:"10 Hùng Vương, Phước An",     category:"Gà rán",    categoryIcon:"🍗", status:"pending",    registeredDate:"16/05/2025", commissionRate:15, rating:null, totalOrders:0,   monthlyRevenue:0,        isOpen:false, hasBizLicense:false, hasHealthCert:false, coverColor:"rgba(255,179,71,0.12)"  },
  { id:"S005", shopName:"Bánh Mì Thanh Nga",  ownerName:"Hoàng Thị Nga",   phone:"0945555555", address:"44 Phan Đình Phùng, Phước An",category:"Bánh mì",   categoryIcon:"🥖", status:"approved",   registeredDate:"20/02/2025", commissionRate:12, rating:4.9, totalOrders:485, monthlyRevenue:9800000,  isOpen:true,  hasBizLicense:true,  hasHealthCert:true,  coverColor:"rgba(245,197,66,0.12)"  },
  { id:"S006", shopName:"Cà Phê Sáng Sớm",   ownerName:"Vũ Văn Hải",      phone:"0956666666", address:"3 Đinh Tiên Hoàng, Phước An", category:"Đồ uống",   categoryIcon:"☕", status:"suspended",  registeredDate:"10/01/2025", commissionRate:10, rating:4.2, totalOrders:127, monthlyRevenue:0,        isOpen:false, hasBizLicense:true,  hasHealthCert:true,  coverColor:"rgba(255,64,64,0.12)"   },
  { id:"S007", shopName:"Pizza Phước An",     ownerName:"Đinh Thị Linh",   phone:"0967777777", address:"8 Lý Thường Kiệt, Phước An",  category:"Pizza",     categoryIcon:"🍕", status:"approved",   registeredDate:"05/04/2025", commissionRate:18, rating:4.5, totalOrders:96,  monthlyRevenue:8200000,  isOpen:true,  hasBizLicense:true,  hasHealthCert:true,  coverColor:"rgba(180,100,255,0.12)" },
  { id:"S008", shopName:"Kem Tươi Mát Lạnh",  ownerName:"Bùi Văn Sơn",     phone:"0978888888", address:"15 Quang Trung, Phước An",    category:"Bánh/Kem",  categoryIcon:"🧁", status:"pending",    registeredDate:"17/05/2025", commissionRate:10, rating:null, totalOrders:0,   monthlyRevenue:0,        isOpen:false, hasBizLicense:true,  hasHealthCert:false, coverColor:"rgba(74,143,245,0.10)"  },
]

const STATUS_CFG: Record<ShopStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:   { label: "Chờ duyệt",  color: "#FFB347", bg: "rgba(255,179,71,0.12)",  border: "rgba(255,179,71,0.3)"  },
  approved:  { label: "Đang hoạt động", color: "#3ecf6e", bg: "rgba(62,207,110,0.10)", border: "rgba(62,207,110,0.25)" },
  suspended: { label: "Tạm khóa",   color: "#ff4040", bg: "rgba(255,64,64,0.10)",   border: "rgba(255,64,64,0.25)"  },
}

const NAV_ITEMS = [
  { icon: "🏠",  label: "Dashboard",    href: "/admin"              },
  { icon: "🏍️", label: "Tài xế",       href: "/admin/drivers"      },
  { icon: "🏪",  label: "Cửa hàng",     href: "/admin/merchants", active: true },
  { icon: "📦",  label: "Đơn hàng",     href: "/admin/orders"       },
  { icon: "👥",  label: "Khách hàng",   href: "/admin/users"        },
  { icon: "💰",  label: "Tài chính",    href: "/admin/finance"      },
  { icon: "🗺️", label: "Bản đồ live",  href: "/admin/map"          },
  { icon: "🏷️", label: "Khuyến mãi",   href: "/admin/promotions"   },
  { icon: "⚖️",  label: "Tranh chấp",   href: "/admin/disputes"     },
  { icon: "📣",  label: "Thông báo",    href: "/admin/notifications" },
  { icon: "⚙️",  label: "Cài đặt",      href: "/admin/settings"     },
]

const CATEGORIES = ["Tất cả", "Bún/Phở", "Cơm hộp", "Gà rán", "Đồ uống", "Bánh mì", "Pizza", "Bánh/Kem"]

const fmt      = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtShort = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n.toLocaleString("vi-VN")

export default function AdminMerchantsPage() {
  const [sidebarOpen, setSidebarOpen]     = useState(true)
  const [merchants,   setMerchants]       = useState<Merchant[]>(MERCHANTS)
  const [filterStatus, setFilterStatus]   = useState<"all" | ShopStatus>("all")
  const [filterCat,   setFilterCat]       = useState("Tất cả")
  const [search,      setSearch]          = useState("")
  const [selected,    setSelected]        = useState<Merchant | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: "approve" | "suspend" | "reject" | "unsuspend"; id: string } | null>(null)

  const approve   = (id: string) => setMerchants(p => p.map(m => m.id === id ? { ...m, status: "approved"  } : m))
  const suspend   = (id: string) => setMerchants(p => p.map(m => m.id === id ? { ...m, status: "suspended", isOpen: false } : m))
  const reject    = (id: string) => setMerchants(p => p.map(m => m.id === id ? { ...m, status: "suspended" } : m))
  const unsuspend = (id: string) => setMerchants(p => p.map(m => m.id === id ? { ...m, status: "approved"  } : m))

  const counts = {
    all:       merchants.length,
    pending:   merchants.filter(m => m.status === "pending").length,
    approved:  merchants.filter(m => m.status === "approved").length,
    suspended: merchants.filter(m => m.status === "suspended").length,
    open:      merchants.filter(m => m.isOpen).length,
  }

  const totalRevenue = merchants.filter(m => m.status === "approved").reduce((s, m) => s + m.monthlyRevenue, 0)

  const shown = merchants
    .filter(m => filterStatus === "all" || m.status === filterStatus)
    .filter(m => filterCat === "Tất cả" || m.category === filterCat)
    .filter(m =>
      !search ||
      m.shopName.toLowerCase().includes(search.toLowerCase()) ||
      m.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase())
    )

  const execConfirm = () => {
    if (!confirmAction) return
    const { type, id } = confirmAction
    if (type === "approve")   approve(id)
    if (type === "suspend")   suspend(id)
    if (type === "reject")    reject(id)
    if (type === "unsuspend") unsuspend(id)
    setConfirmAction(null)
    setSelected(s => s?.id === id ? { ...s, status: type === "approve" || type === "unsuspend" ? "approved" : "suspended" } : s)
  }

  return (
    <>
      <style>{`
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #06050a; font-family: 'Lexend', sans-serif; height: 100%; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,107,0,0.25); border-radius: 2px; }
        input { outline: none; font-family: 'Lexend', sans-serif; }

        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes shimmer { 0% { left:-60%; } 100% { left:120%; } }

        .merchant-row:hover { background: rgba(255,107,0,0.04) !important; border-color: rgba(255,107,0,0.18) !important; }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; }
        .kpi-card { animation: fadeUp 0.35s ease both; }
        .kpi-card:hover { transform: translateY(-2px); transition: all 0.2s; }
        .action-btn:hover { filter: brightness(1.15); transform: scale(1.02); }
        .filter-tab:hover { border-color: rgba(255,107,0,0.3) !important; color: rgba(255,140,0,0.7) !important; }
        .cat-chip:hover { background: rgba(255,107,0,0.08) !important; border-color: rgba(255,107,0,0.25) !important; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", background: "#06050a", color: "#f0eaff", overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <div style={{
          width: sidebarOpen ? 220 : 60,
          flexShrink: 0,
          background: "rgba(10,9,18,0.97)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,107,0,0.1)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s ease",
          overflow: "hidden",
          zIndex: 50,
        }}>
          {/* Logo */}
          <div style={{
            height: 56, display: "flex", alignItems: "center",
            padding: "0 14px", gap: 10, flexShrink: 0,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: "linear-gradient(135deg, #FF6B00, #FF8C00, #FFB347)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
            }}>🚀</div>
            {sidebarOpen && (
              <div>
                <div style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700 }}>Giao Nhanh</div>
                <div style={{
                  fontSize: 8, fontWeight: 700, padding: "1px 5px",
                  background: "rgba(180,100,255,0.15)", border: "1px solid rgba(180,100,255,0.3)",
                  borderRadius: 4, color: "#b464ff", display: "inline-block",
                }}>ADMIN</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
            {NAV_ITEMS.map(item => (
              <a key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                <div className="sidebar-link" style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: sidebarOpen ? "8px 10px" : "8px",
                  borderRadius: 10, marginBottom: 3, cursor: "pointer",
                  transition: "all 0.2s",
                  background: item.active ? "rgba(255,107,0,0.12)" : "transparent",
                  borderLeft: item.active ? "2px solid #FF6B00" : "2px solid transparent",
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  {sidebarOpen && (
                    <span style={{
                      fontSize: 11, whiteSpace: "nowrap",
                      fontWeight: item.active ? 600 : 400,
                      color: item.active ? "#FF8C00" : "rgba(144,128,176,0.8)",
                    }}>{item.label}</span>
                  )}
                  {sidebarOpen && item.active && counts.pending > 0 && (
                    <span style={{
                      marginLeft: "auto", minWidth: 18, height: 18,
                      borderRadius: 9, background: "#FF6B00",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 800, color: "#fff",
                    }}>{counts.pending}</span>
                  )}
                </div>
              </a>
            ))}
          </nav>

          {/* Toggle */}
          <div onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", borderTop: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(144,128,176,0.5)", fontSize: 14, transition: "color 0.2s",
          }}>
            {sidebarOpen ? "◀" : "▶"}
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top bar */}
          <div style={{
            height: 56, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 20px",
            background: "rgba(10,9,18,0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div>
              <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Admin / Quản lý</div>
              <div style={{ color: "#f0eaff", fontSize: 13, fontWeight: 700 }}>🏪 Cửa hàng &amp; Merchant</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 9 }}>Phước An · {new Date().toLocaleDateString("vi-VN")}</div>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative",
              }}>
                🔔
                {counts.pending > 0 && (
                  <div style={{
                    position: "absolute", top: 5, right: 5,
                    width: 7, height: 7, borderRadius: "50%",
                    background: "#FF6B00", border: "1.5px solid #06050a",
                    boxShadow: "0 0 4px #FF6B00", animation: "pulse 1.5s infinite",
                  }} />
                )}
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(180,100,255,0.12)", border: "1px solid rgba(180,100,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer",
              }}>👤</div>
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

            {/* ── KPI Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
              {[
                { icon:"🏪",  label:"Tổng cửa hàng",      value: counts.all,       sub:`${counts.open} đang mở`,          c:"#FF8C00", bg:"rgba(255,107,0,0.07)",    bd:"rgba(255,107,0,0.2)",    delay:"0s"     },
                { icon:"✅",  label:"Đang hoạt động",      value: counts.approved,  sub:"Đã được duyệt",                   c:"#3ecf6e", bg:"rgba(62,207,110,0.07)",   bd:"rgba(62,207,110,0.2)",   delay:"0.06s"  },
                { icon:"⏳",  label:"Chờ duyệt",           value: counts.pending,   sub:"Cần xem xét",                     c:"#FFB347", bg:"rgba(255,179,71,0.07)",   bd:"rgba(255,179,71,0.2)",   delay:"0.12s"  },
                { icon:"🚫",  label:"Tạm khóa",            value: counts.suspended, sub:"Vi phạm",                         c:"#ff4040", bg:"rgba(255,64,64,0.07)",    bd:"rgba(255,64,64,0.2)",    delay:"0.18s"  },
                { icon:"📈",  label:"DT tháng (merchant)",  value: fmtShort(totalRevenue), sub:"Tổng platform",            c:"#b464ff", bg:"rgba(180,100,255,0.07)",  bd:"rgba(180,100,255,0.2)",  delay:"0.24s"  },
              ].map((k, i) => (
                <div key={i} className="kpi-card" style={{
                  background: k.bg, border: `1px solid ${k.bd}`,
                  borderRadius: 13, padding: "11px 12px",
                  animationDelay: k.delay, cursor: "default",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: k.bg, border: `1px solid ${k.bd}`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                    }}>{k.icon}</div>
                  </div>
                  <div style={{ color: k.c, fontSize: 22, fontWeight: 800, lineHeight: 1, marginBottom: 2 }}>{k.value}</div>
                  <div style={{ color: "rgba(240,234,255,0.55)", fontSize: 9 }}>{k.label}</div>
                  <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 8, marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Search + Filters ── */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 13, padding: "11px 13px", marginBottom: 12,
            }}>
              {/* Search bar */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 9, padding: "7px 11px", marginBottom: 10,
              }}>
                <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 14 }}>🔍</span>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm tên quán, chủ quán, mã cửa hàng..."
                  style={{
                    flex: 1, background: "transparent", border: "none", color: "#f0eaff",
                    fontSize: 11, letterSpacing: 0.2,
                  }}
                />
                {search && (
                  <span onClick={() => setSearch("")} style={{ color: "rgba(144,128,176,0.4)", cursor: "pointer", fontSize: 13 }}>✕</span>
                )}
              </div>

              {/* Status filter tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
                {([
                  { key: "all",       label: `Tất cả (${counts.all})`,           c: "#FF8C00"  },
                  { key: "approved",  label: `Hoạt động (${counts.approved})`,   c: "#3ecf6e"  },
                  { key: "pending",   label: `Chờ duyệt (${counts.pending})`,    c: "#FFB347"  },
                  { key: "suspended", label: `Tạm khóa (${counts.suspended})`,   c: "#ff4040"  },
                ] as const).map(tab => (
                  <button key={tab.key} className="filter-tab" onClick={() => setFilterStatus(tab.key)} style={{
                    padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                    fontFamily: "Lexend", fontSize: 9, fontWeight: filterStatus === tab.key ? 700 : 400,
                    background: filterStatus === tab.key ? `rgba(${tab.c === "#FF8C00" ? "255,107,0" : tab.c === "#3ecf6e" ? "62,207,110" : tab.c === "#FFB347" ? "255,179,71" : "255,64,64"},0.12)` : "rgba(255,255,255,0.04)",
                    border: filterStatus === tab.key ? `1px solid ${tab.c}55` : "1px solid rgba(255,255,255,0.07)",
                    color: filterStatus === tab.key ? tab.c : "rgba(144,128,176,0.6)",
                    transition: "all 0.2s",
                  }}>{tab.label}</button>
                ))}
              </div>

              {/* Category chips */}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} className="cat-chip" onClick={() => setFilterCat(cat)} style={{
                    padding: "3px 10px", borderRadius: 6, cursor: "pointer",
                    fontFamily: "Lexend", fontSize: 8, fontWeight: filterCat === cat ? 700 : 400,
                    background: filterCat === cat ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                    border: filterCat === cat ? "1px solid rgba(255,107,0,0.35)" : "1px solid rgba(255,255,255,0.07)",
                    color: filterCat === cat ? "#FF8C00" : "rgba(144,128,176,0.55)",
                    transition: "all 0.2s",
                  }}>{cat}</button>
                ))}
              </div>
            </div>

            {/* ── Merchant Table ── */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 13, overflow: "hidden",
            }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "52px 1.8fr 1.2fr 90px 80px 72px 68px 70px 110px",
                gap: 8, padding: "9px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.02)",
              }}>
                {["", "Cửa hàng", "Chủ / SĐT", "Danh mục", "Trạng thái", "Rating", "Đơn", "Hoa hồng", "Thao tác"].map(h => (
                  <div key={h} style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {shown.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>
                  Không tìm thấy cửa hàng nào
                </div>
              ) : shown.map((m, idx) => {
                const s = STATUS_CFG[m.status]
                return (
                  <div
                    key={m.id}
                    className="merchant-row"
                    onClick={() => setSelected(m)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "52px 1.8fr 1.2fr 90px 80px 72px 68px 70px 110px",
                      gap: 8, padding: "10px 14px",
                      borderBottom: idx < shown.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      cursor: "pointer", transition: "all 0.15s",
                      alignItems: "center",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                      background: m.coverColor,
                      border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, position: "relative",
                    }}>
                      {m.categoryIcon}
                      {m.isOpen && (
                        <div style={{
                          position: "absolute", bottom: 0, right: 0,
                          width: 10, height: 10, borderRadius: "50%",
                          background: "#3ecf6e", border: "1.5px solid #06050a",
                          boxShadow: "0 0 4px #3ecf6e",
                        }} />
                      )}
                    </div>

                    {/* Shop name */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#f0eaff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.shopName}</div>
                      <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 8, marginTop: 2 }}>{m.id} · Đăng ký {m.registeredDate}</div>
                      <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 8, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.address}</div>
                    </div>

                    {/* Owner */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#f0eaff", fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.ownerName}</div>
                      <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 8, marginTop: 2 }}>{m.phone}</div>
                    </div>

                    {/* Category */}
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: 6, padding: "3px 7px", width: "fit-content",
                    }}>
                      <span style={{ fontSize: 10 }}>{m.categoryIcon}</span>
                      <span style={{ color: "rgba(240,234,255,0.7)", fontSize: 8, fontWeight: 500 }}>{m.category}</span>
                    </div>

                    {/* Status */}
                    <div>
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: "3px 7px",
                        borderRadius: 5, border: `1px solid ${s.border}`,
                        background: s.bg, color: s.color, whiteSpace: "nowrap",
                      }}>{s.label}</span>
                    </div>

                    {/* Rating */}
                    <div>
                      {m.rating !== null ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <span style={{ color: "#f5c542", fontSize: 11 }}>⭐</span>
                          <span style={{ color: "#f0eaff", fontSize: 11, fontWeight: 700 }}>{m.rating}</span>
                        </div>
                      ) : (
                        <span style={{ color: "rgba(144,128,176,0.3)", fontSize: 9 }}>—</span>
                      )}
                    </div>

                    {/* Orders */}
                    <div style={{ color: m.totalOrders > 0 ? "#FF8C00" : "rgba(144,128,176,0.3)", fontSize: 11, fontWeight: m.totalOrders > 0 ? 700 : 400 }}>
                      {m.totalOrders > 0 ? m.totalOrders.toLocaleString() : "—"}
                    </div>

                    {/* Commission */}
                    <div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 6px",
                        borderRadius: 5, background: "rgba(180,100,255,0.1)",
                        border: "1px solid rgba(180,100,255,0.25)", color: "#b464ff",
                      }}>{m.commissionRate}%</span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                      {m.status === "pending" && (
                        <>
                          <button className="action-btn" onClick={() => setConfirmAction({ type: "approve", id: m.id })} style={{
                            padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend",
                            background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.3)",
                            color: "#3ecf6e", fontSize: 8, fontWeight: 700, transition: "all 0.15s",
                          }}>✅ Duyệt</button>
                          <button className="action-btn" onClick={() => setConfirmAction({ type: "reject", id: m.id })} style={{
                            padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend",
                            background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)",
                            color: "#ff4040", fontSize: 8, fontWeight: 700, transition: "all 0.15s",
                          }}>❌ Từ chối</button>
                        </>
                      )}
                      {m.status === "approved" && (
                        <button className="action-btn" onClick={() => setConfirmAction({ type: "suspend", id: m.id })} style={{
                          padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend",
                          background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)",
                          color: "#ff4040", fontSize: 8, fontWeight: 700, transition: "all 0.15s",
                        }}>🚫 Tạm khóa</button>
                      )}
                      {m.status === "suspended" && (
                        <button className="action-btn" onClick={() => setConfirmAction({ type: "unsuspend", id: m.id })} style={{
                          padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend",
                          background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)",
                          color: "#3ecf6e", fontSize: 8, fontWeight: 700, transition: "all 0.15s",
                        }}>♻️ Mở lại</button>
                      )}
                      <button className="action-btn" onClick={() => setSelected(m)} style={{
                        padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                        color: "rgba(144,128,176,0.7)", fontSize: 8, fontWeight: 600, transition: "all 0.15s",
                      }}>Chi tiết</button>
                    </div>
                  </div>
                )
              })}

              {/* Footer */}
              <div style={{
                padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.05)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ color: "rgba(144,128,176,0.35)", fontSize: 8 }}>
                  Hiển thị {shown.length} / {merchants.length} cửa hàng
                </div>
                <div style={{ color: "rgba(144,128,176,0.35)", fontSize: 8 }}>
                  Tổng doanh thu tháng: <span style={{ color: "#FF8C00", fontWeight: 700 }}>{fmt(totalRevenue)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Detail Drawer ── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60, backdropFilter: "blur(5px)" }}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              style={{
                position: "fixed", top: 0, right: 0, bottom: 0,
                width: 360, background: "#0d0b19",
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                zIndex: 61, display: "flex", flexDirection: "column",
                overflowY: "auto",
              }}
            >
              {/* Drawer header */}
              <div style={{
                padding: "16px 18px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                flexShrink: 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Chi tiết cửa hàng</div>
                  <button onClick={() => setSelected(null)} style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: "rgba(255,255,255,0.06)", border: "none",
                    color: "rgba(144,128,176,0.6)", fontSize: 16, cursor: "pointer",
                  }}>×</button>
                </div>

                {/* Shop hero */}
                <div style={{
                  height: 80, borderRadius: 12, marginBottom: 12,
                  background: selected.coverColor,
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 40, position: "relative", overflow: "hidden",
                }}>
                  {selected.categoryIcon}
                  <div style={{
                    position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
                    animation: "shimmer 3s infinite",
                  }} />
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#f0eaff", fontSize: 15, fontWeight: 800 }}>{selected.shopName}</div>
                    <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, marginTop: 2 }}>{selected.id}</div>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "4px 10px",
                    borderRadius: 6, border: `1px solid ${STATUS_CFG[selected.status].border}`,
                    background: STATUS_CFG[selected.status].bg, color: STATUS_CFG[selected.status].color,
                  }}>{STATUS_CFG[selected.status].label}</span>
                </div>

                {/* Quick stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[
                    { label: "Rating", value: selected.rating !== null ? `⭐ ${selected.rating}` : "—", c: "#f5c542" },
                    { label: "Tổng đơn", value: selected.totalOrders > 0 ? selected.totalOrders.toString() : "—", c: "#FF8C00" },
                    { label: "Hoa hồng", value: `${selected.commissionRate}%`, c: "#b464ff" },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8, padding: "7px 8px", textAlign: "center",
                    }}>
                      <div style={{ color: s.c, fontSize: 14, fontWeight: 800 }}>{s.value}</div>
                      <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 7, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details list */}
              <div style={{ flex: 1, padding: "14px 18px", overflowY: "auto" }}>

                {/* Giấy tờ */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Giấy tờ pháp lý</div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <div style={{
                      flex: 1, padding: "8px 10px", borderRadius: 9,
                      background: selected.hasBizLicense ? "rgba(62,207,110,0.08)" : "rgba(255,64,64,0.08)",
                      border: `1px solid ${selected.hasBizLicense ? "rgba(62,207,110,0.25)" : "rgba(255,64,64,0.2)"}`,
                    }}>
                      <div style={{ fontSize: 16, marginBottom: 3 }}>{selected.hasBizLicense ? "✅" : "❌"}</div>
                      <div style={{ color: selected.hasBizLicense ? "#3ecf6e" : "#ff4040", fontSize: 8, fontWeight: 700 }}>Giấy phép KD</div>
                    </div>
                    <div style={{
                      flex: 1, padding: "8px 10px", borderRadius: 9,
                      background: selected.hasHealthCert ? "rgba(62,207,110,0.08)" : "rgba(255,64,64,0.08)",
                      border: `1px solid ${selected.hasHealthCert ? "rgba(62,207,110,0.25)" : "rgba(255,64,64,0.2)"}`,
                    }}>
                      <div style={{ fontSize: 16, marginBottom: 3 }}>{selected.hasHealthCert ? "✅" : "❌"}</div>
                      <div style={{ color: selected.hasHealthCert ? "#3ecf6e" : "#ff4040", fontSize: 8, fontWeight: 700 }}>ATTP</div>
                    </div>
                    <div style={{
                      flex: 1, padding: "8px 10px", borderRadius: 9,
                      background: selected.isOpen ? "rgba(62,207,110,0.08)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${selected.isOpen ? "rgba(62,207,110,0.25)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                      <div style={{ fontSize: 16, marginBottom: 3 }}>{selected.isOpen ? "🟢" : "🔴"}</div>
                      <div style={{ color: selected.isOpen ? "#3ecf6e" : "rgba(144,128,176,0.5)", fontSize: 8, fontWeight: 700 }}>
                        {selected.isOpen ? "Đang mở" : "Đang đóng"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Thông tin chi tiết */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Thông tin</div>
                  {[
                    ["Chủ quán",       selected.ownerName],
                    ["Số điện thoại",  selected.phone],
                    ["Địa chỉ",        selected.address],
                    ["Danh mục",       `${selected.categoryIcon} ${selected.category}`],
                    ["Ngày đăng ký",   selected.registeredDate],
                    ["DT tháng",       selected.monthlyRevenue > 0 ? fmt(selected.monthlyRevenue) : "Chưa có"],
                  ].map(([k, v]) => (
                    <div key={k} style={{
                      display: "flex", justifyContent: "space-between",
                      padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                      gap: 12,
                    }}>
                      <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, flexShrink: 0 }}>{k}</span>
                      <span style={{ color: "#f0eaff", fontSize: 9, fontWeight: 600, textAlign: "right" }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Chỉnh hoa hồng */}
                <div style={{
                  background: "rgba(180,100,255,0.07)",
                  border: "1px solid rgba(180,100,255,0.2)",
                  borderRadius: 10, padding: "10px 12px", marginBottom: 14,
                }}>
                  <div style={{ color: "#b464ff", fontSize: 9, fontWeight: 700, marginBottom: 6 }}>⚙️ Tỷ lệ hoa hồng</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[10, 12, 15, 18, 20].map(rate => (
                      <button key={rate} style={{
                        flex: 1, padding: "5px 0", borderRadius: 7, cursor: "pointer",
                        fontFamily: "Lexend", fontSize: 9, fontWeight: 700,
                        background: selected.commissionRate === rate ? "rgba(180,100,255,0.2)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${selected.commissionRate === rate ? "rgba(180,100,255,0.5)" : "rgba(255,255,255,0.08)"}`,
                        color: selected.commissionRate === rate ? "#b464ff" : "rgba(144,128,176,0.5)",
                        transition: "all 0.15s",
                      }}>{rate}%</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{
                padding: "12px 18px 18px", borderTop: "1px solid rgba(255,255,255,0.07)",
                flexShrink: 0, display: "flex", flexDirection: "column", gap: 7,
              }}>
                {selected.status === "pending" && (
                  <>
                    <button onClick={() => { setConfirmAction({ type: "approve", id: selected.id }); setSelected(null) }} style={{
                      height: 44, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend",
                      background: "rgba(62,207,110,0.12)", border: "1px solid rgba(62,207,110,0.35)",
                      color: "#3ecf6e", fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                    }}>✅ Phê duyệt cửa hàng</button>
                    <button onClick={() => { setConfirmAction({ type: "reject", id: selected.id }); setSelected(null) }} style={{
                      height: 44, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend",
                      background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)",
                      color: "#ff4040", fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                    }}>❌ Từ chối đăng ký</button>
                  </>
                )}
                {selected.status === "approved" && (
                  <button onClick={() => { setConfirmAction({ type: "suspend", id: selected.id }); setSelected(null) }} style={{
                    height: 44, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend",
                    background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)",
                    color: "#ff4040", fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                  }}>🚫 Tạm khóa cửa hàng</button>
                )}
                {selected.status === "suspended" && (
                  <button onClick={() => { setConfirmAction({ type: "unsuspend", id: selected.id }); setSelected(null) }} style={{
                    height: 44, borderRadius: 12, cursor: "pointer", fontFamily: "Lexend",
                    background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)",
                    color: "#3ecf6e", fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                  }}>♻️ Mở khóa cửa hàng</button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Confirm Modal ── */}
      <AnimatePresence>
        {confirmAction && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmAction(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 70, backdropFilter: "blur(6px)" }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 22, stiffness: 350 }}
              style={{
                position: "fixed", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: 320, background: "#0d0b19",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 18, padding: "20px 20px 16px",
                zIndex: 71,
              }}
            >
              {(() => {
                const cfg = {
                  approve:   { icon: "✅", title: "Phê duyệt cửa hàng?", desc: "Cửa hàng sẽ được hoạt động ngay và hiển thị cho khách hàng.", c: "#3ecf6e", bg: "rgba(62,207,110,0.1)", bd: "rgba(62,207,110,0.3)", btn: "Phê duyệt" },
                  reject:    { icon: "❌", title: "Từ chối đăng ký?",     desc: "Cửa hàng sẽ không được hoạt động. Chủ quán có thể đăng ký lại sau.", c: "#ff4040", bg: "rgba(255,64,64,0.1)", bd: "rgba(255,64,64,0.25)", btn: "Từ chối" },
                  suspend:   { icon: "🚫", title: "Tạm khóa cửa hàng?",   desc: "Cửa hàng sẽ bị ẩn khỏi app và không thể nhận đơn mới.", c: "#ff4040", bg: "rgba(255,64,64,0.1)", bd: "rgba(255,64,64,0.25)", btn: "Tạm khóa" },
                  unsuspend: { icon: "♻️", title: "Mở khóa cửa hàng?",    desc: "Cửa hàng sẽ được hoạt động trở lại và hiển thị cho khách hàng.", c: "#3ecf6e", bg: "rgba(62,207,110,0.1)", bd: "rgba(62,207,110,0.3)", btn: "Mở khóa" },
                }[confirmAction.type]

                const shop = merchants.find(m => m.id === confirmAction.id)
                return (
                  <>
                    <div style={{ fontSize: 36, textAlign: "center", marginBottom: 10 }}>{cfg.icon}</div>
                    <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>{cfg.title}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center",
                      background: cfg.bg, border: `1px solid ${cfg.bd}`, borderRadius: 7,
                      padding: "5px 10px", marginBottom: 8, color: cfg.c,
                    }}>{shop?.shopName}</div>
                    <div style={{ color: "rgba(144,128,176,0.55)", fontSize: 10, textAlign: "center", lineHeight: 1.6, marginBottom: 16 }}>{cfg.desc}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setConfirmAction(null)} style={{
                        flex: 1, height: 40, borderRadius: 10, cursor: "pointer",
                        fontFamily: "Lexend", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.09)", color: "rgba(144,128,176,0.6)",
                        fontSize: 11, fontWeight: 600,
                      }}>Hủy</button>
                      <button onClick={execConfirm} style={{
                        flex: 1, height: 40, borderRadius: 10, cursor: "pointer",
                        fontFamily: "Lexend", background: cfg.bg, border: `1px solid ${cfg.bd}`,
                        color: cfg.c, fontSize: 11, fontWeight: 800,
                      }}>{cfg.btn}</button>
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
