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

    // ── Bước 1: Tạo withdrawal record (chặn duplicate) ──────────────────────
    // Unique index trên (user_id) WHERE status='processing' → INSERT fail nếu đang có lệnh xử lý
    const { data: wd, error: wdErr } = await db
      .from("withdrawals")
      .insert({
        user_id:     user.id,
        wallet_type: "customer",
        amount:      amt,
        bank_bin:    String(bank_bin),
        bank_account: String(bank_account).replace(/\D/g, ""),
        status:      "processing",
      })
      .select("id")
      .single()

    if (wdErr) {
      // Lỗi unique index = đang có lệnh rút khác chưa xong
      if (wdErr.code === "23505") {
        return NextResponse.json({ error: "Đang có yêu cầu rút xu đang xử lý. Vui lòng chờ." }, { status: 429 })
      }
      console.error("[Customer Withdraw] insert withdrawal error:", wdErr)
      return NextResponse.json({ error: "Không thể tạo yêu cầu rút xu" }, { status: 500 })
    }

    withdrawalId = wd.id

    // ── Bước 2: Kiểm tra số dư ──────────────────────────────────────────────
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

    // ── Bước 3: Trừ ví (atomic RPC, có FOR UPDATE lock) ─────────────────────
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

    // ── Bước 4: Gọi PayOS Chi ────────────────────────────────────────────────
    const referenceId = `CUS-${user.id.slice(0, 8)}-${Date.now()}`
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

      // Hoàn tiền về ví
      const { error: refundErr } = await db.rpc("add_to_wallet", {
        p_user_id: user.id,
        p_type:    "customer",
        p_amount:  amt,
        p_ref_id:  null,
        p_note:    `Hoàn rút xu (PayOS lỗi) · Ref: ${referenceId}`,
        p_tx_type: "refund",
      })

      if (refundErr) {
        // ⚠️ CRITICAL: ví đã trừ nhưng không hoàn được → phải alert admin ngay
        console.error(`[CRITICAL] Customer withdraw refund FAILED. user=${user.id} amount=${amt} withdrawalId=${withdrawalId} refundErr=${refundErr.message}`)
        await db.from("withdrawals").update({
          status:       "failed",
          reference_id: referenceId,
          error_msg:    `PayOS fail + refund fail: ${refundErr.message}`,
        }).eq("id", withdrawalId)

        // Notify admin khẩn cấp
        const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").limit(5)
        if (admins?.length) {
          await Promise.allSettled(admins.map(a =>
            db.from("notifications").insert({
              user_id: a.id, type: "system",
              title:   "🚨 KHẨN: Hoàn xu thất bại",
              body:    `user=${user.id} · ${amt.toLocaleString("vi-VN")}xu · Cần xử lý thủ công ngay · Ref: ${referenceId}`,
              data:    { url: "/admin/wallets", critical: true, withdraw_id: withdrawalId },
            })
          ))
        }
        return NextResponse.json({ error: "Lỗi nghiêm trọng, đội hỗ trợ đã được thông báo." }, { status: 500 })
      }

      await db.from("withdrawals").update({
        status:    "refunded",
        error_msg: `PayOS: ${payosErr instanceof Error ? payosErr.message : String(payosErr)}`,
      }).eq("id", withdrawalId)

      return NextResponse.json({ error: "Cổng thanh toán lỗi, xu đã được hoàn lại. Thử lại sau." }, { status: 500 })
    }

    // ── Bước 5: Cập nhật withdrawal thành công ───────────────────────────────
    await db.from("withdrawals").update({
      status:       "success",
      reference_id: referenceId,
    }).eq("id", withdrawalId)

    // ── Bước 6: Notify ───────────────────────────────────────────────────────
    const { data: profile } = await db.from("profiles").select("full_name, phone").eq("id", user.id).single()

    await db.from("notifications").insert({
      user_id: user.id, type: "system",
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

  } catch (err) {
    // Nếu có withdrawalId đã tạo → mark failed để user có thể thử lại
    if (withdrawalId) {
      await adminDb().from("withdrawals").update({
        status:    "failed",
        error_msg: err instanceof Error ? err.message : "Unexpected error",
      }).eq("id", withdrawalId)
    }
    console.error("[Customer Withdraw] Unexpected error:", err)
    return NextResponse.json({ error: "Lỗi server, vui lòng thử lại" }, { status: 500 })
  }
}
