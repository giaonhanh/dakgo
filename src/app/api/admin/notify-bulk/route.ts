import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import webpush from "web-push"

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ error: "Không có quyền" }, { status: 403 })

    const { title, body, audience, type = "system", image_url = null } = await req.json()
    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "Thiếu tiêu đề hoặc nội dung" }, { status: 400 })
    }

    const admin = adminDb()

    // Lấy danh sách user theo audience
    let query = admin.from("profiles").select("id").eq("is_active", true)
    if (audience === "customers") query = query.eq("role", "customer")
    else if (audience === "drivers")   query = query.eq("role", "driver")
    else if (audience === "merchants") query = query.eq("role", "merchant")

    const { data: users, error: usersErr } = await query
    if (usersErr || !users?.length) {
      return NextResponse.json({ error: "Không tìm thấy người dùng", count: 0 })
    }

    const validType = ["promo","system","order","ride"].includes(type) ? type : "system"
    const userIds   = users.map(u => u.id)

    // 1. INSERT vào bảng notifications (in-app)
    const rows = userIds.map(id => ({
      user_id: id,
      type: validType,
      title,
      body,
      data: { sent_by: "admin", audience, ...(image_url ? { image_url } : {}) },
    }))
    const { error: dbErr } = await admin.from("notifications").insert(rows)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    // 2. Gửi Web Push tới thiết bị (màn hình khoá)
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", userIds)

    if (subs?.length) {
      const payload = JSON.stringify({
        title,
        body,
        icon:  image_url ?? "/icon-192.png",
        badge: "/icon-192.png",
        data:  { url: "/", audience },
        tag:   `admin-${Date.now()}`,
      })

      await Promise.allSettled(
        subs.map(s =>
          webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          ).catch(() => null) // bỏ qua subscription hết hạn
        )
      )
    }

    return NextResponse.json({ success: true, count: users.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
