/**
 * Layer 7: Geo Engine
 * Geocoding địa chỉ → tọa độ (Nominatim free API)
 * Fallback: tọa độ trung tâm Phước An, Krông Pắc
 */

export interface LatLng { lat: number; lng: number }

// Trung tâm thị trấn Phước An, Krông Pắc, Đắk Lắk
const PHUOC_AN_DEFAULT: LatLng = { lat: 12.4383, lng: 108.1476 }

export async function geocodeAddress(address: string): Promise<LatLng> {
  // Append local context để tăng độ chính xác
  const query = encodeURIComponent(`${address}, Phước An, Krông Pắc, Đắk Lắk, Việt Nam`)

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=vn`,
      {
        headers: { "User-Agent": "DakGo-Bot/1.0 (dakgo.com)" },
        signal:  AbortSignal.timeout(5000),
      },
    )
    if (!res.ok) throw new Error(`nominatim ${res.status}`)
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch (e) {
    console.warn("[geo] geocode fallback for:", address, (e as Error).message?.slice(0, 50))
  }

  return PHUOC_AN_DEFAULT
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
