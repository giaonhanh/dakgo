-- DakGo AI Chat — Tables & RPC functions
-- Run this in Supabase SQL Editor

-- Enable pg_trgm for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Chat Sessions (anonymous, no auth required) ──────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key     TEXT        UNIQUE NOT NULL,  -- UUID stored in client localStorage
  context         JSONB       NOT NULL DEFAULT '{}',
  message_count   INT         NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_key ON chat_sessions(session_key);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_ts  ON chat_sessions(last_message_at DESC);

-- ─── Chat Messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at DESC);

-- ─── Fuzzy Search: Products ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_products_fuzzy(
  query          TEXT,
  min_similarity FLOAT DEFAULT 0.12
)
RETURNS TABLE (
  id         UUID,
  name       TEXT,
  price      INT,
  shop_id    UUID,
  shop_name  TEXT,
  is_open    BOOLEAN,
  image_url  TEXT,
  similarity FLOAT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.name,
    p.price,
    p.shop_id,
    s.name        AS shop_name,
    s.is_open,
    p.image_url,
    similarity(p.name, query) AS similarity
  FROM products p
  JOIN shops s ON s.id = p.shop_id
  WHERE s.status = 'approved'
    AND p.is_available = TRUE
    AND similarity(p.name, query) > min_similarity
  ORDER BY similarity(p.name, query) DESC
  LIMIT 10;
$$;

-- ─── Fuzzy Search: Shops ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_shops_fuzzy(
  query          TEXT,
  min_similarity FLOAT DEFAULT 0.12
)
RETURNS TABLE (
  id              UUID,
  name            TEXT,
  category        TEXT,
  is_open         BOOLEAN,
  cover_image_url TEXT,
  logo_url        TEXT,
  rating_avg      NUMERIC,
  similarity      FLOAT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    id,
    name,
    category,
    is_open,
    cover_image_url,
    logo_url,
    rating_avg,
    similarity(name, query) AS similarity
  FROM shops
  WHERE status = 'approved'
    AND similarity(name, query) > min_similarity
  ORDER BY similarity(name, query) DESC
  LIMIT 5;
$$;

-- ─── RLS: chat_sessions & chat_messages PUBLIC (no auth required for chatbot) ──
-- Service role key bypasses RLS, so chatbot API route works fine.
-- If you want to restrict: enable RLS but allow anon SELECT/INSERT with session_key check.
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow API routes (service role) to bypass RLS — no extra policy needed.
-- Public read policy (optional — for debugging):
-- CREATE POLICY "public_chat" ON chat_sessions FOR ALL USING (true);
