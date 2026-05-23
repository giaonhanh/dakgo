import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { reason } = await req.json()

    // Kiểm tra đơn còn có thể hủy không (chỉ pending/accepted)
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, customer_id")
      .eq("id", id)
      .single()

    if (!order) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 })

    if (!["pending", "accepted"].includes(order.status)) {
      return NextResponse.json({ error: "Đơn hàng không thể hủy ở trạng thái này" }, { status: 400 })
    }

    const { error } = await supabase
      .from("orders")
      .update({
        status:        "cancelled",
        cancelled_at:  new Date().toISOString(),
        cancel_reason: reason ?? "Khách hủy",
        cancelled_by:  user.id,
      })
      .eq("id", id)

    if (error) return NextResponse.json({ error: "Hủy đơn thất bại" }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
