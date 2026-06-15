import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { maskPhone } from "@/lib/maskPhone"
import { sendPushToUser } from "@/lib/webpush"

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        *,
        shop:shops(id, name, logo_url, address, phone),
        items:order_items(*),
        driver:drivers(id, vehicle_type, license_plate, profile:profiles(full_name, avatar_url, phone))
      `)
      .eq("id", id)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 })
    }

    // Mask SĐT trước khi trả về client — giữ đầy đủ ở server, mask ở response
    const safeOrder = {
      ...order,
      shop: order.shop ? { ...order.shop, phone: maskPhone(order.shop.phone) } : order.shop,
      driver: order.driver ? {
        ...order.driver,
        profile: order.driver.profile ? {
          ...order.driver.profile,
          phone: maskPhone(order.driver.profile.phone),
        } : order.driver.profile,
      } : order.driver,
    }

    return NextResponse.json(safeOrder)
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const body = await req.json()
    const allowed = ["status", "accepted_at", "preparing_at", "ready_at", "picked_up_at", "delivered_at"]
    const update: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) update[key] = body[key]
    }

    if (!Object.keys(update).length) {
      return NextResponse.json({ error: "Không có trường nào được cập nhật" }, { status: 400 })
    }

    // Thêm cancelled_at + cancel_reason nếu status = cancelled
    if (body.status === "cancelled") {
      update.cancelled_at  = new Date().toISOString()
      update.cancel_reason = body.cancel_reason ?? "Khách hàng hủy đơn"
      update.cancelled_by  = user.id
    }

    const { error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", id)

    if (error) return NextResponse.json({ error: "Cập nhật thất bại" }, { status: 500 })

    // Khi hủy đơn: hoàn hoa hồng tài xế + notify khách
    if (body.status === "cancelled") {
      const db = adminDb()
      const { data: order } = await db
        .from("orders")
        .select("customer_id, driver_id, driver_commission_amount, total_amount")
        .eq("id", id)
        .single()

      if (order) {
        if (order.driver_id && (order.driver_commission_amount ?? 0) > 0) {
          await db.rpc("refund_driver_commission", { p_order_id: id })
        }

        const reason   = body.cancel_reason ?? "Khách hàng hủy đơn"
        const shortId  = id.slice(0, 8).toUpperCase()
        await sendPushToUser(order.customer_id, {
          title: "❌ Đơn hàng đã hủy",
          body:  `Đơn #${shortId}: ${reason}`,
          url:   "/orders",
          tag:   `order-cancelled-${id}`,
        })
        await db.from("notifications").insert({
          user_id: order.customer_id,
          type:    "order",
          title:   "❌ Đơn hàng đã hủy",
          body:    `Đơn #${shortId}: ${reason}`,
          data:    { order_id: id, url: "/orders", cancelled: true },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
