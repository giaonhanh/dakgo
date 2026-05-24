-- Migration: thêm thông tin tài khoản ngân hàng vào bảng drivers
-- Chạy trong Supabase SQL Editor

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS bank_name           TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name   TEXT;
