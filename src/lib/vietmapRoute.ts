import { getCachedGeocode, setCachedGeocode } from "./geocodeCache"

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

interface GoogleAddressComponent {
  long_name:  string
  short_name: string
  types:      string[]
}

function parseComponents(components: GoogleAddressComponent[]) {
  const get = (...types: string[]) =>
    components.find(c => types.some(t => c.types.includes(t)))?.long_name ?? ""
  return {
    houseNumber: get("street_number"),
    street:      get("route"),
    ward:        get("sublocality_level_1", "sublocality"),
    district:    get("administrative_area_level_2"),
    city:        get("administrative_area_level_1"),
  }
}

/** Reverse geocode — trả về địa chỉ đầy đủ (số nhà, đường, phường, huyện, tỉnh) */
export async function reverseGeocodeStructured(lat: number, lng: number): Promise<{ address: string; houseNote: string }> {
  const cached = getCachedGeocode(lat, lng)
  if (cached) return { address: cached, houseNote: "" }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=vi&key=${GOOGLE_KEY}`,
    )
    if (res.ok) {
      const data = await res.json()
      const result = data.results?.[0]
      if (result) {
        const c = parseComponents(result.address_components ?? [])
        const parts: string[] = []
        if (c.houseNumber && c.street) parts.push(`${c.houseNumber} ${c.street}`)
        else if (c.street)             parts.push(c.street)
        if (c.ward)                    parts.push(c.ward)
        if (c.district)                parts.push(c.district)
        if (c.city)                    parts.push(c.city)
        const address = parts.length > 0 ? parts.join(", ") : result.formatted_address
        setCachedGeocode(lat, lng, address)
        return { address, houseNote: c.houseNumber ? `Số ${c.houseNumber}` : "" }
      }
    }
  } catch { /* fallback */ }
  return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, houseNote: "" }
}

/** Reverse geocode — trả về chuỗi địa chỉ đơn giản */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const cached = getCachedGeocode(lat, lng)
  if (cached) return cached

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=vi&key=${GOOGLE_KEY}`,
    )
    if (res.ok) {
      const data = await res.json()
      const addr = data.results?.[0]?.formatted_address
      if (addr) { setCachedGeocode(lat, lng, addr); return addr }
    }
  } catch { /* fallback */ }
  return ""
}

/** Lấy khoảng cách km theo cung đường thực — dùng Google Routes API */
export async function getRouteKm(
  fromLat: number, fromLng: number,
  toLat: number,   toLng: number,
): Promise<number> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY ?? "",
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      body: JSON.stringify({
        origin:      { location: { latLng: { latitude: fromLat, longitude: fromLng } } },
        destination: { location: { latLng: { latitude: toLat,   longitude: toLng   } } },
        travelMode:  "DRIVE",
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (res.ok) {
      const data = await res.json()
      const meters: number = data?.routes?.[0]?.distanceMeters
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
