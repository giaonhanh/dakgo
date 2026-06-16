import type { SupabaseClient } from "@supabase/supabase-js"

export type CancelRole = "customer" | "driver" | "merchant"

// Ngưỡng khoá tài khoản theo vai trò — vượt ngưỡng = blacklist (is_active=false + ghi bảng blacklist)
const RULES: Record<CancelRole, { windowMs: number; limit: number; reason: string }> = {
  customer: { windowMs: 3 * 86_400_000, limit: 3, reason: "Khách hàng hủy đơn quá 3 lần trong 3 ngày" },
  driver:   { windowMs: 1 * 86_400_000, limit: 4, reason: "Tài xế hủy nhận đơn quá 3 lần trong 1 ngày" },
  merchant: { windowMs: 7 * 86_400_000, limit: 5, reason: "Cửa hàng hủy đơn quá 5 lần trong 1 tuần" },
}

/** Kiểm tra user (customer/driver) hoặc chủ shop (merchant) đã bị blacklist chưa */
export async function isBlacklisted(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("blacklist").select("user_id").eq("user_id", userId).maybeSingle()
  return !!data
}

/**
 * Ghi log một lần hủy + đếm số lần hủy trong khung thời gian tương ứng vai trò.
 * Vượt ngưỡng → tự động blacklist (is_active=false + insert blacklist, auto_triggered=true).
 */
export async function logCancelAndCheckLock(
  supabase: SupabaseClient,
  role: CancelRole,
  userId: string,
  orderId: string,
  reason: string,
): Promise<{ locked: boolean; count: number; limit: number }> {
  const rule = RULES[role]
  const nowIso = new Date().toISOString()

  await supabase.from("cancel_logs").insert({
    order_id: orderId, user_id: userId, role, reason, cancelled_at: nowIso,
  })

  const since = new Date(Date.now() - rule.windowMs).toISOString()
  const { count } = await supabase
    .from("cancel_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId).eq("role", role).gte("cancelled_at", since)
  const total = count ?? 0

  if (total >= rule.limit) {
    await supabase.from("profiles").update({ is_active: false }).eq("id", userId)
    await supabase.from("blacklist").upsert({ user_id: userId, reason: rule.reason, auto_triggered: true })
  }

  return { locked: total >= rule.limit, count: total, limit: rule.limit }
}
