-- Migration: thêm badge, toppings, sizes, giờ bán vào bảng products
-- Chạy trong Supabase SQL Editor — idempotent, an toàn chạy lại

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS badge       TEXT    CHECK (badge IN ('hot','bigsale','bestseller')),
  ADD COLUMN IF NOT EXISTS toppings    JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sizes       JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS all_day     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS start_hour  TEXT,
  ADD COLUMN IF NOT EXISTS end_hour    TEXT;

-- Kiểm tra sau khi chạy:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'products' ORDER BY ordinal_position;
