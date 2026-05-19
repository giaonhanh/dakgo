'use client';

import { motion } from 'framer-motion';
import { Star, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Shop {
  id: string;
  emoji: string;
  name: string;
  tags: string[];
  badge: 'hot' | 'new' | null;
  rating: number;
  distance: number;
  eta: number;
  promo?: string;
}

const SHOPS: Shop[] = [
  { id: '1', emoji: '🍜', name: 'Bún Bò Cô Ba', tags: ['Bún', 'Phở'], badge: 'hot', rating: 4.9, distance: 0.6, eta: 15, promo: 'Miễn phí giao' },
  { id: '2', emoji: '🍗', name: 'Gà Nướng Phước An', tags: ['Gà nướng', 'Cơm'], badge: 'new', rating: 4.7, distance: 1.1, eta: 20 },
  { id: '3', emoji: '🧋', name: 'Trà Sữa Mộc Trà', tags: ['Trà sữa', 'Đồ uống'], badge: 'hot', rating: 4.8, distance: 1.4, eta: 18, promo: 'Giảm 20%' },
  { id: '4', emoji: '🍱', name: 'Cơm Hộp Văn Phòng', tags: ['Cơm hộp', 'Ăn trưa'], badge: null, rating: 4.6, distance: 2.0, eta: 25 },
  { id: '5', emoji: '🥖', name: 'Bánh Mì 24h', tags: ['Bánh mì', 'Ăn sáng'], badge: null, rating: 4.5, distance: 2.5, eta: 22 },
];

const BADGE_CONFIG = {
  hot: { label: 'HOT', bg: 'rgba(239,68,68,0.2)', color: '#FCA5A5', border: 'rgba(239,68,68,0.35)' },
  new: { label: 'NEW', bg: 'rgba(34,197,94,0.2)', color: '#86EFAC', border: 'rgba(34,197,94,0.35)' },
};

function ShopRow({ shop, i }: { shop: Shop; i: number }) {
  const badgeCfg = shop.badge ? BADGE_CONFIG[shop.badge] : null;

  return (
    <motion.button
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.07 }}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--border-2)',
        textAlign: 'left',
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: 'var(--glass-acc)' }}
      >
        {shop.emoji}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{shop.name}</span>
          {badgeCfg && (
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: badgeCfg.bg, color: badgeCfg.color, border: `1px solid ${badgeCfg.border}` }}
            >
              {badgeCfg.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {shop.tags.map((t) => (
            <span key={t} className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{t}</span>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-0.5">
            <Star size={10} fill="#FF6B00" style={{ color: '#FF6B00' }} />
            <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>{shop.rating}</span>
          </div>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{shop.distance} km</span>
          <div className="flex items-center gap-0.5">
            <Clock size={9} style={{ color: 'rgba(255,255,255,0.35)' }} />
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{shop.eta} phút</span>
          </div>
          {shop.promo && (
            <span className="text-[10px] font-semibold" style={{ color: 'var(--acc)' }}>{shop.promo}</span>
          )}
        </div>
      </div>

      <div className="text-lg flex-shrink-0" style={{ color: 'var(--text-muted)' }}>›</div>
    </motion.button>
  );
}

export default function NearbyShops() {
  const router = useRouter();
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Quán gần đây</h2>
        <button onClick={() => router.push('/search')} className="text-xs font-semibold" style={{ color: 'var(--acc)' }}>Xem tất cả</button>
      </div>
      <div className="flex flex-col gap-2">
        {SHOPS.map((shop, i) => (
          <ShopRow key={shop.id} shop={shop} i={i} />
        ))}
      </div>
    </section>
  );
}
