'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface Dot {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

interface FloatingParticlesProps {
  count?: number;
}

export default function FloatingParticles({ count = 14 }: FloatingParticlesProps) {
  const dots = useMemo<Dot[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: 5 + (i / count) * 90 + (Math.sin(i * 2.4) * 8),
        y: 10 + ((i * 37) % 80),
        size: 1.5 + (i % 3) * 1.2,
        duration: 3.5 + (i % 5) * 0.8,
        delay: (i * 0.28) % 3.5,
        opacity: 0.35 + (i % 4) * 0.15,
      })),
    [count],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {dots.map((dot) => (
        <motion.div
          key={dot.id}
          className="absolute rounded-full"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            background: '#FFD700',
            boxShadow: `0 0 ${dot.size * 3}px rgba(255,215,0,0.85)`,
          }}
          animate={{
            y: [0, -18, 4, -10, 0],
            x: [0, 6, -4, 8, 0],
            opacity: [dot.opacity, dot.opacity + 0.4, dot.opacity, dot.opacity + 0.3, dot.opacity],
            scale: [1, 1.4, 0.7, 1.2, 1],
          }}
          transition={{
            duration: dot.duration,
            delay: dot.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
