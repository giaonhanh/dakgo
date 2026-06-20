import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { ChatMessage } from "./gemini"

function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function getConversation(senderId: string, limit = 10): Promise<ChatMessage[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("bot_conversations")
    .select("role, content")
    .eq("sender_id", senderId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (!data) return []
  // Đảo ngược để đúng thứ tự thời gian (cũ → mới)
  return data.reverse().map(r => ({ role: r.role as "user" | "model", parts: r.content }))
}

export async function saveMessage(
  senderId: string,
  role: "user" | "model",
  content: string,
): Promise<void> {
  const supabase = await createClient()
  await supabase.from("bot_conversations").insert({ sender_id: senderId, role, content })
}

export async function getShopContext(): Promise<string> {
  const supabase = createClient()

  const { data: shops } = await supabase
    .from("shops")
    .select("id, name, category, is_open, address")
    .eq("status", "approved")
    .eq("is_open", true)
    .limit(20)

  if (!shops || shops.length === 0) return ""

  const shopIds = shops.map(s => s.id)
  const { data: products } = await supabase
    .from("products")
    .select("shop_id, name, price, category")
    .in("shop_id", shopIds)
    .eq("is_available", true)
    .order("sold_count", { ascending: false })
    .limit(60)

  const lines: string[] = ["QUÁN ĐANG MỞ:"]
  for (const shop of shops) {
    const items = (products ?? [])
      .filter(p => p.shop_id === shop.id)
      .slice(0, 5)
      .map(p => `${p.name} ${(p.price / 1000).toFixed(0)}k`)
      .join(", ")
    lines.push(`- ${shop.name} (${shop.category}): ${items || "xem menu tại quán"}`)
  }
  return lines.join("\n")
}

export async function logBlocked(
  senderId: string,
  message: string,
  reason: string,
): Promise<void> {
  const supabase = await createClient()
  await supabase.from("bot_blocked_logs").insert({ sender_id: senderId, message, reason })
}
