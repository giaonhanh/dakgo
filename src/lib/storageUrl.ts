/**
 * Utility chuyển đổi Supabase public URL → signed URL có thời hạn.
 * Không cần đổi DB schema — parse URL để lấy bucket + path, rồi tạo signed URL.
 *
 * Public URL format:
 *   {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
 * Signed URL format:
 *   {SUPABASE_URL}/storage/v1/object/sign/{bucket}/{path}?token=...
 */

import type { SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/`

/** Danh sách bucket chứa dữ liệu nhạy cảm — cần signed URL */
const PRIVATE_BUCKETS = new Set(["avatars", "review-photos", "delivery-photos"])

export function isSupabaseStorageUrl(url: string): boolean {
  return url.startsWith(STORAGE_PREFIX)
}

/** Parse bucket và path từ public URL */
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (!url.startsWith(STORAGE_PREFIX)) return null
  const rest = url.slice(STORAGE_PREFIX.length)
  const slash = rest.indexOf("/")
  if (slash === -1) return null
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) }
}

/** Chỉ tạo signed URL cho private buckets — public bucket trả về URL gốc */
export async function toSignedUrl(
  supabase: SupabaseClient,
  url: string,
  expiresIn = 3600,
): Promise<string> {
  if (!url) return url
  const parsed = parseStorageUrl(url)
  if (!parsed) return url                              // URL bên ngoài — giữ nguyên
  if (!PRIVATE_BUCKETS.has(parsed.bucket)) return url  // Public bucket — không cần sign

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresIn)

  return error || !data?.signedUrl ? url : data.signedUrl
}
