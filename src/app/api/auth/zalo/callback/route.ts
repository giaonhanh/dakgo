import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

const adminClient = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface ZaloTokenResponse {
  access_token?: string
  error?:        number
  message?:      string
}

interface ZaloUserResponse {
  error:    number   // 0 = success, khác 0 = lỗi
  message?: string
  id?:      string
  name?:    string
  picture?: { data?: { url?: string } }
  is_sensitive?: boolean
}

// Bước 2: Zalo redirect về đây sau khi user đồng ý
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code         = searchParams.get("code")
  const stateParam   = searchParams.get("state")
  const storedState  = request.cookies.get("zalo_state")?.value
  const codeVerifier = request.cookies.get("zalo_code_verifier")?.value

  const appId     = process.env.ZALO_APP_ID!
  const appSecret = process.env.ZALO_APP_SECRET!
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? origin

  // Validate state để chặn CSRF
  if (!code || !codeVerifier || !storedState || stateParam !== storedState) {
    return NextResponse.redirect(new URL("/login?error=zalo_invalid", appUrl))
  }

  try {
    // ── 1. Đổi code lấy access_token ─────────────────────────
    const callbackUrl = `${appUrl}/api/auth/zalo/callback`
    const tokenRes = await fetch("https://oauth.zaloapp.com/v4/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "secret_key":   appSecret,
      },
      body: new URLSearchParams({
        app_id:        appId,
        grant_type:    "authorization_code",
        code,
        code_verifier: codeVerifier,
        redirect_uri:  callbackUrl,
      }),
    })
    const tokenData = await tokenRes.json() as ZaloTokenResponse

    if (!tokenData.access_token) {
      console.error("[zalo/callback] token error:", tokenData)
      return NextResponse.redirect(new URL("/login?error=zalo_token", appUrl))
    }

    // ── 2. Lấy thông tin user từ Zalo ──────────────────────────
    const userRes = await fetch(
      "https://graph.zalo.me/v2.0/me?fields=id,name,picture",
      { headers: { access_token: tokenData.access_token } }
    )
    const zaloUser = await userRes.json() as ZaloUserResponse

    if (zaloUser.error !== 0 || !zaloUser.id) {
      console.error("[zalo/callback] user error:", zaloUser)
      return NextResponse.redirect(new URL("/login?error=zalo_user", appUrl))
    }

    const zaloId      = zaloUser.id
    const displayName = zaloUser.name ?? "Người dùng Zalo"
    const avatarUrl   = zaloUser.picture?.data?.url ?? null
    // Dùng zalo_{id} làm phone placeholder — không đụng vào tài khoản SĐT thật
    const fakePhone   = `zalo_${zaloId}`
    const fakeEmail   = `zalo_${zaloId}@giaonhanh.local`

    // ── 3. Tìm hoặc tạo user trong Supabase ────────────────────
    // Ưu tiên: tìm theo zalo_id (tài khoản đã link trước đó)
    let { data: existing } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("zalo_id", zaloId)
      .maybeSingle()

    // Fallback: tìm theo fakePhone (tài khoản Zalo cũ trước khi có cột zalo_id)
    if (!existing) {
      const { data: byPhone } = await adminClient
        .from("profiles")
        .select("id, role")
        .eq("phone", fakePhone)
        .maybeSingle()
      existing = byPhone
      // Cập nhật zalo_id nếu tìm thấy bằng phone
      if (existing) {
        await adminClient.from("profiles")
          .update({ zalo_id: zaloId })
          .eq("id", existing.id)
      }
    }

    let userId: string
    let role = "customer"
    let isNewUser = false

    if (existing) {
      userId = existing.id
      role   = existing.role ?? "customer"
    } else {
      isNewUser = true
      // Tạo auth user mới (random password — user chỉ login qua Zalo)
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email:         fakeEmail,
        password:      crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: displayName, zalo_id: zaloId },
      })

      if (createErr || !newUser.user) {
        console.error("[zalo/callback] create user:", createErr?.message)
        return NextResponse.redirect(new URL("/login?error=zalo_create", appUrl))
      }

      userId = newUser.user.id

      await adminClient.from("profiles").upsert({
        id:         userId,
        phone:      fakePhone,
        full_name:  displayName,
        avatar_url: avatarUrl,
        role:       "customer",
        is_active:  true,
        zalo_id:    zaloId,
      }, { onConflict: "id" })
    }

    // ── 4. Tạo session: đặt temp password → signIn → set cookie ─
    const tempPass = `zp_${crypto.randomBytes(20).toString("hex")}`
    await adminClient.auth.admin.updateUserById(userId, { password: tempPass })

    // User Zalo mới → hỏi có muốn link với tài khoản SĐT cũ không
    const dest = isNewUser ? "/link-account"
               : role === "driver"   ? "/driver"
               : role === "merchant" ? "/merchant"
               : role === "admin"    ? "/admin"
               : "/"

    const redirectResponse = NextResponse.redirect(new URL(dest, appUrl))

    // SSR client ghi session vào cookie của response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: ()             => request.cookies.getAll(),
          setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => redirectResponse.cookies.set(name, value, options)),
        },
      }
    )

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email:    fakeEmail,
      password: tempPass,
    })

    if (signInErr) {
      console.error("[zalo/callback] signIn:", signInErr.message)
      return NextResponse.redirect(new URL("/login?error=zalo_signin", appUrl))
    }

    // Xóa temp cookies
    redirectResponse.cookies.delete("zalo_code_verifier")
    redirectResponse.cookies.delete("zalo_state")

    return redirectResponse
  } catch (err) {
    console.error("[zalo/callback] unexpected:", err)
    return NextResponse.redirect(new URL("/login?error=zalo_error", appUrl))
  }
}
