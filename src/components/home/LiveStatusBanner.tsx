'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface LiveStatusBannerProps {
  hasOrder?: boolean;
  minutesLeft?: number;
}

export default function LiveStatusBanner({ hasOrder = true, minutesLeft = 12 }: LiveStatusBannerProps) {
  if (!hasOrder) return null;

  return (
    <motion.section
      className="mb-4"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.button
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl"
        style={{
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.3)',
        }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: '#22C55E' }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <span className="text-xs font-semibold" style={{ color: '#4ADE80' }}>
            Đơn đang giao
          </span>
          <span className="text-xs" style={{ color: 'rgba(74,222,128,0.65)' }}>
            · còn {minutesLeft} phút
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <span className="text-xs font-semibold" style={{ color: '#4ADE80' }}>Theo dõi</span>
          <ChevronRight size={13} style={{ color: '#4ADE80' }} />
        </div>
      </motion.button>
    </motion.section>
  );
}
