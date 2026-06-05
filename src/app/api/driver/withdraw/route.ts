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

    const { amount } = await req.json()
    const amt = Number(amount)
    if (!amt || amt < 50000) {
      return NextResponse.json({ error: "Số tiền tối thiểu 50,000đ" }, { status: 400 })
    }

    const db = adminDb()

    // Lấy thông tin ngân hàng + số dư ví
    const [{ data: driver }, { data: wallet }] = await Promise.all([
      db.from("drivers").select("bank_name, bank_account_number, bank_account_name, is_approved").eq("id", user.id).single(),
      db.from("wallets").select("balance").eq("user_id", user.id).eq("type", "driver").maybeSingle(),
    ])

    if (!driver?.is_approved) {
      return NextResponse.json({ error: "Tài khoản chưa được duyệt" }, { status: 403 })
    }
    if (!driver?.bank_account_number) {
      return NextResponse.json({ error: "Chưa liên kết tài khoản ngân hàng" }, { status: 400 })
    }

    const balance = (wallet as { balance: number } | null)?.balance ?? 0
    if (amt > balance) {
      return NextResponse.json({ error: `Số dư không đủ. Ví hiện có ${balance.toLocaleString("vi-VN")}đ` }, { status: 400 })
    }

    // Trừ ví ngay (RPC có check atomic insufficient)
    const { error: rpcErr } = await db.rpc("subtract_from_wallet", {
      p_user_id: user.id,
      p_type:    "driver",
      p_amount:  amt,
      p_ref_id:  null,
      p_note:    `Rút tiền · ${driver.bank_name} · ${driver.bank_account_number}`,
      p_tx_type: "withdrawal",
    })

    if (rpcErr) {
      if (rpcErr.message.includes("insufficient")) {
        return NextResponse.json({ error: "Số dư không đủ" }, { status: 400 })
      }
      console.error("[Driver Withdraw] subtract_from_wallet error:", rpcErr)
      return NextResponse.json({ error: "Không thể xử lý. Thử lại sau." }, { status: 500 })
    }

    // Lấy tên tài xế
    const { data: profile } = await db.from("profiles").select("full_name, phone").eq("id", user.id).single()

    // Notify tài xế
    await db.from("notifications").insert({
      user_id: user.id,
      type:    "system",
      title:   "✅ Yêu cầu rút tiền đã gửi",
      body:    `${amt.toLocaleString("vi-VN")}đ → ${driver.bank_name} · ${driver.bank_account_number} · Xử lý trong 24h`,
      data:    { url: "/driver" },
    })

    // Notify admin xử lý chuyển khoản
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").limit(5)
    if (admins?.length) {
      const body = `💸 ${amt.toLocaleString("vi-VN")}đ · ${driver.bank_name} ${driver.bank_account_number} (${driver.bank_account_name}) · ${profile?.full_name ?? ""} ${profile?.phone ?? ""}`
      await Promise.allSettled(admins.map(a =>
        db.from("notifications").insert({
          user_id: a.id,
          type:    "system",
          title:   "🏦 Tài xế yêu cầu rút tiền",
          body,
          data:    { url: "/admin/wallets", withdraw_user_id: user.id, amount: amt, bank: driver.bank_account_number },
        })
      ))
      await Promise.allSettled(admins.map(a =>
        sendPushToUser(a.id, {
          title: "🏦 Yêu cầu rút tiền tài xế",
          body:  `${amt.toLocaleString("vi-VN")}đ · ${profile?.full_name ?? "Tài xế"}`,
          url:   "/admin/wallets",
          tag:   `driver-withdraw-${user.id}`,
        })
      ))
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
