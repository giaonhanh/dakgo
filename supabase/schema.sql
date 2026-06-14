-- ============================================================
-- GIAO NHANH KRONG PAC — Database Schema v3.1
-- Single source of truth — tổng hợp base + tất cả migrations
-- Safe to run from scratch (DROP → CREATE)
-- ============================================================


-- ════════════════════════════════════════════════
-- EXTENSIONS
-- ════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ════════════════════════════════════════════════
-- DROP (thứ tự ngược để tránh lỗi FK)
-- ════════════════════════════════════════════════
DROP TRIGGER  IF EXISTS trigger_referral_reward    ON orders;
DROP TRIGGER  IF EXISTS trg_update_shop_rating     ON reviews;
DROP TRIGGER  IF EXISTS trg_handle_new_user        ON auth.users;
DROP TRIGGER  IF EXISTS trg_voucher_usage_count    ON voucher_usages;

DROP FUNCTION IF EXISTS process_referral_reward();
DROP FUNCTION IF EXISTS update_shop_rating();
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS get_recommendations(UUID, INTEGER);
DROP FUNCTION IF EXISTS search_catalog(TEXT);
DROP FUNCTION IF EXISTS add_to_wallet(UUID, wallet_type, INTEGER, UUID, TEXT, tx_type);
DROP FUNCTION IF EXISTS add_bonus_to_wallet(UUID, wallet_type, INTEGER, UUID, TEXT, tx_type);
DROP FUNCTION IF EXISTS subtract_from_wallet(UUID, wallet_type, INTEGER, UUID, TEXT, tx_type);
DROP FUNCTION IF EXISTS apply_referral_code(TEXT, UUID);
DROP FUNCTION IF EXISTS increment_voucher_used_count();

DROP TABLE IF EXISTS referral_usages    CASCADE;
DROP TABLE IF EXISTS referral_codes     CASCADE;
DROP TABLE IF EXISTS wallet_topups      CASCADE;
DROP TABLE IF EXISTS transactions       CASCADE;
DROP TABLE IF EXISTS wallets            CASCADE;
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS chat_messages      CASCADE;
DROP TABLE IF EXISTS voucher_usages     CASCADE;
DROP TABLE IF EXISTS combo_items        CASCADE;
DROP TABLE IF EXISTS vouchers           CASCADE;
DROP TABLE IF EXISTS app_settings       CASCADE;
DROP TABLE IF EXISTS notifications           CASCADE;
DROP TABLE IF EXISTS notification_schedules  CASCADE;
DROP TABLE IF EXISTS reviews            CASCADE;
DROP TABLE IF EXISTS blacklist          CASCADE;
DROP TABLE IF EXISTS order_items        CASCADE;
DROP TABLE IF EXISTS orders             CASCADE;
DROP TABLE IF EXISTS products           CASCADE;
DROP TABLE IF EXISTS drivers            CASCADE;
DROP TABLE IF EXISTS shops              CASCADE;
DROP TABLE IF EXISTS profiles           CASCADE;

DROP TYPE IF EXISTS tx_type      CASCADE;
DROP TYPE IF EXISTS wallet_type  CASCADE;
DROP TYPE IF EXISTS pay_method   CASCADE;
DROP TYPE IF EXISTS service_type CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS user_role    CASCADE;


-- ════════════════════════════════════════════════
-- ENUM TYPES
-- ════════════════════════════════════════════════
CREATE TYPE user_role    AS ENUM ('customer', 'driver', 'shop', 'admin');
CREATE TYPE order_status AS ENUM (
  'pending', 'accepted', 'preparing', 'ready', 'delivering', 'delivered', 'done', 'cancelled'
);
CREATE TYPE service_type AS ENUM ('food', 'buy_for', 'send_for', 'xe_om', 'taxi', 'errand');
CREATE TYPE pay_method   AS ENUM ('cash', 'vietqr', 'wallet');
CREATE TYPE wallet_type  AS ENUM ('customer', 'driver', 'merchant');
CREATE TYPE tx_type      AS ENUM ('topup', 'payment', 'refund', 'commission', 'withdrawal', 'referral');


-- ════════════════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════════════════
CREATE TABLE profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role   NOT NULL DEFAULT 'customer',
  full_name   TEXT,
  phone       TEXT        UNIQUE,
  avatar_url  TEXT,
  address     TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own"  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all"   ON profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));


-- ════════════════════════════════════════════════
-- SHOPS
-- ════════════════════════════════════════════════
CREATE TABLE shops (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  name              TEXT        NOT NULL,
  description       TEXT,
  category          TEXT,
  address           TEXT,
  location          geography(point, 4326),
  phone             TEXT,

  -- Images (logo_url = avatar, cover_image_url = banner)
  avatar_url        TEXT,        -- dùng ở home page (tương thích cũ)
  logo_url          TEXT,        -- dùng ở shop page và preview
  cover_image_url   TEXT,        -- ảnh bìa banner

  is_open           BOOLEAN     NOT NULL DEFAULT true,
  status            TEXT        NOT NULL DEFAULT 'pending',

  -- Ratings
  rating            NUMERIC(3,2) DEFAULT 5.0,   -- cột cũ, giữ tương thích
  rating_count      INT          DEFAULT 0,      -- cột cũ
  rating_avg        NUMERIC(3,2) DEFAULT 5.0,   -- cột mới dùng trong code
  total_reviews     INT          DEFAULT 0,      -- cột mới dùng trong code

  -- Menu & giờ mở cửa
  menu_groups_data  JSONB,
  opening_hours     JSONB,
  prep_time         TEXT,

  -- Hoa hồng
  commission_rate          NUMERIC(5,2) NOT NULL DEFAULT 10,
  is_negotiated_commission BOOLEAN      NOT NULL DEFAULT false,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT shops_owner_unique UNIQUE (owner_id)
);
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shops_select_open"    ON shops FOR SELECT USING (true);
CREATE POLICY "shops_owner_manage"   ON shops FOR ALL    USING (auth.uid() = owner_id);
CREATE POLICY "shops_admin_all"      ON shops FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shops_owner      ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_is_open    ON shops(is_open);
CREATE INDEX IF NOT EXISTS idx_shops_status     ON shops(status);
CREATE INDEX IF NOT EXISTS idx_shops_name_trgm  ON shops USING gin(name gin_trgm_ops);


-- ════════════════════════════════════════════════
-- DRIVERS
-- ════════════════════════════════════════════════
CREATE TABLE drivers (
  id                   UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_online            BOOLEAN     NOT NULL DEFAULT false,
  is_busy              BOOLEAN     NOT NULL DEFAULT false,
  location             geography(point, 4326),

  -- Phương tiện
  vehicle_type         TEXT,
  license_plate        TEXT,
  vehicle_model        TEXT,

  -- Trạng thái & phê duyệt
  status               TEXT        NOT NULL DEFAULT 'offline',
  is_approved          BOOLEAN     NOT NULL DEFAULT false,
  approved_at          TIMESTAMPTZ,

  -- Hoa hồng
  commission_rate      NUMERIC(5,2) NOT NULL DEFAULT 20,

  -- Giấy tờ
  id_card_number       TEXT,
  license_number       TEXT,

  -- Stats
  rating_avg           NUMERIC(3,2) DEFAULT 5.0,
  total_trips          INT          DEFAULT 0,

  -- Tài khoản ngân hàng
  bank_name            TEXT,
  bank_account_number  TEXT,
  bank_account_name    TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers_own"          ON drivers FOR ALL    USING (auth.uid() = id);
CREATE POLICY "drivers_online_view"  ON drivers FOR SELECT USING (is_online = true);
CREATE POLICY "drivers_admin_all"    ON drivers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ════════════════════════════════════════════════
-- PRODUCTS
-- ════════════════════════════════════════════════
CREATE TABLE products (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID        REFERENCES shops(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  description    TEXT,
  price          INT         NOT NULL,
  original_price INT,                           -- giá gốc (nếu đang giảm giá)
  image_url      TEXT,
  category       TEXT,                          -- nhóm menu nội bộ (= menuGroupId)
  tags           TEXT[]      DEFAULT ARRAY[]::TEXT[],  -- danh mục trang chủ
  badge          TEXT        CHECK (badge IN ('hot', 'bigsale', 'bestseller', 'new')),
  toppings       JSONB       DEFAULT '[]'::jsonb,
  sizes          JSONB       DEFAULT '[]'::jsonb,
  all_day        BOOLEAN     NOT NULL DEFAULT true,
  start_hour     TEXT,
  end_hour       TEXT,
  is_available   BOOLEAN     NOT NULL DEFAULT true,
  sort_order     INT         NOT NULL DEFAULT 0,
  sold_count     INT         DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_available" ON products FOR SELECT USING (true);
CREATE POLICY "products_shop_manage"      ON products FOR ALL
  USING (auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id));
CREATE POLICY "products_admin_all"        ON products FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "products_admin_all"        ON products FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_shop        ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_tags        ON products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_sort_order  ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm   ON products USING gin(name gin_trgm_ops);


-- ════════════════════════════════════════════════
-- ORDERS
-- ════════════════════════════════════════════════
CREATE TABLE orders (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID         REFERENCES profiles(id),
  driver_id        UUID         REFERENCES profiles(id),
  shop_id          UUID         REFERENCES shops(id),
  service_type     service_type NOT NULL DEFAULT 'food',
  status           order_status NOT NULL DEFAULT 'pending',
  pay_method       pay_method   NOT NULL DEFAULT 'cash',

  -- Giá tiền
  total            INT          NOT NULL DEFAULT 0,   -- cột cũ (tương thích)
  total_amount     INT          NOT NULL DEFAULT 0,   -- cột mới dùng trong code
  ship_fee         INT          NOT NULL DEFAULT 15000,

  -- Địa chỉ
  note             TEXT,
  cancel_reason    TEXT,
  pickup_address   TEXT,
  drop_address     TEXT,
  pickup_location  geography(point, 4326),
  drop_location    geography(point, 4326),

  -- Thanh toán
  payment_code     INTEGER,

  -- Thời gian
  scheduled_at     TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_customer_select"  ON orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "orders_driver_select"    ON orders FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "orders_shop_select"      ON orders FOR SELECT
  USING (auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id));
CREATE POLICY "orders_customer_insert"  ON orders FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "orders_driver_update"    ON orders FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "orders_shop_update"      ON orders FOR UPDATE
  USING (auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id));
CREATE POLICY "orders_admin_all"        ON orders FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer      ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver        ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop          ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_code  ON orders(payment_code) WHERE payment_code IS NOT NULL;


-- ════════════════════════════════════════════════
-- ORDER ITEMS
-- ════════════════════════════════════════════════
CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID REFERENCES orders(id)   ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  name        TEXT NOT NULL,
  price       INT  NOT NULL,
  qty         INT  NOT NULL DEFAULT 1,
  note        TEXT
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_order_owner" ON order_items FOR SELECT
  USING (auth.uid() = (SELECT customer_id FROM orders WHERE id = order_id));
CREATE POLICY "order_items_admin_all"   ON order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ════════════════════════════════════════════════
-- BLACKLIST
-- ════════════════════════════════════════════════
CREATE TABLE blacklist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT,
  blocked_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blacklist_admin" ON blacklist FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ════════════════════════════════════════════════
-- REVIEWS
-- ════════════════════════════════════════════════
CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID REFERENCES orders(id)   ON DELETE CASCADE,
  customer_id  UUID REFERENCES profiles(id),
  shop_id      UUID REFERENCES shops(id),
  driver_id    UUID REFERENCES profiles(id),
  shop_stars   INT  CHECK (shop_stars   BETWEEN 1 AND 5),
  driver_stars INT  CHECK (driver_stars BETWEEN 1 AND 5),
  comment      TEXT,
  images       TEXT[],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_customer_insert" ON reviews FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "reviews_public_select"   ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_admin_all"       ON reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_reviews_shop   ON reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_driver ON reviews(driver_id);


-- ════════════════════════════════════════════════
-- VOUCHERS
-- ════════════════════════════════════════════════
CREATE TABLE vouchers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID        REFERENCES shops(id) ON DELETE CASCADE,
  code             TEXT        UNIQUE NOT NULL,
  title            TEXT,
  discount_type    TEXT        NOT NULL DEFAULT 'percent'
                               CHECK (discount_type IN ('percent','fixed','freeship','combo')),
  discount_value   INT         NOT NULL DEFAULT 0,
  min_order        INT         NOT NULL DEFAULT 0,
  max_discount     INT,
  usage_limit      INT,
  per_person_limit INT,
  used_count       INT         NOT NULL DEFAULT 0,
  valid_from       TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to         TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days',
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  is_combo         BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vouchers_public_active"  ON vouchers FOR SELECT USING (is_active = true);
CREATE POLICY "vouchers_shop_manage"    ON vouchers FOR ALL
  USING (
    shop_id IS NOT NULL AND
    auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
  )
  WITH CHECK (
    shop_id IS NOT NULL AND
    auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
  );
CREATE POLICY "vouchers_admin_all"      ON vouchers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_vouchers_shop      ON vouchers(shop_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_active    ON vouchers(is_active, valid_to);


-- ════════════════════════════════════════════════
-- VOUCHER USAGES  (theo dõi per_person_limit + used_count)
-- ════════════════════════════════════════════════
CREATE TABLE voucher_usages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID        NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id),
  order_id   UUID        REFERENCES orders(id),
  used_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE voucher_usages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voucher_usages_own"       ON voucher_usages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "voucher_usages_insert"    ON voucher_usages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "voucher_usages_admin_all" ON voucher_usages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_voucher_usages_user    ON voucher_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_voucher_usages_voucher ON voucher_usages(voucher_id);


-- ════════════════════════════════════════════════
-- COMBO ITEMS
-- ════════════════════════════════════════════════
CREATE TABLE combo_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id   UUID REFERENCES vouchers(id)  ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id)  ON DELETE CASCADE,
  min_quantity INT  NOT NULL DEFAULT 1
);
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "combo_public_select"   ON combo_items FOR SELECT USING (true);
CREATE POLICY "combo_shop_manage"     ON combo_items FOR ALL
  USING (
    auth.uid() = (
      SELECT s.owner_id FROM vouchers v
      JOIN shops s ON s.id = v.shop_id
      WHERE v.id = voucher_id
    )
  );


-- ════════════════════════════════════════════════
-- NOTIFICATIONS
-- ════════════════════════════════════════════════
CREATE TABLE notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  body       TEXT,
  type       TEXT        NOT NULL DEFAULT 'info',
  is_read    BOOLEAN     NOT NULL DEFAULT false,
  data       JSONB,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- deleted_at IS NULL: ẩn thông báo user đã xoá mà không xoá row thật (admin vẫn thấy)
CREATE POLICY "notif_own_select"  ON notifications FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "notif_own_update"  ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_admin_all"   ON notifications FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications(user_id, is_read, created_at DESC);


-- ════════════════════════════════════════════════
-- NOTIFICATION SCHEDULES (hẹn giờ gửi thông báo)
-- ════════════════════════════════════════════════
CREATE TABLE notification_schedules (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  type         TEXT        NOT NULL DEFAULT 'system'
               CHECK (type IN ('promo','system','order','ride')),
  audience     TEXT        NOT NULL DEFAULT 'all'
               CHECK (audience IN ('all','customers','drivers','merchants')),
  image_url    TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at      TIMESTAMPTZ,
  sent_count   INT         NOT NULL DEFAULT 0,
  created_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ns_admin_all" ON notification_schedules
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE INDEX IF NOT EXISTS idx_ns_scheduled
  ON notification_schedules(scheduled_at) WHERE sent_at IS NULL;


-- ════════════════════════════════════════════════
-- WALLETS
-- ════════════════════════════════════════════════
CREATE TABLE wallets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          wallet_type NOT NULL,
  balance       INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  bonus_balance INTEGER     NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, type)
);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_own"       ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallets_admin_all" ON wallets FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ════════════════════════════════════════════════
-- TRANSACTIONS
-- ════════════════════════════════════════════════
CREATE TABLE transactions (
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
CREATE POLICY "tx_wallet_owner" ON transactions FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM wallets WHERE id = wallet_id));
CREATE POLICY "tx_admin_all"    ON transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_id, created_at DESC);


-- ════════════════════════════════════════════════
-- CHAT MESSAGES
-- ════════════════════════════════════════════════
CREATE TABLE chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES profiles(id),
  role       TEXT        NOT NULL CHECK (role IN ('customer', 'driver', 'shop')),
  content    TEXT        NOT NULL CHECK (char_length(content) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_order_parties" ON chat_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = chat_messages.order_id
        AND (o.customer_id = auth.uid() OR o.driver_id = auth.uid()
          OR auth.uid() = (SELECT owner_id FROM shops WHERE id = o.shop_id))
    )
  );

CREATE INDEX IF NOT EXISTS idx_chat_order ON chat_messages(order_id, created_at ASC);


-- ════════════════════════════════════════════════
-- PUSH SUBSCRIPTIONS
-- ════════════════════════════════════════════════
CREATE TABLE push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_sub_own" ON push_subscriptions
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ════════════════════════════════════════════════
-- WALLET TOPUPS (PayOS)
-- ════════════════════════════════════════════════
CREATE TABLE wallet_topups (
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
CREATE POLICY "topup_own"       ON wallet_topups USING (user_id = auth.uid());
CREATE POLICY "topup_admin_all" ON wallet_topups FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_topups_payment_code ON wallet_topups(payment_code);


-- ════════════════════════════════════════════════
-- APP SETTINGS
-- ════════════════════════════════════════════════
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
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
-- SAVED ADDRESSES
-- ════════════════════════════════════════════════
CREATE TABLE saved_addresses (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label      TEXT        NOT NULL DEFAULT '🏠 Nhà',
  address    TEXT        NOT NULL,
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  is_default BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addr_own" ON saved_addresses FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_addr_user ON saved_addresses(user_id, is_default DESC);


-- ════════════════════════════════════════════════
-- REFERRAL SYSTEM
-- ════════════════════════════════════════════════
CREATE TABLE referral_codes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code         TEXT        UNIQUE NOT NULL,
  total_uses   INTEGER     NOT NULL DEFAULT 0,
  total_earned INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE referral_usages (
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

CREATE POLICY "ref_codes_own"   ON referral_codes  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ref_usage_own"   ON referral_usages FOR SELECT USING (referee_id = auth.uid());
CREATE POLICY "ref_codes_admin" ON referral_codes  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "ref_usage_admin" ON referral_usages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_referral_usages_code ON referral_usages(code);


-- ════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('shop-covers',    'shop-covers',    true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('shop-logos',     'shop-logos',     true, 2097152, ARRAY['image/jpeg','image/png','image/webp']),
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('avatars',        'avatars',        true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS
CREATE POLICY "storage_public_view" ON storage.objects
  FOR SELECT USING (bucket_id IN ('shop-covers','shop-logos','product-images','avatars'));

CREATE POLICY "storage_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('shop-covers','shop-logos','product-images','avatars')
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage_auth_update" ON storage.objects
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "storage_auth_delete" ON storage.objects
  FOR DELETE USING (auth.role() = 'authenticated');


-- ════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ════════════════════════════════════════════════

-- ── 1. Auto sync profile khi user mới đăng ký ──
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  v_phone TEXT;
  v_name  TEXT;
BEGIN
  v_phone := COALESCE(
    NULLIF(TRIM(NEW.phone), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'user_' || substr(NEW.id::text, 1, 8)
  );
  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    v_phone
  );
  INSERT INTO profiles (id, phone, full_name, role)
  VALUES (NEW.id, v_phone, v_name, 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── 2. Auto increment used_count khi voucher được dùng ──
CREATE OR REPLACE FUNCTION increment_voucher_used_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE vouchers SET used_count = used_count + 1 WHERE id = NEW.voucher_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_voucher_usage_count
  AFTER INSERT ON voucher_usages
  FOR EACH ROW EXECUTE FUNCTION increment_voucher_used_count();


-- ── 3. Auto update rating shop khi có review mới ──
CREATE OR REPLACE FUNCTION update_shop_rating() RETURNS TRIGGER AS $$
BEGIN
  UPDATE shops SET
    rating       = (SELECT AVG(shop_stars)  FROM reviews WHERE shop_id = NEW.shop_id),
    rating_avg   = (SELECT AVG(shop_stars)  FROM reviews WHERE shop_id = NEW.shop_id),
    rating_count = (SELECT COUNT(*)         FROM reviews WHERE shop_id = NEW.shop_id),
    total_reviews= (SELECT COUNT(*)         FROM reviews WHERE shop_id = NEW.shop_id)
  WHERE id = NEW.shop_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_shop_rating
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_shop_rating();


-- ── 4. Cộng tiền vào ví ──
CREATE OR REPLACE FUNCTION add_to_wallet(
  p_user_id  UUID,
  p_type     wallet_type,
  p_amount   INTEGER,
  p_ref_id   UUID    DEFAULT NULL,
  p_note     TEXT    DEFAULT '',
  p_tx_type  tx_type DEFAULT 'topup'
) RETURNS INTEGER AS $$
DECLARE
  v_wallet_id UUID;
  v_balance   INTEGER;
BEGIN
  INSERT INTO wallets (user_id, type, balance)
  VALUES (p_user_id, p_type, p_amount)
  ON CONFLICT (user_id, type) DO UPDATE
    SET balance    = wallets.balance + p_amount,
        updated_at = now()
  RETURNING id, balance INTO v_wallet_id, v_balance;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
  VALUES (
    v_wallet_id, p_tx_type, p_amount, v_balance,
    CASE WHEN p_ref_id IS NOT NULL THEN 'order' ELSE 'topup' END,
    p_ref_id, p_note
  );
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 4b. Cộng xu thưởng (không rút được) vào bonus_balance ──
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
  VALUES (
    v_wallet_id, p_tx_type, p_amount, v_bonus,
    'referral', p_ref_id, p_note
  );
  RETURN v_bonus;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 5. Trừ tiền khỏi ví ──
CREATE OR REPLACE FUNCTION subtract_from_wallet(
  p_user_id  UUID,
  p_type     wallet_type,
  p_amount   INTEGER,
  p_ref_id   UUID    DEFAULT NULL,
  p_note     TEXT    DEFAULT '',
  p_tx_type  tx_type DEFAULT 'payment'
) RETURNS INTEGER AS $$
DECLARE
  v_wallet_id UUID;
  v_balance   INTEGER;
BEGIN
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM wallets WHERE user_id = p_user_id AND type = p_type FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE wallets
  SET balance = balance - p_amount, updated_at = now()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_balance;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
  VALUES (
    v_wallet_id, p_tx_type, p_amount, v_balance,
    CASE WHEN p_ref_id IS NOT NULL THEN 'order' ELSE 'payment' END,
    p_ref_id, p_note
  );
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 6. Smart recommendations ──
CREATE OR REPLACE FUNCTION get_recommendations(uid UUID, lim INTEGER DEFAULT 10)
RETURNS TABLE (
  id             UUID, name TEXT, price INTEGER,
  original_price INTEGER, image_url TEXT, sold_count INTEGER,
  shop_id UUID, shop_name TEXT, order_count BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id, p.name, p.price, p.original_price, p.image_url, p.sold_count,
    p.shop_id, s.name AS shop_name, sc.cnt AS order_count
  FROM products p
  JOIN shops s ON s.id = p.shop_id
  JOIN (
    SELECT shop_id, COUNT(*) AS cnt
    FROM orders
    WHERE customer_id = uid AND status = 'delivered'
    GROUP BY shop_id ORDER BY cnt DESC LIMIT 5
  ) sc ON sc.shop_id = p.shop_id
  WHERE p.is_available = true
  ORDER BY p.id, sc.cnt DESC, p.sold_count DESC
  LIMIT lim;
END;
$$;


-- ── 7. Full-text search catalog ──
CREATE OR REPLACE FUNCTION search_catalog(query TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  products_result JSONB;
  shops_result    JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(r ORDER BY r.score DESC, r.sold_count DESC), '[]'::jsonb)
  INTO products_result
  FROM (
    SELECT p.id, p.name, p.price, p.original_price, p.image_url, p.sold_count, p.shop_id,
           s.name AS shop_name,
           GREATEST(similarity(p.name, query), 0) AS score
    FROM products p JOIN shops s ON s.id = p.shop_id
    WHERE p.is_available = true
      AND (p.name ILIKE '%' || query || '%' OR similarity(p.name, query) > 0.15)
    LIMIT 20
  ) r;

  SELECT COALESCE(jsonb_agg(r ORDER BY r.score DESC, r.rating_avg DESC), '[]'::jsonb)
  INTO shops_result
  FROM (
    SELECT s.id, s.name, s.category, s.logo_url, s.cover_image_url,
           s.rating_avg, s.total_reviews, s.is_open,
           s.lat, s.lng,
           GREATEST(similarity(s.name, query), 0) AS score
    FROM shops s
    WHERE s.status = 'approved'
      AND (s.name ILIKE '%' || query || '%' OR similarity(s.name, query) > 0.15)
    LIMIT 10
  ) r;

  RETURN jsonb_build_object('products', products_result, 'shops', shops_result);
END;
$$;


-- ── 8. Referral code ──
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


-- ── 9. Referral reward trigger ──
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

  -- Thưởng referrer (vào bonus_balance — không rút được)
  PERFORM add_bonus_to_wallet(v_ref_code.user_id, 'customer', 10000, v_usage.id,
    'Xu thưởng giới thiệu bạn bè', 'referral');
  INSERT INTO notifications (user_id, type, title, body, data) VALUES (
    v_ref_code.user_id, 'system', '🎉 Bạn nhận được 10.000đ xu thưởng!',
    'Người bạn giới thiệu vừa hoàn thành đơn đầu tiên. Xu thưởng chỉ dùng để thanh toán đơn hàng.',
    jsonb_build_object('xu_amount', 10000)
  );

  -- Thưởng referee (vào bonus_balance — không rút được)
  PERFORM add_bonus_to_wallet(NEW.customer_id, 'customer', 10000, v_usage.id,
    'Xu thưởng dùng mã giới thiệu', 'referral');
  INSERT INTO notifications (user_id, type, title, body, data) VALUES (
    NEW.customer_id, 'system', '🎁 Nhận 10.000đ xu từ mã giới thiệu!',
    'Đơn đầu tiên của bạn hoàn thành. 10.000đ xu đã vào ví.',
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

CREATE TRIGGER trigger_referral_reward
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION process_referral_reward();


-- ════════════════════════════════════════════════
-- REALTIME
-- ════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE voucher_usages;


-- ════════════════════════════════════════════════
-- NOTES — Sau khi chạy schema này lần đầu:
--
-- 1. Set admin cho tài khoản của bạn:
--    UPDATE profiles SET role = 'admin' WHERE phone = '0848612712';
--
-- 2. Đồng bộ profiles từ auth.users đã tồn tại:
--    INSERT INTO profiles (id, phone, full_name, role)
--    SELECT u.id,
--      COALESCE(NULLIF(TRIM(u.phone),''), split_part(u.email,'@',1), 'user_'||substr(u.id::text,1,8)),
--      COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1), 'Người dùng'),
--      'customer'
--    FROM auth.users u
--    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
--    ON CONFLICT (id) DO NOTHING;
-- ════════════════════════════════════════════════
