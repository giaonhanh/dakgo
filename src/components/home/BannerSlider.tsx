'use client';

import { useState, useEffect } from 'react';
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

export default function BannerSlider() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrent((p) => (p + 1) % BANNERS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const banner = BANNERS[current];

  return (
    <section className="mb-5">
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ height: 120, border: '1px solid var(--border)' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={banner.id}
            style={{ position: 'absolute', inset: 0, background: banner.bg }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Glow top-right */}
            <div
              style={{
                position: 'absolute',
                top: -20,
                right: -15,
                width: 120,
                height: 120,
                background: `radial-gradient(circle,${banner.glow} 0%,transparent 65%)`,
              }}
            />
            {/* Shine animation */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)',
                animation: 'bannerShine 3.5s infinite',
              }}
            />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1, padding: '12px 14px' }}>
              <span
                className="inline-block text-[9px] font-black px-2 py-0.5 rounded-full mb-1.5"
                style={{ background: 'linear-gradient(135deg,#FF6B00,#FFB347)', color: '#080806' }}
              >
                {banner.tag}
              </span>
              <div
                className="text-sm font-black leading-tight"
                style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}
              >
                {banner.title}
              </div>
              <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {banner.sub}
              </div>
              <div
                className="inline-block mt-1.5 text-[9px] font-bold px-2.5 py-1 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                }}
              >
                {banner.cta}
              </div>
            </div>

            {/* Emoji */}
            <div
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 'clamp(38px, 10vw, 52px)',
                zIndex: 1,
                filter: `drop-shadow(0 0 14px ${banner.glow})`,
              }}
            >
              {banner.emoji}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-2.5">
        {BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === current ? 20 : 6,
              height: 6,
              background: i === current ? 'var(--acc)' : 'rgba(255,107,0,0.2)',
              boxShadow: i === current ? '0 0 6px rgba(255,107,0,0.5)' : 'none',
            }}
          />
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
