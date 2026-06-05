import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Tài xế gọi khi bật online để lấy đơn pending chưa có tài xế
// Dùng admin DB để bypass RLS (driver không có quyền SELECT orders có driver_id=null)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const db = adminDb()

    // Xác minh user là tài xế đã duyệt
    const { data: driver } = await db
      .from("drivers")
      .select("is_approved, status")
      .eq("id", user.id)
      .single()

    if (!driver?.is_approved || driver.status !== "online") {
      return NextResponse.json({ order: null })
    }

    // Tìm đơn pending: chưa có tài xế HOẶC đã gán cho tài xế này
    const { data: rows } = await db
      .from("orders")
      .select("id, shop_id, customer_id, delivery_address, total, ship_fee, total_amount, pay_method")
      .eq("status", "pending")
      .or(`driver_id.is.null,driver_id.eq.${user.id}`)
      .order("created_at", { ascending: true })
      .limit(1)

    if (!rows?.length) return NextResponse.json({ order: null })

    const o = rows[0]

    // Lấy thêm thông tin shop, khách, món
    const [{ data: shop }, { data: customer }, { data: items }] = await Promise.all([
      db.from("shops").select("name, address, commission_rate").eq("id", o.shop_id).single(),
      db.from("profiles").select("full_name").eq("id", o.customer_id).single(),
      db.from("order_items").select("name, qty, price").eq("order_id", o.id),
    ])

    const commRate  = Number(shop?.commission_rate ?? 15)
    const earnerFee = Math.round((o.ship_fee ?? 0) * (1 - commRate / 100))

    return NextResponse.json({
      order: {
        id:                 o.id.slice(0, 8).toUpperCase(),
        fullId:             o.id,
        orderTable:         "orders",
        shopName:           shop?.name ?? "Cửa hàng",
        shopAddress:        shop?.address ?? "",
        customerName:       customer?.full_name ?? "Khách hàng",
        customerAddress:    o.delivery_address ?? "",
        distanceToShop:     1.0,
        distanceToCustomer: 2.0,
        items:              (items ?? []).map(i => ({ name: i.name, qty: i.qty ?? 1, price: i.price })),
        subtotal:           o.total ?? 0,
        deliveryFee:        o.ship_fee ?? 0,
        total:              o.total_amount ?? 0,
        earnerFee,
        payMethod:          o.pay_method === "cash" ? "Tiền mặt" : "Chuyển khoản",
      },
    })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
