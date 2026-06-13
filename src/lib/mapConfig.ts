import type { StyleSpecification } from "maplibre-gl"

export const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ?? ""

// VietMap mã hóa vector tile (cần SDK riêng để giải mã) — maplibre-gl thuần không đọc được
// (lỗi "Unimplemented type: 7"). Dùng RASTER tile PNG (không mã hóa) thay thế: đường + nhãn
// đã render sẵn trong ảnh, render được ngay với maplibre-gl chuẩn. apikey do vmTransform inject.
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    vietmap: {
      type: "raster",
      tiles: ["https://maps.vietmap.vn/api/tm/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© VietMap",
    },
  },
  layers: [{ id: "vietmap-base", type: "raster", source: "vietmap" }],
}

// True khi build/deploy thiếu env NEXT_PUBLIC_VIETMAP_TILEMAP_KEY.
// Tile của VietMap sẽ trả 401 → bản đồ trắng. Dùng cờ này để hiện overlay cảnh báo.
export const VIETMAP_KEY_MISSING = VIETMAP_KEY.trim() === ""

if (VIETMAP_KEY_MISSING && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.error(
    "[VietMap] Thiếu NEXT_PUBLIC_VIETMAP_TILEMAP_KEY — mọi tile sẽ trả 401 và bản đồ hiện trắng. " +
    "Thêm biến này vào Vercel → Settings → Environment Variables rồi REDEPLOY (biến NEXT_PUBLIC_* inline lúc build)."
  )
}

export function vmTransform(url: string): { url: string } {
  if (!url.includes("vietmap.vn")) return { url }
  if (url.includes("apikey=")) return { url: url.replace(/apikey=[^&]*/, `apikey=${VIETMAP_KEY}`) }
  const sep = url.includes("?") ? "&" : "?"
  return { url: `${url}${sep}apikey=${VIETMAP_KEY}` }
}
