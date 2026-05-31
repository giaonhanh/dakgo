-- ============================================================
-- FIX SCHEMA FULL v2 — Giao Nhanh
-- Migration toàn diện cho DB đang chạy (không xóa dữ liệu)
-- An toàn: IF NOT EXISTS / DO NOTHING / ALTER COLUMN ở mọi bước
-- Tham chiếu schema đầy đủ: supabase/schema.sql
-- ============================================================


-- ════════════════════════════════════════════════
-- 1. BẢNG SHOPS — thêm các cột còn thiếu
-- ════════════════════════════════════════════════

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS logo_url                  TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url           TEXT,
  ADD COLUMN IF NOT EXISTS rating_avg                NUMERIC(3,2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS total_reviews             INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS menu_groups_data          JSONB,
  ADD COLUMN IF NOT EXISTS opening_hours             JSONB,
  ADD COLUMN IF NOT EXISTS prep_time                 TEXT,
  ADD COLUMN IF NOT EXISTS category                  TEXT,
  ADD COLUMN IF NOT EXISTS status                    TEXT         DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS commission_rate           NUMERIC(5,2) DEFAULT 15,
  ADD COLUMN IF NOT EXISTS is_negotiated_commission  BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at                TIMESTAMPTZ  DEFAULT now();

UPDATE shops SET rating_avg  = rating       WHERE rating_avg IS NULL AND rating IS NOT NULL;
UPDATE shops SET total_reviews = rating_count WHERE total_reviews = 0  AND rating_count > 0;
UPDATE shops SET logo_url    = avatar_url   WHERE logo_url IS NULL    AND avatar_url IS NOT NULL;

-- 1 chủ tài khoản chỉ được có 1 cửa hàng
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_owner_unique;
ALTER TABLE shops ADD CONSTRAINT shops_owner_unique UNIQUE (owner_id);


-- ════════════════════════════════════════════════
-- 1b. BẢNG DRIVERS — thêm các cột còn thiếu
-- ════════════════════════════════════════════════

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS status          TEXT         DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS is_approved     BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 20,
  ADD COLUMN IF NOT EXISTS id_card_number  TEXT,
  ADD COLUMN IF NOT EXISTS license_number  TEXT,
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ  DEFAULT now();

-- Đồng bộ is_online → status cho tài xế cũ
UPDATE drivers SET status = 'online' WHERE is_online = true AND status = 'offline';


-- ════════════════════════════════════════════════
-- 2. BẢNG PRODUCTS — thêm các cột còn thiếu
-- ════════════════════════════════════════════════

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS original_price INT,
  ADD COLUMN IF NOT EXISTS tags           TEXT[]  DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS sort_order     INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge          TEXT    CHECK (badge IN ('hot','bigsale','bestseller')),
  ADD COLUMN IF NOT EXISTS toppings       JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sizes          JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS all_day        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS start_hour     TEXT,
  ADD COLUMN IF NOT EXISTS end_hour       TEXT,
  ADD COLUMN IF NOT EXISTS sold_count     INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_products_tags       ON products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm  ON products USING gin(name gin_trgm_ops);


-- ════════════════════════════════════════════════
-- 3. BẢNG ORDERS — thêm cột + fix NOT NULL
-- ════════════════════════════════════════════════

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_amount   INT         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ship_fee       INT         DEFAULT 15000,
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS drop_address   TEXT,
  ADD COLUMN IF NOT EXISTS pickup_location geography(point, 4326),
  ADD COLUMN IF NOT EXISTS drop_location  geography(point, 4326),
  ADD COLUMN IF NOT EXISTS payment_code   INTEGER,
  ADD COLUMN IF NOT EXISTS cancel_reason  TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at   TIMESTAMPTZ;

-- Fix cột cũ có thể thiếu DEFAULT
ALTER TABLE orders ALTER COLUMN total     SET DEFAULT 0;
ALTER TABLE orders ALTER COLUMN ship_fee  SET DEFAULT 15000;

-- Đồng bộ total_amount
UPDATE orders SET total_amount = total WHERE total_amount IS NULL AND total IS NOT NULL;

-- Thêm enum values mới (an toàn)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'preparing'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status'))
  THEN ALTER TYPE order_status ADD VALUE 'preparing' AFTER 'accepted'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ready'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status'))
  THEN ALTER TYPE order_status ADD VALUE 'ready' AFTER 'preparing'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'delivered'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status'))
  THEN ALTER TYPE order_status ADD VALUE 'delivered' AFTER 'ready'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'done'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status'))
  THEN ALTER TYPE order_status ADD VALUE 'done' AFTER 'delivered'; END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_orders_payment_code ON orders(payment_code) WHERE payment_code IS NOT NULL;

-- RLS orders (shop owner)
DROP POLICY IF EXISTS "Shop owner views orders"         ON orders;
DROP POLICY IF EXISTS "Shop owner updates order status" ON orders;
CREATE POLICY "Shop owner views orders" ON orders FOR SELECT
  USING (auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id));
CREATE POLICY "Shop owner updates order status" ON orders FOR UPDATE
  USING (auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id));


-- ════════════════════════════════════════════════
-- 4. BẢNG ORDER_ITEMS — thêm cột note nếu thiếu
-- ════════════════════════════════════════════════

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS note TEXT;

DROP POLICY IF EXISTS "order_items_shop_select" ON order_items;
CREATE POLICY "order_items_shop_select" ON order_items FOR SELECT
  USING (
    auth.uid() = (
      SELECT s.owner_id FROM orders o JOIN shops s ON s.id = o.shop_id
      WHERE o.id = order_id
    )
  );


-- ════════════════════════════════════════════════
-- 5. BẢNG VOUCHERS — thêm cột + fix NOT NULL cũ
-- ════════════════════════════════════════════════

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS title            TEXT,
  ADD COLUMN IF NOT EXISTS shop_id          UUID REFERENCES shops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS discount_type    TEXT    DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS discount_value   INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_discount     INT,
  ADD COLUMN IF NOT EXISTS usage_limit      INT,
  ADD COLUMN IF NOT EXISTS per_person_limit INT,
  ADD COLUMN IF NOT EXISTS used_count       INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_from       TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_to         TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days',
  ADD COLUMN IF NOT EXISTS is_combo         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT now();

-- Fix cột cũ có NOT NULL mà không có DEFAULT
DO $$ BEGIN
  ALTER TABLE vouchers ALTER COLUMN discount_pct SET DEFAULT 0;
EXCEPTION WHEN others THEN NULL; END$$;
DO $$ BEGIN
  ALTER TABLE vouchers ALTER COLUMN is_combo SET DEFAULT false;
EXCEPTION WHEN others THEN NULL; END$$;

-- Fix RLS vouchers
DROP POLICY IF EXISTS "Shop owner manages vouchers" ON vouchers;
DROP POLICY IF EXISTS "Anyone views active vouchers" ON vouchers;
DROP POLICY IF EXISTS "vouchers_shop_manage"         ON vouchers;
DROP POLICY IF EXISTS "vouchers_admin_all"           ON vouchers;
DROP POLICY IF EXISTS "vouchers_public_active"       ON vouchers;

CREATE POLICY "vouchers_public_active" ON vouchers FOR SELECT USING (is_active = true);
CREATE POLICY "vouchers_shop_manage"   ON vouchers FOR ALL
  USING (shop_id IS NOT NULL AND auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id))
  WITH CHECK (shop_id IS NOT NULL AND auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id));
CREATE POLICY "vouchers_admin_all"     ON vouchers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ════════════════════════════════════════════════
-- 6. BẢNG VOUCHER_USAGES — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS voucher_usages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID        NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id),
  order_id   UUID        REFERENCES orders(id),
  used_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE voucher_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voucher_usages_own"       ON voucher_usages;
DROP POLICY IF EXISTS "voucher_usages_insert"    ON voucher_usages;
DROP POLICY IF EXISTS "voucher_usages_admin_all" ON voucher_usages;
CREATE POLICY "voucher_usages_own"       ON voucher_usages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "voucher_usages_insert"    ON voucher_usages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "voucher_usages_admin_all" ON voucher_usages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_voucher_usages_user    ON voucher_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_voucher_usages_voucher ON voucher_usages(voucher_id);

CREATE OR REPLACE FUNCTION increment_voucher_used_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE vouchers SET used_count = used_count + 1 WHERE id = NEW.voucher_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_voucher_usage_count ON voucher_usages;
CREATE TRIGGER trg_voucher_usage_count
  AFTER INSERT ON voucher_usages
  FOR EACH ROW EXECUTE FUNCTION increment_voucher_used_count();


-- ════════════════════════════════════════════════
-- 7. BẢNG COMBO_ITEMS — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS combo_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id   UUID REFERENCES vouchers(id)  ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id)  ON DELETE CASCADE,
  min_quantity INT  NOT NULL DEFAULT 1
);
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone views combo items"      ON combo_items;
DROP POLICY IF EXISTS "Shop owner manages combo items" ON combo_items;
CREATE POLICY "Anyone views combo items" ON combo_items FOR SELECT USING (true);
CREATE POLICY "Shop owner manages combo items" ON combo_items FOR ALL
  USING (auth.uid() = (
    SELECT s.owner_id FROM vouchers v JOIN shops s ON s.id = v.shop_id WHERE v.id = voucher_id
  ));


-- ════════════════════════════════════════════════
-- 8. BẢNG DRIVERS — thêm cột còn thiếu
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
-- 9. BẢNG SAVED_ADDRESSES — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS saved_addresses (
  id         UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID             NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label      TEXT             NOT NULL DEFAULT '🏠 Nhà',
  address    TEXT             NOT NULL,
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  is_default BOOLEAN          NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ      NOT NULL DEFAULT now()
);
ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addr_own" ON saved_addresses;
CREATE POLICY "addr_own" ON saved_addresses FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_addr_user ON saved_addresses(user_id, is_default DESC);


-- ════════════════════════════════════════════════
-- 10. BẢNG CHAT_MESSAGES — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES profiles(id),
  role       TEXT        NOT NULL CHECK (role IN ('customer', 'driver', 'shop')),
  content    TEXT        NOT NULL CHECK (char_length(content) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_order_parties" ON chat_messages;
CREATE POLICY "chat_order_parties" ON chat_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = chat_messages.order_id
      AND (o.customer_id = auth.uid() OR o.driver_id = auth.uid()
        OR auth.uid() = (SELECT owner_id FROM shops WHERE id = o.shop_id))
  ));

CREATE INDEX IF NOT EXISTS idx_chat_order ON chat_messages(order_id, created_at ASC);


-- ════════════════════════════════════════════════
-- 11. BẢNG PUSH_SUBSCRIPTIONS — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_sub_own" ON push_subscriptions;
CREATE POLICY "push_sub_own" ON push_subscriptions
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ════════════════════════════════════════════════
-- 12. ENUM wallet_type + tx_type (nếu chưa có)
-- ════════════════════════════════════════════════

DO $enum$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_type') THEN
    CREATE TYPE wallet_type AS ENUM ('customer','driver','merchant');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_type') THEN
    CREATE TYPE tx_type AS ENUM ('topup','payment','refund','commission','withdrawal','referral');
  ELSE
    -- Thêm 'referral' nếu chưa có
    BEGIN
      ALTER TYPE tx_type ADD VALUE 'referral';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$enum$;


-- ════════════════════════════════════════════════
-- 13. BẢNG WALLETS + TRANSACTIONS — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wallets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       wallet_type NOT NULL,
  balance    INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, type)
);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_own"       ON wallets;
DROP POLICY IF EXISTS "wallets_admin_all" ON wallets;
DROP POLICY IF EXISTS "User sees own wallet" ON wallets;
CREATE POLICY "wallets_own"       ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallets_admin_all" ON wallets FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS transactions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     UUID        NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type          tx_type     NOT NULL,
  amount        INTEGER     NOT NULL,
  balance_after INTEGER     NOT NULL,
  ref_type      TEXT,
  ref_id        UUID,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tx_wallet_owner" ON transactions;
DROP POLICY IF EXISTS "tx_admin_all"    ON transactions;
CREATE POLICY "tx_wallet_owner" ON transactions FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM wallets WHERE id = wallet_id));
CREATE POLICY "tx_admin_all"    ON transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_id, created_at DESC);


-- ════════════════════════════════════════════════
-- 14. BẢNG WALLET_TOPUPS — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wallet_topups (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_type  wallet_type NOT NULL DEFAULT 'customer',
  payment_code INTEGER     NOT NULL,
  amount       INTEGER     NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','paid','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE wallet_topups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topup_own"       ON wallet_topups;
DROP POLICY IF EXISTS "topup_admin_all" ON wallet_topups;
CREATE POLICY "topup_own"       ON wallet_topups USING (user_id = auth.uid());
CREATE POLICY "topup_admin_all" ON wallet_topups FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_topups_payment_code ON wallet_topups(payment_code);


-- ════════════════════════════════════════════════
-- 15. BẢNG APP_SETTINGS — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_admin_all"   ON app_settings;
DROP POLICY IF EXISTS "settings_public_read" ON app_settings;
CREATE POLICY "settings_admin_all"   ON app_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "settings_public_read" ON app_settings FOR SELECT
  USING (key IN ('features', 'app_hours', 'weather_surcharge', 'night_surcharge'));

INSERT INTO app_settings (key, value) VALUES
  ('pricing',    '{"food":{"rows":["15000","12000","10000","9000","8000","7500","7000","6500","6000","5500"],"extra":"5000"},"delivery_pkg":{"rows":["18000","15000","12000","10000","9000","8500","8000","7500","7000","6500"],"extra":"6000"},"errand":{"rows":["20000","17000","14000","12000","11000","10000","9000","8500","8000","7500"],"extra":"7000"},"motorbike":{"rows":["10000","8000","7000","6500","6000","5500","5000","4800","4600","4500"],"extra":"4000"},"taxi":{"rows":["15000","13000","11000","10000","9500","9000","8500","8000","7500","7000"],"extra":"6500"}}'),
  ('commission', '{"defaultRate":"15","minRate":"10","maxRate":"25","driverSharePercent":"80","platformSharePercent":"20","loyaltyPointsRate":"1"}'),
  ('features',   '{"maintenance_mode":false,"new_user_register":true,"driver_register":true,"merchant_register":true,"flash_sale":true,"loyalty_program":true,"surge_pricing":false,"ride_service":true,"errand_service":true,"wallet_topup":false}'),
  ('area',       '{"centerLat":"12.6521","centerLng":"108.5073","serviceName":"Phước An, Krông Pắc, Đắk Lắk","coverageRadius":"10"}'),
  ('delivery',   '{"maxRadius":"10","rushHourMultiplier":"1.3","rainMultiplier":"1.2","minDriverRating":"4.0"}'),
  ('app_hours',  '{"open":"07:00","close":"21:00"}'),
  ('weather_surcharge', '{"enabled":false,"type":"percent","value":"20"}'),
  ('night_surcharge',   '{"enabled":false,"start":"22:00","end":"05:00","fee":"5000"}')
ON CONFLICT (key) DO NOTHING;


-- ════════════════════════════════════════════════
-- 16. REFERRAL SYSTEM — tạo nếu chưa có
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS referral_codes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code         TEXT        UNIQUE NOT NULL,
  total_uses   INTEGER     NOT NULL DEFAULT 0,
  total_earned INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS referral_usages (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT    NOT NULL REFERENCES referral_codes(code),
  referee_id          UUID    NOT NULL REFERENCES profiles(id) UNIQUE,
  qualifying_order_id UUID    REFERENCES orders(id),
  referrer_rewarded   BOOLEAN NOT NULL DEFAULT false,
  referee_rewarded    BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE referral_codes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ref_codes_own"   ON referral_codes;
DROP POLICY IF EXISTS "ref_usage_own"   ON referral_usages;
DROP POLICY IF EXISTS "ref_codes_admin" ON referral_codes;
DROP POLICY IF EXISTS "ref_usage_admin" ON referral_usages;
CREATE POLICY "ref_codes_own"   ON referral_codes  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ref_usage_own"   ON referral_usages FOR SELECT USING (referee_id = auth.uid());
CREATE POLICY "ref_codes_admin" ON referral_codes  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "ref_usage_admin" ON referral_usages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_referral_usages_code ON referral_usages(code);


-- ════════════════════════════════════════════════
-- 17. NOTIFICATIONS — cập nhật nếu cần
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  body       TEXT,
  type       TEXT        NOT NULL DEFAULT 'info',
  is_read    BOOLEAN     NOT NULL DEFAULT false,
  data       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_own_select"              ON notifications;
DROP POLICY IF EXISTS "notif_own_update"              ON notifications;
DROP POLICY IF EXISTS "notif_admin_all"               ON notifications;
DROP POLICY IF EXISTS "User sees own notifications"   ON notifications;
DROP POLICY IF EXISTS "User marks notification read"  ON notifications;
CREATE POLICY "notif_own_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_own_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_admin_all"  ON notifications FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications(user_id, is_read, created_at DESC);


-- ════════════════════════════════════════════════
-- 18. FUNCTIONS — sync profiles + wallet ops
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
DECLARE v_phone TEXT; v_name TEXT;
BEGIN
  v_phone := COALESCE(
    NULLIF(TRIM(NEW.phone), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'user_' || substr(NEW.id::text, 1, 8)
  );
  v_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), v_phone);
  INSERT INTO profiles (id, phone, full_name, role)
  VALUES (NEW.id, v_phone, v_name, 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION add_to_wallet(
  p_user_id UUID, p_type wallet_type, p_amount INTEGER,
  p_ref_id UUID DEFAULT NULL, p_note TEXT DEFAULT '', p_tx_type tx_type DEFAULT 'topup'
) RETURNS INTEGER AS $$
DECLARE v_wallet_id UUID; v_balance INTEGER;
BEGIN
  INSERT INTO wallets (user_id, type, balance) VALUES (p_user_id, p_type, p_amount)
  ON CONFLICT (user_id, type) DO UPDATE
    SET balance = wallets.balance + p_amount, updated_at = now()
  RETURNING id, balance INTO v_wallet_id, v_balance;
  INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
  VALUES (v_wallet_id, p_tx_type, p_amount, v_balance,
    CASE WHEN p_ref_id IS NOT NULL THEN 'order' ELSE 'topup' END, p_ref_id, p_note);
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION subtract_from_wallet(
  p_user_id UUID, p_type wallet_type, p_amount INTEGER,
  p_ref_id UUID DEFAULT NULL, p_note TEXT DEFAULT '', p_tx_type tx_type DEFAULT 'payment'
) RETURNS INTEGER AS $$
DECLARE v_wallet_id UUID; v_balance INTEGER;
BEGIN
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM wallets WHERE user_id = p_user_id AND type = p_type FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE wallets SET balance = balance - p_amount, updated_at = now()
  WHERE id = v_wallet_id RETURNING balance INTO v_balance;
  INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
  VALUES (v_wallet_id, p_tx_type, p_amount, v_balance,
    CASE WHEN p_ref_id IS NOT NULL THEN 'order' ELSE 'payment' END, p_ref_id, p_note);
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ════════════════════════════════════════════════
-- 19. STORAGE BUCKETS + RLS
-- ════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('shop-covers',    'shop-covers',    true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('shop-logos',     'shop-logos',     true, 2097152, ARRAY['image/jpeg','image/png','image/webp']),
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('avatars',        'avatars',        true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Authenticated users upload shop covers"    ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload shop logos"     ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload avatars"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update own images"     ON storage.objects;
DROP POLICY IF EXISTS "Public can view all images"                ON storage.objects;
DROP POLICY IF EXISTS "storage_public_view"                       ON storage.objects;
DROP POLICY IF EXISTS "storage_auth_upload"                       ON storage.objects;
DROP POLICY IF EXISTS "storage_auth_update"                       ON storage.objects;
DROP POLICY IF EXISTS "storage_auth_delete"                       ON storage.objects;

CREATE POLICY "Public can view all images" ON storage.objects
  FOR SELECT USING (bucket_id IN ('shop-covers','shop-logos','product-images','avatars'));
CREATE POLICY "Authenticated users upload shop covers" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'shop-covers' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users upload shop logos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'shop-logos' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users upload product images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users update own images" ON storage.objects
  FOR UPDATE USING (auth.role() = 'authenticated');


-- ════════════════════════════════════════════════
-- 20. REALTIME — thêm bảng nếu chưa có
-- ════════════════════════════════════════════════

DO $rt$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE orders;        EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE drivers;       EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE notifications; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE voucher_usages;EXCEPTION WHEN others THEN NULL; END;
END$rt$;


-- ════════════════════════════════════════════════
-- 21. ĐỒNG BỘ PROFILES từ auth.users đã tồn tại
-- ════════════════════════════════════════════════

INSERT INTO profiles (id, phone, full_name, role)
SELECT u.id,
  COALESCE(NULLIF(TRIM(u.phone),''), NULLIF(split_part(COALESCE(u.email,''),'@',1),''), 'user_'||substr(u.id::text,1,8)),
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'full_name'),''), NULLIF(split_part(COALESCE(u.email,''),'@',1),''), 'Người dùng'),
  'customer'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════
-- 22. ERRANDS — giao hộ / mua hộ
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS errands (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id            UUID REFERENCES profiles(id),
  type                 TEXT NOT NULL DEFAULT 'deliver_for_me', -- 'deliver_for_me' | 'buy_for_me'
  status               TEXT NOT NULL DEFAULT 'pending',
  pickup_address       TEXT NOT NULL,
  pickup_lat           NUMERIC(10,6) NOT NULL DEFAULT 12.683,
  pickup_lng           NUMERIC(10,6) NOT NULL DEFAULT 108.483,
  delivery_address     TEXT NOT NULL,
  delivery_lat         NUMERIC(10,6) NOT NULL DEFAULT 12.683,
  delivery_lng         NUMERIC(10,6) NOT NULL DEFAULT 108.483,
  items_description    TEXT,
  estimated_items_cost NUMERIC(12,0),
  package_description  TEXT,
  package_photo_url    TEXT,
  note                 TEXT,
  service_fee          NUMERIC(12,0) NOT NULL DEFAULT 20000,
  actual_items_cost    NUMERIC(12,0),
  total_amount         NUMERIC(12,0),
  payment_method       TEXT NOT NULL DEFAULT 'cash',
  sender_name          TEXT,
  sender_phone         TEXT,
  recipient_name       TEXT,
  recipient_phone      TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE errands
  ADD COLUMN IF NOT EXISTS sender_name    TEXT,
  ADD COLUMN IF NOT EXISTS sender_phone   TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

DROP POLICY IF EXISTS "errands_customer_all" ON errands;
DROP POLICY IF EXISTS "errands_driver_read"  ON errands;

ALTER TABLE errands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "errands_customer_all" ON errands
  FOR ALL USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "errands_driver_read" ON errands
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('driver','admin'))
  );
CREATE POLICY "errands_driver_update" ON errands
  FOR UPDATE USING (
    driver_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ════════════════════════════════════════════════
-- 23. RIDES — xe ôm / taxi
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rides (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id        UUID REFERENCES profiles(id),
  status           TEXT NOT NULL DEFAULT 'searching',
  vehicle_type     TEXT NOT NULL DEFAULT 'motorbike', -- 'motorbike' | 'car'
  pickup_address   TEXT NOT NULL,
  pickup_lat       NUMERIC(10,6) NOT NULL DEFAULT 12.683,
  pickup_lng       NUMERIC(10,6) NOT NULL DEFAULT 108.483,
  dropoff_address  TEXT NOT NULL,
  dropoff_lat      NUMERIC(10,6) NOT NULL DEFAULT 12.683,
  dropoff_lng      NUMERIC(10,6) NOT NULL DEFAULT 108.483,
  distance_km      NUMERIC(6,2),
  estimated_fare   NUMERIC(12,0),
  final_fare       NUMERIC(12,0),
  payment_method   TEXT NOT NULL DEFAULT 'cash',
  note             TEXT,
  cancel_reason    TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

DROP POLICY IF EXISTS "rides_customer_all"  ON rides;
DROP POLICY IF EXISTS "rides_driver_read"   ON rides;
DROP POLICY IF EXISTS "rides_driver_update" ON rides;

ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rides_customer_all" ON rides
  FOR ALL USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "rides_driver_read" ON rides
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('driver','admin'))
  );
CREATE POLICY "rides_driver_update" ON rides
  FOR UPDATE USING (
    driver_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DO $rt2$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE errands; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE rides;   EXCEPTION WHEN others THEN NULL; END;
END$rt2$;


-- ════════════════════════════════════════════════
-- 24. BONUS_BALANCE — xu thưởng referral (không rút được)
-- ════════════════════════════════════════════════

ALTER TABLE wallets ADD COLUMN IF NOT EXISTS
  bonus_balance INTEGER NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0);

CREATE OR REPLACE FUNCTION add_bonus_to_wallet(
  p_user_id  UUID,
  p_type     wallet_type,
  p_amount   INTEGER,
  p_ref_id   UUID    DEFAULT NULL,
  p_note     TEXT    DEFAULT '',
  p_tx_type  tx_type DEFAULT 'referral'
) RETURNS INTEGER AS $$
DECLARE
  v_wallet_id UUID;
  v_bonus     INTEGER;
BEGIN
  INSERT INTO wallets (user_id, type, bonus_balance)
  VALUES (p_user_id, p_type, p_amount)
  ON CONFLICT (user_id, type) DO UPDATE
    SET bonus_balance = wallets.bonus_balance + p_amount,
        updated_at    = now()
  RETURNING id, bonus_balance INTO v_wallet_id, v_bonus;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
  VALUES (v_wallet_id, p_tx_type, p_amount, v_bonus, 'referral', p_ref_id, p_note);
  RETURN v_bonus;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cập nhật trigger thưởng referral → dùng bonus_balance
CREATE OR REPLACE FUNCTION process_referral_reward() RETURNS TRIGGER AS $$
DECLARE
  v_usage    referral_usages%ROWTYPE;
  v_ref_code referral_codes%ROWTYPE;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.total_amount, NEW.total) < 50000 THEN RETURN NEW; END IF;

  SELECT * INTO v_usage FROM referral_usages
  WHERE referee_id = NEW.customer_id
    AND qualifying_order_id IS NULL AND referrer_rewarded = false;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE referral_usages SET qualifying_order_id = NEW.id WHERE id = v_usage.id;
  SELECT * INTO v_ref_code FROM referral_codes WHERE code = v_usage.code;

  PERFORM add_bonus_to_wallet(v_ref_code.user_id, 'customer', 10000, v_usage.id,
    'Xu thưởng giới thiệu bạn bè', 'referral');
  INSERT INTO notifications (user_id, type, title, body, data) VALUES (
    v_ref_code.user_id, 'system', '🎉 Bạn nhận được 10.000đ xu thưởng!',
    'Người bạn giới thiệu vừa hoàn thành đơn đầu tiên. Xu thưởng chỉ dùng để thanh toán đơn hàng.',
    jsonb_build_object('xu_amount', 10000)
  );

  PERFORM add_bonus_to_wallet(NEW.customer_id, 'customer', 10000, v_usage.id,
    'Xu thưởng dùng mã giới thiệu', 'referral');
  INSERT INTO notifications (user_id, type, title, body, data) VALUES (
    NEW.customer_id, 'system', '🎁 Nhận 10.000đ xu thưởng từ mã giới thiệu!',
    'Đơn đầu tiên của bạn hoàn thành. Xu thưởng chỉ dùng để thanh toán đơn hàng.',
    jsonb_build_object('xu_amount', 10000)
  );

  UPDATE referral_codes
  SET total_uses = total_uses + 1, total_earned = total_earned + 10000
  WHERE code = v_usage.code;

  UPDATE referral_usages SET referrer_rewarded = true, referee_rewarded = true
  WHERE id = v_usage.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ════════════════════════════════════════════════
-- 25. APPLY REFERRAL CODE FUNCTION
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION apply_referral_code(p_code TEXT, p_referee_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  SELECT user_id INTO v_referrer_id FROM referral_codes WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN '{"ok":false,"error":"Mã giới thiệu không tồn tại"}'::JSONB;
  END IF;
  IF v_referrer_id = p_referee_id THEN
    RETURN '{"ok":false,"error":"Không thể dùng mã của chính mình"}'::JSONB;
  END IF;
  IF EXISTS (SELECT 1 FROM referral_usages WHERE referee_id = p_referee_id) THEN
    RETURN '{"ok":false,"error":"Bạn đã sử dụng mã giới thiệu trước đây"}'::JSONB;
  END IF;
  INSERT INTO referral_usages (code, referee_id)
  VALUES (p_code, p_referee_id) ON CONFLICT (referee_id) DO NOTHING;
  RETURN '{"ok":true}'::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ════════════════════════════════════════════════
-- 25. KIỂM TRA SAU KHI CHẠY
-- ════════════════════════════════════════════════

-- Chạy từng câu để xác nhận:

-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns WHERE table_name = 'vouchers' ORDER BY ordinal_position;

-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position;

-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'vouchers';
