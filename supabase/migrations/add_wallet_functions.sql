-- Migration: tạo enums + bảng wallets/transactions + RPC add_to_wallet
-- Chạy trong Supabase SQL Editor

-- 1. Tạo enums nếu chưa có (dùng tag riêng tránh xung đột $$)
DO $enum$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_type') THEN
    CREATE TYPE wallet_type AS ENUM ('customer','driver','merchant');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_type') THEN
    CREATE TYPE tx_type AS ENUM ('topup','payment','refund','commission','withdrawal');
  END IF;
END
$enum$;

-- 2. Bảng wallets nếu chưa có
CREATE TABLE IF NOT EXISTS wallets (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       wallet_type NOT NULL,
  balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, type)
);

-- 3. Bảng transactions nếu chưa có
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id     UUID NOT NULL REFERENCES wallets(id),
  type          tx_type NOT NULL,
  amount        INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  ref_type      TEXT,
  ref_id        UUID,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_id, created_at DESC);

-- 4. RPC: cộng tiền vào ví
CREATE OR REPLACE FUNCTION add_to_wallet(
  p_user_id  UUID,
  p_type     wallet_type,
  p_amount   INTEGER,
  p_ref_id   UUID    DEFAULT NULL,
  p_note     TEXT    DEFAULT '',
  p_tx_type  tx_type DEFAULT 'topup'
) RETURNS INTEGER AS $func$
DECLARE
  v_wallet_id UUID;
  v_balance   INTEGER;
BEGIN
  INSERT INTO wallets (user_id, type, balance)
  VALUES (p_user_id, p_type, p_amount)
  ON CONFLICT (user_id, type) DO UPDATE
    SET balance    = wallets.balance + p_amount,
        updated_at = NOW()
  RETURNING id, balance INTO v_wallet_id, v_balance;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
  VALUES (
    v_wallet_id,
    p_tx_type,
    p_amount,
    v_balance,
    CASE WHEN p_ref_id IS NOT NULL THEN 'order' ELSE 'topup' END,
    p_ref_id,
    p_note
  );

  RETURN v_balance;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: trừ tiền khỏi ví
CREATE OR REPLACE FUNCTION subtract_from_wallet(
  p_user_id  UUID,
  p_type     wallet_type,
  p_amount   INTEGER,
  p_ref_id   UUID    DEFAULT NULL,
  p_note     TEXT    DEFAULT '',
  p_tx_type  tx_type DEFAULT 'payment'
) RETURNS INTEGER AS $func2$
DECLARE
  v_wallet_id UUID;
  v_balance   INTEGER;
BEGIN
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM wallets
  WHERE user_id = p_user_id AND type = p_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  UPDATE wallets
  SET balance    = balance - p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_balance;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
  VALUES (
    v_wallet_id,
    p_tx_type,
    p_amount,
    v_balance,
    CASE WHEN p_ref_id IS NOT NULL THEN 'order' ELSE 'payment' END,
    p_ref_id,
    p_note
  );

  RETURN v_balance;
END;
$func2$ LANGUAGE plpgsql SECURITY DEFINER;
