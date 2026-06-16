-- Mở rộng policy 20260616_driver_pending_orders_policy.sql để bao gồm status 'preparing'
-- Cần thiết vì driver/page.tsx có channel "driver-merchant-preparing" lắng nghe
-- UPDATE orders status=preparing (driver_id vẫn null) — nếu RLS không cho SELECT
-- status='preparing' thì Realtime sẽ không gửi event này tới tài xế.
DROP POLICY IF EXISTS "orders_driver_see_pending" ON orders;

CREATE POLICY "orders_driver_see_pending" ON orders FOR SELECT
  USING (
    status IN ('pending', 'accepted', 'preparing')
    AND driver_id IS NULL
    AND EXISTS (
      SELECT 1 FROM drivers
      WHERE id = auth.uid()
        AND status = 'online'
        AND is_approved = TRUE
    )
  );
