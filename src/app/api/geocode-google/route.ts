// API: GET /api/geocode-google?latlng=12.7107,108.3034
// Reverse geocode bằng Google Geocoding API — chính xác hơn VietMap cho số nhà
// Fallback về VietMap nếu Google không trả kết quả

import { NextRequest, NextResponse } from "next/server"

const GOOGLE_KEY   = process.env.GOOGLE_MAPS_SERVER_KEY ?? ""
const VIETMAP_KEY  = process.env.NEXT_PUBLIC_VIETMAP_SERVICES_KEY ?? ""

async function googleReverseGeocode(lat: string, lng: string): Promise<string | null> {
  if (!GOOGLE_KEY) return null
  try {
    const res  = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=vi&region=VN&key=${GOOGLE_KEY}`,
      { signal: AbortSignal.timeout(6000) },
    )
    const data = await res.json() as {
      status:  string
      results: Array<{ formatted_address: string; types: string[] }>
    }
    if (data.status !== "OK" || !data.results?.length) return null

    // Ưu tiên kết quả có street_address hoặc premise (có số nhà)
    const best =
      data.results.find(r => r.types.includes("street_address") || r.types.includes("premise")) ??
      data.results[0]

    return best?.formatted_address ?? null
  } catch {
    return null
  }
}

async function vietmapReverseGeocode(lat: string, lng: string): Promise<string | null> {
  if (!VIETMAP_KEY) return null
  try {
    const res  = await fetch(
      `https://maps.vietmap.vn/api/reverse/v3?apikey=${VIETMAP_KEY}&lat=${lat}&lng=${lng}`,
      { signal: AbortSignal.timeout(5000) },
    )
    const data = await res.json() as Array<{ display?: string }>
    return data?.[0]?.display ?? null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const latlng = req.nextUrl.searchParams.get("latlng") ?? ""
  const [lat, lng] = latlng.split(",")
  if (!lat || !lng) return NextResponse.json({ error: "Missing latlng" }, { status: 400 })

  // Thử Google trước — chính xác hơn cho số nhà
  const googleAddr = await googleReverseGeocode(lat, lng)
  if (googleAddr) {
    return NextResponse.json({ address: googleAddr, source: "google" })
  }

  // Fallback VietMap
  const vietmapAddr = await vietmapReverseGeocode(lat, lng)
  if (vietmapAddr) {
    return NextResponse.json({ address: vietmapAddr, source: "vietmap" })
  }

  return NextResponse.json({ address: "", source: "none" }, { status: 200 })
}
