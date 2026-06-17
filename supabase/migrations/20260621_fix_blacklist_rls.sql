-- Bảo đảm RLS cho bảng blacklist có policy cho admin
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

-- Xoá policy cũ nếu có
DROP POLICY IF EXISTS "blacklist_admin_all"    ON blacklist;
DROP POLICY IF EXISTS "blacklist_own_select"   ON blacklist;

-- Admin xem và quản lý toàn bộ
CREATE POLICY "blacklist_admin_all" ON blacklist
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- User tự xem trạng thái của mình
CREATE POLICY "blacklist_own_select" ON blacklist
  FOR SELECT USING (auth.uid() = user_id);
