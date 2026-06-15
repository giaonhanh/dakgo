"use client"
import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

const MIN_INTERVAL_MS  = 10_000  // Tối thiểu 10 giây giữa 2 lần lưu DB
const MIN_DISTANCE_DEG = 0.0003  // ~33m — chỉ lưu khi di chuyển

function distanceDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return Math.abs(a.lat - b.lat) + Math.abs(a.lng - b.lng)
}

export function useDriverLocation(driverId: string | null, isOnline: boolean) {
  const lastSavedPos   = useRef({ lat: 0, lng: 0 })
  const lastSavedTime  = useRef(0)

  useEffect(() => {
    if (!isOnline || !driverId) return
    if (typeof navigator === "undefined" || !navigator.geolocation) return

    const supabase = createClient()

    const watchId = navigator.geolocation.watchPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        const now      = Date.now()
        const pos      = { lat, lng }
        const moved    = distanceDeg(pos, lastSavedPos.current) >= MIN_DISTANCE_DEG
        const elapsed  = now - lastSavedTime.current >= MIN_INTERVAL_MS

        // Chỉ lưu DB khi đã đủ thời gian + di chuyển đủ xa
        if (!moved && !elapsed) return

        lastSavedPos.current  = pos
        lastSavedTime.current = now

        await supabase.from("drivers").update({
          location:            `POINT(${lng} ${lat})`,
          location_updated_at: new Date().toISOString(),
        }).eq("id", driverId)
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [driverId, isOnline])
}
