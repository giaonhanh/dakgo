'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Tag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type VType = 'percent' | 'fixed' | 'freeship';

interface DbVoucher {
  id: string;
  code: string;
  title: string;
  discount_type: VType;
  discount_value: number;
  valid_to: string;
  shop_id: string | null;
}

const TYPE_COLOR: Record<VType, string> = {
  percent:  '#FF8C00',
  fixed:    '#3ecf6e',
  freeship: '#4a8ff5',
};

function getLabel(v: DbVoucher): string {
  if (v.discount_type === 'percent')  return `-${v.discount_value}%`;
  if (v.discount_type === 'freeship') return 'Free ship';
  return `-${v.discount_value.toLocaleString('vi-VN')}đ`;
}

function VoucherCard({ v, i }: { v: DbVoucher; i: number }) {
  const color  = TYPE_COLOR[v.discount_type];
  const daysLeft = Math.ceil((new Date(v.valid_to).getTime() - Date.now()) / 86400000);
  const expText  = daysLeft <= 0 ? 'Hết hạn hôm nay' : daysLeft === 1 ? 'Còn 1 ngày' : daysLeft <= 3 ? `Còn ${daysLeft} ngày` : new Date(v.valid_to).toLocaleDateString('vi-VN');
  const urgent   = daysLeft <= 3;

  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.07 }}
      whileTap={{ scale: 0.95 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 16, flexShrink: 0,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color}35`,
        minWidth: 192, cursor: 'pointer',
        fontFamily: 'Lexend, sans-serif',
        outline: 'none',
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: `${color}18`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Tag size={16} style={{ color }} />
      </div>
      <div style={{ textAlign: 'left', minWidth: 0 }}>
        <p style={{ color, fontSize: 15, fontWeight: 800, margin: 0, lineHeight: 1 }}>{getLabel(v)}</p>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10.5, margin: '4px 0 2px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{v.title}</p>
        <p style={{ color: urgent ? '#ff4040' : 'rgba(255,255,255,0.3)', fontSize: 8.5, margin: 0, fontWeight: urgent ? 700 : 400 }}>
          {expText} · {v.code}
        </p>
      </div>
    </motion.button>
  );
}

export default function VoucherStrip() {
  const router   = useRouter();
  const [vouchers, setVouchers] = useState<DbVoucher[]>([]);

  useEffect(() => {
    const now = new Date().toISOString();
    createClient()
      .from('vouchers')
      .select('id, code, title, discount_type, discount_value, valid_to, shop_id')
      .eq('is_active', true)
      .lte('valid_from', now)
      .gte('valid_to', now)
      .order('valid_to', { ascending: true })
      .limit(6)
      .then(({ data }) => { if (data) setVouchers(data as DbVoucher[]) });
  }, []);

  if (!vouchers.length) return null;

  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, margin: 0 }}>Voucher dành cho bạn</h2>
        <button onClick={() => router.push('/vouchers')} style={{ color: 'var(--acc)', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Lexend, sans-serif' }}>
          Xem tất cả
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
        {vouchers.map((v, i) => (
          <VoucherCard key={v.id} v={v} i={i} />
        ))}
      </div>
    </section>
  );
}
