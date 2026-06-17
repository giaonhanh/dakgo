-- ════════════════════════════════════════════════════════════════════
-- Commission system functions — chạy lần đầu trên production DB
-- Root cause: fix_schema_full.sql không bao gồm các hàm hoa hồng
-- ════════════════════════════════════════════════════════════════════

-- 1. Thêm cột còn thiếu vào orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS driver_commission_rate   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS driver_commission_amount INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shop_commission_rate     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS shop_commission_amount   INT NOT NULL DEFAULT 0;

-- 2. Thêm cột commission_rate vào drivers (nếu chưa có)
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2);

-- ────────────────────────────────────────────────────────────────────
-- 3. get_driver_commission_rate — đọc rate theo tài xế / global
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_driver_commission_rate(p_driver_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rate   NUMERIC;
  v_global NUMERIC;
BEGIN
  -- Global rate từ app_settings (field driver_rate hoặc defaultRate)
  SELECT COALESCE(
    (value->>'driver_rate')::NUMERIC,
    (value->>'defaultRate')::NUMERIC
  ) INTO v_global
  FROM app_settings WHERE key = 'commission';

  -- Per-driver override nếu có (set từ admin → tài xế)
  SELECT commission_rate INTO v_rate
  FROM drivers WHERE id = p_driver_id;

  RETURN COALESCE(v_rate, v_global, 15);
END;
$$;

-- ────────────────────────────────────────────────────────────────────
-- 4. get_shop_commission_rate — đọc rate theo quán / global
-- ────────────────────────────────────────────────────────────────────
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

  SELECT commission_rate INTO v_rate
  FROM shops WHERE id = p_shop_id;

  RETURN COALESCE(v_rate, v_global, 15);
END;
$$;

-- ────────────────────────────────────────────────────────────────────
-- 5. accept_order_with_commission — tài xế nhận đơn (atomic + trừ HH)
--    version: max 3 đơn cùng lúc (20260617)
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION accept_order_with_commission(
  p_order_id  UUID,
  p_driver_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order                  RECORD;
  v_driver_rate            NUMERIC;
  v_shop_rate              NUMERIC;
  v_driver_commission      INT;
  v_shop_commission        INT;
  v_total_deduction        INT;
  v_wallet                 RECORD;
  v_rows                   INT;
  v_active_count           INT;
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

  -- Giới hạn tối đa 3 đơn đang xử lý cùng lúc
  SELECT COUNT(*) INTO v_active_count
  FROM orders
  WHERE driver_id = p_driver_id
    AND status NOT IN ('delivered', 'cancelled');

  IF v_active_count >= 3 THEN
    RETURN jsonb_build_object('error', 'Bạn đang xử lý 3 đơn — hãy hoàn tất bớt trước khi nhận thêm');
  END IF;

  -- Tính hoa hồng
  v_driver_rate       := get_driver_commission_rate(p_driver_id);
  v_shop_rate         := get_shop_commission_rate(v_order.shop_id);
  v_driver_commission := ROUND(COALESCE(v_order.ship_fee, 0) * v_driver_rate  / 100)::INT;
  v_shop_commission   := ROUND(COALESCE(v_order.subtotal,  0) * v_shop_rate   / 100)::INT;
  v_total_deduction   := v_driver_commission + v_shop_commission;

  -- Kiểm tra + lock ví tài xế
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

    UPDATE wallets
    SET balance = balance - v_total_deduction, updated_at = now()
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

  -- Atomic update đơn
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
    -- Tài xế khác nhận trước → hoàn lại
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

-- ────────────────────────────────────────────────────────────────────
-- 6. complete_order_with_commission — giao hàng xong (không cộng ví COD)
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_order_with_commission(p_order_id UUID, p_driver_id UUID)
RETURNS JSONB
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

  v_driver_earning := COALESCE(v_order.ship_fee, 0) - COALESCE(v_order.driver_commission_amount, 0);

  RETURN jsonb_build_object(
    'success',                  true,
    'shop_commission_amount',   v_shop_commission_amount,
    'driver_earning',           v_driver_earning
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────────
-- 7. refund_driver_commission — hoàn hoa hồng khi hủy đơn
-- ────────────────────────────────────────────────────────────────────
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

-- ────────────────────────────────────────────────────────────────────
-- 8. Cập nhật app_settings: thêm driver_rate và shop_rate để nhất quán
-- ────────────────────────────────────────────────────────────────────
UPDATE app_settings
SET value = value
  || jsonb_build_object(
      'driver_rate', COALESCE((value->>'driver_rate')::TEXT, (value->>'defaultRate')::TEXT, '15'),
      'shop_rate',   COALESCE((value->>'shop_rate')::TEXT,   (value->>'defaultRate')::TEXT, '15')
    )
WHERE key = 'commission';

-- ────────────────────────────────────────────────────────────────────
-- 9. Cấp quyền thực thi
-- ────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION get_driver_commission_rate(UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION get_shop_commission_rate(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION accept_order_with_commission(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_order_with_commission(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_driver_commission(UUID)           TO authenticated;
