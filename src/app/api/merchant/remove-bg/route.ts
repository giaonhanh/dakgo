// API: POST /api/merchant/remove-bg
// Xóa nền ảnh món bằng Clipdrop API (100 ảnh/ngày free)
// Docs: https://clipdrop.co/apis/docs/remove-background

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const apiKey = process.env.CLIPDROP_API_KEY
    if (!apiKey) return NextResponse.json({ error: "CLIPDROP_API_KEY chưa được cấu hình" }, { status: 503 })

    // Nhận base64 từ client
    const { image } = await req.json() as { image: string }
    if (!image) return NextResponse.json({ error: "Thiếu dữ liệu ảnh" }, { status: 400 })

    const base64  = image.replace(/^data:image\/\w+;base64,/, "")
    const buffer  = Buffer.from(base64, "base64")

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
        return NextResponse.json({ error: "Đã hết lượt miễn phí hôm nay (100 ảnh/ngày). Thử lại ngày mai." }, { status: 402 })
      }
      return NextResponse.json({ error: `Clipdrop lỗi ${res.status}` }, { status: 502 })
    }

    const resultBuffer = Buffer.from(await res.arrayBuffer())

    return new NextResponse(resultBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":  "image/png",
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("[remove-bg] exception:", e)
    return NextResponse.json({ error: "Lỗi server: " + String(e).slice(0, 100) }, { status: 500 })
  }
}
