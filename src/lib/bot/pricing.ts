import { createClient as createSupabaseClient } from "@supabase/supabase-js"

function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type ServiceType = "food" | "delivery_pkg" | "errand" | "motorbike" | "taxi"

interface PricingTable {
  rows: string[]  // phí theo km 1→10
  extra: string   // phí mỗi km thêm từ km 11+
}

export async function getPricing(): Promise<Record<ServiceType, PricingTable> | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "pricing")
    .single()
  return data?.value ?? null
}

export function calcFee(distanceKm: number, service: ServiceType, pricing: Record<ServiceType, PricingTable>): number {
  const table = pricing[service]
  if (!table) return 15000

  const km = Math.max(1, Math.ceil(distanceKm))
  if (km <= 10) {
    return parseInt(table.rows[km - 1] ?? table.rows[9])
  }
  const base = parseInt(table.rows[9])
  const extra = parseInt(table.extra)
  return base + (km - 10) * extra
}

// Haversine — tính km giữa 2 tọa độ
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export type { ServiceType, PricingTable }
