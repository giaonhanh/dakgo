"use client"

import { useEffect, useRef } from "react"
import "maplibre-gl/dist/maplibre-gl.css"
import { MAP_STYLE, vmTransform } from "@/lib/mapConfig"

interface NavMapProps {
  driverLat: number
  driverLng: number
  targetLat: number
  targetLng: number
  phase:     "pickup" | "delivery" | "confirm" | "done"
  height?:   number
}

function makeDriverEl() {
  const el = document.createElement("div")
  el.innerHTML = `<div style="width:14px;height:14px;border-radius:50%;background:#FF6B00;border:2.5px solid #fff;box-shadow:0 0 0 3px rgba(255,107,0,0.3),0 2px 8px rgba(0,0,0,0.5)"></div>`
  return el
}

function makeTargetEl(color: string, label: string) {
  const el = document.createElement("div")
  el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center">
    <div style="background:${color};color:#fff;font-size:9px;font-weight:800;padding:3px 8px;border-radius:7px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5)">${label}</div>
    <div style="width:2px;height:5px;background:${color}"></div>
    <div style="width:8px;height:8px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 6px ${color}"></div>
  </div>`
  return el
}

function routeData(dlng: number, dlat: number, tlng: number, tlat: number) {
  return {
    type: "Feature" as const, properties: {},
    geometry: { type: "LineString" as const, coordinates: [[dlng, dlat], [tlng, tlat]] },
  }
}

export default function NavMap({
  driverLat, driverLng, targetLat, targetLng, phase, height = 225,
}: NavMapProps) {
  const divRef    = useRef<HTMLDivElement>(null)
  const mapRef    = useRef<any>(null)
  const mlRef     = useRef<any>(null)
  const drMarker  = useRef<any>(null)
  const tgMarker  = useRef<any>(null)
  const loadedRef = useRef(false)

  const isPickup   = phase === "pickup"
  const routeColor = isPickup ? "#FF6B00" : "#3ecf6e"
  const pinColor   = isPickup ? "#4a8ff5" : "#3ecf6e"
  const pinLabel   = isPickup ? "Quán" : "Khách"

  useEffect(() => {
    if (!divRef.current) return
    let mounted = true

    const init = async () => {
      const ml = (await import("maplibre-gl")).default
      if (!mounted || !divRef.current || mapRef.current) return
      mlRef.current = ml

      const map = new ml.Map({
        container: divRef.current,
        style: MAP_STYLE,
        center: [(driverLng + targetLng) / 2, (driverLat + targetLat) / 2],
        zoom: 15,
        attributionControl: false,
        transformRequest: vmTransform,
      })
      mapRef.current = map

      drMarker.current = new ml.Marker({ element: makeDriverEl() })
        .setLngLat([driverLng, driverLat]).addTo(map)
      tgMarker.current = new ml.Marker({ element: makeTargetEl(pinColor, pinLabel) })
        .setLngLat([targetLng, targetLat]).addTo(map)

      map.on("load", () => {
        if (!mounted) return
        loadedRef.current = true
        map.resize()

        map.addSource("route", { type: "geojson", data: routeData(driverLng, driverLat, targetLng, targetLat) })
        map.addLayer({
          id: "route", type: "line", source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": routeColor, "line-width": 4, "line-opacity": 0.9,
            ...(isPickup ? { "line-dasharray": [2, 1.5] } : {}),
          },
        })

        map.fitBounds(
          [[Math.min(driverLng, targetLng), Math.min(driverLat, targetLat)],
           [Math.max(driverLng, targetLng), Math.max(driverLat, targetLat)]],
          { padding: 36 }
        )
      })
    }

    init()
    return () => {
      mounted = false
      loadedRef.current = false
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; drMarker.current = null; tgMarker.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const ml  = mlRef.current
    if (!map || !ml) return

    drMarker.current?.setLngLat([driverLng, driverLat])

    if (tgMarker.current) {
      tgMarker.current.remove()
      tgMarker.current = new ml.Marker({ element: makeTargetEl(pinColor, pinLabel) })
        .setLngLat([targetLng, targetLat]).addTo(map)
    }

    if (loadedRef.current) {
      if (map.getLayer("route")) map.removeLayer("route")
      if (map.getSource("route")) map.removeSource("route")
      map.addSource("route", { type: "geojson", data: routeData(driverLng, driverLat, targetLng, targetLat) })
      map.addLayer({
        id: "route", type: "line", source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": routeColor, "line-width": 4, "line-opacity": 0.9,
          ...(isPickup ? { "line-dasharray": [2, 1.5] } : {}),
        },
      })
    }

    map.fitBounds(
      [[Math.min(driverLng, targetLng), Math.min(driverLat, targetLat)],
       [Math.max(driverLng, targetLng), Math.max(driverLat, targetLat)]],
      { padding: 36, animate: true }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLat, driverLng, targetLat, targetLng, phase])

  return <div ref={divRef} style={{ width: "100%", height, background: "#07090e" }} />
}
