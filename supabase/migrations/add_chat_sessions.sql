-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Thêm bảng chat_sessions cho DakGo Messenger Bot
-- Chạy 1 lần trong Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- Bảng session đặt hàng qua Messenger Bot
CREATE TABLE IF NOT EXISTS chat_sessions (
  sender_id       TEXT PRIMARY KEY,                         -- Facebook sender_id
  state           TEXT NOT NULL DEFAULT 'idle',             -- idle|collecting|confirming|creating_order|order_created|escalated
  intent          TEXT,                                     -- food_order|deliver_for_me|buy_for_me|motorbike|taxi|taxi7
  collected_data  JSONB NOT NULL DEFAULT '{}',              -- structured data đang thu thập
  confusion_count INTEGER NOT NULL DEFAULT 0,               -- đếm số lần AI không hiểu → escalate
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index để query session theo thời gian (cleanup cũ)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated
  ON chat_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_state
  ON chat_sessions(state);

-- RLS: chỉ service role key mới access (bot dùng service role)
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Bảng bot_conversations đã tồn tại — chỉ thêm nếu chưa có
CREATE TABLE IF NOT EXISTS bot_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'model'
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_conv_sender
  ON bot_conversations(sender_id, created_at DESC);

-- Bảng log block (nếu chưa có)
CREATE TABLE IF NOT EXISTS bot_blocked_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id  TEXT NOT NULL,
  message    TEXT NOT NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_blocked_sender
  ON bot_blocked_logs(sender_id, created_at DESC);
