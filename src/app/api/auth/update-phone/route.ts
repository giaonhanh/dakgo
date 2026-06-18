import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { phone } = await req.json()
    const cleaned = phone?.replace(/\D/g, "")
    if (!cleaned || cleaned.length < 9 || cleaned.length > 11) {
      return NextResponse.json({ error: "Số điện thoại không hợp lệ" }, { status: 400 })
    }

    const db = adminDb()

    // Kiểm tra SĐT chưa được dùng bởi tài khoản khác
    const { data: existing } = await db
      .from("profiles")
      .select("id")
      .eq("phone", cleaned)
      .neq("id", user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "Số điện thoại này đã được đăng ký. Hãy dùng tính năng gộp tài khoản." }, { status: 409 })
    }

    await db.from("profiles").update({ phone: cleaned }).eq("id", user.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
