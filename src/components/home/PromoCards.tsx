'use client';

import { motion } from 'framer-motion';
import { Star, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils';

interface PromoItem {
  id: string;
  emoji: string;
  name: string;
  shop: string;
  price: number;
  originalPrice: number;
  discount: number;
  rating: number;
  distance: number;
}

const PROMOS: PromoItem[] = [
  { id: '1', emoji: '🧋', name: 'Trà sữa trân châu', shop: 'Quán Mộc', price: 25000, originalPrice: 35000, discount: 28, rating: 4.9, distance: 0.8 },
  { id: '2', emoji: '🍗', name: 'Gà rán giòn tan', shop: 'Chicken Up', price: 45000, originalPrice: 60000, discount: 25, rating: 4.7, distance: 1.4 },
  { id: '3', emoji: '🍜', name: 'Bún bò Huế', shop: 'Nhà Hàng Mới', price: 40000, originalPrice: 50000, discount: 20, rating: 4.8, distance: 2.1 },
  { id: '4', emoji: '🍕', name: 'Pizza phô mai', shop: 'Pizza House', price: 89000, originalPrice: 120000, discount: 25, rating: 4.6, distance: 3.0 },
];

function PromoCard({ item, i }: { item: PromoItem; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.07 }}
      whileTap={{ scale: 0.96 }}
      className="flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer"
      style={{
        width: 'clamp(144px, 42vw, 160px)',
        background: 'var(--glass)',
        border: '1px solid var(--border-2)',
      }}
    >
      <div
        className="flex items-center justify-center text-4xl"
        style={{ position: 'relative', height: 100, background: 'var(--glass-acc)' }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 65%,rgba(255,107,0,0.08) 0%,transparent 65%)' }} />
        <span style={{ position: 'relative', zIndex: 1 }}>{item.emoji}</span>
        <span
          className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            background: '#EF4444',
            color: '#FFFFFF',
            boxShadow: '0 0 6px rgba(239,68,68,0.4)',
          }}
        >
          -{item.discount}%
        </span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
        <p className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.shop}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs font-black" style={{ color: 'var(--acc)' }}>
            {formatPrice(item.price)}
          </span>
          <span className="text-[10px] line-through" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {formatPrice(item.originalPrice)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1">
            <Star size={10} fill="#FF6B00" style={{ color: '#FF6B00' }} />
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.rating}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <MapPin size={9} style={{ color: 'rgba(255,255,255,0.35)' }} />
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.distance} km</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function PromoCards() {
  const router = useRouter();
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Khuyến mãi hôm nay</h2>
        <button onClick={() => router.push('/search?filter=promo')} className="text-xs font-semibold" style={{ color: 'var(--acc)' }}>
          Xem tất cả
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
        {PROMOS.map((item, i) => (
          <PromoCard key={item.id} item={item} i={i} />
        ))}
      </div>
    </section>
  );
}
