import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { dispatchOrder } from "@/lib/dispatch"
import { sendPushToUser } from "@/lib/webpush"

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Parallel dispatch: notify merchant + dispatch driver cùng lúc
// Gọi từ checkout ngay sau khi tạo order — không cần auth (dùng service role)
export async function POST(req: NextRequest) {
  try {
    const { order_id } = await req.json()
    if (!order_id) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 })

    const db = adminDb()

    // Lấy thông tin đơn + shop + merchant (KHÔNG join shop_type để tránh lỗi nếu cột chưa có)
    const { data: order, error: orderErr } = await db
      .from("orders")
      .select("id, total_amount, ship_fee, delivery_address, shop_id, customer_id, status, shops(owner_id, name)")
      .eq("id", order_id)
      .single()

    if (orderErr) {
      console.error("parallel-dispatch: query error", orderErr)
      return NextResponse.json({ error: "Lỗi truy vấn đơn hàng", detail: orderErr.message }, { status: 500 })
    }
    if (!order) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 })
    if (order.status === "cancelled") return NextResponse.json({ skipped: true })

    type ShopRef = { owner_id: string; name: string } | { owner_id: string; name: string }[] | null
    const shopRef    = order.shops as ShopRef
    const shop       = Array.isArray(shopRef) ? shopRef[0] : shopRef
    const merchantId = shop?.owner_id
    const shortId    = order_id.slice(0, 8).toUpperCase()

    // Lấy shop_type riêng — cột này có thể không tồn tại, dùng try/catch để không block
    let shopType: string | null = null
    try {
      const { data: shopRow } = await db
        .from("shops").select("shop_type").eq("id", order.shop_id).single()
      shopType = (shopRow as { shop_type?: string | null } | null)?.shop_type ?? null
    } catch { /* shop_type chưa có trong DB, bỏ qua */ }

    // Quán Mua hộ (shop_type = "delivery") không cần merchant xác nhận — tự động accept
    const isBuyForMe = shopType === "delivery"

    // ── 1. Notify merchant (chỉ quán Đối tác — Mua hộ bỏ qua) ───────
    if (merchantId && !isBuyForMe) {
      const total = Number(order.total_amount).toLocaleString("vi-VN")
      await Promise.all([
        sendPushToUser(merchantId, {
          title: "🍜 Đơn hàng mới!",
          body:  `#${shortId} · ${total}đ · ${order.delivery_address}`,
          url:   "/merchant",
          tag:   `new-order-${order_id}`,
          sound: "new-order",
        }).catch(() => {}),
        db.from("notifications").insert({
          user_id: merchantId,
          type:    "order",
          title:   "🍜 Đơn hàng mới!",
          body:    `#${shortId} · ${total}đ · ${order.delivery_address}`,
          data:    { order_id, url: "/merchant" },
        }),
      ])
    }

    // ── 1b. Quán Mua hộ: auto accept, tài xế nhận luôn ─────────────
    if (isBuyForMe) {
      await db.from("orders").update({
        status:      "accepted",
        accepted_at: new Date().toISOString(),
      }).eq("id", order_id)
    }

    // ── 2. Dispatch tài xế gần nhất ──────────────────────────────────
    const dispatchResult = await dispatchOrder("orders", order_id, [])

    // ── 3. Notify khách: đang tìm tài xế (chỉ khi có tài xế được gửi) ──
    if (dispatchResult.dispatched) {
      Promise.resolve(db.from("notifications").insert({
        user_id: order.customer_id,
        type:    "order",
        title:   "🛵 Đang tìm tài xế",
        body:    `Đơn #${shortId} đã tiếp nhận — đang tìm tài xế gần nhất cho bạn.`,
        data:    { order_id, url: `/tracking/${order_id}` },
      })).catch(() => {})
    }

    return NextResponse.json({
      ok:         true,
      dispatched: dispatchResult.dispatched,
      driverIds:  dispatchResult.driverIds,
    })
  } catch (err) {
    console.error("parallel-dispatch error:", err)
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
