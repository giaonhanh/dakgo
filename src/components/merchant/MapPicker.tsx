"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps"
import { reverseGeocode } from "@/lib/vietmapRoute"

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

const DEFAULT_LAT = 12.5833
const DEFAULT_LNG = 108.4833

const DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry",          stylers: [{ color: "#1a1208" }] },
  { elementType: "labels.text.stroke",stylers: [{ color: "#1a1208" }] },
  { elementType: "labels.text.fill",  stylers: [{ color: "#c8a97e" }] },
  { featureType: "road",              elementType: "geometry",         stylers: [{ color: "#2e2010" }] },
  { featureType: "road",              elementType: "labels.text.fill", stylers: [{ color: "#d4b07a" }] },
  { featureType: "road.highway",      elementType: "geometry",         stylers: [{ color: "#4a3018" }] },
  { featureType: "poi",               elementType: "labels.text.fill", stylers: [{ color: "#a07840" }] },
  { featureType: "poi.business",      elementType: "labels.text.fill", stylers: [{ color: "#cc9944" }] },
  { featureType: "water",             elementType: "geometry",         stylers: [{ color: "#0a1520" }] },
  { featureType: "transit",           stylers: [{ visibility: "off" }] },
  { featureType: "landscape",         elementType: "geometry",         stylers: [{ color: "#15100a" }] },
]

interface MapPickerProps {
  initialLat?: number | null
  initialLng?: number | null
  onConfirm: (lat: number, lng: number, address: string) => void
  onClose: () => void
}

// ─── Inner sub-components ─────────────────────────────────────────────────────

function CenterTracker({ onDragStart, onDragEnd, onIdle }: {
  onDragStart: () => void
  onDragEnd:   () => void
  onIdle:      (lat: number, lng: number) => void
}) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const l1 = map.addListener("dragstart", onDragStart)
    const l2 = map.addListener("dragend",   onDragEnd)
    const l3 = map.addListener("idle", () => {
      const c = map.getCenter()
      if (c) onIdle(c.lat(), c.lng())
    })
    return () => { l1.remove(); l2.remove(); l3.remove() }
  }, [map, onDragStart, onDragEnd, onIdle])
  return null
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map     = useMap()
  const prevRef = useRef("")
  useEffect(() => {
    if (!map || !target) return
    const key = `${target[0]},${target[1]}`
    if (prevRef.current === key) return
    prevRef.current = key
    map.panTo({ lat: target[0], lng: target[1] })
    map.setZoom(18)
  }, [map, target])
  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MapPicker({ initialLat, initialLng, onConfirm, onClose }: MapPickerProps) {
  const initLat = initialLat ?? DEFAULT_LAT
  const initLng = initialLng ?? DEFAULT_LNG

  const [pickedLat,  setPickedLat]  = useState(initLat)
  const [pickedLng,  setPickedLng]  = useState(initLng)
  const [geocoded,   setGeocoded]   = useState("")
  const [geocoding,  setGeocoding]  = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [floating,   setFloating]   = useState(false)
  const [mapLoaded,  setMapLoaded]  = useState(false)
  const [flyTarget,  setFlyTarget]  = useState<[number, number] | null>(null)
  const skipRef      = useRef(true)
  const geocodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const doGeocode = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true)
    const addr = await reverseGeocode(lat, lng)
    setGeocoded(addr)
    setGeocoding(false)
  }, [])

  // Geocode vị trí ban đầu
  useEffect(() => {
    void doGeocode(initLat, initLng)
    return () => clearTimeout(geocodeTimer.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragStart = useCallback(() => setFloating(true),  [])
  const handleDragEnd   = useCallback(() => setFloating(false), [])

  const handleIdle = useCallback((lat: number, lng: number) => {
    if (skipRef.current) { skipRef.current = false; return }
    setPickedLat(lat)
    setPickedLng(lng)
    clearTimeout(geocodeTimer.current)
    geocodeTimer.current = setTimeout(() => void doGeocode(lat, lng), 600)
  }, [doGeocode])

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGpsLoading(false)
        skipRef.current = true
        setPickedLat(coords.latitude)
        setPickedLng(coords.longitude)
        setFlyTarget([coords.latitude, coords.longitude])
        void doGeocode(coords.latitude, coords.longitude)
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [doGeocode])

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      display: "flex", flexDirection: "column",
      background: "#080806", fontFamily: "'Lexend',sans-serif",
    }}>
      <style>{`
        .gm-style-cc { display: none !important; }
        .gmnoprint a, .gmnoprint span { display: none !important; }
      `}</style>

      {/* Header */}
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
          }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700 }}>📍 Chọn vị trí cửa hàng</div>
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
            <span>{gpsLoading ? "⏳" : "🎯"}</span>
            <span>{gpsLoading ? "Đang lấy..." : "Vị trí của tôi"}</span>
          </button>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        {!mapLoaded && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 5,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#080806",
          }}>
            <div style={{ color: "#6a5a40", fontSize: 12 }}>🗺️ Đang tải bản đồ...</div>
          </div>
        )}

        <APIProvider apiKey={GOOGLE_KEY}>
          <Map
            defaultCenter={{ lat: initLat, lng: initLng }}
            defaultZoom={17}
            mapTypeId="roadmap"
            styles={DARK_STYLES}
            disableDefaultUI
            gestureHandling="greedy"
            maxZoom={20}
            renderingType="RASTER"
            style={{ width: "100%", height: "100%" }}
            onTilesLoaded={() => setMapLoaded(true)}
          >
            <CenterTracker
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onIdle={handleIdle}
            />
            <FlyTo target={flyTarget} />
          </Map>
        </APIProvider>

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
              boxShadow: floating
                ? "0 12px 28px rgba(255,107,26,0.75)"
                : "0 4px 12px rgba(255,107,26,0.55)",
              border: "2px solid rgba(255,255,255,0.9)",
              transition: "box-shadow 0.2s",
            }} />
          </div>
          {/* Shadow */}
          <div style={{
            position: "absolute", top: "calc(50% + 22px)",
            width: 22, height: 7, borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)",
            transform: floating ? "scale(0.4)" : "scale(1)",
            opacity: floating ? 0.2 : 0.5,
            transition: "transform 0.2s, opacity 0.2s",
          }} />
        </div>
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
          }}
        >✓ Xác nhận vị trí này</button>
      </div>
    </div>
  )
}
