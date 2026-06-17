-- Đảm bảo bảng withdrawals tồn tại đúng cấu trúc
CREATE TABLE IF NOT EXISTS withdrawals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_type  TEXT NOT NULL DEFAULT 'driver' CHECK (wallet_type IN ('driver','customer')),
  amount       INTEGER NOT NULL CHECK (amount > 0),
  bank_bin     TEXT NOT NULL DEFAULT '',
  bank_account TEXT NOT NULL,
  account_name TEXT,
  status       TEXT NOT NULL DEFAULT 'processing'
               CHECK (status IN ('processing','pending_transfer','transferred','failed','refunded')),
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chặn duplicate: mỗi user chỉ có 1 yêu cầu đang xử lý tại một thời điểm
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_one_pending
  ON withdrawals (user_id)
  WHERE status IN ('processing', 'pending_transfer');

CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user   ON withdrawals(user_id, created_at DESC);

-- RLS
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- User chỉ xem yêu cầu của chính mình
DROP POLICY IF EXISTS "withdrawals_own_select" ON withdrawals;
CREATE POLICY "withdrawals_own_select" ON withdrawals
  FOR SELECT USING (auth.uid() = user_id);

-- Admin xem và cập nhật tất cả
DROP POLICY IF EXISTS "withdrawals_admin_all" ON withdrawals;
CREATE POLICY "withdrawals_admin_all" ON withdrawals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
