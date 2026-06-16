"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface PrintItem {
  name: string
  qty: number
  price: number
  note?: string | null
  options?: {
    basePrice?: number
    sizeLabel?: string
    sizeDiff?: number
    toppings?: { name: string; price: number }[]
  } | null
}

interface PrintOrder {
  id: string
  shopName: string
  customerName: string
  deliveryAddress: string
  note: string | null
  subtotal: number
  deliveryFee: number
  discountAmount: number
  totalAmount: number
  payMethod: string
  createdAt: string
  items: PrintItem[]
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const date = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
  const time = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
  return `${time} · ${date}`
}

const PAY_LABEL: Record<string, string> = {
  cash:    "Tiền mặt",
  vietqr:  "Chuyển khoản",
  momo:    "MoMo",
  zalopay: "ZaloPay",
  wallet:  "Ví GiaoNhanh",
}

export default function PrintPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<PrintOrder | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: o, error: oErr } = await supabase
        .from("orders")
        .select("id, shop_id, customer_id, delivery_address, note, subtotal, delivery_fee, discount_amount, total_amount, payment_method, created_at")
        .eq("id", orderId)
        .single()

      if (oErr || !o) { setError("Không tìm thấy đơn hàng"); return }

      const [{ data: shop }, { data: customer }, { data: items }] = await Promise.all([
        supabase.from("shops").select("name").eq("id", o.shop_id).single(),
        supabase.from("profiles").select("full_name").eq("id", o.customer_id).single(),
        supabase.from("order_items").select("name, qty, price, note, options").eq("order_id", orderId),
      ])

      setOrder({
        id:              o.id.slice(-6).toUpperCase(),
        shopName:        shop?.name ?? "Cửa hàng",
        customerName:    customer?.full_name ?? "Khách hàng",
        deliveryAddress: o.delivery_address,
        note:            o.note,
        subtotal:        o.subtotal,
        deliveryFee:     o.delivery_fee,
        discountAmount:  o.discount_amount ?? 0,
        totalAmount:     o.total_amount,
        payMethod:       o.payment_method,
        createdAt:       o.created_at,
        items:           (items ?? []).map(i => ({
          name:    i.name,
          qty:     i.qty ?? 1,
          price:   i.price,
          note:    i.note,
          options: i.options,
        })),
      })
    }
    load()
  }, [orderId])

  useEffect(() => {
    if (order) {
      const t = setTimeout(() => window.print(), 600)
      return () => clearTimeout(t)
    }
  }, [order])

  if (error) return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#ff4040" }}>
      {error}
    </div>
  )
  if (!order) return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#888", textAlign: "center" }}>
      Đang tải...
    </div>
  )

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 4mm; size: 80mm auto; }
          body { margin: 0; }
          .no-print { display: none !important; }
        }
        body {
          background: #fff;
          color: #000;
          font-family: "Courier New", Courier, monospace;
          font-size: 12px;
          margin: 0;
        }
      `}</style>

      {/* Screen-only print button */}
      <div className="no-print" style={{
        position: "fixed", top: 12, right: 12, display: "flex", gap: 8,
      }}>
        <button onClick={() => window.print()} style={{
          padding: "8px 16px", borderRadius: 8, border: "none",
          background: "#FF6B00", color: "#fff", fontWeight: 700,
          fontSize: 13, cursor: "pointer",
        }}>
          🖨️ In ngay
        </button>
        <button onClick={() => window.close()} style={{
          padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc",
          background: "#fff", color: "#333", fontWeight: 700,
          fontSize: 13, cursor: "pointer",
        }}>
          ✕ Đóng
        </button>
      </div>

      {/* Receipt content */}
      <div style={{ width: "100%", maxWidth: 320, margin: "0 auto", padding: "12px 8px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: 1 }}>
            {order.shopName.toUpperCase()}
          </div>
          <div style={{ fontSize: 10, marginTop: 2 }}>--- HÓA ĐƠN GIAO HÀNG ---</div>
        </div>

        {/* Order info */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
          <tbody>
            <tr>
              <td style={{ width: "40%", color: "#555" }}>Mã đơn:</td>
              <td style={{ fontWeight: 700 }}>#{order.id}</td>
            </tr>
            <tr>
              <td style={{ color: "#555" }}>Thời gian:</td>
              <td>{fmtDateTime(order.createdAt)}</td>
            </tr>
            <tr>
              <td style={{ color: "#555" }}>Khách:</td>
              <td>{order.customerName}</td>
            </tr>
            <tr>
              <td style={{ color: "#555", verticalAlign: "top" }}>Địa chỉ:</td>
              <td style={{ wordBreak: "break-word" }}>{order.deliveryAddress}</td>
            </tr>
            <tr>
              <td style={{ color: "#555" }}>Thanh toán:</td>
              <td>{PAY_LABEL[order.payMethod] ?? order.payMethod}</td>
            </tr>
          </tbody>
        </table>

        {/* Divider */}
        <div style={{ borderBottom: "1px dashed #000", marginBottom: 8 }} />

        {/* Items */}
        <div style={{ marginBottom: 8 }}>
          {order.items.map((item, idx) => {
            const bd = item.options
            const hasExtras = bd && (bd.sizeLabel || (bd.toppings && bd.toppings.length > 0))
            return (
              <div key={idx} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                  <span>{item.qty}x {item.name}</span>
                  <span>{fmt(item.price * item.qty)}</span>
                </div>
                {hasExtras && (
                  <div style={{ paddingLeft: 14, fontSize: 10, color: "#444" }}>
                    {bd?.sizeLabel && (
                      <div>▸ {bd.sizeLabel}{bd.sizeDiff ? ` (+${fmt(bd.sizeDiff)})` : ""}</div>
                    )}
                    {bd?.toppings?.map((t, ti) => (
                      <div key={ti}>▸ {t.name} (+{fmt(t.price)})</div>
                    ))}
                  </div>
                )}
                {item.note && (
                  <div style={{ paddingLeft: 14, fontSize: 10, color: "#666", fontStyle: "italic" }}>
                    * {item.note}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Divider */}
        <div style={{ borderBottom: "1px dashed #000", marginBottom: 8 }} />

        {/* Totals */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
          <tbody>
            <tr>
              <td style={{ color: "#555" }}>Tiền món:</td>
              <td style={{ textAlign: "right" }}>{fmt(order.subtotal)}</td>
            </tr>
            <tr>
              <td style={{ color: "#555" }}>Phí giao:</td>
              <td style={{ textAlign: "right" }}>{fmt(order.deliveryFee)}</td>
            </tr>
            {order.discountAmount > 0 && (
              <tr>
                <td style={{ color: "#555" }}>Giảm giá:</td>
                <td style={{ textAlign: "right" }}>-{fmt(order.discountAmount)}</td>
              </tr>
            )}
            <tr>
              <td style={{ fontWeight: 900, fontSize: 14, paddingTop: 4, borderTop: "1px solid #000" }}>
                TỔNG CỘNG:
              </td>
              <td style={{ fontWeight: 900, fontSize: 14, textAlign: "right", paddingTop: 4, borderTop: "1px solid #000" }}>
                {fmt(order.totalAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Customer note */}
        {order.note && (
          <div style={{ borderTop: "1px dashed #000", paddingTop: 8, marginBottom: 8, fontSize: 11 }}>
            <strong>Ghi chú:</strong> {order.note}
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px dashed #000", paddingTop: 8, textAlign: "center", fontSize: 10, color: "#555" }}>
          Cảm ơn quý khách!
          <br />
          Giao Nhanh — Phước An · giaonhanh.vn
        </div>
      </div>
    </>
  )
}
