'use client'

import { usePathname } from 'next/navigation'
import FloatingBottomMenu from '@/components/navigation/FloatingBottomMenu'

// Các trang đã có inline bottom nav riêng — không cần render thêm từ layout
const SELF_NAV_PATHS = [
  '/tracking', '/shop', '/search', '/cart', '/orders', '/profile',
  '/addresses', '/wallet', '/vouchers', '/loyalty', '/notifications', '/errand',
  '/checkout', '/order-success', '/review',
]

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hasSelfNav =
    pathname === '/' ||
    SELF_NAV_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  return (
    <>
      {children}
      {!hasSelfNav && <FloatingBottomMenu />}
    </>
  )
}
