"use client"

// Leaflet map với marker kéo được để chọn toạ độ
// Import dynamic (no SSR) từ addresses page

import { useEffect, useRef, useState } from "react"
import type { Map as LeafletMap, Marker, LeafletMouseEvent } from "leaflet"
import { reverseGeocodeStructured } from "@/lib/vietmapRoute"

type LeafletModule = typeof import("leaflet")

interface MapPickerProps {
  lat:              number
  lng:              number
  onLocationChange: (lat: number, lng: number, address?: string) => void
  height?:          number
}

export default function MapPicker({ lat, lng, onLocationChange, height = 200 }: MapPickerProps) {
  const mapRef  = useRef<LeafletMap | null>(null)
  const markRef = useRef<Marker | null>(null)
  const divRef  = useRef<HTMLDivElement>(null)
  const [lMod, setLMod] = useState<LeafletModule | null>(null)

  // Load Leaflet once
  useEffect(() => {
    import("leaflet").then(L => {
      const proto = L.Icon.Default.prototype as typeof L.Icon.Default.prototype & { _getIconUrl?: unknown }
      delete proto._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })
      setLMod(L)
    })
  }, [])

  // Init map after Leaflet is loaded
  useEffect(() => {
    if (!lMod || !divRef.current || mapRef.current) return

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link")
      link.id   = "leaflet-css"
      link.rel  = "stylesheet"
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      document.head.appendChild(link)
    }

    const DARK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"

    const map = lMod.map(divRef.current, {
      center:           [lat, lng],
      zoom:             15,
      zoomControl:      false,
      attributionControl: false,
    })

    lMod.tileLayer(DARK_TILE, { maxZoom: 19 }).addTo(map)

    const orangeIcon = lMod.divIcon({
      html: `<div style="
        width:28px;height:28px;border-radius:50% 50% 50% 0;
        background:linear-gradient(135deg,#FF6B00,#FF8C00);
        border:2px solid #fff;
        box-shadow:0 2px 8px rgba(255,107,0,0.5);
        transform:rotate(-45deg);
      "></div>`,
      className:  "",
      iconSize:   [28, 28],
      iconAnchor: [14, 28],
    })

    const marker = lMod.marker([lat, lng], {
      icon:      orangeIcon,
      draggable: true,
    }).addTo(map)

    marker.on("dragend", async () => {
      const pos  = marker.getLatLng()
      const { address } = await reverseGeocodeStructured(pos.lat, pos.lng)
      onLocationChange(pos.lat, pos.lng, address || undefined)
    })

    map.on("click", async (e: LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      const { address } = await reverseGeocodeStructured(e.latlng.lat, e.latlng.lng)
      onLocationChange(e.latlng.lat, e.latlng.lng, address || undefined)
    })

    lMod.control.zoom({ position: "bottomright" }).addTo(map)

    mapRef.current  = map
    markRef.current = marker

    return () => {
      map.remove()
      mapRef.current  = null
      markRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lMod])

  // Sync marker + view when props change
  useEffect(() => {
    if (!mapRef.current || !markRef.current) return
    markRef.current.setLatLng([lat, lng])
    mapRef.current.setView([lat, lng], mapRef.current.getZoom(), { animate: true })
  }, [lat, lng])

  return (
    <div style={{ position: "relative" }}>
      <div ref={divRef} style={{ width: "100%", height, borderRadius: 12, background: "#07090e", overflow: "hidden" }} />
      <style>{`
        .leaflet-control-zoom { border:none !important; box-shadow:none !important; }
        .leaflet-control-zoom a {
          background:rgba(14,12,9,0.9) !important;
          border:1px solid rgba(255,107,0,0.2) !important;
          color:#FF8C00 !important;
          width:28px !important; height:28px !important; line-height:28px !important;
          font-size:16px !important; border-radius:8px !important; margin-bottom:3px !important;
        }
        .leaflet-control-zoom a:hover { background:rgba(255,107,0,0.12) !important; }
      `}</style>
    </div>
  )
}
