-- ============================================================
-- Chat messages between customer and driver per order
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(id),
  role       TEXT NOT NULL CHECK (role IN ('customer', 'driver')),
  content    TEXT NOT NULL CHECK (char_length(content) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_order ON chat_messages(order_id, created_at ASC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Only the customer or assigned driver of the order can read/write
CREATE POLICY "chat_order_parties" ON chat_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = chat_messages.order_id
        AND (o.customer_id = auth.uid() OR o.driver_id = auth.uid())
    )
  );
