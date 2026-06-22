import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const BUCKETS = [
  { name: "shops",               public: true  },
  { name: "product-images",      public: true  },
  { name: "avatars",             public: true  },
  { name: "review-photos",       public: true  },
  { name: "notification-images", public: true  },
  { name: "banners",             public: true  },
]

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const results: Record<string, string> = {}

  for (const bucket of BUCKETS) {
    const { error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
    })

    if (error && !error.message.includes("already exists")) {
      results[bucket.name] = `❌ ${error.message}`
    } else {
      results[bucket.name] = error ? "✅ Đã tồn tại" : "✅ Tạo mới thành công"
    }
  }

  return NextResponse.json({ ok: true, buckets: results })
}
