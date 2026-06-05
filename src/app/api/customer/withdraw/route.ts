import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { sendPushToUser } from "@/lib/webpush"

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

    const { amount, bank_account } = await req.json()
    const amt = Number(amount)

    if (!amt || amt < 50000) {
      return NextResponse.json({ error: "Số tiền tối thiểu 50,000 xu" }, { status: 400 })
    }
    if (!bank_account || String(bank_account).replace(/\D/g, "").length < 8) {
      return NextResponse.json({ error: "Số tài khoản không hợp lệ" }, { status: 400 })
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

    // Lấy tên khách để notify admin
    const { data: profile } = await db
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single()

    // Ghi yêu cầu vào notifications cho admin xử lý
    const withdrawNote = `💸 Rút xu · ${amt.toLocaleString("vi-VN")}xu · TK ${bank_account} · ${profile?.full_name ?? ""} ${profile?.phone ?? ""}`
    await db.from("notifications").insert({
      user_id: user.id,
      type:    "system",
      title:   "✅ Yêu cầu rút xu đã gửi",
      body:    `${amt.toLocaleString("vi-VN")} xu đang được xử lý (1–3 ngày làm việc)`,
      data:    { url: "/wallet/xu" },
    })

    // Tìm admin để notify
    const { data: admins } = await db
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(5)

    if (admins?.length) {
      await Promise.allSettled(admins.map(a =>
        db.from("notifications").insert({
          user_id: a.id,
          type:    "system",
          title:   "🏦 Yêu cầu rút xu mới",
          body:    withdrawNote,
          data:    { url: "/admin/wallets", withdraw_user_id: user.id, amount: amt, bank_account },
        })
      ))
      // Push cho admin
      await Promise.allSettled(admins.map(a =>
        sendPushToUser(a.id, {
          title: "🏦 Yêu cầu rút xu",
          body:  `${amt.toLocaleString("vi-VN")}xu · ${profile?.full_name ?? "Khách hàng"}`,
          url:   "/admin/wallets",
          tag:   `withdraw-${user.id}`,
        })
      ))
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
