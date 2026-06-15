import { createClient } from "@supabase/supabase-js"
import { sendPushToUser } from "@/lib/webpush"

export type DispatchTable = "orders" | "rides" | "errands"

const MAX_ATTEMPTS = 5

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Tọa độ tham chiếu để tìm tài xế gần nhất — khác nhau theo loại dịch vụ:
 * - orders (đồ ăn)           → gần QUÁN nhất (tài xế đến quán lấy đồ trước)
 * - rides taxi/xe_om         → gần KHÁCH nhất (điểm đón khách)
 * - errands deliver_for_me   → gần người GỬI nhất (điểm lấy hàng)
 * - errands buy_for_me       → gần địa điểm MUA nhất (pickup = nơi mua)
 */
async function getRefCoords(
  db: ReturnType<typeof adminDb>,
  table: DispatchTable,
  id: string,
): Promise<{ lat: number; lng: number } | null> {
  if (table === "orders") {
    const { data: order } = await db
      .from("orders").select("shop_id").eq("id", id).single()
    if (!order?.shop_id) return null
    const { data: shop } = await db
      .from("shops").select("lat, lng").eq("id", order.shop_id).single()
    const s = shop as { lat?: number; lng?: number } | null
    if (!s?.lat || !s?.lng) return null
    return { lat: s.lat, lng: s.lng }
  }
  if (table === "rides") {
    const { data } = await db
      .from("rides").select("pickup_lat, pickup_lng").eq("id", id).single()
    if (!data) return null
    return { lat: data.pickup_lat, lng: data.pickup_lng }
  }
  if (table === "errands") {
    const { data } = await db
      .from("errands").select("pickup_lat, pickup_lng").eq("id", id).single()
    if (!data) return null
    return { lat: data.pickup_lat, lng: data.pickup_lng }
  }
  return null
}

async function buildNotifContent(
  db: ReturnType<typeof adminDb>,
  table: DispatchTable,
  id: string,
): Promise<{ title: string; body: string }> {
  if (table === "orders") {
    const { data } = await db
      .from("orders").select("total_amount, delivery_address").eq("id", id).single()
    return {
      title: "🍜 Đơn hàng mới!",
      body:  data ? `${data.total_amount.toLocaleString("vi-VN")}đ · ${data.delivery_address}` : "",
    }
  }
  if (table === "rides") {
    const { data } = await db
      .from("rides")
      .select("estimated_fare, pickup_address, dropoff_address, vehicle_type")
      .eq("id", id).single()
    if (!data) return { title: "🛵 Chuyến đi mới!", body: "" }
    const icon  = data.vehicle_type === "taxi" ? "🚕" : "🛵"
    const label = data.vehicle_type === "taxi" ? "Taxi" : "Xe ôm"
    const fare  = data.estimated_fare
      ? ` · ${Number(data.estimated_fare).toLocaleString("vi-VN")}đ` : ""
    return {
      title: `${icon} ${label} mới!`,
      body:  `${data.pickup_address.split(",")[0]} → ${data.dropoff_address.split(",")[0]}${fare}`,
    }
  }
  if (table === "errands") {
    const { data } = await db
      .from("errands").select("service_fee, type").eq("id", id).single()
    if (!data) return { title: "📦 Đơn mới!", body: "" }
    const isBuy = data.type === "buy_for_me"
    return {
      title: isBuy ? "🛍️ Mua hộ mới!" : "📦 Giao hộ mới!",
      body:  `${isBuy ? "Mua hộ" : "Giao hộ"} · ${Number(data.service_fee).toLocaleString("vi-VN")}đ`,
    }
  }
  return { title: "🛵 Đơn mới!", body: "" }
}

async function getCustomerId(
  db: ReturnType<typeof adminDb>,
  table: DispatchTable,
  id: string,
): Promise<string | null> {
  const { data } = await db.from(table).select("customer_id").eq("id", id).single()
  return (data as { customer_id?: string } | null)?.customer_id ?? null
}

async function notifyCustomerNoDriver(
  db: ReturnType<typeof adminDb>,
  table: DispatchTable,
  id: string,
) {
  const customerId = await getCustomerId(db, table, id)
  if (!customerId) return
  await db.from("notifications").insert({
    user_id: customerId,
    type: "order",
    title: "⏳ Đang tìm tài xế",
    body:  "Hiện chưa có tài xế. Chúng tôi sẽ thông báo khi tìm được người phù hợp.",
    data:  { order_id: id, table, url: "/orders" },
  })
  await sendPushToUser(customerId, {
    title: "⏳ Đang tìm tài xế",
    body:  "Hiện chưa có tài xế phù hợp. Chúng tôi đang tiếp tục tìm.",
    url:   "/orders",
    tag:   `no-driver-${id}`,
  }).catch(() => {})
}

/**
 * Dispatch tài xế cho một đơn/chuyến/errand.
 * - Tìm tài xế gần điểm tham chiếu nhất (theo loại dịch vụ)
 * - Bỏ qua các tài xế đã được thử (triedIds)
 * - Gán driver_id vào record + push notification
 * - Sau MAX_ATTEMPTS lần thất bại: thông báo cho khách
 */
export async function dispatchOrder(
  table: DispatchTable,
  id: string,
  triedIds: string[] = [],
): Promise<{ dispatched: boolean; driverId?: string; triedIds: string[] }> {
  const db = adminDb()

  // Tọa độ điểm tham chiếu tìm tài xế
  const ref = await getRefCoords(db, table, id)

  // Tìm tài xế gần nhất (dùng RPC PostGIS)
  let driverId: string | null = null

  if (ref) {
    const { data: nearest } = await db.rpc("dispatch_nearest_driver", {
      ref_lat:     ref.lat,
      ref_lng:     ref.lng,
      exclude_ids: triedIds,
    })
    driverId = nearest as string | null
  } else {
    // Fallback khi không có tọa độ: lấy tài xế online đầu tiên chưa thử
    let q = db.from("drivers")
      .select("id")
      .eq("status", "online")
      .eq("is_approved", true)
      .limit(1)
    if (triedIds.length > 0) {
      q = q.not("id", "in", `(${triedIds.join(",")})`)
    }
    const { data } = await q
    driverId = data?.[0]?.id ?? null
  }

  if (!driverId) {
    await notifyCustomerNoDriver(db, table, id)
    return { dispatched: false, triedIds }
  }

  // Kiểm tra đơn chưa bị nhận hoặc hủy
  const { data: orderRow } = await db
    .from(table)
    .select("id, driver_id, status")
    .eq("id", id)
    .single()

  if (orderRow?.driver_id) {
    return { dispatched: false, triedIds }
  }
  if (["delivered", "cancelled"].includes(orderRow?.status ?? "")) {
    return { dispatched: false, triedIds }
  }

  // Push notification + DB notification — không gán driver_id trước (tài xế tự nhận qua RPC)
  const { title, body } = await buildNotifContent(db, table, id)
  try {
    await db.from("notifications").insert({
      user_id: driverId,
      type:    "order",
      title,
      body,
      data:    { order_id: id, table, url: "/driver" },
    })
    await sendPushToUser(driverId, {
      title, body,
      url:   "/driver",
      tag:   `dispatch-${id}`,
      sound: "driver",
    })
  } catch { /* không block dispatch */ }

  const newTriedIds = [...triedIds, driverId]

  if (newTriedIds.length >= MAX_ATTEMPTS) {
    await notifyCustomerNoDriver(db, table, id)
  }

  return { dispatched: true, driverId, triedIds: newTriedIds }
}

/**
 * Đọc danh sách tài xế đã được dispatch cho đơn này (từ bảng notifications).
 * Dùng để tái tạo triedIds khi driver từ chối.
 */
export async function getTriedDriverIds(
  table: DispatchTable,
  id: string,
): Promise<string[]> {
  const db = adminDb()
  const { data } = await db
    .from("notifications")
    .select("user_id")
    .eq("type", "order")
    .contains("data", { order_id: id, table })
  return [...new Set((data ?? []).map((n: { user_id: string }) => n.user_id))]
}
