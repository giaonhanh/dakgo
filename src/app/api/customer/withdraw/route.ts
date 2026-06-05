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

    const { amount, bank_account, bank_bin, account_name } = await req.json()
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
    if (!account_name || String(account_name).trim().length < 3) {
      return NextResponse.json({ error: "Vui lòng nhập tên chủ tài khoản" }, { status: 400 })
    }

    // ── Chặn duplicate concurrent ────────────────────────────────────────────
    const { data: wd, error: wdErr } = await db
      .from("withdrawals")
      .insert({
        user_id:      user.id,
        wallet_type:  "customer",
        amount:       amt,
        bank_bin:     String(bank_bin),
        bank_account: String(bank_account).replace(/\D/g, ""),
        account_name: String(account_name).trim().toUpperCase(),
        status:       "processing",
      })
      .select("id")
      .single()

    if (wdErr) {
      if (wdErr.code === "23505") {
        return NextResponse.json({ error: "Đang có yêu cầu rút xu đang xử lý. Vui lòng chờ." }, { status: 429 })
      }
      console.error("[Customer Withdraw] insert withdrawal error:", wdErr)
      return NextResponse.json({ error: "Không thể tạo yêu cầu rút xu" }, { status: 500 })
    }

    withdrawalId = wd.id

    // ── Kiểm tra số dư ───────────────────────────────────────────────────────
    const { data: wallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("user_id", user.id)
      .eq("type", "customer")
      .maybeSingle()

    const currentBalance = (wallet as { id: string; balance: number } | null)?.balance ?? 0
    if (amt > currentBalance) {
      await db.from("withdrawals").update({ status: "failed", error_msg: "Số dư không đủ" }).eq("id", withdrawalId)
      return NextResponse.json({ error: `Số dư không đủ. Ví hiện có ${currentBalance.toLocaleString("vi-VN")} xu` }, { status: 400 })
    }

    // ── Trừ ví (atomic RPC) ──────────────────────────────────────────────────
    const { error: rpcErr } = await db.rpc("subtract_from_wallet", {
      p_user_id: user.id,
      p_type:    "customer",
      p_amount:  amt,
      p_ref_id:  null,
      p_note:    `Rút xu · TK ${bank_account}`,
      p_tx_type: "withdrawal",
    })

    if (rpcErr) {
      const msg = rpcErr.message.includes("insufficient") ? "Số dư không đủ" : "Không thể xử lý yêu cầu"
      await db.from("withdrawals").update({ status: "failed", error_msg: rpcErr.message }).eq("id", withdrawalId)
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // ── Cập nhật withdrawal → pending (chờ admin chuyển khoản) ───────────────
    await db.from("withdrawals").update({ status: "success" }).eq("id", withdrawalId)

    // ── Lấy thông tin user ───────────────────────────────────────────────────
    const { data: profile } = await db.from("profiles").select("full_name, phone").eq("id", user.id).single()
    const { data: banks } = await db.from("withdrawals").select("bank_account, bank_bin").eq("id", withdrawalId).single()

    // ── Notify user ──────────────────────────────────────────────────────────
    await Promise.allSettled([
      db.from("notifications").insert({
        user_id: user.id, type: "system",
        title:   "✅ Yêu cầu rút xu đã ghi nhận",
        body:    `${amt.toLocaleString("vi-VN")} xu · TK ${bank_account} · Admin sẽ chuyển khoản trong 24h`,
        data:    { url: "/wallet/xu" },
      }),
      sendPushToUser(user.id, {
        title: "✅ Yêu cầu rút xu đã ghi nhận",
        body:  `${amt.toLocaleString("vi-VN")}xu · Xử lý trong 24h`,
        url:   "/wallet/xu", tag: `withdraw-${user.id}`,
      }),
    ])

    // ── Notify admin chuyển khoản thủ công ──────────────────────────────────
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").limit(5)
    if (admins?.length) {
      const body = `💸 ${amt.toLocaleString("vi-VN")}xu · TK ${bank_account} · CTK: ${account_name} · ${profile?.full_name ?? ""} ${profile?.phone ?? ""}`
      await Promise.allSettled([
        ...admins.map(a =>
          db.from("notifications").insert({
            user_id: a.id, type: "system",
            title:   "🏦 Khách yêu cầu rút xu",
            body,
            data:    { url: "/admin/withdrawals", withdraw_user_id: user.id, amount: amt, bank_account, bank_bin, withdraw_id: withdrawalId },
          })
        ),
        ...admins.map(a =>
          sendPushToUser(a.id, {
            title: "🏦 Yêu cầu rút xu",
            body:  `${amt.toLocaleString("vi-VN")}xu · ${profile?.full_name ?? "Khách hàng"}`,
            url:   "/admin/withdrawals", tag: `withdraw-req-${user.id}`,
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
    console.error("[Customer Withdraw] Unexpected error:", err)
    return NextResponse.json({ error: "Lỗi server, vui lòng thử lại" }, { status: 500 })
  }
}
