-- RPC: add_to_wallet
-- Dùng bởi webhook PayOS để cộng/trừ ví merchant, driver, customer
-- Atomic: update balance + insert transaction trong 1 lần
CREATE OR REPLACE FUNCTION add_to_wallet(
  p_user_id  UUID,
  p_type     TEXT,          -- 'customer' | 'driver' | 'merchant'
  p_amount   INTEGER,       -- dương = cộng, âm = trừ
  p_ref_id   UUID DEFAULT NULL,
  p_note     TEXT DEFAULT NULL,
  p_tx_type  TEXT DEFAULT 'topup'  -- 'topup' | 'payment' | 'refund' | 'commission' | 'withdrawal'
) RETURNS void AS $$
DECLARE
  v_wallet_id     UUID;
  v_current_bal   INTEGER;
  v_new_bal       INTEGER;
BEGIN
  -- Tìm hoặc tạo ví
  INSERT INTO wallets (user_id, type, balance)
  VALUES (p_user_id, p_type::wallet_type, 0)
  ON CONFLICT (user_id, type) DO NOTHING;

  -- Lấy ví với lock để tránh race condition
  SELECT id, balance INTO v_wallet_id, v_current_bal
  FROM wallets
  WHERE user_id = p_user_id AND type = p_type::wallet_type
  FOR UPDATE;

  v_new_bal := v_current_bal + p_amount;

  IF v_new_bal < 0 THEN
    RAISE EXCEPTION 'Số dư không đủ (hiện có: %, cần trừ: %)', v_current_bal, ABS(p_amount);
  END IF;

  -- Cập nhật số dư
  UPDATE wallets
  SET balance = v_new_bal, updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Ghi lịch sử giao dịch
  INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
  VALUES (
    v_wallet_id,
    p_tx_type::tx_type,
    p_amount,
    v_new_bal,
    CASE WHEN p_ref_id IS NOT NULL THEN 'order' ELSE NULL END,
    p_ref_id,
    p_note
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
