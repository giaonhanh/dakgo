export const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ?? ""
export const MAP_STYLE   = "https://maps.vietmap.vn/mt/styles/tm/style.json"

export function vmTransform(url: string): { url: string } {
  if (!url.includes("vietmap.vn")) return { url }
  if (url.includes("apikey=")) return { url: url.replace(/apikey=[^&]*/, `apikey=${VIETMAP_KEY}`) }
  const sep = url.includes("?") ? "&" : "?"
  return { url: `${url}${sep}apikey=${VIETMAP_KEY}` }
}
