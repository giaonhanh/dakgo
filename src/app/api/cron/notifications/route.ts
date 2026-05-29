import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"

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

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")
  if (process.env.NODE_ENV === "production" && secret !== `Bearer ${process.env.CRON_SECRET ?? ""}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = adminDb()

  const { data: due, error } = await db
    .from("notification_schedules")
    .select("*")
    .lte("scheduled_at", new Date().toISOString())
    .is("sent_at", null)
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due?.length) return NextResponse.json({ processed: 0 })

  let totalSent = 0

  for (const sched of due) {
    const { id, audience, title, body, type, image_url } = sched as {
      id: string; audience: string; title: string; body: string
      type: string; image_url: string | null
    }

    // Lấy users theo audience
    let q = db.from("profiles").select("id").eq("is_active", true)
    if (audience === "customers") q = q.eq("role", "customer")
    else if (audience === "drivers")   q = q.eq("role", "driver")
    else if (audience === "merchants") q = q.eq("role", "merchant")

    const { data: users } = await q
    if (!users?.length) {
      await db.from("notification_schedules").update({ sent_at: new Date().toISOString(), sent_count: 0 }).eq("id", id)
      continue
    }

    const userIds   = users.map(u => u.id)
    const validType = ["promo","system","order","ride"].includes(type) ? type : "system"

    // 1. INSERT notifications (in-app)
    const rows = userIds.map(uid => ({
      user_id: uid, type: validType, title, body,
      data: { sent_by: "admin_schedule", audience, ...(image_url ? { image_url } : {}) },
    }))
    const { error: insErr } = await db.from("notifications").insert(rows)
    if (insErr) continue

    // 2. Web Push (màn hình khoá)
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", userIds)

    if (subs?.length) {
      const payload = JSON.stringify({
        title, body,
        icon:  image_url ?? "/icon-192.png",
        badge: "/icon-192.png",
        data:  { url: "/", audience },
        tag:   `schedule-${id}`,
      })
      await Promise.allSettled(
        subs.map(s =>
          webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          ).catch(() => null)
        )
      )
    }

    await db.from("notification_schedules")
      .update({ sent_at: new Date().toISOString(), sent_count: users.length })
      .eq("id", id)

    totalSent += users.length
  }

  return NextResponse.json({ processed: due.length, sent: totalSent })
}
