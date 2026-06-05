import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { sendPushToUser } from "@/lib/webpush"

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Gọi sau khi tạo đơn để tự động tìm tài xế gần nhất
// Khu vực nhỏ (Phước An, Krông Pắc) — không cần filter khoảng cách, lấy tài xế online+approved đầu tiên
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { order_id } = await req.json()
    if (!order_id) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 })

    const db = adminDb()

    // Xác minh đơn thuộc về user và đang pending
    const { data: order } = await db
      .from("orders")
      .select("id, driver_id, status, customer_id, total_amount, delivery_address, shop_id")
      .eq("id", order_id)
      .eq("customer_id", user.id)
      .single()

    if (!order) return NextResponse.json({ error: "Đơn không tồn tại" }, { status: 404 })

    // Bỏ qua nếu đã có driver hoặc không phải pending
    if (order.driver_id || order.status !== "pending") {
      return NextResponse.json({ skipped: true })
    }

    // Tìm tài xế online + đã duyệt (khu vực nhỏ, không cần filter khoảng cách)
    // Ưu tiên tài xế không đang bận, lấy người đặt đơn ít nhất hôm nay
    const { data: drivers } = await db
      .from("drivers")
      .select("id")
      .eq("status", "online")
      .eq("is_online", true)
      .eq("is_approved", true)
      .eq("is_busy", false)
      .limit(5)

    if (!drivers?.length) {
      // Không có tài xế rảnh → gửi push cho TẤT CẢ tài xế online để tự nhận
      const { data: allOnline } = await db
        .from("drivers")
        .select("id")
        .eq("status", "online")
        .eq("is_online", true)
        .eq("is_approved", true)
        .limit(10)

      if (allOnline?.length) {
        await Promise.allSettled(allOnline.map(d =>
          sendPushToUser(d.id, {
            title: "🛵 Đơn hàng mới!",
            body:  `${order.total_amount.toLocaleString("vi-VN")}đ · ${order.delivery_address}`,
            url:   `/driver`,
            tag:   `order-${order_id}`,
            sound: "driver",
          })
        ))
      }
      return NextResponse.json({ dispatched: false, reason: "no_driver_available" })
    }

    // Gán tài xế đầu tiên rảnh (chưa set accepted_at — driver phải bấm Nhận đơn)
    const driverId = drivers[0].id
    await db.from("orders")
      .update({ driver_id: driverId })
      .eq("id", order_id)

    // Gửi push + notification cho tài xế được gán
    try {
      await db.from("notifications").insert({
        user_id: driverId, type: "order",
        title: "🛵 Đơn hàng mới!",
        body:  `${order.total_amount.toLocaleString("vi-VN")}đ · ${order.delivery_address}`,
        data:  { order_id, url: `/driver` },
      })
      await sendPushToUser(driverId, {
        title: "🛵 Đơn hàng mới!",
        body:  `${order.total_amount.toLocaleString("vi-VN")}đ · Bấm để xem chi tiết`,
        url:   `/driver`,
        tag:   `order-${order_id}`,
        sound: "driver",
      })
    } catch { /* không block dispatch */ }

    return NextResponse.json({ dispatched: true, driverId })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
