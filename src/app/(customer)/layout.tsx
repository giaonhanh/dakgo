'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import FloatingBottomMenu from '@/components/navigation/FloatingBottomMenu'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import { useLocationStore } from '@/store/locationStore'
import MaintenanceGate from '@/components/MaintenanceGate'
import PushPermissionPrompt from '@/components/PushPermissionPrompt'

const REFRESH_MS    = 5 * 60 * 1000   // 5 phút — tự cập nhật lại vị trí

// ── Lấy GPS + reverse geocode → lưu vào store ──────────────────────────────
async function fetchGps(
  setLocation: (lat: number, lng: number, addr: string) => void,
  setDenied: () => void,
) {
  if (!navigator.geolocation) { setDenied(); return }

  // Kiểm tra permission state hiện tại (nếu browser đã chặn, báo ngay)
  try {
    const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName })
    if (perm.state === "denied") { setDenied(); return }
  } catch {
    // Một số browser không hỗ trợ permissions API — tiếp tục bình thường
  }

  // Dùng network/WiFi location — nhanh hơn GPS chip, đủ chính xác cho giao hàng
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const { latitude: lat, longitude: lng } = coords
      try {
        const res  = await fetch(`/api/geocode?latlng=${lat},${lng}`)
        const data = await res.json()
        const address = (Array.isArray(data) ? data[0]?.display : null) ?? "Vị trí hiện tại"
        setLocation(lat, lng, address)
      } catch {
        setLocation(lat, lng, "Vị trí hiện tại")
      }
    },
    () => setDenied(),
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
  )
}

// ── Custom Permission UI (hiện trước browser dialog) ───────────────────────
function GpsPermissionModal({ onAllow, onDeny }: { onAllow: () => void; onDeny: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(8,8,6,0.96)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Lexend',sans-serif",
      padding: '0 32px',
    }}>
      {/* Icon */}
      <div style={{
        width: 96, height: 96, borderRadius: 28,
        background: 'linear-gradient(135deg,rgba(255,107,0,0.18),rgba(255,107,0,0.06))',
        border: '1.5px solid rgba(255,107,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 44, marginBottom: 24,
        boxShadow: '0 0 40px rgba(255,107,0,0.15)',
      }}>
        📍
      </div>

      {/* Title */}
      <div style={{
        color: '#f8f0e0', fontSize: 20, fontWeight: 800,
        textAlign: 'center', marginBottom: 10, lineHeight: 1.3,
      }}>
        Cho phép lấy vị trí của bạn
      </div>

      {/* Description */}
      <div style={{
        color: '#6a5a40', fontSize: 12, textAlign: 'center',
        lineHeight: 1.8, marginBottom: 32, maxWidth: 300,
      }}>
        DakGo cần vị trí GPS để{'\n'}
        <span style={{ color: '#b0956a' }}>tìm quán gần bạn</span>,{' '}
        <span style={{ color: '#b0956a' }}>tính phí ship</span> và{' '}
        <span style={{ color: '#b0956a' }}>giao hàng chính xác</span> đến tận nơi.
      </div>

      {/* Buttons */}
      <button
        onClick={onAllow}
        style={{
          width: '100%', maxWidth: 300, height: 52, borderRadius: 14, border: 'none',
          background: 'linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)',
          color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
          fontFamily: "'Lexend',sans-serif",
          boxShadow: '0 4px 24px rgba(255,107,0,0.4)',
          marginBottom: 10,
        }}
      >
        📍 Cho phép lấy vị trí
      </button>

      <button
        onClick={onDeny}
        style={{
          width: '100%', maxWidth: 300, height: 44, borderRadius: 12,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          color: '#6a5a40', fontSize: 12, cursor: 'pointer',
          fontFamily: "'Lexend',sans-serif",
        }}
      >
        Không, tôi tự nhập địa chỉ
      </button>

      <div style={{ color: 'rgba(106,90,64,0.5)', fontSize: 11, marginTop: 16, textAlign: 'center' }}>
        Vị trí chỉ dùng cho mục đích giao hàng · Không lưu trữ lâu dài
      </div>
    </div>
  )
}

// ── Sound Player: nghe SW message, chỉ play âm thanh dành cho customer
// BUG-009: guard để không play nhầm âm thanh driver/merchant
const CUSTOMER_SOUNDS = new Set(["order_update", "promo"])
function SoundPlayer() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'PLAY_ORDER_SOUND' || !e.data.sound) return
      // Chỉ play các sound của customer, bỏ qua driver/merchant sounds
      if (!CUSTOMER_SOUNDS.has(e.data.sound)) return
      const audio = new Audio(`/sounds/${e.data.sound}.mp3`)
      audio.play().catch(() => {})
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])
  return null
}

// ── GPS Manager: permission prompt + periodic refresh ──────────────────────
function GpsManager() {
  const { ready, denied, promptShown, lastUpdated, setLocation, setDenied, setPromptShown, resetDenied } =
    useLocationStore()
  const [showModal, setShowModal] = useState(false)
  const [retrying,  setRetrying]  = useState(false)
  const [browserDenied, setBrowserDenied] = useState(false)

  const handleGpsFail = useCallback(async () => {
    // Phân biệt: browser chặn vĩnh viễn hay chỉ timeout
    try {
      const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName })
      setBrowserDenied(perm.state === "denied")
    } catch { setBrowserDenied(false) }
    setDenied()
  }, [setDenied])

  // Lần đầu vào app — hiện custom UI trước khi gọi browser permission
  useEffect(() => {
    if (!promptShown) {
      setShowModal(true)
    } else if (!denied) {
      fetchGps(setLocation, handleGpsFail)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Periodic refresh mỗi 5 phút
  useEffect(() => {
    if (denied || !ready) return
    const interval = setInterval(() => {
      fetchGps(setLocation, handleGpsFail)
    }, REFRESH_MS)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, denied])

  // Refresh khi app từ background → foreground
  useEffect(() => {
    if (denied) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const stale = Date.now() - lastUpdated > REFRESH_MS
      if (stale) fetchGps(setLocation, handleGpsFail)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdated, denied])

  const handleAllow = () => {
    setShowModal(false)
    setPromptShown()
    fetchGps(setLocation, handleGpsFail)
  }

  const handleDeny = () => {
    setShowModal(false)
    setPromptShown()
    setDenied()
  }

  const handleRetry = async () => {
    setRetrying(true)
    setBrowserDenied(false)
    resetDenied()
    await fetchGps(setLocation, handleGpsFail)
    setRetrying(false)
  }

  return (
    <>
      {showModal && <GpsPermissionModal onAllow={handleAllow} onDeny={handleDeny} />}

      {/* Banner GPS bị từ chối — hiện cho đến khi lấy được vị trí */}
      {ready && denied && !showModal && (
        <div style={{
          position: 'fixed', top: 'calc(env(safe-area-inset-top) + 12px)', left: 16, right: 16,
          zIndex: 9999, background: 'rgba(14,12,9,0.95)', border: '1px solid rgba(255,100,0,0.35)',
          borderRadius: 14, padding: '12px 14px', backdropFilter: 'blur(8px)',
          fontFamily: "'Lexend',sans-serif",
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>📍</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#FF8C00', fontSize: 12, fontWeight: 700, marginBottom: 3 }}>
                {browserDenied ? 'GPS bị chặn bởi trình duyệt' : 'Không lấy được vị trí'}
              </div>
              <div style={{ color: '#6a5a40', fontSize: 10, lineHeight: 1.6 }}>
                {browserDenied
                  ? 'Vào Cài đặt trình duyệt → Quyền trang web → Vị trí → Cho phép dakgo.com'
                  : 'Kiểm tra kết nối mạng rồi thử lại, hoặc tự nhập địa chỉ khi đặt hàng'}
              </div>
            </div>
            {!browserDenied && (
              <button onClick={handleRetry} disabled={retrying} style={{
                flexShrink: 0, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,107,0,0.35)',
                background: 'rgba(255,107,0,0.1)', color: '#FF8C00', fontSize: 10,
                fontWeight: 700, cursor: 'pointer', fontFamily: "'Lexend',sans-serif",
                opacity: retrying ? 0.5 : 1,
              }}>
                {retrying ? '...' : '🔄 Thử lại'}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Các trang đã có inline bottom nav riêng ────────────────────────────────
const SELF_NAV_PATHS = [
  '/tracking', '/shop', '/search', '/cart', '/orders', '/profile',
  '/addresses', '/wallet', '/vouchers', '/loyalty', '/notifications', '/errand',
  '/checkout', '/order-success', '/review',
  '/bestsellers', '/promo-items', '/nearby-shops',
  '/mua-ho', '/giao-ho', '/xe-om', '/taxi', '/ride', '/invite',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 999,
          background: 'linear-gradient(135deg,#7c3aed,#b464ff)',
          color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: 0.5, flexShrink: 0,
        }}>🛡️ ADMIN</span>
        <span style={{ color: '#d4b4ff', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Đang xem giao diện khách · Mọi thao tác đều có hiệu lực thật
        </span>
      </div>
      <button onClick={exit} disabled={exiting} style={{
        height: 28, padding: '0 12px', borderRadius: 8, flexShrink: 0,
        background: exiting ? 'rgba(255,255,255,0.06)' : 'rgba(255,107,0,0.2)',
        border: '1px solid rgba(255,107,0,0.5)',
        color: exiting ? '#6a5a40' : '#FF8C00',
        fontSize: 11, fontWeight: 700, cursor: exiting ? 'not-allowed' : 'pointer',
        fontFamily: "'Lexend',sans-serif", whiteSpace: 'nowrap', transition: 'all .2s',
      }}>
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
    <MaintenanceGate>
      <GpsManager />
      <SoundPlayer />
      <PushPermissionPrompt />
      <AdminPreviewBar />
      {children}
      {!hasSelfNav && <FloatingBottomMenu />}
      <InstallPrompt />
    </MaintenanceGate>
  )
}
