import { NextRequest, NextResponse } from "next/server"

const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ?? ""

// Proxy vector tiles → tránh CORS từ browser
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ coords: string[] }> },
) {
  const { coords } = await params
  if (coords.length !== 3) return new NextResponse(null, { status: 400 })

  const [z, x, y] = coords
  const tileUrl = `https://maps.vietmap.vn/mt/tile/data-20250529/${z}/${x}/${y}?apikey=${VIETMAP_KEY}`

  try {
    const res = await fetch(tileUrl, { next: { revalidate: 86400 } })
    if (!res.ok) return new NextResponse(null, { status: res.status })

    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      headers: {
        "Content-Type":  "application/x-protobuf",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
