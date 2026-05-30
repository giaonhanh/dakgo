'use client'

import { motion } from 'framer-motion'
import { Home, ClipboardList, ShoppingCart, User } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'

const LEFT_TABS = [
  { id: 'home',   href: '/',       label: 'Trang chủ', Icon: Home },
  { id: 'orders', href: '/orders', label: 'Đơn hàng',  Icon: ClipboardList },
]
const RIGHT_TABS = [
  { id: 'profile', href: '/profile', label: 'Tài khoản', Icon: User },
]

export default function FloatingBottomMenu() {
  const router = useRouter()
  const pathname = usePathname()
  const cartCount = useCartStore((s) => s.totalQty())

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  function TabBtn({ href, label, Icon }: { href: string; label: string; Icon: React.ElementType }) {
    const active = isActive(href)
    return (
      <button
        onClick={() => router.push(href)}
        className="relative flex flex-col items-center gap-1 flex-1 py-2"
      >
        {active && (
          <motion.div
            layoutId="tab-halo"
            className="absolute inset-0 rounded-2xl"
            style={{ background: 'rgba(255,107,0,0.1)' }}
            transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
          />
        )}
        {/* Halo glow dưới icon */}
        {active && (
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 28,
              height: 3,
              background: 'radial-gradient(ellipse, rgba(255,107,0,0.9) 0%, transparent 70%)',
              filter: 'blur(1px)',
            }}
          />
        )}
        <Icon
          size={21}
          style={{
            color: active ? 'var(--acc)' : 'rgba(255,255,255,0.35)',
            transition: 'color 0.2s',
            position: 'relative',
            zIndex: 1,
            transform: active ? 'translateY(-2px)' : 'translateY(0)',
          }}
        />
        <span
          className="text-[10px] font-semibold leading-none"
          style={{
            color: active ? 'var(--acc)' : 'rgba(255,255,255,0.35)',
            transition: 'color 0.2s',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {label}
        </span>
      </button>
    )
  }

  return (
    <div
      className="fixed z-50"
      style={{ bottom: 'max(16px, env(safe-area-inset-bottom))', left: 14, right: 14 }}
    >
      <div
        className="flex items-center h-14 px-2"
        style={{
          borderRadius: 9999,
          background: 'rgba(8,8,6,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,107,0,0.2)',
          boxShadow: '0 0 20px rgba(255,107,0,0.1)',
        }}
      >
        {LEFT_TABS.map((t) => (
          <TabBtn key={t.id} href={t.href} label={t.label} Icon={t.Icon} />
        ))}

        {/* Cart button — float lên */}
        <button
          onClick={() => router.push('/cart')}
          className="relative flex-shrink-0 mx-2"
          style={{ marginTop: -28 }}
        >
          <motion.div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: isActive('/cart')
                ? 'linear-gradient(135deg, var(--acc) 0%, var(--acc-light) 100%)'
                : 'linear-gradient(135deg, #FF6B00 0%, #FF8C00 100%)',
            }}
            whileTap={{ scale: 0.9 }}
            animate={{
              boxShadow: isActive('/cart')
                ? ['0 0 20px rgba(255,107,0,0.6)', '0 0 36px rgba(255,107,0,0.9)', '0 0 20px rgba(255,107,0,0.6)']
                : ['0 0 12px rgba(255,107,0,0.3)', '0 0 20px rgba(255,107,0,0.5)', '0 0 12px rgba(255,107,0,0.3)'],
            }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            <ShoppingCart size={24} style={{ color: '#fff' }} />
            {cartCount > 0 && (
              <motion.span
                key={cartCount}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-black px-1"
                style={{ background: '#ff4040', color: '#fff' }}
              >
                {cartCount > 99 ? '99+' : cartCount}
              </motion.span>
            )}
          </motion.div>
        </button>

        {RIGHT_TABS.map((t) => (
          <TabBtn key={t.id} href={t.href} label={t.label} Icon={t.Icon} />
        ))}
      </div>
    </div>
  )
}
