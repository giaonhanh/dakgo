import { NextRequest, NextResponse } from "next/server"
import { payosCollect } from "@/lib/payos"
import { createServerClient } from "@supabase/ssr"
import { sendPushToUser } from "@/lib/webpush"
import type { Webhook } from "@payos/node"

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Webhook

    // Verify chữ ký từ PayOS — bắt buộc
    const data = await payosCollect.webhooks.verify(body)

    // PayOS test webhook (orderCode = 123) → trả OK luôn
    if (data.orderCode === 123) {
      return NextResponse.json({ code: "00" })
    }

    // Service role để bypass RLS — webhook không có session user
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    )

    // Tìm đơn hàng theo payment_code
    const { data: order } = await supabase
      .from("orders")
      .select("id, customer_id, shop_id, driver_id, total_amount, ship_fee, payment_status")
      .eq("payment_code", data.orderCode)
      .single()

    if (!order) {
      // Thử tìm trong bảng wallet top-up requests
      await handleWalletTopup(supabase, data.orderCode, data.amount)
      return NextResponse.json({ code: "00" })
    }

    // Atomic idempotency: chỉ update nếu payment_status chưa phải 'paid'
    // Nếu 2 webhook đến cùng lúc, chỉ 1 cái thành công (tránh double credit)
    const { data: claimed } = await supabase
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", order.id)
      .neq("payment_status", "paid")
      .select("id")
      .maybeSingle()

    if (!claimed) {
      console.log(`[Webhook] Duplicate webhook for orderCode ${data.orderCode}, skipping`)
      return NextResponse.json({ code: "00" })
    }


    // Notify khách thanh toán thành công
    try {
      await supabase.from("notifications").insert({
        user_id: order.customer_id, type: "order",
        title: "✅ Thanh toán thành công",
        body:  `Đơn hàng ${order.total_amount.toLocaleString("vi-VN")}đ đã được xác nhận thanh toán`,
        data:  { order_id: order.id, url: `/tracking/${order.id}` },
      })
      await sendPushToUser(order.customer_id, {
        title: "✅ Thanh toán thành công",
        body:  `Đơn ${order.total_amount.toLocaleString("vi-VN")}đ đã thanh toán · Đang chuẩn bị`,
        url:   `/tracking/${order.id}`, tag: `paid-${order.id}`,
      })
    } catch { /* không block */ }

    // Realtime broadcast → badge "Đã thanh toán" cho khách + tài xế
    try {
      await supabase.channel(`order-${order.id}`).send({
        type:    "broadcast",
        event:   "payment_status",
        payload: { status: "paid", orderId: order.id },
      })
    } catch (e) { console.warn("[Webhook] broadcast error (non-blocking):", e) }

    console.log(`[Webhook] ✅ Đơn #${data.orderCode} · ${data.amount.toLocaleString("vi-VN")}đ`)
    return NextResponse.json({ code: "00" })

  } catch (err) {
    console.error("[Webhook] Error:", err)
    return NextResponse.json({ code: "00" }) // luôn trả 00 để PayOS không retry
  }
}

async function handleWalletTopup(
  supabase: ReturnType<typeof createServerClient>,
  orderCode: number,
  amount: number,
) {
  // Atomic update: chỉ update nếu status vẫn là "pending" — chống race condition double-credit
  const { data: topup } = await supabase
    .from("wallet_topups")
    .update({ status: "paid" })
    .eq("payment_code", orderCode)
    .eq("status", "pending")
    .select("user_id, wallet_type")
    .single()

  // Nếu không có row nào được update → đã xử lý rồi, bỏ qua
  if (!topup) {
    console.log(`[Webhook] Wallet topup #${orderCode} đã xử lý hoặc không tồn tại, bỏ qua`)
    return
  }

  const { error: rpcErr } = await supabase.rpc("add_to_wallet", {
    p_user_id: topup.user_id,
    p_type:    topup.wallet_type,
    p_amount:  amount,
    p_ref_id:  null,
    p_note:    `Nạp ví #${orderCode}`,
    p_tx_type: "topup",
  })

  if (rpcErr) {
    console.error("[Webhook] add_to_wallet error:", rpcErr)
    // Rollback status về pending để retry được
    await supabase.from("wallet_topups").update({ status: "pending" }).eq("payment_code", orderCode)
    return
  }

  // Notify khách nạp ví thành công
  try {
    await supabase.from("notifications").insert({
      user_id: topup.user_id, type: "system",
      title: "💳 Nạp ví thành công",
      body:  `${amount.toLocaleString("vi-VN")}đ đã được nạp vào ví của bạn`,
      data:  { url: "/wallet/xu" },
    })
    await sendPushToUser(topup.user_id, {
      title: "💳 Nạp ví thành công",
      body:  `+${amount.toLocaleString("vi-VN")}đ vào ví`,
      url:   "/wallet/xu", tag: `topup-${orderCode}`,
    })
  } catch { /* không block */ }

  console.log(`[Webhook] ✅ Nạp ví ${topup.wallet_type} ${amount.toLocaleString("vi-VN")}đ cho ${topup.user_id}`)
}
