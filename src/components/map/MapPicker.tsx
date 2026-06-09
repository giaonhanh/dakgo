"use client"

// Google Maps JS API — center-pin pattern, kéo map để chọn vị trí
// Import dynamic (no SSR) từ addresses page

import { useEffect, useRef, useState, useCallback } from "react"
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps"
import { reverseGeocodeStructured } from "@/lib/vietmapRoute"

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

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
  lat:              number
  lng:              number
  onLocationChange: (lat: number, lng: number, address?: string) => void
  height?:          number
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
  }, [map, target])
  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MapPicker({ lat, lng, onLocationChange, height = 200 }: MapPickerProps) {
  const [floating,  setFloating]  = useState(false)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)
  const skipRef     = useRef(true)
  const geocodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Khi lat/lng prop thay đổi từ bên ngoài → pan về đó
  const prevProps = useRef({ lat, lng })
  useEffect(() => {
    if (prevProps.current.lat === lat && prevProps.current.lng === lng) return
    prevProps.current = { lat, lng }
    skipRef.current = true
    setFlyTarget([lat, lng])
  }, [lat, lng])

  const handleDragStart = useCallback(() => setFloating(true),  [])
  const handleDragEnd   = useCallback(() => setFloating(false), [])

  const handleIdle = useCallback((la: number, ln: number) => {
    if (skipRef.current) { skipRef.current = false; return }
    clearTimeout(geocodeTimer.current)
    geocodeTimer.current = setTimeout(async () => {
      const { address } = await reverseGeocodeStructured(la, ln)
      onLocationChange(la, ln, address || undefined)
    }, 500)
  }, [onLocationChange])

  useEffect(() => () => clearTimeout(geocodeTimer.current), [])

  return (
    <div style={{ position: "relative", height }}>
      <style>{`
        .gm-style-cc { display: none !important; }
        .gmnoprint a, .gmnoprint span { display: none !important; }
      `}</style>

      <div style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden" }}>
        <APIProvider apiKey={GOOGLE_KEY}>
          <Map
            defaultCenter={{ lat, lng }}
            defaultZoom={15}
            mapTypeId="roadmap"
            styles={DARK_STYLES}
            disableDefaultUI
            gestureHandling="greedy"
            maxZoom={20}
            renderingType="RASTER"
            style={{ width: "100%", height: "100%" }}
          >
            <CenterTracker
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onIdle={handleIdle}
            />
            <FlyTo target={flyTarget} />
          </Map>
        </APIProvider>
      </div>

      {/* Center pin cố định */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 10,
        pointerEvents: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          transform: floating ? "translateY(-10px) scale(1.1)" : "translateY(0) scale(1)",
          transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50% 50% 50% 0",
            background: "linear-gradient(135deg,#FF6B1A,#FFB347)",
            transform: "rotate(-45deg)",
            boxShadow: floating
              ? "0 10px 24px rgba(255,107,26,0.7)"
              : "0 3px 10px rgba(255,107,26,0.5)",
            border: "2px solid rgba(255,255,255,0.9)",
            transition: "box-shadow 0.2s",
          }} />
        </div>
      </div>

      {/* Zoom buttons */}
      <div style={{
        position: "absolute", right: 8, bottom: 8, zIndex: 15,
        display: "flex", flexDirection: "column", gap: 3,
      }}>
        {["+", "−"].map(label => (
          <ZoomBtn key={label} label={label} />
        ))}
      </div>
    </div>
  )
}

function ZoomBtn({ label }: { label: string }) {
  const map = useMap()
  const handleClick = useCallback(() => {
    if (!map) return
    const z = map.getZoom() ?? 15
    map.setZoom(label === "+" ? z + 1 : z - 1)
  }, [map, label])
  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        width: 28, height: 28, borderRadius: 8,
        background: "rgba(14,12,9,0.9)",
        border: "1px solid rgba(255,107,0,0.2)",
        color: "#FF8C00", fontSize: 18, lineHeight: 1,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >{label}</button>
  )
}
