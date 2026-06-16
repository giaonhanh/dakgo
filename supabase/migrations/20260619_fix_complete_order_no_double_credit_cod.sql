-- complete_order_with_commission() dang cong vi tai xe = ship_fee - driver_commission_amount
-- cho CA don COD (pay_method='cash') khi don hoan tat. Day la cong trung lan 2:
-- tai xe COD da thu du tien mat tu khach (subtotal + ship_fee) va da tra tien mat
-- cho quan (subtotal - shop_commission) -> tai xe dang cam san tien mat = ship_fee
-- + shop_commission. Hoa hong tai xe (driver_commission) da bi tru vi tu luc NHAN
-- don (accept_order_with_commission), khong phai luc nay. Theo tai lieu luong tien
-- da duyet: "Neu khach tra 100% tien mat: KHONG cong xu driver (driver da co tien
-- mat)". Sua lai: bo hoan toan buoc cong vi cho COD, chi giu lai gia tri tra ve
-- driver_earning de hien thi tham khao (front-end khong dung gia tri nay de tru/cong
-- gi ca, chi hien thi).

CREATE OR REPLACE FUNCTION public.complete_order_with_commission(p_order_id uuid, p_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_order                   RECORD;
  v_shop_commission_rate    NUMERIC;
  v_shop_commission_amount  INT;
  v_driver_earning          INT;
  v_merchant_wallet         RECORD;
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

  -- Tien cong tai xe (chi de hien thi tham khao) — KHONG cong vao vi vi tai xe
  -- COD da giu san tien mat (ship_fee + shop_commission da thu/giu khi giao),
  -- hoa hong tai xe da tru vi tu luc nhan don roi.
  v_driver_earning := COALESCE(v_order.ship_fee, 0) - COALESCE(v_order.driver_commission_amount, 0);

  RETURN jsonb_build_object(
    'success',                  true,
    'shop_commission_amount',   v_shop_commission_amount,
    'driver_earning',           v_driver_earning
  );
END;
$function$;
