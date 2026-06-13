'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Banner {
  id: number;
  tag: string;
  title: string;
  sub: string;
  cta: string;
  emoji: string;
  bg: string;
  glow: string;
}

const BANNERS: Banner[] = [
  {
    id: 1,
    tag: '⚡ FLASH SALE · Còn 2h 15p',
    title: 'Trà sữa Ding Tea\nChỉ 15.000đ!',
    sub: 'Giảm 57% · Miễn phí ship',
    cta: 'Đặt ngay →',
    emoji: '🧋',
    bg: 'linear-gradient(135deg,#1a0d00,#2d1500,#0d0900)',
    glow: 'rgba(255,107,0,0.28)',
  },
  {
    id: 2,
    tag: '🍜 ĐẶC BIỆT HÔM NAY',
    title: 'Bún Bò Huế Ngon\nChỉ 34.000đ!',
    sub: 'Giảm 25% · Quán Cô Ba',
    cta: 'Xem ngay →',
    emoji: '🍜',
    bg: 'linear-gradient(135deg,#0d1a08,#152010,#060e04)',
    glow: 'rgba(52,211,153,0.2)',
  },
  {
    id: 3,
    tag: '🚚 MIỄN PHÍ SHIP',
    title: 'Gà rán giòn tan\nGiảm 30%!',
    sub: 'Áp dụng đến 22:00 · Gà Vàng PA',
    cta: 'Đặt ngay →',
    emoji: '🍗',
    bg: 'linear-gradient(135deg,#1a0a06,#2a1008,#0d0500)',
    glow: 'rgba(251,146,60,0.22)',
  },
];

const INTERVAL = 4500;

// Zoom-blur morph variants: banner cũ zoom to + blur mờ ra, banner mới thu nhỏ + blur → nét
const variants = {
  enter: {
    opacity: 0,
    scale: 0.86,
    filter: 'blur(14px)',
  },
  center: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
  },
  exit: {
    opacity: 0,
    scale: 1.12,
    filter: 'blur(10px)',
  },
};

const contentVariants = {
  enter:  { opacity: 0, y: 12, filter: 'blur(6px)' },
  center: { opacity: 1, y: 0,  filter: 'blur(0px)' },
  exit:   { opacity: 0, y: -8, filter: 'blur(4px)' },
};

const emojiVariants = {
  enter:  { opacity: 0, scale: 0.5, rotate: 20,  filter: 'blur(8px)' },
  center: { opacity: 1, scale: 1,   rotate: 0,   filter: 'blur(0px)' },
  exit:   { opacity: 0, scale: 1.3, rotate: -15, filter: 'blur(6px)' },
};

export default function BannerSlider() {
  const [current, setCurrent] = useState(0);
  const [tick, setTick] = useState(0); // dùng để reset progress bar
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const resetInterval = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrent(p => (p + 1) % BANNERS.length);
      setTick(t => t + 1);
    }, INTERVAL);
  };

  useEffect(() => {
    resetInterval();
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDotClick = (i: number) => {
    if (i === current) return;
    setCurrent(i);
    setTick(t => t + 1);
    resetInterval();
  };

  const banner = BANNERS[current];

  return (
    <section className="mb-5">
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ height: 120, border: '1px solid var(--border)' }}
      >
        <AnimatePresence mode="sync">
          <motion.div
            key={banner.id}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              opacity: { duration: 0.38, ease: [0.4, 0, 0.2, 1] },
              scale:   { duration: 0.42, ease: [0.4, 0, 0.2, 1] },
              filter:  { duration: 0.38, ease: 'easeOut' },
            }}
            style={{ position: 'absolute', inset: 0, background: banner.bg }}
          >
            {/* Glow top-right — fade in sau khi banner vào */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.18, duration: 0.5, ease: 'easeOut' }}
              style={{
                position: 'absolute', top: -20, right: -15,
                width: 130, height: 130,
                background: `radial-gradient(circle,${banner.glow} 0%,transparent 65%)`,
              }}
            />

            {/* Shine sweep */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)',
              animation: 'bannerShine 3.5s infinite',
            }} />

            {/* Content — stagger sau khi blur morph vào */}
            <div style={{ position: 'relative', zIndex: 1, padding: '12px 14px' }}>
              <motion.span
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ delay: 0.14, duration: 0.28, ease: 'easeOut' }}
                className="inline-block text-[9px] font-black px-2 py-0.5 rounded-full mb-1.5"
                style={{ background: 'linear-gradient(135deg,#FF6B00,#FFB347)', color: '#080806' }}
              >
                {banner.tag}
              </motion.span>

              <motion.div
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ delay: 0.2, duration: 0.28, ease: 'easeOut' }}
                className="text-sm font-black leading-tight"
                style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}
              >
                {banner.title}
              </motion.div>

              <motion.div
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ delay: 0.26, duration: 0.26 }}
                className="text-[10px] mt-1"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                {banner.sub}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)' }}
                exit={{    opacity: 0, scale: 0.9,  filter: 'blur(4px)' }}
                transition={{ delay: 0.3, duration: 0.24, ease: 'backOut' }}
                className="inline-block mt-1.5 text-[9px] font-bold px-2.5 py-1 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                }}
              >
                {banner.cta}
              </motion.div>
            </div>

            {/* Emoji — bay vào với blur morph */}
            <motion.div
              variants={emojiVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                opacity: { delay: 0.12, duration: 0.32 },
                scale:   { delay: 0.1,  type: 'spring', stiffness: 260, damping: 18 },
                rotate:  { delay: 0.1,  type: 'spring', stiffness: 200, damping: 16 },
                filter:  { delay: 0.1,  duration: 0.3 },
              }}
              style={{
                position: 'absolute', right: 14, top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 'clamp(38px, 10vw, 52px)',
                zIndex: 1,
                filter: `drop-shadow(0 0 16px ${banner.glow})`,
                display: 'flex', alignItems: 'center',
              }}
            >
              {banner.emoji}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators — progress fill như Instagram Stories */}
      <div className="flex justify-center gap-1.5 mt-2.5">
        {BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => handleDotClick(i)}
            style={{
              position: 'relative',
              height: 6,
              width: i === current ? 28 : 6,
              borderRadius: 9999,
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              background: i < current ? '#FF6B00' : 'rgba(255,107,0,0.2)',
              transition: 'width 0.3s ease, background 0.3s ease',
              overflow: 'hidden',
            }}
          >
            {/* Progress fill chạy từ trái sang phải trong INTERVAL ms */}
            {i === current && (
              <motion.span
                key={`progress-${tick}-${i}`}
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: INTERVAL / 1000, ease: 'linear' }}
                style={{
                  position: 'absolute', inset: 0,
                  background: '#FF6B00',
                  borderRadius: 9999,
                  transformOrigin: 'left center',
                  boxShadow: '0 0 6px rgba(255,107,0,0.7)',
                }}
              />
            )}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes bannerShine {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </section>
  );
}
