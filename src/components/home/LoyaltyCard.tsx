'use client';

import { motion } from 'framer-motion';
import { Gift } from 'lucide-react';
import { useRouter } from 'next/navigation';

const TIER_CONFIG = {
  Bronze: { color: '#CD7F32', next: 'Silver', pointsNeeded: 500 },
  Silver: { color: '#C0C0C0', next: 'Gold', pointsNeeded: 1000 },
  Gold: { color: '#FFD700', next: 'Platinum', pointsNeeded: 2000 },
  Platinum: { color: '#A78BFA', next: null, pointsNeeded: 0 },
};

interface LoyaltyCardProps {
  points?: number;
  tier?: keyof typeof TIER_CONFIG;
  userName?: string;
}

export default function LoyaltyCard({ points = 340, tier = 'Bronze', userName = 'Bạn' }: LoyaltyCardProps) {
  const router = useRouter();
  const cfg = TIER_CONFIG[tier];
  const pct = cfg.pointsNeeded > 0 ? Math.min((points / cfg.pointsNeeded) * 100, 100) : 100;

  return (
    <section className="mb-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(109,40,217,0.1) 100%)',
          border: '1px solid rgba(139,92,246,0.3)',
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold mb-1" style={{ color: 'rgba(196,181,253,0.65)' }}>
              Điểm tích lũy của {userName}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black" style={{ color: '#C4B5FD' }}>
                {points.toLocaleString('vi-VN')}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'rgba(196,181,253,0.6)' }}>pts</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: `${cfg.color}22`, border: `1px solid ${cfg.color}50` }}
            >
              <Gift size={12} style={{ color: cfg.color }} />
              <span className="text-xs font-black" style={{ color: cfg.color }}>{tier}</span>
            </div>
          </div>
        </div>

        {cfg.next && (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px]" style={{ color: 'rgba(196,181,253,0.55)' }}>
                Còn {(cfg.pointsNeeded - points).toLocaleString('vi-VN')} pts lên {cfg.next}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: 'rgba(196,181,253,0.7)' }}>
                {Math.round(pct)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(196,181,253,0.1)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #A78BFA, #7C3AED)' }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-2 mt-4">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => router.push('/loyalty')}
            className="flex-1 py-2 rounded-xl text-xs font-bold"
            style={{
              background: 'rgba(139,92,246,0.25)',
              border: '1px solid rgba(139,92,246,0.45)',
              color: '#C4B5FD',
            }}
          >
            Đổi điểm
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => router.push('/orders')}
            className="flex-1 py-2 rounded-xl text-xs font-bold"
            style={{
              background: 'rgba(255,107,0,0.12)',
              border: '1px solid var(--border)',
              color: 'var(--acc)',
            }}
          >
            Xem lịch sử
          </motion.button>
        </div>
      </motion.div>
    </section>
  );
}
