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
  note: string | null
  subtotal: number
  discountAmount: number
  totalAmount: number
  merchantReceives: number
  createdAt: string
  items: PrintItem[]
  customerName: string
  customerPhone: string
  deliveryAddress: string
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const date = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
  const time = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
  return `${time} · ${date}`
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 4) return phone
  return `xxxx xxx ${digits.slice(-3)}`
}

function maskAddress(addr: string): string {
  if (!addr) return ""
  // Giữ phần từ dấu phẩy đầu tiên trở đi (xã/huyện/thành phố), che số nhà
  const commaIdx = addr.indexOf(",")
  if (commaIdx > 0) return `xxx,${addr.slice(commaIdx + 1)}`
  // Không có dấu phẩy: che 3 ký tự đầu
  return `xxx ${addr.slice(Math.min(4, addr.length))}`
}

function sizeDisplay(label: string): string {
  // Nếu label đã chứa "Size" thì không thêm prefix nữa
  if (/size/i.test(label)) return label
  return `Size: ${label}`
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
        .select("id, shop_id, customer_id, note, subtotal, discount_amount, total_amount, delivery_address, created_at")
        .eq("id", orderId)
        .single()

      if (oErr || !o) { setError("Không tìm thấy đơn hàng"); return }

      const [{ data: shop }, { data: items }, { data: profile }] = await Promise.all([
        supabase.from("shops").select("name, commission_rate").eq("id", o.shop_id).single(),
        supabase.from("order_items").select("name, qty, price, note, options").eq("order_id", orderId),
        supabase.from("profiles").select("full_name, phone").eq("id", o.customer_id).single(),
      ])

      const commRate         = Number(shop?.commission_rate ?? 0) / 100
      const merchantReceives = Math.round(o.subtotal * (1 - commRate))

      setOrder({
        id:              o.id.slice(-6).toUpperCase(),
        shopName:        shop?.name ?? "Cửa hàng",
        note:            o.note,
        subtotal:        o.subtotal,
        discountAmount:  o.discount_amount ?? 0,
        totalAmount:     o.total_amount ?? o.subtotal,
        merchantReceives,
        createdAt:       o.created_at,
        customerName:    profile?.full_name ?? "Khách hàng",
        customerPhone:   profile?.phone ?? "",
        deliveryAddress: o.delivery_address ?? "",
        items: (items ?? []).map(i => ({
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
    <div style={{ padding: 24, fontFamily: "monospace", color: "#ff4040" }}>{error}</div>
  )
  if (!order) return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#888", textAlign: "center" }}>Đang tải...</div>
  )

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 4mm; size: 80mm auto; }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .invoice-wrap { padding-top: 12px !important; }
        }
        html, body {
          background: #fff !important;
          color: #000 !important;
          font-family: "Courier New", Courier, monospace;
          font-size: 12px;
          margin: 0;
        }
      `}</style>

      {/* Button bar */}
      <div className="no-print" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 99,
        background: "#f5f5f5", borderBottom: "1px solid #ddd",
        padding: "10px 16px", display: "flex", gap: 8, justifyContent: "flex-end",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}>
        <button onClick={() => window.print()} style={{
          padding: "8px 20px", borderRadius: 8, border: "none",
          background: "#FF6B00", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>
          🖨️ In ngay
        </button>
        <button onClick={() => window.close()} style={{
          padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc",
          background: "#fff", color: "#333", fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>
          ✕ Đóng
        </button>
      </div>

      <div className="invoice-wrap" style={{ width: "100%", maxWidth: 320, margin: "0 auto", padding: "58px 8px 12px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: 1 }}>
            {order.shopName.toUpperCase()}
          </div>
          <div style={{ fontSize: 10, marginTop: 2 }}>--- HÓA ĐƠN GIAO HÀNG ---</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            <strong>#{order.id}</strong> · {fmtDateTime(order.createdAt)}
          </div>
        </div>

        {/* Khách hàng */}
        <div style={{ borderBottom: "1px dashed #000", paddingBottom: 6, marginBottom: 8, fontSize: 11 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>--- KHÁCH HÀNG ---</div>
          <div>
            {order.customerName}
            {order.customerPhone ? ` · ${maskPhone(order.customerPhone)}` : ""}
          </div>
          {order.deliveryAddress && (
            <div style={{ marginTop: 2, color: "#444" }}>
              📍 {maskAddress(order.deliveryAddress)}
            </div>
          )}
        </div>

        {/* Món ăn */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>--- MÓN ĂN ---</div>
          {order.items.map((item, idx) => {
            const bd = item.options
            return (
              <div key={idx} style={{ marginBottom: 8, paddingBottom: 6, borderBottom: idx < order.items.length - 1 ? "1px dotted #ccc" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}>
                  <span>{item.qty}x {bd?.basePrice !== undefined ? item.name.split("(")[0].trim() : item.name}</span>
                  <span>{fmt(item.price * item.qty)}</span>
                </div>
                {item.qty > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555" }}>
                    <span>Đơn giá</span>
                    <span>{fmt(item.price)}</span>
                  </div>
                )}
                {bd?.sizeLabel && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, paddingLeft: 10 }}>
                    <span>▸ {sizeDisplay(bd.sizeLabel)}</span>
                    <span>{bd.sizeDiff && bd.sizeDiff > 0 ? `+${fmt(bd.sizeDiff)}` : bd.sizeDiff && bd.sizeDiff < 0 ? `-${fmt(Math.abs(bd.sizeDiff))}` : "—"}</span>
                  </div>
                )}
                {bd?.toppings?.map((t, ti) => (
                  <div key={ti} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, paddingLeft: 10 }}>
                    <span>▸ {t.name}</span>
                    <span>+{fmt(t.price)}</span>
                  </div>
                ))}
                {item.note && (
                  <div style={{ fontSize: 10, color: "#666", fontStyle: "italic", paddingLeft: 10, marginTop: 2 }}>
                    * {item.note}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Ghi chú đơn */}
        {order.note && (
          <div style={{ borderTop: "1px dashed #000", paddingTop: 6, marginBottom: 8, fontSize: 11 }}>
            <strong>Ghi chú:</strong> {order.note}
          </div>
        )}

        {/* Thanh toán */}
        <div style={{ borderTop: "1px solid #000", paddingTop: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>--- THANH TOÁN ---</div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
            <span>Tiền món:</span>
            <span>{fmt(order.subtotal)}</span>
          </div>

          {order.discountAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
              <span>Giảm giá:</span>
              <span>-{fmt(order.discountAmount)}</span>
            </div>
          )}

          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 14, marginBottom: 6 }}>
            <span>Tổng tiền:</span>
            <span>{fmt(order.totalAmount)}</span>
          </div>

          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
            <span>Thực nhận (sau hoa hồng):</span>
            <span style={{ fontWeight: 900 }}>{fmt(order.merchantReceives)}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px dashed #000", paddingTop: 8, marginTop: 8, textAlign: "center", fontSize: 10, color: "#555" }}>
          Cảm ơn quý khách!
          <br />
          DakGo — Krông Pắc
        </div>
      </div>
    </>
  )
}
