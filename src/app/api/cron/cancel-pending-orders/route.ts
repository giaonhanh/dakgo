import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendPushToUser } from "@/lib/webpush"

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const PENDING_TIMEOUT_MINUTES = 15

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")
  if (process.env.NODE_ENV === "production" && secret !== `Bearer ${process.env.CRON_SECRET ?? ""}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = adminDb()
  const cutoff = new Date(Date.now() - PENDING_TIMEOUT_MINUTES * 60 * 1000).toISOString()

  // Lấy đơn quá hạn kèm thông tin xu
  const { data: expiredOrders, error } = await db
    .from("orders")
    .select("id, customer_id, shop_id, total_amount, pay_method, xu_used, xu_bonus_used")
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

  // Hoàn xu cho từng đơn có trừ xu
  for (const order of expiredOrders) {
    const xuUsed      = Number(order.xu_used      ?? 0)
    const xuBonusUsed = Number(order.xu_bonus_used ?? 0)

    if (xuUsed > 0 || xuBonusUsed > 0) {
      try {
        const { data: wallet } = await db
          .from("wallets")
          .select("id, balance, bonus_balance")
          .eq("user_id", order.customer_id)
          .eq("type", "customer")
          .single()

        if (wallet) {
          const newBal   = (wallet.balance      ?? 0) + xuUsed
          const newBonus = (wallet.bonus_balance ?? 0) + xuBonusUsed
          await db.from("wallets").update({
            balance:       newBal,
            bonus_balance: newBonus,
            updated_at:    new Date().toISOString(),
          }).eq("id", wallet.id)

          const txRows = []
          if (xuUsed > 0)
            txRows.push({ wallet_id: wallet.id, type: "refund", amount: xuUsed,      balance_after: newBal,   ref_type: "order", ref_id: order.id, note: "Hoàn xu do hủy đơn tự động" })
          if (xuBonusUsed > 0)
            txRows.push({ wallet_id: wallet.id, type: "refund", amount: xuBonusUsed, balance_after: newBonus, ref_type: "order", ref_id: order.id, note: "Hoàn xu thưởng do hủy đơn tự động" })
          if (txRows.length) await db.from("transactions").insert(txRows)
        }
      } catch { /* không block vòng lặp */ }
    }
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

    // Push notify từng khách
    for (const o of expiredOrders) {
      sendPushToUser(o.customer_id, {
        title: "Đơn hàng đã bị hủy",
        body:  `Đơn ${o.total_amount.toLocaleString("vi-VN")}đ đã hết thời gian thanh toán`,
        url:   "/orders", tag: `cancel-${o.id}`,
      }).catch(e => console.error(`[cron] push failed for ${o.customer_id}:`, e))
    }
  } catch { /* không ảnh hưởng kết quả chính */ }

  console.log(`[cancel-pending-orders] Cancelled ${ids.length} expired orders`)
  return NextResponse.json({ cancelled: ids.length, ids })
}
