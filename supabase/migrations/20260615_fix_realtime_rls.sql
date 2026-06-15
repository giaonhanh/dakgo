-- ============================================================
-- FIX: Realtime + RLS cho order_items + bảo vệ tọa độ
-- Chạy toàn bộ trong Supabase → SQL Editor
-- ============================================================

-- 1. REPLICA IDENTITY FULL — bắt buộc để postgres_changes + RLS hoạt động
--    Không có dòng này, customer sẽ không nhận được UPDATE realtime theo đúng filter RLS
ALTER TABLE orders       REPLICA IDENTITY FULL;
ALTER TABLE order_items  REPLICA IDENTITY FULL;
ALTER TABLE errands      REPLICA IDENTITY FULL;
ALTER TABLE rides        REPLICA IDENTITY FULL;

-- 2. order_items — tài xế được phép đọc items của đơn đang giao
--    Thiếu policy này là nguyên nhân "tài xế thấy 0 món"
CREATE POLICY "order_items_driver_select" ON order_items FOR SELECT
  USING (auth.uid() = (SELECT driver_id FROM orders WHERE id = order_id));

-- 3. order_items — merchant (chủ quán) cũng được phép đọc items
CREATE POLICY "order_items_merchant_select" ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o
    JOIN shops s ON s.id = o.shop_id
    WHERE o.id = order_id AND s.owner_id = auth.uid()
  ));

-- 4. Cập nhật errands + rides vào realtime publication (nếu chưa có)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'errands'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE errands;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rides;
  END IF;
END $$;
