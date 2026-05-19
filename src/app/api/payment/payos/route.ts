import { NextRequest, NextResponse } from "next/server"
import { payosCollect } from "@/lib/payos"

export async function POST(req: NextRequest) {
  try {
    const { orderCode, amount, description, returnUrl, cancelUrl } = await req.json()

    if (!orderCode || !amount || !description) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    const data = await payosCollect.paymentRequests.create({
      orderCode:   Number(orderCode),
      amount:      Number(amount),
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
