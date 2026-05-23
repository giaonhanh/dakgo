'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import FloatingBottomMenu from '@/components/navigation/FloatingBottomMenu'

// Các trang đã có inline bottom nav riêng — không cần render thêm từ layout
const SELF_NAV_PATHS = [
  '/tracking', '/shop', '/search', '/cart', '/orders', '/profile',
  '/addresses', '/wallet', '/vouchers', '/loyalty', '/notifications', '/errand',
  '/checkout', '/order-success', '/review',
  '/bestsellers', '/promo-items', '/nearby-shops',
  '/mua-ho', '/giao-ho', '/xe-om', '/taxi', '/ride',
  '/danh-muc', '/favorites',
]

function AdminPreviewBar() {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const isPreview = document.cookie.split(';').some(c => c.trim() === 'admin_preview=1')
    setVisible(isPreview)
  }, [])

  const exit = useCallback(async () => {
    setExiting(true)
    await fetch('/api/admin/preview', { method: 'DELETE' })
    window.location.href = '/admin'
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      height: 44,
      background: 'linear-gradient(90deg,rgba(30,10,60,0.97),rgba(20,8,40,0.97))',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(180,100,255,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', gap: 12,
      boxShadow: '0 2px 20px rgba(180,100,255,0.25)',
      fontFamily: "'Lexend',sans-serif",
    }}>
      {/* Left: badge + text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 999,
          background: 'linear-gradient(135deg,#7c3aed,#b464ff)',
          color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
          flexShrink: 0,
        }}>
          🛡️ ADMIN
        </span>
        <span style={{ color: '#d4b4ff', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Đang xem giao diện khách · Mọi thao tác đều có hiệu lực thật
        </span>
      </div>

      {/* Right: exit button */}
      <button
        onClick={exit}
        disabled={exiting}
        style={{
          height: 28, padding: '0 12px', borderRadius: 8, flexShrink: 0,
          background: exiting ? 'rgba(255,255,255,0.06)' : 'rgba(255,107,0,0.2)',
          border: '1px solid rgba(255,107,0,0.5)',
          color: exiting ? '#6a5a40' : '#FF8C00',
          fontSize: 11, fontWeight: 700, cursor: exiting ? 'not-allowed' : 'pointer',
          fontFamily: "'Lexend',sans-serif", whiteSpace: 'nowrap',
          transition: 'all .2s',
        }}
      >
        {exiting ? '⏳ Đang thoát...' : '← Thoát preview'}
      </button>
    </div>
  )
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hasSelfNav =
    pathname === '/' ||
    SELF_NAV_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  return (
    <>
      <AdminPreviewBar />
      {children}
      {!hasSelfNav && <FloatingBottomMenu />}
    </>
  )
}
