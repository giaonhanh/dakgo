import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { user_id, title, body, url, tag } = await req.json()
    if (!user_id || !title || !body) {
      return NextResponse.json({ error: "Thiếu user_id, title hoặc body" }, { status: 400 })
    }

    // Gọi Edge Function send-push với service role key
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`,
      {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization:   `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ user_id, title, body, url, tag }),
      },
    )

    const data = await res.json()
    return NextResponse.json(data, { status: res.ok ? 200 : 502 })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
