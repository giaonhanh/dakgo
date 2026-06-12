"use client"

/**
 * Drop-in thay thế cho <img> với ảnh từ Supabase Storage private buckets.
 * Tự động generate signed URL (1 giờ) và gia hạn trước khi hết hạn.
 * Với public bucket hoặc URL bên ngoài → render thẳng, không overhead.
 */

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toSignedUrl, isSupabaseStorageUrl, parseStorageUrl } from "@/lib/storageUrl"

const PRIVATE_BUCKETS = new Set(["avatars", "review-photos", "delivery-photos"])
const EXPIRES_IN = 3600        // 1 giờ
const REFRESH_BEFORE = 5 * 60  // gia hạn trước 5 phút

function needsSigning(src: string): boolean {
  if (!isSupabaseStorageUrl(src)) return false
  const parsed = parseStorageUrl(src)
  return parsed ? PRIVATE_BUCKETS.has(parsed.bucket) : false
}

interface SignedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  fallback?: string
}

export default function SignedImage({ src, fallback = "", alt = "", ...rest }: SignedImageProps) {
  const [displaySrc, setDisplaySrc] = useState<string>(needsSigning(src) ? "" : src)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const supabase = createClient()

  useEffect(() => {
    if (!needsSigning(src)) {
      setDisplaySrc(src)
      return
    }

    let cancelled = false

    const refresh = async () => {
      const signed = await toSignedUrl(supabase, src, EXPIRES_IN)
      if (!cancelled) {
        setDisplaySrc(signed)
        // Gia hạn tự động trước khi URL hết hạn
        timerRef.current = setTimeout(refresh, (EXPIRES_IN - REFRESH_BEFORE) * 1000)
      }
    }

    void refresh()

    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  if (!displaySrc) {
    // Skeleton trong khi chờ signed URL
    return (
      <div
        style={{
          width: rest.width as number | undefined,
          height: rest.height as number | undefined,
          borderRadius: (rest.style as React.CSSProperties | undefined)?.borderRadius,
          background: "rgba(255,255,255,0.06)",
          flexShrink: 0,
          ...(rest.style as React.CSSProperties | undefined),
        }}
      />
    )
  }

  return (
    <img
      {...rest}
      src={displaySrc}
      alt={alt}
      onError={() => fallback && setDisplaySrc(fallback)}
    />
  )
}
