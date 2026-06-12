import { NextResponse } from "next/server"

const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ?? ""
const STYLE_URL   = `https://maps.vietmap.vn/mt/tm/style.json?apikey=${VIETMAP_KEY}`

// Fetch style.json từ VietMap, replace tile URL → proxy /api/vt để tránh CORS
export async function GET() {
  const res = await fetch(STYLE_URL, { next: { revalidate: 3600 } })
  if (!res.ok) return new NextResponse(null, { status: res.status })

  const style = await res.json()

  // Replace tile URLs trong sources → dùng proxy /api/vt
  if (style.sources) {
    for (const src of Object.values(style.sources) as any[]) {
      if (src.tiles) {
        src.tiles = src.tiles.map(() => "/api/vt/{z}/{x}/{y}")
      }
    }
  }

  return NextResponse.json(style, {
    headers: { "Cache-Control": "public, max-age=3600" },
  })
}
