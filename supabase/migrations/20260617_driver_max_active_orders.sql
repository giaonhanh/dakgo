-- Gioi han tai xe chi duoc nhan toi da 3 don dang xu ly cung luc.
-- "Dang xu ly" = da gan driver_id, chua delivered/cancelled.
-- Ap dung cho ca RPC chinh (accept_order_with_commission) va du phong (handled o code, xem accept-order/route.ts).

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

  -- Tính cả 2 hoa hồng
  v_driver_rate       := get_driver_commission_rate(p_driver_id);
  v_shop_rate         := get_shop_commission_rate(v_order.shop_id);
  v_driver_commission := ROUND(COALESCE(v_order.ship_fee, 0) * v_driver_rate  / 100)::INT;
  v_shop_commission   := ROUND(COALESCE(v_order.subtotal,  0) * v_shop_rate   / 100)::INT;
  v_total_deduction   := v_driver_commission + v_shop_commission;

  -- Kiểm tra + lock ví
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

  -- Atomic update
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

GRANT EXECUTE ON FUNCTION accept_order_with_commission(UUID, UUID) TO authenticated;
