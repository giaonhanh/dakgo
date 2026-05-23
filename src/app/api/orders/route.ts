import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
    } = await req.json()

    if (!shop_id || !items?.length || !delivery_address || delivery_lat == null || delivery_lng == null) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    // Lấy giá sản phẩm từ DB (không tin giá từ client)
    const productIds: string[] = items.map((i: { product_id: string }) => i.product_id)
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, price, is_available")
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
        quantity:   item.quantity,
        subtotal:   product.price * item.quantity,
        note:       item.note ?? null,
      }
    })

    const subtotal      = orderItems.reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)
    const delivery_fee  = 15000
    const total_amount  = subtotal + delivery_fee

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
        subtotal,
        delivery_fee,
        discount_amount:  0,
        total_amount,
        payment_method,
        payment_status:   "pending",
        voucher_id:       voucher_id ?? null,
        scheduled_at:     scheduled_at ?? null,
      })
      .select("id")
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: "Không thể tạo đơn hàng" }, { status: 500 })
    }

    // Tạo order_items
    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(orderItems.map((i: { product_id: string; name: string; price: number; quantity: number; subtotal: number; note: string | null }) => ({
        order_id: order.id,
        ...i,
      })))

    if (itemsErr) {
      await supabase.from("orders").delete().eq("id", order.id)
      return NextResponse.json({ error: "Không thể lưu danh sách món" }, { status: 500 })
    }

    return NextResponse.json({ orderId: order.id, total_amount }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi server"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
