-- Cho phép merchant đọc order_items của đơn hàng thuộc shop mình
CREATE POLICY "order_items_shop_owner" ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN shops s ON s.id = o.shop_id
      WHERE o.id = order_id
        AND s.owner_id = auth.uid()
    )
  );

-- Cho phép driver đọc order_items của đơn mình nhận
CREATE POLICY "order_items_driver" ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
        AND o.driver_id = auth.uid()
    )
  );
