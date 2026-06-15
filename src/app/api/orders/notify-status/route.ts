import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { sendPushToUser } from "@/lib/webpush"

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  try {
    const { order_id, status, cancel_reason } = await req.json()
    if (!order_id || !status) {
      return NextResponse.json({ error: "Thiếu order_id hoặc status" }, { status: 400 })
    }

    const db = adminDb()

    // Lấy thông tin đơn + tài xế
    const { data: order } = await db
      .from("orders")
      .select("id, customer_id, driver_id, shop_id, total_amount, driver_commission_amount")
      .eq("id", order_id)
      .single()

    if (!order) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 })

    const shortId = order_id.slice(0, 8).toUpperCase()

    if (status === "accepted") {
      // Thông báo khách hàng: quán đã xác nhận đơn
      await sendPushToUser(order.customer_id, {
        title: "✅ Đơn hàng được xác nhận!",
        body:  `Quán đang chuẩn bị đơn #${shortId} của bạn.`,
        url:   `/tracking/${order_id}`,
        tag:   `order-accepted-${order_id}`,
      })
      await db.from("notifications").insert({
        user_id: order.customer_id,
        type:    "order",
        title:   "✅ Đơn hàng được xác nhận!",
        body:    `Quán đang chuẩn bị đơn #${shortId} của bạn.`,
        data:    { order_id, url: `/tracking/${order_id}` },
      })
    }

    else if (status === "ready") {
      // Thông báo tài xế: hàng đã xong, đến lấy
      if (order.driver_id) {
        await sendPushToUser(order.driver_id, {
          title: "📦 Hàng đã sẵn sàng!",
          body:  `Đơn #${shortId} đã xong, đến quán lấy hàng ngay!`,
          url:   `/driver/navigate/${order_id}`,
          tag:   `order-ready-${order_id}`,
          sound: "new-order",
        })
        await db.from("notifications").insert({
          user_id: order.driver_id,
          type:    "order",
          title:   "📦 Hàng đã sẵn sàng!",
          body:    `Đơn #${shortId} đã xong, đến quán lấy hàng ngay!`,
          data:    { order_id, url: `/driver/navigate/${order_id}` },
        })
      }
    }

    else if (status === "driver_accepted") {
      // Thông báo khách: tài xế đã nhận đơn, đang trên đường đến quán
      await sendPushToUser(order.customer_id, {
        title: "🛵 Tài xế đang đến lấy đơn!",
        body:  `Đơn #${shortId} đã có tài xế. Theo dõi trực tiếp nhé!`,
        url:   `/tracking/${order_id}`,
        tag:   `driver-accepted-${order_id}`,
      })
      await db.from("notifications").insert({
        user_id: order.customer_id,
        type:    "order",
        title:   "🛵 Tài xế đang đến lấy đơn!",
        body:    `Đơn #${shortId} đã có tài xế. Theo dõi trực tiếp nhé!`,
        data:    { order_id, url: `/tracking/${order_id}` },
      })
    }

    else if (status === "cancelled") {
      // Hoàn hoa hồng tài xế
      if (order.driver_id && (order.driver_commission_amount ?? 0) > 0) {
        await db.rpc("refund_driver_commission", { p_order_id: order_id })
      }

      // Thông báo khách hàng
      const reason = cancel_reason ?? "Đơn hàng bị hủy"
      await sendPushToUser(order.customer_id, {
        title: "❌ Đơn hàng bị hủy",
        body:  `Đơn #${shortId}: ${reason}`,
        url:   "/orders",
        tag:   `order-cancelled-${order_id}`,
      })
      await db.from("notifications").insert({
        user_id: order.customer_id,
        type:    "order",
        title:   "❌ Đơn hàng bị hủy",
        body:    `Đơn #${shortId}: ${reason}`,
        data:    { order_id, url: "/orders", cancelled: true },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("notify-status error:", err)
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
