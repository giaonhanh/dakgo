import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/merchant/remove-bg
// Nhận base64 hoặc URL ảnh → gọi HuggingFace RMBG-1.4 → trả về PNG trong suốt
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const hfToken = process.env.HF_TOKEN
    if (!hfToken) return NextResponse.json({ error: "HF_TOKEN chưa được cấu hình" }, { status: 503 })

    const contentType = req.headers.get("content-type") ?? ""

    let imageBlob: Blob

    if (contentType.includes("application/json")) {
      // Nhận base64 data URL
      const { image } = await req.json()
      if (!image) return NextResponse.json({ error: "Thiếu dữ liệu ảnh" }, { status: 400 })
      const base64 = image.replace(/^data:image\/\w+;base64,/, "")
      const buf    = Buffer.from(base64, "base64")
      imageBlob    = new Blob([buf], { type: "image/jpeg" })
    } else {
      // Nhận binary trực tiếp
      const buf = await req.arrayBuffer()
      imageBlob = new Blob([buf], { type: contentType || "image/jpeg" })
    }

    // Gọi HuggingFace Inference API — model RMBG-1.4
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/briaai/RMBG-1.4",
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${hfToken}`,
          "Content-Type": "image/jpeg",
          "Accept":       "image/png",
        },
        body: imageBlob,
      }
    )

    if (!hfRes.ok) {
      const errText = await hfRes.text()
      // Model đang load (cold start) — báo client thử lại
      if (hfRes.status === 503) {
        return NextResponse.json({ error: "Model đang khởi động, thử lại sau 10 giây", retry: true }, { status: 503 })
      }
      console.error("[remove-bg] HF error:", errText)
      return NextResponse.json({ error: "Không thể xóa nền, thử lại sau" }, { status: 502 })
    }

    const resultBuf  = await hfRes.arrayBuffer()
    return new NextResponse(resultBuf, {
      status: 200,
      headers: {
        "Content-Type":  "image/png",
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("[remove-bg]", e)
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
