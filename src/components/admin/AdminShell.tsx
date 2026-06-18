"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

const NAV_ITEMS = [
  { icon: "🏠",  label: "Dashboard",        href: "/admin" },
  { icon: "✅",  label: "Phê duyệt",        href: "/admin/approvals" },
  { icon: "📦",  label: "Đơn hàng",         href: "/admin/orders" },
  { icon: "👤",  label: "Tài khoản",        href: "/admin/users" },
  { icon: "💰",  label: "Tài chính",        href: "/admin/finance" },
  { icon: "🗺️", label: "Bản đồ live",      href: "/admin/map" },
  { icon: "🏷️", label: "Khuyến mãi",       href: "/admin/promotions" },
  { icon: "🖼️", label: "Banner ảnh",       href: "/admin/banners" },
  { icon: "⚖️",  label: "Tranh chấp",       href: "/admin/disputes" },
  { icon: "📣",  label: "Thông báo",        href: "/admin/notifications" },
  { icon: "💳",  label: "Lịch sử nạp/rút", href: "/admin/wallet-history" },
  { icon: "🏦",  label: "Rút tiền",        href: "/admin/withdrawals" },
  { icon: "⚙️",  label: "Cài đặt",          href: "/admin/settings" },
]

interface AdminShellProps {
  pageTitle: string
  pageSubtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export default function AdminShell({ pageTitle, pageSubtitle, actions, children }: AdminShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed]       = useState(false)
  const [isMobile, setIsMobile]         = useState(false)
  const [drawer, setDrawer]             = useState(false)
  const [launching, setLaunching]       = useState(false)

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 900
      setIsMobile(mobile)
      if (mobile) setCollapsed(true)
    }
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href)

  const launchPreview = useCallback(async () => {
    setLaunching(true)
    await fetch("/api/admin/preview", { method: "POST" })
    window.location.href = "/"
  }, [])

  const handleSignout = useCallback(async () => {
    const sb = createClient()
    await sb.auth.signOut()
    window.location.href = "/login"
  }, [])

  const PreviewBtn = ({ collapsed: c }: { collapsed: boolean }) => (
    <button
      onClick={launchPreview}
      disabled={launching}
      title="Mở giao diện khách để test đơn hàng"
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", height: c ? 36 : 40, borderRadius: 10,
        padding: c ? "0" : "0 12px", justifyContent: c ? "center" : "flex-start",
        background: "linear-gradient(135deg,rgba(255,107,0,0.18),rgba(255,107,0,0.08))",
        border: "1px solid rgba(255,107,0,0.35)",
        color: launching ? "#6a5a40" : "#FF8C00",
        fontSize: 12, fontWeight: 700, cursor: launching ? "not-allowed" : "pointer",
        fontFamily: "Lexend", whiteSpace: "nowrap", overflow: "hidden",
        transition: "all .2s", marginTop: 4,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{launching ? "⏳" : "👁️"}</span>
      {!c && <span>{launching ? "Đang mở..." : "Test giao diện khách"}</span>}
    </button>
  )

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {NAV_ITEMS.map(item => (
        <a key={item.href} href={item.href} onClick={onClick}
          style={{ display: "flex", alignItems: "center", gap: 10, height: isMobile ? 48 : 40, borderRadius: 10, padding: "0 12px", marginBottom: 2, textDecoration: "none", background: isActive(item.href) ? "rgba(255,107,0,0.12)" : "transparent", borderLeft: isActive(item.href) ? "2px solid #FF6B00" : "2px solid transparent", color: isActive(item.href) ? "#FF8C00" : "#6a5a40", fontSize: isMobile ? 13 : 12, fontWeight: isActive(item.href) ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", transition: "all .2s" }}>
          <span style={{ fontSize: isMobile ? 20 : 18, flexShrink: 0 }}>{item.icon}</span>
          {(!collapsed || isMobile) && <span>{item.label}</span>}
        </a>
      ))}
    </>
  )

  /* ── MOBILE ── */
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#06050a", overflow: "hidden", fontFamily: "'Lexend',sans-serif" }}>
        <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0} html,body{background:#06050a;font-family:'Lexend',sans-serif;height:100%;overflow:hidden} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:rgba(255,107,0,.3);border-radius:2px} input{font-family:'Lexend',sans-serif;outline:none}`}</style>

        {/* Mobile top bar — outer div handles safe-area-inset-top (notch/status bar) */}
        <div style={{ paddingTop: "env(safe-area-inset-top)", background: "rgba(12,11,20,0.97)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,107,0,0.12)", flexShrink: 0, zIndex: 40 }}>
          <div style={{ height: 56, display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
            <button onClick={() => setDrawer(true)}
              style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f0eaff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>
              ☰
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#f0eaff", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pageTitle}</div>
              {pageSubtitle && <div style={{ color: "#6a5a40", fontSize: 9 }}>{pageSubtitle}</div>}
            </div>
            {actions}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto" }}>{children}</div>

        {/* Drawer */}
        <AnimatePresence>
          {drawer && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 70, backdropFilter: "blur(4px)" }} />
              <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 26, stiffness: 300 }}
                style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 270, background: "rgba(10,9,18,0.99)", borderRight: "1px solid rgba(255,107,0,0.15)", zIndex: 71, display: "flex", flexDirection: "column" }}>
                {/* Drawer header */}
                <div style={{ display: "flex", alignItems: "center", padding: "16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg,#FF6B00,#FF8C00,#FFB347)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🚀</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#f0eaff", fontSize: 13, fontWeight: 800 }}>Goi</div>
                    <div style={{ color: "#6a5a40", fontSize: 9 }}>Admin Panel</div>
                  </div>
                  <button onClick={() => setDrawer(false)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: "#6a5a40", fontSize: 16, cursor: "pointer" }}>×</button>
                </div>
                {/* Nav */}
                <nav style={{ flex: 1, padding: "8px", overflowY: "auto" }}>
                  <NavLinks onClick={() => setDrawer(false)} />
                </nav>

                {/* Preview + Signout — bottom of drawer */}
                <div style={{ padding: "6px 8px 24px", flexShrink: 0 }}>
                  <PreviewBtn collapsed={false} />
                  <button onClick={handleSignout}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", height: 48, borderRadius: 10, padding: "0 12px", justifyContent: "flex-start", background: "rgba(255,64,64,0.07)", border: "1px solid rgba(255,64,64,0.18)", color: "#ff4040", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend", marginTop: 4 }}>
                    <span style={{ fontSize: 20 }}>🚪</span>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    )
  }

  /* ── PC ── */
  return (
    <div style={{ display: "flex", height: "100vh", background: "#06050a", overflow: "hidden", fontFamily: "'Lexend',sans-serif", color: "#f0eaff" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0} html,body{background:#06050a;font-family:'Lexend',sans-serif;height:100%;overflow:hidden} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:rgba(255,107,0,.3);border-radius:2px} input{font-family:'Lexend',sans-serif;outline:none} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} @keyframes savedPop{0%{transform:scale(.8);opacity:0}50%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}} .adm-link:hover{background:rgba(255,107,0,0.08)!important}`}</style>

      {/* Sidebar */}
      <div style={{ width: collapsed ? 60 : 220, flexShrink: 0, background: "rgba(12,11,20,0.96)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(255,107,0,0.12)", display: "flex", flexDirection: "column", transition: "width .25s ease", overflow: "hidden", zIndex: 50 }}>

        {/* Toggle button — AT TOP */}
        <div style={{ padding: "8px 8px 0", flexShrink: 0 }}>
          <button onClick={() => setCollapsed(p => !p)}
            style={{ width: "100%", height: 34, borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6a5a40", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", padding: "0 10px", gap: 6, transition: "all .2s", fontFamily: "Lexend" }}>
            {!collapsed && <span style={{ color: "#4a5568", fontSize: 10 }}>Thu gọn</span>}
            <span>{collapsed ? "▶" : "◀"}</span>
          </button>
        </div>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: "linear-gradient(135deg,#FF6B00,#FF8C00,#FFB347)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🚀</div>
          {!collapsed && <div><div style={{ color: "#f0eaff", fontSize: 13, fontWeight: 800, lineHeight: 1 }}>Goi</div><div style={{ color: "#6a5a40", fontSize: 9 }}>Admin Panel</div></div>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px", overflowY: "auto" }}>
          <NavLinks />
        </nav>

        {/* Preview button + Signout — bottom of sidebar */}
        <div style={{ padding: "6px 8px 12px", flexShrink: 0 }}>
          <PreviewBtn collapsed={collapsed} />
          <button onClick={handleSignout}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", height: collapsed ? 36 : 40, borderRadius: 10, padding: collapsed ? "0" : "0 12px", justifyContent: collapsed ? "center" : "flex-start", background: "rgba(255,64,64,0.07)", border: "1px solid rgba(255,64,64,0.18)", color: "#ff4040", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend", whiteSpace: "nowrap", overflow: "hidden", transition: "all .2s", marginTop: 4 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🚪</span>
            {!collapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
          <div>
            <div style={{ color: "#f0eaff", fontSize: 16, fontWeight: 800 }}>{pageTitle}</div>
            {pageSubtitle && <div style={{ color: "#6a5a40", fontSize: 10 }}>{pageSubtitle}</div>}
          </div>
          {actions && <div>{actions}</div>}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden" }}>{children}</div>
      </div>
    </div>
  )
}
