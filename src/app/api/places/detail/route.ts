import { NextRequest, NextResponse } from "next/server"

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const placeId     = searchParams.get("placeId") ?? ""
  const sessionToken = searchParams.get("sessionToken") ?? ""
  const fieldMask   = "id,location,formattedAddress,addressComponents"

  const url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=vi&sessionToken=${sessionToken}`
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key":   GOOGLE_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
