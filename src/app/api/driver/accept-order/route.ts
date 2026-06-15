import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as adminClient } from "@supabase/supabase-js"

function adminDb() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Fallback khi accept_order_with_commission RPC thất bại
// Dùng service role để bypass RLS — assign driver_id trực tiếp
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { order_id, driver_id } = await req.json()
    if (!order_id || !driver_id) {
      return NextResponse.json({ error: "Thiếu order_id hoặc driver_id" }, { status: 400 })
    }

    // Chỉ cho phép driver tự assign cho mình
    if (driver_id !== user.id) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 })
    }

    const db = adminDb()

    // Kiểm tra đơn còn nhận được không
    const { data: order } = await db
      .from("orders")
      .select("id, driver_id, status")
      .eq("id", order_id)
      .single()

    if (!order) return NextResponse.json({ error: "Đơn không tồn tại" }, { status: 404 })
    if (order.driver_id) return NextResponse.json({ error: "Đơn đã được tài xế khác nhận" }, { status: 409 })
    if (!["pending", "accepted"].includes(order.status)) {
      return NextResponse.json({ error: "Đơn không còn có thể nhận" }, { status: 409 })
    }

    // Assign driver (không trừ hoa hồng — đây là fallback)
    const { error: updateErr } = await db
      .from("orders")
      .update({
        driver_id:   driver_id,
        accepted_at: new Date().toISOString(),
        status:      order.status === "pending" ? "accepted" : order.status,
      })
      .eq("id", order_id)
      .is("driver_id", null)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, fallback: true })
  } catch (err) {
    console.error("accept-order fallback error:", err)
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
