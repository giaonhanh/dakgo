import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Admin client để bypass RLS khi gán tài xế
function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    // Chỉ admin hoặc system mới được dispatch
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 })
    }

    const { order_id, order_lat, order_lng } = await req.json()
    if (!order_id || order_lat == null || order_lng == null) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    const admin = adminClient()

    // Tìm tài xế online gần nhất
    const { data: driverId, error: rpcErr } = await admin.rpc("find_nearest_driver", {
      order_lat,
      order_lng,
      max_distance_km: 5,
    })

    if (rpcErr || !driverId) {
      return NextResponse.json({ error: "Không tìm thấy tài xế phù hợp" }, { status: 404 })
    }

    // Gán tài xế cho đơn
    const { error: updateErr } = await admin
      .from("orders")
      .update({ driver_id: driverId, accepted_at: new Date().toISOString() })
      .eq("id", order_id)

    if (updateErr) return NextResponse.json({ error: "Gán tài xế thất bại" }, { status: 500 })

    return NextResponse.json({ driverId })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
