import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { dispatchOrder, getTriedDriverIds, type DispatchTable } from "@/lib/dispatch"

// Tài xế gọi endpoint này khi từ chối đơn (bấm từ chối hoặc hết 30s countdown)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    // Xác minh người dùng là tài xế
    const { data: driver } = await supabase
      .from("drivers").select("id, is_approved").eq("id", user.id).single()
    if (!driver) return NextResponse.json({ error: "Không phải tài xế" }, { status: 403 })

    const { table, id } = await req.json() as { table: DispatchTable; id: string }
    if (!table || !id) {
      return NextResponse.json({ error: "Thiếu table hoặc id" }, { status: 400 })
    }

    // Kiểm tra đơn vẫn đang ở trạng thái chờ (chưa có ai nhận)
    const { data: record } = await supabase
      .from(table)
      .select("driver_id, status")
      .eq("id", id)
      .single()

    if (!record) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 })

    // Chỉ xử lý nếu đơn vẫn đang pending/searching và chính tài xế này đang được gán
    const isPending = table === "rides"
      ? record.status === "searching"
      : record.status === "pending"

    if (!isPending || record.driver_id !== user.id) {
      return NextResponse.json({ skipped: true, reason: "order_not_pending_or_not_assigned" })
    }

    // Xóa driver_id khỏi đơn (reset về chưa có tài xế)
    await supabase.from(table).update({ driver_id: null }).eq("id", id)

    // Lấy danh sách tài xế đã thử (từ notifications)
    const triedIds = await getTriedDriverIds(table, id)

    // Dispatch sang tài xế tiếp theo
    const result = await dispatchOrder(table, id, triedIds)

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
