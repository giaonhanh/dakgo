"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { applyBrandStyle } from "@/lib/mapStyle"

const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ?? ""
const STYLE_URL   = `https://maps.vietmap.vn/mt/tm/style.json?apikey=${VIETMAP_KEY}`

interface Props {
  lat:    number
  lng:    number
  onPick: (lat: number, lng: number) => void
}

export default function MiniMapPicker({ lat, lng, onPick }: Props) {
  const divRef    = useRef<HTMLDivElement>(null)
  const mapRef    = useRef<any>(null)
  const skipRef   = useRef(true)
  const prevProps = useRef({ lat, lng })
  const [floating, setFloating] = useState(false)

  useEffect(() => {
    if (!divRef.current) return
    let map: any

    const init = async () => {
      const maplibre = (await import("maplibre-gl")).default
      await import("maplibre-gl/dist/maplibre-gl.css")

      map = new maplibre.Map({
        container:          divRef.current!,
        style:              STYLE_URL,
        center:             [lng, lat],
        zoom:               16,
        maxZoom:            20,
        attributionControl: false,
        dragRotate:         false,
      })
      mapRef.current = map

      map.on("load", () => applyBrandStyle(map))
      map.on("dragstart", () => setFloating(true))
      map.on("dragend",   () => setFloating(false))
      map.on("moveend", () => {
        if (skipRef.current) { skipRef.current = false; return }
        const c = map.getCenter()
        onPick(c.lat, c.lng)
      })
    }

    init()
    return () => { if (map) { map.remove(); mapRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (prevProps.current.lat === lat && prevProps.current.lng === lng) return
    prevProps.current = { lat, lng }
    if (!mapRef.current) return
    skipRef.current = true
    mapRef.current.flyTo({ center: [lng, lat], zoom: 17, animate: true })
  }, [lat, lng])

  const handleZoom = useCallback((delta: number) => {
    if (!mapRef.current) return
    mapRef.current.setZoom((mapRef.current.getZoom() ?? 16) + delta)
  }, [])

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <style>{`.maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right{display:none!important}`}</style>

      <div ref={divRef} style={{ width: "100%", height: "100%" }} />

      {/* Center pin */}
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
            boxShadow: floating ? "0 10px 24px rgba(255,107,26,0.7)" : "0 3px 10px rgba(255,107,26,0.5)",
            border: "2px solid rgba(255,255,255,0.9)",
            transition: "box-shadow 0.2s",
          }} />
        </div>
      </div>

      {/* Zoom buttons */}
      <div style={{
        position: "absolute", right: 6, bottom: 6, zIndex: 15,
        display: "flex", flexDirection: "column", gap: 3,
      }}>
        {(["+", "−"] as const).map(label => (
          <button
            key={label}
            type="button"
            onClick={() => handleZoom(label === "+" ? 1 : -1)}
            style={{
              width: 26, height: 26, borderRadius: 7,
              background: "rgba(14,12,9,0.9)",
              border: "1px solid rgba(255,107,0,0.2)",
              color: "#FF8C00", fontSize: 17, lineHeight: 1,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >{label}</button>
        ))}
      </div>
    </div>
  )
}
