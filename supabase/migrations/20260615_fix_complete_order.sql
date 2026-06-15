-- ============================================================
-- Fix complete_order_with_commission
-- Bỏ trừ ví merchant (quán không dùng app wallet, tài xế thu tiền mặt trực tiếp)
-- Chạy trong Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION complete_order_with_commission(
  p_order_id  UUID,
  p_driver_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order              RECORD;
  v_shop_rate          NUMERIC;
  v_shop_commission    INT;
  v_driver_earning     INT;
  v_driver_wallet      RECORD;
BEGIN
  SELECT o.id, o.ship_fee, o.subtotal, o.pay_method, o.shop_id,
         o.driver_commission_amount, o.shop_commission_amount
  INTO v_order
  FROM orders o
  WHERE o.id = p_order_id AND o.driver_id = p_driver_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Không tìm thấy đơn');
  END IF;

  -- Idempotency: đã xử lý rồi thì bỏ qua
  IF COALESCE(v_order.shop_commission_amount, 0) > 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true);
  END IF;

  -- Tính hoa hồng quán — ghi nhận để báo cáo, tài xế đã thu mặt từ quán
  v_shop_rate       := get_shop_commission_rate(v_order.shop_id);
  v_shop_commission := ROUND(COALESCE(v_order.subtotal, 0) * v_shop_rate / 100)::INT;

  UPDATE orders SET
    status                 = 'delivered',
    delivered_at           = COALESCE(delivered_at, now()),
    shop_commission_rate   = v_shop_rate,
    shop_commission_amount = v_shop_commission
  WHERE id = p_order_id;

  -- Cộng xu ví tài xế = tiền ship - hoa hồng tài xế (tất cả payment methods)
  -- COD: driver đã thu tiền mặt, xu này là phần nền tảng trả lại sau khi trừ commission
  -- VietQR/wallet: khách trả online, nền tảng giữ rồi trả driver phần ship khi giao xong
  BEGIN
    v_driver_earning := COALESCE(v_order.ship_fee, 0)
                      - COALESCE(v_order.driver_commission_amount, 0);

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
          format('Tiền công đơn #%s', UPPER(LEFT(p_order_id::TEXT, 8)))
        );
      END IF;
    END IF;
  END;

  RETURN jsonb_build_object(
    'success',          true,
    'shop_commission',  v_shop_commission,
    'driver_earning',   COALESCE(v_driver_earning, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION complete_order_with_commission(UUID, UUID) TO authenticated;
