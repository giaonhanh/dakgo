-- Storage policies — cho phép authenticated users upload vào tất cả bucket của app
-- Chạy 1 lần trong Supabase SQL Editor

-- INSERT: user đã đăng nhập được upload
CREATE POLICY "allow_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN (
    'shops', 'product-images', 'avatars',
    'review-photos', 'notification-images', 'banners'
  ));

-- SELECT: public đọc được (bucket public)
CREATE POLICY "allow_public_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN (
    'shops', 'product-images', 'avatars',
    'review-photos', 'notification-images', 'banners'
  ));

-- UPDATE: user đã đăng nhập update được (upsert)
CREATE POLICY "allow_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN (
    'shops', 'product-images', 'avatars',
    'review-photos', 'notification-images', 'banners'
  ));

-- DELETE: user đã đăng nhập xóa được
CREATE POLICY "allow_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN (
    'shops', 'product-images', 'avatars',
    'review-photos', 'notification-images', 'banners'
  ));
