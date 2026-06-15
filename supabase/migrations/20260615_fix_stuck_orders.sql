-- ============================================================
-- Fix: Alert admin khi đơn bị kẹt ở ready/delivering quá lâu
-- Chạy trong Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION alert_stuck_orders_job()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order    RECORD;
  v_count    INT := 0;
  v_admin_id UUID;
BEGIN
  -- Lấy 1 admin để gửi cảnh báo
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'admin' LIMIT 1;

  FOR v_order IN
    SELECT o.id, o.status, o.driver_id, o.total_amount,
           o.ready_at, o.picked_up_at, o.accepted_at
    FROM orders o
    WHERE o.status IN ('ready', 'delivering')
      AND o.cancelled_at IS NULL
      AND (
        -- Kẹt ở ready quá 45 phút (tài xế không đến lấy)
        (o.status = 'ready'      AND o.ready_at     < now() - INTERVAL '45 minutes')
        OR
        -- Kẹt ở delivering quá 2 giờ (tài xế biến mất)
        (o.status = 'delivering' AND o.picked_up_at < now() - INTERVAL '2 hours')
      )
  LOOP
    v_count := v_count + 1;

    -- Chỉ tạo notification nếu chưa có trong 1 giờ qua (tránh spam)
    INSERT INTO notifications (user_id, type, title, body, data)
    SELECT v_admin_id, 'system',
      CASE v_order.status
        WHEN 'ready'      THEN '⚠️ Đơn chờ tài xế quá lâu'
        WHEN 'delivering' THEN '🚨 Tài xế không xác nhận giao'
      END,
      format('Đơn #%s · %sđ · đã ở trạng thái "%s" quá lâu. Cần kiểm tra.',
        UPPER(LEFT(v_order.id::TEXT, 8)),
        to_char(v_order.total_amount, 'FM999G999G999'),
        v_order.status),
      jsonb_build_object('order_id', v_order.id, 'url', '/admin/orders', 'stuck', true)
    WHERE v_admin_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_admin_id
          AND data->>'order_id' = v_order.id::TEXT
          AND data->>'stuck' = 'true'
          AND created_at > now() - INTERVAL '1 hour'
      );

  END LOOP;

  RETURN jsonb_build_object('stuck_orders_found', v_count, 'ran_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION alert_stuck_orders_job() TO authenticated;
