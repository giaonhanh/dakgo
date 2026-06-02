"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Loader } from "@googlemaps/js-api-loader"

interface MapPickerProps {
  initialLat?: number | null
  initialLng?: number | null
  onConfirm: (lat: number, lng: number, address: string) => void
  onClose: () => void
}

const DEFAULT_LAT = 12.6524  // Buôn Ma Thuột
const DEFAULT_LNG = 108.0483

const loader = new Loader({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  version: "weekly",
  language: "vi",
  region: "VN",
})

export default function MapPicker({ initialLat, initialLng, onConfirm, onClose }: MapPickerProps) {
  const mapDivRef    = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<google.maps.Map | null>(null)
  const markerRef    = useRef<google.maps.Marker | null>(null)
  const geocoderRef  = useRef<google.maps.Geocoder | null>(null)

  const [pickedLat,  setPickedLat]  = useState(initialLat ?? DEFAULT_LAT)
  const [pickedLng,  setPickedLng]  = useState(initialLng ?? DEFAULT_LNG)
  const [geocoded,   setGeocoded]   = useState("")
  const [geocoding,  setGeocoding]  = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [mapLoaded,  setMapLoaded]  = useState(false)

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!geocoderRef.current) return
    setGeocoding(true)
    geocoderRef.current.geocode(
      { location: { lat, lng } },
      (results, status) => {
        setGeocoding(false)
        if (status === "OK" && results?.[0]) {
          setGeocoded(results[0].formatted_address)
        }
      }
    )
  }, [])

  const updatePosition = useCallback((lat: number, lng: number) => {
    setPickedLat(lat)
    setPickedLng(lng)
    reverseGeocode(lat, lng)
  }, [reverseGeocode])

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return

    const lat = initialLat ?? DEFAULT_LAT
    const lng = initialLng ?? DEFAULT_LNG

    loader.load().then((google) => {
      if (!mapDivRef.current) return

      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat, lng },
        zoom: 17,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        mapTypeId: "roadmap",
      })

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        draggable: true,
        title: "Vị trí cửa hàng",
        animation: google.maps.Animation.DROP,
      })

      const geocoder = new google.maps.Geocoder()

      mapRef.current      = map
      markerRef.current   = marker
      geocoderRef.current = geocoder
      setMapLoaded(true)

      reverseGeocode(lat, lng)

      marker.addListener("dragend", () => {
        const pos = marker.getPosition()!
        updatePosition(pos.lat(), pos.lng())
      })

      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        const lat = e.latLng!.lat()
        const lng = e.latLng!.lng()
        marker.setPosition({ lat, lng })
        map.panTo({ lat, lng })
        updatePosition(lat, lng)
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGPS = () => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lat = coords.latitude
        const lng = coords.longitude
        setGpsLoading(false)
        if (mapRef.current && markerRef.current) {
          mapRef.current.panTo({ lat, lng })
          mapRef.current.setZoom(18)
          markerRef.current.setPosition({ lat, lng })
        }
        updatePosition(lat, lng)
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      display: "flex", flexDirection: "column",
      background: "#080806", fontFamily: "'Lexend',sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "calc(env(safe-area-inset-top) + 10px) 16px 10px",
        background: "rgba(8,8,6,0.97)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", color: "#f8f0e0", fontSize: 16, cursor: "pointer", fontFamily: "Lexend", flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700 }}>📍 Chọn vị trí cửa hàng</div>
            <div style={{ color: "#6a5a40", fontSize: 9.5, marginTop: 1 }}>Nhấn bản đồ hoặc kéo ghim để chọn vị trí</div>
          </div>
          {/* GPS button */}
          <button onClick={handleGPS} disabled={gpsLoading}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "8px 12px", borderRadius: 10, flexShrink: 0,
              background: gpsLoading ? "rgba(255,255,255,0.04)" : "rgba(74,143,245,0.12)",
              border: `1px solid ${gpsLoading ? "rgba(255,255,255,0.08)" : "rgba(74,143,245,0.3)"}`,
              color: gpsLoading ? "#6a5a40" : "#4a8ff5",
              fontSize: 11, fontWeight: 700,
              cursor: gpsLoading ? "not-allowed" : "pointer",
              fontFamily: "Lexend",
            }}>
            <span style={{ fontSize: 14 }}>{gpsLoading ? "⏳" : "🎯"}</span>
            <span>{gpsLoading ? "Đang lấy..." : "Vị trí của tôi"}</span>
          </button>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />
        {!mapLoaded && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#080806",
          }}>
            <div style={{ color: "#6a5a40", fontSize: 12 }}>🗺️ Đang tải bản đồ...</div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div style={{
        background: "rgba(8,8,6,0.97)", backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "12px 16px calc(env(safe-area-inset-bottom) + 12px)",
        flexShrink: 0,
      }}>
        <div style={{
          background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 12, padding: "10px 12px", marginBottom: 10,
        }}>
          <div style={{ color: "#6a5a40", fontSize: 9, marginBottom: 3 }}>Địa chỉ tìm được:</div>
          <div style={{ color: geocoding ? "#6a5a40" : "#f8f0e0", fontSize: 11, lineHeight: 1.5, minHeight: 16 }}>
            {geocoding ? "⏳ Đang tra cứu..." : geocoded || "Chưa có địa chỉ"}
          </div>
          <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 4 }}>
            {pickedLat.toFixed(6)}, {pickedLng.toFixed(6)}
          </div>
        </div>
        <button
          onClick={() => onConfirm(pickedLat, pickedLng, geocoded)}
          style={{
            width: "100%", height: 48, borderRadius: 13, border: "none",
            background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
            color: "#fff", fontSize: 13, fontWeight: 800,
            cursor: "pointer", fontFamily: "Lexend",
          }}>
          ✓ Xác nhận vị trí này
        </button>
      </div>
    </div>
  )
}
