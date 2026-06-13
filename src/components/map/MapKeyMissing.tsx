"use client"

// Overlay hiện khi thiếu NEXT_PUBLIC_VIETMAP_TILEMAP_KEY (tile VietMap trả 401 → bản đồ trắng).
// Đặt phủ lên container map; chỉ render khi VIETMAP_KEY_MISSING = true.
export default function MapKeyMissing() {
  return (
    <div
      style={{
        position: "absolute", inset: 0, zIndex: 2000,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 8, padding: 20, textAlign: "center",
        background: "rgba(8,8,6,0.92)", backdropFilter: "blur(6px)",
      }}
    >
      <div style={{ fontSize: 26 }}>🗺️⚠️</div>
      <div style={{ color: "#FF8C00", fontSize: 13, fontWeight: 700 }}>Bản đồ chưa tải được</div>
      <div style={{ color: "#b0956a", fontSize: 11, lineHeight: 1.5, maxWidth: 260 }}>
        Thiếu API key bản đồ (<code style={{ color: "#f8f0e0" }}>NEXT_PUBLIC_VIETMAP_TILEMAP_KEY</code>).
        Thêm vào Vercel → Environment Variables rồi redeploy.
      </div>
    </div>
  )
}
