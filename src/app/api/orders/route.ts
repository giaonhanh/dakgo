import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as adminClient } from "@supabase/supabase-js"
import { sendPushToUser } from "@/lib/webpush"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const {
      shop_id,
      items,
      delivery_address,
      delivery_lat,
      delivery_lng,
      note,
      payment_method = "cash",
      voucher_id,
      scheduled_at,
      payment_code: clientPaymentCode,
      surcharge = 0,
      delivery_fee: clientDeliveryFee,
    } = await req.json()

    if (!shop_id || !items?.length || !delivery_address || delivery_lat == null || delivery_lng == null) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }
    const addrTrimmed = String(delivery_address).trim()
    if (addrTrimmed.length < 5) {
      return NextResponse.json({ error: "Địa chỉ giao hàng không hợp lệ" }, { status: 400 })
    }

    // Kiểm tra shop còn mở không
    const { data: shop } = await supabase
      .from("shops")
      .select("id, is_open, status")
      .eq("id", shop_id)
      .single()

    if (!shop || shop.status !== "approved") {
      return NextResponse.json({ error: "Cửa hàng không hợp lệ" }, { status: 400 })
    }
    if (!shop.is_open) {
      return NextResponse.json({ error: "Cửa hàng hiện đang đóng cửa" }, { status: 400 })
    }

    // Lấy giá sản phẩm từ DB (không tin giá từ client)
    const productIds: string[] = items.map((i: { product_id: string }) => i.product_id)
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, price, is_available")
      .in("id", productIds)
      .eq("shop_id", shop_id)

    if (prodErr || !products?.length) {
      return NextResponse.json({ error: "Sản phẩm không hợp lệ" }, { status: 400 })
    }

    const priceMap = Object.fromEntries(products.map(p => [p.id, p]))

    const orderItems = items.map((item: { product_id: string; quantity: number; note?: string }) => {
      const product = priceMap[item.product_id]
      if (!product?.is_available) throw new Error(`Sản phẩm không còn bán`)
      return {
        product_id: item.product_id,
        name:       product.name ?? "",
        price:      product.price,
        qty:        item.quantity,
        subtotal:   product.price * item.quantity,
        note:       item.note ?? null,
      }
    })

    const total    = orderItems.reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)
    const ship_fee = (clientDeliveryFee ?? 15000) + (surcharge ?? 0)

    // Validate voucher server-side
    let discount_amount = 0
    let validatedVoucherId: string | null = null

    if (voucher_id) {
      const { data: voucher, error: vErr } = await supabase
        .from("vouchers")
        .select("id, shop_id, discount_type, discount_value, min_order, max_discount, usage_limit, used_count, per_person_limit, valid_from, valid_to, is_active")
        .eq("id", voucher_id)
        .single()

      if (vErr || !voucher) {
        return NextResponse.json({ error: "Voucher không tồn tại" }, { status: 400 })
      }

      const now = new Date()
      if (!voucher.is_active) {
        return NextResponse.json({ error: "Voucher đã bị vô hiệu hóa" }, { status: 400 })
      }
      if (new Date(voucher.valid_from) > now || new Date(voucher.valid_to) < now) {
        return NextResponse.json({ error: "Voucher đã hết hạn" }, { status: 400 })
      }
      if (voucher.shop_id && voucher.shop_id !== shop_id) {
        return NextResponse.json({ error: "Voucher không áp dụng cho cửa hàng này" }, { status: 400 })
      }
      if (total < (voucher.min_order ?? 0)) {
        return NextResponse.json({ error: `Đơn tối thiểu ${(voucher.min_order ?? 0).toLocaleString("vi-VN")}đ để dùng voucher này` }, { status: 400 })
      }
      if (voucher.usage_limit != null && (voucher.used_count ?? 0) >= voucher.usage_limit) {
        return NextResponse.json({ error: "Voucher đã hết lượt sử dụng" }, { status: 400 })
      }

      // Kiểm tra per_person_limit
      if (voucher.per_person_limit != null) {
        const { count } = await supabase
          .from("voucher_usages")
          .select("id", { count: "exact", head: true })
          .eq("voucher_id", voucher_id)
          .eq("user_id", user.id)

        if ((count ?? 0) >= voucher.per_person_limit) {
          return NextResponse.json({ error: "Bạn đã dùng voucher này đủ số lần cho phép" }, { status: 400 })
        }
      }

      // Tính discount
      if (voucher.discount_type === "percent") {
        const raw = Math.round(total * voucher.discount_value / 100)
        discount_amount = voucher.max_discount != null ? Math.min(raw, voucher.max_discount) : raw
      } else if (voucher.discount_type === "fixed") {
        discount_amount = Math.min(voucher.discount_value, total)
      } else if (voucher.discount_type === "freeship") {
        const raw = ship_fee
        discount_amount = voucher.max_discount != null ? Math.min(raw, voucher.max_discount) : raw
      }

      validatedVoucherId = voucher.id
    }

    const total_amount = total + ship_fee - discount_amount

    // payment_code: từ client hoặc tạo mới nếu thanh toán online
    const payment_code = clientPaymentCode
      ?? (payment_method !== "cash" ? Math.floor(10000000 + Math.random() * 90000000) : null)

    // Tạo đơn hàng
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id:      user.id,
        shop_id,
        status:           "pending",
        delivery_address,
        delivery_lat,
        delivery_lng,
        note:             note ?? null,
        total,
        ship_fee,
        discount_amount,
        total_amount,
        pay_method:       payment_method,
        payment_code,
        voucher_id:       validatedVoucherId,
        scheduled_at:     scheduled_at ?? null,
      })
      .select("id")
      .single()

    if (orderErr || !order) {
      console.error("[orders] insert error:", orderErr?.code, orderErr?.message, orderErr?.details)
      return NextResponse.json({ error: "Không thể tạo đơn hàng", detail: orderErr?.message }, { status: 500 })
    }

    // Tạo order_items
    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(orderItems.map((i: { product_id: string; name: string; price: number; qty: number; subtotal: number; note: string | null }) => ({
        order_id: order.id,
        ...i,
      })))

    if (itemsErr) {
      await supabase.from("orders").delete().eq("id", order.id)
      return NextResponse.json({ error: "Không thể lưu danh sách món" }, { status: 500 })
    }

    // Ghi lượt dùng voucher — trigger DB tự tăng used_count
    if (validatedVoucherId) {
      await supabase.from("voucher_usages").insert({
        voucher_id: validatedVoucherId,
        user_id:    user.id,
        order_id:   order.id,
      }).then(({ error }) => {
        if (error) console.error("[orders] voucher_usages insert error:", error)
      })
    }

    // ── Notify merchant ──────────────────────────────────
    try {
      const db = adminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const { data: shop } = await db
        .from("shops").select("owner_id").eq("id", shop_id).single()
      if (shop?.owner_id) {
        const preview = (orderItems as { name: string; qty: number }[])
          .slice(0, 2).map(i => `${i.name} ×${i.qty}`).join(", ")
        const more  = orderItems.length > 2 ? ` +${orderItems.length - 2} món` : ""
        const title = "🍜 Bạn có đơn mới!"
        const body  = `${preview}${more} · ${total_amount.toLocaleString("vi-VN")}đ`
        await db.from("notifications").insert({
          user_id: shop.owner_id, type: "order", title, body,
          data: { order_id: order.id, url: "/merchant" },
        })
        await sendPushToUser(shop.owner_id, { title, body, url: "/merchant", tag: `order-${order.id}`, sound: "merchant" })
      }
    } catch { /* never fail the order */ }

    return NextResponse.json({ orderId: order.id, total_amount, payment_code }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi server"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
