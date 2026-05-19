'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface Category {
  id: string;
  emoji: string;
  label: string;
}

const CATEGORIES: Category[] = [
  { id: 'bun-pho', emoji: '🍜', label: 'Bún·Phở' },
  { id: 'ga-ran', emoji: '🍗', label: 'Gà rán' },
  { id: 'do-uong', emoji: '🧋', label: 'Đồ uống' },
  { id: 'com-hop', emoji: '🍱', label: 'Cơm hộp' },
  { id: 'pizza', emoji: '🍕', label: 'Pizza' },
  { id: 'banh-ngot', emoji: '🍰', label: 'Bánh ngọt' },
  { id: 'banh-mi', emoji: '🥖', label: 'Bánh mì' },
  { id: 'hai-san', emoji: '🦐', label: 'Hải sản' },
];

export default function CategoryCarousel() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Danh mục</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map((cat, i) => {
          const isActive = active === cat.id;
          return (
            <motion.button
              key={cat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setActive(isActive ? null : cat.id)}
              className="flex-shrink-0 flex flex-col items-center gap-2"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{
                  background: isActive ? 'rgba(255,107,0,0.10)' : 'var(--glass)',
                  border: isActive ? '1px solid rgba(255,107,0,0.5)' : '1px solid var(--border-2)',
                  boxShadow: isActive ? '0 0 16px rgba(255,107,0,0.2)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {cat.emoji}
              </div>
              <span
                className="text-[11px] font-semibold whitespace-nowrap"
                style={{ color: isActive ? 'var(--acc)' : 'var(--text-secondary)' }}
              >
                {cat.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
