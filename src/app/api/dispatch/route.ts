import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { sendPushToUser } from "@/lib/webpush"

function adminDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  try {
    // Internal call từ order creation hoặc cron — dùng CRON_SECRET header
    const cronSecret     = process.env.CRON_SECRET
    const internalSecret = req.headers.get("x-internal-secret")
    const isInternal     = !!cronSecret && !!internalSecret && internalSecret === cronSecret

    if (!isInternal) {
      // Fallback: yêu cầu admin auth
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single()

      if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Không có quyền" }, { status: 403 })
      }
    }

    const { order_id, order_lat, order_lng } = await req.json()
    if (!order_id || order_lat == null || order_lng == null) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    const admin = adminDb()

    // Lấy thông tin đơn để notify tài xế
    const { data: order } = await admin
      .from("orders")
      .select("total_amount, delivery_address")
      .eq("id", order_id)
      .single()

    // Tìm tài xế online gần nhất (trong vòng 5km)
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

    // Notify tài xế có đơn mới
    if (order) {
      try {
        await admin.from("notifications").insert({
          user_id: driverId, type: "order",
          title: "🛵 Đơn hàng mới!",
          body:  `${order.total_amount.toLocaleString("vi-VN")}đ · ${order.delivery_address}`,
          data:  { order_id, url: `/driver/navigate/${order_id}` },
        })
        await sendPushToUser(driverId, {
          title: "🛵 Đơn hàng mới!",
          body:  `${order.total_amount.toLocaleString("vi-VN")}đ · Bấm để xem chi tiết`,
          url:   `/driver/navigate/${order_id}`,
          tag:   `order-${order_id}`,
          sound: "driver",
        })
      } catch { /* không block */ }
    }

    return NextResponse.json({ driverId })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
