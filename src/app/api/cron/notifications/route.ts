import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Vercel Cron calls this every minute via vercel.json
// Processes notification_schedules rows that are due and not yet sent
export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorised calls
  const secret = req.headers.get("authorization")
  if (secret !== `Bearer ${process.env.CRON_SECRET ?? ""}` && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = adminDb()

  // Fetch due scheduled notifications (scheduled_at <= now, not yet sent)
  const { data: due, error } = await db
    .from("notification_schedules")
    .select("*")
    .lte("scheduled_at", new Date().toISOString())
    .is("sent_at", null)
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due || due.length === 0) return NextResponse.json({ processed: 0 })

  let totalSent = 0

  for (const sched of due) {
    const { audience, title, body, type, image_url, id } = sched as {
      id: string; audience: string; title: string; body: string
      type: string; image_url: string | null
    }

    // Fetch target users
    let query = db.from("profiles").select("id").eq("is_active", true)
    if (audience === "customers") query = query.eq("role", "customer")
    else if (audience === "drivers")   query = query.eq("role", "driver")
    else if (audience === "merchants") query = query.eq("role", "merchant")

    const { data: users } = await query
    if (!users?.length) {
      await db.from("notification_schedules").update({ sent_at: new Date().toISOString(), sent_count: 0 }).eq("id", id)
      continue
    }

    const validType = ["promo","system","order","ride"].includes(type) ? type : "system"
    const rows = users.map(u => ({
      user_id: u.id,
      type: validType,
      title,
      body,
      data: { sent_by: "admin_schedule", audience, ...(image_url ? { image_url } : {}) },
    }))

    const { error: insErr } = await db.from("notifications").insert(rows)
    if (!insErr) {
      await db.from("notification_schedules")
        .update({ sent_at: new Date().toISOString(), sent_count: users.length })
        .eq("id", id)
      totalSent += users.length
    }
  }

  return NextResponse.json({ processed: due.length, sent: totalSent })
}
