"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useCartStore } from "@/store/cartStore"
import { formatPrice } from "@/lib/utils"

const SHIP_FEE = 15000

export default function CartPage() {
  const router = useRouter()
  const items      = useCartStore(s => s.items)
  const note       = useCartStore(s => s.note)
  const updateQty  = useCartStore(s => s.updateQty)
  const setItemNote = useCartStore(s => s.setItemNote)
  const setNote    = useCartStore(s => s.setNote)

  const [openNoteId, setOpenNoteId] = useState<string | null>(null)

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const total    = subtotal + SHIP_FEE

  return (
    <>
      <style>{`
        * { -ms-overflow-style: none; scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
        @keyframes shimmer { 0% { left: -60%; } 100% { left: 120%; } }
      `}</style>

      <div style={{
        position: "fixed", inset: 0, background: "#080806", zIndex: 60,
        display: "flex", flexDirection: "column", fontFamily: "'Lexend', sans-serif",
      }}>

        {/* Header */}
        <div style={{
          padding: "calc(env(safe-area-inset-top) + 14px) 20px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{
                width: 38, height: 38, borderRadius: 11,
                background: "rgba(255,255,255,0.06)", border: "none",
                color: "#f8f0e0", fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >←</button>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f8f0e0" }}>
                Giỏ hàng
              </h1>
              {items.length > 0 && (
                <p style={{ margin: 0, fontSize: 11, color: "#6a5a40" }}>
                  {items.length} món · {items[0].shop}
                </p>
              )}
            </div>
            {items.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: "#FF8C00",
                background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.25)",
                borderRadius: 8, padding: "4px 10px",
              }}>
                {items.reduce((s, i) => s + i.qty, 0)} món
              </span>
            )}
          </div>
        </div>

        {/* Scroll body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 180px" } as React.CSSProperties}>

          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: 340, gap: 14,
              }}
            >
              <div style={{ fontSize: 64, filter: "grayscale(0.3)" }}>🛒</div>
              <p style={{ margin: 0, fontSize: 15, color: "#6a5a40", fontWeight: 600 }}>
                Giỏ hàng trống
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#6a5a40", textAlign: "center" }}>
                Thêm món ngon từ các quán yêu thích
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                style={{
                  marginTop: 8, padding: "10px 28px", borderRadius: 14,
                  background: "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
                  border: "none", color: "#fff", fontSize: 13, fontWeight: 700,
                  fontFamily: "'Lexend', sans-serif", cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(255,107,0,0.4)",
                  position: "relative", overflow: "hidden",
                }}
              >
                <div style={{
                  position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                  background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                  animation: "shimmer 2.5s infinite",
                }} />
                <span style={{ position: "relative", zIndex: 1 }}>Khám phá món ngon</span>
              </button>
            </motion.div>
          ) : (
            <>
              {/* Danh sách món */}
              <SectionLabel>Món đã chọn</SectionLabel>
              <AnimatePresence mode="popLayout">
                {items.map(item => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 40, scale: 0.95 }}
                    style={{ marginBottom: 8 }}
                  >
                    <div style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14, padding: "12px 13px",
                    }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{
                          width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                          background: item.imageUrl ? "transparent" : "rgba(255,107,0,0.08)",
                          border: "1px solid rgba(255,107,0,0.15)",
                          overflow: "hidden",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 24,
                        }}>
                          {item.imageUrl
                            ? <img src={item.imageUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : "🍜"
                          }
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#f8f0e0", lineHeight: 1.3 }}>
                            {item.name}
                          </p>
                          <p style={{ margin: "0 0 6px", fontSize: 10.5, color: "#6a5a40" }}>
                            {item.shop}
                          </p>
                          <span style={{
                            fontSize: 13, fontWeight: 700,
                            background: "linear-gradient(90deg,#FF6B00,#FFB347)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                          } as React.CSSProperties}>
                            {formatPrice(item.price * item.qty)}
                          </span>
                          {item.qty > 1 && (
                            <span style={{ fontSize: 9, color: "#6a5a40", marginLeft: 5 }}>
                              ({formatPrice(item.price)}/phần)
                            </span>
                          )}
                        </div>

                        {/* Qty controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, item.qty - 1)}
                            style={{
                              width: 36, height: 36, borderRadius: 9, border: "none",
                              background: item.qty === 1 ? "rgba(255,64,64,0.12)" : "rgba(255,255,255,0.07)",
                              color: item.qty === 1 ? "#ff6060" : "#f8f0e0",
                              fontSize: item.qty === 1 ? 13 : 16, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'Lexend', sans-serif",
                            }}
                          >
                            {item.qty === 1 ? "🗑" : "−"}
                          </button>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#f8f0e0", minWidth: 16, textAlign: "center" }}>
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, item.qty + 1)}
                            style={{
                              width: 36, height: 36, borderRadius: 9, border: "none",
                              background: "rgba(255,107,0,0.15)",
                              color: "#FF8C00", fontSize: 18, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'Lexend', sans-serif",
                            }}
                          >+</button>
                        </div>
                      </div>

                      {/* Per-item note */}
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => setOpenNoteId(openNoteId === item.id ? null : item.id)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: item.note ? "#FF8C00" : "#6a5a40",
                            fontSize: 10.5, fontWeight: 600, fontFamily: "'Lexend', sans-serif",
                            padding: 0, display: "flex", alignItems: "center", gap: 4,
                          }}
                        >
                          {item.note ? "📝 " + item.note : "✏️ Thêm ghi chú cho món này"}
                        </button>
                        <AnimatePresence>
                          {openNoteId === item.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              style={{ overflow: "hidden" }}
                            >
                              <input
                                autoFocus
                                value={item.note ?? ""}
                                onChange={e => setItemNote(item.id, e.target.value)}
                                placeholder="VD: Ít cay, không hành..."
                                style={{
                                  marginTop: 7, width: "100%", background: "rgba(255,255,255,0.05)",
                                  border: "1px solid rgba(255,107,0,0.3)", borderRadius: 8,
                                  padding: "7px 10px", color: "#f8f0e0", fontSize: 11,
                                  fontFamily: "'Lexend', sans-serif", outline: "none",
                                }}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Ghi chú cho quán */}
              <SectionLabel>Ghi chú cho quán</SectionLabel>
              <Section style={{ padding: "10px 13px" }}>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="VD: Ít cay, không hành, để thêm chanh..."
                  rows={2}
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    outline: "none", resize: "none", color: "#f8f0e0",
                    fontSize: 12, fontFamily: "'Lexend', sans-serif",
                    caretColor: "#FF8C00", lineHeight: 1.55,
                  }}
                />
              </Section>

              {/* Tóm tắt giá (tạm tính — voucher & địa chỉ ở bước sau) */}
              <SectionLabel>Tóm tắt</SectionLabel>
              <Section style={{ padding: "12px 14px" }}>
                <Row label="Tạm tính" value={formatPrice(subtotal)} />
                <Row label="Phí giao hàng (ước tính)" value={formatPrice(SHIP_FEE)} />
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "10px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f8f0e0" }}>Dự kiến</span>
                  <span style={{
                    fontSize: 16, fontWeight: 800,
                    background: "linear-gradient(90deg,#FF6B00,#FFB347)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  } as React.CSSProperties}>
                    {formatPrice(total)}
                  </span>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 9, color: "#6a5a40", lineHeight: 1.5 }}>
                  * Giá cuối sau khi áp mã giảm giá sẽ hiển thị ở bước tiếp theo
                </p>
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(8,8,6,0.97)", backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          zIndex: 50, display: "flex", flexDirection: "column", gap: 8,
          padding: `10px 14px max(16px,env(safe-area-inset-bottom))`,
        } as React.CSSProperties}>

          {items.length > 0 && (
            <button type="button" onClick={() => router.push("/checkout")} style={{
              width: "100%", height: 52, borderRadius: 14, border: "none",
              background: "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
              color: "#fff", fontSize: 14, fontWeight: 800,
              fontFamily: "'Lexend', sans-serif", cursor: "pointer",
              position: "relative", overflow: "hidden",
              boxShadow: "0 4px 24px rgba(255,107,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              flexShrink: 0,
            }}>
              <div style={{
                position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                animation: "shimmer 2.5s infinite",
              }} />
              <span style={{ position: "relative", zIndex: 1 }}>
                Tiếp tục · {formatPrice(total)}
              </span>
            </button>
          )}

          {/* BottomNav */}
          <div style={{
            height: 56, borderRadius: 9999, flexShrink: 0,
            background: "rgba(14,12,9,0.92)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,107,0,0.2)",
            display: "flex", alignItems: "center", justifyContent: "space-around",
            boxShadow: "0 0 20px rgba(255,107,0,0.1)",
          }}>
            {([
              { icon: "🏠", label: "Trang chủ", href: "/",         active: false },
              { icon: "📋", label: "Đơn hàng",  href: "/orders",   active: false },
              { icon: "🛒", label: "Giỏ hàng",  href: "/cart",     active: true  },
              { icon: "⚙️", label: "Cài đặt",   href: "/settings", active: false },
            ] as const).map(tab => (
              <button type="button" key={tab.href} onClick={() => router.push(tab.href)}
                style={{
                  flex: 1, height: "100%", background: "none", border: "none",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 2, cursor: "pointer",
                  borderRadius: 9999, position: "relative",
                }}>
                {tab.active && (
                  <div style={{
                    position: "absolute", inset: "6px 8px",
                    background: "rgba(255,107,0,0.1)", borderRadius: 9999,
                  }} />
                )}
                <span style={{
                  fontSize: 20, position: "relative",
                  filter: tab.active ? "drop-shadow(0 0 4px rgba(255,107,0,0.6))" : "none",
                }}>{tab.icon}</span>
                <span style={{
                  fontSize: 9, fontWeight: tab.active ? 700 : 400,
                  color: tab.active ? "#FF8C00" : "#6a5a40",
                  letterSpacing: 0.2, position: "relative",
                }}>{tab.label}</span>
                {tab.active && (
                  <div style={{
                    position: "absolute", bottom: 4, width: 28, height: 3, borderRadius: 2,
                    background: "radial-gradient(ellipse,rgba(255,107,0,0.9) 0%,transparent 70%)",
                    filter: "blur(1px)",
                  }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, padding: "12px 13px",
      marginBottom: 8, ...style,
    }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: "12px 2px 6px", fontSize: 9.5, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: 0.7, color: "#6a5a40",
    }}>
      {children}
    </p>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
      <span style={{ fontSize: 11.5, color: "#6a5a40" }}>{label}</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "#b0956a" }}>{value}</span>
    </div>
  )
}
