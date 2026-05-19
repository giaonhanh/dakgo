'use client';

import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';

interface FoodItem {
  name: string;
  price: number;
  image: string;
  shop: string;
  rating: number;
  ratingCount: number;
  distance: number;
  discount?: number;
}

interface FoodCardProps extends FoodItem {
  onAdd: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width="11" height="11" viewBox="0 0 24 24"
          fill={s <= Math.round(rating) ? '#FFD700' : 'rgba(255,215,0,0.2)'}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function FoodCard({ name, price, image, shop, rating, distance, discount, onAdd }: FoodCardProps) {
  const distLabel = distance < 1
    ? `${(distance * 1000).toFixed(0)}m`
    : `${distance.toFixed(1)} km`;

  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      className="flex-shrink-0 rounded-2xl overflow-hidden"
      style={{ width: 140, background: '#161008', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div style={{ position: 'relative', width: '100%', height: 110 }}>
        <Image src={image} alt={name} fill sizes="140px" className="object-cover" />
        {discount && (
          <span
            className="absolute top-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: '#FFD700', color: '#0D0907' }}
          >
            -{discount}%
          </span>
        )}
      </div>

      <div className="px-2.5 py-2">
        <p className="text-xs font-bold truncate" style={{ color: '#FFFFFF' }}>{name}</p>
        <StarRow rating={rating} />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs font-black" style={{ color: '#FFD700' }}>
            {formatPrice(price)}
          </span>
          <div className="flex items-center gap-0.5">
            <MapPin size={9} style={{ color: 'rgba(255,255,255,0.35)' }} />
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {distLabel}
            </span>
          </div>
        </div>
        <button
          onClick={onAdd}
          className="mt-2 w-full py-1 rounded-lg text-[10px] font-black"
          style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.2)' }}
        >
          + Thêm
        </button>
      </div>
    </motion.div>
  );
}

const PROMO_ITEMS: FoodItem[] = [
  { name: 'Cơm sườn',      price: 35000,  image: '/banner1.svg', shop: 'Quán Lan',       rating: 5, ratingCount: 120, distance: 2.2, discount: 20 },
  { name: 'Bánh mì',       price: 15000,  image: '/banner2.svg', shop: 'Bánh Mì 24h',    rating: 5, ratingCount: 98,  distance: 1.5 },
  { name: 'Bánh su kem',   price: 12000,  image: '/banner3.svg', shop: 'Tiệm Kem Ngon',  rating: 4, ratingCount: 74,  distance: 3.1 },
  { name: 'Trà sữa',       price: 25000,  image: '/banner1.svg', shop: 'Quán Mộc',        rating: 5, ratingCount: 210, distance: 0.8, discount: 15 },
];

const BEST_SELLERS: FoodItem[] = [
  { name: 'Cơm tấm',       price: 45000,  image: '/banner2.svg', shop: 'Cơm Tấm Lan',    rating: 5, ratingCount: 88,  distance: 2.8 },
  { name: 'Bún bò',        price: 40000,  image: '/banner3.svg', shop: 'Nhà Hàng Mới',   rating: 4, ratingCount: 55,  distance: 3.5 },
  { name: 'Bánh mì thịt',  price: 18000,  image: '/banner1.svg', shop: 'Tiệm Bánh',      rating: 5, ratingCount: 143, distance: 1.2 },
];

interface FoodSectionProps {
  onAddToCart: (item: FoodItem, e: React.MouseEvent<HTMLButtonElement>) => void;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold" style={{ color: '#FFFFFF' }}>{title}</h2>
      <button className="text-xs font-semibold" style={{ color: 'rgba(255,215,0,0.7)' }}>
        Xem tất cả
      </button>
    </div>
  );
}

export default function FoodSection({ onAddToCart }: FoodSectionProps) {
  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="Món ăn khuyến mãi" />
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {PROMO_ITEMS.map((item, i) => (
            <FoodCard key={i} {...item} onAdd={(e) => onAddToCart(item, e)} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Bán chạy hôm nay" />
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {BEST_SELLERS.map((item, i) => (
            <FoodCard key={i} {...item} onAdd={(e) => onAddToCart(item, e)} />
          ))}
        </div>
      </section>
    </div>
  );
}
