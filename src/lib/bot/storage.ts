import { createClient } from "@/lib/supabase/server"
import type { ChatMessage } from "./gemini"

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

export async function logBlocked(
  senderId: string,
  message: string,
  reason: string,
): Promise<void> {
  const supabase = await createClient()
  await supabase.from("bot_blocked_logs").insert({ sender_id: senderId, message, reason })
}
