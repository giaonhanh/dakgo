/**
 * Layer 7: Geo Engine
 * Primary: VietMap (chính xác địa danh Việt Nam)
 * Fallback: Nominatim → Phước An default
 */

export interface LatLng { lat: number; lng: number }

const PHUOC_AN: LatLng = { lat: 12.4383, lng: 108.1476 }
const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_SERVICES_KEY

export async function geocodeAddress(address: string): Promise<LatLng> {
  if (VIETMAP_KEY) {
    try {
      const r = await vietmapGeocode(address)
      if (r) return r
    } catch (e) {
      console.warn("[geo] VietMap err:", (e as Error).message?.slice(0, 60))
    }
  }
  try {
    const r = await nominatimGeocode(address)
    if (r) return r
  } catch (e) {
    console.warn("[geo] Nominatim err:", (e as Error).message?.slice(0, 60))
  }
  console.warn("[geo] fallback Phuoc An for:", address)
  return PHUOC_AN
}

async function vietmapGeocode(address: string): Promise<LatLng | null> {
  // Bước 1: autocomplete → lấy ref_id
  const q = encodeURIComponent(`${address}, Phước An, Krông Pắc, Đắk Lắk`)
  const autoUrl = `https://maps.vietmap.vn/api/autocomplete/v3?apikey=${VIETMAP_KEY}&text=${q}&focus.point.lat=${PHUOC_AN.lat}&focus.point.lon=${PHUOC_AN.lng}`

  const autoRes = await fetch(autoUrl, {
    headers: { Accept: "application/json" },
    signal:  AbortSignal.timeout(4000),
  })
  if (!autoRes.ok) return null

  const autoData = await autoRes.json() as Array<{ ref_id?: string; display?: string }>
  const refId = autoData[0]?.ref_id
  if (!refId) return null

  // Bước 2: place detail → lat/lng
  const placeUrl = `https://maps.vietmap.vn/api/place/v3?apikey=${VIETMAP_KEY}&refid=${refId}`
  const placeRes = await fetch(placeUrl, {
    headers: { Accept: "application/json" },
    signal:  AbortSignal.timeout(4000),
  })
  if (!placeRes.ok) return null

  const place = await placeRes.json() as { lat?: number; lng?: number }
  if (place.lat && place.lng) return { lat: place.lat, lng: place.lng }
  return null
}

async function nominatimGeocode(address: string): Promise<LatLng | null> {
  const q   = encodeURIComponent(`${address}, Phước An, Krông Pắc, Đắk Lắk, Việt Nam`)
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=vn`,
    { headers: { "User-Agent": "DakGo-Bot/1.0 (dakgo.com)" }, signal: AbortSignal.timeout(5000) },
  )
  if (!res.ok) return null
  const data = await res.json() as Array<{ lat: string; lon: string }>
  if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  return null
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const R    = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
