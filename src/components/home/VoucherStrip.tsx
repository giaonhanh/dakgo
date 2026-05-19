'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Tag } from 'lucide-react';

interface Voucher {
  code: string;
  label: string;
  desc: string;
  pct: number;
  expires: string;
  color: string;
}

const VOUCHERS: Voucher[] = [
  { code: 'GIAO20', label: '20%', desc: 'Giảm phí giao hàng', pct: 20, expires: '31/05', color: 'var(--acc)' },
  { code: 'NEW15', label: '15%', desc: 'Cho khách mới', pct: 15, expires: '30/05', color: '#A78BFA' },
  { code: 'LUNCH10', label: '10%', desc: 'Ăn trưa tiết kiệm', pct: 10, expires: '29/05', color: '#34D399' },
  { code: 'HAPPY25', label: '25%', desc: 'Cuối tuần vui', pct: 25, expires: '28/05', color: '#F472B6' },
];

function VoucherCard({ v, i }: { v: Voucher; i: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.06 }}
      whileTap={{ scale: 0.95 }}
      className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${v.color}30`,
        minWidth: 200,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${v.color}18`, border: `1px solid ${v.color}35` }}
      >
        <Tag size={16} style={{ color: v.color }} />
      </div>
      <div className="text-left">
        <p className="text-sm font-black leading-none" style={{ color: v.color }}>
          -{v.label}
        </p>
        <p className="text-[11px] mt-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {v.desc}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          HSD: {v.expires} · {v.code}
        </p>
      </div>
    </motion.button>
  );
}

export default function VoucherStrip() {
  const router = useRouter();
  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Voucher dành cho bạn</h2>
        <button onClick={() => router.push('/vouchers')} className="text-xs font-semibold" style={{ color: 'var(--acc)' }}>
          Xem tất cả
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
        {VOUCHERS.map((v, i) => (
          <VoucherCard key={v.code} v={v} i={i} />
        ))}
      </div>
    </section>
  );
}
