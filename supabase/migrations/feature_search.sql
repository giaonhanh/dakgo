-- ============================================================
-- pg_trgm fuzzy search for products and shops
-- Run in Supabase SQL Editor (requires superuser / pg_trgm extension)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for trigram similarity
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shops_name_trgm    ON shops    USING gin(name gin_trgm_ops);

-- Check which columns exist in shops before indexing
-- If shops.category exists in your DB, uncomment the line below:
-- CREATE INDEX IF NOT EXISTS idx_shops_cat_trgm ON shops USING gin(category gin_trgm_ops);

-- RPC: search_catalog — returns ranked products + shops
-- Uses pg_trgm similarity + ILIKE; category column removed from shops
-- since it may not exist in all deployments
CREATE OR REPLACE FUNCTION search_catalog(query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  products_result JSONB;
  shops_result    JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(r ORDER BY r.score DESC, r.sold_count DESC), '[]'::jsonb)
  INTO products_result
  FROM (
    SELECT
      p.id, p.name, p.price, p.original_price, p.image_url, p.sold_count, p.shop_id,
      s.name  AS shop_name,
      GREATEST(similarity(p.name, query), 0) AS score
    FROM products p
    JOIN shops s ON s.id = p.shop_id
    WHERE p.is_available = true
      AND s.status = 'approved'
      AND (
        p.name ILIKE '%' || query || '%'
        OR similarity(p.name, query) > 0.15
      )
    LIMIT 20
  ) r;

  SELECT COALESCE(jsonb_agg(r ORDER BY r.score DESC, r.rating_avg DESC), '[]'::jsonb)
  INTO shops_result
  FROM (
    SELECT
      s.id, s.name, s.logo_url, s.rating_avg, s.is_open,
      GREATEST(similarity(s.name, query), 0) AS score
    FROM shops s
    WHERE s.status = 'approved'
      AND (
        s.name ILIKE '%' || query || '%'
        OR similarity(s.name, query) > 0.15
      )
    LIMIT 10
  ) r;

  RETURN jsonb_build_object('products', products_result, 'shops', shops_result);
END;
$$;
