import { NextRequest, NextResponse } from "next/server"
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

    const { order_id, xu_used, xu_bonus_used } = await req.json()

    if (!order_id) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 })

    const xuUsed      = Math.max(0, Number(xu_used)       || 0)
    const xuBonusUsed = Math.max(0, Number(xu_bonus_used) || 0)

    if (xuUsed === 0 && xuBonusUsed === 0) {
      return NextResponse.json({ ok: true })
    }

    const db = adminDb()

    // Xác minh đơn hàng thuộc về user này
    const { data: order } = await db
      .from("orders")
      .select("id, total_amount, customer_id")
      .eq("id", order_id)
      .eq("customer_id", user.id)
      .single()

    if (!order) return NextResponse.json({ error: "Đơn hàng không hợp lệ" }, { status: 403 })

    // Lấy số dư xu thực tế từ DB
    const { data: wallet } = await db
      .from("wallets")
      .select("id, balance, bonus_balance")
      .eq("user_id", user.id)
      .eq("type", "customer")
      .single()

    if (!wallet) return NextResponse.json({ error: "Không tìm thấy ví" }, { status: 404 })

    // Validate: client không được trừ nhiều hơn số dư thực
    if (xuBonusUsed > (wallet.bonus_balance ?? 0)) {
      return NextResponse.json({ error: "Xu thưởng không đủ" }, { status: 400 })
    }
    if (xuUsed > (wallet.balance ?? 0)) {
      return NextResponse.json({ error: "Xu không đủ" }, { status: 400 })
    }
    // Tổng xu trừ không được vượt quá tổng đơn
    if (xuUsed + xuBonusUsed > order.total_amount) {
      return NextResponse.json({ error: "Xu vượt quá giá trị đơn hàng" }, { status: 400 })
    }

    const newBonus = (wallet.bonus_balance ?? 0) - xuBonusUsed
    const newBal   = (wallet.balance ?? 0) - xuUsed

    // Dùng RPC để trừ xu + ghi lịch sử trong 1 transaction atomic
    const { error: rpcErr } = await db.rpc("deduct_xu_atomic", {
      p_wallet_id:    wallet.id,
      p_xu_used:      xuUsed,
      p_xu_bonus:     xuBonusUsed,
      p_new_bal:      newBal,
      p_new_bonus:    newBonus,
      p_order_id:     order_id,
    })

    if (rpcErr) {
      // Fallback: update thủ công nếu RPC chưa tồn tại
      const { error: updateErr } = await db
        .from("wallets")
        .update({ balance: newBal, bonus_balance: newBonus, updated_at: new Date().toISOString() })
        .eq("id", wallet.id)
      if (updateErr) return NextResponse.json({ error: "Không thể trừ xu" }, { status: 500 })

      const txRows = []
      if (xuBonusUsed > 0) txRows.push({ wallet_id: wallet.id, type: "payment", amount: xuBonusUsed, balance_after: newBonus, ref_type: "order", ref_id: order_id, note: "Thanh toán bằng xu thưởng" })
      if (xuUsed > 0)      txRows.push({ wallet_id: wallet.id, type: "payment", amount: xuUsed,      balance_after: newBal,   ref_type: "order", ref_id: order_id, note: "Thanh toán bằng xu DakGo" })
      if (txRows.length > 0) await db.from("transactions").insert(txRows)
    }

    return NextResponse.json({ ok: true, newBal, newBonus })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
