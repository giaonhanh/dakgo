"use client"

import { useEffect, useRef, useState } from "react"

interface MapPickerProps {
  initialLat?: number | null
  initialLng?: number | null
  onConfirm: (lat: number, lng: number, address: string) => void
  onClose: () => void
}

export default function MapPicker({ initialLat, initialLng, onConfirm, onClose }: MapPickerProps) {
  const mapDivRef  = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef  = useRef<any>(null)

  const DEFAULT_LAT = 12.6524  // Buôn Ma Thuột
  const DEFAULT_LNG = 108.0483

  const [pickedLat, setPickedLat] = useState(initialLat ?? DEFAULT_LAT)
  const [pickedLng, setPickedLng] = useState(initialLng ?? DEFAULT_LNG)
  const [geocoded,  setGeocoded]  = useState("")
  const [geocoding, setGeocoding] = useState(false)

  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { "Accept-Language": "vi" } }
      )
      const data = await res.json()
      if (data.display_name) {
        const parts = (data.display_name as string).split(", ")
        setGeocoded(parts.slice(0, -1).join(", "))
      }
    } catch { /* ignore */ }
    setGeocoding(false)
  }

  useEffect(() => {
    if (!mapDivRef.current || leafletRef.current) return

    import("leaflet").then((L) => {
      // Fix default icon paths (webpack strips them)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const map = L.map(mapDivRef.current!, {
        center: [pickedLat, pickedLng],
        zoom:   16,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map)

      const marker = L.marker([pickedLat, pickedLng], { draggable: true }).addTo(map)
      markerRef.current  = marker
      leafletRef.current = map

      reverseGeocode(pickedLat, pickedLng)

      const updatePos = (lat: number, lng: number) => {
        setPickedLat(lat)
        setPickedLng(lng)
        reverseGeocode(lat, lng)
      }

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng()
        updatePos(lat, lng)
      })

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng
        marker.setLatLng([lat, lng])
        map.panTo([lat, lng])
        updatePos(lat, lng)
      })
    })

    return () => {
      leafletRef.current?.remove()
      leafletRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onClose}
              style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", color: "#f8f0e0", fontSize: 16, cursor: "pointer", fontFamily: "Lexend" }}>←</button>
            <div>
              <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700 }}>📍 Chọn vị trí cửa hàng</div>
              <div style={{ color: "#6a5a40", fontSize: 9.5, marginTop: 1 }}>Nhấn bản đồ hoặc kéo ghim để chọn vị trí chính xác</div>
            </div>
          </div>
        </div>

        {/* Map area */}
        <div ref={mapDivRef} style={{ flex: 1 }} />

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
              color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
              fontFamily: "Lexend",
            }}>
            ✓ Xác nhận vị trí này
          </button>
        </div>
      </div>
    </>
  )
}
