'use client';

import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils';

interface RecentOrder {
  id: string;
  emoji: string;
  name: string;
  shop: string;
  price: number;
  ago: string;
}

const RECENT_ORDERS: RecentOrder[] = [
  { id: '1', emoji: '🧋', name: 'Trà sữa kem phô mai', shop: 'Mộc Trà', price: 32000, ago: '2 ngày trước' },
  { id: '2', emoji: '🍜', name: 'Bún bò đặc biệt', shop: 'Cô Ba', price: 45000, ago: '3 ngày trước' },
  { id: '3', emoji: '🍗', name: 'Gà rán 3 miếng', shop: 'Chicken Up', price: 55000, ago: '5 ngày trước' },
  { id: '4', emoji: '🥖', name: 'Bánh mì pate', shop: 'Bánh Mì 24h', price: 18000, ago: '1 tuần trước' },
];

function ReorderCard({ order, i }: { order: RecentOrder; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.07 }}
      className="flex-shrink-0 rounded-2xl p-3 flex flex-col gap-2"
      style={{
        width: 160,
        background: 'var(--glass)',
        border: '1px solid var(--border-2)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{order.emoji}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{order.name}</p>
          <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{order.shop}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black" style={{ color: 'var(--acc)' }}>{formatPrice(order.price)}</span>
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{order.ago}</span>
      </div>
      <motion.button
        whileTap={{ scale: 0.94 }}
        className="w-full py-1.5 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-bold"
        style={{
          background: 'var(--glass-acc)',
          border: '1px solid var(--border)',
          color: 'var(--acc)',
        }}
      >
        <RotateCcw size={11} />
        Đặt lại · {formatPrice(order.price)}
      </motion.button>
    </motion.div>
  );
}

export default function ReorderSection() {
  const router = useRouter();
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Hay đặt lại</h2>
        <button onClick={() => router.push('/orders')} className="text-xs font-semibold" style={{ color: 'var(--acc)' }}>Xem tất cả</button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
        {RECENT_ORDERS.map((order, i) => (
          <ReorderCard key={order.id} order={order} i={i} />
        ))}
      </div>
    </section>
  );
}
