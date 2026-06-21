/**
 * Layer 10: Order Engine
 * Tạo đơn thật vào Supabase sau khi khách xác nhận
 * Dùng service role key — bypass RLS
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { BotSession, CollectedData, OrderItem } from "./session"
import { calcFee, getPricing } from "./pricing"
import { geocodeAddress, distanceKm } from "./geo"

function db() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface OrderResult {
  success: boolean
  orderId?: string
  displayId?: string  // 6 ký tự cuối viết hoa — hiển thị cho khách
  error?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("84") && digits.length >= 10) return "0" + digits.slice(2)
  if (digits.startsWith("0") && digits.length === 10) return digits
  return digits
}

// Tìm profile theo SĐT hoặc tạo auth user mới → trigger tạo profile
async function findOrCreateProfile(phone: string, name?: string): Promise<string | null> {
  const supabase    = db()
  const normalized  = normalizePhone(phone)

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone", normalized)
    .maybeSingle()

  if (existing?.id) return existing.id

  try {
    const { data: authData, error } = await supabase.auth.admin.createUser({
      phone:         normalized,
      phone_confirm: true,
      user_metadata: { full_name: name ?? "Khách DakGo", source: "messenger_bot" },
    })

    if (error || !authData?.user?.id) {
      console.error("[order-creator] createUser:", error?.message)
      return null
    }

    // Chờ trigger handle_new_user
    await new Promise(r => setTimeout(r, 300))

    if (name) {
      await supabase.from("profiles")
        .update({ full_name: name })
        .eq("id", authData.user.id)
    }

    return authData.user.id
  } catch (e) {
    console.error("[order-creator] findOrCreateProfile:", e)
    return null
  }
}

async function getShopCoords(shopId: string): Promise<{ lat: number; lng: number } | null> {
  const { data } = await db()
    .from("shops").select("location").eq("id", shopId).single()
  if (!data?.location) return null
  const geo = data.location as { coordinates?: [number, number] }
  if (!geo.coordinates) return null
  const [lng, lat] = geo.coordinates
  return { lat, lng }
}

function shortId(id: string): string {
  return id.slice(-6).toUpperCase()
}

// ─── Notify merchant (best effort) ─────────────────────────────────────────────

async function notifyMerchant(
  shopId: string,
  orderId: string,
  items: OrderItem[] | undefined,
  totalAmount: number,
): Promise<void> {
  try {
    const supabase = db()
    const { data: shop } = await supabase
      .from("shops").select("owner_id").eq("id", shopId).single()
    if (!shop?.owner_id) return

    const preview = (items ?? []).slice(0, 2).map(i => `${i.name} ×${i.qty}`).join(", ")
    const more    = (items?.length ?? 0) > 2 ? ` +${(items!.length) - 2} món` : ""
    const title   = "🍜 Bạn có đơn mới! (Messenger)"
    const body    = `${preview}${more} · ${totalAmount.toLocaleString("vi-VN")}đ`

    await supabase.from("notifications").insert({
      user_id: shop.owner_id, type: "order", title, body,
      data: { order_id: orderId, url: "/merchant" },
    })
  } catch { /* never fail the order */ }
}

// ─── Food Order ─────────────────────────────────────────────────────────────────

async function createFoodOrder(d: CollectedData): Promise<OrderResult> {
  if (!d.shop_id || !d.items?.length || !d.delivery_address || !d.phone) {
    return { success: false, error: "Thiếu thông tin đặt đơn" }
  }

  const supabase = db()

  // Geocode nếu chưa có tọa độ
  const deliveryCoords = (d.delivery_lat && d.delivery_lng)
    ? { lat: d.delivery_lat, lng: d.delivery_lng }
    : await geocodeAddress(d.delivery_address)

  // Tìm/tạo customer
  const customerId = await findOrCreateProfile(d.phone, d.customer_name)
  if (!customerId) return { success: false, error: "Không thể xác định khách hàng. Vui lòng thử lại!" }

  // Tính phí ship
  const shopCoords  = await getShopCoords(d.shop_id)
  const pricing     = await getPricing()
  let   shipFee     = 15000
  if (shopCoords && pricing) {
    const km = distanceKm(shopCoords, deliveryCoords)
    shipFee  = calcFee(Math.max(km, 1), "food", pricing)
  }

  // Resolve product_id cho item gõ tay (chưa có product_id từ menu)
  const items = d.items.map(i => ({ ...i })) // clone
  const needResolve = items.filter(i => !i.product_id)

  if (needResolve.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, price")
      .eq("shop_id", d.shop_id)
      .eq("is_available", true)

    const productMap: Record<string, { id: string; price: number }> = {}
    for (const p of products ?? []) {
      productMap[p.name.toLowerCase().replace(/\s+/g, "")] = { id: p.id, price: p.price }
    }

    for (const item of items) {
      if (!item.product_id) {
        const key   = item.name.toLowerCase().replace(/\s+/g, "")
        const found = productMap[key]
          ?? Object.entries(productMap).find(([k]) => k.includes(key) || key.includes(k))?.[1]
        if (found) {
          item.product_id = found.id
          if (!item.price) item.price = found.price
        }
      }
    }
  }

  const validItems = items.filter(i => i.product_id)
  if (validItems.length === 0) {
    return {
      success: false,
      error:   "Không tìm thấy món trong menu quán. Bạn chọn món qua nút *Xem menu* nhé!",
    }
  }

  const subtotal    = validItems.reduce((s, i) => s + i.price * i.qty, 0)
  const totalAmount = subtotal + shipFee

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      customer_id:      customerId,
      shop_id:          d.shop_id,
      status:           "pending",
      delivery_address: d.delivery_address,
      delivery_lat:     deliveryCoords.lat,
      delivery_lng:     deliveryCoords.lng,
      note:             d.note ?? null,
      total:            subtotal,
      ship_fee:         shipFee,
      discount_amount:  0,
      total_amount:     totalAmount,
      pay_method:       d.payment_method ?? "cash",
    })
    .select("id")
    .single()

  if (error || !order) {
    console.error("[order-creator] food insert:", error?.code, error?.message)
    return { success: false, error: "Lỗi tạo đơn. Bạn thử lại nhé!" }
  }

  await supabase.from("order_items").insert(
    validItems.map(i => ({
      order_id:   order.id,
      product_id: i.product_id!,
      name:       i.name,
      price:      i.price,
      qty:        i.qty,
      subtotal:   i.price * i.qty,
      note:       null,
    })),
  )

  notifyMerchant(d.shop_id, order.id, validItems, totalAmount)

  return { success: true, orderId: order.id, displayId: shortId(order.id) }
}

// ─── Ride Order (Xe ôm / Taxi) ──────────────────────────────────────────────────

async function createRideOrder(d: CollectedData, intent: string): Promise<OrderResult> {
  if (!d.pickup_address || !d.dropoff_address || !d.phone) {
    return { success: false, error: "Thiếu thông tin đặt xe" }
  }

  const supabase   = db()
  const customerId = await findOrCreateProfile(d.phone, d.customer_name)
  if (!customerId) return { success: false, error: "Không thể xác định khách hàng" }

  const [pickup, dropoff] = await Promise.all([
    (d.pickup_lat && d.pickup_lng)
      ? Promise.resolve({ lat: d.pickup_lat, lng: d.pickup_lng })
      : geocodeAddress(d.pickup_address),
    (d.dropoff_lat && d.dropoff_lng)
      ? Promise.resolve({ lat: d.dropoff_lat, lng: d.dropoff_lng })
      : geocodeAddress(d.dropoff_address),
  ])

  const km           = distanceKm(pickup, dropoff)
  const pricing      = await getPricing()
  const estimateFare = pricing ? calcFee(Math.max(km, 1), "motorbike", pricing) : 15000
  const vehicleType  = intent === "taxi7" ? "car_7" : intent === "taxi" ? "car_4" : "motorbike"

  const { data: ride, error } = await supabase
    .from("rides")
    .insert({
      customer_id:     customerId,
      status:          "searching",
      vehicle_type:    vehicleType,
      pickup_address:  d.pickup_address,
      pickup_lat:      pickup.lat,
      pickup_lng:      pickup.lng,
      dropoff_address: d.dropoff_address,
      dropoff_lat:     dropoff.lat,
      dropoff_lng:     dropoff.lng,
      distance_km:     Math.round(km * 10) / 10,
      estimated_fare:  estimateFare,
      payment_method:  d.payment_method ?? "cash",
    })
    .select("id")
    .single()

  if (error || !ride) {
    console.error("[order-creator] ride insert:", error?.message)
    return { success: false, error: "Lỗi tạo yêu cầu xe" }
  }

  return { success: true, orderId: ride.id, displayId: shortId(ride.id) }
}

// ─── Errand Order (Giao hộ / Mua hộ) ──────────────────────────────────────────

async function createErrandOrder(d: CollectedData, intent: string): Promise<OrderResult> {
  const isDelivery = intent === "deliver_for_me"
  const phone      = isDelivery ? d.sender_phone : d.phone
  const name       = isDelivery ? d.sender_name  : d.customer_name

  if (!d.pickup_address || !d.delivery_address || !phone) {
    return { success: false, error: "Thiếu thông tin yêu cầu" }
  }

  const supabase   = db()
  const customerId = await findOrCreateProfile(phone!, name)
  if (!customerId) return { success: false, error: "Không thể xác định khách hàng" }

  const [pickup, delivery] = await Promise.all([
    (d.pickup_lat && d.pickup_lng)
      ? Promise.resolve({ lat: d.pickup_lat, lng: d.pickup_lng })
      : geocodeAddress(d.pickup_address),
    (d.delivery_lat && d.delivery_lng)
      ? Promise.resolve({ lat: d.delivery_lat, lng: d.delivery_lng })
      : geocodeAddress(d.delivery_address),
  ])

  const pricing    = await getPricing()
  const km         = distanceKm(pickup, delivery)
  const svcKey     = isDelivery ? "delivery_pkg" : "errand"
  const serviceFee = pricing
    ? calcFee(Math.max(km, 1), svcKey as "delivery_pkg", pricing)
    : 25000

  const { data: errand, error } = await supabase
    .from("errands")
    .insert({
      customer_id:          customerId,
      type:                 isDelivery ? "deliver_for_me" : "buy_for_me",
      status:               "pending",
      pickup_address:       d.pickup_address,
      pickup_lat:           pickup.lat,
      pickup_lng:           pickup.lng,
      delivery_address:     d.delivery_address,
      delivery_lat:         delivery.lat,
      delivery_lng:         delivery.lng,
      items_description:    d.items_description ?? null,
      estimated_items_cost: d.estimated_items_cost ?? null,
      package_description:  d.package_description ?? null,
      note:                 d.note ?? null,
      service_fee:          serviceFee,
      payment_method:       d.payment_method ?? "cash",
    })
    .select("id")
    .single()

  if (error || !errand) {
    console.error("[order-creator] errand insert:", error?.message)
    return { success: false, error: "Lỗi tạo yêu cầu" }
  }

  return { success: true, orderId: errand.id, displayId: shortId(errand.id) }
}

// ─── Dispatcher ────────────────────────────────────────────────────────────────

export async function createOrder(session: BotSession): Promise<OrderResult> {
  const { intent, collected_data } = session
  switch (intent) {
    case "food_order":     return createFoodOrder(collected_data)
    case "motorbike":
    case "taxi":
    case "taxi7":          return createRideOrder(collected_data, intent)
    case "deliver_for_me":
    case "buy_for_me":     return createErrandOrder(collected_data, intent)
    default:               return { success: false, error: "Loại dịch vụ không xác định" }
  }
}
