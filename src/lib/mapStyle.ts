/**
 * Áp màu brand Goi lên bản đồ MapLibre sau khi style load xong.
 * Chỉ đổi nền + nước + label — giữ nguyên màu đường VietMap để roads hiện rõ.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyBrandStyle(map: any) {
  const layers: Array<{ id: string; type: string }> = map.getStyle()?.layers ?? []

  for (const layer of layers) {
    const id   = layer.id.toLowerCase()
    const type = layer.type

    // ── Nền đất (background) ─────────────────────────────────────────
    if (type === "background") {
      safe(map, layer.id, "background-color", "#FEF3E2")
      continue
    }

    // ── Nước / sông / hồ ─────────────────────────────────────────────
    if (
      id.includes("water") || id.includes("ocean") ||
      id.includes("lake")  || id.includes("river")
    ) {
      if (type === "fill") safe(map, layer.id, "fill-color",   "#B8D9F0")
      if (type === "line") safe(map, layer.id, "line-color",   "#7ABDE8")
      continue
    }

    // ── Công viên / cây xanh ─────────────────────────────────────────
    if (
      id.includes("park")      || id.includes("forest")  ||
      id.includes("grass")     || id.includes("wood")    ||
      id.includes("vegetation")|| id.includes("green")   ||
      id.includes("scrub")
    ) {
      if (type === "fill") safe(map, layer.id, "fill-color", "#DFF0C8")
      continue
    }

    // ── Toà nhà ──────────────────────────────────────────────────────
    if (id.includes("building")) {
      if (type === "fill") {
        safe(map, layer.id, "fill-color",         "#EDD9B8")
        safe(map, layer.id, "fill-outline-color", "#D4BA90")
      }
      continue
    }

    // ── Nhãn đường ───────────────────────────────────────────────────
    if (type === "symbol" && (
      id.includes("road") || id.includes("street") ||
      id.includes("highway") || id.includes("way")
    )) {
      safe(map, layer.id, "text-color",       "#7A4520")
      safe(map, layer.id, "text-halo-color",  "#FEF3E2")
      safe(map, layer.id, "text-halo-width",  1.5)
      continue
    }

    // ── Nhãn địa danh (tỉnh, thành phố, xã, phường) ──────────────────
    if (type === "symbol" && (
      id.includes("place") || id.includes("city")  ||
      id.includes("town")  || id.includes("village") ||
      id.includes("state") || id.includes("country")
    )) {
      safe(map, layer.id, "text-color",       "#3D1F0A")
      safe(map, layer.id, "text-halo-color",  "#FEF3E2")
      safe(map, layer.id, "text-halo-width",  2)
      continue
    }

    // ── Nhãn POI (quán, trường, bệnh viện...) ────────────────────────
    if (type === "symbol" && (
      id.includes("poi") || id.includes("shop") ||
      id.includes("amenity") || id.includes("tourism")
    )) {
      safe(map, layer.id, "text-color",       "#CC4A00")
      safe(map, layer.id, "text-halo-color",  "#FEF3E2")
      safe(map, layer.id, "text-halo-width",  1.5)
      continue
    }

    // ── Nhãn còn lại ─────────────────────────────────────────────────
    if (type === "symbol") {
      safe(map, layer.id, "text-color",       "#5A3A1A")
      safe(map, layer.id, "text-halo-color",  "#FEF3E2")
      safe(map, layer.id, "text-halo-width",  1)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe(map: any, layerId: string, prop: string, value: unknown) {
  try { map.setPaintProperty(layerId, prop, value) } catch { /* layer không hỗ trợ prop */ }
}
