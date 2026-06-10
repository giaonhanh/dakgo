import { NextRequest, NextResponse } from "next/server"

const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_SERVICES_KEY ?? ""

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get("placeId") ?? ""

  const url = `https://maps.vietmap.vn/api/place/v3?apikey=${VIETMAP_KEY}&refid=${encodeURIComponent(placeId)}`
  const res = await fetch(url)
  const data = await res.json()

  // Normalize to shape AddressPickerClient expects
  return NextResponse.json({
    location:         { latitude: data.lat ?? 0, longitude: data.lng ?? 0 },
    formattedAddress: data.display ?? "",
    addressComponents: [],
  }, { status: res.status })
}
