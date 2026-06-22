'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cartStore'
import { formatPrice } from '@/lib/utils'

interface PastOrder {
  id: string
  shop_id: string
  shop_name: string
  shop_logo: string | null
  total_amount: number
  created_at: string
  items: Array<{
    product_id: string
    name: string
    price: number
    quantity: number
    note: string | null
  }>
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Hôm nay'
  if (d === 1) return 'Hôm qua'
  if (d < 7) return `${d} ngày trước`
  if (d < 30) return `${Math.floor(d / 7)} tuần trước`
  return `${Math.floor(d / 30)} tháng trước`
}

function getOrderEmoji(shopName: string): string {
  const n = shopName.toLowerCase()
  if (n.includes('bún') || n.includes('phở') || n.includes('bun') || n.includes('pho')) return '🍜'
  if (n.includes('cơm') || n.includes('com')) return '🍱'
  if (n.includes('gà') || n.includes('ga')) return '🍗'
  if (n.includes('trà') || n.includes('tra') || n.includes('cafe') || n.includes('cà phê')) return '🧋'
  if (n.includes('bánh') || n.includes('banh')) return '🥖'
  if (n.includes('lẩu') || n.includes('lau') || n.includes('nướng')) return '🍲'
  return '🍽️'
}

function ReorderCard({ order, i }: { order: PastOrder; i: number }) {
  const router = useRouter()
  const { clearCart, addItem } = useCartStore()
  const [loading, setLoading] = useState(false)

  const firstItem = order.items[0]
  const label = order.items.length === 1
    ? firstItem?.name
    : `${firstItem?.name} +${order.items.length - 1} món`

  function handleReorder() {
    setLoading(true)
    clearCart()
    for (const it of order.items) {
      for (let q = 0; q < it.quantity; q++) {
        addItem({
          id:     it.product_id,
          name:   it.name,
          price:  it.price,
          shop:   order.shop_name,
          shopId: order.shop_id,
          note:   it.note ?? undefined,
        })
      }
    }
    router.push('/cart')
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.07 }}
      className="flex-shrink-0 rounded-2xl p-3 flex flex-col gap-2"
      style={{ width: 160, background: 'var(--glass)', border: '1px solid var(--border-2)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{getOrderEmoji(order.shop_name)}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {label}
          </p>
          <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {order.shop_name}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black" style={{ color: 'var(--acc)' }}>
          {formatPrice(order.total_amount)}
        </span>
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {timeAgo(order.created_at)}
        </span>
      </div>
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={handleReorder}
        disabled={loading}
        className="w-full py-1.5 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-bold"
        style={{
          background: loading ? 'rgba(255,107,0,0.05)' : 'var(--glass-acc)',
          border: '1px solid var(--border)',
          color: loading ? 'var(--text-muted)' : 'var(--acc)',
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        <RotateCcw size={11} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Đang thêm...' : 'Đặt lại'}
      </motion.button>
    </motion.div>
  )
}

export default function ReorderSection() {
  const router = useRouter()
  const [orders, setOrders] = useState<PastOrder[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: rawOrders } = await supabase
        .from('orders')
        .select(`
          id, shop_id, total_amount, created_at,
          shops ( name, logo_url ),
          order_items ( product_id, name, price, quantity, note )
        `)
        .eq('customer_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(6)

      if (!rawOrders) return

      const parsed: PastOrder[] = rawOrders
        .filter(o => (o.order_items as unknown[]).length > 0)
        .map(o => {
          const shop = o.shops as { name: string; logo_url: string | null } | null
          return {
            id:           o.id,
            shop_id:      o.shop_id,
            shop_name:    shop?.name ?? 'Quán',
            shop_logo:    shop?.logo_url ?? null,
            total_amount: o.total_amount,
            created_at:   o.created_at,
            items:        o.order_items as PastOrder['items'],
          }
        })

      setOrders(parsed)
    }
    load()
  }, [])

  if (orders.length === 0) return null

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Hay đặt lại</h2>
        <button
          onClick={() => router.push('/orders')}
          className="text-xs font-semibold"
          style={{ color: 'var(--acc)' }}
        >
          Xem tất cả
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
        {orders.map((order, i) => (
          <ReorderCard key={order.id} order={order} i={i} />
        ))}
      </div>
    </section>
  )
}
