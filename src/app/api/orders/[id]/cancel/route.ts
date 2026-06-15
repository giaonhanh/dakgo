import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { sendPushToUser } from "@/lib/webpush"

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { reason } = await req.json()
    const db = adminDb()

    // Lấy đơn hàng kèm thông tin xu đã dùng
    const { data: order } = await db
      .from("orders")
      .select("id, status, customer_id, shop_id, driver_id, xu_used, xu_bonus_used, total_amount, payment_status, pay_method")
      .eq("id", id)
      .single()

    if (!order) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 })

    if (order.customer_id !== user.id) {
      return NextResponse.json({ error: "Không có quyền hủy đơn này" }, { status: 403 })
    }

    // Chỉ cho hủy khi chưa có tài xế đến lấy hàng
    if (!["pending", "accepted", "preparing"].includes(order.status)) {
      return NextResponse.json({ error: "Đơn hàng không thể hủy — tài xế đang trên đường giao" }, { status: 400 })
    }

    // Hủy đơn — set cancelled_by để blacklist trigger hoạt động
    const { error } = await db
      .from("orders")
      .update({
        status:        "cancelled",
        cancelled_at:  new Date().toISOString(),
        cancel_reason: reason ?? "Khách hủy",
        cancelled_by:  user.id,
      })
      .eq("id", id)

    if (error) return NextResponse.json({ error: "Hủy đơn thất bại" }, { status: 500 })

    // Hoàn xu nếu đơn đã trừ xu
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
          const newBal   = (wallet.balance       ?? 0) + xuUsed
          const newBonus = (wallet.bonus_balance  ?? 0) + xuBonusUsed
          await db.from("wallets").update({
            balance:       newBal,
            bonus_balance: newBonus,
            updated_at:    new Date().toISOString(),
          }).eq("id", wallet.id)

          const txRows = []
          if (xuUsed > 0)
            txRows.push({ wallet_id: wallet.id, type: "refund", amount: xuUsed,      balance_after: newBal,   ref_type: "order", ref_id: id, note: "Hoàn xu do hủy đơn" })
          if (xuBonusUsed > 0)
            txRows.push({ wallet_id: wallet.id, type: "refund", amount: xuBonusUsed, balance_after: newBonus, ref_type: "order", ref_id: id, note: "Hoàn xu thưởng do hủy đơn" })
          if (txRows.length) await db.from("transactions").insert(txRows)
        }
      } catch { /* không block hủy đơn */ }
    }

    // Tạo yêu cầu hoàn tiền nếu đã thanh toán VietQR/online
    if (order.payment_status === "paid" && order.pay_method !== "cash") {
      try {
        await db.from("payment_refunds").insert({
          order_id:   id,
          amount:     order.total_amount,
          reason:     reason ?? "Khách hủy đơn",
          status:     "pending",
        })
        // Notify admin để xử lý hoàn tiền thủ công
        const { data: adminProfiles } = await db
          .from("profiles").select("id").eq("role", "admin")
        if (adminProfiles?.length) {
          await db.from("notifications").insert(
            adminProfiles.map((a: { id: string }) => ({
              user_id: a.id, type: "system",
              title: "⚠️ Cần hoàn tiền",
              body:  `Đơn #${id.slice(0, 8).toUpperCase()} đã hủy sau khi thanh toán ${order.total_amount.toLocaleString("vi-VN")}đ`,
              data:  { order_id: id, url: "/admin/refunds" },
            }))
          )
        }
      } catch (e) { console.error("[cancel] payment_refund insert error:", e) }
    }

    // Notify merchant
    try {
      const { data: shop } = await db.from("shops").select("owner_id").eq("id", order.shop_id).single()
      if (shop?.owner_id) {
        await db.from("notifications").insert({
          user_id: shop.owner_id, type: "order",
          title: "❌ Khách đã hủy đơn",
          body:  `Đơn ${order.total_amount.toLocaleString("vi-VN")}đ vừa bị hủy${reason ? `: ${reason}` : ""}`,
          data:  { order_id: id, url: "/merchant" },
        })
        await sendPushToUser(shop.owner_id, {
          title: "❌ Khách đã hủy đơn",
          body:  `Đơn ${order.total_amount.toLocaleString("vi-VN")}đ vừa bị hủy`,
          url:   "/merchant", tag: `cancel-${id}`,
        })
      }
    } catch { /* không block */ }

    // Notify tài xế (nếu đã gán)
    if (order.driver_id) {
      try {
        await db.from("notifications").insert({
          user_id: order.driver_id, type: "order",
          title: "❌ Đơn hàng bị hủy",
          body:  "Khách vừa hủy đơn hàng đã được giao cho bạn",
          data:  { order_id: id, url: "/driver" },
        })
        await sendPushToUser(order.driver_id, {
          title: "❌ Đơn hàng bị hủy",
          body:  "Khách vừa hủy đơn hàng đã được giao cho bạn",
          url:   "/driver", tag: `cancel-${id}`,
        })
      } catch { /* không block */ }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
