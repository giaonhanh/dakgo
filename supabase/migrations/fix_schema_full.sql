-- ============================================================
-- FIX SCHEMA FULL — Giao Nhanh
-- Chạy toàn bộ file này trong Supabase SQL Editor
-- An toàn: dùng IF NOT EXISTS / DO NOTHING ở mọi bước
-- ============================================================


-- ════════════════════════════════════════════════
-- 1. BẢNG SHOPS — thêm các cột còn thiếu
-- ════════════════════════════════════════════════

-- Cột logo / cover (code dùng logo_url và cover_image_url)
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS logo_url         TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS rating_avg       NUMERIC(3,2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS total_reviews    INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS menu_groups_data JSONB,
  ADD COLUMN IF NOT EXISTS opening_hours    JSONB,
  ADD COLUMN IF NOT EXISTS prep_time        TEXT,
  ADD COLUMN IF NOT EXISTS category         TEXT,
  ADD COLUMN IF NOT EXISTS status           TEXT         DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ  DEFAULT now();

-- Đồng bộ rating_avg từ cột rating cũ (nếu có dữ liệu)
UPDATE shops SET rating_avg = rating WHERE rating_avg IS NULL AND rating IS NOT NULL;
UPDATE shops SET total_reviews = rating_count WHERE total_reviews = 0 AND rating_count > 0;

-- Đồng bộ logo_url từ avatar_url cũ (nếu có)
UPDATE shops SET logo_url = avatar_url WHERE logo_url IS NULL AND avatar_url IS NOT NULL;


-- ════════════════════════════════════════════════
-- 2. BẢNG PRODUCTS — thêm các cột còn thiếu
-- ════════════════════════════════════════════════

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS original_price INT,
  ADD COLUMN IF NOT EXISTS tags           TEXT[]       DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS sort_order     INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge          TEXT         CHECK (badge IN ('hot','bigsale','bestseller')),
  ADD COLUMN IF NOT EXISTS toppings       JSONB        DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sizes          JSONB        DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS all_day        BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS start_hour     TEXT,
  ADD COLUMN IF NOT EXISTS end_hour       TEXT,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ  DEFAULT now();

-- Index cho tags (GIN) để tìm theo danh mục
CREATE INDEX IF NOT EXISTS idx_products_tags      ON products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);


-- ════════════════════════════════════════════════
-- 3. BẢNG VOUCHERS — rebuild để khớp với code
-- Schema cũ chỉ có discount_pct, không đủ
-- ════════════════════════════════════════════════

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS title           TEXT,
  ADD COLUMN IF NOT EXISTS shop_id         UUID REFERENCES shops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT    DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS discount_value  INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_discount    INT,
  ADD COLUMN IF NOT EXISTS usage_limit     INT,
  ADD COLUMN IF NOT EXISTS per_person_limit INT,
  ADD COLUMN IF NOT EXISTS valid_from      TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_to        TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days',
  ADD COLUMN IF NOT EXISTS is_combo        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT now();

-- Xoá cột discount_pct cũ nếu không dùng nữa (comment out nếu muốn giữ)
-- ALTER TABLE vouchers DROP COLUMN IF EXISTS discount_pct;

-- RLS: cho phép shop owner quản lý voucher của mình
DROP POLICY IF EXISTS "Shop owner manages vouchers" ON vouchers;
CREATE POLICY "Shop owner manages vouchers" ON vouchers
  FOR ALL
  USING (
    shop_id IS NULL OR
    auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
  );


-- ════════════════════════════════════════════════
-- 4. BẢNG COMBO_ITEMS — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS combo_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id  UUID REFERENCES vouchers(id)  ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id)  ON DELETE CASCADE,
  min_quantity INT NOT NULL DEFAULT 1
);

ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone views combo items" ON combo_items;
CREATE POLICY "Anyone views combo items" ON combo_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Shop owner manages combo items" ON combo_items;
CREATE POLICY "Shop owner manages combo items" ON combo_items FOR ALL
  USING (
    auth.uid() = (
      SELECT s.owner_id FROM vouchers v
      JOIN shops s ON s.id = v.shop_id
      WHERE v.id = voucher_id
    )
  );


-- ════════════════════════════════════════════════
-- 5. BẢNG DRIVERS — thêm cột còn thiếu
-- ════════════════════════════════════════════════

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS vehicle_type        TEXT,
  ADD COLUMN IF NOT EXISTS license_plate       TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model       TEXT,
  ADD COLUMN IF NOT EXISTS rating_avg          NUMERIC(3,2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS total_trips         INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name           TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name   TEXT;


-- ════════════════════════════════════════════════
-- 6. BẢNG ORDERS — sửa tên cột + enum status
-- ════════════════════════════════════════════════

-- Thêm cột total_amount (code dùng) nếu chỉ có cột total
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_amount INT;

-- Đồng bộ total_amount từ total cũ
UPDATE orders SET total_amount = total WHERE total_amount IS NULL AND total IS NOT NULL;

-- Thêm các status mới vào enum (an toàn)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'preparing'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
  ) THEN
    ALTER TYPE order_status ADD VALUE 'preparing' AFTER 'accepted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ready'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
  ) THEN
    ALTER TYPE order_status ADD VALUE 'ready' AFTER 'preparing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'delivered'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
  ) THEN
    ALTER TYPE order_status ADD VALUE 'delivered' AFTER 'ready';
  END IF;
END$$;

-- RLS: shop owner xem đơn của cửa hàng mình
DROP POLICY IF EXISTS "Shop owner views orders" ON orders;
CREATE POLICY "Shop owner views orders" ON orders FOR SELECT
  USING (
    auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
  );

-- RLS: shop owner cập nhật trạng thái đơn
DROP POLICY IF EXISTS "Shop owner updates order status" ON orders;
CREATE POLICY "Shop owner updates order status" ON orders FOR UPDATE
  USING (
    auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
  );


-- ════════════════════════════════════════════════
-- 7. BẢNG NOTIFICATIONS — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  type       TEXT DEFAULT 'info',
  is_read    BOOLEAN DEFAULT false,
  data       JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User sees own notifications" ON notifications;
CREATE POLICY "User sees own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User marks notification read" ON notifications;
CREATE POLICY "User marks notification read" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications(user_id, is_read, created_at DESC);


-- ════════════════════════════════════════════════
-- 8. BẢNG WALLETS — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'customer',
  balance    BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, type)
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User sees own wallet" ON wallets;
CREATE POLICY "User sees own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════
-- 9. STORAGE BUCKETS — tạo bucket + set public
-- ════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('shop-covers',    'shop-covers',    true, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('shop-logos',     'shop-logos',     true, 2097152,  ARRAY['image/jpeg','image/png','image/webp']),
  ('product-images', 'product-images', true, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('avatars',        'avatars',        true, 2097152,  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS: cho phép user upload vào folder của mình
DROP POLICY IF EXISTS "Authenticated users upload shop covers"    ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload shop logos"     ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload avatars"        ON storage.objects;
DROP POLICY IF EXISTS "Public can view all images"               ON storage.objects;

CREATE POLICY "Public can view all images" ON storage.objects
  FOR SELECT USING (bucket_id IN ('shop-covers','shop-logos','product-images','avatars'));

CREATE POLICY "Authenticated users upload shop covers" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'shop-covers' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users upload shop logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'shop-logos' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users upload product images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users update own images" ON storage.objects
  FOR UPDATE USING (auth.role() = 'authenticated');


-- ════════════════════════════════════════════════
-- 10. KIỂM TRA sau khi chạy
-- ════════════════════════════════════════════════

-- Chạy từng câu dưới để xác nhận:

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'shops' ORDER BY ordinal_position;

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'products' ORDER BY ordinal_position;

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'vouchers' ORDER BY ordinal_position;

-- SELECT id, name, public FROM storage.buckets ORDER BY name;
