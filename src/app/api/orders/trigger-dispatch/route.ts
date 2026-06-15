import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as adminClient } from "@supabase/supabase-js"
import { dispatchOrder } from "@/lib/dispatch"

function adminDb() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Gọi sau khi tạo đơn đồ ăn để tự động tìm tài xế gần QUÁN nhất.
// Chấp nhận 2 cách gọi:
//   1. Từ client (user session) — checkout page
//   2. Từ Supabase Database Webhook (x-webhook-secret header) — server-side, không cần session
export async function POST(req: NextRequest) {
  try {
    const webhookSecret = req.headers.get("x-webhook-secret")
    const isWebhook = !!webhookSecret && webhookSecret === process.env.CRON_SECRET

    let order_id: string | undefined

    if (isWebhook) {
      // Supabase Database Webhook gửi toàn bộ record trong body
      const payload = await req.json()
      // Webhook payload: { type: "INSERT", record: { id, ... }, ... }
      order_id = payload?.record?.id ?? payload?.order_id
    } else {
      // Gọi từ client — yêu cầu user session
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

      const body = await req.json()
      order_id = body?.order_id

      if (!order_id) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 })

      // Xác minh đơn thuộc về user này
      const { data: userOrder } = await supabase
        .from("orders")
        .select("id, driver_id, status")
        .eq("id", order_id)
        .eq("customer_id", user.id)
        .single()

      if (!userOrder) return NextResponse.json({ error: "Đơn không tồn tại" }, { status: 404 })
      if (userOrder.driver_id || userOrder.status !== "pending") {
        return NextResponse.json({ skipped: true })
      }
    }

    if (!order_id) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 })

    // Dùng admin client để verify đơn (bỏ qua RLS)
    const db = adminDb()
    const { data: order } = await db
      .from("orders")
      .select("id, driver_id, status")
      .eq("id", order_id)
      .single()

    if (!order) return NextResponse.json({ skipped: true, reason: "not_found" })
    if (order.driver_id || order.status !== "pending") {
      return NextResponse.json({ skipped: true, reason: "already_dispatched" })
    }

    const result = await dispatchOrder("orders", order_id, [])
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
