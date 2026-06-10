"use client"

// src/components/map/NavMap.tsx
// Leaflet map cho tài xế điều hướng
// Pha 1 (pickup): route cam đứt nét
// Pha 2 (delivery): route xanh liền
// Marker tài xế: dot cam pulse
// Marker điểm đến: pin màu theo pha

import { useEffect, useRef } from "react"

interface NavMapProps {
  driverLat: number
  driverLng: number
  targetLat: number
  targetLng: number
  phase:     "pickup" | "delivery" | "confirm" | "done"
  height?:   number
}

const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ?? ""
const DARK_TILE = `https://maps.vietmap.vn/mt/tm/{z}/{x}/{y}.png?apikey=${VIETMAP_KEY}`

export default function NavMap({
  driverLat, driverLng,
  targetLat, targetLng,
  phase, height = 225,
}: NavMapProps) {
  const divRef   = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef   = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drMarker = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tgMarker = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef     = useRef<any>(null)

  const isPickup   = phase === "pickup"
  const routeColor = isPickup ? "#FF6B00" : "#3ecf6e"
  const pinColor   = isPickup ? "#4a8ff5" : "#3ecf6e"
  const pinLabel   = isPickup ? "Quán" : "Khách"

  // ── Create marker icons ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeDriverIcon = (L: any) => L.divIcon({
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:#FF6B00;border:2.5px solid #fff;
      box-shadow:0 0 0 3px rgba(255,107,0,0.3),0 2px 8px rgba(0,0,0,0.5)">
    </div>`,
    className: "", iconSize:[14,14], iconAnchor:[7,7],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeTargetIcon = (L: any, color: string, label: string) => L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:0">
      <div style="
        background:${color};color:#fff;
        font-size:9px;font-weight:800;
        padding:3px 8px;border-radius:7px;
        white-space:nowrap;
        box-shadow:0 2px 8px rgba(0,0,0,0.5),0 0 0 1px ${color}">
        ${label}
      </div>
      <div style="width:2px;height:5px;background:${color};margin:0 auto"></div>
      <div style="
        width:8px;height:8px;border-radius:50%;
        background:${color};border:2px solid #fff;
        box-shadow:0 0 6px ${color}">
      </div>
    </div>`,
    className: "", iconSize:[50,30], iconAnchor:[25,30],
  })

  // ── Init map ───────────────────────────────────────────────
  useEffect(() => {
    if (!divRef.current) return

    const init = async () => {
      const L = (await import("leaflet")).default
      LRef.current = L

      // Fix default icon path
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      // Inject CSS once
      if (!document.getElementById("leaflet-css")) {
        const link  = document.createElement("link")
        link.id     = "leaflet-css"
        link.rel    = "stylesheet"
        link.href   = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        document.head.appendChild(link)
      }

      if (mapRef.current) return   // already inited

      const midLat = (driverLat + targetLat) / 2
      const midLng = (driverLng + targetLng) / 2

      const map = L.map(divRef.current!, {
        center:            [midLat, midLng],
        zoom:              15,
        zoomControl:       false,
        attributionControl:false,
        dragging:          true,
        scrollWheelZoom:   true,
      })
      mapRef.current = map

      L.tileLayer(DARK_TILE, { maxZoom:19 }).addTo(map)

      // Driver marker
      drMarker.current = L.marker([driverLat, driverLng], {
        icon: makeDriverIcon(L),
      }).addTo(map)

      // Target marker
      tgMarker.current = L.marker([targetLat, targetLng], {
        icon: makeTargetIcon(L, pinColor, pinLabel),
      }).addTo(map)

      // Route polyline
      routeRef.current = L.polyline(
        [[driverLat, driverLng], [targetLat, targetLng]],
        {
          color:     routeColor,
          weight:    4,
          opacity:   0.9,
          dashArray: isPickup ? "9,6" : undefined,
          lineCap:   "round",
          lineJoin:  "round",
        }
      ).addTo(map)

      // Fit both markers in view
      map.fitBounds(
        L.latLngBounds([driverLat, driverLng], [targetLat, targetLng]),
        { padding:[36, 36] }
      )
    }

    init()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current   = null
        drMarker.current = null
        tgMarker.current = null
        routeRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Update when props change ───────────────────────────────
  useEffect(() => {
    const L   = LRef.current
    const map = mapRef.current
    if (!L || !map) return

    // Update driver position
    drMarker.current?.setLatLng([driverLat, driverLng])

    // Update target marker (new icon color on phase change)
    if (tgMarker.current) {
      tgMarker.current.remove()
      tgMarker.current = L.marker([targetLat, targetLng], {
        icon: makeTargetIcon(L, pinColor, pinLabel),
      }).addTo(map)
    }

    // Update route
    if (routeRef.current) {
      routeRef.current.remove()
      routeRef.current = L.polyline(
        [[driverLat, driverLng], [targetLat, targetLng]],
        {
          color:     routeColor,
          weight:    4,
          opacity:   0.9,
          dashArray: isPickup ? "9,6" : undefined,
          lineCap:   "round",
          lineJoin:  "round",
        }
      ).addTo(map)
    }

    // Re-fit bounds
    map.fitBounds(
      L.latLngBounds([driverLat, driverLng], [targetLat, targetLng]),
      { padding:[36, 36], animate:true }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLat, driverLng, targetLat, targetLng, phase])

  return (
    <>
      <div ref={divRef} style={{ width:"100%", height, background:"#07090e" }} />
      <style>{`
        .leaflet-control-zoom { display:none !important; }
        .leaflet-attribution-flag { display:none !important; }
        .leaflet-control-attribution { display:none !important; }
      `}</style>
    </>
  )
}
