import { NextRequest, NextResponse } from "next/server"
import { payosCollect } from "@/lib/payos"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
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

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )

    // Tìm đơn hàng theo payment_code
    const { data: order } = await supabase
      .from("orders")
      .select("id, driver_id, total_amount")
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

    // Cộng ví tài xế: tổng - hoa hồng 15%
    if (order.driver_id) {
      const commission    = Math.round(order.total_amount * 0.15)
      const driverEarning = order.total_amount - commission
      await supabase.rpc("add_to_wallet", {
        p_user_id: order.driver_id,
        p_type:    "driver",
        p_amount:  driverEarning,
        p_ref_id:  order.id,
        p_note:    `Đơn #${data.orderCode} · HH ${commission.toLocaleString("vi-VN")}đ`,
      })
    }

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
  // Tìm yêu cầu nạp ví theo payment_code
  const { data: topup } = await supabase
    .from("wallet_topups")
    .select("user_id, wallet_type")
    .eq("payment_code", orderCode)
    .single()

  if (!topup) return

  await supabase.rpc("add_to_wallet", {
    p_user_id: topup.user_id,
    p_type:    topup.wallet_type,
    p_amount:  amount,
    p_ref_id:  null,
    p_note:    `Nạp ví #${orderCode}`,
  })

  console.log(`[Webhook] ✅ Nạp ví ${topup.wallet_type} ${amount.toLocaleString("vi-VN")}đ`)
}
