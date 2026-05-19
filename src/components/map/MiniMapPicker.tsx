"use client"

// Component này chỉ render client-side (no SSR) — import qua dynamic()
import React, { useEffect, useRef } from "react"

const DARK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"

interface Props {
  lat:    number
  lng:    number
  onPick: (lat: number, lng: number) => void
}

export default function MiniMapPicker({ lat, lng, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<unknown>(null)
  const markerRef    = useRef<unknown>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof import("leaflet")

    // Fix default icon missing in Next.js
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    })

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    })

    L.tileLayer(DARK_TILE, { maxZoom: 19 }).addTo(map)

    const customIcon = L.divIcon({
      html: `<div style="
        width:30px;height:30px;border-radius:50% 50% 50% 0;
        background:linear-gradient(135deg,#FF6B00,#FFB347);
        transform:rotate(-45deg);
        box-shadow:0 2px 8px rgba(255,107,0,0.5);
        border:2px solid #fff;
      "></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      className: "",
    })

    const marker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map)

    marker.on("dragend", () => {
      const pos = marker.getLatLng()
      onPick(pos.lat, pos.lng)
    })

    map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      onPick(e.latlng.lat, e.latlng.lng)
    })

    mapRef.current   = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapRef.current   = null
      markerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update marker khi lat/lng prop thay đổi (từ geocode)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return
    const L = require("leaflet") as typeof import("leaflet")
    const map    = mapRef.current    as import("leaflet").Map
    const marker = markerRef.current as import("leaflet").Marker
    marker.setLatLng([lat, lng])
    map.setView([lat, lng], 16, { animate: true })
  }, [lat, lng])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </>
  )
}
