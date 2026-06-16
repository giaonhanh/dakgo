-- Bang loyalty_points + point_transactions chua bao gio duoc tao tren DB thuc,
-- du code app da dung o nhieu trang (Loyalty, Wallet, Profile, Admin Users) va
-- trigger award_loyalty_points_on_delivery insert vao loyalty_points moi khi
-- don chuyen sang delivered. Thieu bang nay lam insert loi "relation does not
-- exist", rollback ca transaction UPDATE orders status=delivered -> tai xe
-- bam "Giao hang thanh cong" luon bi loi.

CREATE TABLE IF NOT EXISTS loyalty_points (
  user_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_points INT NOT NULL DEFAULT 0,
  tier         TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points     INT NOT NULL,
  reason     TEXT,
  ref_id     UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_point_tx_user ON point_transactions(user_id, created_at DESC);

ALTER TABLE loyalty_points     ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_points_own_select" ON loyalty_points;
CREATE POLICY "loyalty_points_own_select" ON loyalty_points
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "loyalty_points_admin_all" ON loyalty_points;
CREATE POLICY "loyalty_points_admin_all" ON loyalty_points
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "point_transactions_own_select" ON point_transactions;
CREATE POLICY "point_transactions_own_select" ON point_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "point_transactions_admin_all" ON point_transactions;
CREATE POLICY "point_transactions_admin_all" ON point_transactions
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
