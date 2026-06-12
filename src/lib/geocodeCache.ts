/**
 * Cache reverse geocode kết quả theo tọa độ làm tròn 3 chữ số (~100m accuracy).
 * Dùng sessionStorage — tự xóa khi đóng tab.
 * TTL 30 phút để tránh địa chỉ cũ khi người dùng di chuyển xa.
 */

const PREFIX  = "gc_"
const TTL_MS  = 30 * 60 * 1000 // 30 phút

interface CacheEntry {
  address: string
  ts:      number
}

function toKey(lat: number, lng: number): string {
  return `${PREFIX}${lat.toFixed(3)}_${lng.toFixed(3)}`
}

export function getCachedGeocode(lat: number, lng: number): string | null {
  try {
    const raw = sessionStorage.getItem(toKey(lat, lng))
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.ts > TTL_MS) {
      sessionStorage.removeItem(toKey(lat, lng))
      return null
    }
    return entry.address
  } catch {
    return null
  }
}

export function setCachedGeocode(lat: number, lng: number, address: string): void {
  try {
    const entry: CacheEntry = { address, ts: Date.now() }
    sessionStorage.setItem(toKey(lat, lng), JSON.stringify(entry))
  } catch { /* ignore quota errors */ }
}
