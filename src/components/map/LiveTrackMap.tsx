"use client"

import { useEffect, useRef } from "react"
import "maplibre-gl/dist/maplibre-gl.css"
import { MAP_STYLE, vmTransform, VIETMAP_KEY_MISSING } from "@/lib/mapConfig"
import MapKeyMissing from "@/components/map/MapKeyMissing"

interface LiveTrackMapProps {
  driverLat:  number
  driverLng:  number
  destLat:    number
  destLng:    number
  height?:    number
}

export default function LiveTrackMap({
  driverLat, driverLng, destLat, destLng, height = 280,
}: LiveTrackMapProps) {
  const divRef    = useRef<HTMLDivElement>(null)
  const mapRef    = useRef<any>(null)
  const driverRef = useRef<any>(null)
  const destRef   = useRef<any>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!divRef.current) return
    let mounted = true

    const init = async () => {
      const ml = (await import("maplibre-gl")).default
      if (!mounted || !divRef.current || mapRef.current) return

      const driverEl = document.createElement("div")
      driverEl.innerHTML = `<div style="width:16px;height:16px;border-radius:50%;background:#FF6B00;border:3px solid #fff;box-shadow:0 0 0 5px rgba(255,107,0,0.25),0 2px 8px rgba(0,0,0,0.5)"></div>`

      const destEl = document.createElement("div")
      destEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="background:#3ecf6e;color:#fff;font-size:10px;font-weight:800;padding:3px 9px;border-radius:7px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🏠 Nhà bạn</div>
        <div style="width:2px;height:6px;background:#3ecf6e"></div>
        <div style="width:8px;height:8px;border-radius:50%;background:#3ecf6e;border:2px solid #fff;box-shadow:0 0 6px #3ecf6e"></div>
      </div>`

      const map = new ml.Map({
        container: divRef.current,
        style: MAP_STYLE,
        center: [(driverLng + destLng) / 2, (driverLat + destLat) / 2],
        zoom: 15,
        attributionControl: false,
        transformRequest: vmTransform,
      })
      mapRef.current = map

      driverRef.current = new ml.Marker({ element: driverEl }).setLngLat([driverLng, driverLat]).addTo(map)
      destRef.current   = new ml.Marker({ element: destEl }).setLngLat([destLng, destLat]).addTo(map)

      map.on("load", () => {
        if (!mounted) return
        loadedRef.current = true
        map.resize()

        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature", properties: {},
            geometry: { type: "LineString", coordinates: [[driverLng, driverLat], [destLng, destLat]] },
          },
        })
        map.addLayer({
          id: "route", type: "line", source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#FF6B00", "line-width": 3, "line-opacity": 0.7, "line-dasharray": [2, 1.5] },
        })

        map.fitBounds(
          [[Math.min(driverLng, destLng), Math.min(driverLat, destLat)],
           [Math.max(driverLng, destLng), Math.max(driverLat, destLat)]],
          { padding: 40 }
        )
      })
    }

    init()
    return () => {
      mounted = false
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !driverRef.current) return

    driverRef.current.setLngLat([driverLng, driverLat])
    destRef.current?.setLngLat([destLng, destLat])

    if (loadedRef.current && map.getSource("route")) {
      ;(map.getSource("route") as any).setData({
        type: "Feature", properties: {},
        geometry: { type: "LineString", coordinates: [[driverLng, driverLat], [destLng, destLat]] },
      })
    }

    map.easeTo({ center: [(driverLng + destLng) / 2, (driverLat + destLat) / 2] })
  }, [driverLat, driverLng, destLat, destLng])

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <div ref={divRef} style={{ width: "100%", height, background: "#07090e" }} />
      {VIETMAP_KEY_MISSING && <MapKeyMissing />}
    </div>
  )
}
