-- ============================================================
-- Fix: sync profiles từ auth.users + sửa trigger
-- Chạy trong Supabase SQL Editor — idempotent, an toàn chạy lại
-- ============================================================

-- 1. Sửa trigger xử lý đăng ký bằng email (phone = NULL)
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  v_phone TEXT;
  v_name  TEXT;
BEGIN
  -- Ưu tiên phone, fallback lấy phần trước @ của email
  v_phone := COALESCE(
    NULLIF(TRIM(NEW.phone), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'user_' || substr(NEW.id::text, 1, 8)
  );
  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    v_phone
  );

  INSERT INTO profiles (id, phone, full_name, role)
  VALUES (NEW.id, v_phone, v_name, 'customer')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Đồng bộ auth.users đã tồn tại mà chưa có profile
INSERT INTO profiles (id, phone, full_name, role)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.phone), ''),
    NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
    'user_' || substr(u.id::text, 1, 8)
  ) AS phone,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
    'Người dùng'
  ) AS full_name,
  'customer' AS role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- 3. Sau khi chạy xong, set role admin cho tài khoản của bạn:
--    UPDATE profiles SET role = 'admin' WHERE phone = '0848612712';
--    (thay số điện thoại bằng số của tài khoản admin thực tế)
