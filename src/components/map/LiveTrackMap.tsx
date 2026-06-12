"use client"

// src/components/map/LiveTrackMap.tsx
// Customer tracking map: driver marker (cam, pulse) + destination (xanh)
// Import dynamic (no SSR) từ tracking page

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"

interface LiveTrackMapProps {
  driverLat:  number
  driverLng:  number
  destLat:    number
  destLng:    number
  height?:    number
}

const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ?? ""
const VIETMAP_TILE = `https://maps.vietmap.vn/mt/tm/{z}/{x}/{y}.png?apikey=${VIETMAP_KEY}`

export default function LiveTrackMap({
  driverLat, driverLng, destLat, destLng, height = 280,
}: LiveTrackMapProps) {
  const divRef    = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef    = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driverRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const destRef   = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeRef  = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef      = useRef<any>(null)

  useEffect(() => {
    if (!divRef.current) return
    let mounted = true

    const init = async () => {
      const L = (await import("leaflet")).default
      if (!mounted || !divRef.current) return
      LRef.current = L

      if (mapRef.current) return

      const midLat = (driverLat + destLat) / 2
      const midLng = (driverLng + destLng) / 2

      const map = L.map(divRef.current!, {
        center: [midLat, midLng], zoom: 15,
        zoomControl: false, attributionControl: false,
        doubleClickZoom: false,
      })
      mapRef.current = map
      L.tileLayer(VIETMAP_TILE, { maxZoom: 19 }).addTo(map)

      // Driver marker — pulsing orange dot
      const driverIcon = L.divIcon({
        html: `<div style="
          width:16px;height:16px;border-radius:50%;
          background:#FF6B00;border:3px solid #fff;
          box-shadow:0 0 0 5px rgba(255,107,0,0.25),0 2px 8px rgba(0,0,0,0.5)">
        </div>`,
        className: "", iconSize: [16, 16], iconAnchor: [8, 8],
      })

      // Destination marker — home pin
      const destIcon = L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="
            background:#3ecf6e;color:#fff;font-size:10px;font-weight:800;
            padding:3px 9px;border-radius:7px;white-space:nowrap;
            box-shadow:0 2px 8px rgba(0,0,0,0.4)">
            🏠 Nhà bạn
          </div>
          <div style="width:2px;height:6px;background:#3ecf6e;margin:0 auto"></div>
          <div style="width:8px;height:8px;border-radius:50%;
            background:#3ecf6e;border:2px solid #fff;
            box-shadow:0 0 6px #3ecf6e"></div>
        </div>`,
        className: "", iconSize: [70, 32], iconAnchor: [35, 32],
      })

      driverRef.current = L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(map)
      destRef.current   = L.marker([destLat, destLng], { icon: destIcon }).addTo(map)

      // Route polyline
      routeRef.current = L.polyline(
        [[driverLat, driverLng], [destLat, destLng]],
        { color:"#FF6B00", weight:3, opacity:0.7, dashArray:"8,5",
          lineCap:"round", lineJoin:"round" }
      ).addTo(map)

      map.fitBounds(
        L.latLngBounds([driverLat, driverLng], [destLat, destLng]),
        { padding: [40, 40] }
      )
    }

    init()
    return () => {
      mounted = false
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update driver + dest positions when props change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !driverRef.current) return

    driverRef.current.setLatLng([driverLat, driverLng])
    destRef.current?.setLatLng([destLat, destLng])
    if (routeRef.current) {
      routeRef.current.setLatLngs([[driverLat, driverLng], [destLat, destLng]])
    }
    map.panTo([(driverLat + destLat) / 2, (driverLng + destLng) / 2], { animate: true })
  }, [driverLat, driverLng, destLat, destLng])

  return (
    <>
      <div ref={divRef} style={{ width: "100%", height, background: "#07090e" }} />
      <style>{`
        .leaflet-control-zoom,.leaflet-control-attribution{display:none!important}
      `}</style>
    </>
  )
}
