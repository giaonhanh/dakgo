import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import sharp from "sharp"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const hfToken = process.env.HF_TOKEN
    if (!hfToken) return NextResponse.json({ error: "HF_TOKEN chưa được cấu hình" }, { status: 503 })

    // Nhận base64 data URL từ client
    const { image } = await req.json()
    if (!image) return NextResponse.json({ error: "Thiếu dữ liệu ảnh" }, { status: 400 })

    const base64   = image.replace(/^data:image\/\w+;base64,/, "")
    const origBuf  = Buffer.from(base64, "base64")

    // Gọi HuggingFace Inference API — RMBG-1.4 (image segmentation)
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/briaai/RMBG-1.4",
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${hfToken}`,
          "Content-Type": "application/octet-stream",
        },
        body: origBuf,
      }
    )

    if (!hfRes.ok) {
      const errText = await hfRes.text()
      console.error("[remove-bg] HF status:", hfRes.status, errText)
      if (hfRes.status === 503) {
        return NextResponse.json({ error: "Model đang khởi động, thử lại sau 10 giây", retry: true }, { status: 503 })
      }
      return NextResponse.json({ error: `HF lỗi ${hfRes.status}: ${errText.slice(0, 120)}` }, { status: 502 })
    }

    const respContentType = hfRes.headers.get("content-type") ?? ""

    let resultPng: Buffer

    if (respContentType.includes("image/")) {
      // HF trả thẳng binary PNG — dùng luôn
      resultPng = Buffer.from(await hfRes.arrayBuffer())
    } else {
      // HF trả JSON segmentation: [{score, label, mask}]
      // mask là base64-encoded grayscale PNG (trắng = giữ, đen = xóa)
      const json = await hfRes.json()
      const entry = Array.isArray(json) ? json[0] : json
      if (!entry?.mask) {
        console.error("[remove-bg] unexpected HF response:", JSON.stringify(json).slice(0, 200))
        return NextResponse.json({ error: "Định dạng phản hồi không hỗ trợ" }, { status: 502 })
      }

      const maskBuf = Buffer.from(entry.mask, "base64")

      // Resize mask khớp kích thước ảnh gốc
      const { width, height } = await sharp(origBuf).metadata()
      const maskResized = await sharp(maskBuf)
        .resize(width, height)
        .greyscale()
        .toBuffer()

      // Ghép mask làm alpha channel: joinChannel thêm kênh thứ 4 (alpha)
      resultPng = await sharp(origBuf)
        .removeAlpha()
        .joinChannel(maskResized)
        .png()
        .toBuffer()
    }

    return new NextResponse(resultPng, {
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
