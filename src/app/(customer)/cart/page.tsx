"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useCartStore } from "@/store/cartStore"
import { formatPrice } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const SHIP_FEE = 15000

interface AppliedCombo { title: string; discount: number }

export default function CartPage() {
  const router   = useRouter()
  const supabase = createClient()
  const items       = useCartStore(s => s.items)
  const note        = useCartStore(s => s.note)
  const shopId      = useCartStore(s => s.shopId)
  const updateQty   = useCartStore(s => s.updateQty)
  const setItemNote = useCartStore(s => s.setItemNote)
  const setNote     = useCartStore(s => s.setNote)

  const [openNoteId,     setOpenNoteId]     = useState<string | null>(null)
  const [appliedCombos,  setAppliedCombos]  = useState<AppliedCombo[]>([])

  // Tự nhận diện combo đủ điều kiện
  useEffect(() => {
    if (!shopId || items.length === 0) { setAppliedCombos([]); return }
    const now = new Date().toISOString()
    supabase.from("vouchers")
      .select("id,title,discount_value,combo_items(product_id,min_quantity)")
      .eq("shop_id", shopId).eq("is_active", true).eq("is_combo", true).gte("valid_to", now)
      .then(({ data }) => {
        if (!data) return
        const matched: AppliedCombo[] = []
        data.forEach((v: { id: string; title: string; discount_value: number; combo_items: { product_id: string; min_quantity: number }[] }) => {
          const allMet = v.combo_items.every(ci => {
            const totalQty = items
              .filter(i => i.id.split("__")[0] === ci.product_id)
              .reduce((s, i) => s + i.qty, 0)
            return totalQty >= ci.min_quantity
          })
          if (allMet && v.combo_items.length > 0) {
            matched.push({ title: v.title, discount: v.discount_value })
          }
        })
        setAppliedCombos(matched)
      })
  }, [items, shopId]) // eslint-disable-line react-hooks/exhaustive-deps

  const comboDiscount = appliedCombos.reduce((s, c) => s + c.discount, 0)
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const total    = subtotal + SHIP_FEE - comboDiscount

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
                          {/* Tên món */}
                          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#f8f0e0", lineHeight: 1.3 }}>
                            {item.breakdown ? item.name.replace(/\s*\(.*\)$/, "") : item.name}
                          </p>

                          {/* Bảng tùy chọn */}
                          {item.breakdown && (item.breakdown.sizeLabel || (item.breakdown.toppings?.length ?? 0) > 0) && (
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                              borderRadius: 8, overflow: "hidden", marginBottom: 6 }}>
                              {/* Giá gốc */}
                              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 9px",
                                borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <span style={{ fontSize: 11, color: "#6a5a40" }}>Giá gốc</span>
                                <span style={{ fontSize: 11, color: "#b0956a", fontWeight: 600 }}>
                                  {formatPrice(item.breakdown.basePrice)}
                                </span>
                              </div>
                              {/* Size */}
                              {item.breakdown.sizeLabel && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                                  padding: "5px 9px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <span style={{ fontSize: 11, color: "#6a5a40" }}>📐 Size</span>
                                    <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                                      background: "rgba(74,143,245,0.12)", border: "1px solid rgba(74,143,245,0.25)",
                                      color: "#4a8ff5" }}>{item.breakdown.sizeLabel}</span>
                                  </div>
                                  <span style={{ fontSize: 11, color: "#4a8ff5", fontWeight: 600 }}>
                                    {item.breakdown.sizeDiff ? `+${formatPrice(item.breakdown.sizeDiff)}` : "Miễn phí"}
                                  </span>
                                </div>
                              )}
                              {/* Topping từng dòng */}
                              {item.breakdown.toppings?.map((t, ti) => (
                                <div key={ti} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                                  padding: "5px 9px",
                                  borderBottom: ti < (item.breakdown!.toppings!.length - 1) ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <span style={{ fontSize: 11, color: "#6a5a40" }}>🫙 Topping</span>
                                    <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                                      background: "rgba(62,207,110,0.08)", border: "1px solid rgba(62,207,110,0.2)",
                                      color: "#3ecf6e" }}>{t.name}</span>
                                  </div>
                                  <span style={{ fontSize: 11, color: "#3ecf6e", fontWeight: 600 }}>
                                    {t.price > 0 ? `+${formatPrice(t.price)}` : "Miễn phí"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Thành tiền / Số lượng / Tổng tiền */}
                          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            {/* Thành tiền/món */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                              <span style={{ fontSize: 11, color: "#6a5a40" }}>Thành tiền / món</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "#b0956a" }}>
                                {formatPrice(item.price)}
                              </span>
                            </div>

                            {/* Số lượng + controls inline */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                              <span style={{ fontSize: 11, color: "#6a5a40" }}>Số lượng</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <button type="button" onClick={() => updateQty(item.id, item.qty - 1)}
                                  style={{ width: 28, height: 28, borderRadius: 7, border: "none",
                                    background: item.qty === 1 ? "rgba(255,64,64,0.12)" : "rgba(255,255,255,0.07)",
                                    color: item.qty === 1 ? "#ff6060" : "#f8f0e0",
                                    fontSize: item.qty === 1 ? 11 : 14, cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontFamily: "'Lexend', sans-serif" }}>
                                  {item.qty === 1 ? "🗑" : "−"}
                                </button>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#f8f0e0", minWidth: 18, textAlign: "center" }}>
                                  {item.qty}
                                </span>
                                <button type="button" onClick={() => updateQty(item.id, item.qty + 1)}
                                  style={{ width: 28, height: 28, borderRadius: 7, border: "none",
                                    background: "rgba(255,107,0,0.15)", color: "#FF8C00",
                                    fontSize: 16, cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontFamily: "'Lexend', sans-serif" }}>+</button>
                              </div>
                            </div>

                            {/* Tổng tiền */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                              paddingTop: 5, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#b0956a" }}>Tổng tiền</span>
                              <span style={{
                                fontSize: 14, fontWeight: 800,
                                background: "linear-gradient(90deg,#FF6B00,#FFB347)",
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                backgroundClip: "text",
                              } as React.CSSProperties}>
                                {formatPrice(item.price * item.qty)}
                              </span>
                            </div>
                          </div>

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

              {/* Combo savings badge */}
              {appliedCombos.length > 0 && (
                <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                  style={{ marginBottom:10, background:"rgba(180,100,255,0.08)",
                    border:"1px solid rgba(180,100,255,0.25)", borderRadius:12, padding:"10px 13px" }}>
                  <div style={{ color:"#b464ff", fontSize:10, fontWeight:700, marginBottom:4 }}>
                    🎁 Combo đang áp dụng
                  </div>
                  {appliedCombos.map((c, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ color:"#b0956a", fontSize:10 }}>{c.title}</span>
                      <span style={{ color:"#b464ff", fontSize:10, fontWeight:700 }}>−{formatPrice(c.discount)}</span>
                    </div>
                  ))}
                </motion.div>
              )}

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
                Tiếp tục →
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
                  fontSize: 11, fontWeight: tab.active ? 700 : 400,
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
      margin: "12px 2px 6px", fontSize: 11, fontWeight: 700,
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
