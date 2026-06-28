import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const XU_BASE  = 500   // xu thưởng đánh giá cơ bản
const XU_PHOTO = 1000  // xu thưởng khi có kèm ảnh

// POST /api/reviews/reward
// Cộng xu DakGo (bonus_balance) vào ví khách sau khi đánh giá thành công
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { order_id, has_photo } = await req.json()
    if (!order_id) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 })

    const db = adminDb()

    // Xác minh đơn thuộc user + đã giao
    const { data: order } = await db
      .from("orders")
      .select("id, customer_id, status")
      .eq("id", order_id)
      .eq("customer_id", user.id)
      .single()

    if (!order)                       return NextResponse.json({ error: "Đơn không hợp lệ" }, { status: 403 })
    if (order.status !== "delivered") return NextResponse.json({ error: "Đơn chưa giao xong" }, { status: 400 })

    // Xác minh review thực sự đã tồn tại
    const { data: review } = await db
      .from("reviews")
      .select("id")
      .eq("order_id", order_id)
      .eq("reviewer_id", user.id)
      .single()

    if (!review) return NextResponse.json({ error: "Chưa có đánh giá" }, { status: 400 })

    // Chống nhận thưởng hai lần: kiểm tra transaction đã tồn tại chưa
    const { data: existing } = await db
      .from("transactions")
      .select("id")
      .eq("ref_type", "review_reward")
      .eq("ref_id", order_id)
      .limit(1)
      .maybeSingle()

    if (existing) return NextResponse.json({ ok: true, skipped: true, xu: 0 })

    const xuReward = has_photo ? XU_PHOTO : XU_BASE

    // Lấy hoặc tạo ví khách
    let { data: wallet } = await db
      .from("wallets")
      .select("id, bonus_balance")
      .eq("user_id", user.id)
      .eq("type", "customer")
      .single()

    if (!wallet) {
      const { data: newWallet } = await db
        .from("wallets")
        .insert({ user_id: user.id, type: "customer", balance: 0, bonus_balance: 0 })
        .select("id, bonus_balance")
        .single()
      wallet = newWallet
    }

    if (!wallet) return NextResponse.json({ error: "Không thể tạo ví" }, { status: 500 })

    const newBonus = (wallet.bonus_balance ?? 0) + xuReward

    // Cộng bonus_balance
    const { error: updateErr } = await db
      .from("wallets")
      .update({ bonus_balance: newBonus, updated_at: new Date().toISOString() })
      .eq("id", wallet.id)

    if (updateErr) return NextResponse.json({ error: "Không thể cộng xu" }, { status: 500 })

    // Ghi lịch sử
    await db.from("transactions").insert({
      wallet_id:     wallet.id,
      type:          "topup",
      amount:        xuReward,
      balance_after: newBonus,
      ref_type:      "review_reward",
      ref_id:        order_id,
      note:          has_photo ? "Thưởng xu đánh giá kèm ảnh" : "Thưởng xu đánh giá đơn hàng",
    })

    return NextResponse.json({ ok: true, xu: xuReward, new_bonus: newBonus })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
