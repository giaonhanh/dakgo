import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Vercel Cron: mỗi 15 phút — cấu hình trong vercel.json
// Bảo vệ bằng CRON_SECRET header
export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: shops, error } = await supabase
    .from("shops")
    .select("id, is_open, opening_hours")
    .eq("status", "approved")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Giờ hiện tại theo múi giờ Việt Nam (UTC+7)
  const now = new Date()
  const vnHour   = (now.getUTCHours() + 7) % 24
  const vnMinute = now.getUTCMinutes()
  const vnTime   = vnHour * 60 + vnMinute  // phút từ 00:00

  const toMinutes = (t: string): number => {
    const [h, m] = t.split(":").map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  }

  let updated = 0
  for (const shop of shops ?? []) {
    const oh = shop.opening_hours as { open?: string; close?: string } | null
    if (!oh?.open || !oh?.close) continue

    const openMin  = toMinutes(oh.open)
    const closeMin = toMinutes(oh.close)

    // Hỗ trợ quán mở qua đêm (ví dụ: 20:00 – 02:00)
    const shouldBeOpen = closeMin > openMin
      ? vnTime >= openMin && vnTime < closeMin        // không qua đêm
      : vnTime >= openMin || vnTime < closeMin         // qua đêm

    if (shouldBeOpen !== shop.is_open) {
      await supabase.from("shops").update({ is_open: shouldBeOpen }).eq("id", shop.id)
      updated++
    }
  }

  return NextResponse.json({
    ok: true,
    checked: shops?.length ?? 0,
    updated,
    vnTime: `${String(vnHour).padStart(2,"0")}:${String(vnMinute).padStart(2,"0")}`,
  })
}
