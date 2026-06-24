// API: POST /api/merchant/remove-bg
// Xóa nền ảnh món bằng Clipdrop API (100 ảnh/ngày free)
// Track usage trong app_settings để chặn trước khi vượt quota

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as adminClient } from "@supabase/supabase-js"

const DAILY_LIMIT = 95 // chặn ở 95 để còn buffer, tránh race condition

function todayKey() {
  return `clipdrop_usage_${new Date().toISOString().slice(0, 10)}` // YYYY-MM-DD
}

async function getUsage(): Promise<number> {
  const db = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", todayKey())
    .maybeSingle()
  return (data?.value as number) ?? 0
}

async function incrementUsage(): Promise<number> {
  const db = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const key     = todayKey()
  const current = await getUsage()
  const next    = current + 1
  await db.from("app_settings").upsert({ key, value: next }, { onConflict: "key" })
  return next
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const apiKey = process.env.CLIPDROP_API_KEY
    if (!apiKey) return NextResponse.json({ error: "CLIPDROP_API_KEY chưa được cấu hình" }, { status: 503 })

    // Kiểm tra quota trước khi gọi Clipdrop
    const used = await getUsage()
    if (used >= DAILY_LIMIT) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
      return NextResponse.json({
        error: `Tính năng xóa nền AI đã đạt giới hạn hôm nay (${used}/${DAILY_LIMIT} ảnh). Vui lòng quay lại vào ngày mai ${tomorrowStr} để tiếp tục sử dụng.`,
        quota: { used, limit: DAILY_LIMIT, resetAt: tomorrowStr },
      }, { status: 429 })
    }

    // Nhận base64 từ client
    const { image } = await req.json() as { image: string }
    if (!image) return NextResponse.json({ error: "Thiếu dữ liệu ảnh" }, { status: 400 })

    const base64 = image.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64, "base64")

    // Gửi lên Clipdrop
    const form = new FormData()
    form.append("image_file", new Blob([buffer], { type: "image/png" }), "image.png")

    const res = await fetch("https://clipdrop-api.co/remove-background/v1", {
      method:  "POST",
      headers: { "x-api-key": apiKey },
      body:    form,
      signal:  AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error("[remove-bg] Clipdrop error:", res.status, errText)
      if (res.status === 402) {
        return NextResponse.json({
          error: "Tính năng xóa nền AI đã đạt giới hạn hôm nay. Vui lòng quay lại vào ngày mai.",
        }, { status: 429 })
      }
      return NextResponse.json({ error: `Clipdrop lỗi ${res.status}` }, { status: 502 })
    }

    // Tăng counter sau khi thành công
    const newCount = await incrementUsage()
    console.info(`[remove-bg] Clipdrop usage today: ${newCount}/${DAILY_LIMIT}`)

    const resultBuffer = Buffer.from(await res.arrayBuffer())

    return new NextResponse(resultBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":   "image/png",
        "Cache-Control":  "no-store",
        "X-Usage-Today":  String(newCount),
        "X-Usage-Limit":  String(DAILY_LIMIT),
      },
    })
  } catch (e) {
    console.error("[remove-bg] exception:", e)
    return NextResponse.json({ error: "Lỗi server: " + String(e).slice(0, 100) }, { status: 500 })
  }
}
