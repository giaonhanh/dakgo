"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type UserStatus = "active" | "blacklisted" | "inactive"
type TierLevel  = "bronze" | "silver" | "gold" | "platinum"

interface AppUser {
  id: string
  fullName: string
  phone: string
  avatarEmoji: string
  avatarColor: string
  status: UserStatus
  registeredDate: string
  lastActiveDate: string
  totalOrders: number
  totalSpent: number
  loyaltyPoints: number
  tier: TierLevel
  cancelCount: number
  blacklistReason?: string
  addresses: string[]
}

const USERS: AppUser[] = [
  { id:"U001", fullName:"Nguyễn Thị Hương",  phone:"0901111111", avatarEmoji:"👩", avatarColor:"rgba(180,100,255,0.15)", status:"active",      registeredDate:"10/01/2025", lastActiveDate:"Hôm nay",    totalOrders:48,  totalSpent:3850000,  loyaltyPoints:385,  tier:"silver",   cancelCount:0, addresses:["22 Lê Hồng Phong","5 Trần Phú"] },
  { id:"U002", fullName:"Trần Văn Minh",      phone:"0912222222", avatarEmoji:"👨", avatarColor:"rgba(74,143,245,0.15)",  status:"active",      registeredDate:"15/01/2025", lastActiveDate:"Hôm nay",    totalOrders:112, totalSpent:9240000,  loyaltyPoints:924,  tier:"gold",     cancelCount:1, addresses:["18 Hùng Vương"] },
  { id:"U003", fullName:"Lê Thị Lan",         phone:"0923333333", avatarEmoji:"👩", avatarColor:"rgba(62,207,110,0.15)",  status:"active",      registeredDate:"20/02/2025", lastActiveDate:"Hôm qua",    totalOrders:23,  totalSpent:1560000,  loyaltyPoints:156,  tier:"bronze",   cancelCount:0, addresses:["44 Đinh Tiên Hoàng"] },
  { id:"U004", fullName:"Phạm Văn Đức",       phone:"0934444444", avatarEmoji:"👨", avatarColor:"rgba(255,107,0,0.15)",   status:"blacklisted", registeredDate:"05/03/2025", lastActiveDate:"3 ngày trước",totalOrders:7,   totalSpent:420000,   loyaltyPoints:42,   tier:"bronze",   cancelCount:4, blacklistReason:"Hủy đơn quá 3 lần trong tuần", addresses:["10 Quang Trung"] },
  { id:"U005", fullName:"Hoàng Thị Bảo",      phone:"0945555555", avatarEmoji:"👩", avatarColor:"rgba(245,197,66,0.15)",  status:"active",      registeredDate:"01/03/2025", lastActiveDate:"Hôm nay",    totalOrders:75,  totalSpent:6120000,  loyaltyPoints:612,  tier:"gold",     cancelCount:0, addresses:["8 Lý Thường Kiệt","22 Phan Đình Phùng"] },
  { id:"U006", fullName:"Vũ Văn Thắng",       phone:"0956666666", avatarEmoji:"👨", avatarColor:"rgba(74,143,245,0.15)",  status:"inactive",    registeredDate:"20/01/2025", lastActiveDate:"15 ngày trước",totalOrders:3,  totalSpent:185000,   loyaltyPoints:18,   tier:"bronze",   cancelCount:1, addresses:["3 Nguyễn Văn Cừ"] },
  { id:"U007", fullName:"Đinh Thị Cẩm Tú",   phone:"0967777777", avatarEmoji:"👩", avatarColor:"rgba(180,100,255,0.15)", status:"active",      registeredDate:"12/04/2025", lastActiveDate:"Hôm nay",    totalOrders:201, totalSpent:18750000, loyaltyPoints:1875, tier:"platinum", cancelCount:0, addresses:["15 Trần Hưng Đạo"] },
  { id:"U008", fullName:"Bùi Văn Nam",        phone:"0978888888", avatarEmoji:"👨", avatarColor:"rgba(62,207,110,0.15)",  status:"blacklisted", registeredDate:"08/04/2025", lastActiveDate:"7 ngày trước",totalOrders:5,   totalSpent:310000,   loyaltyPoints:31,   tier:"bronze",   cancelCount:5, blacklistReason:"Báo cáo gian lận khuyến mãi", addresses:["2 Hùng Vương"] },
  { id:"U009", fullName:"Nguyễn Văn Hải",     phone:"0989999999", avatarEmoji:"👨", avatarColor:"rgba(255,107,0,0.12)",   status:"active",      registeredDate:"22/04/2025", lastActiveDate:"Hôm qua",    totalOrders:31,  totalSpent:2430000,  loyaltyPoints:243,  tier:"bronze",   cancelCount:2, addresses:["7 Đinh Tiên Hoàng"] },
  { id:"U010", fullName:"Trần Thị Thu",       phone:"0990000000", avatarEmoji:"👩", avatarColor:"rgba(245,197,66,0.12)",  status:"active",      registeredDate:"02/05/2025", lastActiveDate:"2 giờ trước",totalOrders:14,  totalSpent:980000,   loyaltyPoints:98,   tier:"bronze",   cancelCount:0, addresses:["33 Lê Lợi"] },
]

const STATUS_CFG: Record<UserStatus, { label: string; color: string; bg: string; border: string }> = {
  active:      { label: "Hoạt động",  color: "#3ecf6e", bg: "rgba(62,207,110,0.10)",  border: "rgba(62,207,110,0.25)"  },
  blacklisted: { label: "Bị khóa",   color: "#ff4040", bg: "rgba(255,64,64,0.10)",   border: "rgba(255,64,64,0.25)"   },
  inactive:    { label: "Không HĐ",  color: "#9080b0", bg: "rgba(144,128,176,0.10)", border: "rgba(144,128,176,0.2)"  },
}

const TIER_CFG: Record<TierLevel, { label: string; color: string; bg: string; icon: string }> = {
  bronze:   { label: "Bronze",   color: "#cd7f32", bg: "rgba(205,127,50,0.12)",  icon: "🥉" },
  silver:   { label: "Silver",   color: "#a8a9ad", bg: "rgba(168,169,173,0.12)", icon: "🥈" },
  gold:     { label: "Gold",     color: "#f5c542", bg: "rgba(245,197,66,0.12)",  icon: "🥇" },
  platinum: { label: "Platinum", color: "#b464ff", bg: "rgba(180,100,255,0.15)", icon: "💎" },
}

const NAV_ITEMS = [
  { icon: "🏠",  label: "Dashboard",   href: "/admin"               },
  { icon: "🏍️", label: "Tài xế",      href: "/admin/drivers"       },
  { icon: "🏪",  label: "Cửa hàng",    href: "/admin/merchants"     },
  { icon: "📦",  label: "Đơn hàng",    href: "/admin/orders"        },
  { icon: "👥",  label: "Khách hàng",  href: "/admin/users", active: true },
  { icon: "💰",  label: "Tài chính",   href: "/admin/finance"       },
  { icon: "🗺️", label: "Bản đồ live", href: "/admin/map"           },
  { icon: "🏷️", label: "Khuyến mãi",  href: "/admin/promotions"    },
  { icon: "⚖️",  label: "Tranh chấp",  href: "/admin/disputes"      },
  { icon: "📣",  label: "Thông báo",   href: "/admin/notifications" },
  { icon: "⚙️",  label: "Cài đặt",     href: "/admin/settings"      },
]

const fmt      = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtShort = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n.toLocaleString("vi-VN")

export default function AdminUsersPage() {
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [users, setUsers]               = useState<AppUser[]>(USERS)
  const [filterStatus, setFilterStatus] = useState<"all" | UserStatus>("all")
  const [filterTier, setFilterTier]     = useState<"all" | TierLevel>("all")
  const [search, setSearch]             = useState("")
  const [selected, setSelected]         = useState<AppUser | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: "lock" | "unlock"; id: string } | null>(null)
  const [pointAction, setPointAction]   = useState<{ type: "add" | "deduct"; userId: string } | null>(null)
  const [pointAmount, setPointAmount]   = useState("")
  const [pointReason, setPointReason]   = useState("")

  const lock   = (id: string) => setUsers(p => p.map(u => u.id === id ? { ...u, status: "blacklisted" as UserStatus } : u))
  const unlock = (id: string) => setUsers(p => p.map(u => u.id === id ? { ...u, status: "active" as UserStatus }      : u))

  const execConfirm = () => {
    if (!confirmAction) return
    if (confirmAction.type === "lock")   lock(confirmAction.id)
    if (confirmAction.type === "unlock") unlock(confirmAction.id)
    setConfirmAction(null)
    setSelected(null)
  }

  const execPointAction = () => {
    if (!pointAction) return
    const amt = parseInt(pointAmount.replace(/\D/g, "")) || 0
    if (amt <= 0) return
    setUsers(p => p.map(u => {
      if (u.id !== pointAction.userId) return u
      const delta = pointAction.type === "add" ? amt : -amt
      return { ...u, loyaltyPoints: Math.max(0, u.loyaltyPoints + delta) }
    }))
    if (selected?.id === pointAction.userId) {
      const delta = pointAction.type === "add" ? amt : -amt
      setSelected(prev => prev ? { ...prev, loyaltyPoints: Math.max(0, prev.loyaltyPoints + delta) } : prev)
    }
    setPointAction(null)
    setPointAmount("")
    setPointReason("")
  }

  const counts = {
    all:         users.length,
    active:      users.filter(u => u.status === "active").length,
    blacklisted: users.filter(u => u.status === "blacklisted").length,
    inactive:    users.filter(u => u.status === "inactive").length,
    newToday:    3,
    platinum:    users.filter(u => u.tier === "platinum").length,
  }

  const totalSpent = users.reduce((s, u) => s + u.totalSpent, 0)

  const shown = users
    .filter(u => filterStatus === "all" || u.status === filterStatus)
    .filter(u => filterTier   === "all" || u.tier   === filterTier)
    .filter(u =>
      !search ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search) ||
      u.id.toLowerCase().includes(search.toLowerCase())
    )

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

        .user-row:hover { background: rgba(255,107,0,0.04) !important; border-color: rgba(255,107,0,0.15) !important; }
        .sidebar-link:hover { background: rgba(255,107,0,0.08) !important; }
        .kpi-card { animation: fadeUp 0.35s ease both; }
        .kpi-card:hover { transform: translateY(-2px); transition: all 0.2s; }
        .action-btn:hover { filter: brightness(1.15); transform: scale(1.02); transition: all 0.15s; }
        .filter-tab:hover { border-color: rgba(255,107,0,0.3) !important; }
        .tier-chip:hover  { border-color: rgba(255,107,0,0.3) !important; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", background: "#06050a", color: "#f0eaff", overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <div style={{
          width: sidebarOpen ? 220 : 60, flexShrink: 0,
          background: "rgba(10,9,18,0.97)", backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,107,0,0.1)",
          display: "flex", flexDirection: "column",
          transition: "width 0.25s ease", overflow: "hidden", zIndex: 50,
        }}>
          <div style={{
            height: 56, display: "flex", alignItems: "center",
            padding: "0 14px", gap: 10, flexShrink: 0,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: "linear-gradient(135deg,#FF6B00,#FF8C00,#FFB347)",
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

          <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
            {NAV_ITEMS.map(item => (
              <a key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                <div className="sidebar-link" style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: sidebarOpen ? "8px 10px" : "8px",
                  borderRadius: 10, marginBottom: 3, cursor: "pointer", transition: "all 0.2s",
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
                </div>
              </a>
            ))}
          </nav>

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
            background: "rgba(10,9,18,0.85)", backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div>
              <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Admin / Quản lý</div>
              <div style={{ color: "#f0eaff", fontSize: 13, fontWeight: 700 }}>👥 Khách hàng</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 9 }}>Phước An · {new Date().toLocaleDateString("vi-VN")}</div>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative",
              }}>
                🔔
                <div style={{
                  position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%",
                  background: "#FF6B00", border: "1.5px solid #06050a",
                  boxShadow: "0 0 4px #FF6B00", animation: "pulse 1.5s infinite",
                }} />
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(180,100,255,0.12)", border: "1px solid rgba(180,100,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer",
              }}>👤</div>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

            {/* ── KPI ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 14 }}>
              {[
                { icon:"👥",  label:"Tổng khách hàng", value: counts.all,         sub:`+${counts.newToday} hôm nay`,      c:"#FF8C00", bg:"rgba(255,107,0,0.07)",    bd:"rgba(255,107,0,0.2)",    delay:"0s"    },
                { icon:"✅",  label:"Đang hoạt động",  value: counts.active,       sub:"Dùng app trong 30 ngày",            c:"#3ecf6e", bg:"rgba(62,207,110,0.07)",   bd:"rgba(62,207,110,0.2)",   delay:"0.05s" },
                { icon:"🚫",  label:"Bị khóa",         value: counts.blacklisted,  sub:"Hủy đơn / gian lận",               c:"#ff4040", bg:"rgba(255,64,64,0.07)",    bd:"rgba(255,64,64,0.2)",    delay:"0.10s" },
                { icon:"💤",  label:"Không HĐ",        value: counts.inactive,     sub:">14 ngày chưa dùng",               c:"#9080b0", bg:"rgba(144,128,176,0.07)",  bd:"rgba(144,128,176,0.2)",  delay:"0.15s" },
                { icon:"💎",  label:"Platinum",         value: counts.platinum,     sub:"VIP cao nhất",                     c:"#b464ff", bg:"rgba(180,100,255,0.07)",  bd:"rgba(180,100,255,0.2)",  delay:"0.20s" },
                { icon:"💳",  label:"Tổng chi tiêu",   value: fmtShort(totalSpent),sub:"Tất cả thời gian",                 c:"#f5c542", bg:"rgba(245,197,66,0.07)",   bd:"rgba(245,197,66,0.2)",   delay:"0.25s" },
              ].map((k, i) => (
                <div key={i} className="kpi-card" style={{
                  background: k.bg, border: `1px solid ${k.bd}`,
                  borderRadius: 13, padding: "11px 12px", animationDelay: k.delay,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, fontSize: 14,
                    background: k.bg, border: `1px solid ${k.bd}`,
                    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6,
                  }}>{k.icon}</div>
                  <div style={{ color: k.c, fontSize: 20, fontWeight: 800, lineHeight: 1, marginBottom: 2 }}>{k.value}</div>
                  <div style={{ color: "rgba(240,234,255,0.55)", fontSize: 9 }}>{k.label}</div>
                  <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 8, marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Search + Filter ── */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 13, padding: "11px 13px", marginBottom: 12,
            }}>
              {/* Search */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 9, padding: "7px 11px", marginBottom: 10,
              }}>
                <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 14 }}>🔍</span>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm tên, số điện thoại, mã khách hàng..."
                  style={{ flex: 1, background: "transparent", border: "none", color: "#f0eaff", fontSize: 11 }}
                />
                {search && (
                  <span onClick={() => setSearch("")} style={{ color: "rgba(144,128,176,0.4)", cursor: "pointer", fontSize: 13 }}>✕</span>
                )}
              </div>

              {/* Status tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
                {([
                  { key: "all",         label: `Tất cả (${counts.all})`,               c: "#FF8C00"  },
                  { key: "active",      label: `Hoạt động (${counts.active})`,          c: "#3ecf6e"  },
                  { key: "blacklisted", label: `Bị khóa (${counts.blacklisted})`,       c: "#ff4040"  },
                  { key: "inactive",    label: `Không HĐ (${counts.inactive})`,         c: "#9080b0"  },
                ] as const).map(tab => {
                  const isOn = filterStatus === tab.key
                  return (
                    <button key={tab.key} className="filter-tab" onClick={() => setFilterStatus(tab.key)} style={{
                      padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                      fontFamily: "Lexend", fontSize: 9, fontWeight: isOn ? 700 : 400,
                      background: isOn ? `${tab.c}18` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isOn ? tab.c + "55" : "rgba(255,255,255,0.07)"}`,
                      color: isOn ? tab.c : "rgba(144,128,176,0.6)",
                      transition: "all 0.2s",
                    }}>{tab.label}</button>
                  )
                })}
              </div>

              {/* Tier chips */}
              <div style={{ display: "flex", gap: 5 }}>
                <span style={{ color: "rgba(144,128,176,0.4)", fontSize: 8, alignSelf: "center", marginRight: 2 }}>Tier:</span>
                {(["all", "bronze", "silver", "gold", "platinum"] as const).map(t => {
                  const isOn = filterTier === t
                  const cfg  = t === "all" ? null : TIER_CFG[t]
                  return (
                    <button key={t} className="tier-chip" onClick={() => setFilterTier(t)} style={{
                      padding: "3px 10px", borderRadius: 6, cursor: "pointer",
                      fontFamily: "Lexend", fontSize: 8, fontWeight: isOn ? 700 : 400,
                      background: isOn ? (cfg?.bg ?? "rgba(255,107,0,0.1)") : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isOn ? (cfg?.color ?? "#FF8C00") + "55" : "rgba(255,255,255,0.07)"}`,
                      color: isOn ? (cfg?.color ?? "#FF8C00") : "rgba(144,128,176,0.55)",
                      transition: "all 0.2s",
                    }}>
                      {t === "all" ? "Tất cả" : `${cfg!.icon} ${cfg!.label}`}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Table ── */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 13, overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "48px 1.6fr 110px 90px 80px 80px 80px 90px 100px",
                gap: 8, padding: "9px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.02)",
              }}>
                {["","Khách hàng","SĐT","Đăng ký","Tier","Đơn","Chi tiêu","Trạng thái","Thao tác"].map(h => (
                  <div key={h} style={{ color:"rgba(144,128,176,0.4)", fontSize:7.5, textTransform:"uppercase", letterSpacing:0.6, fontWeight:700 }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {shown.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(144,128,176,0.35)", fontSize: 11 }}>
                  Không tìm thấy khách hàng nào
                </div>
              ) : shown.map((u, idx) => {
                const st   = STATUS_CFG[u.status]
                const tier = TIER_CFG[u.tier]
                return (
                  <div
                    key={u.id}
                    className="user-row"
                    onClick={() => setSelected(u)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "48px 1.6fr 110px 90px 80px 80px 80px 90px 100px",
                      gap: 8, padding: "10px 14px", alignItems: "center",
                      borderBottom: idx < shown.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                      background: u.avatarColor, border: "1px solid rgba(255,255,255,0.09)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, position: "relative",
                    }}>
                      {u.avatarEmoji}
                      {u.status === "blacklisted" && (
                        <div style={{
                          position: "absolute", bottom: -2, right: -2,
                          width: 14, height: 14, borderRadius: "50%",
                          background: "#ff4040", border: "1.5px solid #06050a",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 7,
                        }}>🔒</div>
                      )}
                    </div>

                    {/* Name */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#f0eaff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.fullName}</div>
                      <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 8, marginTop: 2 }}>{u.id} · Lần cuối: {u.lastActiveDate}</div>
                    </div>

                    {/* Phone */}
                    <div style={{ color: "rgba(240,234,255,0.65)", fontSize: 10 }}>{u.phone}</div>

                    {/* Registered */}
                    <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 9 }}>{u.registeredDate}</div>

                    {/* Tier */}
                    <div>
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: "3px 7px",
                        borderRadius: 5, background: tier.bg,
                        border: `1px solid ${tier.color}44`, color: tier.color,
                        whiteSpace: "nowrap",
                      }}>{tier.icon} {tier.label}</span>
                    </div>

                    {/* Orders */}
                    <div style={{ color: u.totalOrders > 0 ? "#FF8C00" : "rgba(144,128,176,0.3)", fontSize: 11, fontWeight: 700 }}>
                      {u.totalOrders > 0 ? u.totalOrders : "—"}
                    </div>

                    {/* Spent */}
                    <div style={{ color: u.totalSpent > 0 ? "#f0eaff" : "rgba(144,128,176,0.3)", fontSize: 9, fontWeight: u.totalSpent > 0 ? 600 : 400 }}>
                      {u.totalSpent > 0 ? fmtShort(u.totalSpent) : "—"}
                    </div>

                    {/* Status */}
                    <div>
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: "3px 7px",
                        borderRadius: 5, border: `1px solid ${st.border}`,
                        background: st.bg, color: st.color, whiteSpace: "nowrap",
                      }}>{st.label}</span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                      {u.status !== "blacklisted" ? (
                        <button className="action-btn" onClick={() => setConfirmAction({ type: "lock", id: u.id })} style={{
                          padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend",
                          background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.2)",
                          color: "#ff4040", fontSize: 8, fontWeight: 700,
                        }}>🔒 Khóa</button>
                      ) : (
                        <button className="action-btn" onClick={() => setConfirmAction({ type: "unlock", id: u.id })} style={{
                          padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend",
                          background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)",
                          color: "#3ecf6e", fontSize: 8, fontWeight: 700,
                        }}>🔓 Mở</button>
                      )}
                      <button className="action-btn" onClick={() => setSelected(u)} style={{
                        padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "Lexend",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                        color: "rgba(144,128,176,0.7)", fontSize: 8, fontWeight: 600,
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
                  Hiển thị {shown.length} / {users.length} khách hàng
                </div>
                <div style={{ color: "rgba(144,128,176,0.35)", fontSize: 8 }}>
                  Tổng chi tiêu toàn hệ thống: <span style={{ color: "#FF8C00", fontWeight: 700 }}>{fmt(totalSpent)}</span>
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
                position: "fixed", top: 0, right: 0, bottom: 0, width: 360,
                background: "#0d0b19", borderLeft: "1px solid rgba(255,255,255,0.08)",
                zIndex: 61, display: "flex", flexDirection: "column", overflowY: "auto",
              }}
            >
              {/* Header */}
              <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Hồ sơ khách hàng</div>
                  <button onClick={() => setSelected(null)} style={{
                    width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.06)",
                    border: "none", color: "rgba(144,128,176,0.6)", fontSize: 16, cursor: "pointer",
                  }}>×</button>
                </div>

                {/* Avatar hero */}
                <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 18, flexShrink: 0,
                    background: selected.avatarColor,
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 32, position: "relative",
                  }}>
                    {selected.avatarEmoji}
                    {selected.status === "blacklisted" && (
                      <div style={{
                        position: "absolute", bottom: 0, right: 0,
                        width: 20, height: 20, borderRadius: "50%",
                        background: "#ff4040", border: "2px solid #0d0b19",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                      }}>🔒</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#f0eaff", fontSize: 16, fontWeight: 800, marginBottom: 3 }}>{selected.fullName}</div>
                    <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 9, marginBottom: 5 }}>{selected.id} · {selected.phone}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
                        border: `1px solid ${STATUS_CFG[selected.status].border}`,
                        background: STATUS_CFG[selected.status].bg, color: STATUS_CFG[selected.status].color,
                      }}>{STATUS_CFG[selected.status].label}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
                        background: TIER_CFG[selected.tier].bg,
                        border: `1px solid ${TIER_CFG[selected.tier].color}44`,
                        color: TIER_CFG[selected.tier].color,
                      }}>{TIER_CFG[selected.tier].icon} {TIER_CFG[selected.tier].label}</span>
                    </div>
                  </div>
                </div>

                {/* Quick stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[
                    { label: "Tổng đơn",   value: selected.totalOrders.toString(), c: "#FF8C00" },
                    { label: "Chi tiêu",   value: fmtShort(selected.totalSpent),   c: "#f5c542" },
                    { label: "Điểm tích",  value: selected.loyaltyPoints.toString(), c: "#b464ff" },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 9, padding: "8px", textAlign: "center",
                    }}>
                      <div style={{ color: s.c, fontSize: 15, fontWeight: 800 }}>{s.value}</div>
                      <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div style={{ flex: 1, padding: "14px 18px", overflowY: "auto" }}>

                {/* Blacklist warning */}
                {selected.status === "blacklisted" && selected.blacklistReason && (
                  <div style={{
                    background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.25)",
                    borderRadius: 10, padding: "10px 12px", marginBottom: 14,
                  }}>
                    <div style={{ color: "#ff4040", fontSize: 9, fontWeight: 700, marginBottom: 4 }}>⚠️ Lý do bị khóa</div>
                    <div style={{ color: "rgba(255,100,100,0.8)", fontSize: 10, lineHeight: 1.5 }}>{selected.blacklistReason}</div>
                  </div>
                )}

                {/* Cancel warning */}
                {selected.cancelCount >= 2 && selected.status !== "blacklisted" && (
                  <div style={{
                    background: "rgba(255,179,71,0.08)", border: "1px solid rgba(255,179,71,0.25)",
                    borderRadius: 10, padding: "10px 12px", marginBottom: 14,
                  }}>
                    <div style={{ color: "#FFB347", fontSize: 9, fontWeight: 700 }}>
                      ⚠️ Hủy đơn {selected.cancelCount} lần — Theo dõi sát
                    </div>
                  </div>
                )}

                {/* Info */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Thông tin</div>
                  {[
                    ["Mã KH",         selected.id],
                    ["Số điện thoại", selected.phone],
                    ["Ngày đăng ký",  selected.registeredDate],
                    ["Hoạt động cuối",selected.lastActiveDate],
                    ["Số lần hủy ĐH",`${selected.cancelCount} lần`],
                  ].map(([k, v]) => (
                    <div key={k} style={{
                      display: "flex", justifyContent: "space-between",
                      padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 12,
                    }}>
                      <span style={{ color: "rgba(144,128,176,0.5)", fontSize: 9 }}>{k}</span>
                      <span style={{ color: "#f0eaff", fontSize: 9, fontWeight: 600, textAlign: "right" }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Địa chỉ lưu */}
                {selected.addresses.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>📍 Địa chỉ lưu</div>
                    {selected.addresses.map((addr, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 10px", marginBottom: 5,
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 8,
                      }}>
                        <span style={{ fontSize: 12 }}>{i === 0 ? "🏠" : "📌"}</span>
                        <span style={{ color: "rgba(240,234,255,0.7)", fontSize: 9 }}>{addr}, Phước An</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Loyalty progress */}
                <div style={{
                  background: "rgba(180,100,255,0.07)", border: "1px solid rgba(180,100,255,0.2)",
                  borderRadius: 10, padding: "10px 12px", marginBottom: 14,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ color: "#b464ff", fontSize: 9, fontWeight: 700 }}>
                      {TIER_CFG[selected.tier].icon} {TIER_CFG[selected.tier].label}
                    </div>
                    <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 8 }}>{selected.loyaltyPoints} điểm</div>
                  </div>
                  {/* Progress bar */}
                  {(() => {
                    const thresholds: Record<TierLevel, number> = { bronze: 500, silver: 1000, gold: 2000, platinum: 9999 }
                    const bases:      Record<TierLevel, number> = { bronze: 0,   silver: 500,  gold: 1000,  platinum: 2000 }
                    const next = thresholds[selected.tier]
                    const base = bases[selected.tier]
                    const pct  = selected.tier === "platinum" ? 100 : Math.min(100, Math.round(((selected.loyaltyPoints - base) / (next - base)) * 100))
                    return (
                      <>
                        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: "linear-gradient(90deg, #b464ff, #d484ff)", transition: "width 0.5s ease" }} />
                        </div>
                        <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 7.5, marginTop: 4, textAlign: "right" }}>
                          {selected.tier === "platinum" ? "Đã đạt mức cao nhất 💎" : `Cần ${next - selected.loyaltyPoints} điểm để lên tier tiếp`}
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Quick links */}
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { label: "📦 Lịch sử đơn", href: `/admin/orders?user=${selected.id}` },
                    { label: "💬 Gửi thông báo", href: "#" },
                  ].map(l => (
                    <a key={l.label} href={l.href} style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, textAlign: "center",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(144,128,176,0.6)", fontSize: 9, fontWeight: 600,
                      textDecoration: "none", display: "block", transition: "all 0.15s",
                    }}>{l.label}</a>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ padding: "12px 18px 18px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
                {/* Points actions */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: "rgba(144,128,176,0.45)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                    💫 Điểm Giao Nhanh · {selected.loyaltyPoints.toLocaleString()} điểm
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setPointAction({ type: "add", userId: selected.id }); setPointAmount(""); setPointReason("") }} style={{
                      flex: 1, height: 38, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend",
                      background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.22)",
                      color: "#3ecf6e", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}>➕ Nạp điểm</button>
                    <button onClick={() => { setPointAction({ type: "deduct", userId: selected.id }); setPointAmount(""); setPointReason("") }} style={{
                      flex: 1, height: 38, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend",
                      background: "rgba(255,64,64,0.07)", border: "1px solid rgba(255,64,64,0.2)",
                      color: "#ff6060", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}>➖ Rút điểm</button>
                  </div>
                </div>
                {/* Lock/unlock */}
                {selected.status !== "blacklisted" ? (
                  <button onClick={() => { setConfirmAction({ type: "lock", id: selected.id }) }} style={{
                    width: "100%", height: 40, borderRadius: 12, cursor: "pointer",
                    fontFamily: "Lexend", background: "rgba(255,64,64,0.08)",
                    border: "1px solid rgba(255,64,64,0.2)", color: "#ff4040",
                    fontSize: 12, fontWeight: 700,
                  }}>🔒 Khóa tài khoản</button>
                ) : (
                  <button onClick={() => { setConfirmAction({ type: "unlock", id: selected.id }) }} style={{
                    width: "100%", height: 40, borderRadius: 12, cursor: "pointer",
                    fontFamily: "Lexend", background: "rgba(62,207,110,0.08)",
                    border: "1px solid rgba(62,207,110,0.2)", color: "#3ecf6e",
                    fontSize: 12, fontWeight: 700,
                  }}>🔓 Mở khóa tài khoản</button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Point Action Modal ── */}
      <AnimatePresence>
        {pointAction && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPointAction(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 70, backdropFilter: "blur(6px)" }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 22, stiffness: 350 }}
              style={{
                position: "fixed", top: "50%", left: "50%",
                transform: "translate(-50%,-50%)",
                width: 340, background: "#0d0b19",
                border: `1px solid ${pointAction.type === "add" ? "rgba(62,207,110,0.25)" : "rgba(255,64,64,0.25)"}`,
                borderRadius: 18, padding: "22px 20px 18px", zIndex: 71,
              }}
            >
              {(() => {
                const isAdd  = pointAction.type === "add"
                const user   = users.find(u => u.id === pointAction.userId)
                const amt    = parseInt(pointAmount.replace(/\D/g, "")) || 0
                const valid  = amt > 0 && pointReason.trim().length > 0
                return (
                  <>
                    <div style={{ fontSize: 34, textAlign: "center", marginBottom: 10 }}>{isAdd ? "➕" : "➖"}</div>
                    <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 4 }}>
                      {isAdd ? "Nạp điểm" : "Rút điểm"}
                    </div>
                    <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 10, textAlign: "center", marginBottom: 14 }}>
                      {user?.fullName} · Hiện có{" "}
                      <strong style={{ color: "#b464ff" }}>{user?.loyaltyPoints.toLocaleString()} điểm</strong>
                    </div>

                    {/* Amount input */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, display: "block", marginBottom: 4 }}>
                        Số điểm {isAdd ? "cộng thêm" : "trừ bớt"}
                      </label>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${pointAmount ? (isAdd ? "rgba(62,207,110,0.4)" : "rgba(255,64,64,0.4)") : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 11, padding: "0 12px", height: 44,
                      }}>
                        <span style={{ fontSize: 14 }}>💫</span>
                        <input
                          type="number" value={pointAmount}
                          onChange={e => setPointAmount(e.target.value)}
                          placeholder="VD: 10000"
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f0eaff", fontSize: 13, fontFamily: "Lexend" }}
                        />
                        <span style={{ color: isAdd ? "#3ecf6e" : "#ff6060", fontSize: 10, fontWeight: 600 }}>điểm</span>
                      </div>
                      {amt > 0 && (
                        <div style={{ color: "rgba(144,128,176,0.4)", fontSize: 8.5, marginTop: 4, textAlign: "right" }}>
                          = {amt.toLocaleString("vi-VN")}đ
                        </div>
                      )}
                    </div>

                    {/* Reason input */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ color: "rgba(144,128,176,0.5)", fontSize: 9, display: "block", marginBottom: 4 }}>
                        Lý do
                      </label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                        {(isAdd
                          ? ["Mini game Tháng 5", "Quà sinh nhật", "Khuyến mãi đặc biệt", "Bù điểm lỗi"]
                          : ["Thu hồi điểm sai", "Vi phạm chính sách", "Điều chỉnh"]
                        ).map(r => (
                          <div key={r} onClick={() => setPointReason(r)} style={{
                            padding: "3px 9px", borderRadius: 6, cursor: "pointer",
                            background: pointReason === r ? (isAdd ? "rgba(62,207,110,0.12)" : "rgba(255,64,64,0.10)") : "rgba(255,255,255,0.04)",
                            border: `1px solid ${pointReason === r ? (isAdd ? "rgba(62,207,110,0.35)" : "rgba(255,64,64,0.3)") : "rgba(255,255,255,0.07)"}`,
                            color: pointReason === r ? (isAdd ? "#3ecf6e" : "#ff6060") : "rgba(144,128,176,0.55)",
                            fontSize: 8.5, fontWeight: pointReason === r ? 600 : 400,
                            transition: "all 0.15s",
                          }}>{r}</div>
                        ))}
                      </div>
                      <input
                        value={pointReason}
                        onChange={e => setPointReason(e.target.value)}
                        placeholder="Hoặc nhập lý do khác..."
                        style={{
                          width: "100%", background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${pointReason ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
                          borderRadius: 9, padding: "8px 12px",
                          color: "#f0eaff", fontSize: 11, fontFamily: "Lexend",
                          outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setPointAction(null)} style={{
                        flex: 1, height: 40, borderRadius: 10, cursor: "pointer", fontFamily: "Lexend",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                        color: "rgba(144,128,176,0.6)", fontSize: 11, fontWeight: 600,
                      }}>Hủy</button>
                      <button onClick={execPointAction} disabled={!valid} style={{
                        flex: 1, height: 40, borderRadius: 10, cursor: valid ? "pointer" : "not-allowed", fontFamily: "Lexend",
                        background: !valid ? "rgba(255,255,255,0.04)" : isAdd ? "linear-gradient(90deg,#3ecf6e,#5de88a)" : "linear-gradient(90deg,#ff4040,#ff6060)",
                        border: "none", color: valid ? "#fff" : "rgba(144,128,176,0.35)",
                        fontSize: 11, fontWeight: 800, opacity: valid ? 1 : 0.6,
                        boxShadow: valid ? (isAdd ? "0 3px 12px rgba(62,207,110,0.3)" : "0 3px 12px rgba(255,64,64,0.3)") : "none",
                        transition: "all 0.2s",
                      }}>
                        {isAdd ? `➕ Cộng ${amt > 0 ? amt.toLocaleString("vi-VN") : "?"} điểm` : `➖ Trừ ${amt > 0 ? amt.toLocaleString("vi-VN") : "?"} điểm`}
                      </button>
                    </div>
                  </>
                )
              })()}
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
                transform: "translate(-50%,-50%)",
                width: 320, background: "#0d0b19",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 18, padding: "22px 20px 18px", zIndex: 71,
              }}
            >
              {(() => {
                const isLock = confirmAction.type === "lock"
                const user   = users.find(u => u.id === confirmAction.id)
                return (
                  <>
                    <div style={{ fontSize: 38, textAlign: "center", marginBottom: 10 }}>{isLock ? "🔒" : "🔓"}</div>
                    <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>
                      {isLock ? "Khóa tài khoản?" : "Mở khóa tài khoản?"}
                    </div>
                    <div style={{
                      fontSize: 11, fontWeight: 700, textAlign: "center",
                      background: isLock ? "rgba(255,64,64,0.1)" : "rgba(62,207,110,0.1)",
                      border: `1px solid ${isLock ? "rgba(255,64,64,0.25)" : "rgba(62,207,110,0.25)"}`,
                      borderRadius: 7, padding: "5px 10px", marginBottom: 8,
                      color: isLock ? "#ff4040" : "#3ecf6e",
                    }}>{user?.fullName}</div>
                    <div style={{ color: "rgba(144,128,176,0.5)", fontSize: 10, textAlign: "center", lineHeight: 1.6, marginBottom: 18 }}>
                      {isLock
                        ? "Khách hàng sẽ không thể đăng nhập và đặt đơn. Có thể mở khóa lại bất cứ lúc nào."
                        : "Khách hàng sẽ có thể đăng nhập và đặt đơn trở lại bình thường."
                      }
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setConfirmAction(null)} style={{
                        flex: 1, height: 40, borderRadius: 10, cursor: "pointer",
                        fontFamily: "Lexend", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.09)",
                        color: "rgba(144,128,176,0.6)", fontSize: 11, fontWeight: 600,
                      }}>Hủy</button>
                      <button onClick={execConfirm} style={{
                        flex: 1, height: 40, borderRadius: 10, cursor: "pointer",
                        fontFamily: "Lexend",
                        background: isLock ? "rgba(255,64,64,0.12)" : "rgba(62,207,110,0.12)",
                        border: `1px solid ${isLock ? "rgba(255,64,64,0.3)" : "rgba(62,207,110,0.3)"}`,
                        color: isLock ? "#ff4040" : "#3ecf6e",
                        fontSize: 11, fontWeight: 800,
                      }}>{isLock ? "🔒 Khóa" : "🔓 Mở khóa"}</button>
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
