const SERVICES_KEY = process.env.NEXT_PUBLIC_VIETMAP_SERVICES_KEY

/** Reverse geocode dùng VietMap, fallback Nominatim */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Thử VietMap trước
  try {
    const res = await fetch(
      `https://maps.vietmap.vn/api/reverse?apikey=${SERVICES_KEY}&lat=${lat}&lng=${lng}`,
      { headers: { Accept: "application/json" } }
    )
    if (res.ok) {
      const data = await res.json()
      // VietMap có thể trả array hoặc object
      const item = Array.isArray(data) ? data[0] : data
      const addr = item?.display || item?.address || item?.name || ""
      if (addr) return addr
    }
  } catch { /* fallback */ }

  // Fallback Nominatim
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "vi" } }
    )
    const data = await res.json()
    if (data.display_name) {
      return (data.display_name as string).split(", ").slice(0, -1).join(", ")
    }
  } catch { /* ignore */ }

  return ""
}

/** Lấy khoảng cách km theo cung đường thực từ VietMap, fallback haversine */
export async function getRouteKm(
  fromLat: number, fromLng: number,
  toLat: number,   toLng: number,
): Promise<number> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(
      `https://maps.vietmap.vn/api/route?api-version=1.1&apikey=${SERVICES_KEY}` +
      `&point=${fromLat},${fromLng}&point=${toLat},${toLng}&vehicle=bike&optimize=false`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    if (res.ok) {
      const data = await res.json()
      const meters = data?.paths?.[0]?.distance
      if (typeof meters === "number" && meters > 0) return meters / 1000
    }
  } catch { /* fallback */ }

  return haversineKm(fromLat, fromLng, toLat, toLng)
}

/** Tính phí giao hàng theo km cung đường */
export function calcDeliveryFee(km: number): number {
  if (km <= 1) return 10000
  if (km <= 3) return 10000 + Math.round((km - 1) * 5000)
  return 20000 + Math.round((km - 3) * 3500)
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
