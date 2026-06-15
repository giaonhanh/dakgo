-- ============================================================
-- COMMISSION SYSTEM — Hoa hồng tài xế + quán
-- Chạy toàn bộ trong Supabase → SQL Editor
-- ============================================================


-- ════════════════════════════════════════════════
-- 1. COLUMNS MỚI
-- ════════════════════════════════════════════════

-- Per-driver commission override (NULL = dùng global setting)
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2);

-- Lưu commission đã trừ vào orders để refund chính xác
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS driver_commission_rate   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS driver_commission_amount INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shop_commission_rate     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS shop_commission_amount   INT NOT NULL DEFAULT 0;


-- ════════════════════════════════════════════════
-- 2. APP_SETTINGS: Global commission defaults
-- ════════════════════════════════════════════════

-- Tạo bảng nếu chưa có
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global commission defaults — admin có thể chỉnh qua bảng này
INSERT INTO app_settings (key, value) VALUES (
  'commission',
  '{"driver_rate": 15, "shop_rate": 15}'::jsonb
) ON CONFLICT (key) DO NOTHING;


-- ════════════════════════════════════════════════
-- 3. HELPER: Lấy commission rate hiệu lực
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_driver_commission_rate(p_driver_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rate   NUMERIC;
  v_global NUMERIC;
BEGIN
  -- Lấy global rate từ app_settings
  SELECT (value->>'driver_rate')::NUMERIC INTO v_global
  FROM app_settings WHERE key = 'commission';

  -- Per-driver override nếu có
  SELECT commission_rate INTO v_rate
  FROM drivers WHERE id = p_driver_id;

  RETURN COALESCE(v_rate, v_global, 15);
END;
$$;

CREATE OR REPLACE FUNCTION get_shop_commission_rate(p_shop_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rate   NUMERIC;
  v_global NUMERIC;
BEGIN
  SELECT (value->>'shop_rate')::NUMERIC INTO v_global
  FROM app_settings WHERE key = 'commission';

  SELECT commission_rate INTO v_rate
  FROM shops WHERE id = p_shop_id;

  RETURN COALESCE(v_rate, v_global, 15);
END;
$$;


-- ════════════════════════════════════════════════
-- 4. FUNCTION: Tài xế nhận đơn — atomic + trừ hoa hồng tài xế
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION accept_order_with_commission(
  p_order_id  UUID,
  p_driver_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order              RECORD;
  v_commission_rate    NUMERIC;
  v_commission_amount  INT;
  v_wallet             RECORD;
  v_rows               INT;
BEGIN
  -- Lock đơn hàng để tránh race condition
  SELECT id, ship_fee, driver_id, status, shop_id
  INTO v_order
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Đơn không tồn tại');
  END IF;

  IF v_order.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Đơn đã được tài xế khác nhận');
  END IF;

  -- Cho phép nhận đơn ở trạng thái pending (khách đặt) hoặc accepted (merchant đã xác nhận)
  IF v_order.status NOT IN ('pending', 'accepted') THEN
    RETURN jsonb_build_object('error', 'Đơn không còn có thể nhận');
  END IF;

  -- Tính hoa hồng tài xế
  v_commission_rate   := get_driver_commission_rate(p_driver_id);
  v_commission_amount := ROUND(COALESCE(v_order.ship_fee, 0) * v_commission_rate / 100)::INT;

  -- Trừ ví tài xế nếu hoa hồng > 0
  IF v_commission_amount > 0 THEN
    SELECT id, balance INTO v_wallet
    FROM wallets
    WHERE user_id = p_driver_id AND type = 'driver'
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Tài xế chưa có ví tiền ký quỹ. Vui lòng liên hệ admin.');
    END IF;

    IF v_wallet.balance < v_commission_amount THEN
      RETURN jsonb_build_object(
        'error',
        format('Số dư ví không đủ. Cần %sđ hoa hồng, ví còn %sđ. Vui lòng nạp thêm tiền.',
          to_char(v_commission_amount, 'FM999G999G999'),
          to_char(v_wallet.balance,    'FM999G999G999'))
      );
    END IF;

    UPDATE wallets
    SET balance = balance - v_commission_amount, updated_at = now()
    WHERE id = v_wallet.id;

    INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
    VALUES (
      v_wallet.id, 'commission', v_commission_amount,
      v_wallet.balance - v_commission_amount,
      'order', p_order_id,
      format('Hoa hồng nhận đơn #%s (%.0f%%)',
        UPPER(LEFT(p_order_id::TEXT, 8)), v_commission_rate)
    );
  END IF;

  -- Atomic update — nếu pending thì chuyển sang accepted; nếu đã accepted thì giữ nguyên
  UPDATE orders SET
    status                   = CASE WHEN status = 'pending' THEN 'accepted' ELSE status END,
    driver_id                = p_driver_id,
    accepted_at              = COALESCE(accepted_at, now()),
    driver_commission_rate   = v_commission_rate,
    driver_commission_amount = v_commission_amount
  WHERE id = p_order_id
    AND driver_id IS NULL
    AND status IN ('pending', 'accepted');

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    -- Tài xế khác đã nhận trong lúc xử lý → hoàn hoa hồng
    IF v_commission_amount > 0 THEN
      UPDATE wallets
      SET balance = balance + v_commission_amount, updated_at = now()
      WHERE id = v_wallet.id;

      DELETE FROM transactions
      WHERE wallet_id = v_wallet.id
        AND ref_id = p_order_id
        AND type = 'commission'
        AND created_at > now() - INTERVAL '10 seconds';
    END IF;
    RETURN jsonb_build_object('error', 'Đơn đã được tài xế khác nhận');
  END IF;

  RETURN jsonb_build_object(
    'success',           true,
    'commission_amount', v_commission_amount,
    'commission_rate',   v_commission_rate
  );
END;
$$;


-- ════════════════════════════════════════════════
-- 5. FUNCTION: Giao hàng xong — trừ hoa hồng quán + cộng ví tài xế (COD)
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION complete_order_with_commission(
  p_order_id UUID,
  p_driver_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order               RECORD;
  v_shop_commission_rate   NUMERIC;
  v_shop_commission_amount INT;
  v_driver_earning         INT;
  v_merchant_wallet        RECORD;
  v_driver_wallet          RECORD;
BEGIN
  SELECT o.id, o.ship_fee, o.subtotal, o.total_amount, o.pay_method, o.shop_id,
         o.driver_commission_amount, o.status,
         s.commission_rate AS shop_comm_rate
  INTO v_order
  FROM orders o
  JOIN shops  s ON s.id = o.shop_id
  WHERE o.id = p_order_id AND o.driver_id = p_driver_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Không tìm thấy đơn');
  END IF;

  -- Hoa hồng quán: tính trên subtotal (tiền đồ ăn, không bao gồm ship)
  v_shop_commission_rate   := get_shop_commission_rate(v_order.shop_id);
  v_shop_commission_amount := ROUND(COALESCE(v_order.subtotal, 0) * v_shop_commission_rate / 100)::INT;

  -- Cập nhật đơn: delivered + ghi nhận commission quán
  UPDATE orders SET
    status                  = 'delivered',
    delivered_at            = now(),
    shop_commission_rate    = v_shop_commission_rate,
    shop_commission_amount  = v_shop_commission_amount
  WHERE id = p_order_id;

  -- Trừ ví merchant (hoa hồng quán)
  IF v_shop_commission_amount > 0 THEN
    SELECT id, balance INTO v_merchant_wallet
    FROM wallets
    WHERE user_id = (SELECT owner_id FROM shops WHERE id = v_order.shop_id)
      AND type = 'merchant'
    FOR UPDATE;

    IF FOUND THEN
      UPDATE wallets
      SET balance    = balance - v_shop_commission_amount,
          updated_at = now()
      WHERE id = v_merchant_wallet.id;

      INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
      VALUES (
        v_merchant_wallet.id, 'commission', v_shop_commission_amount,
        v_merchant_wallet.balance - v_shop_commission_amount,
        'order', p_order_id,
        format('Hoa hồng đơn #%s (%.0f%%)',
          UPPER(LEFT(p_order_id::TEXT, 8)), v_shop_commission_rate)
      );
    END IF;
  END IF;

  -- Cộng ví tài xế (chỉ COD — đơn online đã được PayOS webhook xử lý)
  IF v_order.pay_method = 'cash' THEN
    v_driver_earning := COALESCE(v_order.ship_fee, 0) - COALESCE(v_order.driver_commission_amount, 0);

    IF v_driver_earning > 0 THEN
      SELECT id, balance INTO v_driver_wallet
      FROM wallets WHERE user_id = p_driver_id AND type = 'driver'
      FOR UPDATE;

      IF FOUND THEN
        UPDATE wallets
        SET balance = balance + v_driver_earning, updated_at = now()
        WHERE id = v_driver_wallet.id;

        INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
        VALUES (
          v_driver_wallet.id, 'commission', v_driver_earning,
          v_driver_wallet.balance + v_driver_earning,
          'order', p_order_id,
          format('Tiền công COD #%s', UPPER(LEFT(p_order_id::TEXT, 8)))
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',                  true,
    'shop_commission_amount',   v_shop_commission_amount,
    'driver_earning',           v_driver_earning
  );
END;
$$;


-- ════════════════════════════════════════════════
-- 6. FUNCTION: Hoàn hoa hồng tài xế khi đơn bị hủy
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refund_driver_commission(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order  RECORD;
  v_wallet RECORD;
BEGIN
  SELECT driver_id, driver_commission_amount
  INTO v_order
  FROM orders WHERE id = p_order_id;

  IF v_order.driver_id IS NULL OR COALESCE(v_order.driver_commission_amount, 0) = 0 THEN
    RETURN;  -- Không có tài xế hoặc chưa trừ hoa hồng
  END IF;

  SELECT id, balance INTO v_wallet
  FROM wallets WHERE user_id = v_order.driver_id AND type = 'driver'
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE wallets
  SET balance = balance + v_order.driver_commission_amount, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
  VALUES (
    v_wallet.id, 'refund', v_order.driver_commission_amount,
    v_wallet.balance + v_order.driver_commission_amount,
    'order', p_order_id,
    'Hoàn hoa hồng do huỷ đơn #' || UPPER(LEFT(p_order_id::TEXT, 8))
  );

  -- Reset để không hoàn 2 lần
  UPDATE orders SET driver_commission_amount = 0 WHERE id = p_order_id;
END;
$$;


-- ════════════════════════════════════════════════
-- 7. Cập nhật cancel_pending_orders_job — thêm hoàn hoa hồng
-- ════════════════════════════════════════════════

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
        (o.pay_method = 'cash'
         AND o.created_at < now() - INTERVAL '30 minutes')
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

    -- Hoàn hoa hồng tài xế nếu có
    PERFORM refund_driver_commission(v_order.id);

    -- Hoàn xu khách
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
      v_order.customer_id, 'order',
      'Đơn hàng đã bị hủy',
      'Đơn ' || to_char(v_order.total_amount, 'FM999G999G999') || 'đ đã bị hủy tự động.',
      jsonb_build_object('cancelled', true, 'order_id', v_order.id, 'url', '/orders')
    )
    ON CONFLICT DO NOTHING;

  END LOOP;

  RETURN jsonb_build_object('cancelled', v_cancelled, 'xu_refunded', v_xu_refunded, 'ran_at', now());
END;
$$;


-- ════════════════════════════════════════════════
-- 8. INDEX HỖ TRỢ
-- ════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_drivers_commission  ON drivers(commission_rate) WHERE commission_rate IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_driver_comm  ON orders(driver_id, driver_commission_amount) WHERE driver_commission_amount > 0;


-- ════════════════════════════════════════════════
-- 9. GRANT EXECUTE cho role authenticated
-- ════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION get_driver_commission_rate(UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION get_shop_commission_rate(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION accept_order_with_commission(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_order_with_commission(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_driver_commission(UUID)           TO authenticated;
