-- Migration: tạo bảng saved_addresses cho trang checkout
-- Chạy trong Supabase SQL Editor — an toàn chạy lại (IF NOT EXISTS)

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
