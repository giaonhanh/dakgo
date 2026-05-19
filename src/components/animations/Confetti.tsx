'use client';

import { motion } from 'framer-motion';

const COLORS = ['#FF6B00', '#FF8C00', '#FFB347', '#3ecf6e', '#4a8ff5', '#b464ff', '#ff4040'];

export function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-[5px] h-[5px] rounded-[1px]"
          style={{
            background: COLORS[i % COLORS.length],
            left: `${Math.random() * 100}%`,
          }}
          animate={{ y: ['0%', '110%'], rotate: [0, 360], opacity: [1, 0] }}
          transition={{
            duration: 2 + Math.random() * 3,
            delay: Math.random() * 2,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}
