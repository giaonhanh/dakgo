-- Fix: thêm cột subtotal vào orders (tiền hàng, không bao gồm ship_fee)
-- Root cause: accept_order_with_commission query v_order.subtotal → lỗi runtime

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal INT NOT NULL DEFAULT 0;

-- Backfill: subtotal = total (cột cũ = tiền hàng)
UPDATE orders SET subtotal = total WHERE subtotal = 0 AND total > 0;

-- Trigger: tự đồng bộ subtotal khi INSERT đơn mới (nếu chưa set)
CREATE OR REPLACE FUNCTION sync_order_subtotal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.subtotal = 0 AND NEW.total > 0 THEN
    NEW.subtotal := NEW.total;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_subtotal ON orders;
CREATE TRIGGER trg_sync_order_subtotal
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_order_subtotal();
