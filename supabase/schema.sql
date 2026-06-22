-- ═══════════════════════════════════════════════════════════════════════════
-- GIAO NHANH — Consolidated Database Schema
-- Single source of truth — safe to run on a fresh Supabase project
-- Generated: 2026-06-17 | Covers all migrations up to 20260622
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ═══════════════════════════════════════════════════════════════════════════
-- ENUMS / TYPES
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'driver', 'shop', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending', 'accepted', 'preparing', 'ready', 'delivering', 'delivered', 'done', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE service_type AS ENUM ('food', 'buy_for', 'send_for', 'xe_om', 'taxi', 'errand');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pay_method AS ENUM ('cash', 'vietqr', 'wallet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wallet_type AS ENUM ('customer', 'driver', 'merchant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tx_type AS ENUM ('topup', 'payment', 'refund', 'commission', 'withdrawal', 'referral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add enum values if missing (idempotent)
DO $$ BEGIN
  ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'referral';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES (in dependency order)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── profiles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            user_role   NOT NULL DEFAULT 'customer',
  full_name       TEXT,
  phone           TEXT        UNIQUE,
  avatar_url      TEXT,
  address         TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  notif_settings  JSONB       DEFAULT '{"order":true,"promo":false,"system":true,"driver":true}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── shops ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shops (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                 UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  name                     TEXT         NOT NULL,
  description              TEXT,
  category                 TEXT,
  address                  TEXT,
  location                 geography(point, 4326),
  lat                      DOUBLE PRECISION,
  lng                      DOUBLE PRECISION,
  phone                    TEXT,

  -- Images
  avatar_url               TEXT,
  logo_url                 TEXT,
  cover_image_url          TEXT,

  is_open                  BOOLEAN      NOT NULL DEFAULT true,
  status                   TEXT         NOT NULL DEFAULT 'pending',

  -- Ratings
  rating                   NUMERIC(3,2) DEFAULT 5.0,
  rating_count             INT          DEFAULT 0,
  rating_avg               NUMERIC(3,2) DEFAULT 5.0,
  total_reviews            INT          DEFAULT 0,

  -- Menu & hours
  menu_groups_data         JSONB,
  opening_hours            JSONB,
  prep_time                TEXT,

  -- Commission
  commission_rate          NUMERIC(5,2) NOT NULL DEFAULT 10,
  is_negotiated_commission BOOLEAN      NOT NULL DEFAULT false,

  -- Settings
  notif_settings           JSONB        DEFAULT '{"soundNewOrder":true,"vibration":true,"orderPopup":true,"orderUpdates":true,"promotions":true,"systemAlerts":true,"weeklySummary":true}'::jsonb,
  privacy_settings         JSONB        DEFAULT '{"showAddress":true,"analytics":true}'::jsonb,

  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT shops_owner_unique UNIQUE (owner_id)
);

-- ─── drivers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  id                   UUID         PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_online            BOOLEAN      NOT NULL DEFAULT false,
  is_busy              BOOLEAN      NOT NULL DEFAULT false,
  location             geography(point, 4326),

  -- Vehicle
  vehicle_type         TEXT,
  license_plate        TEXT,
  vehicle_model        TEXT,

  -- Status & approval
  status               TEXT         NOT NULL DEFAULT 'offline',
  is_approved          BOOLEAN      NOT NULL DEFAULT false,
  approved_at          TIMESTAMPTZ,

  -- Commission (NULL = use global app_settings)
  commission_rate      NUMERIC(5,2),

  -- Documents
  id_card_number       TEXT,
  license_number       TEXT,

  -- Stats
  rating_avg           NUMERIC(3,2) DEFAULT 5.0,
  total_trips          INT          DEFAULT 0,

  -- Bank account for withdrawal
  bank_name            TEXT,
  bank_account_number  TEXT,
  bank_account_name    TEXT,

  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── products ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID        REFERENCES shops(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  description    TEXT,
  price          INT         NOT NULL,
  original_price INT,
  image_url      TEXT,
  category       TEXT,
  tags           TEXT[]      DEFAULT ARRAY[]::TEXT[],
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

-- ─── orders ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID         REFERENCES profiles(id),
  driver_id        UUID         REFERENCES profiles(id),
  shop_id          UUID         REFERENCES shops(id),
  service_type     service_type NOT NULL DEFAULT 'food',
  status           order_status NOT NULL DEFAULT 'pending',
  pay_method       pay_method   NOT NULL DEFAULT 'cash',

  -- Amounts
  total            INT          NOT NULL DEFAULT 0,   -- legacy (kept for compatibility)
  subtotal         INT          NOT NULL DEFAULT 0,   -- tiền hàng (không gồm ship)
  total_amount     INT          NOT NULL DEFAULT 0,   -- tổng đơn (hàng + ship - discount)
  ship_fee         INT          NOT NULL DEFAULT 15000,
  discount_amount  INT          NOT NULL DEFAULT 0,

  -- Xu / wallet payment
  xu_used          INT          NOT NULL DEFAULT 0,
  xu_bonus_used    INT          NOT NULL DEFAULT 0,

  -- Addresses
  note             TEXT,
  cancel_reason    TEXT,
  pickup_address   TEXT,
  drop_address     TEXT,
  pickup_location  geography(point, 4326),
  drop_location    geography(point, 4326),

  -- Payment
  payment_code     INTEGER,
  payment_status   TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (payment_status IN ('pending','paid','failed','refunded')),

  -- Commission tracking
  driver_commission_rate   NUMERIC(5,2),
  driver_commission_amount INT          NOT NULL DEFAULT 0,
  shop_commission_rate     NUMERIC(5,2),
  shop_commission_amount   INT          NOT NULL DEFAULT 0,

  -- Who cancelled
  cancelled_by     UUID         REFERENCES profiles(id),

  -- Timestamps
  scheduled_at     TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  preparing_at     TIMESTAMPTZ,
  ready_at         TIMESTAMPTZ,
  picked_up_at     TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── order_items ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID REFERENCES orders(id)   ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  name       TEXT NOT NULL,
  price      INT  NOT NULL,
  qty        INT  NOT NULL DEFAULT 1,
  subtotal   INT,
  note       TEXT,
  options    JSONB   -- { size?: {name, price}, toppings?: [{name, price}] }
);

-- ─── blacklist ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blacklist (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT,
  blocked_by  UUID        REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── reviews ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID        REFERENCES orders(id)   ON DELETE CASCADE,
  customer_id  UUID        REFERENCES profiles(id),
  shop_id      UUID        REFERENCES shops(id),
  driver_id    UUID        REFERENCES profiles(id),
  shop_stars   INT         CHECK (shop_stars   BETWEEN 1 AND 5),
  driver_stars INT         CHECK (driver_stars BETWEEN 1 AND 5),
  comment      TEXT,
  images       TEXT[],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── vouchers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
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

-- ─── voucher_usages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voucher_usages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID        NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id),
  order_id   UUID        REFERENCES orders(id),
  used_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── combo_items ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS combo_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id   UUID REFERENCES vouchers(id)  ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id)  ON DELETE CASCADE,
  min_quantity INT  NOT NULL DEFAULT 1
);

-- ─── notifications ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
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

-- ─── notification_schedules ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_schedules (
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

-- ─── wallets ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          wallet_type NOT NULL,
  balance       INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  bonus_balance INTEGER     NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, type)
);

-- ─── transactions ─────────────────────────────────────────────────────────────
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

-- ─── chat_messages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES profiles(id),
  role       TEXT        NOT NULL CHECK (role IN ('customer', 'driver', 'shop')),
  content    TEXT        NOT NULL CHECK (char_length(content) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── push_subscriptions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ─── wallet_topups ───────────────────────────────────────────────────────────
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

-- ─── app_settings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── saved_addresses ─────────────────────────────────────────────────────────
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

-- ─── referral_codes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_codes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code         TEXT        UNIQUE NOT NULL,
  total_uses   INTEGER     NOT NULL DEFAULT 0,
  total_earned INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ─── referral_usages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_usages (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT    NOT NULL REFERENCES referral_codes(code),
  referee_id          UUID    NOT NULL REFERENCES profiles(id) UNIQUE,
  qualifying_order_id UUID    REFERENCES orders(id),
  referrer_rewarded   BOOLEAN NOT NULL DEFAULT false,
  referee_rewarded    BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── errands ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS errands (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id          UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id            UUID         REFERENCES profiles(id),
  type                 TEXT         NOT NULL DEFAULT 'deliver_for_me',
  status               TEXT         NOT NULL DEFAULT 'pending',
  pickup_address       TEXT         NOT NULL,
  pickup_lat           NUMERIC(10,6) NOT NULL DEFAULT 12.683,
  pickup_lng           NUMERIC(10,6) NOT NULL DEFAULT 108.483,
  delivery_address     TEXT         NOT NULL,
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
  payment_method       TEXT         NOT NULL DEFAULT 'cash',
  sender_name          TEXT,
  sender_phone         TEXT,
  recipient_name       TEXT,
  recipient_phone      TEXT,
  created_at           TIMESTAMPTZ  DEFAULT now()
);

-- ─── rides ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rides (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id       UUID         REFERENCES profiles(id),
  status          TEXT         NOT NULL DEFAULT 'searching',
  vehicle_type    TEXT         NOT NULL DEFAULT 'motorbike',
  pickup_address  TEXT         NOT NULL,
  pickup_lat      NUMERIC(10,6) NOT NULL DEFAULT 12.683,
  pickup_lng      NUMERIC(10,6) NOT NULL DEFAULT 108.483,
  dropoff_address TEXT         NOT NULL,
  dropoff_lat     NUMERIC(10,6) NOT NULL DEFAULT 12.683,
  dropoff_lng     NUMERIC(10,6) NOT NULL DEFAULT 108.483,
  distance_km     NUMERIC(6,2),
  estimated_fare  NUMERIC(12,0),
  final_fare      NUMERIC(12,0),
  payment_method  TEXT         NOT NULL DEFAULT 'cash',
  note            TEXT,
  cancel_reason   TEXT,
  created_at      TIMESTAMPTZ  DEFAULT now()
);

-- ─── loyalty_points ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_points (
  user_id      UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_points INT         NOT NULL DEFAULT 0,
  tier         TEXT        NOT NULL DEFAULT 'bronze'
               CHECK (tier IN ('bronze','silver','gold','platinum')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── point_transactions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS point_transactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points     INT         NOT NULL,
  reason     TEXT,
  ref_id     UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── dispatch_waves ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispatch_waves (
  order_table TEXT        NOT NULL,
  order_id    UUID        NOT NULL,
  driver_ids  UUID[]      NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (order_table, order_id)
);

-- ─── withdrawals ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_type  TEXT        NOT NULL DEFAULT 'driver'
               CHECK (wallet_type IN ('driver','customer')),
  amount       INTEGER     NOT NULL CHECK (amount > 0),
  bank_bin     TEXT        NOT NULL DEFAULT '',
  bank_account TEXT        NOT NULL,
  account_name TEXT,
  status       TEXT        NOT NULL DEFAULT 'processing'
               CHECK (status IN ('processing','pending_transfer','transferred','failed','refunded')),
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

-- shops
CREATE INDEX IF NOT EXISTS idx_shops_owner      ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_is_open    ON shops(is_open);
CREATE INDEX IF NOT EXISTS idx_shops_status     ON shops(status);
CREATE INDEX IF NOT EXISTS idx_shops_name_trgm  ON shops USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shops_cron       ON shops(status) WHERE status = 'approved';

-- products
CREATE INDEX IF NOT EXISTS idx_products_shop        ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_tags        ON products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_sort_order  ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm   ON products USING gin(name gin_trgm_ops);

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_customer      ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver        ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop          ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_code  ON orders(payment_code) WHERE payment_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_pending_cron  ON orders(created_at) WHERE status = 'pending' AND cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_driver_comm   ON orders(driver_id, driver_commission_amount) WHERE driver_commission_amount > 0;

-- reviews
CREATE INDEX IF NOT EXISTS idx_reviews_shop   ON reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_driver ON reviews(driver_id);

-- vouchers
CREATE INDEX IF NOT EXISTS idx_vouchers_shop      ON vouchers(shop_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_active    ON vouchers(is_active, valid_to);

-- voucher_usages
CREATE INDEX IF NOT EXISTS idx_voucher_usages_user    ON voucher_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_voucher_usages_voucher ON voucher_usages(voucher_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notifications(user_id, is_read, created_at DESC);

-- notification_schedules
CREATE INDEX IF NOT EXISTS idx_ns_scheduled ON notification_schedules(scheduled_at) WHERE sent_at IS NULL;

-- transactions
CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_id, created_at DESC);

-- chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_order ON chat_messages(order_id, created_at ASC);

-- saved_addresses
CREATE INDEX IF NOT EXISTS idx_saved_addr_user ON saved_addresses(user_id, is_default DESC);

-- referral
CREATE INDEX IF NOT EXISTS idx_referral_usages_code ON referral_usages(code);

-- point_transactions
CREATE INDEX IF NOT EXISTS idx_point_tx_user ON point_transactions(user_id, created_at DESC);

-- wallet_topups
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_topups_payment_code ON wallet_topups(payment_code);

-- withdrawals
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_one_pending ON withdrawals(user_id)
  WHERE status IN ('processing', 'pending_transfer');
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user   ON withdrawals(user_id, created_at DESC);

-- drivers
CREATE INDEX IF NOT EXISTS idx_drivers_commission ON drivers(commission_rate) WHERE commission_rate IS NOT NULL;

-- Replica identity for realtime
ALTER TABLE orders      REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE errands     REPLICA IDENTITY FULL;
ALTER TABLE rides       REPLICA IDENTITY FULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — enable + policies for each table
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── profiles ────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own"  ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all"   ON profiles;
CREATE POLICY "profiles_select_own"  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all"   ON profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ─── shops ───────────────────────────────────────────────────────────────────
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shops_select_open"      ON shops;
DROP POLICY IF EXISTS "shops_select_approved"  ON shops;
DROP POLICY IF EXISTS "shops_owner_manage"     ON shops;
DROP POLICY IF EXISTS "shops_admin_all"        ON shops;
-- Allow viewing all approved shops (regardless of is_open), plus owner sees own, admin sees all
CREATE POLICY "shops_select_approved" ON shops FOR SELECT
  USING (
    status = 'approved'
    OR auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "shops_owner_manage"    ON shops FOR ALL    USING (auth.uid() = owner_id);
CREATE POLICY "shops_admin_all"       ON shops FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── drivers ─────────────────────────────────────────────────────────────────
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "drivers_own"          ON drivers;
DROP POLICY IF EXISTS "drivers_online_view"  ON drivers;
DROP POLICY IF EXISTS "drivers_admin_all"    ON drivers;
CREATE POLICY "drivers_own"          ON drivers FOR ALL    USING (auth.uid() = id);
CREATE POLICY "drivers_online_view"  ON drivers FOR SELECT USING (is_online = true);
CREATE POLICY "drivers_admin_all"    ON drivers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── products ────────────────────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_select_available" ON products;
DROP POLICY IF EXISTS "products_shop_manage"      ON products;
DROP POLICY IF EXISTS "products_admin_all"        ON products;
CREATE POLICY "products_select_available" ON products FOR SELECT USING (true);
CREATE POLICY "products_shop_manage"      ON products FOR ALL
  USING (auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id));
CREATE POLICY "products_admin_all"        ON products FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── orders ──────────────────────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_customer_select"    ON orders;
DROP POLICY IF EXISTS "orders_driver_select"      ON orders;
DROP POLICY IF EXISTS "orders_shop_select"        ON orders;
DROP POLICY IF EXISTS "orders_customer_insert"    ON orders;
DROP POLICY IF EXISTS "orders_driver_update"      ON orders;
DROP POLICY IF EXISTS "orders_shop_update"        ON orders;
DROP POLICY IF EXISTS "orders_admin_all"          ON orders;
DROP POLICY IF EXISTS "Shop owner views orders"          ON orders;
DROP POLICY IF EXISTS "Shop owner updates order status"  ON orders;
DROP POLICY IF EXISTS "orders_driver_see_pending" ON orders;
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
-- Drivers can see unassigned pending/accepted/preparing orders for dispatch
CREATE POLICY "orders_driver_see_pending" ON orders FOR SELECT
  USING (
    status IN ('pending', 'accepted', 'preparing')
    AND driver_id IS NULL
    AND EXISTS (
      SELECT 1 FROM drivers
      WHERE id = auth.uid()
        AND status = 'online'
        AND is_approved = TRUE
    )
  );

-- ─── order_items ─────────────────────────────────────────────────────────────
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_order_owner"     ON order_items;
DROP POLICY IF EXISTS "order_items_admin_all"       ON order_items;
DROP POLICY IF EXISTS "order_items_shop_select"     ON order_items;
DROP POLICY IF EXISTS "order_items_driver_select"   ON order_items;
DROP POLICY IF EXISTS "order_items_merchant_select" ON order_items;
DROP POLICY IF EXISTS "order_items_shop_owner"      ON order_items;
DROP POLICY IF EXISTS "order_items_driver"          ON order_items;
CREATE POLICY "order_items_customer_select" ON order_items FOR SELECT
  USING (auth.uid() = (SELECT customer_id FROM orders WHERE id = order_id));
CREATE POLICY "order_items_driver_select"   ON order_items FOR SELECT
  USING (auth.uid() = (SELECT driver_id FROM orders WHERE id = order_id));
CREATE POLICY "order_items_merchant_select" ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o JOIN shops s ON s.id = o.shop_id
    WHERE o.id = order_id AND s.owner_id = auth.uid()
  ));
CREATE POLICY "order_items_admin_all"       ON order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── blacklist ───────────────────────────────────────────────────────────────
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blacklist_admin"      ON blacklist;
DROP POLICY IF EXISTS "blacklist_admin_all"  ON blacklist;
DROP POLICY IF EXISTS "blacklist_own_select" ON blacklist;
CREATE POLICY "blacklist_admin_all"  ON blacklist FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "blacklist_own_select" ON blacklist FOR SELECT
  USING (auth.uid() = user_id);

-- ─── reviews ─────────────────────────────────────────────────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_customer_insert" ON reviews;
DROP POLICY IF EXISTS "reviews_public_select"   ON reviews;
DROP POLICY IF EXISTS "reviews_admin_all"       ON reviews;
CREATE POLICY "reviews_customer_insert" ON reviews FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "reviews_public_select"   ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_admin_all"       ON reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── vouchers ────────────────────────────────────────────────────────────────
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vouchers_public_active"  ON vouchers;
DROP POLICY IF EXISTS "vouchers_shop_manage"    ON vouchers;
DROP POLICY IF EXISTS "vouchers_admin_all"      ON vouchers;
CREATE POLICY "vouchers_public_active" ON vouchers FOR SELECT USING (is_active = true);
CREATE POLICY "vouchers_shop_manage"   ON vouchers FOR ALL
  USING (shop_id IS NOT NULL AND auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id))
  WITH CHECK (shop_id IS NOT NULL AND auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id));
CREATE POLICY "vouchers_admin_all"     ON vouchers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── voucher_usages ──────────────────────────────────────────────────────────
ALTER TABLE voucher_usages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "voucher_usages_own"       ON voucher_usages;
DROP POLICY IF EXISTS "voucher_usages_insert"    ON voucher_usages;
DROP POLICY IF EXISTS "voucher_usages_admin_all" ON voucher_usages;
CREATE POLICY "voucher_usages_own"       ON voucher_usages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "voucher_usages_insert"    ON voucher_usages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "voucher_usages_admin_all" ON voucher_usages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── combo_items ─────────────────────────────────────────────────────────────
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "combo_public_select"          ON combo_items;
DROP POLICY IF EXISTS "combo_shop_manage"            ON combo_items;
DROP POLICY IF EXISTS "Anyone views combo items"     ON combo_items;
DROP POLICY IF EXISTS "Shop owner manages combo items" ON combo_items;
CREATE POLICY "combo_public_select" ON combo_items FOR SELECT USING (true);
CREATE POLICY "combo_shop_manage"   ON combo_items FOR ALL
  USING (auth.uid() = (
    SELECT s.owner_id FROM vouchers v JOIN shops s ON s.id = v.shop_id WHERE v.id = voucher_id
  ));

-- ─── notifications ───────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_own_select" ON notifications;
DROP POLICY IF EXISTS "notif_own_update" ON notifications;
DROP POLICY IF EXISTS "notif_admin_all"  ON notifications;
-- User sees own undeleted; admin sees all via notif_admin_all
CREATE POLICY "notif_own_select" ON notifications FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "notif_own_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_admin_all"  ON notifications FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── notification_schedules ──────────────────────────────────────────────────
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ns_admin_all" ON notification_schedules;
CREATE POLICY "ns_admin_all" ON notification_schedules
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ─── wallets ─────────────────────────────────────────────────────────────────
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallets_own"       ON wallets;
DROP POLICY IF EXISTS "wallets_admin_all" ON wallets;
CREATE POLICY "wallets_own"       ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallets_admin_all" ON wallets FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── transactions ─────────────────────────────────────────────────────────────
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tx_wallet_owner" ON transactions;
DROP POLICY IF EXISTS "tx_admin_all"    ON transactions;
CREATE POLICY "tx_wallet_owner" ON transactions FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM wallets WHERE id = wallet_id));
CREATE POLICY "tx_admin_all"    ON transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── chat_messages ───────────────────────────────────────────────────────────
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_order_parties" ON chat_messages;
CREATE POLICY "chat_order_parties" ON chat_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = chat_messages.order_id
      AND (o.customer_id = auth.uid() OR o.driver_id = auth.uid()
        OR auth.uid() = (SELECT owner_id FROM shops WHERE id = o.shop_id))
  ));

-- ─── push_subscriptions ──────────────────────────────────────────────────────
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_sub_own" ON push_subscriptions;
CREATE POLICY "push_sub_own" ON push_subscriptions
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── wallet_topups ───────────────────────────────────────────────────────────
ALTER TABLE wallet_topups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "topup_own"       ON wallet_topups;
DROP POLICY IF EXISTS "topup_admin_all" ON wallet_topups;
CREATE POLICY "topup_own"       ON wallet_topups USING (user_id = auth.uid());
CREATE POLICY "topup_admin_all" ON wallet_topups FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── app_settings ─────────────────────────────────────────────────────────────
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_admin_all"   ON app_settings;
DROP POLICY IF EXISTS "settings_public_read" ON app_settings;
CREATE POLICY "settings_admin_all"   ON app_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "settings_public_read" ON app_settings FOR SELECT
  USING (key IN ('features', 'app_hours', 'weather_surcharge', 'night_surcharge'));

-- ─── saved_addresses ─────────────────────────────────────────────────────────
ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "addr_own" ON saved_addresses;
CREATE POLICY "addr_own" ON saved_addresses FOR ALL USING (auth.uid() = user_id);

-- ─── referral_codes ───────────────────────────────────────────────────────────
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ref_codes_own"   ON referral_codes;
DROP POLICY IF EXISTS "ref_codes_admin" ON referral_codes;
CREATE POLICY "ref_codes_own"   ON referral_codes  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ref_codes_admin" ON referral_codes  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── referral_usages ──────────────────────────────────────────────────────────
ALTER TABLE referral_usages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ref_usage_own"   ON referral_usages;
DROP POLICY IF EXISTS "ref_usage_admin" ON referral_usages;
CREATE POLICY "ref_usage_own"   ON referral_usages FOR SELECT USING (referee_id = auth.uid());
CREATE POLICY "ref_usage_admin" ON referral_usages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── errands ──────────────────────────────────────────────────────────────────
ALTER TABLE errands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "errands_customer_all"  ON errands;
DROP POLICY IF EXISTS "errands_driver_read"   ON errands;
DROP POLICY IF EXISTS "errands_driver_update" ON errands;
CREATE POLICY "errands_customer_all" ON errands
  FOR ALL USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "errands_driver_read" ON errands FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('driver','admin')));
CREATE POLICY "errands_driver_update" ON errands FOR UPDATE
  USING (driver_id = auth.uid() OR
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── rides ────────────────────────────────────────────────────────────────────
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rides_customer_all"  ON rides;
DROP POLICY IF EXISTS "rides_driver_read"   ON rides;
DROP POLICY IF EXISTS "rides_driver_update" ON rides;
CREATE POLICY "rides_customer_all" ON rides
  FOR ALL USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "rides_driver_read" ON rides FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('driver','admin')));
CREATE POLICY "rides_driver_update" ON rides FOR UPDATE
  USING (driver_id = auth.uid() OR
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── loyalty_points ───────────────────────────────────────────────────────────
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loyalty_points_own_select"   ON loyalty_points;
DROP POLICY IF EXISTS "loyalty_points_admin_all"    ON loyalty_points;
CREATE POLICY "loyalty_points_own_select" ON loyalty_points
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "loyalty_points_admin_all"  ON loyalty_points FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── point_transactions ───────────────────────────────────────────────────────
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "point_transactions_own_select" ON point_transactions;
DROP POLICY IF EXISTS "point_transactions_admin_all"  ON point_transactions;
CREATE POLICY "point_transactions_own_select" ON point_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "point_transactions_admin_all"  ON point_transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── withdrawals ──────────────────────────────────────────────────────────────
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "withdrawals_own_select" ON withdrawals;
DROP POLICY IF EXISTS "withdrawals_admin_all"  ON withdrawals;
CREATE POLICY "withdrawals_own_select" ON withdrawals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "withdrawals_admin_all"  ON withdrawals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── storage ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can view all images"                ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload shop covers"    ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload shop logos"     ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload avatars"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update own images"     ON storage.objects;
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


-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS (helpers first, then RPCs)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── wallet helpers ───────────────────────────────────────────────────────────

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


CREATE OR REPLACE FUNCTION deduct_xu_atomic(
  p_wallet_id  UUID,
  p_xu_used    INT,
  p_xu_bonus   INT,
  p_new_bal    INT,
  p_new_bonus  INT,
  p_order_id   UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  SELECT id, balance, bonus_balance INTO v_wallet
  FROM wallets WHERE id = p_wallet_id FOR UPDATE;

  IF v_wallet.balance < p_xu_used THEN
    RAISE EXCEPTION 'Số dư xu không đủ (cần %, có %)', p_xu_used, v_wallet.balance;
  END IF;
  IF v_wallet.bonus_balance < p_xu_bonus THEN
    RAISE EXCEPTION 'Xu thưởng không đủ (cần %, có %)', p_xu_bonus, v_wallet.bonus_balance;
  END IF;

  UPDATE wallets SET
    balance       = balance       - p_xu_used,
    bonus_balance = bonus_balance - p_xu_bonus,
    updated_at    = now()
  WHERE id = p_wallet_id;

  IF p_xu_bonus > 0 THEN
    INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
    VALUES (p_wallet_id, 'payment', p_xu_bonus, p_new_bonus, 'order', p_order_id, 'Thanh toán bằng xu thưởng');
  END IF;
  IF p_xu_used > 0 THEN
    INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
    VALUES (p_wallet_id, 'payment', p_xu_used, p_new_bal, 'order', p_order_id, 'Thanh toán bằng xu Giao Nhanh');
  END IF;
END;
$$;


-- ─── commission helpers ────────────────────────────────────────────────────────

-- Get effective driver commission rate (per-driver override or global default)
CREATE OR REPLACE FUNCTION get_driver_commission_rate(p_driver_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rate   NUMERIC;
  v_global NUMERIC;
BEGIN
  SELECT COALESCE(
    (value->>'driver_rate')::NUMERIC,
    (value->>'defaultRate')::NUMERIC
  ) INTO v_global
  FROM app_settings WHERE key = 'commission';

  SELECT commission_rate INTO v_rate FROM drivers WHERE id = p_driver_id;

  RETURN COALESCE(v_rate, v_global, 15);
END;
$$;


-- Get effective shop commission rate (per-shop override or global default)
CREATE OR REPLACE FUNCTION get_shop_commission_rate(p_shop_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rate   NUMERIC;
  v_global NUMERIC;
BEGIN
  SELECT COALESCE(
    (value->>'shop_rate')::NUMERIC,
    (value->>'defaultRate')::NUMERIC
  ) INTO v_global
  FROM app_settings WHERE key = 'commission';

  SELECT commission_rate INTO v_rate FROM shops WHERE id = p_shop_id;

  RETURN COALESCE(v_rate, v_global, 15);
END;
$$;


-- ─── dispatch helpers ─────────────────────────────────────────────────────────

-- Find single nearest available driver (legacy, used by dispatch API)
CREATE OR REPLACE FUNCTION dispatch_nearest_driver(
  ref_lat     DOUBLE PRECISION,
  ref_lng     DOUBLE PRECISION,
  exclude_ids UUID[] DEFAULT '{}'
) RETURNS UUID
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM drivers
  WHERE status = 'online'
    AND is_approved = TRUE
    AND (cardinality(exclude_ids) = 0 OR id != ALL(exclude_ids))
  ORDER BY
    CASE
      WHEN location IS NULL THEN 999999
      ELSE ST_Distance(location, ST_Point(ref_lng, ref_lat)::geography)
    END ASC
  LIMIT 1;
$$;


-- Find N nearest available drivers (wave dispatch)
CREATE OR REPLACE FUNCTION dispatch_nearest_drivers(
  ref_lat     DOUBLE PRECISION,
  ref_lng     DOUBLE PRECISION,
  exclude_ids UUID[] DEFAULT '{}',
  limit_n     INT DEFAULT 2
) RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM drivers
  WHERE status = 'online'
    AND is_approved = TRUE
    AND (cardinality(exclude_ids) = 0 OR id != ALL(exclude_ids))
  ORDER BY
    CASE
      WHEN location IS NULL THEN 999999
      ELSE ST_Distance(location, ST_Point(ref_lng, ref_lat)::geography)
    END ASC
  LIMIT limit_n;
$$;


-- ─── order main RPCs ──────────────────────────────────────────────────────────

-- accept_order_with_commission
-- Driver accepts order: deducts both driver + shop commission from driver wallet.
-- Enforces max 3 active orders per driver.
CREATE OR REPLACE FUNCTION accept_order_with_commission(
  p_order_id  UUID,
  p_driver_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order              RECORD;
  v_driver_rate        NUMERIC;
  v_shop_rate          NUMERIC;
  v_driver_commission  INT;
  v_shop_commission    INT;
  v_total_deduction    INT;
  v_wallet             RECORD;
  v_rows               INT;
  v_active_count       INT;
BEGIN
  SELECT id, ship_fee, subtotal, driver_id, status, shop_id
  INTO v_order
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Đơn không tồn tại');
  END IF;
  IF v_order.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Đơn đã được tài xế khác nhận');
  END IF;
  IF v_order.status NOT IN ('pending', 'accepted', 'preparing') THEN
    RETURN jsonb_build_object('error', 'Đơn không còn có thể nhận');
  END IF;

  -- Max 3 active orders
  SELECT COUNT(*) INTO v_active_count
  FROM orders
  WHERE driver_id = p_driver_id AND status NOT IN ('delivered', 'cancelled');
  IF v_active_count >= 3 THEN
    RETURN jsonb_build_object('error', 'Bạn đang xử lý 3 đơn — hãy hoàn tất bớt trước khi nhận thêm');
  END IF;

  v_driver_rate       := get_driver_commission_rate(p_driver_id);
  v_shop_rate         := get_shop_commission_rate(v_order.shop_id);
  v_driver_commission := ROUND(COALESCE(v_order.ship_fee, 0) * v_driver_rate  / 100)::INT;
  v_shop_commission   := ROUND(COALESCE(v_order.subtotal,  0) * v_shop_rate   / 100)::INT;
  v_total_deduction   := v_driver_commission + v_shop_commission;

  IF v_total_deduction > 0 THEN
    SELECT id, balance INTO v_wallet
    FROM wallets WHERE user_id = p_driver_id AND type = 'driver'
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Tài xế chưa có ví tiền ký quỹ. Vui lòng liên hệ admin.');
    END IF;

    IF v_wallet.balance < v_total_deduction THEN
      RETURN jsonb_build_object(
        'error',
        format('Số dư ví không đủ. Cần %sđ (HH tài xế %sđ + HH quán %sđ), ví còn %sđ. Vui lòng nạp thêm.',
          to_char(v_total_deduction,   'FM999G999G999'),
          to_char(v_driver_commission, 'FM999G999G999'),
          to_char(v_shop_commission,   'FM999G999G999'),
          to_char(v_wallet.balance,    'FM999G999G999'))
      );
    END IF;

    UPDATE wallets SET balance = balance - v_total_deduction, updated_at = now()
    WHERE id = v_wallet.id;

    INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
    VALUES (
      v_wallet.id, 'commission', v_total_deduction,
      v_wallet.balance - v_total_deduction,
      'order', p_order_id,
      format('HH nhận đơn #%s (tài xế %sđ + quán %sđ)',
        UPPER(LEFT(p_order_id::TEXT, 8)),
        to_char(v_driver_commission, 'FM999G999G999'),
        to_char(v_shop_commission,   'FM999G999G999'))
    );
  END IF;

  UPDATE orders SET
    driver_id                = p_driver_id,
    accepted_at              = COALESCE(accepted_at, now()),
    driver_commission_rate   = v_driver_rate,
    driver_commission_amount = v_driver_commission,
    shop_commission_rate     = v_shop_rate,
    shop_commission_amount   = v_shop_commission
  WHERE id = p_order_id
    AND driver_id IS NULL
    AND status IN ('pending', 'accepted', 'preparing');

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    IF v_total_deduction > 0 THEN
      UPDATE wallets SET balance = balance + v_total_deduction, updated_at = now()
      WHERE id = v_wallet.id;
      DELETE FROM transactions
      WHERE wallet_id = v_wallet.id AND ref_id = p_order_id
        AND type = 'commission' AND created_at > now() - INTERVAL '10 seconds';
    END IF;
    RETURN jsonb_build_object('error', 'Đơn đã được tài xế khác nhận');
  END IF;

  RETURN jsonb_build_object(
    'success',            true,
    'driver_commission',  v_driver_commission,
    'shop_commission',    v_shop_commission,
    'total_deducted',     v_total_deduction,
    'pay_shop',           COALESCE(v_order.subtotal, 0) - v_shop_commission
  );
END;
$$;


-- complete_order_with_commission
-- Marks order delivered, records shop commission.
-- COD: does NOT credit driver wallet (driver already holds cash).
-- Merchant wallet is debited for shop commission (if merchant has wallet).
CREATE OR REPLACE FUNCTION complete_order_with_commission(
  p_order_id  UUID,
  p_driver_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order                   RECORD;
  v_shop_commission_rate    NUMERIC;
  v_shop_commission_amount  INT;
  v_driver_earning          INT;
  v_merchant_wallet         RECORD;
BEGIN
  SELECT o.id, o.ship_fee, o.subtotal, o.total_amount, o.pay_method, o.shop_id,
         o.driver_commission_amount, o.status
  INTO v_order
  FROM orders o
  WHERE o.id = p_order_id AND o.driver_id = p_driver_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Không tìm thấy đơn');
  END IF;

  v_shop_commission_rate   := get_shop_commission_rate(v_order.shop_id);
  v_shop_commission_amount := ROUND(COALESCE(v_order.subtotal, 0) * v_shop_commission_rate / 100)::INT;

  UPDATE orders SET
    status                  = 'delivered',
    delivered_at            = now(),
    shop_commission_rate    = v_shop_commission_rate,
    shop_commission_amount  = v_shop_commission_amount
  WHERE id = p_order_id;

  -- Debit merchant wallet for shop commission
  IF v_shop_commission_amount > 0 THEN
    SELECT id, balance INTO v_merchant_wallet
    FROM wallets
    WHERE user_id = (SELECT owner_id FROM shops WHERE id = v_order.shop_id)
      AND type = 'merchant'
    FOR UPDATE;

    IF FOUND THEN
      UPDATE wallets
      SET balance = balance - v_shop_commission_amount, updated_at = now()
      WHERE id = v_merchant_wallet.id;

      INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
      VALUES (
        v_merchant_wallet.id, 'commission', v_shop_commission_amount,
        v_merchant_wallet.balance - v_shop_commission_amount,
        'order', p_order_id,
        format('Hoa hồng đơn #%s (%.0f%%)', UPPER(LEFT(p_order_id::TEXT, 8)), v_shop_commission_rate)
      );
    END IF;
  END IF;

  -- Driver earning (reference only — not credited to wallet for COD since driver holds cash)
  v_driver_earning := COALESCE(v_order.ship_fee, 0) - COALESCE(v_order.driver_commission_amount, 0);

  RETURN jsonb_build_object(
    'success',                  true,
    'shop_commission_amount',   v_shop_commission_amount,
    'driver_earning',           v_driver_earning
  );
END;
$$;


-- refund_driver_commission — refund both driver + shop commission on order cancellation
CREATE OR REPLACE FUNCTION refund_driver_commission(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order  RECORD;
  v_wallet RECORD;
  v_refund INT;
BEGIN
  SELECT driver_id, driver_commission_amount, shop_commission_amount
  INTO v_order
  FROM orders WHERE id = p_order_id;

  IF NOT FOUND OR v_order.driver_id IS NULL THEN RETURN; END IF;

  v_refund := COALESCE(v_order.driver_commission_amount, 0) + COALESCE(v_order.shop_commission_amount, 0);
  IF v_refund <= 0 THEN RETURN; END IF;

  SELECT id, balance INTO v_wallet
  FROM wallets WHERE user_id = v_order.driver_id AND type = 'driver'
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE wallets SET balance = balance + v_refund, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
  VALUES (
    v_wallet.id, 'refund', v_refund,
    v_wallet.balance + v_refund,
    'order', p_order_id,
    format('Hoàn HH đơn #%s bị hủy', UPPER(LEFT(p_order_id::TEXT, 8)))
  );
END;
$$;


-- ─── referral ─────────────────────────────────────────────────────────────────

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


-- ─── catalog search ───────────────────────────────────────────────────────────

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


-- ─── recommendations ──────────────────────────────────────────────────────────

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


-- ─── cron job functions ───────────────────────────────────────────────────────

-- cancel_pending_orders_job: auto-cancel timed-out orders and refund commissions + xu
CREATE OR REPLACE FUNCTION cancel_pending_orders_job()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order       RECORD;
  v_wallet      RECORD;
  v_cancelled   INT := 0;
  v_xu_refunded INT := 0;
BEGIN
  FOR v_order IN
    SELECT o.id, o.customer_id, o.total_amount, o.xu_used, o.xu_bonus_used,
           o.pay_method, o.payment_status, o.status, o.driver_id, o.driver_commission_amount
    FROM orders o
    WHERE o.status = 'pending'
      AND o.cancelled_at IS NULL
      AND (
        (o.pay_method != 'cash' AND o.payment_status = 'pending'
         AND o.created_at < now() - INTERVAL '15 minutes')
        OR
        (o.pay_method = 'cash' AND o.created_at < now() - INTERVAL '30 minutes')
      )
  LOOP
    UPDATE orders SET
      status        = 'cancelled',
      cancelled_at  = now(),
      cancel_reason = CASE
        WHEN v_order.pay_method != 'cash' THEN 'Hết thời gian thanh toán (tự động hủy sau 15 phút)'
        ELSE 'Quán không xác nhận (tự động hủy sau 30 phút)'
      END
    WHERE id = v_order.id;

    v_cancelled := v_cancelled + 1;

    PERFORM refund_driver_commission(v_order.id);

    IF COALESCE(v_order.xu_used, 0) > 0 OR COALESCE(v_order.xu_bonus_used, 0) > 0 THEN
      SELECT id, balance, bonus_balance INTO v_wallet
      FROM wallets
      WHERE user_id = v_order.customer_id AND type = 'customer'
      FOR UPDATE;

      IF FOUND THEN
        UPDATE wallets SET
          balance       = balance       + COALESCE(v_order.xu_used, 0),
          bonus_balance = bonus_balance + COALESCE(v_order.xu_bonus_used, 0),
          updated_at    = now()
        WHERE id = v_wallet.id;

        IF COALESCE(v_order.xu_used, 0) > 0 THEN
          INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
          VALUES (v_wallet.id, 'refund', v_order.xu_used,
                  v_wallet.balance + v_order.xu_used,
                  'order', v_order.id, 'Hoàn xu do hủy đơn tự động');
        END IF;

        v_xu_refunded := v_xu_refunded + COALESCE(v_order.xu_used, 0) + COALESCE(v_order.xu_bonus_used, 0);
      END IF;
    END IF;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_order.customer_id, 'order', 'Đơn hàng đã bị hủy',
      'Đơn ' || to_char(v_order.total_amount, 'FM999G999G999') || 'đ đã bị hủy tự động.',
      jsonb_build_object('cancelled', true, 'order_id', v_order.id, 'url', '/orders')
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('cancelled', v_cancelled, 'xu_refunded', v_xu_refunded, 'ran_at', now());
END;
$$;


-- sync_shop_hours_job: auto open/close shops based on opening_hours schedule
CREATE OR REPLACE FUNCTION sync_shop_hours_job()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_shop        RECORD;
  v_oh          JSONB;
  v_entry       JSONB;
  v_day_names   TEXT[] := ARRAY['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  v_vn_now      TIMESTAMPTZ;
  v_vn_min      INT;
  v_today       TEXT;
  v_open_min    INT;
  v_close_min   INT;
  v_should_open BOOLEAN;
  v_updated     INT := 0;
  v_checked     INT := 0;
BEGIN
  v_vn_now  := now() AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_vn_min  := EXTRACT(HOUR FROM v_vn_now)::INT * 60 + EXTRACT(MINUTE FROM v_vn_now)::INT;
  v_today   := v_day_names[EXTRACT(DOW FROM v_vn_now)::INT + 1];

  FOR v_shop IN
    SELECT id, is_open, opening_hours FROM shops WHERE status = 'approved'
  LOOP
    v_oh := v_shop.opening_hours;
    IF v_oh IS NULL THEN CONTINUE; END IF;

    v_checked := v_checked + 1;
    v_should_open := NULL;

    IF jsonb_typeof(v_oh) = 'array' THEN
      v_entry := NULL;
      SELECT value INTO v_entry FROM jsonb_array_elements(v_oh) AS value
      WHERE value->>'day' = v_today LIMIT 1;

      IF v_entry IS NULL OR NOT (v_entry->>'open')::BOOLEAN THEN
        v_should_open := FALSE;
      ELSE
        v_should_open := FALSE;
        FOR v_entry IN SELECT value FROM jsonb_array_elements(v_entry->'slots') AS value
        LOOP
          v_open_min  := (SPLIT_PART(v_entry->>'from', ':', 1)::INT) * 60
                       + (SPLIT_PART(v_entry->>'from', ':', 2)::INT);
          v_close_min := (SPLIT_PART(v_entry->>'to',   ':', 1)::INT) * 60
                       + (SPLIT_PART(v_entry->>'to',   ':', 2)::INT);
          IF v_close_min > v_open_min THEN
            IF v_vn_min >= v_open_min AND v_vn_min < v_close_min THEN
              v_should_open := TRUE; EXIT;
            END IF;
          ELSE
            IF v_vn_min >= v_open_min OR v_vn_min < v_close_min THEN
              v_should_open := TRUE; EXIT;
            END IF;
          END IF;
        END LOOP;
      END IF;

    ELSIF jsonb_typeof(v_oh) = 'object' AND v_oh ? 'open' AND v_oh ? 'close' THEN
      v_open_min  := (SPLIT_PART(v_oh->>'open',  ':', 1)::INT) * 60
                   + (SPLIT_PART(v_oh->>'open',  ':', 2)::INT);
      v_close_min := (SPLIT_PART(v_oh->>'close', ':', 1)::INT) * 60
                   + (SPLIT_PART(v_oh->>'close', ':', 2)::INT);
      IF v_close_min > v_open_min THEN
        v_should_open := v_vn_min >= v_open_min AND v_vn_min < v_close_min;
      ELSE
        v_should_open := v_vn_min >= v_open_min OR v_vn_min < v_close_min;
      END IF;
    END IF;

    IF v_should_open IS NOT NULL AND v_should_open != v_shop.is_open THEN
      UPDATE shops SET is_open = v_should_open, updated_at = now()
      WHERE id = v_shop.id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('checked', v_checked, 'updated', v_updated, 'ran_at', now());
END;
$$;


-- alert_stuck_orders_job: notify admin about orders stuck in ready/delivering too long
CREATE OR REPLACE FUNCTION alert_stuck_orders_job()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order    RECORD;
  v_count    INT := 0;
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'admin' LIMIT 1;

  FOR v_order IN
    SELECT o.id, o.status, o.driver_id, o.total_amount,
           o.ready_at, o.picked_up_at, o.accepted_at
    FROM orders o
    WHERE o.status IN ('ready', 'delivering')
      AND o.cancelled_at IS NULL
      AND (
        (o.status = 'ready'      AND o.ready_at     < now() - INTERVAL '45 minutes')
        OR
        (o.status = 'delivering' AND o.picked_up_at < now() - INTERVAL '2 hours')
      )
  LOOP
    v_count := v_count + 1;

    INSERT INTO notifications (user_id, type, title, body, data)
    SELECT v_admin_id, 'system',
      CASE v_order.status
        WHEN 'ready'      THEN '⚠️ Đơn chờ tài xế quá lâu'
        WHEN 'delivering' THEN '🚨 Tài xế không xác nhận giao'
      END,
      format('Đơn #%s · %sđ · đã ở trạng thái "%s" quá lâu. Cần kiểm tra.',
        UPPER(LEFT(v_order.id::TEXT, 8)),
        to_char(v_order.total_amount, 'FM999G999G999'),
        v_order.status),
      jsonb_build_object('order_id', v_order.id, 'url', '/admin/orders', 'stuck', true)
    WHERE v_admin_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_admin_id
          AND data->>'order_id' = v_order.id::TEXT
          AND data->>'stuck' = 'true'
          AND created_at > now() - INTERVAL '1 hour'
      );
  END LOOP;

  RETURN jsonb_build_object('stuck_orders_found', v_count, 'ran_at', now());
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── handle_new_user ──────────────────────────────────────────────────────────
-- Profile creation is handled by /api/auth/register (service role) to avoid
-- enum casting issues. This trigger is intentionally a no-op.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─── increment_voucher_used_count ────────────────────────────────────────────
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


-- ─── update_shop_rating ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_shop_rating() RETURNS TRIGGER AS $$
BEGIN
  UPDATE shops SET
    rating        = (SELECT AVG(shop_stars) FROM reviews WHERE shop_id = NEW.shop_id),
    rating_avg    = (SELECT AVG(shop_stars) FROM reviews WHERE shop_id = NEW.shop_id),
    rating_count  = (SELECT COUNT(*)        FROM reviews WHERE shop_id = NEW.shop_id),
    total_reviews = (SELECT COUNT(*)        FROM reviews WHERE shop_id = NEW.shop_id)
  WHERE id = NEW.shop_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_shop_rating ON reviews;
CREATE TRIGGER trg_update_shop_rating
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_shop_rating();


-- ─── notify_merchant_new_order ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_merchant_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id  UUID;
  v_shop_name TEXT;
  v_short_id  TEXT;
BEGIN
  SELECT owner_id, name INTO v_owner_id, v_shop_name
  FROM shops WHERE id = NEW.shop_id;

  IF v_owner_id IS NULL THEN RETURN NEW; END IF;

  v_short_id := UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 6));

  INSERT INTO notifications (user_id, type, title, body, data, is_read)
  VALUES (
    v_owner_id, 'order',
    '🔔 Đơn mới #' || v_short_id,
    'Khách vừa đặt ' || NEW.total_amount::text || 'đ · Xác nhận ngay!',
    jsonb_build_object(
      'order_id',  NEW.id,
      'short_id',  v_short_id,
      'total',     NEW.total_amount,
      'shop_id',   NEW.shop_id
    ),
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_merchant_new_order ON orders;
CREATE TRIGGER trg_notify_merchant_new_order
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_merchant_new_order();


-- ─── sync_order_subtotal ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_order_subtotal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.subtotal = 0 AND NEW.total > 0 THEN
    NEW.subtotal := NEW.total;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_subtotal ON orders;
CREATE TRIGGER trg_sync_order_subtotal
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_order_subtotal();


-- ─── award_loyalty_points_on_delivery ────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_loyalty_points_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_rate   NUMERIC := 1;
  v_points INT;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;
  IF NEW.customer_id IS NULL OR NEW.total_amount IS NULL OR NEW.total_amount <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT (value->>'loyaltyPointsRate')::NUMERIC INTO v_rate
  FROM app_settings WHERE key = 'commission' LIMIT 1;
  IF v_rate IS NULL OR v_rate <= 0 THEN v_rate := 1; END IF;

  v_points := FLOOR(NEW.total_amount / 10000 * v_rate);
  IF v_points <= 0 THEN RETURN NEW; END IF;

  INSERT INTO loyalty_points (user_id, total_points, tier)
  VALUES (NEW.customer_id, v_points, 'bronze')
  ON CONFLICT (user_id) DO UPDATE
    SET total_points = loyalty_points.total_points + v_points,
        tier = CASE
          WHEN loyalty_points.total_points + v_points >= 2000 THEN 'platinum'
          WHEN loyalty_points.total_points + v_points >= 1000 THEN 'gold'
          WHEN loyalty_points.total_points + v_points >= 500  THEN 'silver'
          ELSE 'bronze'
        END,
        updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_award_loyalty_points ON orders;
CREATE TRIGGER trg_award_loyalty_points
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION award_loyalty_points_on_delivery();


-- ─── process_referral_reward ─────────────────────────────────────────────────
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

DROP TRIGGER IF EXISTS trigger_referral_reward ON orders;
CREATE TRIGGER trigger_referral_reward
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION process_referral_reward();


-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── app_settings ─────────────────────────────────────────────────────────────
INSERT INTO app_settings (key, value) VALUES
  ('pricing', '{"food":{"rows":["15000","12000","10000","9000","8000","7500","7000","6500","6000","5500"],"extra":"5000"},"delivery_pkg":{"rows":["18000","15000","12000","10000","9000","8500","8000","7500","7000","6500"],"extra":"6000"},"errand":{"rows":["20000","17000","14000","12000","11000","10000","9000","8500","8000","7500"],"extra":"7000"},"motorbike":{"rows":["10000","8000","7000","6500","6000","5500","5000","4800","4600","4500"],"extra":"4000"},"taxi":{"rows":["15000","13000","11000","10000","9500","9000","8500","8000","7500","7000"],"extra":"6500"}}'),
  ('commission', '{"defaultRate":"15","minRate":"10","maxRate":"25","driverSharePercent":"80","platformSharePercent":"20","loyaltyPointsRate":"1","driver_rate":"15","shop_rate":"15"}'),
  ('features', '{"maintenance_mode":false,"new_user_register":true,"driver_register":true,"merchant_register":true,"flash_sale":true,"loyalty_program":true,"surge_pricing":false,"ride_service":true,"errand_service":true,"wallet_topup":false}'),
  ('area', '{"centerLat":"12.6521","centerLng":"108.5073","serviceName":"Krông Pắc, Đắk Lắk","coverageRadius":"10"}'),
  ('delivery', '{"maxRadius":"10","rushHourMultiplier":"1.3","rainMultiplier":"1.2","minDriverRating":"4.0"}'),
  ('app_hours', '{"open":"07:00","close":"21:00"}'),
  ('weather_surcharge', '{"enabled":false,"type":"percent","value":"20"}'),
  ('night_surcharge', '{"enabled":false,"start":"22:00","end":"05:00","fee":"5000"}')
ON CONFLICT (key) DO NOTHING;

-- ─── storage buckets ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('shop-covers',    'shop-covers',    true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('shop-logos',     'shop-logos',     true, 2097152, ARRAY['image/jpeg','image/png','image/webp']),
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('avatars',        'avatars',        true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;


-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME PUBLICATIONS
-- ═══════════════════════════════════════════════════════════════════════════

DO $rt$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE orders;         EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE drivers;        EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;  EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE notifications;  EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE voucher_usages; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE errands;        EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE rides;          EXCEPTION WHEN others THEN NULL; END;
END$rt$;


-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION add_to_wallet(UUID, wallet_type, INTEGER, UUID, TEXT, tx_type)      TO authenticated;
GRANT EXECUTE ON FUNCTION add_bonus_to_wallet(UUID, wallet_type, INTEGER, UUID, TEXT, tx_type) TO authenticated;
GRANT EXECUTE ON FUNCTION subtract_from_wallet(UUID, wallet_type, INTEGER, UUID, TEXT, tx_type) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_xu_atomic(UUID, INT, INT, INT, INT, UUID)                     TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_commission_rate(UUID)                                     TO authenticated;
GRANT EXECUTE ON FUNCTION get_shop_commission_rate(UUID)                                       TO authenticated;
GRANT EXECUTE ON FUNCTION accept_order_with_commission(UUID, UUID)                             TO authenticated;
GRANT EXECUTE ON FUNCTION complete_order_with_commission(UUID, UUID)                           TO authenticated;
GRANT EXECUTE ON FUNCTION refund_driver_commission(UUID)                                       TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_nearest_driver(DOUBLE PRECISION, DOUBLE PRECISION, UUID[])  TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_nearest_drivers(DOUBLE PRECISION, DOUBLE PRECISION, UUID[], INT) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_referral_code(TEXT, UUID)                                      TO authenticated;
GRANT EXECUTE ON FUNCTION search_catalog(TEXT)                                                 TO authenticated;
GRANT EXECUTE ON FUNCTION get_recommendations(UUID, INTEGER)                                   TO authenticated;
GRANT EXECUTE ON FUNCTION alert_stuck_orders_job()                                             TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- CRON JOBS
-- ═══════════════════════════════════════════════════════════════════════════

-- Unschedule old jobs first (idempotent)
SELECT cron.unschedule('cancel-pending-orders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cancel-pending-orders');

SELECT cron.unschedule('sync-shop-hours')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-shop-hours');

-- Cancel timed-out orders every 5 minutes
SELECT cron.schedule(
  'cancel-pending-orders',
  '*/5 * * * *',
  $$ SELECT cancel_pending_orders_job(); $$
);

-- Sync shop open/close status every 10 minutes
SELECT cron.schedule(
  'sync-shop-hours',
  '*/10 * * * *',
  $$ SELECT sync_shop_hours_job(); $$
);


-- ═══════════════════════════════════════════════════════════════════════════
-- POST-SETUP NOTES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. After running this file, set admin role:
--    UPDATE profiles SET role = 'admin' WHERE phone = '0848612712';
--
-- 2. Sync existing auth.users into profiles (if any already exist):
--    INSERT INTO profiles (id, phone, full_name, role)
--    SELECT u.id,
--      COALESCE(NULLIF(TRIM(u.phone),''), NULLIF(split_part(COALESCE(u.email,''),'@',1),''), 'user_'||substr(u.id::text,1,8)),
--      COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'full_name'),''), NULLIF(split_part(COALESCE(u.email,''),'@',1),''), 'Người dùng'),
--      'customer'
--    FROM auth.users u
--    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
--    ON CONFLICT (id) DO NOTHING;
--
-- 3. Enable pg_cron extension in Supabase dashboard before running cron.schedule().
-- ═══════════════════════════════════════════════════════════════════════════
