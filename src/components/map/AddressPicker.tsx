/**
 * AddressPicker — wrapper xuất ra component bản đồ chọn địa chỉ.
 * Dynamic import (ssr: false) bắt buộc vì Leaflet dùng browser APIs.
 *
 * Cách dùng:
 *   import AddressPicker from "@/components/map/AddressPicker"
 *   <AddressPicker height="100dvh" onConfirm={({ lat, lng, address, note }) => ...} />
 */

import dynamic from "next/dynamic"
import type { AddressPickerProps } from "./AddressPickerClient"

export type { AddressPickerProps }

const AddressPicker = dynamic(
  () => import("./AddressPickerClient"),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  }
)

function MapSkeleton() {
  return (
    <>
      {/* Preconnect tile CDNs — React 19 tự hoist lên <head> */}
      <link rel="preconnect" href="https://a.basemaps.cartocdn.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://b.basemaps.cartocdn.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://server.arcgisonline.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://maps.vietmap.vn" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://nominatim.openstreetmap.org" />
      <div style={{
        width: "100%", height: "100%", background: "#0d0a06",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 10, fontFamily: "'Lexend', sans-serif",
      }}>
        <div style={{ fontSize: 28 }}>🗺️</div>
        <div style={{ color: "#6a5a40", fontSize: 11 }}>Đang tải bản đồ...</div>
      </div>
    </>
  )
}

export default AddressPicker
