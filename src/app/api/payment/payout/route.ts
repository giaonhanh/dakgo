import { NextRequest, NextResponse } from "next/server"
import { payosPayout } from "@/lib/payos"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  try {
    const { userId, walletType, amount, toBin, toAccountNumber, description } = await req.json()

    if (!userId || !amount || !toBin || !toAccountNumber) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )

    // Kiểm tra số dư ví
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .eq("type", walletType)
      .single()

    if (!wallet || wallet.balance < amount) {
      return NextResponse.json({ error: "Số dư không đủ" }, { status: 400 })
    }

    // Gọi PayOS Chi
    const referenceId = `RUTTIEN-${Date.now()}`
    const result = await payosPayout.payouts.create({
      referenceId,
      amount:          Number(amount),
      description:     description ?? `Rut tien ${walletType}`,
      toBin:           String(toBin),
      toAccountNumber: String(toAccountNumber),
    })

    // Trừ ví sau khi tạo lệnh chi thành công
    await supabase.rpc("add_to_wallet", {
      p_user_id: userId,
      p_type:    walletType,
      p_amount:  -amount,
      p_ref_id:  null,
      p_note:    `Rút tiền ****${toAccountNumber.slice(-4)} · Ref: ${referenceId}`,
    })

    return NextResponse.json({ success: true, payoutId: result.id, referenceId })
  } catch (err) {
    console.error("[Payout] error:", err)
    return NextResponse.json({ error: "Lỗi hệ thống, thử lại sau" }, { status: 500 })
  }
}
