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

// PATCH /api/admin/withdrawals — đánh dấu transferred hoặc rejected
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    // Verify admin
    const db = adminDb()
    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ error: "Không có quyền" }, { status: 403 })

    const { withdrawal_id, action, reject_reason } = await req.json()
    if (!withdrawal_id || !action) {
      return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 })
    }
    if (!["transferred", "rejected"].includes(action)) {
      return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 })
    }
    if (action === "rejected" && !reject_reason?.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập lý do từ chối" }, { status: 400 })
    }

    // Lấy withdrawal
    const { data: wd } = await db
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawal_id)
      .single()

    if (!wd) return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404 })
    if (!["pending_transfer", "processing"].includes(wd.status)) {
      return NextResponse.json({ error: "Yêu cầu này đã được xử lý rồi" }, { status: 400 })
    }

    if (action === "transferred") {
      // ── Đánh dấu đã chuyển khoản ────────────────────────────────────────────
      await db.from("withdrawals").update({ status: "transferred" }).eq("id", withdrawal_id)

      // Notify user
      await Promise.allSettled([
        db.from("notifications").insert({
          user_id: wd.user_id, type: "system",
          title:   "✅ Đã chuyển khoản thành công",
          body:    `${(wd.amount as number).toLocaleString("vi-VN")}${wd.wallet_type === "driver" ? "đ" : " xu"} đã được chuyển vào TK ${wd.bank_account}`,
          data:    { url: wd.wallet_type === "driver" ? "/driver" : "/wallet/xu" },
        }),
        sendPushToUser(wd.user_id as string, {
          title: "✅ Đã chuyển khoản",
          body:  `${(wd.amount as number).toLocaleString("vi-VN")}${wd.wallet_type === "driver" ? "đ" : " xu"} đã vào tài khoản`,
          url:   wd.wallet_type === "driver" ? "/driver" : "/wallet/xu",
          tag:   `transferred-${withdrawal_id}`,
        }),
      ])

      return NextResponse.json({ success: true })
    }

    // ── Từ chối: hoàn xu/tiền về ví ─────────────────────────────────────────
    const { error: refundErr } = await db.rpc("add_to_wallet", {
      p_user_id: wd.user_id,
      p_type:    wd.wallet_type,
      p_amount:  wd.amount,
      p_ref_id:  null,
      p_note:    `Hoàn ${wd.wallet_type === "driver" ? "tiền" : "xu"} · Từ chối: ${reject_reason}`,
      p_tx_type: "refund",
    })

    if (refundErr) {
      console.error("[Admin Withdraw Reject] refund error:", refundErr)
      return NextResponse.json({ error: `Hoàn ví thất bại: ${refundErr.message}` }, { status: 500 })
    }

    await db.from("withdrawals").update({
      status:    "failed",
      error_msg: `Admin từ chối: ${reject_reason}`,
    }).eq("id", withdrawal_id)

    // Notify user lý do từ chối
    await Promise.allSettled([
      db.from("notifications").insert({
        user_id: wd.user_id, type: "system",
        title:   "❌ Yêu cầu rút tiền bị từ chối",
        body:    `Lý do: ${reject_reason} · ${(wd.amount as number).toLocaleString("vi-VN")}${wd.wallet_type === "driver" ? "đ" : " xu"} đã được hoàn lại ví`,
        data:    { url: wd.wallet_type === "driver" ? "/driver" : "/wallet/xu" },
      }),
      sendPushToUser(wd.user_id as string, {
        title: "❌ Yêu cầu rút tiền bị từ chối",
        body:  `Lý do: ${reject_reason} · Tiền đã hoàn lại ví`,
        url:   wd.wallet_type === "driver" ? "/driver" : "/wallet/xu",
        tag:   `rejected-${withdrawal_id}`,
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Admin Withdraw] error:", err)
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
