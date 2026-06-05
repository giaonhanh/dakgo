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

    // ── Bước 1: Lấy thông tin tài xế + ví ──────────────────────────────────
    const [{ data: driver }, { data: wallet }] = await Promise.all([
      db.from("drivers").select("bank_name, bank_bin, bank_account_number, bank_account_name, is_approved").eq("id", user.id).single(),
      db.from("wallets").select("balance").eq("user_id", user.id).eq("type", "driver").maybeSingle(),
    ])

    if (!driver?.is_approved) {
      return NextResponse.json({ error: "Tài khoản chưa được duyệt" }, { status: 403 })
    }
    if (!driver?.bank_account_number || !driver?.bank_bin) {
      return NextResponse.json({ error: "Chưa liên kết tài khoản ngân hàng. Vào Hồ sơ → Tài khoản ngân hàng để cập nhật." }, { status: 400 })
    }

    const balance = (wallet as { balance: number } | null)?.balance ?? 0
    if (amt > balance) {
      return NextResponse.json({ error: `Số dư không đủ. Ví hiện có ${balance.toLocaleString("vi-VN")}đ` }, { status: 400 })
    }

    // ── Bước 2: Tạo withdrawal record (chặn duplicate concurrent) ───────────
    const { data: wd, error: wdErr } = await db
      .from("withdrawals")
      .insert({
        user_id:      user.id,
        wallet_type:  "driver",
        amount:       amt,
        bank_bin:     driver.bank_bin,
        bank_account: driver.bank_account_number,
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

    // ── Bước 3: Gọi PayOS Chi TRƯỚC (ví chưa bị trừ) ───────────────────────
    // Nếu PayOS fail → ví nguyên vẹn, không cần refund
    const referenceId = `DRV-${user.id.slice(0, 8)}-${Date.now()}`
    try {
      await payosPayout.payouts.create({
        referenceId,
        amount:          amt,
        description:     `Rut tien tai xe`,
        toBin:           driver.bank_bin,
        toAccountNumber: driver.bank_account_number,
      })
    } catch (payosErr) {
      const errMsg = payosErr instanceof Error ? payosErr.message : String(payosErr)
      console.error("[Driver Withdraw] PayOS payout error:", errMsg)
      await db.from("withdrawals").update({
        status:    "failed",
        error_msg: `PayOS: ${errMsg}`,
      }).eq("id", withdrawalId)
      // Ví chưa bị trừ → trả lỗi thông thường, user thử lại
      return NextResponse.json({ error: `Cổng thanh toán lỗi: ${errMsg}. Vui lòng thử lại.` }, { status: 500 })
    }

    // ── Bước 4: PayOS OK → Trừ ví (atomic RPC) ──────────────────────────────
    const { error: rpcErr } = await db.rpc("subtract_from_wallet", {
      p_user_id: user.id,
      p_type:    "driver",
      p_amount:  amt,
      p_ref_id:  null,
      p_note:    `Rút tiền · ${driver.bank_name} · ${driver.bank_account_number} · Ref: ${referenceId}`,
      p_tx_type: "withdrawal",
    })

    if (rpcErr) {
      // PayOS đã chuyển khoản THÀNH CÔNG nhưng trừ ví thất bại
      console.error(`[CRITICAL] Driver withdraw: PayOS SUCCESS but subtract FAILED. user=${user.id} amount=${amt} ref=${referenceId} err=${rpcErr.message}`)
      await db.from("withdrawals").update({
        status:       "failed",
        reference_id: referenceId,
        error_msg:    `PayOS thành công nhưng trừ ví thất bại: ${rpcErr.message}`,
      }).eq("id", withdrawalId)

      const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").limit(5)
      if (admins?.length) {
        await Promise.allSettled(admins.map(a =>
          db.from("notifications").insert({
            user_id: a.id, type: "system",
            title:   "⚠️ Rút tiền tài xế: PayOS OK nhưng trừ ví thất bại",
            body:    `user=${user.id} · ${amt.toLocaleString("vi-VN")}đ · Ref: ${referenceId} · Cần kiểm tra thủ công`,
            data:    { url: "/admin/wallets", withdraw_id: withdrawalId, ref: referenceId },
          })
        ))
      }
      // Tiền đã chuyển thật → báo user thành công
      return NextResponse.json({ success: true, referenceId, warning: "partial" })
    }

    // ── Bước 5: Cập nhật withdrawal thành công ───────────────────────────────
    await db.from("withdrawals").update({
      status:       "success",
      reference_id: referenceId,
    }).eq("id", withdrawalId)

    // ── Bước 6: Notify ───────────────────────────────────────────────────────
    const { data: profile } = await db.from("profiles").select("full_name, phone").eq("id", user.id).single()

    await Promise.allSettled([
      db.from("notifications").insert({
        user_id: user.id, type: "system",
        title:   "✅ Rút tiền thành công",
        body:    `${amt.toLocaleString("vi-VN")}đ → ${driver.bank_name} · ${driver.bank_account_number} · Đã chuyển khoản tự động`,
        data:    { url: "/driver" },
      }),
      sendPushToUser(user.id, {
        title: "✅ Rút tiền thành công",
        body:  `${amt.toLocaleString("vi-VN")}đ đã chuyển vào ${driver.bank_name}`,
        url:   "/driver", tag: `withdraw-done-${user.id}`,
      }),
    ])

    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").limit(5)
    if (admins?.length) {
      const body = `✅ ${amt.toLocaleString("vi-VN")}đ → ${driver.bank_name} ${driver.bank_account_number} · ${profile?.full_name ?? ""} · Ref: ${referenceId}`
      await Promise.allSettled(admins.map(a =>
        db.from("notifications").insert({
          user_id: a.id, type: "system",
          title:   "🏦 Tài xế đã rút tiền tự động",
          body,
          data:    { url: "/admin/wallets", withdraw_user_id: user.id, amount: amt, ref: referenceId },
        })
      ))
    }

    return NextResponse.json({ success: true, referenceId })

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
