'use client';

import { motion } from 'framer-motion';
import { Bell, ChevronDown } from 'lucide-react';
import RadarPulse from '@/components/animations/RadarPulse';

export default function HeaderGPS() {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: 'rgba(8,8,6,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,107,0,0.08)',
      }}
    >
      <div
        style={{
          maxWidth: 448,
          margin: '0 auto',
          padding: 'calc(10px + env(safe-area-inset-top)) 16px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: GPS location */}
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <RadarPulse />
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 500, lineHeight: 1 }}>
              Vị trí của bạn
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
              <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
                Krông Pắc, Đắk Lắk
              </p>
              <ChevronDown size={14} style={{ color: 'var(--acc)', marginTop: 1 }} />
            </div>
          </div>
        </button>

        {/* Right: Notification + Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Bell */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            style={{
              position: 'relative',
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={16} style={{ color: 'var(--acc)' }} />
            {/* Red dot */}
            <div
              style={{
                position: 'absolute',
                top: 5,
                right: 5,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--red)',
                border: '1.5px solid #080806',
                boxShadow: '0 0 4px rgba(255,64,64,0.7)',
              }}
            />
          </motion.button>

          {/* Avatar */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'var(--glass-acc)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
            }}
          >
            👤
          </motion.button>
        </div>
      </div>
    </header>
  );
}
