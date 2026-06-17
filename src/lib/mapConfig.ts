import type { StyleSpecification } from "maplibre-gl"

export const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ?? ""
export const VIETMAP_KEY_MISSING = VIETMAP_KEY.trim() === ""

// CartoDB dark — fallback miễn phí khi VietMap key chưa có
const CARTO_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap © CARTO",
    },
  },
  layers: [{ id: "carto-base", type: "raster", source: "carto" }],
}

// VietMap raster tile — cần NEXT_PUBLIC_VIETMAP_TILEMAP_KEY (baked in lúc build)
const VIETMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    vietmap: {
      type: "raster",
      tiles: [`https://maps.vietmap.vn/api/tm/{z}/{x}/{y}.png?apikey=${VIETMAP_KEY}`],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© VietMap",
    },
  },
  layers: [{ id: "vietmap-base", type: "raster", source: "vietmap" }],
}

// Dùng VietMap nếu có key, ngược lại dùng CartoDB dark
export const MAP_STYLE: StyleSpecification = VIETMAP_KEY_MISSING ? CARTO_STYLE : VIETMAP_STYLE

// vmTransform chỉ dùng khi có VietMap key — inject apikey vào runtime nếu cần
export function vmTransform(url: string): { url: string } {
  if (!url.includes("vietmap.vn")) return { url }
  if (url.includes("apikey=")) return { url: url.replace(/apikey=[^&]*/, `apikey=${VIETMAP_KEY}`) }
  const sep = url.includes("?") ? "&" : "?"
  return { url: `${url}${sep}apikey=${VIETMAP_KEY}` }
}
