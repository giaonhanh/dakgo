import { NextRequest, NextResponse } from "next/server"

const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_SERVICES_KEY ?? ""

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { origin, destination } = body
  const fromLat = origin?.location?.latLng?.latitude
  const fromLng = origin?.location?.latLng?.longitude
  const toLat   = destination?.location?.latLng?.latitude
  const toLng   = destination?.location?.latLng?.longitude

  const url = `https://maps.vietmap.vn/api/route?apikey=${VIETMAP_KEY}&point=${fromLat},${fromLng}&point=${toLat},${toLng}&vehicle=car&type=json`
  const res = await fetch(url)
  const data = await res.json()
  // Normalize to same shape callers expect: { routes: [{ distanceMeters }] }
  const meters = data?.paths?.[0]?.distance ?? 0
  return NextResponse.json({ routes: [{ distanceMeters: meters }] }, { status: res.status })
}
