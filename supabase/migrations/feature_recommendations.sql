-- ============================================================
-- Smart recommendations based on user order history
-- Run in Supabase SQL Editor
-- ============================================================

-- RPC: get_recommendations — top products from shops the user orders from most
CREATE OR REPLACE FUNCTION get_recommendations(uid UUID, lim INTEGER DEFAULT 10)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  price         INTEGER,
  original_price INTEGER,
  image_url     TEXT,
  sold_count    INTEGER,
  shop_id       UUID,
  shop_name     TEXT,
  order_count   BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id, p.name, p.price, p.original_price, p.image_url, p.sold_count,
    p.shop_id, s.name AS shop_name,
    sc.cnt AS order_count
  FROM products p
  JOIN shops s ON s.id = p.shop_id
  JOIN (
    -- Top shops this user orders from, ranked by frequency
    SELECT shop_id, COUNT(*) AS cnt
    FROM orders
    WHERE customer_id = uid AND status = 'delivered'
    GROUP BY shop_id
    ORDER BY cnt DESC
    LIMIT 5
  ) sc ON sc.shop_id = p.shop_id
  WHERE p.is_available = true
  ORDER BY p.id, sc.cnt DESC, p.sold_count DESC
  LIMIT lim;
END;
$$;
