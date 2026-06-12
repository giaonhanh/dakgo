"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { reverseGeocodeStructured } from "@/lib/vietmapRoute"
import "leaflet/dist/leaflet.css"

const VIETMAP_KEY  = process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ?? ""
const VIETMAP_TILE = `https://maps.vietmap.vn/mt/tm/{z}/{x}/{y}.png?apikey=${VIETMAP_KEY}`

interface MapPickerProps {
  lat:              number
  lng:              number
  onLocationChange: (lat: number, lng: number, address?: string) => void
  height?:          number
}

export default function MapPicker({ lat, lng, onLocationChange, height = 200 }: MapPickerProps) {
  const divRef       = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const skipRef      = useRef(true)
  const geocodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const prevProps    = useRef({ lat, lng })
  const [floating, setFloating] = useState(false)

  useEffect(() => {
    if (!divRef.current) return
    let mounted = true

    const init = async () => {
      const L = (await import("leaflet")).default
      if (!mounted || !divRef.current || mapRef.current) return

      const map = L.map(divRef.current, {
        center: [lat, lng], zoom: 15,
        zoomControl: false, attributionControl: false,
        doubleClickZoom: false,
      })
      mapRef.current = map
      L.tileLayer(VIETMAP_TILE, { maxZoom: 19 }).addTo(map)

      map.on("dragstart", () => setFloating(true))
      map.on("dragend",   () => setFloating(false))
      map.on("moveend", () => {
        if (skipRef.current) { skipRef.current = false; return }
        const c = map.getCenter()
        clearTimeout(geocodeTimer.current)
        geocodeTimer.current = setTimeout(async () => {
          const { address } = await reverseGeocodeStructured(c.lat, c.lng)
          onLocationChange(c.lat, c.lng, address || undefined)
        }, 500)
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

  useEffect(() => {
    if (prevProps.current.lat === lat && prevProps.current.lng === lng) return
    prevProps.current = { lat, lng }
    if (!mapRef.current) return
    skipRef.current = true
    mapRef.current.panTo([lat, lng])
  }, [lat, lng])

  const handleZoom = useCallback((delta: number) => {
    if (!mapRef.current) return
    mapRef.current.setZoom((mapRef.current.getZoom() ?? 15) + delta)
  }, [])

  return (
    <div style={{ position: "relative", height }}>
      <style>{`.leaflet-control-container{display:none!important}`}</style>

      <div ref={divRef} style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden" }} />

      {/* Center pin */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 10,
        pointerEvents: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          transform: floating ? "translateY(-10px) scale(1.1)" : "translateY(0) scale(1)",
          transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50% 50% 50% 0",
            background: "linear-gradient(135deg,#FF6B1A,#FFB347)",
            transform: "rotate(-45deg)",
            boxShadow: floating ? "0 10px 24px rgba(255,107,26,0.7)" : "0 3px 10px rgba(255,107,26,0.5)",
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
        {(["+", "−"] as const).map(label => (
          <button
            key={label}
            type="button"
            onClick={() => handleZoom(label === "+" ? 1 : -1)}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: "rgba(14,12,9,0.9)",
              border: "1px solid rgba(255,107,0,0.2)",
              color: "#FF8C00", fontSize: 18, lineHeight: 1,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >{label}</button>
        ))}
      </div>
    </div>
  )
}
