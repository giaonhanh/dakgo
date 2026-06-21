import { createClient as createSupabaseClient } from "@supabase/supabase-js"

function db() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface OrderItem {
  product_id?: string
  name: string
  qty: number
  price: number
}

export interface CollectedData {
  // Chung
  phone?: string
  payment_method?: string
  note?: string
  customer_name?: string
  // Đặt đồ ăn
  shop_id?: string
  shop_name?: string
  items?: OrderItem[]
  delivery_address?: string
  delivery_lat?: number
  delivery_lng?: number
  // Giao hộ
  pickup_address?: string
  pickup_lat?: number
  pickup_lng?: number
  sender_name?: string
  sender_phone?: string
  receiver_name?: string
  receiver_phone?: string
  package_description?: string
  // Mua hộ
  items_description?: string
  estimated_items_cost?: number
  // Xe ôm / Taxi
  dropoff_address?: string
  dropoff_lat?: number
  dropoff_lng?: number
  vehicle_type?: string
  // Giá ước tính (tính trong processor trước khi show confirmation)
  estimated_subtotal?: number
  estimated_ship_fee?: number
  estimated_service_fee?: number
  estimated_total?: number
}

export type BotState =
  | "idle"
  | "collecting"
  | "confirming"
  | "creating_order"
  | "order_created"
  | "escalated"

export interface BotSession {
  sender_id: string
  state: BotState
  intent: string | null
  collected_data: CollectedData
  confusion_count: number
  updated_at?: string
}

// ─── Required fields per intent ────────────────────────────────────────────────

const REQUIRED: Record<string, (keyof CollectedData)[]> = {
  food_order:     ["shop_id", "items", "delivery_address", "phone"],
  deliver_for_me: ["pickup_address", "sender_name", "sender_phone", "delivery_address", "receiver_name", "receiver_phone"],
  buy_for_me:     ["items_description", "pickup_address", "delivery_address", "phone", "estimated_items_cost"],
  motorbike:      ["pickup_address", "dropoff_address", "phone"],
  taxi:           ["pickup_address", "dropoff_address", "phone"],
  taxi7:          ["pickup_address", "dropoff_address", "phone"],
}

const FIELD_PRIORITY: Record<string, number> = {
  pickup_address: 1, delivery_address: 1, dropoff_address: 1,
  shop_id: 2, items: 2, items_description: 2,
  phone: 3, sender_phone: 3, receiver_phone: 3,
  sender_name: 4, receiver_name: 4, customer_name: 4,
  estimated_items_cost: 5, package_description: 6,
}

export const FIELD_QUESTION: Record<string, string> = {
  shop_id:              "Bạn muốn đặt ở quán nào ạ? Nhắn tên quán hoặc tên món, mình tìm giúp nhé 😊",
  items:                "Bạn muốn đặt món gì ạ? 🍜",
  delivery_address:     "Giao đến địa chỉ nào vậy bạn? 📍",
  phone:                "Cho mình xin số điện thoại để tài xế liên hệ nhé! 📞",
  pickup_address:       "Địa chỉ lấy hàng / điểm đón ở đâu bạn? 📍",
  dropoff_address:      "Bạn muốn đến địa chỉ nào ạ? 🏠",
  sender_name:          "Tên người gửi là gì ạ?",
  sender_phone:         "Số điện thoại người gửi?",
  receiver_name:        "Tên người nhận là gì ạ?",
  receiver_phone:       "Số điện thoại người nhận?",
  package_description:  "Hàng cần giao là gì vậy bạn? (mô tả ngắn gọn)",
  items_description:    "Bạn cần mua những gì ạ? Liệt kê từng món nhé 😊",
  estimated_items_cost: "Ước tính tiền hàng khoảng bao nhiêu ạ?",
  vehicle_type:         "Bạn cần xe ôm hay taxi mấy chỗ ạ?",
}

// ─── Missing field logic ───────────────────────────────────────────────────────

export function getMissingFields(intent: string, data: CollectedData): (keyof CollectedData)[] {
  return (REQUIRED[intent] ?? [])
    .filter(f => {
      const v = data[f]
      if (v === undefined || v === null || v === "") return true
      if (Array.isArray(v) && v.length === 0) return true
      return false
    })
    .sort((a, b) => (FIELD_PRIORITY[a] ?? 9) - (FIELD_PRIORITY[b] ?? 9))
}

export function getNextMissingField(intent: string, data: CollectedData): keyof CollectedData | null {
  return getMissingFields(intent, data)[0] ?? null
}

// ─── Session CRUD ──────────────────────────────────────────────────────────────

export async function getSession(senderId: string): Promise<BotSession> {
  const { data } = await db()
    .from("chat_sessions")
    .select("*")
    .eq("sender_id", senderId)
    .maybeSingle()

  if (!data) {
    return { sender_id: senderId, state: "idle", intent: null, collected_data: {}, confusion_count: 0 }
  }
  return {
    sender_id:       data.sender_id,
    state:           (data.state as BotState) ?? "idle",
    intent:          data.intent ?? null,
    collected_data:  (data.collected_data ?? {}) as CollectedData,
    confusion_count: data.confusion_count ?? 0,
    updated_at:      data.updated_at,
  }
}

export async function saveSession(
  senderId: string,
  updates: Partial<Omit<BotSession, "sender_id">>,
): Promise<void> {
  await db()
    .from("chat_sessions")
    .upsert(
      { sender_id: senderId, ...updates, updated_at: new Date().toISOString() },
      { onConflict: "sender_id" },
    )
}

export async function resetSession(senderId: string): Promise<void> {
  // Giữ lại phone để không hỏi lại ở đơn tiếp theo
  const current    = await getSession(senderId)
  const keepPhone  = current.collected_data.phone
  await saveSession(senderId, {
    state:           "idle",
    intent:          null,
    collected_data:  keepPhone ? { phone: keepPhone } : {},
    confusion_count: 0,
  })
}

// Smart merge:
// - Không ghi đè field đã có bằng giá trị rỗng/null
// - items: qty > 0 → set quantity; qty === 0 → xóa món; item mới → thêm
export function mergeData(current: CollectedData, incoming: Partial<CollectedData>): CollectedData {
  const merged: CollectedData = { ...current }

  for (const [k, val] of Object.entries(incoming)) {
    const key = k as keyof CollectedData
    if (val === null || val === undefined || val === "") continue

    if (key === "items" && Array.isArray(val)) {
      const existing = merged.items ?? []
      let updated    = [...existing]
      for (const newItem of val as OrderItem[]) {
        const normName = (s: string) => s.toLowerCase().replace(/\s+/g, "")
        const idx = updated.findIndex(e => normName(e.name) === normName(newItem.name))

        if (newItem.qty === 0) {
          // Xóa món
          if (idx >= 0) updated.splice(idx, 1)
        } else if (idx >= 0) {
          // Cập nhật số lượng (qty từ AI là qty đích, không phải delta)
          updated[idx] = {
            ...updated[idx],
            qty:        newItem.qty   > 0 ? newItem.qty   : updated[idx].qty,
            price:      newItem.price > 0 ? newItem.price : updated[idx].price,
            product_id: newItem.product_id || updated[idx].product_id,
          }
        } else {
          // Thêm món mới
          updated.push({ ...newItem, qty: newItem.qty || 1 })
        }
      }
      merged.items = updated
    } else {
      (merged as Record<string, unknown>)[key] = val
    }
  }

  return merged
}

// ─── Confirmation summary (deterministic) ─────────────────────────────────────

export function buildConfirmationSummary(intent: string, data: CollectedData): string {
  const fmt    = (n: number) => (n / 1000).toFixed(0) + "k"
  const L: string[] = ["✅ Mình tổng kết lại đơn của bạn nhé:", ""]

  switch (intent) {
    case "food_order": {
      if (data.shop_name) L.push(`🏪 Quán: ${data.shop_name}`)
      if (data.items?.length) {
        L.push("🍜 Món đặt:")
        for (const item of data.items) {
          const pStr = item.price > 0 ? ` — ${fmt(item.price)}` : ""
          L.push(`   • ${item.name} × ${item.qty}${pStr}`)
        }
      }
      if (data.estimated_subtotal) L.push(`💰 Tiền món: ${fmt(data.estimated_subtotal)}`)
      if (data.estimated_ship_fee) L.push(`🚚 Phí ship: ~${fmt(data.estimated_ship_fee)}`)
      if (data.estimated_total)    L.push(`📊 Tổng ước tính: ~${fmt(data.estimated_total)}`)
      else                         L.push(`🚚 Phí ship: tài xế báo khi nhận đơn`)
      L.push(`📍 Giao đến: ${data.delivery_address}`)
      L.push(`📞 SĐT: ${data.phone}`)
      L.push(`💳 Thanh toán: ${!data.payment_method || data.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản"}`)
      if (data.note) L.push(`📝 Ghi chú: ${data.note}`)
      break
    }

    case "deliver_for_me":
      L.push("📦 Dịch vụ: Giao hộ")
      L.push(`📍 Lấy tại: ${data.pickup_address}`)
      L.push(`👤 Người gửi: ${data.sender_name ?? ""} — ${data.sender_phone ?? ""}`)
      L.push(`🏠 Giao đến: ${data.delivery_address}`)
      L.push(`👤 Người nhận: ${data.receiver_name ?? ""} — ${data.receiver_phone ?? ""}`)
      if (data.package_description) L.push(`📦 Hàng: ${data.package_description}`)
      if (data.estimated_service_fee) L.push(`💰 Phí dịch vụ: ~${fmt(data.estimated_service_fee)}`)
      L.push(`💳 Thanh toán: Tiền mặt`)
      break

    case "buy_for_me":
      L.push("🛒 Dịch vụ: Mua hộ")
      L.push(`🛍️ Mua tại: ${data.pickup_address}`)
      L.push(`📋 Cần mua: ${data.items_description}`)
      if (data.estimated_items_cost) L.push(`💰 Tiền hàng ước tính: ~${fmt(data.estimated_items_cost)}`)
      L.push(`🏠 Giao đến: ${data.delivery_address}`)
      L.push(`📞 SĐT: ${data.phone}`)
      if (data.estimated_total) L.push(`📊 Tổng ước tính: ~${fmt(data.estimated_total)}`)
      L.push(`💳 Thanh toán: Tiền mặt`)
      break

    case "motorbike":
      L.push("🛵 Dịch vụ: Xe ôm")
      L.push(`📍 Đón tại: ${data.pickup_address}`)
      L.push(`🏁 Đến: ${data.dropoff_address}`)
      L.push(`📞 SĐT: ${data.phone}`)
      if (data.estimated_total) L.push(`💰 Giá ước tính: ~${fmt(data.estimated_total)}`)
      break

    case "taxi":
    case "taxi7": {
      const seats = intent === "taxi7" ? "7 chỗ" : "4 chỗ"
      L.push(`🚕 Dịch vụ: Taxi ${seats}`)
      L.push(`📍 Đón tại: ${data.pickup_address}`)
      L.push(`🏁 Đến: ${data.dropoff_address}`)
      L.push(`📞 SĐT: ${data.phone}`)
      if (data.estimated_total) L.push(`💰 Giá ước tính: ~${fmt(data.estimated_total)}`)
      break
    }
  }

  L.push("", "Đúng chưa bạn? 😊")
  L.push("(Nhắn *đúng rồi* để đặt, hoặc cho mình biết cần sửa gì)")
  return L.join("\n")
}

// ─── Intent helpers ────────────────────────────────────────────────────────────

export function isConfirmation(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return /^(đúng|ok|okay|oke|được|rồi|xác nhận|đặt đi|đặt luôn|ừ|vâng|dạ|yes|chính xác|đúng rồi|đặt|tiếp tục|chuẩn|đặt nha|chuẩn rồi|ừ nhé)/.test(lower)
    || lower === "1" || lower === "✅"
}

export function isCorrection(text: string): boolean {
  return /(không|sai|đổi|thay|chỉnh|nhầm|lại|khác|sửa|chưa đúng|không phải|bỏ|xóa|thêm)/.test(text.toLowerCase())
}

export function isEscalationRequest(text: string): boolean {
  return /(người thật|nhân viên|quản lý|hỗ trợ trực tiếp|gặp người|liên hệ người|admin|số điện thoại công ty)/.test(text.toLowerCase())
}

export function isReorderRequest(text: string): boolean {
  return /(đặt lại|order lại|như (hôm qua|hôm kia|lần trước|trước đó)|gọi lại|y chang|y như|lại như cũ|đặt như cũ)/.test(text.toLowerCase())
}
