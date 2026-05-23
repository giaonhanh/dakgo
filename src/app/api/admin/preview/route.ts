import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

async function getAdminRole() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  return data?.role ?? null
}

// POST → bật preview mode
export async function POST() {
  const role = await getAdminRole()
  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set("admin_preview", "1", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 8, // 8 giờ
  })
  return res
}

// DELETE → tắt preview mode
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set("admin_preview", "", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 0,
  })
  return res
}
