'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';

interface Particle {
  id: number;
  srcX: number;
  srcY: number;
  targetX: number;
  targetY: number;
  offset: number;
}

export function useParticleEffect() {
  const [particles, setParticles] = useState<Particle[]>([]);

  const spawnParticles = useCallback((srcX: number, srcY: number) => {
    if (typeof window === 'undefined') return;

    // Cart icon: 3rd of 4 tabs in bottom nav (inset-x-4, h-16, bottom 20px)
    const navLeft   = 16;
    const navWidth  = window.innerWidth - 32;
    const targetX   = navLeft + navWidth * (5 / 8);   // center of 3rd tab
    const targetY   = window.innerHeight - 20 - 32;   // nav bottom + half height

    const batch: Particle[] = Array.from({ length: 7 }, (_, i) => ({
      id: Date.now() + i,
      srcX,
      srcY,
      targetX,
      targetY,
      offset: (i - 3) * 6,   // slight horizontal scatter
    }));

    setParticles((prev) => [...prev, ...batch]);
    setTimeout(() => {
      const ids = new Set(batch.map((p) => p.id));
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 950);
  }, []);

  return { particles, spawnParticles };
}

export default function ParticleOverlay({ particles }: { particles: Particle[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      <AnimatePresence>
        {particles.map((pt) => {
          const dx = pt.targetX - pt.srcX + pt.offset;
          const dy = pt.targetY - pt.srcY;

          return (
            <motion.div
              key={pt.id}
              style={{
                position: 'absolute',
                left: pt.srcX - 5,
                top: pt.srcY - 5,
                width: 10,
                height: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                lineHeight: 1,
                userSelect: 'none',
              }}
              initial={{ scale: 1, opacity: 1, x: 0, y: 0 }}
              animate={{
                scale: [1, 1.4, 0.3],
                opacity: [1, 0.9, 0],
                x: [0, dx * 0.4 + pt.offset * 2, dx],
                y: [0, dy * 0.4 - 40, dy],
              }}
              transition={{ duration: 0.85, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <span style={{ color: '#FFD700', textShadow: '0 0 6px rgba(255,215,0,0.9)' }}>
                ✦
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
