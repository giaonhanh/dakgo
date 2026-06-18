import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"

// Supabase OAuth callback — dùng cho Facebook (và các provider native khác)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth_no_code", origin))
  }

  const response = NextResponse.redirect(new URL("/", origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: ()             => request.cookies.getAll(),
        setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error("[auth/callback] exchange error:", error?.message)
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin))
  }

  // Đọc role để redirect đúng dashboard
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single()

  const role = profile?.role ?? "customer"
  const dest = role === "driver" ? "/driver"
             : role === "merchant" ? "/merchant"
             : role === "admin" ? "/admin"
             : "/"

  // Cập nhật destination trên response (cookies đã được set phía trên)
  return NextResponse.redirect(new URL(dest, origin))
}
