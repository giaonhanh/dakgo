-- Dispatch theo "wave": gửi đồng thời cho 2 tài xế gần nhất.
-- Nếu cả 2 đều từ chối (hoặc hết 30s không phản hồi → tự động từ chối ở client),
-- mới gửi tiếp wave kế tiếp cho 2 tài xế gần hơn tiếp theo (loại trừ tất cả đã thử).

-- Bảng lưu wave hiện tại của mỗi đơn/chuyến/errand đang chờ phản hồi
CREATE TABLE IF NOT EXISTS dispatch_waves (
  order_table TEXT NOT NULL,
  order_id    UUID NOT NULL,
  driver_ids  UUID[] NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (order_table, order_id)
);

-- RPC: lấy N tài xế gần nhất, loại trừ danh sách đã thử
CREATE OR REPLACE FUNCTION dispatch_nearest_drivers(
  ref_lat     DOUBLE PRECISION,
  ref_lng     DOUBLE PRECISION,
  exclude_ids UUID[] DEFAULT '{}',
  limit_n     INT DEFAULT 2
) RETURNS SETOF UUID
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
  LIMIT limit_n;
$$;
