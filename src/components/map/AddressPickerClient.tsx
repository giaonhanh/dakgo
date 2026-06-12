"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { AddressPickerResult } from "@/types"
import { getCachedGeocode, setCachedGeocode } from "@/lib/geocodeCache"
const DEFAULT_LAT = 12.7107
const DEFAULT_LNG = 108.3034
const PANEL_H    = 216
const SEARCH_H   = 56
const GEOCODE_MS = 600
const SEARCH_MS  = 500

// Proxy tile qua /api/tiles để tránh CORS — VietMap block Origin từ browser
function buildRasterStyle() {
  return {
    version: 8 as const,
    sources: {
      vietmap: {
        type: "raster" as const,
        tiles: ["/api/tiles/{z}/{x}/{y}"],
        tileSize: 256,
        attribution: "© VietMap",
      },
    },
    layers: [{ id: "vietmap-raster", type: "raster" as const, source: "vietmap" }],
  }
}

interface LatLng { lat: number; lng: number }

export interface AddressPickerProps {
  onConfirm:   (result: AddressPickerResult) => void
  onClose?:    () => void
  initialLat?: number
  initialLng?: number
  height?:     string
  className?:  string
}

interface PlaceSuggestion {
  refId:         string
  mainText:      string
  secondaryText: string
}

async function vietmapSearch(input: string, lat: number, lng: number, sessionToken: string): Promise<PlaceSuggestion[]> {
  const res = await fetch("/api/places/autocomplete", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input, sessionToken,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } },
    }),
  })
  const data = await res.json()
  return (data.suggestions ?? []).slice(0, 6).map((s: Record<string, unknown>) => {
    const pred = s.placePrediction as Record<string, unknown>
    const fmt  = pred.structuredFormat as Record<string, Record<string, string>> | undefined
    return {
      refId:         pred.placeId as string,
      mainText:      fmt?.mainText?.text ?? "",
      secondaryText: fmt?.secondaryText?.text ?? "",
    }
  })
}

async function vietmapPlaceDetail(placeId: string, sessionToken: string): Promise<{
  lat: number; lng: number; address: string; houseNote: string
}> {
  const res = await fetch(
    `/api/places/detail?placeId=${encodeURIComponent(placeId)}&sessionToken=${encodeURIComponent(sessionToken)}`,
  )
  const data = await res.json()
  return {
    lat:       (data.location?.latitude  as number) ?? 0,
    lng:       (data.location?.longitude as number) ?? 0,
    address:   (data.formattedAddress as string) ?? "",
    houseNote: "",
  }
}

async function reverseGeocodeAddr(lat: number, lng: number): Promise<string> {
  const cached = getCachedGeocode(lat, lng)
  if (cached) return cached
  try {
    const res = await fetch(`/api/geocode?latlng=${lat},${lng}`)
    if (res.ok) {
      const data = await res.json()
      const addr = Array.isArray(data) ? data[0]?.display : undefined
      if (addr) { setCachedGeocode(lat, lng, addr); return addr }
    }
  } catch { /* fallback */ }
  return ""
}

function NoteInput({ value, onChange, autoFilled = false, onEdit, onFocus: onFocusProp }: {
  value: string; onChange: (v: string) => void; autoFilled?: boolean; onEdit?: () => void; onFocus?: () => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, height: 40, flexShrink: 0,
      background: "rgba(255,255,255,0.06)",
      border: `1px solid ${focused ? "rgba(255,215,0,0.45)" : autoFilled ? "rgba(255,215,0,0.22)" : "rgba(255,255,255,0.1)"}`,
      borderRadius: 12, padding: "0 12px", transition: "border-color .2s",
      boxShadow: focused ? "0 0 0 3px rgba(255,215,0,0.08)" : "none",
    }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>&#128221;</span>
      <input
        id="address-note" name="address-note"
        type="text" value={value}
        onChange={e => { onChange(e.target.value); onEdit?.() }}
        onFocus={() => { setFocused(true); onFocusProp?.() }}
        onBlur={() => setFocused(false)}
        placeholder="Ghi chú: Đặc điểm nhận dạng nhà/người cho tài xế"
        style={{
          flex: 1, background: "transparent", border: "none", outline: "none",
          color: "#f8f0e0", fontSize: 11, fontFamily: "Lexend",
        }}
      />
      {autoFilled && value && (
        <div style={{
          background: "rgba(255,215,0,0.15)", color: "rgba(255,215,0,0.8)",
          fontSize: 7, fontWeight: 700, borderRadius: 4, padding: "2px 6px",
          flexShrink: 0, letterSpacing: 0.3,
        }}>tự động</div>
      )}
    </div>
  )
}

function Spinner({ size = 16, color = "#FFD700" }: { size?: number; color?: string }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${color}22`, borderTop: `2px solid ${color}`,
      }}
    />
  )
}

export default function AddressPickerClient({
  onConfirm, onClose, initialLat, initialLng,
  height = "100dvh", className = "",
}: AddressPickerProps) {
  const divRef          = useRef<HTMLDivElement>(null)
  const mapRef          = useRef<any>(null)
  const geocodeTimer    = useRef<ReturnType<typeof setTimeout>>(undefined)
  const searchTimer     = useRef<ReturnType<typeof setTimeout>>(undefined)
  const autoNoteRef     = useRef("")
  const searchInputRef  = useRef<HTMLInputElement>(null)
  const skipGeocodeRef  = useRef(false)
  const centerRef       = useRef<LatLng>({ lat: initialLat ?? DEFAULT_LAT, lng: initialLng ?? DEFAULT_LNG })
  const areaCtxRef      = useRef("Krong Pac, Dak Lak")
  const sessionTokenRef = useRef<string>(crypto.randomUUID())
  const addrInputRef    = useRef<HTMLInputElement>(null)
  const geocodeIdRef    = useRef(0)

  const initLat = initialLat ?? DEFAULT_LAT
  const initLng = initialLng ?? DEFAULT_LNG

  const [center,      setCenter]      = useState<LatLng>({ lat: initLat, lng: initLng })
  const [flyTarget,   setFlyTarget]   = useState<[number, number] | null>(null)
  const [address,     setAddress]     = useState("Đang xác định vị trí...")
  const [searchText,  setSearchText]  = useState("")
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [searching,   setSearching]   = useState(false)
  const [note,        setNote]        = useState("")
  const [noteIsAuto,  setNoteIsAuto]  = useState(false)
  const [floating,    setFloating]    = useState(false)
  const [pulseKey,    setPulseKey]    = useState(0)
  const [showPulse,   setShowPulse]   = useState(false)
  const [locating,    setLocating]    = useState(!initialLat && !initialLng)
  const [geocoding,   setGeocoding]   = useState(true)
  const [tilesReady,  setTilesReady]  = useState(false)
  const [mapError,    setMapError]    = useState(false)
  const [editingAddr, setEditingAddr] = useState(false)
  const [gpsDeniedMsg, setGpsDeniedMsg] = useState(false)

  const applyNote = useCallback((houseNote: string) => {
    setNote(prev => {
      if (!houseNote) return prev === autoNoteRef.current ? "" : prev
      if (prev === "" || prev === autoNoteRef.current) return houseNote
      return prev
    })
    setNoteIsAuto(!!houseNote)
    autoNoteRef.current = houseNote
  }, [])

  const doGeocode = useCallback(async (lat: number, lng: number) => {
    const myId = ++geocodeIdRef.current
    setGeocoding(true)
    const addr = await reverseGeocodeAddr(lat, lng)
    if (myId !== geocodeIdRef.current) return // stale — có request mới hơn
    if (addr) { setAddress(addr); applyNote("") }
    else setAddress("")
    setGeocoding(false)
  }, [applyNote])

  const scheduleGeocode = useCallback((lat: number, lng: number) => {
    clearTimeout(geocodeTimer.current)
    geocodeTimer.current = setTimeout(() => void doGeocode(lat, lng), GEOCODE_MS)
  }, [doGeocode])

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 3) { setSuggestions([]); setShowSuggest(false); return }
    setSearching(true)
    try {
      const items = await vietmapSearch(trimmed, centerRef.current.lat, centerRef.current.lng, sessionTokenRef.current)
      setSuggestions(items)
      setShowSuggest(items.length > 0)
    } catch {
      setSuggestions([]); setShowSuggest(false)
    } finally {
      setSearching(false)
    }
  }, [])

  const scheduleSearch = useCallback((q: string) => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => void doSearch(q), SEARCH_MS)
  }, [doSearch])

  // Init map
  useEffect(() => {
    if (!divRef.current) return
    let map: any

    const init = async () => {
      const maplibre = (await import("maplibre-gl")).default
      await import("maplibre-gl/dist/maplibre-gl.css")

      map = new maplibre.Map({
        container:          divRef.current!,
        style:              buildRasterStyle(),
        center:             [initLng, initLat],
        zoom:               15,
        maxZoom:            20,
        attributionControl: false,
        dragRotate:         false,
      })
      mapRef.current = map

      map.on("load", () => {
        map.resize()
        setTilesReady(true)
      })
      map.on("error", () => { setTilesReady(true); setMapError(true) })
      map.on("dragstart", () => { setFloating(true); setShowSuggest(false) })
      map.on("dragend",   () => {
        setFloating(false)
        setShowPulse(true)
        setPulseKey(k => k + 1)
        setTimeout(() => setShowPulse(false), 800)
      })
      map.on("moveend", () => {
        if (skipGeocodeRef.current) { skipGeocodeRef.current = false; return }
        const c = map.getCenter()
        centerRef.current = { lat: c.lat, lng: c.lng }
        setCenter({ lat: c.lat, lng: c.lng })
        scheduleGeocode(c.lat, c.lng)
      })

      // ResizeObserver: tự resize map khi container thay đổi kích thước
      if (divRef.current) {
        const ro = new ResizeObserver(() => { map.resize() })
        ro.observe(divRef.current)
        // cleanup sẽ disconnect khi map bị remove
        map.once("remove", () => ro.disconnect())
      }

      // Fallback tiles-ready timeout (4s cho mạng chậm)
      setTimeout(() => setTilesReady(true), 4000)
    }

    init()

    // Initial GPS or geocode
    if (initialLat && initialLng) {
      void doGeocode(initialLat, initialLng)
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setLocating(false)
          skipGeocodeRef.current = true
          const pos = { lat: coords.latitude, lng: coords.longitude }
          centerRef.current = pos
          setCenter(pos)
          setFlyTarget([coords.latitude, coords.longitude])
          void doGeocode(coords.latitude, coords.longitude)
        },
        () => {
          setLocating(false)
          setGpsDeniedMsg(true)
          setTimeout(() => setGpsDeniedMsg(false), 4000)
          void doGeocode(DEFAULT_LAT, DEFAULT_LNG)
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
      )
    } else {
      setLocating(false)
      void doGeocode(DEFAULT_LAT, DEFAULT_LNG)
    }

    return () => {
      clearTimeout(geocodeTimer.current)
      clearTimeout(searchTimer.current)
      if (map) { map.remove(); mapRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // FlyTo when flyTarget changes
  useEffect(() => {
    if (!flyTarget || !mapRef.current) return
    mapRef.current.flyTo({ center: [flyTarget[1], flyTarget[0]], zoom: 18, animate: true })
  }, [flyTarget])

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        skipGeocodeRef.current = true
        const pos = { lat: coords.latitude, lng: coords.longitude }
        centerRef.current = pos
        setCenter(pos)
        setFlyTarget([coords.latitude, coords.longitude])
        void doGeocode(coords.latitude, coords.longitude)
      },
      () => {
        setLocating(false)
        setGpsDeniedMsg(true)
        setTimeout(() => setGpsDeniedMsg(false), 4000)
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    )
  }, [doGeocode])

  const handleZoom = useCallback((delta: number) => {
    if (!mapRef.current) return
    mapRef.current.setZoom((mapRef.current.getZoom() ?? 15) + delta)
  }, [])

  const selectSuggestion = useCallback(async (s: PlaceSuggestion) => {
    setSearchText("")
    setShowSuggest(false)
    setSuggestions([])
    searchInputRef.current?.blur()
    setGeocoding(true)
    try {
      const detail = await vietmapPlaceDetail(s.refId, sessionTokenRef.current)
      sessionTokenRef.current = crypto.randomUUID()
      skipGeocodeRef.current = true
      const pos = { lat: detail.lat, lng: detail.lng }
      centerRef.current = pos
      setCenter(pos)
      setFlyTarget([detail.lat, detail.lng])
      const addr = detail.address || (s.secondaryText ? `${s.mainText}, ${s.secondaryText}` : s.mainText)
      setAddress(addr)
      applyNote(detail.houseNote)
      onConfirm({ lat: detail.lat, lng: detail.lng, address: addr, note: detail.houseNote })
    } catch {
      setSuggestions([])
      setShowSuggest(false)
    } finally {
      setGeocoding(false)
    }
  }, [applyNote, onConfirm])

  const handleConfirm = useCallback(() => {
    onConfirm({ lat: center.lat, lng: center.lng, address, note })
  }, [center, address, note, onConfirm])

  return (
    <div className={className} style={{
      position: "relative", width: "100%", height,
      overflow: "hidden", fontFamily: "'Lexend', sans-serif",
      background: "#0d0a06",
    }}>
      <style>{`
        @keyframes pinPulseRing {
          0%   { transform: scale(0.25); opacity: 1 }
          100% { transform: scale(3.5);  opacity: 0 }
        }
        @keyframes shimmer { 0% { left:-60% } 100% { left:120% } }
        .maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right{display:none!important}
      `}</style>

      {/* Search Bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 30,
        background: "rgba(10,7,4,0.94)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,215,0,0.15)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}>
        <div style={{ height: SEARCH_H, display: "flex", alignItems: "center", padding: "0 12px", gap: 10 }}>
          {onClose ? (
            <button type="button" onClick={onClose} style={{
              background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)",
              cursor: "pointer", width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,215,0,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="rgba(255,215,0,0.6)" strokeWidth="2" />
              <path d="M16.5 16.5l4 4" stroke="rgba(255,215,0,0.6)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}
          <input
            ref={searchInputRef}
            id="address-search" name="address-search"
            type="text" value={searchText}
            onChange={e => { setSearchText(e.target.value); scheduleSearch(e.target.value) }}
            onFocus={() => searchText.length >= 3 && setShowSuggest(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
            placeholder="Tìm thôn, xã, đường, địa điểm..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#f8f0e0", fontSize: 13, fontFamily: "Lexend", fontWeight: 500,
              caretColor: "#FFD700",
            }}
          />
          {searching ? <Spinner /> : searchText ? (
            <button type="button"
              onMouseDown={e => { e.preventDefault(); setSearchText(""); setSuggestions([]); setShowSuggest(false) }}
              style={{
                background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer",
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                color: "rgba(255,255,255,0.5)", fontSize: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >X</button>
          ) : null}
        </div>
      </div>

      {/* Suggestions */}
      <AnimatePresence>
        {showSuggest && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", top: `calc(${SEARCH_H}px + env(safe-area-inset-top, 0px))`, left: 0, right: 0, zIndex: 29,
              background: "rgba(12,8,4,0.98)", backdropFilter: "blur(20px)",
              borderBottom: "1px solid rgba(255,215,0,0.12)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.8)", overflow: "hidden",
            }}
          >
            {suggestions.map((s, i) => (
              <button key={s.refId} type="button"
                onMouseDown={e => { e.preventDefault(); void selectSuggestion(s) }}
                style={{
                  width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                  padding: "11px 14px", background: "transparent",
                  borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,215,0,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 2 }}>&#128205;</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 700, lineHeight: 1.4, wordBreak: "break-word" }}>
                    {s.mainText}
                  </div>
                  {s.secondaryText && (
                    <div style={{ color: "#8a7a60", fontSize: 11, marginTop: 2, lineHeight: 1.5, wordBreak: "break-word" }}>
                      {s.secondaryText}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map */}
      <div style={{
        position: "absolute",
        top: `calc(${SEARCH_H}px + env(safe-area-inset-top, 0px))`,
        bottom: PANEL_H, left: 0, right: 0, zIndex: 1,
      }}>
        {!tilesReady && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 5,
            background: "#0d0a06",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 8,
          }}>
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: 28 }}
            >&#128506;</motion.div>
            <span style={{ color: "#6a5a40", fontSize: 10, fontFamily: "Lexend" }}>Đang tải bản đồ...</span>
          </div>
        )}

        {mapError && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 6,
            background: "rgba(8,8,6,0.92)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 10,
          }}>
            <span style={{ fontSize: 30 }}>🗺️</span>
            <span style={{ color: "#ff4040", fontSize: 12, fontFamily: "Lexend", fontWeight: 600 }}>Không thể tải bản đồ</span>
            <button onClick={() => { setMapError(false); setTilesReady(false); window.location.reload() }}
              style={{ padding: "7px 18px", borderRadius: 10, background: "rgba(255,107,0,0.15)", border: "1px solid rgba(255,107,0,0.35)", color: "#FF8C00", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>
              Thử lại
            </button>
          </div>
        )}

        {gpsDeniedMsg && (
          <div style={{
            position: "absolute", top: 12, left: 12, right: 12, zIndex: 20,
            background: "rgba(255,100,0,0.15)", border: "1px solid rgba(255,100,0,0.35)",
            borderRadius: 10, padding: "9px 13px",
            color: "#FF8C00", fontSize: 10.5, fontWeight: 600, fontFamily: "Lexend",
          }}>
            📍 GPS không khả dụng — vui lòng kéo bản đồ hoặc tìm địa chỉ thủ công
          </div>
        )}

        <div ref={divRef} style={{ width: "100%", height: "100%", touchAction: "none" }} />

        {/* Map Controls — bottom right */}
        <div style={{
          position: "absolute", right: 12, bottom: 12, zIndex: 15,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <button type="button" onClick={handleGPS} style={{
            width: 40, height: 40, borderRadius: 10,
            border: "1px solid rgba(255,215,0,0.35)",
            background: "rgba(10,7,4,0.88)",
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}>
            {locating ? <Spinner size={14} /> : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" fill="#FFD700" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="7" stroke="#FFD700" strokeWidth="1.5" opacity="0.4" />
              </svg>
            )}
          </button>
          {(["+", "-"] as const).map(label => (
            <button
              key={label}
              type="button"
              onClick={() => handleZoom(label === "+" ? 1 : -1)}
              style={{
                width: 40, height: 40, borderRadius: 10,
                border: "1px solid rgba(255,215,0,0.25)",
                background: "rgba(10,7,4,0.88)",
                backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                cursor: "pointer", fontSize: 22,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#FFD700", boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Center Pin Overlay */}
      <div style={{
        position: "absolute",
        top: `calc(${SEARCH_H}px + env(safe-area-inset-top, 0px))`,
        bottom: PANEL_H, left: 0, right: 0,
        zIndex: 10, pointerEvents: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {showPulse && (
          <div key={pulseKey} style={{
            position: "absolute", width: 44, height: 44, borderRadius: "50%",
            border: "2px solid rgba(255,215,0,0.9)",
            animation: "pinPulseRing 0.7s cubic-bezier(0.2,0.8,0.4,1) forwards",
          }} />
        )}
        <motion.div
          style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
          animate={{ y: floating ? -22 : 0, scale: floating ? 1.14 : 1 }}
          transition={{ type: "spring", stiffness: 340, damping: 20, mass: 0.75 }}
        >
          <div style={{
            width: 42, height: 42, borderRadius: "50%",
            background: "radial-gradient(circle at 36% 28%, #FFF8C0, #FFD700 44%, #CC9800)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: floating
              ? "0 16px 40px rgba(255,215,0,0.85), 0 0 0 6px rgba(255,215,0,0.16), inset 0 1px 3px rgba(255,255,255,0.4)"
              : "0 6px 20px rgba(255,215,0,0.7), 0 0 0 3px rgba(255,215,0,0.22), inset 0 1px 3px rgba(255,255,255,0.32)",
            transition: "box-shadow .25s ease",
          }}>
            <div style={{
              width: 13, height: 13, borderRadius: "50%",
              background: "radial-gradient(circle, #1a1000, #0D0907)",
              boxShadow: "0 0 6px rgba(0,0,0,0.95)",
            }} />
          </div>
          <div style={{
            width: 0, height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderTop: "14px solid #FFD700",
            filter: floating
              ? "drop-shadow(0 10px 16px rgba(255,215,0,0.75))"
              : "drop-shadow(0 4px 6px rgba(255,215,0,0.45))",
            transition: "filter .25s ease",
          }} />
        </motion.div>
        <motion.div style={{
          position: "absolute", width: 28, height: 9, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%)",
          top: "calc(50% + 31px)",
        }}
          animate={{ scaleX: floating ? 0.3 : 1, scaleY: floating ? 0.3 : 1, opacity: floating ? 0.1 : 0.5 }}
          transition={{ type: "spring", stiffness: 340, damping: 20, mass: 0.75 }}
        />
      </div>

      {/* Address Panel */}
      <div data-panel="1" style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: PANEL_H, zIndex: 20,
        background: "rgba(10,7,4,0.97)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,215,0,0.18)",
        borderRadius: "18px 18px 0 0",
        boxShadow: "0 -8px 48px rgba(0,0,0,0.7)",
        display: "flex", flexDirection: "column",
        padding: "0 16px calc(env(safe-area-inset-bottom,0px) + 16px)", gap: 9,
      } as React.CSSProperties}>
        <div style={{
          alignSelf: "center", marginTop: 10, flexShrink: 0,
          width: 36, height: 4, borderRadius: 2, background: "rgba(255,215,0,0.2)",
        }} />
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 9, flexShrink: 0,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,215,0,0.1)",
          borderRadius: 12, padding: "9px 12px", minHeight: 46,
        }}>
          {geocoding ? (
            <>
              <Spinner size={13} />
              <span style={{ color: "#6a5a40", fontSize: 11 }}>Đang xác định địa chỉ...</span>
            </>
          ) : editingAddr ? (
            <>
              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>&#128204;</span>
              <input
                ref={addrInputRef}
                value={address}
                onChange={e => setAddress(e.target.value.replace(/<[^>]*>/g, "").slice(0, 300))}
                onBlur={() => setEditingAddr(false)}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "#FFD700", fontSize: 12, fontWeight: 600, lineHeight: 1.5,
                  fontFamily: "Lexend", caretColor: "#FFD700",
                }}
              />
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>&#128204;</span>
              <p
                onClick={() => { setEditingAddr(true); setTimeout(() => addrInputRef.current?.focus(), 50) }}
                style={{ margin: 0, flex: 1, color: address ? "#f8f0e0" : "#6a5a40", fontSize: 12, fontWeight: 600, lineHeight: 1.5, cursor: "text" }}
              >
                {address || "Nhấn để nhập địa chỉ..."}
              </p>
              {address && (
                <button type="button"
                  onClick={() => { setEditingAddr(true); setTimeout(() => addrInputRef.current?.focus(), 50) }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 0 6px", color: "rgba(255,215,0,0.6)", fontSize: 10, fontFamily: "Lexend", flexShrink: 0 }}
                >Sửa</button>
              )}
            </>
          )}
        </div>
        <NoteInput value={note} onChange={setNote} autoFilled={noteIsAuto} onEdit={() => setNoteIsAuto(false)}
          onFocus={() => setTimeout(() => addrInputRef.current?.closest("[data-panel]")?.scrollIntoView({ behavior: "smooth", block: "end" }), 150)} />
        <motion.button
          type="button" onClick={handleConfirm} whileTap={{ scale: 0.97 }}
          style={{
            height: 48, borderRadius: 14, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #FFE840, #FFD700, #F5B600)",
            color: "#0D0907", fontSize: 12.5, fontWeight: 800,
            fontFamily: "Lexend", letterSpacing: 0.5, flexShrink: 0,
            boxShadow: "0 4px 24px rgba(255,215,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
            position: "relative", overflow: "hidden",
          }}
        >
          <div style={{
            position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)",
            animation: "shimmer 3s infinite",
          }} />
          <span style={{ position: "relative", zIndex: 1 }}>XÁC NHẬN VỊ TRÍ</span>
        </motion.button>
      </div>
    </div>
  )
}
