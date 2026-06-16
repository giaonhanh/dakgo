-- Cho phép tài xế online + approved thấy đơn pending (driver_id IS NULL)
-- Cần thiết để Supabase Realtime gửi INSERT event cho tài xế
CREATE POLICY "orders_driver_see_pending" ON orders FOR SELECT
  USING (
    status IN ('pending', 'accepted')
    AND driver_id IS NULL
    AND EXISTS (
      SELECT 1 FROM drivers
      WHERE id = auth.uid()
        AND status = 'online'
        AND is_approved = TRUE
    )
  );
