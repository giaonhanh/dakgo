import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const PENDING_TIMEOUT_MINUTES = 15

// Chạy mỗi 5 phút — hủy đơn VietQR/MoMo chưa thanh toán quá 15 phút
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")
  if (process.env.NODE_ENV === "production" && secret !== `Bearer ${process.env.CRON_SECRET ?? ""}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = adminDb()
  const cutoff = new Date(Date.now() - PENDING_TIMEOUT_MINUTES * 60 * 1000).toISOString()

  // Tìm đơn chưa thanh toán quá hạn
  const { data: expiredOrders, error } = await db
    .from("orders")
    .select("id, customer_id, total_amount, pay_method")
    .eq("status", "pending")
    .eq("payment_status", "pending")
    .neq("pay_method", "cash")
    .lt("created_at", cutoff)

  if (error) {
    console.error("[cancel-pending-orders] query error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!expiredOrders?.length) {
    return NextResponse.json({ cancelled: 0 })
  }

  const ids = expiredOrders.map(o => o.id)

  // Hủy hàng loạt
  const { error: cancelErr } = await db
    .from("orders")
    .update({
      status:        "cancelled",
      cancelled_at:  new Date().toISOString(),
      cancel_reason: "Hết thời gian thanh toán (tự động hủy sau 15 phút)",
    })
    .in("id", ids)

  if (cancelErr) {
    console.error("[cancel-pending-orders] cancel error:", cancelErr)
    return NextResponse.json({ error: cancelErr.message }, { status: 500 })
  }

  // Thông báo cho khách hàng
  try {
    const notifRows = expiredOrders.map(o => ({
      user_id: o.customer_id,
      type:    "order",
      title:   "Đơn hàng đã bị hủy",
      body:    `Đơn hàng ${o.total_amount.toLocaleString("vi-VN")}đ đã bị hủy do hết thời gian thanh toán.`,
      data:    { cancelled: true },
    }))
    await db.from("notifications").insert(notifRows)
  } catch { /* không ảnh hưởng kết quả chính */ }

  console.log(`[cancel-pending-orders] Cancelled ${ids.length} expired orders`)
  return NextResponse.json({ cancelled: ids.length, ids })
}
