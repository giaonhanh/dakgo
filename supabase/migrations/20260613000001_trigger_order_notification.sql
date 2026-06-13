-- Trigger: khi có đơn hàng mới (INSERT vào orders),
-- tự động tạo notification cho merchant (owner của shop)
-- để đơn mới xuất hiện trong chuông thông báo.

CREATE OR REPLACE FUNCTION notify_merchant_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id  UUID;
  v_shop_name TEXT;
  v_short_id  TEXT;
BEGIN
  -- Lấy owner_id và tên quán từ shops
  SELECT owner_id, name
    INTO v_owner_id, v_shop_name
    FROM shops
   WHERE id = NEW.shop_id;

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Tạo mã đơn ngắn (6 ký tự cuối UUID)
  v_short_id := UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 6));

  INSERT INTO notifications (user_id, type, title, body, data, is_read)
  VALUES (
    v_owner_id,
    'order',
    '🔔 Đơn mới #' || v_short_id,
    'Khách vừa đặt ' || NEW.total_amount::text || 'đ · Xác nhận ngay!',
    jsonb_build_object(
      'order_id',    NEW.id,
      'short_id',    v_short_id,
      'total',       NEW.total_amount,
      'shop_id',     NEW.shop_id
    ),
    FALSE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Xóa trigger cũ nếu có để tránh duplicate
DROP TRIGGER IF EXISTS trg_notify_merchant_new_order ON orders;

CREATE TRIGGER trg_notify_merchant_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_merchant_new_order();
