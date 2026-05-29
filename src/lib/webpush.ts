// Server-only — dùng trong API routes, không import từ client components
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface PushPayload {
  title: string
  body:  string
  url?:  string
  tag?:  string
}

async function dispatchToSubs(
  subs: { endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload,
) {
  if (!subs.length) return
  const message = JSON.stringify({
    title:              payload.title,
    body:               payload.body,
    icon:               "/icon-192.png",
    badge:              "/icon-192.png",
    vibrate:            [300, 100, 300, 100, 300],
    requireInteraction: true,
    tag:                payload.tag ?? `notif-${Date.now()}`,
    data:               { url: payload.url ?? "/" },
  })
  await Promise.allSettled(
    subs.map(s =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        message,
      ).catch(() => null),
    ),
  )
}

/** Gửi push tới 1 user cụ thể (merchant/customer) */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const db = adminDb()
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
  await dispatchToSubs(subs ?? [], payload)
}

/** Gửi push tới tất cả tài xế đang có subscription */
export async function sendPushToDrivers(payload: PushPayload) {
  const db = adminDb()
  const { data: profiles } = await db
    .from("profiles")
    .select("id")
    .eq("role", "driver")
  if (!profiles?.length) return
  const ids = profiles.map(p => p.id)
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", ids)
  await dispatchToSubs(subs ?? [], payload)
}
