import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { getRouteKm } from "@/lib/vietmapRoute"
import { dispatchOrder, getTriedDriverIds, type DispatchTable } from "@/lib/dispatch"

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const WAVE_TIMEOUT_MINUTES = 3

async function expireStaleWaves(db: ReturnType<typeof adminDb>) {
  try {
    const cutoff = new Date(Date.now() - WAVE_TIMEOUT_MINUTES * 60 * 1000).toISOString()

    // Tìm wave cũ hơn 3 phút
    const { data: staleWaves } = await db
      .from("dispatch_waves")
      .select("order_table, order_id, driver_ids")
      .lt("updated_at", cutoff)
      .limit(3)

    if (!staleWaves?.length) return

    for (const wave of staleWaves) {
      // Optimistic lock: update updated_at — chỉ thành công nếu wave vẫn còn stale
      // (nếu instance khác đã lock trước, row sẽ không match lt("updated_at", cutoff))
      const { data: locked } = await db
        .from("dispatch_waves")
        .update({ updated_at: new Date().toISOString() })
        .eq("order_table", wave.order_table)
        .eq("order_id", wave.order_id)
        .lt("updated_at", cutoff)
        .select("order_id")

      if (!locked?.length) continue // Đã bị instance khác xử lý

      // Dispatch wave tiếp theo
      const triedIds = await getTriedDriverIds(wave.order_table as DispatchTable, wave.order_id)
      dispatchOrder(wave.order_table as DispatchTable, wave.order_id, triedIds).catch(() => {})
    }
  } catch { /* không block check-pending chính */ }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const driverLat = parseFloat(searchParams.get("driverLat") ?? "0")
    const driverLng = parseFloat(searchParams.get("driverLng") ?? "0")
    const hasDriverPos = driverLat !== 0 && driverLng !== 0
    const excludeIds = (searchParams.get("excludeIds") ?? "").split(",").filter(Boolean)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const db = adminDb()

    const { data: driver } = await db
      .from("drivers")
      .select("is_approved, status")
      .eq("id", user.id)
      .single()

    if (!driver?.is_approved || driver.status !== "online") {
      return NextResponse.json({ order: null })
    }

    // Kiểm tra + expire wave tài xế bỏ qua quá 3 phút (fire-and-forget)
    expireStaleWaves(db)

    // Trả về đơn pending hoặc accepted (merchant đã xác nhận) chưa có tài xế, bỏ qua đơn tài xế đã từ chối
    let q = db
      .from("orders")
      .select("id, shop_id, customer_id, delivery_address, delivery_lat, delivery_lng, subtotal, ship_fee, total_amount, pay_method")
      .in("status", ["pending", "accepted"])
      .is("driver_id", null)
      .order("created_at", { ascending: true })
      .limit(1)
    if (excludeIds.length > 0) q = q.not("id", "in", `(${excludeIds.join(",")})`)
    const { data: rows } = await q

    if (!rows?.length) return NextResponse.json({ order: null })

    const o = rows[0]

    const [{ data: shop }, { data: customer }, { data: items }] = await Promise.all([
      db.from("shops").select("name, address, commission_rate, lat, lng").eq("id", o.shop_id).single(),
      db.from("profiles").select("full_name").eq("id", o.customer_id).single(),
      db.from("order_items").select("name, qty, price").eq("order_id", o.id),
    ])

    const shopLat = (shop as { lat?: number } | null)?.lat ?? null
    const shopLng = (shop as { lng?: number } | null)?.lng ?? null
    const custLat = (o.delivery_lat as number | null) ?? null
    const custLng = (o.delivery_lng as number | null) ?? null

    const shopNeedsCoords = !shopLat || !shopLng

    // Tính 2 khoảng cách song song — fallback -1 nếu thiếu tọa độ
    const [distanceToShop, distanceToCustomer] = await Promise.all([
      hasDriverPos && shopLat && shopLng
        ? getRouteKm(driverLat, driverLng, shopLat, shopLng)
        : Promise.resolve(-1),
      shopLat && shopLng && custLat && custLng
        ? getRouteKm(shopLat, shopLng, custLat, custLng)
        : Promise.resolve(-1),
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
        shopLat:            shopLat ?? 0,
        shopLng:            shopLng ?? 0,
        customerName:       customer?.full_name ?? "Khách hàng",
        customerAddress:    o.delivery_address ?? "",
        custLat:            custLat ?? 0,
        custLng:            custLng ?? 0,
        distanceToShop,
        distanceToCustomer,
        shopNeedsCoords,
        items:              (items ?? []).map(i => ({ name: i.name, qty: (i as { qty?: number }).qty ?? 1, price: i.price })),
        subtotal:           o.subtotal ?? 0,
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
