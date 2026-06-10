import { NextRequest, NextResponse } from "next/server"

const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_SERVICES_KEY ?? ""

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const latlng = searchParams.get("latlng") ?? ""
  const [lat, lng] = latlng.split(",")
  const res = await fetch(
    `https://maps.vietmap.vn/api/reverse/v3?apikey=${VIETMAP_KEY}&lat=${lat}&lng=${lng}`,
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
