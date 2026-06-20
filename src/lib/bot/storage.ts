import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { ChatMessage } from "./gemini"

function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Lọc bỏ các dòng metadata (__STATE__, __LOC__) trước khi gửi cho Groq
export async function getConversation(senderId: string, limit = 10): Promise<ChatMessage[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("bot_conversations")
    .select("role, content")
    .eq("sender_id", senderId)
    .not("content", "like", "__%")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (!data) return []
  return data.reverse().map(r => ({ role: r.role as "user" | "model", parts: r.content }))
}

export async function saveMessage(
  senderId: string,
  role: "user" | "model",
  content: string,
): Promise<void> {
  const supabase = createClient()
  await supabase.from("bot_conversations").insert({ sender_id: senderId, role, content })
}

// ─── State machine (A→B→C location flow) ────────────────────────────────────

export type LocationState = "idle" | "awaiting_location" | "awaiting_address" | "done"

export async function getState(senderId: string): Promise<LocationState> {
  const supabase = createClient()
  const { data } = await supabase
    .from("bot_conversations")
    .select("content")
    .eq("sender_id", senderId)
    .like("content", "__STATE__%")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!data) return "idle"
  return (data.content.replace("__STATE__:", "") as LocationState) ?? "idle"
}

export async function setState(senderId: string, state: LocationState): Promise<void> {
  const supabase = createClient()
  await supabase.from("bot_conversations").insert({
    sender_id: senderId,
    role: "user",
    content: `__STATE__:${state}`,
  })
}

export async function saveLocation(senderId: string, lat: number, lng: number): Promise<void> {
  const supabase = createClient()
  await supabase.from("bot_conversations").insert({
    sender_id: senderId,
    role: "user",
    content: `__LOC__:${lat},${lng}`,
  })
}

export async function getLocation(senderId: string): Promise<{ lat: number; lng: number } | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("bot_conversations")
    .select("content")
    .eq("sender_id", senderId)
    .like("content", "__LOC__%")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!data) return null
  const [lat, lng] = data.content.replace("__LOC__:", "").split(",").map(Number)
  return { lat, lng }
}

// ─── Shop context ────────────────────────────────────────────────────────────

export async function getShopContext(): Promise<string> {
  const supabase = createClient()

  const { data: shops } = await supabase
    .from("shops")
    .select("id, name, category, is_open, address, location")
    .eq("status", "approved")
    .limit(30)

  if (!shops || shops.length === 0) return ""

  const shopIds = shops.map(s => s.id)
  const { data: products } = await supabase
    .from("products")
    .select("shop_id, name, price, category")
    .in("shop_id", shopIds)
    .eq("is_available", true)
    .order("sold_count", { ascending: false })
    .limit(80)

  const open = shops.filter(s => s.is_open)
  const closed = shops.filter(s => !s.is_open)
  const lines: string[] = []

  if (open.length > 0) {
    lines.push("QUÁN ĐANG MỞ:")
    for (const shop of open) {
      const items = (products ?? [])
        .filter(p => p.shop_id === shop.id)
        .slice(0, 5)
        .map(p => `${p.name} ${(p.price / 1000).toFixed(0)}k`)
        .join(", ")
      lines.push(`- ${shop.name} (${shop.category}): ${items || "xem menu tại quán"}`)
    }
  }

  if (closed.length > 0) {
    lines.push("QUÁN ĐANG ĐÓNG CỬA:")
    for (const shop of closed) {
      lines.push(`- ${shop.name} (${shop.category})`)
    }
  }

  return lines.join("\n")
}

// ─── Shop location lookup ────────────────────────────────────────────────────

export async function getShopLocation(shopName: string): Promise<{ lat: number; lng: number } | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("shops")
    .select("location")
    .ilike("name", `%${shopName}%`)
    .eq("status", "approved")
    .limit(1)
    .single()

  if (!data?.location) return null
  // PostGIS GEOGRAPHY trả về dạng GeoJSON
  const geo = data.location as { coordinates?: [number, number] }
  if (!geo.coordinates) return null
  const [lng, lat] = geo.coordinates
  return { lat, lng }
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export async function logBlocked(
  senderId: string,
  message: string,
  reason: string,
): Promise<void> {
  const supabase = createClient()
  await supabase.from("bot_blocked_logs").insert({ sender_id: senderId, message, reason })
}
