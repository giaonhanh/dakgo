'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils';

interface BestSellerItem {
  id: string;
  emoji: string;
  name: string;
  shop: string;
  price: number;
  rating: number;
  orders: number;
  rank: 1 | 2 | 3 | 4 | 5;
}

const ITEMS: BestSellerItem[] = [
  { id: '1', emoji: '🍜', name: 'Bún bò đặc biệt', shop: 'Cô Ba', price: 45000, rating: 4.9, orders: 312, rank: 1 },
  { id: '2', emoji: '🍗', name: 'Gà rán 3 miếng', shop: 'Chicken Up', price: 55000, rating: 4.8, orders: 287, rank: 2 },
  { id: '3', emoji: '🧋', name: 'Trà sữa kem phô mai', shop: 'Mộc Trà', price: 32000, rating: 4.8, orders: 265, rank: 3 },
  { id: '4', emoji: '🍱', name: 'Cơm sườn bì chả', shop: 'Cơm Tấm Lan', price: 40000, rating: 4.7, orders: 198, rank: 4 },
  { id: '5', emoji: '🥖', name: 'Bánh mì pate', shop: 'Bánh Mì 24h', price: 18000, rating: 4.6, orders: 180, rank: 5 },
];

const RANK_COLORS: Record<number, string> = {
  1: 'var(--acc)',
  2: '#C0C0C0',
  3: '#CD7F32',
};

function BestSellerCard({ item, i }: { item: BestSellerItem; i: number }) {
  const rankColor = RANK_COLORS[item.rank] ?? 'rgba(255,255,255,0.3)';

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.07 }}
      whileTap={{ scale: 0.95 }}
      className="flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer"
      style={{
        width: 'clamp(132px, 38vw, 148px)',
        background: 'var(--glass)',
        border: '1px solid var(--border-2)',
      }}
    >
      <div
        className="flex items-center justify-center text-4xl relative"
        style={{ height: 90, background: 'var(--glass)' }}
      >
        {item.emoji}
        <span
          className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black"
          style={{ background: rankColor, color: '#080806' }}
        >
          {item.rank}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
        <p className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.shop}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs font-black" style={{ color: 'var(--acc)' }}>{formatPrice(item.price)}</span>
          <div className="flex items-center gap-0.5">
            <Star size={9} fill="#FF6B00" style={{ color: '#FF6B00' }} />
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.rating}</span>
          </div>
        </div>
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {item.orders.toLocaleString('vi-VN')} lượt đặt
        </p>
      </div>
    </motion.div>
  );
}

export default function BestSellers() {
  const router = useRouter();
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Bán chạy hôm nay</h2>
        <button onClick={() => router.push('/search?filter=bestseller')} className="text-xs font-semibold" style={{ color: 'var(--acc)' }}>Xem tất cả</button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
        {ITEMS.map((item, i) => (
          <BestSellerCard key={item.id} item={item} i={i} />
        ))}
      </div>
    </section>
  );
}
