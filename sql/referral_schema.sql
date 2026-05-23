-- ============================================================
-- Referral System — Giao Nhanh
-- Chạy trong Supabase SQL Editor theo thứ tự từ trên xuống
-- ============================================================

-- Bảng 1: Mã giới thiệu (1 user = 1 code)
CREATE TABLE IF NOT EXISTS referral_codes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code         TEXT UNIQUE NOT NULL,
  total_uses   INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Bảng 2: Lịch sử ai giới thiệu ai
CREATE TABLE IF NOT EXISTS referral_usages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                TEXT NOT NULL REFERENCES referral_codes(code),
  referee_id          UUID NOT NULL REFERENCES profiles(id) UNIQUE,
  qualifying_order_id UUID REFERENCES orders(id),
  referrer_rewarded   BOOLEAN NOT NULL DEFAULT FALSE,
  referee_rewarded    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_usages_code ON referral_usages(code);

-- RLS
ALTER TABLE referral_codes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_codes_own"  ON referral_codes  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ref_usage_own"  ON referral_usages FOR SELECT USING (referee_id = auth.uid());
CREATE POLICY "ref_codes_admin" ON referral_codes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "ref_usage_admin" ON referral_usages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- RPC: Referee nhập mã khi checkout đơn đầu tiên
-- Trả về {"ok": true} hoặc {"ok": false, "error": "..."}
-- ============================================================
CREATE OR REPLACE FUNCTION apply_referral_code(p_code TEXT, p_referee_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  -- Mã có tồn tại không?
  SELECT user_id INTO v_referrer_id FROM referral_codes WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN '{"ok":false,"error":"Mã giới thiệu không tồn tại"}'::JSONB;
  END IF;

  -- Không tự giới thiệu bản thân
  IF v_referrer_id = p_referee_id THEN
    RETURN '{"ok":false,"error":"Không thể dùng mã của chính mình"}'::JSONB;
  END IF;

  -- Đã dùng mã rồi (referee_id UNIQUE)
  IF EXISTS (SELECT 1 FROM referral_usages WHERE referee_id = p_referee_id) THEN
    RETURN '{"ok":false,"error":"Bạn đã sử dụng mã giới thiệu trước đây"}'::JSONB;
  END IF;

  -- Ghi nhận (pending — chưa có qualifying_order_id)
  INSERT INTO referral_usages (code, referee_id)
  VALUES (p_code, p_referee_id)
  ON CONFLICT (referee_id) DO NOTHING;

  RETURN '{"ok":true}'::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Trigger: Phát thưởng khi đơn đầu tiên delivered + >= 50.000đ
-- Referrer: +10.000đ xu Giao Nhanh vào ví
-- Referee:  +10.000đ xu Giao Nhanh vào ví
-- ============================================================
CREATE OR REPLACE FUNCTION process_referral_reward() RETURNS TRIGGER AS $$
DECLARE
  v_usage              referral_usages%ROWTYPE;
  v_ref_code           referral_codes%ROWTYPE;
  v_referrer_wallet_id UUID;
  v_referee_wallet_id  UUID;
BEGIN
  -- Chỉ xử lý khi vừa chuyển sang delivered
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- Đơn phải >= 50.000đ
  IF NEW.total_amount < 50000 THEN
    RETURN NEW;
  END IF;

  -- Tìm referral usage của referee này (chưa thưởng)
  SELECT * INTO v_usage
  FROM referral_usages
  WHERE referee_id = NEW.customer_id
    AND qualifying_order_id IS NULL
    AND referrer_rewarded = FALSE;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Cập nhật qualifying order
  UPDATE referral_usages
  SET qualifying_order_id = NEW.id
  WHERE id = v_usage.id;

  -- Lấy thông tin referrer
  SELECT * INTO v_ref_code FROM referral_codes WHERE code = v_usage.code;

  -- ── Thưởng Referrer: +10.000đ xu vào ví ──────────────────
  SELECT id INTO v_referrer_wallet_id
  FROM wallets WHERE user_id = v_ref_code.user_id AND type = 'customer';

  IF FOUND THEN
    UPDATE wallets
    SET balance = balance + 10000, updated_at = NOW()
    WHERE id = v_referrer_wallet_id;

    INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
    SELECT id, 'topup', 10000, balance,
           'referral', v_usage.id,
           'Xu thưởng giới thiệu bạn bè thành công'
    FROM wallets WHERE id = v_referrer_wallet_id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_ref_code.user_id,
      'system',
      '🎉 Bạn nhận được 10.000đ xu!',
      'Người bạn giới thiệu vừa hoàn thành đơn đầu tiên. Xu đã được cộng vào ví.',
      jsonb_build_object('xu_amount', 10000, 'ref_id', v_usage.id)
    );
  END IF;

  -- ── Thưởng Referee: +10.000đ xu vào ví ───────────────────
  SELECT id INTO v_referee_wallet_id
  FROM wallets WHERE user_id = NEW.customer_id AND type = 'customer';

  IF FOUND THEN
    UPDATE wallets
    SET balance = balance + 10000, updated_at = NOW()
    WHERE id = v_referee_wallet_id;

    INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
    SELECT id, 'topup', 10000, balance,
           'referral', v_usage.id,
           'Xu thưởng dùng mã giới thiệu'
    FROM wallets WHERE id = v_referee_wallet_id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.customer_id,
      'system',
      '🎁 Nhận 10.000đ xu từ mã giới thiệu!',
      'Đơn đầu tiên của bạn hoàn thành. 10.000đ xu đã vào ví Giao Nhanh.',
      jsonb_build_object('xu_amount', 10000)
    );
  END IF;

  -- Cập nhật stats + đánh dấu đã thưởng
  UPDATE referral_codes
  SET total_uses   = total_uses + 1,
      total_earned = total_earned + 10000
  WHERE code = v_usage.code;

  UPDATE referral_usages
  SET referrer_rewarded = TRUE, referee_rewarded = TRUE
  WHERE id = v_usage.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_referral_reward
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION process_referral_reward();
