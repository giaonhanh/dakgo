-- ============================================================
-- MIGRATION: pg_cron + các function còn thiếu + cột còn thiếu
-- Chạy toàn bộ file này trong Supabase → SQL Editor
-- An toàn: IF NOT EXISTS / OR REPLACE ở mọi bước
-- ============================================================


-- ════════════════════════════════════════════════
-- 1. EXTENSIONS
-- ════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;   -- cho HTTP call nếu cần sau


-- ════════════════════════════════════════════════
-- 2. CỘT CÒN THIẾU TRONG ORDERS
-- ════════════════════════════════════════════════

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status  TEXT    NOT NULL DEFAULT 'pending'
                                           CHECK (payment_status IN ('pending','paid','failed','refunded')),
  ADD COLUMN IF NOT EXISTS xu_used         INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xu_bonus_used   INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_by    UUID    REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS picked_up_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preparing_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_amount INT     NOT NULL DEFAULT 0;

-- Đồng bộ: đơn đã giao → payment_status = paid (nếu chưa set)
UPDATE orders SET payment_status = 'paid'
WHERE status IN ('delivered','done') AND payment_status = 'pending';


-- ════════════════════════════════════════════════
-- 3. FUNCTION: deduct_xu_atomic
-- Trừ xu trong một transaction — tránh race condition
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION deduct_xu_atomic(
  p_wallet_id  UUID,
  p_xu_used    INT,
  p_xu_bonus   INT,
  p_new_bal    INT,
  p_new_bonus  INT,
  p_order_id   UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  -- Lock row để tránh concurrent update
  SELECT id, balance, bonus_balance INTO v_wallet
  FROM wallets WHERE id = p_wallet_id FOR UPDATE;

  -- Re-validate sau khi lock (tránh TOCTOU race condition)
  IF v_wallet.balance < p_xu_used THEN
    RAISE EXCEPTION 'Số dư xu không đủ (cần %, có %)', p_xu_used, v_wallet.balance;
  END IF;
  IF v_wallet.bonus_balance < p_xu_bonus THEN
    RAISE EXCEPTION 'Xu thưởng không đủ (cần %, có %)', p_xu_bonus, v_wallet.bonus_balance;
  END IF;

  -- Trừ xu
  UPDATE wallets SET
    balance       = balance       - p_xu_used,
    bonus_balance = bonus_balance - p_xu_bonus,
    updated_at    = now()
  WHERE id = p_wallet_id;

  -- Ghi transaction log
  IF p_xu_bonus > 0 THEN
    INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
    VALUES (p_wallet_id, 'payment', p_xu_bonus, p_new_bonus, 'order', p_order_id, 'Thanh toán bằng xu thưởng');
  END IF;
  IF p_xu_used > 0 THEN
    INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
    VALUES (p_wallet_id, 'payment', p_xu_used, p_new_bal, 'order', p_order_id, 'Thanh toán bằng xu Giao Nhanh');
  END IF;
END;
$$;


-- ════════════════════════════════════════════════
-- 4. FUNCTION: dispatch_nearest_driver
-- Tìm tài xế gần nhất, loại trừ danh sách đã thử
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION dispatch_nearest_driver(
  ref_lat     DOUBLE PRECISION,
  ref_lng     DOUBLE PRECISION,
  exclude_ids UUID[] DEFAULT '{}'
) RETURNS UUID
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM drivers
  WHERE status = 'online'
    AND is_approved = TRUE
    AND (cardinality(exclude_ids) = 0 OR id != ALL(exclude_ids))
  ORDER BY
    CASE
      WHEN location IS NULL THEN 999999
      ELSE ST_Distance(location, ST_Point(ref_lng, ref_lat)::geography)
    END ASC
  LIMIT 1;
$$;


-- ════════════════════════════════════════════════
-- 5. FUNCTION: cancel_pending_orders_job
-- Hủy đơn quá hạn + hoàn xu — chạy bởi pg_cron
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cancel_pending_orders_job()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order       RECORD;
  v_wallet      RECORD;
  v_cancelled   INT := 0;
  v_xu_refunded INT := 0;
BEGIN
  -- Đơn thanh toán online quá 15 phút chưa thanh toán → hủy
  -- Đơn COD quá 30 phút chưa được quán xác nhận → hủy
  FOR v_order IN
    SELECT o.id, o.customer_id, o.total_amount, o.xu_used, o.xu_bonus_used,
           o.pay_method, o.payment_status, o.status
    FROM orders o
    WHERE o.status = 'pending'
      AND o.cancelled_at IS NULL
      AND (
        -- Online: chưa thanh toán sau 15 phút
        (o.pay_method != 'cash' AND o.payment_status = 'pending'
         AND o.created_at < now() - INTERVAL '15 minutes')
        OR
        -- COD: quán chưa xác nhận sau 30 phút
        (o.pay_method = 'cash'
         AND o.created_at < now() - INTERVAL '30 minutes')
      )
  LOOP
    -- Hủy đơn
    UPDATE orders SET
      status        = 'cancelled',
      cancelled_at  = now(),
      cancel_reason = CASE
        WHEN v_order.pay_method != 'cash' THEN 'Hết thời gian thanh toán (tự động hủy sau 15 phút)'
        ELSE 'Quán không xác nhận (tự động hủy sau 30 phút)'
      END
    WHERE id = v_order.id;

    v_cancelled := v_cancelled + 1;

    -- Hoàn xu nếu có dùng
    IF COALESCE(v_order.xu_used, 0) > 0 OR COALESCE(v_order.xu_bonus_used, 0) > 0 THEN
      SELECT id, balance, bonus_balance INTO v_wallet
      FROM wallets
      WHERE user_id = v_order.customer_id AND type = 'customer'
      FOR UPDATE;

      IF FOUND THEN
        UPDATE wallets SET
          balance       = balance       + COALESCE(v_order.xu_used, 0),
          bonus_balance = bonus_balance + COALESCE(v_order.xu_bonus_used, 0),
          updated_at    = now()
        WHERE id = v_wallet.id;

        IF COALESCE(v_order.xu_used, 0) > 0 THEN
          INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
          VALUES (
            v_wallet.id, 'refund', v_order.xu_used,
            v_wallet.balance + v_order.xu_used,
            'order', v_order.id, 'Hoàn xu do hủy đơn tự động'
          );
        END IF;
        IF COALESCE(v_order.xu_bonus_used, 0) > 0 THEN
          INSERT INTO transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, note)
          VALUES (
            v_wallet.id, 'refund', v_order.xu_bonus_used,
            v_wallet.bonus_balance + v_order.xu_bonus_used,
            'order', v_order.id, 'Hoàn xu thưởng do hủy đơn tự động'
          );
        END IF;

        v_xu_refunded := v_xu_refunded + COALESCE(v_order.xu_used, 0) + COALESCE(v_order.xu_bonus_used, 0);
      END IF;
    END IF;

    -- Thông báo in-app cho khách (push notification sẽ thấy khi mở app)
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_order.customer_id, 'order',
      'Đơn hàng đã bị hủy',
      'Đơn ' || to_char(v_order.total_amount, 'FM999G999G999') || 'đ đã bị hủy tự động.',
      jsonb_build_object('cancelled', true, 'order_id', v_order.id, 'url', '/orders')
    )
    ON CONFLICT DO NOTHING;

  END LOOP;

  RETURN jsonb_build_object('cancelled', v_cancelled, 'xu_refunded', v_xu_refunded, 'ran_at', now());
END;
$$;


-- ════════════════════════════════════════════════
-- 6. FUNCTION: sync_shop_hours_job
-- Cập nhật is_open theo giờ thực — chạy bởi pg_cron
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_shop_hours_job()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_shop        RECORD;
  v_oh          JSONB;
  v_entry       JSONB;
  v_day_names   TEXT[] := ARRAY['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  v_vn_now      TIMESTAMPTZ;
  v_vn_min      INT;
  v_today       TEXT;
  v_open_min    INT;
  v_close_min   INT;
  v_should_open BOOLEAN;
  v_updated     INT := 0;
  v_checked     INT := 0;
BEGIN
  -- Giờ hiện tại UTC+7
  v_vn_now  := now() AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_vn_min  := EXTRACT(HOUR FROM v_vn_now)::INT * 60 + EXTRACT(MINUTE FROM v_vn_now)::INT;
  v_today   := v_day_names[EXTRACT(DOW FROM v_vn_now)::INT + 1];

  FOR v_shop IN
    SELECT id, is_open, opening_hours FROM shops WHERE status = 'approved'
  LOOP
    v_oh := v_shop.opening_hours;
    IF v_oh IS NULL THEN CONTINUE; END IF;

    v_checked := v_checked + 1;
    v_should_open := NULL;

    -- Format mới: mảng DayHours [{day, open, slots:[{from,to}]}]
    IF jsonb_typeof(v_oh) = 'array' THEN
      v_entry := NULL;
      SELECT value INTO v_entry FROM jsonb_array_elements(v_oh) AS value
      WHERE value->>'day' = v_today LIMIT 1;

      IF v_entry IS NULL OR NOT (v_entry->>'open')::BOOLEAN THEN
        v_should_open := FALSE;
      ELSE
        -- Kiểm tra từng slot
        v_should_open := FALSE;
        FOR v_entry IN SELECT value FROM jsonb_array_elements(v_entry->'slots') AS value
        LOOP
          v_open_min  := (SPLIT_PART(v_entry->>'from', ':', 1)::INT) * 60
                       + (SPLIT_PART(v_entry->>'from', ':', 2)::INT);
          v_close_min := (SPLIT_PART(v_entry->>'to',   ':', 1)::INT) * 60
                       + (SPLIT_PART(v_entry->>'to',   ':', 2)::INT);
          IF v_close_min > v_open_min THEN
            -- Không qua đêm
            IF v_vn_min >= v_open_min AND v_vn_min < v_close_min THEN
              v_should_open := TRUE; EXIT;
            END IF;
          ELSE
            -- Qua đêm (ví dụ 22:00–02:00)
            IF v_vn_min >= v_open_min OR v_vn_min < v_close_min THEN
              v_should_open := TRUE; EXIT;
            END IF;
          END IF;
        END LOOP;
      END IF;

    -- Format cũ: {open: "HH:MM", close: "HH:MM"}
    ELSIF jsonb_typeof(v_oh) = 'object' AND v_oh ? 'open' AND v_oh ? 'close' THEN
      v_open_min  := (SPLIT_PART(v_oh->>'open',  ':', 1)::INT) * 60
                   + (SPLIT_PART(v_oh->>'open',  ':', 2)::INT);
      v_close_min := (SPLIT_PART(v_oh->>'close', ':', 1)::INT) * 60
                   + (SPLIT_PART(v_oh->>'close', ':', 2)::INT);
      IF v_close_min > v_open_min THEN
        v_should_open := v_vn_min >= v_open_min AND v_vn_min < v_close_min;
      ELSE
        v_should_open := v_vn_min >= v_open_min OR v_vn_min < v_close_min;
      END IF;
    END IF;

    IF v_should_open IS NOT NULL AND v_should_open != v_shop.is_open THEN
      UPDATE shops SET is_open = v_should_open, updated_at = now()
      WHERE id = v_shop.id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('checked', v_checked, 'updated', v_updated, 'ran_at', now());
END;
$$;


-- ════════════════════════════════════════════════
-- 7. ĐĂNG KÝ CRON JOBS
-- ════════════════════════════════════════════════

-- Xóa job cũ nếu tồn tại (idempotent)
SELECT cron.unschedule('cancel-pending-orders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cancel-pending-orders'
);
SELECT cron.unschedule('sync-shop-hours') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-shop-hours'
);

-- Hủy đơn quá hạn: chạy mỗi 5 phút
SELECT cron.schedule(
  'cancel-pending-orders',
  '*/5 * * * *',
  $$ SELECT cancel_pending_orders_job(); $$
);

-- Đồng bộ giờ mở cửa: chạy mỗi 10 phút
SELECT cron.schedule(
  'sync-shop-hours',
  '*/10 * * * *',
  $$ SELECT sync_shop_hours_job(); $$
);


-- ════════════════════════════════════════════════
-- 8. INDEX HỖ TRỢ CRON (nếu chưa có)
-- ════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_orders_pending_cron
  ON orders(created_at)
  WHERE status = 'pending' AND cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shops_cron
  ON shops(status)
  WHERE status = 'approved';
