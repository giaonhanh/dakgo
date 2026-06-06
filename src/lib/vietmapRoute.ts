const SERVICES_KEY = process.env.NEXT_PUBLIC_VIETMAP_SERVICES_KEY

interface VietmapReverseItem {
  display?: string; name?: string; hs_num?: string
  street?: string; ward?: string; district?: string; city?: string
}

/** Reverse geocode v3 — trả về địa chỉ đầy đủ (số nhà, đường, phường, huyện, tỉnh) */
export async function reverseGeocodeStructured(lat: number, lng: number): Promise<{ address: string; houseNote: string }> {
  try {
    const res = await fetch(
      `https://maps.vietmap.vn/api/reverse/v3?apikey=${SERVICES_KEY}&lat=${lat}&lng=${lng}`,
      { headers: { Accept: "application/json" } }
    )
    if (res.ok) {
      const list = (await res.json()) as VietmapReverseItem[]
      const d = list[0]
      if (d) {
        const parts: string[] = []
        if (d.hs_num && d.street) parts.push(`${d.hs_num} ${d.street}`)
        else if (d.street)        parts.push(d.street)
        if (d.ward)               parts.push(d.ward)
        if (d.district)           parts.push(d.district)
        if (d.city)               parts.push(d.city)
        const address = parts.length > 0 ? parts.join(", ") : (d.display ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        return { address, houseNote: d.hs_num ? `Số ${d.hs_num}` : "" }
      }
    }
  } catch { /* fallback */ }
  return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, houseNote: "" }
}

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

/** Tính phí theo cấu hình admin (pricing.food từ app_settings) */
export function calcDeliveryFeeFromPricing(
  km: number,
  rows: string[],
  extra: string,
): number {
  const extraPrice = parseInt(extra) || 0

  const getPriceAt = (i: number): number => {
    const idx = Math.min(i, rows.length - 1)
    for (let j = idx; j >= 0; j--) {
      if (rows[j] && rows[j] !== "") return parseInt(rows[j]) || 0
    }
    return 0
  }

  // Tối thiểu 1km — tài xế luôn phải đến quán dù giao gần
  const effectiveKm = Math.max(km, 1)
  const wholeKm = Math.floor(effectiveKm)
  const fracKm  = effectiveKm - wholeKm
  let total = 0

  for (let i = 0; i < Math.min(wholeKm, 10); i++) total += getPriceAt(i)
  if (wholeKm > 10) total += (wholeKm - 10) * extraPrice

  if (fracKm > 0) {
    const fracPrice = wholeKm < 10 ? getPriceAt(wholeKm) : extraPrice
    total += Math.round(fracKm * fracPrice)
  }

  return total
}

/** Fallback nếu chưa load được cấu hình admin */
export function calcDeliveryFee(km: number): number {
  const k = Math.max(km, 1)
  if (k <= 1) return 10000
  if (k <= 3) return 10000 + Math.round((k - 1) * 5000)
  return 20000 + Math.round((k - 3) * 3500)
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
