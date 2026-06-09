import { NextRequest, NextResponse } from "next/server"

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const latlng = searchParams.get("latlng") ?? ""
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng}&language=vi&key=${GOOGLE_KEY}`,
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
