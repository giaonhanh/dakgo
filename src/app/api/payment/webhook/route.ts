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
      .select("id, customer_id, shop_id, driver_id, total_amount, ship_fee")
      .eq("payment_code", data.orderCode)
      .single()

    if (!order) {
      // Thử tìm trong bảng wallet top-up requests
      await handleWalletTopup(supabase, data.orderCode, data.amount)
      return NextResponse.json({ code: "00" })
    }

    // Cập nhật trạng thái thanh toán đơn hàng
    await supabase
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", order.id)

    // Cộng ví tài xế: phí ship (merchant thanh toán trực tiếp, không qua ví)
    if (order.driver_id) {
      await supabase.rpc("add_to_wallet", {
        p_user_id: order.driver_id,
        p_type:    "driver",
        p_amount:  order.ship_fee,
        p_ref_id:  order.id,
        p_note:    `Phí giao đơn #${data.orderCode}`,
        p_tx_type: "commission",
      }).then(({ error }) => {
        if (error) console.error("[Webhook] driver wallet error:", error)
      })
    }

    // Notify merchant: đơn đã được thanh toán
    try {
      const { data: shop } = await supabase
        .from("shops").select("owner_id").eq("id", order.shop_id).single()

      if (shop?.owner_id) {
        await supabase.from("notifications").insert({
          user_id: shop.owner_id, type: "order",
          title: "💰 Đơn đã được thanh toán",
          body:  `Đơn #${data.orderCode} · ${order.total_amount.toLocaleString("vi-VN")}đ đã thanh toán thành công`,
          data:  { order_id: order.id, url: "/merchant" },
        })
        await sendPushToUser(shop.owner_id, {
          title: "💰 Đơn đã được thanh toán",
          body:  `Đơn #${data.orderCode} · ${order.total_amount.toLocaleString("vi-VN")}đ`,
          url:   "/merchant", tag: `paid-${order.id}`,
        })
      }
    } catch (e) { console.error("[Webhook] merchant notify error:", e) }

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
    await supabase.channel(`order-${order.id}`).send({
      type:    "broadcast",
      event:   "payment_status",
      payload: { status: "paid", orderId: order.id },
    })

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
  const { data: topup } = await supabase
    .from("wallet_topups")
    .select("user_id, wallet_type")
    .eq("payment_code", orderCode)
    .eq("status", "pending")
    .single()

  if (!topup) return

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
    return
  }

  await supabase
    .from("wallet_topups")
    .update({ status: "paid" })
    .eq("payment_code", orderCode)

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
