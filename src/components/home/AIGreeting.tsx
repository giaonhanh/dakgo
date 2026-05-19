'use client';

import { motion } from 'framer-motion';

interface TimeSlot {
  label: string;
  icon: string;
  suggestion: string;
  food: string;
}

function getTimeSlot(): TimeSlot {
  const h = new Date().getHours();
  if (h < 10) return { label: 'Buổi sáng tốt lành', icon: '☀️', suggestion: 'Trời sáng mát, thích hợp ăn', food: 'bánh mì hoặc xôi' };
  if (h < 13) return { label: 'Buổi trưa ngon miệng', icon: '🌤️', suggestion: 'Giờ trưa rồi, gợi ý', food: 'cơm hộp hoặc bún bò' };
  if (h < 18) return { label: 'Buổi chiều thoải mái', icon: '🌥️', suggestion: 'Giải khát buổi chiều với', food: 'trà sữa hoặc nước ép' };
  return { label: 'Buổi tối thư giãn', icon: '🌙', suggestion: 'Tối nay thử', food: 'gà nướng hoặc lẩu' };
}

export default function AIGreeting() {
  const slot = getTimeSlot();

  return (
    <section className="mb-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>
          {slot.label} {slot.icon}
        </p>
        <p className="font-black leading-tight mb-3" style={{ color: 'var(--text-primary)', fontSize: 22 }}>
          Hôm nay bạn{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #FF6B00, #FFB347)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            muốn ăn gì?
          </span>
        </p>

        {/* AI suggestion box */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{
            background: 'rgba(180,100,255,0.06)',
            border: '1px solid rgba(180,100,255,0.2)',
          }}
        >
          <span style={{ fontSize: 18 }}>🤖</span>
          <p className="flex-1 text-[11px] leading-snug line-clamp-2" style={{ color: '#C4B5FD' }}>
            {slot.suggestion}{' '}
            <strong style={{ color: '#D884FF' }}>{slot.food}</strong>
          </p>
          <span style={{ color: 'rgba(180,100,255,0.6)', fontSize: 14, fontWeight: 700 }}>›</span>
        </motion.div>
      </motion.div>
    </section>
  );
}
