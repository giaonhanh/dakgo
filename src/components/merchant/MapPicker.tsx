"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { reverseGeocode } from "@/lib/vietmapRoute"
import "maplibre-gl/dist/maplibre-gl.css"
import { MAP_STYLE, vmTransform } from "@/lib/mapConfig"

const DEFAULT_LAT = 12.5833
const DEFAULT_LNG = 108.4833

interface MapPickerProps {
  initialLat?: number | null
  initialLng?: number | null
  onConfirm: (lat: number, lng: number, address: string) => void
  onClose: () => void
}

export default function MapPicker({ initialLat, initialLng, onConfirm, onClose }: MapPickerProps) {
  const initLat = initialLat ?? DEFAULT_LAT
  const initLng = initialLng ?? DEFAULT_LNG

  const divRef       = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const skipRef      = useRef(true)
  const geocodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const geocodeIdRef = useRef(0)

  const [pickedLat,  setPickedLat]  = useState(initLat)
  const [pickedLng,  setPickedLng]  = useState(initLng)
  const [geocoded,   setGeocoded]   = useState("")
  const [geocoding,  setGeocoding]  = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError,   setGpsError]   = useState(false)
  const [floating,   setFloating]   = useState(false)

  const doGeocode = useCallback(async (lat: number, lng: number) => {
    const myId = ++geocodeIdRef.current
    setGeocoding(true)
    const addr = await reverseGeocode(lat, lng)
    if (myId !== geocodeIdRef.current) return
    setGeocoded(addr)
    setGeocoding(false)
  }, [])

  useEffect(() => {
    void doGeocode(initLat, initLng)
    return () => clearTimeout(geocodeTimer.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!divRef.current) return
    let mounted = true

    const init = async () => {
      const maplibregl = (await import("maplibre-gl")).default
      if (!mounted || !divRef.current || mapRef.current) return

      const map = new maplibregl.Map({
        container: divRef.current,
        style: MAP_STYLE,
        center: [initLng, initLat],
        zoom: 17,
        attributionControl: false,
        transformRequest: vmTransform,
      })
      mapRef.current = map

      map.on("dragstart", () => setFloating(true))
      map.on("dragend",   () => setFloating(false))
      map.on("moveend", () => {
        if (skipRef.current) { skipRef.current = false; return }
        const c = map.getCenter()
        setPickedLat(c.lat)
        setPickedLng(c.lng)
        clearTimeout(geocodeTimer.current)
        geocodeTimer.current = setTimeout(() => void doGeocode(c.lat, c.lng), 600)
      })
    }

    init()
    return () => {
      mounted = false
      clearTimeout(geocodeTimer.current)
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGpsLoading(false)
        if (!mapRef.current) return
        skipRef.current = true
        setPickedLat(coords.latitude)
        setPickedLng(coords.longitude)
        mapRef.current.flyTo({ center: [coords.longitude, coords.latitude], zoom: 18 })
        void doGeocode(coords.latitude, coords.longitude)
      },
      () => {
        setGpsLoading(false)
        setGpsError(true)
        setTimeout(() => setGpsError(false), 4000)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [doGeocode])

  const handleZoom = useCallback((delta: number) => {
    if (!mapRef.current) return
    mapRef.current.setZoom((mapRef.current.getZoom() ?? 17) + delta)
  }, [])

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      display: "flex", flexDirection: "column",
      background: "#080806", fontFamily: "'Lexend',sans-serif",
    }}>
      <div style={{
        padding: "calc(env(safe-area-inset-top) + 10px) 16px 10px",
        background: "rgba(8,8,6,0.97)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(255,255,255,0.06)", border: "none",
            color: "#f8f0e0", fontSize: 16, cursor: "pointer",
            fontFamily: "Lexend", flexShrink: 0,
          }}>&#8592;</button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700 }}>Chọn vị trí cửa hàng</div>
            <div style={{ color: "#6a5a40", fontSize: 9.5, marginTop: 1 }}>Kéo bản đồ để đặt ghim vào đúng vị trí</div>
          </div>
          <button onClick={handleGPS} disabled={gpsLoading} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "8px 12px", borderRadius: 10, flexShrink: 0,
            background: gpsLoading ? "rgba(255,255,255,0.04)" : "rgba(74,143,245,0.12)",
            border: `1px solid ${gpsLoading ? "rgba(255,255,255,0.08)" : "rgba(74,143,245,0.3)"}`,
            color: gpsLoading ? "#6a5a40" : "#4a8ff5",
            fontSize: 11, fontWeight: 700,
            cursor: gpsLoading ? "not-allowed" : "pointer",
            fontFamily: "Lexend",
          }}>
            <span>{gpsLoading ? "..." : "GPS"}</span>
            <span>{gpsLoading ? "Đang lấy..." : "Vị trí của tôi"}</span>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        {gpsError && (
          <div style={{
            position: "absolute", top: 12, left: 12, right: 12, zIndex: 20,
            background: "rgba(255,100,0,0.14)", border: "1px solid rgba(255,100,0,0.3)",
            borderRadius: 10, padding: "9px 13px",
            color: "#FF8C00", fontSize: 10.5, fontWeight: 600, fontFamily: "Lexend",
          }}>
            📍 GPS không khả dụng — kéo bản đồ để đặt ghim thủ công
          </div>
        )}

        <div ref={divRef} style={{ width: "100%", height: "100%" }} />

        {/* Center pin */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          pointerEvents: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            transform: floating ? "translateY(-12px) scale(1.12)" : "translateY(0) scale(1)",
            transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50% 50% 50% 0",
              background: "linear-gradient(135deg,#FF6B1A,#FFB347)",
              transform: "rotate(-45deg)",
              boxShadow: floating ? "0 12px 28px rgba(255,107,26,0.75)" : "0 4px 12px rgba(255,107,26,0.55)",
              border: "2px solid rgba(255,255,255,0.9)",
              transition: "box-shadow 0.2s",
            }} />
          </div>
        </div>

        <div style={{
          position: "absolute", right: 12, bottom: 12, zIndex: 15,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {["+", "-"].map(label => (
            <button key={label} type="button"
              onClick={() => handleZoom(label === "+" ? 1 : -1)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(8,8,6,0.88)",
                border: "1px solid rgba(255,107,0,0.25)",
                color: "#FF8C00", fontSize: 22, lineHeight: 1,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >{label}</button>
          ))}
        </div>
      </div>

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
            {geocoding ? "Đang tra cứu..." : geocoded || "Chưa có địa chỉ"}
          </div>
          <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 4 }}>
            {pickedLat.toFixed(6)}, {pickedLng.toFixed(6)}
          </div>
        </div>
        <button onClick={() => onConfirm(pickedLat, pickedLng, geocoded)}
          style={{
            width: "100%", height: 48, borderRadius: 13, border: "none",
            background: "linear-gradient(90deg,#FF6B00,#FF8C00)",
            color: "#fff", fontSize: 13, fontWeight: 800,
            cursor: "pointer", fontFamily: "Lexend",
          }}
        >Xác nhận vị trí này</button>
      </div>
    </div>
  )
}
