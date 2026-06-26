const GPS_CACHE_KEY = "gps_cache"

function readCachedGps(): { lat: number; lng: number; address: string } | null {
  if (typeof window === "undefined") return null
  try {
    const s = sessionStorage.getItem(GPS_CACHE_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function writeCachedGps(lat: number, lng: number, address: string) {
  try { sessionStorage.setItem(GPS_CACHE_KEY, JSON.stringify({ lat, lng, address })) } catch {}
}

export function getCachedGps() { return readCachedGps() }

export async function fetchGps(
  setLocation: (lat: number, lng: number, addr: string) => void,
  setDenied: () => void,
) {
  if (typeof navigator === "undefined" || !navigator.geolocation) { setDenied(); return }

  // Dùng cache ngay lập tức để UI hiển thị vị trí cũ trong khi chờ GPS mới
  const cached = readCachedGps()
  if (cached) setLocation(cached.lat, cached.lng, cached.address)

  // Nếu browser đã chặn vĩnh viễn → báo ngay, không hiện dialog trống
  try {
    const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName })
    if (perm.state === "denied") { setDenied(); return }
  } catch {
    // Safari không hỗ trợ permissions API — tiếp tục bình thường
  }

  // enableHighAccuracy: false → dùng WiFi/cell, nhanh hơn GPS chip
  // timeout: 8000 (giảm từ 15s) — thất bại nhanh hơn thay vì chờ lâu
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const { latitude: lat, longitude: lng } = coords
      try {
        const res  = await fetch(`/api/geocode?latlng=${lat},${lng}`)
        const data = await res.json()
        const address = (Array.isArray(data) ? data[0]?.display : null) ?? "Vị trí hiện tại"
        writeCachedGps(lat, lng, address)
        setLocation(lat, lng, address)
      } catch {
        setLocation(lat, lng, "Vị trí hiện tại")
      }
    },
    () => { if (!cached) setDenied() },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
  )
}
