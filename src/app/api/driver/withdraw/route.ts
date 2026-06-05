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
  const db = adminDb()
  let withdrawalId: string | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { amount } = await req.json()
    const amt = Number(amount)
    if (!amt || amt < 50000) {
      return NextResponse.json({ error: "Số tiền tối thiểu 50,000đ" }, { status: 400 })
    }

    // ── Lấy thông tin tài xế + ví ───────────────────────────────────────────
    const [{ data: driver }, { data: wallet }] = await Promise.all([
      db.from("drivers").select("bank_name, bank_bin, bank_account_number, bank_account_name, is_approved").eq("id", user.id).single(),
      db.from("wallets").select("balance").eq("user_id", user.id).eq("type", "driver").maybeSingle(),
    ])

    if (!driver?.is_approved) {
      return NextResponse.json({ error: "Tài khoản chưa được duyệt" }, { status: 403 })
    }
    if (!driver?.bank_account_number) {
      return NextResponse.json({ error: "Chưa liên kết tài khoản ngân hàng. Vào Hồ sơ → Tài khoản ngân hàng để cập nhật." }, { status: 400 })
    }

    const balance = (wallet as { balance: number } | null)?.balance ?? 0
    if (amt > balance) {
      return NextResponse.json({ error: `Số dư không đủ. Ví hiện có ${balance.toLocaleString("vi-VN")}đ` }, { status: 400 })
    }

    // ── Chặn duplicate concurrent ────────────────────────────────────────────
    const { data: wd, error: wdErr } = await db
      .from("withdrawals")
      .insert({
        user_id:      user.id,
        wallet_type:  "driver",
        amount:       amt,
        bank_bin:     driver.bank_bin ?? "",
        bank_account: driver.bank_account_number,
        account_name: driver.bank_account_name ?? "",
        status:       "processing",
      })
      .select("id")
      .single()

    if (wdErr) {
      if (wdErr.code === "23505") {
        return NextResponse.json({ error: "Đang có yêu cầu rút tiền đang xử lý. Vui lòng chờ." }, { status: 429 })
      }
      console.error("[Driver Withdraw] insert withdrawal error:", wdErr)
      return NextResponse.json({ error: "Không thể tạo yêu cầu rút tiền" }, { status: 500 })
    }

    withdrawalId = wd.id

    // ── Trừ ví (atomic RPC) ──────────────────────────────────────────────────
    const { error: rpcErr } = await db.rpc("subtract_from_wallet", {
      p_user_id: user.id,
      p_type:    "driver",
      p_amount:  amt,
      p_ref_id:  null,
      p_note:    `Rút tiền · ${driver.bank_name} · ${driver.bank_account_number}`,
      p_tx_type: "withdrawal",
    })

    if (rpcErr) {
      const msg = rpcErr.message.includes("insufficient") ? "Số dư không đủ" : "Không thể xử lý. Thử lại sau."
      await db.from("withdrawals").update({ status: "failed", error_msg: rpcErr.message }).eq("id", withdrawalId)
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // ── Cập nhật withdrawal → success (chờ admin chuyển khoản) ──────────────
    await db.from("withdrawals").update({ status: "success" }).eq("id", withdrawalId)

    // ── Lấy tên tài xế ───────────────────────────────────────────────────────
    const { data: profile } = await db.from("profiles").select("full_name, phone").eq("id", user.id).single()

    // ── Notify tài xế ────────────────────────────────────────────────────────
    await Promise.allSettled([
      db.from("notifications").insert({
        user_id: user.id, type: "system",
        title:   "✅ Yêu cầu rút tiền đã ghi nhận",
        body:    `${amt.toLocaleString("vi-VN")}đ · ${driver.bank_name} · ${driver.bank_account_number} · Admin sẽ chuyển khoản trong 24h`,
        data:    { url: "/driver" },
      }),
      sendPushToUser(user.id, {
        title: "✅ Yêu cầu rút tiền đã ghi nhận",
        body:  `${amt.toLocaleString("vi-VN")}đ · Xử lý trong 24h`,
        url:   "/driver", tag: `withdraw-${user.id}`,
      }),
    ])

    // ── Notify admin chuyển khoản thủ công ──────────────────────────────────
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").limit(5)
    if (admins?.length) {
      const body = `💸 ${amt.toLocaleString("vi-VN")}đ · ${driver.bank_name} ${driver.bank_account_number} (${driver.bank_account_name ?? ""}) · ${profile?.full_name ?? ""} ${profile?.phone ?? ""}`
      await Promise.allSettled([
        ...admins.map(a =>
          db.from("notifications").insert({
            user_id: a.id, type: "system",
            title:   "🏦 Tài xế yêu cầu rút tiền",
            body,
            data:    { url: "/admin/wallets", withdraw_user_id: user.id, amount: amt, bank: driver.bank_account_number, withdraw_id: withdrawalId },
          })
        ),
        ...admins.map(a =>
          sendPushToUser(a.id, {
            title: "🏦 Yêu cầu rút tiền tài xế",
            body:  `${amt.toLocaleString("vi-VN")}đ · ${profile?.full_name ?? "Tài xế"}`,
            url:   "/admin/wallets", tag: `withdraw-req-${user.id}`,
          })
        ),
      ])
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    if (withdrawalId) {
      await db.from("withdrawals").update({
        status:    "failed",
        error_msg: err instanceof Error ? err.message : "Unexpected error",
      }).eq("id", withdrawalId)
    }
    console.error("[Driver Withdraw] Unexpected error:", err)
    return NextResponse.json({ error: "Lỗi server, vui lòng thử lại" }, { status: 500 })
  }
}
