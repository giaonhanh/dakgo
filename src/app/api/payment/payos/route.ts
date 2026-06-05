import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { payosCollect } from "@/lib/payos"

const MIN_AMOUNT = 10_000
const MAX_AMOUNT = 50_000_000

export async function POST(req: NextRequest) {
  try {
    // Auth check — không cho phép anonymous gọi tạo link
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { orderCode, amount, description, returnUrl, cancelUrl } = await req.json()

    if (!orderCode || !amount || !description) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    // Validate amount server-side
    const amt = Number(amount)
    if (!Number.isInteger(amt) || amt < MIN_AMOUNT) {
      return NextResponse.json({ error: `Số tiền tối thiểu ${MIN_AMOUNT.toLocaleString("vi-VN")}đ` }, { status: 400 })
    }
    if (amt > MAX_AMOUNT) {
      return NextResponse.json({ error: `Số tiền tối đa ${MAX_AMOUNT.toLocaleString("vi-VN")}đ` }, { status: 400 })
    }

    const data = await payosCollect.paymentRequests.create({
      orderCode:   Number(orderCode),
      amount:      amt,
      description: String(description).slice(0, 25),
      returnUrl:   returnUrl  ?? `${process.env.NEXT_PUBLIC_APP_URL}/order-success`,
      cancelUrl:   cancelUrl  ?? `${process.env.NEXT_PUBLIC_APP_URL}/checkout`,
    })

    return NextResponse.json({
      qrCode:        data.qrCode,
      checkoutUrl:   data.checkoutUrl,
      paymentLinkId: data.paymentLinkId,
      accountNumber: data.accountNumber,
      accountName:   data.accountName,
      bin:           data.bin,
    })
  } catch (err) {
    console.error("[PayOS] createPaymentLink error:", err)
    return NextResponse.json({ error: "Không thể tạo link thanh toán" }, { status: 500 })
  }
}
