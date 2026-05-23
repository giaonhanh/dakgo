"use client"
import { useState, useEffect } from "react"

interface GeoState {
  lat: number | null
  lng: number | null
  error: string | null
  loading: boolean
}

export function useGeolocation(watch = false) {
  const [state, setState] = useState<GeoState>({
    lat: null, lng: null, error: null, loading: true,
  })

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState(s => ({ ...s, error: "Trình duyệt không hỗ trợ định vị", loading: false }))
      return
    }

    const opts: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: watch ? 5000 : 30000,
    }

    const onSuccess = ({ coords }: GeolocationPosition) => {
      setState({ lat: coords.latitude, lng: coords.longitude, error: null, loading: false })
    }

    const onError = (err: GeolocationPositionError) => {
      setState(s => ({ ...s, error: err.message, loading: false }))
    }

    if (watch) {
      const id = navigator.geolocation.watchPosition(onSuccess, onError, opts)
      return () => navigator.geolocation.clearWatch(id)
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, opts)
    }
  }, [watch])

  return state
}
