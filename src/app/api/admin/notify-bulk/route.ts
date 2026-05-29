import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

function adminSupabase() {
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

    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 })
    }

    const { title, body, audience, type = "system", image_url = null } = await req.json()
    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "Thiếu tiêu đề hoặc nội dung" }, { status: 400 })
    }

    const admin = adminSupabase()
    let query = admin.from("profiles").select("id").eq("is_active", true)
    if (audience === "customers") query = query.eq("role", "customer")
    else if (audience === "drivers")   query = query.eq("role", "driver")
    else if (audience === "merchants") query = query.eq("role", "merchant")

    const { data: users, error: usersErr } = await query
    if (usersErr || !users?.length) {
      return NextResponse.json({ error: "Không tìm thấy người dùng", count: 0 }, { status: 200 })
    }

    const validType = ["promo","system","order","ride"].includes(type) ? type : "system"
    const rows = users.map(u => ({
      user_id: u.id,
      type: validType,
      title,
      body,
      data: { sent_by: "admin", audience, ...(image_url ? { image_url } : {}) },
    }))

    const { error } = await admin.from("notifications").insert(rows)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: users.length })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
