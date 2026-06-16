import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as adminClient } from "@supabase/supabase-js"
import { dispatchOrder, getTriedDriverIds, type DispatchTable } from "@/lib/dispatch"

function adminDb() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

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

    // Chỉ xử lý nếu đơn vẫn đang pending/searching và chưa có tài xế khác nhận
    // LƯU Ý: dispatchOrder() không gán driver_id trước khi tài xế tự nhận qua RPC,
    // nên record.driver_id luôn là null ở giai đoạn này — không thể dùng để xác minh "đang được gán".
    const isPending = table === "rides"
      ? record.status === "searching"
      : record.status === "pending"

    if (!isPending || record.driver_id) {
      return NextResponse.json({ skipped: true, reason: "order_not_pending_or_already_taken" })
    }

    // Đơn được gửi theo wave 2 tài xế gần nhất cùng lúc — chỉ dispatch wave kế tiếp
    // khi CẢ wave hiện tại đã từ chối/hết giờ, không phải ngay khi 1 người từ chối.
    const admin = adminDb()
    const { data: wave } = await admin
      .from("dispatch_waves")
      .select("driver_ids")
      .eq("order_table", table)
      .eq("order_id", id)
      .single()

    const remaining = ((wave?.driver_ids as string[] | null) ?? []).filter(d => d !== user.id)

    if (remaining.length > 0) {
      // Vẫn còn tài xế khác trong wave chưa phản hồi — chỉ cập nhật wave, chưa dispatch tiếp
      await admin
        .from("dispatch_waves")
        .update({ driver_ids: remaining, updated_at: new Date().toISOString() })
        .eq("order_table", table)
        .eq("order_id", id)
      return NextResponse.json({ skipped: true, reason: "wave_still_pending" })
    }

    // Cả wave đã từ chối — dispatch sang wave tài xế tiếp theo
    const triedIds = [...new Set([...(await getTriedDriverIds(table, id)), user.id])]
    const result = await dispatchOrder(table, id, triedIds)

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
