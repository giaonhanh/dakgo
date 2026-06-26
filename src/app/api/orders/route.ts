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

    // Đọc tất cả app_settings cần thiết trong 1 query thay vì 3 query tuần tự
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["service_toggles", "service_time_pricing", "pricing"])
    const settings = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value]))

    const foodToggle = (settings["service_toggles"] as Record<string, { enabled?: boolean; customerMsg?: string }> | null)?.food
    if (foodToggle?.enabled === false) {
      return NextResponse.json({ error: foodToggle.customerMsg || "Dịch vụ đặt đồ ăn tạm ngừng phục vụ." }, { status: 400 })
    }
    const foodHours = (settings["service_time_pricing"] as Record<string, { hours?: { open: string; close: string; allDay: boolean } }> | null)?.food?.hours
    if (foodHours && !foodHours.allDay) {
      const now = new Date()
      const vnMin = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes()
      const [oh, om] = foodHours.open.split(":").map(Number)
      const [ch, cm] = foodHours.close.split(":").map(Number)
      const oMin = (oh ?? 0) * 60 + (om ?? 0)
      const cMin = (ch ?? 0) * 60 + (cm ?? 0)
      const inHours = oMin <= cMin ? vnMin >= oMin && vnMin < cMin : vnMin >= oMin || vnMin < cMin
      if (!inHours) {
        return NextResponse.json({ error: `Dịch vụ đặt đồ ăn hoạt động từ ${foodHours.open} – ${foodHours.close}. Vui lòng quay lại trong giờ phục vụ.` }, { status: 400 })
      }
    }

    // Kiểm tra shop còn mở không
    const { data: shop } = await supabase
      .from("shops")
      .select("id, is_open, status, opening_hours")
      .eq("id", shop_id)
      .single()

    if (!shop || shop.status !== "approved") {
      return NextResponse.json({ error: "Cửa hàng không hợp lệ" }, { status: 400 })
    }

    // Tính giờ thực tế VN (UTC+7) — không dùng is_open column vì cron chỉ chạy 1 lần/ngày
    function shopCurrentlyOpen(): boolean {
      const oh = shop!.opening_hours as { open?: string; close?: string } | null
      if (!oh?.open || !oh?.close) return !!shop!.is_open
      const now = new Date()
      const vnMin = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes()
      const [oh2, om] = oh.open.split(":").map(Number)
      const [ch, cm]  = oh.close.split(":").map(Number)
      const o = (oh2 ?? 0) * 60 + (om ?? 0)
      const c = (ch  ?? 0) * 60 + (cm ?? 0)
      return c > o ? vnMin >= o && vnMin < c : vnMin >= o || vnMin < c
    }
    if (!shopCurrentlyOpen()) {
      return NextResponse.json({ error: "Cửa hàng hiện đang đóng cửa" }, { status: 400 })
    }

    // Lấy giá sản phẩm từ DB (không tin giá từ client)
    const productIds: string[] = items.map((i: { product_id: string }) => i.product_id)
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, price, is_available, all_day, start_hour, end_hour")
      .in("id", productIds)
      .eq("shop_id", shop_id)

    if (prodErr || !products?.length) {
      return NextResponse.json({ error: "Sản phẩm không hợp lệ" }, { status: 400 })
    }

    // Món chỉ bán trong khung giờ nhất định (vd. đồ ăn sáng) — chặn đặt ngoài giờ
    function productInSellingHours(p: { all_day?: boolean | null; start_hour?: string | null; end_hour?: string | null }): boolean {
      if (p.all_day !== false) return true
      const now = new Date()
      const cur = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes()
      const [sh, sm] = (p.start_hour ?? "00:00").split(":").map(Number)
      const [eh, em] = (p.end_hour   ?? "23:59").split(":").map(Number)
      const start = sh * 60 + sm, end = eh * 60 + em
      return start <= end ? cur >= start && cur < end : cur >= start || cur < end
    }
    const outOfHoursProduct = products.find(p => !productInSellingHours(p))
    if (outOfHoursProduct) {
      return NextResponse.json({ error: `Xin lỗi, "${outOfHoursProduct.name}" hiện đang ngoài khung giờ bán của cửa hàng` }, { status: 400 })
    }

    const priceMap = Object.fromEntries(products.map(p => [p.id, p]))

    const orderItems = items.map((item: { product_id: string; quantity: number; note?: string; breakdown?: { basePrice: number; sizeLabel?: string; sizeDiff?: number; toppings?: { name: string; price: number }[] } | null }) => {
      const product = priceMap[item.product_id]
      if (!product?.is_available) throw new Error(`Sản phẩm không còn bán`)
      const bd = item.breakdown ?? null
      const extraPrice = (bd?.sizeDiff ?? 0) + (bd?.toppings?.reduce((s, t) => s + t.price, 0) ?? 0)
      const unitPrice  = product.price + extraPrice
      return {
        product_id: item.product_id,
        name:       product.name ?? "",
        price:      unitPrice,
        qty:        item.quantity,
        subtotal:   unitPrice * item.quantity,
        note:       item.note ?? null,
        options:    bd,
      }
    })

    const total    = orderItems.reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)
    // Fallback: dùng pricing đã load sẵn ở trên — không cần query thêm
    let fallbackShipFee = 15000
    if (clientDeliveryFee == null) {
      const rows = (settings["pricing"] as Record<string, { rows?: string[] }> | null)?.food?.rows
      const firstKm = parseInt(rows?.[0] ?? "0")
      if (firstKm > 0) fallbackShipFee = firstKm
    }
    const ship_fee = (clientDeliveryFee ?? fallbackShipFee) + (surcharge ?? 0)

    // Validate voucher server-side
    let discount_amount = 0
    let validatedVoucherId: string | null = null

    if (voucher_id) {
      const { data: voucher, error: vErr } = await supabase
        .from("vouchers")
        .select("id, shop_id, discount_type, discount_value, min_order, max_discount, usage_limit, used_count, per_person_limit, valid_from, valid_to, is_active, is_combo, combo_items(product_id, min_quantity)")
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

      // Validate combo: kiểm tra server-side giỏ hàng có đủ sản phẩm yêu cầu
      if (voucher.is_combo && voucher.combo_items?.length) {
        const cartMap: Record<string, number> = {}
        for (const item of items) {
          const pid = item.product_id as string
          cartMap[pid] = (cartMap[pid] ?? 0) + (item.quantity as number)
        }
        const unmet = (voucher.combo_items as { product_id: string; min_quantity: number }[])
          .filter(ci => (cartMap[ci.product_id] ?? 0) < ci.min_quantity)
        if (unmet.length > 0) {
          return NextResponse.json({ error: "Giỏ hàng chưa đủ điều kiện để dùng voucher combo này" }, { status: 400 })
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
      // combo dùng chung discount_type (fixed/percent) đã xử lý ở trên

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
      .insert(orderItems.map((i: { product_id: string; name: string; price: number; qty: number; subtotal: number; note: string | null; options: unknown }) => ({
        order_id:   order.id,
        product_id: i.product_id,
        name:       i.name,
        price:      i.price,
        qty:        i.qty,
        note:       i.note,
        options:    i.options ?? null,
      })))

    if (itemsErr) {
      console.error("[orders] order_items insert error:", itemsErr.code, itemsErr.message, itemsErr.details)
      await supabase.from("orders").delete().eq("id", order.id)
      return NextResponse.json({ error: "Không thể lưu danh sách món", detail: itemsErr.message }, { status: 500 })
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

    // Merchant notification xử lý bởi /api/orders/parallel-dispatch (gọi song song từ checkout)
    return NextResponse.json({ orderId: order.id, total_amount, payment_code }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi server"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
