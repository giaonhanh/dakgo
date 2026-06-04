import { NextRequest, NextResponse } from "next/server"
import { payosPayout } from "@/lib/payos"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { walletType, amount, toBin, toAccountNumber, description } = await req.json()

    if (!amount || !toBin || !toAccountNumber) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    const db = adminDb()

    // Kiểm tra số dư ví
    const { data: wallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("user_id", user.id)
      .eq("type", walletType ?? "customer")
      .single()

    if (!wallet || wallet.balance < amount) {
      return NextResponse.json({ error: "Số dư không đủ" }, { status: 400 })
    }

    // Trừ ví TRƯỚC khi gọi PayOS — tránh gọi thành công nhưng trừ thất bại
    const newBalance = wallet.balance - amount
    const { error: deductErr } = await db
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", wallet.id)
      .eq("balance", wallet.balance) // optimistic lock

    if (deductErr) return NextResponse.json({ error: "Không thể trừ ví" }, { status: 500 })

    const referenceId = `RUTTIEN-${Date.now()}`

    try {
      // Gọi PayOS Chi
      const result = await payosPayout.payouts.create({
        referenceId,
        amount:          Number(amount),
        description:     description ?? `Rut tien ${walletType}`,
        toBin:           String(toBin),
        toAccountNumber: String(toAccountNumber),
      })

      // Ghi lịch sử giao dịch
      await db.from("transactions").insert({
        wallet_id:     wallet.id,
        type:          "withdrawal",
        amount:        -amount,
        balance_after: newBalance,
        ref_type:      "payout",
        note:          `Rút tiền ****${toAccountNumber.slice(-4)} · Ref: ${referenceId}`,
      })

      return NextResponse.json({ success: true, payoutId: result.id, referenceId })
    } catch (payosErr) {
      // PayOS thất bại → hoàn tiền lại ví
      await db.from("wallets").update({
        balance:    wallet.balance,
        updated_at: new Date().toISOString(),
      }).eq("id", wallet.id)

      console.error("[Payout] PayOS error — refunded:", payosErr)
      return NextResponse.json({ error: "Lỗi cổng thanh toán, tiền đã được hoàn lại" }, { status: 500 })
    }
  } catch (err) {
    console.error("[Payout] error:", err)
    return NextResponse.json({ error: "Lỗi hệ thống, thử lại sau" }, { status: 500 })
  }
}
