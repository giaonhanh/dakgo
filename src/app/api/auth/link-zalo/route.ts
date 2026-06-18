import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/auth/link-zalo
// Xác nhận mật khẩu tài khoản SĐT cũ → gộp zalo_id vào tài khoản đó
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: zaloUser } } = await supabase.auth.getUser()
    if (!zaloUser) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { phone, password } = await req.json()
    if (!phone || !password) {
      return NextResponse.json({ error: "Thiếu số điện thoại hoặc mật khẩu" }, { status: 400 })
    }

    const db = adminDb()

    // Lấy thông tin profile hiện tại (tài khoản Zalo mới)
    const { data: zaloProfile } = await db
      .from("profiles")
      .select("id, zalo_id, phone")
      .eq("id", zaloUser.id)
      .single()

    if (!zaloProfile?.zalo_id) {
      return NextResponse.json({ error: "Không tìm thấy thông tin Zalo" }, { status: 400 })
    }

    // Tìm tài khoản SĐT cũ
    const { data: phoneProfile } = await db
      .from("profiles")
      .select("id, role")
      .eq("phone", phone)
      .maybeSingle()

    if (!phoneProfile) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản với số điện thoại này" }, { status: 404 })
    }

    // Lấy email của tài khoản SĐT để verify password
    const { data: authUser } = await db.auth.admin.getUserById(phoneProfile.id)
    if (!authUser?.user?.email) {
      return NextResponse.json({ error: "Tài khoản không hợp lệ" }, { status: 400 })
    }

    // Verify mật khẩu bằng cách thử signIn
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: authUser.user.email,
      password,
    })
    if (signInErr) {
      return NextResponse.json({ error: "Mật khẩu không đúng" }, { status: 401 })
    }

    // Gộp: gán zalo_id vào tài khoản SĐT
    await db.from("profiles")
      .update({ zalo_id: zaloProfile.zalo_id })
      .eq("id", phoneProfile.id)

    // Chuyển wallet balance từ zalo account sang phone account (nếu có)
    const { data: zaloWallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("user_id", zaloUser.id)
      .eq("type", "customer")
      .maybeSingle()

    if (zaloWallet && zaloWallet.balance > 0) {
      const { data: phoneWallet } = await db
        .from("wallets")
        .select("id, balance")
        .eq("user_id", phoneProfile.id)
        .eq("type", "customer")
        .maybeSingle()

      if (phoneWallet) {
        await db.from("wallets")
          .update({ balance: phoneWallet.balance + zaloWallet.balance })
          .eq("id", phoneWallet.id)
        await db.from("wallets")
          .update({ balance: 0 })
          .eq("id", zaloWallet.id)
      }
    }

    // Xóa tài khoản Zalo tạm (đã được thay bằng tài khoản SĐT)
    await db.auth.admin.deleteUser(zaloUser.id)

    return NextResponse.json({ ok: true, role: phoneProfile.role })
  } catch (err) {
    console.error("[link-zalo]", err)
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
