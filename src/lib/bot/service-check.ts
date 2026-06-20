import { createClient as createSupabaseClient } from "@supabase/supabase-js"

function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Map từ intent → service key trong DB
export const SERVICE_KEY_MAP: Record<string, string> = {
  food:      "food",
  motorbike: "motorbike",
  taxi:      "taxi_4cho",
  taxi7:     "taxi_7cho",
  mua_ho:    "mua_ho",
  giao_ho:   "giao_ho",
}

export type ServiceKey = "food" | "motorbike" | "taxi" | "taxi7" | "mua_ho" | "giao_ho"

export interface ServiceStatus {
  available: boolean
  reason?: string        // lý do khoá (admin nhập)
  customerMsg?: string   // tin nhắn hiển thị cho khách
}

function getNowVN(): { h: number; m: number } {
  const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour12: false })
  const [, time] = now.split(", ")
  const [hStr, mStr] = time.split(":")
  return { h: parseInt(hStr), m: parseInt(mStr) }
}

function isWithinHours(open: string, close: string): boolean {
  const { h, m } = getNowVN()
  const nowMin = h * 60 + m
  const [oh, om] = open.split(":").map(Number)
  const [ch, cm] = close.split(":").map(Number)
  const openMin  = oh * 60 + om
  const closeMin = ch * 60 + cm
  return nowMin >= openMin && nowMin <= closeMin
}

export async function checkServiceAvailable(service: ServiceKey): Promise<ServiceStatus> {
  const supabase = createClient()

  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["service_toggles", "service_time_pricing"])

  if (!data) return { available: true }

  const map = Object.fromEntries(data.map(r => [r.key, r.value]))

  // 1. Kiểm tra toggle (khoá thủ công)
  const dbKey = SERVICE_KEY_MAP[service] ?? service
  if (map.service_toggles) {
    const toggle = (map.service_toggles as Record<string, { enabled?: boolean; customerMsg?: string }>)[dbKey]
    if (toggle && toggle.enabled === false) {
      return {
        available: false,
        customerMsg: toggle.customerMsg || `Dịch vụ này tạm thời chưa hoạt động bạn ơi 😔`,
      }
    }
  }

  // 2. Kiểm tra giờ hoạt động
  if (map.service_time_pricing) {
    const svcTime = (map.service_time_pricing as Record<string, {
      hours?: { open: string; close: string; allDay: boolean }
    }>)[service]

    if (svcTime?.hours && !svcTime.hours.allDay) {
      const { open, close } = svcTime.hours
      if (!isWithinHours(open, close)) {
        const { h, m } = getNowVN()
        const nowStr = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`
        return {
          available: false,
          customerMsg: `Hiện tại ${nowStr} ngoài giờ hoạt động rồi bạn ơi 😔\nDịch vụ này hoạt động từ ${open}–${close}.\nBạn có muốn đặt trước cho lần sau không?`,
        }
      }
    }
  }

  return { available: true }
}

// Detect loại dịch vụ từ tin nhắn
export function detectServiceType(text: string): ServiceKey | null {
  const lower = text.toLowerCase()
  if (/(xe ôm|xeôm|xe om|xe ôm|đặt xe|chạy xe)/.test(lower))  return "motorbike"
  if (/(taxi 7|7 chỗ|7 cho)/.test(lower))                       return "taxi7"
  if (/(taxi|ô tô|xe hơi|xe 4)/.test(lower))                    return "taxi"
  if (/(mua hộ|mua ho|đi chợ|đi cho|mua giúp|mua hàng)/.test(lower)) return "mua_ho"
  if (/(giao hộ|giao ho|giao giúp|giao đồ|giao bưu|ship hộ)/.test(lower)) return "giao_ho"
  if (/(đặt|giao|đồ ăn|cơm|bún|phở|bánh|gà|bò|ăn|món|quán)/.test(lower)) return "food"
  return null
}

export const SERVICE_LABEL: Record<ServiceKey, string> = {
  food:      "Đặt đồ ăn",
  motorbike: "Xe ôm",
  taxi:      "Taxi 4 chỗ",
  taxi7:     "Taxi 7 chỗ",
  mua_ho:    "Mua hộ",
  giao_ho:   "Giao hộ",
}
