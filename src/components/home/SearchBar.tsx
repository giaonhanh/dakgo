'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';

export default function SearchBar() {
  const [focused, setFocused] = useState(false);

  return (
    <motion.section
      className="mb-5"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-2xl"
        style={{
          background: focused ? 'var(--glass-acc)' : 'var(--glass-2)',
          border: focused ? '1px solid var(--border-strong)' : '1px solid var(--border-2)',
          backdropFilter: 'blur(12px)',
          transition: 'border-color 0.2s, background 0.2s',
        }}
      >
        <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Tìm món ăn, cửa hàng, dịch vụ..."
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: 'var(--text-primary)', fontSize: 14, padding: 0 }}
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'var(--glass-acc)',
            border: '1px solid var(--border)',
          }}
        >
          <SlidersHorizontal size={14} style={{ color: 'var(--acc)' }} />
        </motion.button>
      </div>
    </motion.section>
  );
}
