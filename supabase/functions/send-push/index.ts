import webpush from "npm:web-push"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!

webpush.setVapidDetails(
  "mailto:hongmy.daklak@gmail.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
)

interface PushPayload {
  user_id: string
  title:   string
  body:    string
  url?:    string
  tag?:    string
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const { user_id, title, body, url, tag }: PushPayload = await req.json()
  if (!user_id || !title || !body) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user_id)

  if (error || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  // BUG-001: derive url từ tag nếu caller không truyền url
  const resolvedUrl = url
    ?? (tag?.startsWith("order-") ? `/tracking/${tag.replace(/^order-/, "")}` : null)
    ?? (tag?.startsWith("ride-")  ? `/orders` : null)
    ?? "/"

  const payload = JSON.stringify({
    title,
    body,
    data: { url: resolvedUrl },
    tag:  tag ?? "default",
  })

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    )
  )

  // Xóa subscription hết hạn (endpoint trả 410 Gone)
  const expired = results
    .map((r, i) => ({ r, sub: subs[i] }))
    .filter(({ r }) => r.status === "rejected" &&
      (r.reason as { statusCode?: number })?.statusCode === 410)
    .map(({ sub }) => sub.endpoint)

  if (expired.length > 0) {
    await supabase.from("push_subscriptions")
      .delete()
      .in("endpoint", expired)
  }

  const sent = results.filter(r => r.status === "fulfilled").length
  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})
