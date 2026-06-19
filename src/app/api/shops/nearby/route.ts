import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const lat      = parseFloat(searchParams.get("lat") ?? "")
    const lng      = parseFloat(searchParams.get("lng") ?? "")
    const radius   = parseFloat(searchParams.get("radius_km") ?? "10")
    const limit    = parseInt(searchParams.get("limit") ?? "20", 10)

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "Thiếu tọa độ lat/lng" }, { status: 400 })
    }

    const { data: shops, error } = await supabase.rpc("get_nearby_shops", {
      user_lat:  lat,
      user_lng:  lng,
      radius_km: radius,
      limit_n:   limit,
    })

    if (error) return NextResponse.json({ error: "Không thể tải quán gần đây" }, { status: 500 })

    return NextResponse.json(shops ?? [], {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
