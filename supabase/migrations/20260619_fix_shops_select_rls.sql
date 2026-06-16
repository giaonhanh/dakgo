-- RLS SELECT hien tai tren shops dang chi cho phep xem quan dang is_open=true
-- (khong khop voi schema.sql ghi "USING (true)") -> khach hang KHONG THAY duoc
-- quan da dong cua o section "Quan gan ban" / "Xem tat ca" du frontend co
-- code hien thi quan dong (mo, khoa icon) - vi RLS da loc mat truoc khi tra
-- ve cho client. Sua lai: cho xem TAT CA quan status='approved' bat ke is_open,
-- giu nguyen quyen quan ly (insert/update/delete) chi cho owner/admin.

DROP POLICY IF EXISTS "shops_select_open" ON shops;
DROP POLICY IF EXISTS "shops_select_approved" ON shops;

CREATE POLICY "shops_select_approved" ON shops
  FOR SELECT
  USING (
    status = 'approved'
    OR auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
