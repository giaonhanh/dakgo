import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Không có quyền admin" }, { status: 403 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })
  }

  const body = await req.json()
  const { email, password, fullName, phone, role, shopType } = body as {
    email?: string; password?: string; fullName?: string; phone?: string
    role?: "customer" | "driver" | "merchant"; shopType?: "partner" | "delivery"
  }

  if (!email || !password || !fullName || !role) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Mật khẩu tối thiểu 6 ký tự" }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Create auth user (no email confirmation)
  const { data: created, error: authErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authErr || !created.user) {
    return NextResponse.json({ error: authErr?.message ?? "Không tạo được tài khoản" }, { status: 500 })
  }

  const newUserId = created.user.id

  // Upsert profile
  const { error: profileErr } = await adminClient.from("profiles").upsert({
    id: newUserId,
    full_name: fullName,
    phone: phone ?? null,
    role,
    is_active: true,
  })
  if (profileErr) {
    await adminClient.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: "Lỗi tạo profile: " + profileErr.message }, { status: 500 })
  }

  // If merchant, create a placeholder shop record with shop_type
  if (role === "merchant" && shopType) {
    await adminClient.from("shops").insert({
      owner_id: newUserId,
      name: fullName,
      phone: phone ?? null,
      shop_type: shopType,
      status: "approved",
      is_open: false,
    })
  }

  return NextResponse.json({ success: true, userId: newUserId })
}
