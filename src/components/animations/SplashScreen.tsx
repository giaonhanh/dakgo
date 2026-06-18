'use client';

import { motion } from 'framer-motion';
import { useEffect } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#080806' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Expanding orange rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ border: '1px solid rgba(255,107,0,0.2)' }}
          initial={{ width: 80, height: 80, opacity: 0.8 }}
          animate={{
            width: [80, 320 + i * 100],
            height: [80, 320 + i * 100],
            opacity: [0.6, 0],
          }}
          transition={{
            duration: 2.2,
            delay: i * 0.45,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Center logo */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* Icon box */}
        <motion.div
          className="w-24 h-24 rounded-2xl flex items-center justify-center mb-5 relative overflow-hidden"
          style={{
            background: 'var(--glass-acc)',
            border: '1px solid var(--border)',
          }}
          animate={{
            boxShadow: [
              '0 0 20px rgba(255,107,0,0.25)',
              '0 0 60px rgba(255,107,0,0.55)',
              '0 0 20px rgba(255,107,0,0.25)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {/* logoShine animation */}
          <span
            className="absolute top-0 h-full w-[35%] pointer-events-none"
            style={{
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)',
              animation: 'logoShine 2.5s infinite',
            }}
          />
          <span className="text-5xl select-none relative z-10">🛵</span>
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-3xl font-black uppercase tracking-widest"
          style={{
            color: 'var(--acc)',
            animation: 'goldGlow 2s ease-in-out infinite',
          }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          Goi
        </motion.h1>

        <motion.p
          className="text-xs tracking-[0.4em] uppercase mt-2"
          style={{ color: 'var(--text-muted)' }}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
        >
          Krông Pắc
        </motion.p>
      </motion.div>

      {/* Progress bar */}
      <div
        className="absolute bottom-16 w-48 h-px rounded-full overflow-hidden"
        style={{ background: 'rgba(255,107,0,0.15)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--acc)' }}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 2.8, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  );
}
