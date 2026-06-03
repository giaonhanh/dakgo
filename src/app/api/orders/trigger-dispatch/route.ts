import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Gọi sau khi tạo đơn để tự động tìm tài xế gần nhất
// Nếu không có tài xế → driver tự nhận từ dashboard — không phải lỗi critical
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { order_id } = await req.json()
    if (!order_id) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 })

    const db = adminDb()

    // Lấy tọa độ đơn hàng — xác minh đơn thuộc về user
    const { data: order } = await db
      .from("orders")
      .select("id, delivery_lat, delivery_lng, driver_id, status, customer_id")
      .eq("id", order_id)
      .eq("customer_id", user.id)
      .single()

    if (!order) return NextResponse.json({ error: "Đơn không tồn tại" }, { status: 404 })

    // Không dispatch nếu đã có driver hoặc đơn không ở trạng thái pending
    if (order.driver_id || order.status !== "pending") {
      return NextResponse.json({ skipped: true })
    }

    // Tìm tài xế online gần nhất
    const { data: driverId } = await db.rpc("find_nearest_driver", {
      order_lat:       order.delivery_lat,
      order_lng:       order.delivery_lng,
      max_distance_km: 5,
    })

    if (!driverId) {
      // Không có tài xế — driver tự nhận từ dashboard, không phải lỗi
      return NextResponse.json({ dispatched: false, reason: "no_driver_nearby" })
    }

    // Gán tài xế
    await db.from("orders")
      .update({ driver_id: driverId })
      .eq("id", order_id)

    return NextResponse.json({ dispatched: true, driverId })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
