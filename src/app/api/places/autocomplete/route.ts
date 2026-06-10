import { NextRequest, NextResponse } from "next/server"

const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_SERVICES_KEY ?? ""

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { input, locationBias } = body
  const lat = locationBias?.circle?.center?.latitude ?? 12.71
  const lng = locationBias?.circle?.center?.longitude ?? 108.30

  const url = `https://maps.vietmap.vn/api/autocomplete/v3?apikey=${VIETMAP_KEY}&text=${encodeURIComponent(input)}&focus.point.lat=${lat}&focus.point.lon=${lng}`
  const res = await fetch(url)
  const data = await res.json()

  // Normalize to shape AddressPickerClient expects
  const suggestions = (Array.isArray(data) ? data : []).slice(0, 6).map((item: {
    ref_id?: string; name?: string; address?: string; display?: string
  }) => ({
    placePrediction: {
      placeId: item.ref_id ?? "",
      structuredFormat: {
        mainText:      { text: item.name ?? item.display ?? "" },
        secondaryText: { text: item.address ?? "" },
      },
    },
  }))
  return NextResponse.json({ suggestions })
}
