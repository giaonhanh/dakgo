"use client"
import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export function useDriverLocation(driverId: string | null, isOnline: boolean) {
  useEffect(() => {
    if (!isOnline || !driverId) return
    if (typeof navigator === "undefined" || !navigator.geolocation) return

    const supabase = createClient()

    const watchId = navigator.geolocation.watchPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        await supabase.from("drivers").update({
          location: `POINT(${lng} ${lat})`,
          location_updated_at: new Date().toISOString(),
        }).eq("id", driverId)

        await supabase.channel("driver-locations:all").send({
          type: "broadcast",
          event: "location",
          payload: { driverId, lat, lng },
        })
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [driverId, isOnline])
}
