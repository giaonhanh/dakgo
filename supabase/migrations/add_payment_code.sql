-- Migration: add payment_code to orders + create wallet_topups table
-- Chạy trong Supabase SQL Editor

-- 1. Thêm cột payment_code vào orders (link với PayOS orderCode)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_code INTEGER;

CREATE INDEX IF NOT EXISTS idx_orders_payment_code
  ON orders(payment_code)
  WHERE payment_code IS NOT NULL;

-- 2. Bảng wallet_topups: theo dõi yêu cầu nạp ví qua PayOS
CREATE TABLE IF NOT EXISTS wallet_topups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_type  wallet_type NOT NULL DEFAULT 'customer',
  payment_code INTEGER NOT NULL,
  amount       INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_topups_payment_code
  ON wallet_topups(payment_code);

ALTER TABLE wallet_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topup_own" ON wallet_topups
  USING (user_id = auth.uid());
