/**
 * Áp màu brand Giao Nhanh lên bản đồ MapLibre sau khi style load xong.
 * Gọi bên trong map.on("load", () => applyBrandStyle(map))
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyBrandStyle(map: any) {
  const layers: Array<{ id: string; type: string }> = map.getStyle()?.layers ?? []

  for (const layer of layers) {
    const id = layer.id.toLowerCase()
    const type = layer.type

    // ── Nền đất ─────────────────────────────────────────────────────
    if (type === "background") {
      safe(map, layer.id, "background-color", "#FEF3E2")
      continue
    }

    // ── Nước / sông / hồ ────────────────────────────────────────────
    if (id.includes("water") || id.includes("ocean") || id.includes("lake") || id.includes("river")) {
      if (type === "fill") safe(map, layer.id, "fill-color", "#B8D9F0")
      if (type === "line") safe(map, layer.id, "line-color", "#7ABDE8")
      continue
    }

    // ── Công viên / cây xanh ────────────────────────────────────────
    if (id.includes("park") || id.includes("forest") || id.includes("grass") ||
        id.includes("landuse") || id.includes("green") || id.includes("wood") ||
        id.includes("vegetation") || id.includes("scrub")) {
      if (type === "fill") safe(map, layer.id, "fill-color", "#E8F5D0")
      continue
    }

    // ── Khu dân cư / đô thị ─────────────────────────────────────────
    if (id.includes("residential") || id.includes("urban") || id.includes("suburb")) {
      if (type === "fill") safe(map, layer.id, "fill-color", "#FDF0DC")
      continue
    }

    // ── Công nghiệp / thương mại ────────────────────────────────────
    if (id.includes("industrial") || id.includes("commercial") || id.includes("retail")) {
      if (type === "fill") safe(map, layer.id, "fill-color", "#F9E8CC")
      continue
    }

    // ── Toà nhà ─────────────────────────────────────────────────────
    if (id.includes("building")) {
      if (type === "fill") {
        safe(map, layer.id, "fill-color", "#EDD9B8")
        safe(map, layer.id, "fill-outline-color", "#D4BA90")
      }
      continue
    }

    // ── Đường cao tốc / quốc lộ ─────────────────────────────────────
    if (id.includes("motorway") || id.includes("trunk") || id.includes("highway")) {
      if (type === "line") {
        safe(map, layer.id, "line-color",
          id.includes("casing") || id.includes("outline") ? "#CC4A00" : "#FF6B1A")
      }
      continue
    }

    // ── Đường chính ──────────────────────────────────────────────────
    if (id.includes("primary") || id.includes("arterial")) {
      if (type === "line") {
        safe(map, layer.id, "line-color",
          id.includes("casing") || id.includes("outline") ? "#E8854A" : "#FFB366")
      }
      continue
    }

    // ── Đường phụ / ngõ hẻm ─────────────────────────────────────────
    if (id.includes("secondary") || id.includes("tertiary") ||
        id.includes("street") || id.includes("road") || id.includes("path")) {
      if (type === "line") {
        safe(map, layer.id, "line-color",
          id.includes("casing") || id.includes("outline") ? "#D4BA90" : "#FFFFFF")
      }
      continue
    }

    // ── Nhãn đường (text) ────────────────────────────────────────────
    if (type === "symbol" && (id.includes("road") || id.includes("street") ||
        id.includes("highway") || id.includes("label_road"))) {
      safe(map, layer.id, "text-color", "#7A4520")
      safe(map, layer.id, "text-halo-color", "#FEF3E2")
      safe(map, layer.id, "text-halo-width", 1.5)
      continue
    }

    // ── Nhãn địa danh lớn (tỉnh, thành phố) ────────────────────────
    if (type === "symbol" && (id.includes("place") || id.includes("city") ||
        id.includes("town") || id.includes("village") || id.includes("state"))) {
      safe(map, layer.id, "text-color", "#3D1F0A")
      safe(map, layer.id, "text-halo-color", "#FEF3E2")
      safe(map, layer.id, "text-halo-width", 2)
      continue
    }

    // ── Nhãn POI (quán, trường, bệnh viện...) ───────────────────────
    if (type === "symbol" && (id.includes("poi") || id.includes("shop") ||
        id.includes("amenity") || id.includes("tourism"))) {
      safe(map, layer.id, "text-color", "#CC4A00")
      safe(map, layer.id, "text-halo-color", "#FEF3E2")
      safe(map, layer.id, "text-halo-width", 1.5)
      continue
    }

    // ── Nhãn còn lại ─────────────────────────────────────────────────
    if (type === "symbol") {
      safe(map, layer.id, "text-color", "#5A3A1A")
      safe(map, layer.id, "text-halo-color", "#FEF3E2")
      safe(map, layer.id, "text-halo-width", 1)
    }
  }
}

// setPaintProperty throw nếu layer không có property đó — bắt lỗi im lặng
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe(map: any, layerId: string, prop: string, value: unknown) {
  try { map.setPaintProperty(layerId, prop, value) } catch { /* layer không hỗ trợ prop */ }
}
