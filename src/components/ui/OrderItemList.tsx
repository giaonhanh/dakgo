import { formatPrice } from "@/lib/utils"

export interface ItemBreakdown {
  basePrice?: number
  sizeLabel?: string
  sizeDiff?: number
  toppings?: { name: string; price: number }[]
}

export interface OrderItemData {
  name: string
  qty: number
  price: number
  note?: string | null
  breakdown?: ItemBreakdown | null
}

function parseBaseName(fullName: string) {
  const match = fullName.match(/^(.+?)\s*\((.+)\)$/)
  if (!match) return fullName
  return match[1].trim()
}

function normalizeSize(sizeLabel: string) {
  return /^size/i.test(sizeLabel) ? sizeLabel : `Size ${sizeLabel}`
}

interface Props {
  items: OrderItemData[]
  orderNote?: string | null
}

export function OrderItemList({ items, orderNote }: Props) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {items.length === 0 ? (
        <div style={{ padding: "10px 12px", color: "#6a5a40", fontSize: 10, textAlign: "center" }}>
          Không có thông tin món
        </div>
      ) : items.map((item, i) => {
        const bd        = item.breakdown
        const baseName  = parseBaseName(item.name)
        const basePrice = bd?.basePrice ?? item.price
        const sizeLabel = bd?.sizeLabel ? normalizeSize(bd.sizeLabel) : null
        const sizeDiff  = bd?.sizeDiff ?? 0
        const toppings  = bd?.toppings ?? []
        const hasOpts   = !!(sizeLabel || toppings.length > 0)
        const unitPrice = basePrice + sizeDiff + toppings.reduce((s, t) => s + t.price, 0)

        return (
          <div key={i} style={{
            padding: "10px 12px",
            borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
          }}>
            {/* Tên món + giá gốc */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                background: "rgba(255,107,0,0.15)", border: "1px solid rgba(255,107,0,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#FF8C00", fontSize: 9, fontWeight: 800,
              }}>{i + 1}</span>
              <span style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700, flex: 1 }}>{baseName}</span>
              <span style={{ color: "#b0956a", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                {formatPrice(basePrice)}
              </span>
            </div>

            {/* Size */}
            {sizeLabel && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 27, paddingBottom: 3 }}>
                <span style={{ color: "#4a8ff5", fontSize: 9 }}>▸ {sizeLabel}</span>
                <span style={{ color: "#4a8ff5", fontSize: 9, fontWeight: 600 }}>
                  {sizeDiff > 0 ? `+${formatPrice(sizeDiff)}` : sizeDiff < 0 ? `-${formatPrice(Math.abs(sizeDiff))}` : "đã tính"}
                </span>
              </div>
            )}

            {/* Toppings */}
            {toppings.map((tp, ti) => (
              <div key={ti} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 27, paddingBottom: 3 }}>
                <span style={{ color: "#3ecf6e", fontSize: 9 }}>+ {tp.name}</span>
                <span style={{ color: "#3ecf6e", fontSize: 9, fontWeight: 600 }}>
                  {tp.price > 0 ? `+${formatPrice(tp.price)}` : "đã tính"}
                </span>
              </div>
            ))}

            {/* Thành tiền */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingLeft: 27, paddingTop: hasOpts ? 5 : 0,
              borderTop: hasOpts ? "1px solid rgba(255,255,255,0.05)" : "none",
              marginTop: hasOpts ? 3 : 0,
            }}>
              <span style={{ color: "#6a5a40", fontSize: 9 }}>
                Thành tiền{item.qty > 1 ? ` ×${item.qty}` : ""}
              </span>
              <span style={{ color: "#FF8C00", fontSize: 11, fontWeight: 800 }}>
                {formatPrice(unitPrice * item.qty)}
              </span>
            </div>

            {/* Ghi chú món */}
            {item.note && (
              <div style={{ marginTop: 6, paddingLeft: 27, display: "flex", gap: 5, alignItems: "flex-start" }}>
                <span style={{ color: "#f5c542", fontSize: 9, flexShrink: 0 }}>📝</span>
                <span style={{ color: "#f5c542", fontSize: 9 }}>{item.note}</span>
              </div>
            )}
          </div>
        )
      })}

      {/* Ghi chú đơn hàng */}
      {orderNote && (
        <div style={{
          padding: "7px 12px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(245,197,66,0.04)",
          display: "flex", gap: 6, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 11, flexShrink: 0 }}>📝</span>
          <span style={{ color: "#b0956a", fontSize: 9 }}>{orderNote}</span>
        </div>
      )}
    </div>
  )
}
