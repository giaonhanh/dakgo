import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// POST /api/reviews/tip
// Trừ tip từ ví khách → cộng vào ví tài xế + ghi lịch sử + push notif
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { order_id, tip_amount } = await req.json()

    if (!order_id) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 })

    const tip = Math.round(Number(tip_amount) || 0)
    if (tip <= 0) return NextResponse.json({ ok: true, skipped: true })
    if (tip > 500_000) return NextResponse.json({ error: "Tip tối đa 500.000đ" }, { status: 400 })

    const db = adminDb()

    // Xác minh đơn hàng thuộc user + đã giao + có tài xế
    const { data: order } = await db
      .from("orders")
      .select("id, customer_id, driver_id, status, pay_method")
      .eq("id", order_id)
      .eq("customer_id", user.id)
      .single()

    if (!order)            return NextResponse.json({ error: "Đơn hàng không hợp lệ" }, { status: 403 })
    if (!order.driver_id)  return NextResponse.json({ error: "Đơn hàng không có tài xế" }, { status: 400 })
    if (order.status !== "delivered") return NextResponse.json({ error: "Đơn hàng chưa giao xong" }, { status: 400 })
    if (order.pay_method === "cash")  return NextResponse.json({ error: "Không tip được khi thanh toán tiền mặt" }, { status: 400 })

    // Lấy ví khách
    const { data: custWallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("user_id", user.id)
      .eq("type", "customer")
      .single()

    if (!custWallet || custWallet.balance < tip) {
      return NextResponse.json({
        error: `Số dư ví không đủ (cần ${tip.toLocaleString("vi-VN")}đ, hiện có ${(custWallet?.balance ?? 0).toLocaleString("vi-VN")}đ)`,
        insufficient: true,
      }, { status: 400 })
    }

    // Lấy hoặc tạo ví tài xế
    let { data: driverWallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("user_id", order.driver_id)
      .eq("type", "driver")
      .single()

    if (!driverWallet) {
      const { data: newWallet } = await db
        .from("wallets")
        .insert({ user_id: order.driver_id, type: "driver", balance: 0 })
        .select("id, balance")
        .single()
      driverWallet = newWallet
    }

    if (!driverWallet) return NextResponse.json({ error: "Không thể tạo ví tài xế" }, { status: 500 })

    const newCustBal   = custWallet.balance - tip
    const newDriverBal = driverWallet.balance + tip

    // Trừ ví khách
    const { error: custErr } = await db
      .from("wallets")
      .update({ balance: newCustBal, updated_at: new Date().toISOString() })
      .eq("id", custWallet.id)

    if (custErr) return NextResponse.json({ error: "Không thể trừ ví khách" }, { status: 500 })

    // Cộng ví tài xế
    const { error: driverErr } = await db
      .from("wallets")
      .update({ balance: newDriverBal, updated_at: new Date().toISOString() })
      .eq("id", driverWallet.id)

    if (driverErr) {
      // Rollback ví khách
      await db.from("wallets").update({ balance: custWallet.balance }).eq("id", custWallet.id)
      return NextResponse.json({ error: "Không thể cộng ví tài xế" }, { status: 500 })
    }

    // Ghi lịch sử giao dịch
    await db.from("transactions").insert([
      {
        wallet_id:     custWallet.id,
        type:          "payment",
        amount:        tip,
        balance_after: newCustBal,
        ref_type:      "tip",
        ref_id:        order_id,
        note:          "Tip cho tài xế",
      },
      {
        wallet_id:     driverWallet.id,
        type:          "topup",
        amount:        tip,
        balance_after: newDriverBal,
        ref_type:      "tip",
        ref_id:        order_id,
        note:          "Nhận tip từ khách hàng",
      },
    ])

    // Push notification cho tài xế (fire-and-forget)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/notify/send`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Cookie: req.headers.get("cookie") ?? "" },
      body: JSON.stringify({
        user_id: order.driver_id,
        title:   "🎉 Bạn nhận được tip!",
        body:    `Khách vừa gửi ${tip.toLocaleString("vi-VN")}đ tip. Cảm ơn bạn đã giao hàng tốt!`,
        url:     "/driver/earnings",
        tag:     "tip",
      }),
    }).catch(() => { /* non-critical */ })

    return NextResponse.json({ ok: true, new_balance: newCustBal })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
