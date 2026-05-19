'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface Service {
  name: string;
  emoji: string;
  href: string;
  iconBg: string;
  iconBorder: string;
  glow: string;
  badge?: 'HOT' | 'NEW';
}

const SERVICES: Service[] = [
  {
    name: 'Giao hộ',
    emoji: '🛵',
    href: '/errand',
    iconBg: 'rgba(255,107,0,0.12)',
    iconBorder: 'rgba(255,107,0,0.3)',
    glow: 'rgba(255,107,0,0.25)',
    badge: 'HOT',
  },
  {
    name: 'Mua hộ',
    emoji: '🛍️',
    href: '/errand?type=buy',
    iconBg: 'rgba(62,207,110,0.10)',
    iconBorder: 'rgba(62,207,110,0.3)',
    glow: 'rgba(62,207,110,0.25)',
  },
  {
    name: 'Xe ôm',
    emoji: '🏍️',
    href: '/ride',
    iconBg: 'rgba(74,143,245,0.10)',
    iconBorder: 'rgba(74,143,245,0.3)',
    glow: 'rgba(74,143,245,0.25)',
  },
  {
    name: 'Taxi',
    emoji: '🚕',
    href: '/ride',
    iconBg: 'rgba(180,100,255,0.10)',
    iconBorder: 'rgba(180,100,255,0.3)',
    glow: 'rgba(180,100,255,0.25)',
  },
];

export default function ServiceIcons() {
  const router = useRouter();

  return (
    <section className="mb-6">
      <div className="grid grid-cols-4 gap-3">
        {SERVICES.map((svc, i) => (
          <motion.button
            key={svc.name}
            onClick={() => router.push(svc.href)}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            whileTap={{ scale: 0.91 }}
            className="flex flex-col items-center gap-2"
          >
            <div style={{ position: 'relative' }}>
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
                style={{
                  background: svc.iconBg,
                  border: `1px solid ${svc.iconBorder}`,
                }}
                whileHover={{ boxShadow: `0 0 22px ${svc.glow}` }}
                transition={{ duration: 0.2 }}
              >
                {svc.emoji}
              </motion.div>
              {svc.badge && (
                <span
                  className="absolute -top-1.5 -right-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: '#EF4444', color: '#FFFFFF' }}
                >
                  {svc.badge}
                </span>
              )}
            </div>
            <span
              className="text-[11px] font-semibold text-center leading-tight"
              style={{ color: 'var(--text-secondary)' }}
            >
              {svc.name}
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
