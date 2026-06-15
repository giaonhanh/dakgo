import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { dispatchOrder } from "@/lib/dispatch"

// Gọi sau khi tạo đơn đồ ăn để tự động tìm tài xế gần QUÁN nhất
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { order_id } = await req.json()
    if (!order_id) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 })

    // Xác minh đơn thuộc về user và đang pending
    const { data: order } = await supabase
      .from("orders")
      .select("id, driver_id, status, customer_id")
      .eq("id", order_id)
      .eq("customer_id", user.id)
      .single()

    if (!order) return NextResponse.json({ error: "Đơn không tồn tại" }, { status: 404 })
    if (order.driver_id || order.status !== "pending") {
      return NextResponse.json({ skipped: true })
    }

    const result = await dispatchOrder("orders", order_id, [])
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
