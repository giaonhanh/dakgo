"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import type { AddressPickerResult } from "@/types"
import { getCachedGeocode, setCachedGeocode } from "@/lib/geocodeCache"

// ─── Constants ────────────────────────────────────────────────────────────────

// Tọa độ trung tâm Thị Trấn Phước An, Huyện Krông Pắc, Đắk Lắk
const DEFAULT_LAT = 12.7107
const DEFAULT_LNG = 108.3034
const PANEL_H    = 216
const SEARCH_H   = 56
const GEOCODE_MS = 600
const SEARCH_MS  = 500

const DARK_TILE      = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const SAT_TILE       = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{x}/{y}"
const SAT_LABEL_TILE = "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png"

// ─── Types ────────────────────────────────────────────────────────────────────

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

// Geocoding API (classic) dùng long_name/short_name
interface GeocodingComponent {
  long_name:  string
  short_name: string
  types:      string[]
}
// Places API (New) dùng longText/shortText
interface PlacesComponent {
  longText:  string
  shortText: string
  types:     string[]
}

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

// ─── Google Maps API (session token để gộp billing Autocomplete + PlaceDetail) ──

async function googleSearch(input: string, lat: number, lng: number, sessionToken: string): Promise<PlaceSuggestion[]> {
  const res = await fetch("/api/places/autocomplete", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input, sessionToken,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } },
      languageCode: "vi", regionCode: "VN",
    }),
  })
  const data = await res.json()
  return (data.suggestions ?? []).slice(0, 6).map((s: Record<string, unknown>) => {
    const pred = s.placePrediction as Record<string, unknown>
    const fmt  = pred.structuredFormat as Record<string, Record<string, string>> | undefined
    return {
      refId:         pred.placeId as string,
      mainText:      fmt?.mainText?.text ?? (pred.text as Record<string,string>)?.text ?? "",
      secondaryText: fmt?.secondaryText?.text ?? "",
    }
  })
}

async function googlePlaceDetail(placeId: string, sessionToken: string): Promise<{
  lat: number; lng: number; address: string; houseNote: string
}> {
  const res = await fetch(
    `/api/places/detail?placeId=${encodeURIComponent(placeId)}&sessionToken=${encodeURIComponent(sessionToken)}`,
  )
  const data = await res.json()
  const lat  = (data.location?.latitude  as number) ?? 0
  const lng  = (data.location?.longitude as number) ?? 0
  const components: PlacesComponent[] = data.addressComponents ?? []
  const houseNumber = components.find(c => c.types.includes("street_number"))?.longText ?? ""
  const address = (data.formattedAddress as string) ?? ""
  return { lat, lng, address, houseNote: houseNumber ? `Số ${houseNumber}` : "" }
}


// ─── Map Sub-components ───────────────────────────────────────────────────────

function MapEvents({
  onMoveStart, onMoveEnd,
}: {
  onMoveStart: () => void
  onMoveEnd:   (pos: LatLng) => void
}) {
  const firstRef = useRef(true)
  useMapEvents({
    movestart: () => {
      if (firstRef.current) { firstRef.current = false; return }
      onMoveStart()
    },
    moveend: e => {
      const c = e.target.getCenter()
      onMoveEnd({ lat: c.lat, lng: c.lng })
    },
  })
  return null
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map     = useMap()
  const prevRef = useRef<string>("")
  useEffect(() => {
    if (!target) return
    const key = `${target[0]},${target[1]}`
    if (prevRef.current === key) return
    prevRef.current = key
    map.flyTo(target, 18, { duration: 0.7 })
  }, [target, map])
  return null
}

function TileReadyWatcher({ onReady }: { onReady: () => void }) {
  const calledRef = useRef(false)
  useMapEvents({
    load: () => { if (!calledRef.current) { calledRef.current = true; onReady() } },
  })
  // Fallback: hiển thị sau 800ms dù tiles chưa xong
  useEffect(() => {
    const t = setTimeout(() => { if (!calledRef.current) { calledRef.current = true; onReady() } }, 800)
    return () => clearTimeout(t)
  }, [onReady])
  return null
}

function GpsControl({
  trigger, onLocated, onError,
}: {
  trigger:   number
  onLocated: (pos: LatLng) => void
  onError:   () => void
}) {
  const map = useMap()
  useEffect(() => {
    if (!trigger) return
    map.locate({ setView: true, maxZoom: 18, enableHighAccuracy: true })
  }, [trigger, map])
  useMapEvents({
    locationfound: e => onLocated({ lat: e.latlng.lat, lng: e.latlng.lng }),
    locationerror: () => onError(),
  })
  return null
}

// ─── UI Sub-components ────────────────────────────────────────────────────────

function NoteInput({
  value, onChange, autoFilled = false, onEdit,
}: {
  value: string; onChange: (v: string) => void; autoFilled?: boolean; onEdit?: () => void
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
      <span style={{ fontSize: 14, flexShrink: 0 }}>🏠</span>
      <input
        id="address-note" name="address-note"
        type="text" value={value}
        onChange={e => { onChange(e.target.value); onEdit?.() }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Số nhà / đặc điểm nhận diện..."
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AddressPickerClient({
  onConfirm, onClose, initialLat, initialLng,
  height = "100dvh", className = "",
}: AddressPickerProps) {
  const geocodeTimer   = useRef<ReturnType<typeof setTimeout>>(undefined)
  const searchTimer    = useRef<ReturnType<typeof setTimeout>>(undefined)
  const autoNoteRef    = useRef("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const skipGeocodeRef = useRef(false)
  const centerRef      = useRef<LatLng>({ lat: initialLat ?? DEFAULT_LAT, lng: initialLng ?? DEFAULT_LNG })
  // Ngữ cảnh vùng từ lần geocode gần nhất — dùng để bias search
  const areaCtxRef     = useRef("Krông Pắc, Đắk Lắk")
  // Session token gộp billing Autocomplete + PlaceDetail thành 1 đơn vị ($0.005 thay vì $0.02)
  const sessionTokenRef = useRef<string>(crypto.randomUUID())

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
  // true ngay từ đầu nếu không có initialLat/Lng — báo hiệu đang xin GPS
  const [locating,    setLocating]    = useState(!initialLat && !initialLng)
  const [geocoding,   setGeocoding]   = useState(true)
  const [gpsTrigger,  setGpsTrigger]  = useState(0)
  const [mapStyle,    setMapStyle]    = useState<"dark" | "satellite">("dark")
  const [tilesReady,  setTilesReady]  = useState(false)

  // ── Helpers ───────────────────────────────────────────────────────────────

  const applyNote = useCallback((houseNote: string) => {
    setNote(prev => {
      if (!houseNote) return prev === autoNoteRef.current ? "" : prev
      if (prev === "" || prev === autoNoteRef.current) return houseNote
      return prev
    })
    setNoteIsAuto(!!houseNote)
    autoNoteRef.current = houseNote
  }, [])

  // ── Reverse Geocode ───────────────────────────────────────────────────────

  const doGeocode = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true)

    const cached = getCachedGeocode(lat, lng)
    if (cached) {
      setAddress(cached)
      applyNote("")
      setGeocoding(false)
      return
    }

    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=vi&key=${GOOGLE_KEY}`,
      )
      const data = await res.json()
      const result = data.results?.[0]
      if (result) {
        const components: GeocodingComponent[] = result.address_components ?? []
        const get = (...types: string[]) =>
          components.find(c => types.some(t => c.types.includes(t)))?.long_name ?? ""
        const houseNum = get("street_number")
        const street   = get("route")
        const village  = get("administrative_area_level_4")
        const ward     = get("sublocality_level_1", "sublocality", "administrative_area_level_3")
        const district = get("administrative_area_level_2")
        const city     = get("administrative_area_level_1")

        const formatted = (result.formatted_address as string ?? "")
          .replace(/,\s*Việt Nam$/i, "").trim()
        const finalAddr = formatted || [
          houseNum && street ? `${houseNum} ${street}` : street,
          village, ward, district, city,
        ].filter(Boolean).join(", ")
        setCachedGeocode(lat, lng, finalAddr)
        setAddress(finalAddr)
        applyNote(houseNum ? `Số ${houseNum}` : "")

        const ctx = [district, city].filter(Boolean).join(", ")
        if (ctx) areaCtxRef.current = ctx
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } finally {
      setGeocoding(false)
    }
  }, [applyNote])

  const scheduleGeocode = useCallback((lat: number, lng: number) => {
    clearTimeout(geocodeTimer.current)
    geocodeTimer.current = setTimeout(() => void doGeocode(lat, lng), GEOCODE_MS)
  }, [doGeocode])

  // ── Forward Search ────────────────────────────────────────────────────────

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 3) { setSuggestions([]); setShowSuggest(false); return }
    setSearching(true)
    try {
      // Nếu query chưa chứa ngữ cảnh vùng → thêm vào để kết quả bám địa phương
      const ctx   = areaCtxRef.current
      const hasCtx = ctx.split(",").some(c => trimmed.toLowerCase().includes(c.trim().toLowerCase()))
      const query  = hasCtx ? trimmed : `${trimmed} ${ctx}`
      const items  = await googleSearch(query, centerRef.current.lat, centerRef.current.lng, sessionTokenRef.current)
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

  // ── Initial GPS ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (initialLat && initialLng) {
      void doGeocode(initialLat, initialLng)
      return
    }
    if (!navigator.geolocation) {
      setLocating(false)
      void doGeocode(DEFAULT_LAT, DEFAULT_LNG)
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        skipGeocodeRef.current = true
        setFlyTarget([coords.latitude, coords.longitude])
        setCenter({ lat: coords.latitude, lng: coords.longitude })
        centerRef.current = { lat: coords.latitude, lng: coords.longitude }
        void doGeocode(coords.latitude, coords.longitude)
      },
      () => {
        setLocating(false)
        void doGeocode(DEFAULT_LAT, DEFAULT_LNG)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
    return () => {
      clearTimeout(geocodeTimer.current)
      clearTimeout(searchTimer.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Map Events ────────────────────────────────────────────────────────────

  const handleMoveStart = useCallback(() => {
    setFloating(true)
    setShowSuggest(false)
  }, [])

  const handleMoveEnd = useCallback((pos: LatLng) => {
    centerRef.current = pos
    setCenter(pos)
    setFloating(false)
    setShowPulse(true)
    setPulseKey(k => k + 1)
    setTimeout(() => setShowPulse(false), 800)
    if (skipGeocodeRef.current) { skipGeocodeRef.current = false; return }
    scheduleGeocode(pos.lat, pos.lng)
  }, [scheduleGeocode])

  // ── GPS Button ────────────────────────────────────────────────────────────

  const handleGPS = useCallback(() => {
    setLocating(true)
    skipGeocodeRef.current = false
    setGpsTrigger(t => t + 1)
  }, [])

  const handleLocated = useCallback((pos: LatLng) => {
    setCenter(pos)
    setLocating(false)
    void doGeocode(pos.lat, pos.lng)
  }, [doGeocode])

  // ── Select Suggestion — fetch chi tiết từ Google Places ─────────────────

  const selectSuggestion = useCallback(async (s: PlaceSuggestion) => {
    setSearchText("")
    setShowSuggest(false)
    setSuggestions([])
    searchInputRef.current?.blur()
    setGeocoding(true)
    try {
      const detail = await googlePlaceDetail(s.refId, sessionTokenRef.current)
      // Reset session token sau khi hoàn thành — session tiếp theo sẽ được billing riêng
      sessionTokenRef.current = crypto.randomUUID()
      skipGeocodeRef.current = true
      const pos = { lat: detail.lat, lng: detail.lng }
      centerRef.current = pos
      setCenter(pos)
      setFlyTarget([detail.lat, detail.lng])
      // Xây địa chỉ đầy đủ từ detail nếu có, fallback về display
      const addr = detail.address || (s.secondaryText ? `${s.mainText}, ${s.secondaryText}` : s.mainText)
      const houseNote = detail.houseNote || ""
      setAddress(addr)
      applyNote(houseNote)
      // Auto-confirm ngay sau khi chọn từ gợi ý — không cần ấn nút
      onConfirm({ lat: detail.lat, lng: detail.lng, address: addr, note: houseNote })
    } catch {
      // fallback: keep current position
    } finally {
      setGeocoding(false)
    }
  }, [applyNote, onConfirm])

  // ── Confirm ───────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    onConfirm({ lat: center.lat, lng: center.lng, address, note })
  }, [center, address, note, onConfirm])

  // ─────────────────────────────────────────────────────────────────────────

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
        .leaflet-container { background: #0d0a06 !important; }
        .leaflet-control-attribution { display: none !important; }
        .leaflet-control-zoom { display: none !important; }
        .leaflet-tile-pane { filter: brightness(0.9); }
      `}</style>

      {/* ── Search Bar ─────────────────────────────────────────────────── */}
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
            >✕</button>
          ) : null}
        </div>
      </div>

      {/* ── Suggestions Dropdown ────────────────────────────────────────── */}
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
                  transition: "background .12s",
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,215,0,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 2 }}>📍</span>
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

      {/* ── Map Container ───────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: `calc(${SEARCH_H}px + env(safe-area-inset-top, 0px))`, bottom: PANEL_H, left: 0, right: 0, zIndex: 1,
      }}>
        {/* Skeleton che phần map trắng trong lúc tiles chưa load */}
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
            >🗺️</motion.div>
            <span style={{ color: "#6a5a40", fontSize: 10, fontFamily: "Lexend" }}>Đang tải bản đồ...</span>
          </div>
        )}
        <MapContainer
          center={[initLat, initLng]}
          zoom={13}
          style={{ width: "100%", height: "100%", opacity: 1, transition: "opacity 0.4s ease" }}
          zoomControl={false}
          attributionControl={false}
          maxZoom={19}
          preferCanvas
        >
          {mapStyle === "satellite" ? (
            <>
              <TileLayer key="sat-base" url={SAT_TILE} maxZoom={19} keepBuffer={4} />
              <TileLayer key="sat-labels" url={SAT_LABEL_TILE} maxZoom={19} keepBuffer={4} />
            </>
          ) : (
            <TileLayer key="dark" url={DARK_TILE} maxZoom={19} keepBuffer={4} />
          )}
          <MapEvents onMoveStart={handleMoveStart} onMoveEnd={handleMoveEnd} />
          <FlyTo target={flyTarget} />
          <GpsControl trigger={gpsTrigger} onLocated={handleLocated} onError={() => setLocating(false)} />
          <TileReadyWatcher onReady={() => setTilesReady(true)} />
        </MapContainer>
      </div>

      {/* ── Map Controls — góc phải dưới bản đồ ───────────────────────── */}
      <div style={{
        position: "absolute", right: 12, bottom: PANEL_H + 12, zIndex: 15,
        display: "flex", flexDirection: "column", gap: 8,
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
        <button type="button"
          onClick={() => setMapStyle(s => s === "dark" ? "satellite" : "dark")}
          style={{
            width: 40, height: 40, borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(10,7,4,0.88)",
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            cursor: "pointer", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          {mapStyle === "dark" ? "🛰️" : "🗺️"}
        </button>
      </div>

      {/* ── Center Pin Overlay ──────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: `calc(${SEARCH_H}px + env(safe-area-inset-top, 0px))`, bottom: PANEL_H, left: 0, right: 0,
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

      {/* ── Address Panel ───────────────────────────────────────────────── */}
      <div style={{
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
          ) : (
            <>
              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>📌</span>
              <p style={{ margin: 0, flex: 1, color: "#f8f0e0", fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>
                {address}
              </p>
            </>
          )}
        </div>
        <NoteInput value={note} onChange={setNote} autoFilled={noteIsAuto} onEdit={() => setNoteIsAuto(false)} />
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
