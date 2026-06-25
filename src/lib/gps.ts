export async function fetchGps(
  setLocation: (lat: number, lng: number, addr: string) => void,
  setDenied: () => void,
) {
  if (typeof navigator === "undefined" || !navigator.geolocation) { setDenied(); return }

  // Nếu browser đã chặn vĩnh viễn → báo ngay, không hiện dialog trống
  try {
    const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName })
    if (perm.state === "denied") { setDenied(); return }
  } catch {
    // Safari không hỗ trợ permissions API — tiếp tục bình thường
  }

  // enableHighAccuracy: false → dùng WiFi/cell, nhanh hơn GPS chip
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const { latitude: lat, longitude: lng } = coords
      try {
        const res  = await fetch(`/api/geocode?latlng=${lat},${lng}`)
        const data = await res.json()
        const address = (Array.isArray(data) ? data[0]?.display : null) ?? "Vị trí hiện tại"
        setLocation(lat, lng, address)
      } catch {
        setLocation(lat, lng, "Vị trí hiện tại")
      }
    },
    () => setDenied(),
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
  )
}
