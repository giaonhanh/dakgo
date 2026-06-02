"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { reverseGeocode } from "@/lib/vietmapRoute"

interface MapPickerProps {
  initialLat?: number | null
  initialLng?: number | null
  onConfirm: (lat: number, lng: number, address: string) => void
  onClose: () => void
}

const DEFAULT_LAT = 12.6524   // Buôn Ma Thuột
const DEFAULT_LNG = 108.0483
const TILE_KEY    = process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY

export default function MapPicker({ initialLat, initialLng, onConfirm, onClose }: MapPickerProps) {
  const mapDivRef  = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef     = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef  = useRef<any>(null)

  const [pickedLat,  setPickedLat]  = useState(initialLat ?? DEFAULT_LAT)
  const [pickedLng,  setPickedLng]  = useState(initialLng ?? DEFAULT_LNG)
  const [geocoded,   setGeocoded]   = useState("")
  const [geocoding,  setGeocoding]  = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [mapLoaded,  setMapLoaded]  = useState(false)

  const doGeocode = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true)
    const addr = await reverseGeocode(lat, lng)
    setGeocoded(addr)
    setGeocoding(false)
  }, [])

  const updatePosition = useCallback((lat: number, lng: number) => {
    setPickedLat(lat)
    setPickedLng(lng)
    doGeocode(lat, lng)
  }, [doGeocode])

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return

    const lat = initialLat ?? DEFAULT_LAT
    const lng = initialLng ?? DEFAULT_LNG

    import("leaflet").then((L) => {
      if (!mapDivRef.current || mapRef.current) return

      // Fix Leaflet default icon (webpack strips paths)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const map = L.map(mapDivRef.current!, {
        center:      [lat, lng],
        zoom:        17,
        zoomControl: true,
      })

      // VietMap raster tiles, fallback OSM nếu tile lỗi
      L.tileLayer(
        `https://maps.vietmap.vn/api/maps/light/{z}/{x}/{y}@2x.png?apikey=${TILE_KEY}`,
        {
          maxZoom:     20,
          attribution: "© VietMap",
        }
      ).addTo(map)

      const marker = L.marker([lat, lng], { draggable: true }).addTo(map)

      mapRef.current    = map
      markerRef.current = marker
      setMapLoaded(true)

      doGeocode(lat, lng)

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng()
        updatePosition(lat, lng)
      })

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng
        marker.setLatLng([lat, lng])
        map.panTo([lat, lng])
        updatePosition(lat, lng)
      })
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
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
          mapRef.current.setView([lat, lng], 18)
          markerRef.current.setLatLng([lat, lng])
        }
        updatePosition(lat, lng)
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
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
              <span>{gpsLoading ? "⏳" : "🎯"}</span>
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
    </>
  )
}
