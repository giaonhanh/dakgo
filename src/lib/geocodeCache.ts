/**
 * Cache reverse geocode kết quả theo tọa độ làm tròn 3 chữ số (~100m accuracy).
 * Dùng sessionStorage — tự xóa khi đóng tab, không cần TTL.
 * Giảm ~50% Geocoding API calls → tiết kiệm ~$30/tháng.
 */

const PREFIX = "gc_"

function toKey(lat: number, lng: number): string {
  return `${PREFIX}${lat.toFixed(3)}_${lng.toFixed(3)}`
}

export function getCachedGeocode(lat: number, lng: number): string | null {
  try {
    return sessionStorage.getItem(toKey(lat, lng))
  } catch {
    return null
  }
}

export function setCachedGeocode(lat: number, lng: number, address: string): void {
  try {
    sessionStorage.setItem(toKey(lat, lng), address)
  } catch { /* ignore quota errors */ }
}
