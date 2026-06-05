import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { sendPushToUser } from "@/lib/webpush"
import { payosPayout } from "@/lib/payos"

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

    const { amount, bank_account, bank_bin } = await req.json()
    const amt = Number(amount)

    if (!amt || amt < 50000) {
      return NextResponse.json({ error: "Số tiền tối thiểu 50,000 xu" }, { status: 400 })
    }
    if (!bank_account || String(bank_account).replace(/\D/g, "").length < 8) {
      return NextResponse.json({ error: "Số tài khoản không hợp lệ" }, { status: 400 })
    }
    if (!bank_bin) {
      return NextResponse.json({ error: "Vui lòng chọn ngân hàng" }, { status: 400 })
    }

    const db = adminDb()

    // Kiểm tra số dư ví (chỉ tính xu thật, không tính xu thưởng)
    const { data: wallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("user_id", user.id)
      .eq("type", "customer")
      .maybeSingle()

    const currentBalance = (wallet as { id: string; balance: number } | null)?.balance ?? 0
    if (amt > currentBalance) {
      return NextResponse.json({ error: `Số dư không đủ. Ví hiện có ${currentBalance.toLocaleString("vi-VN")} xu` }, { status: 400 })
    }

    // Trừ ví ngay (atomic, RPC có check insufficient)
    const { error: rpcErr } = await db.rpc("subtract_from_wallet", {
      p_user_id: user.id,
      p_type:    "customer",
      p_amount:  amt,
      p_ref_id:  null,
      p_note:    `Rút xu · TK ${bank_account}`,
      p_tx_type: "withdrawal",
    })

    if (rpcErr) {
      if (rpcErr.message.includes("insufficient")) {
        return NextResponse.json({ error: "Số dư không đủ" }, { status: 400 })
      }
      return NextResponse.json({ error: "Không thể xử lý yêu cầu" }, { status: 500 })
    }

    // Gọi PayOS Chi chuyển khoản tự động
    const referenceId = `CUS-${user.id.slice(0,8)}-${Date.now()}`
    try {
      await payosPayout.payouts.create({
        referenceId,
        amount:          amt,
        description:     `Rut xu khach hang`,
        toBin:           String(bank_bin),
        toAccountNumber: String(bank_account).replace(/\D/g, ""),
      })
    } catch (payosErr) {
      console.error("[Customer Withdraw] PayOS payout error:", payosErr)
      // Hoàn tiền về ví nếu PayOS fail
      await db.rpc("add_to_wallet", {
        p_user_id: user.id,
        p_type:    "customer",
        p_amount:  amt,
        p_ref_id:  null,
        p_note:    `Hoàn rút xu (PayOS lỗi)`,
        p_tx_type: "refund",
      })
      return NextResponse.json({ error: "Cổng thanh toán lỗi, xu đã được hoàn lại. Thử lại sau." }, { status: 500 })
    }

    // Lấy tên khách để notify
    const { data: profile } = await db
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single()

    // Notify khách
    await db.from("notifications").insert({
      user_id: user.id,
      type:    "system",
      title:   "✅ Rút xu thành công",
      body:    `${amt.toLocaleString("vi-VN")} xu đã chuyển vào TK ${bank_account} · Ref: ${referenceId}`,
      data:    { url: "/wallet/xu" },
    })
    await sendPushToUser(user.id, {
      title: "✅ Rút xu thành công",
      body:  `${amt.toLocaleString("vi-VN")}xu đã chuyển khoản tự động`,
      url:   "/wallet/xu",
      tag:   `withdraw-done-${user.id}`,
    })

    // Notify admin để theo dõi
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").limit(5)
    if (admins?.length) {
      await Promise.allSettled(admins.map(a =>
        db.from("notifications").insert({
          user_id: a.id, type: "system",
          title:   "🏦 Khách rút xu tự động",
          body:    `✅ ${amt.toLocaleString("vi-VN")}xu · TK ${bank_account} · ${profile?.full_name ?? ""} · Ref: ${referenceId}`,
          data:    { url: "/admin/wallets", withdraw_user_id: user.id, amount: amt, bank_account, ref: referenceId },
        })
      ))
    }

    return NextResponse.json({ success: true, referenceId })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
