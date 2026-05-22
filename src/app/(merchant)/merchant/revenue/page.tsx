"use client"

import { useState } from "react"

const COMMISSION_RATE = 0.15

const DAILY = [
  { day:"T2", subtotal:1250000, orders:28, voucherDiscount:50000  },
  { day:"T3", subtotal:1680000, orders:37, voucherDiscount:80000  },
  { day:"T4", subtotal:980000,  orders:22, voucherDiscount:0      },
  { day:"T5", subtotal:2100000, orders:46, voucherDiscount:120000 },
  { day:"T6", subtotal:1870000, orders:41, voucherDiscount:60000  },
  { day:"T7", subtotal:2850000, orders:63, voucherDiscount:200000 },
  { day:"CN", subtotal:1540000, orders:34, voucherDiscount:40000  },
]

/* recent orders with breakdown */
const RECENT_ORDERS = [
  { id:"GN-8821", time:"15:32", items:"Bún bò đặc biệt ×2, Trà đá ×2", subtotal:100000, voucherDiscount:0,     payMethod:"cash"   },
  { id:"GN-8820", time:"15:10", items:"Bún bò thường ×1, Sinh tố bơ ×1", subtotal:60000,  voucherDiscount:10000, payMethod:"wallet" },
  { id:"GN-8819", time:"14:45", items:"Chả chiên giòn ×3",               subtotal:45000,  voucherDiscount:0,     payMethod:"cash"   },
  { id:"GN-8818", time:"14:20", items:"Bún bò đặc biệt ×1, Trà đá ×1",  subtotal:50000,  voucherDiscount:5000,  payMethod:"cash"   },
  { id:"GN-8817", time:"13:55", items:"Sinh tố bơ ×2, Trà đá ×2",        subtotal:60000,  voucherDiscount:0,     payMethod:"vietqr" },
]

const TOP_ITEMS = [
  { name:"Bún bò đặc biệt", qty:89, subtotal:4005000, pct:32 },
  { name:"Chả chiên giòn",  qty:156, subtotal:2340000, pct:22 },
  { name:"Bún bò thường",   qty:67, subtotal:2345000, pct:19 },
  { name:"Trà đá",          qty:201, subtotal:1005000, pct:14 },
  { name:"Sinh tố bơ",      qty:42, subtotal:1050000, pct:10 },
]

const fmt  = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtK = (n: number) => Math.round(n / 1000) + "k"
const maxSub = Math.max(...DAILY.map(d => d.subtotal))

function calcNet(subtotal: number, voucherDiscount: number) {
  const commission = Math.round(subtotal * COMMISSION_RATE)
  return { commission, net: subtotal - commission - voucherDiscount }
}

export default function MerchantRevenuePage() {
  const [period,     setPeriod]     = useState<"week" | "month">("week")
  const [expandOrder, setExpandOrder] = useState<string | null>(null)

  const mul = period === "week" ? 1 : 4

  const totalSubtotal  = DAILY.reduce((s, d) => s + d.subtotal, 0) * mul
  const totalVoucher   = DAILY.reduce((s, d) => s + d.voucherDiscount, 0) * mul
  const totalCommission = Math.round(totalSubtotal * COMMISSION_RATE)
  const totalNet        = totalSubtotal - totalCommission - totalVoucher
  const totalOrders    = DAILY.reduce((s, d) => s + d.orders, 0) * mul

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{display:none}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
      `}</style>

      <div style={{ position: "fixed", inset: 0, background: "#080806", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "52px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <a href="/merchant" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#f8f0e0", fontSize: 16 }}>←</a>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 16, fontWeight: 800 }}>Doanh thu</div>
              <div style={{ color: "#6a5a40", fontSize: 9 }}>Bún Bò Huế Ngon · Hoa hồng 15%</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#3ecf6e", fontSize: 10, fontWeight: 700 }}>💵 Tiền mặt</div>
              <div style={{ color: "#6a5a40", fontSize: 8 }}>Từ tài xế khi lấy hàng</div>
            </div>
          </div>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 2, gap: 2 }}>
            {(["week", "month"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ flex: 1, height: 32, borderRadius: 8, background: period === p ? "rgba(255,107,0,0.15)" : "transparent", border: period === p ? "1px solid rgba(255,107,0,0.3)" : "1px solid transparent", cursor: "pointer", color: period === p ? "#FF8C00" : "#6a5a40", fontSize: 10, fontWeight: period === p ? 700 : 500, fontFamily: "Lexend", transition: "all .2s" }}>
                {p === "week" ? "Tuần này" : "Tháng này"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px" }}>

          {/* ── Tổng quan ── */}
          <div style={{ background: "rgba(255,107,0,0.05)", border: "1px solid rgba(255,107,0,0.15)", borderRadius: 16, padding: "16px", marginBottom: 12 }}>
            <div style={{ color: "#6a5a40", fontSize: 9, textAlign: "center", marginBottom: 6 }}>Doanh thu {period === "week" ? "tuần này" : "tháng này"}</div>
            <div style={{ background: "linear-gradient(90deg,#FF6B00,#FFB347)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 4 }}>
              {fmt(totalSubtotal)}
            </div>
            <div style={{ color: "#6a5a40", fontSize: 9, textAlign: "center", marginBottom: 14 }}>Tiền hàng · {totalOrders} đơn</div>

            {/* breakdown 3 cột */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", gap: 0 }}>
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{ color: "#ff4040", fontSize: 13, fontWeight: 800 }}>−{fmt(totalCommission)}</div>
                <div style={{ color: "#6a5a40", fontSize: 8, marginTop: 3 }}>Hoa hồng 15%</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{ color: "#FFB347", fontSize: 13, fontWeight: 800 }}>−{fmt(totalVoucher)}</div>
                <div style={{ color: "#6a5a40", fontSize: 8, marginTop: 3 }}>Voucher trừ</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{ color: "#3ecf6e", fontSize: 13, fontWeight: 800 }}>{fmt(totalNet)}</div>
                <div style={{ color: "#6a5a40", fontSize: 8, marginTop: 3 }}>✓ Thực nhận</div>
              </div>
            </div>

            {/* cash note */}
            <div style={{ marginTop: 10, background: "rgba(62,207,110,0.07)", border: "1px solid rgba(62,207,110,0.2)", borderRadius: 9, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>💵</span>
              <div style={{ color: "#3ecf6e", fontSize: 9.5, lineHeight: 1.5 }}>
                Tài xế trả tiền mặt cho quán khi đến lấy hàng (sau khi đã trừ hoa hồng và voucher). Phí giao hàng thuộc về tài xế.
              </div>
            </div>
          </div>

          {/* ── Bar chart ── */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 700 }}>📊 Doanh thu theo ngày</div>
              <div style={{ display: "flex", gap: 8, fontSize: 8, color: "#6a5a40" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#FF8C00", display: "inline-block" }} />Tiền hàng</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#3ecf6e", display: "inline-block" }} />Thực nhận</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 90 }}>
              {DAILY.map((d, i) => {
                const { net } = calcNet(d.subtotal, d.voucherDiscount)
                const hSub = Math.max(4, Math.round((d.subtotal / maxSub) * 82))
                const hNet = Math.max(2, Math.round((net / maxSub) * 82))
                const isToday = i === 6
                return (
                  <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ color: "#6a5a40", fontSize: 7 }}>{d.orders}</div>
                    <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: hSub }}>
                      <div style={{ flex: 1, height: hSub, borderRadius: "3px 3px 0 0", background: isToday ? "linear-gradient(180deg,#FF6B00,#FF8C00)" : "rgba(255,107,0,0.2)" }} />
                      <div style={{ flex: 1, height: hNet, borderRadius: "3px 3px 0 0", background: isToday ? "#3ecf6e" : "rgba(62,207,110,0.2)" }} />
                    </div>
                    <div style={{ color: isToday ? "#FF8C00" : "#6a5a40", fontSize: 8, fontWeight: isToday ? 700 : 400 }}>{d.day}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color: "#6a5a40", fontSize: 8 }}>Thấp nhất: {fmtK(Math.min(...DAILY.map(d => d.subtotal)))}</span>
              <span style={{ color: "#FF8C00", fontSize: 8, fontWeight: 700 }}>Cao nhất: {fmtK(maxSub)}</span>
            </div>
          </div>

          {/* ── Đơn gần đây với breakdown ── */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 700 }}>🧾 Đơn hôm nay — Chi tiết thu nhập</div>
            </div>
            {RECENT_ORDERS.map((o, i) => {
              const { commission, net } = calcNet(o.subtotal, o.voucherDiscount)
              const isOpen = expandOrder === o.id
              const payIcon = o.payMethod === "wallet" ? "💙" : o.payMethod === "vietqr" ? "🏦" : "💵"
              return (
                <div key={o.id} style={{ borderBottom: i < RECENT_ORDERS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  {/* summary row */}
                  <div onClick={() => setExpandOrder(p => p === o.id ? null : o.id)}
                    style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ color: "#FF8C00", fontSize: 11, fontWeight: 800 }}>#{o.id}</span>
                        <span style={{ color: "#6a5a40", fontSize: 9 }}>{o.time}</span>
                        <span style={{ fontSize: 11 }}>{payIcon}</span>
                      </div>
                      <div style={{ color: "#6a5a40", fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.items}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#3ecf6e", fontSize: 13, fontWeight: 800 }}>{fmt(net)}</div>
                      <div style={{ color: "#6a5a40", fontSize: 8 }}>thực nhận</div>
                    </div>
                    <div style={{ color: "#6a5a40", fontSize: 12, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>⌾</div>
                  </div>

                  {/* expanded breakdown */}
                  {isOpen && (
                    <div style={{ padding: "0 14px 12px" }}>
                      <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px" }}>
                        {[
                          { label: "Tiền hàng",           value: o.subtotal,          color: "#f8f0e0", prefix: "",  size: 11 },
                          { label: "Hoa hồng app 15%",    value: commission,           color: "#ff4040", prefix: "−", size: 11 },
                          ...(o.voucherDiscount > 0
                            ? [{ label: "Voucher giảm giá", value: o.voucherDiscount,  color: "#FFB347", prefix: "−", size: 11 }]
                            : []),
                        ].map(r => (
                          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <span style={{ color: "#6a5a40", fontSize: r.size }}>{r.label}</span>
                            <span style={{ color: r.color, fontSize: r.size, fontWeight: 600 }}>{r.prefix}{fmt(r.value)}</span>
                          </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(62,207,110,0.25)" }}>
                          <div>
                            <div style={{ color: "#3ecf6e", fontSize: 12, fontWeight: 800 }}>✓ Thực nhận</div>
                            <div style={{ color: "#6a5a40", fontSize: 8, marginTop: 1 }}>Tài xế trả khi lấy hàng</div>
                          </div>
                          <div style={{ color: "#3ecf6e", fontSize: 16, fontWeight: 800 }}>{fmt(net)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Top items ── */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 700 }}>🏆 Món bán chạy nhất</div>
            </div>
            {TOP_ITEMS.map((item, i) => {
              const commission = Math.round(item.subtotal * COMMISSION_RATE)
              const net = item.subtotal - commission
              return (
                <div key={item.name} style={{ padding: "10px 14px", borderBottom: i < TOP_ITEMS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13 }}>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</span>
                      <span style={{ color: "#f8f0e0", fontSize: 10.5, fontWeight: 600 }}>{item.name}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#3ecf6e", fontSize: 11, fontWeight: 700 }}>{fmt(net)}</div>
                      <div style={{ color: "#6a5a40", fontSize: 8 }}>thực nhận</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ width: `${item.pct}%`, height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#FF6B00,#FFB347)" }} />
                    </div>
                    <span style={{ color: "#6a5a40", fontSize: 8, flexShrink: 0 }}>{item.qty} suất · −{fmt(commission)} hoa hồng</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Tổng kết thu nhập ── */}
          <div style={{ background: "rgba(62,207,110,0.05)", border: "1px solid rgba(62,207,110,0.2)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(62,207,110,0.12)" }}>
              <div style={{ color: "#3ecf6e", fontSize: 11, fontWeight: 700 }}>💵 Tổng thu nhập thực tế</div>
            </div>
            <div style={{ padding: "0 14px" }}>
              {[
                { label: "Tổng tiền hàng",     value: totalSubtotal,  color: "#f8f0e0" },
                { label: "Hoa hồng Giao Nhanh (15%)", value: totalCommission, color: "#ff4040", prefix: "−" },
                { label: "Voucher giảm giá",    value: totalVoucher,   color: "#FFB347", prefix: "−" },
              ].map((r, i) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "#6a5a40", fontSize: 11 }}>{r.label}</span>
                  <span style={{ color: r.color, fontSize: 11, fontWeight: 700 }}>{"prefix" in r ? r.prefix : ""}{fmt(r.value)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0" }}>
                <div>
                  <div style={{ color: "#3ecf6e", fontSize: 13, fontWeight: 800 }}>✓ Thực nhận từ tài xế</div>
                  <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 2 }}>Tài xế trả tiền mặt khi đến lấy từng đơn hàng</div>
                </div>
                <div style={{ color: "#3ecf6e", fontSize: 20, fontWeight: 800 }}>{fmt(totalNet)}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
