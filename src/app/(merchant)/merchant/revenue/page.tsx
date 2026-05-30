"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

const fmt  = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtK = (n: number) => Math.round(n / 1000) + "k"

const DAY_LABELS = ["CN","T2","T3","T4","T5","T6","T7"]

interface DayData { day: string; subtotal: number; orders: number; voucherDiscount: number }
interface RecentOrder { id: string; time: string; items: string; subtotal: number; voucherDiscount: number; payMethod: string }
interface TopItem { name: string; qty: number; subtotal: number; pct: number }

function calcNet(subtotal: number, voucherDiscount: number, rate: number) {
  const commission = Math.round(subtotal * rate)
  return { commission, net: subtotal - commission - voucherDiscount }
}

export default function MerchantRevenuePage() {
  const supabase = createClient()
  const [period,       setPeriod]       = useState<"week" | "month">("week")
  const [loading,      setLoading]      = useState(true)
  const [commRate,     setCommRate]     = useState(0.15)
  const [shopName,     setShopName]     = useState("")
  const [daily,        setDaily]        = useState<DayData[]>([])
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [topItems,     setTopItems]     = useState<TopItem[]>([])
  const [expandOrder,  setExpandOrder]  = useState<string | null>(null)
  const [loadErr,      setLoadErr]      = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadErr("")
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: shop } = await supabase
          .from("shops")
          .select("id,name,commission_rate")
          .eq("owner_id", user.id)
          .single()
        if (!shop) return

        setShopName(shop.name ?? "")
        const rate = (shop.commission_rate ?? 15) / 100
        setCommRate(rate)

        // Date range
        const now = new Date()
        let startDate: Date
        if (period === "week") {
          startDate = new Date(now); startDate.setDate(now.getDate() - 6); startDate.setHours(0,0,0,0)
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        }

        // Fetch delivered orders in range
        const { data: orders } = await supabase
          .from("orders")
          .select("id,total,ship_fee,pay_method,created_at")
          .eq("shop_id", shop.id)
          .eq("status", "delivered")
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: false })

        const ordersData = orders ?? []

        // Build DAILY data (last 7 days for week, aggregate by day for month)
        if (period === "week") {
          const days: DayData[] = []
          for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(now.getDate() - i); d.setHours(0,0,0,0)
            const next = new Date(d); next.setDate(d.getDate() + 1)
            const dayOrders = ordersData.filter(o => {
              const t = new Date(o.created_at)
              return t >= d && t < next
            })
            const label = DAY_LABELS[d.getDay()]
            days.push({
              day: label,
              subtotal: dayOrders.reduce((s, o) => s + (o.total ?? 0), 0),
              orders: dayOrders.length,
              voucherDiscount: dayOrders.reduce((s, o) => s + (0 ?? 0), 0),
            })
          }
          setDaily(days)
        } else {
          // Group by week for month view
          const weeks: DayData[] = []
          for (let w = 0; w < 4; w++) {
            const start = new Date(now.getFullYear(), now.getMonth(), 1 + w * 7)
            const end   = new Date(now.getFullYear(), now.getMonth(), 1 + (w+1) * 7)
            const wOrders = ordersData.filter(o => {
              const t = new Date(o.created_at)
              return t >= start && t < end
            })
            if (wOrders.length > 0 || w < Math.ceil(now.getDate() / 7)) {
              weeks.push({
                day: `T${w+1}`,
                subtotal: wOrders.reduce((s, o) => s + (o.total ?? 0), 0),
                orders: wOrders.length,
                voucherDiscount: wOrders.reduce((s, o) => s + (0 ?? 0), 0),
              })
            }
          }
          setDaily(weeks)
        }

        // Recent orders (today, up to 10)
        const todayStart = new Date(); todayStart.setHours(0,0,0,0)
        const todayOrders = ordersData.filter(o => new Date(o.created_at) >= todayStart).slice(0, 10)

        // Fetch order_items for recent orders
        if (todayOrders.length > 0) {
          const orderIds = todayOrders.map(o => o.id)
          const { data: items } = await supabase
            .from("order_items")
            .select("order_id,name,qty,price")
            .in("order_id", orderIds)

          const itemsByOrder = new Map<string, typeof items>()
          for (const item of items ?? []) {
            const list = itemsByOrder.get(item.order_id) ?? []
            list.push(item)
            itemsByOrder.set(item.order_id, list)
          }

          setRecentOrders(todayOrders.map(o => {
            const oItems = itemsByOrder.get(o.id) ?? []
            const summary = oItems.map(i => `${i.name} ×${i.qty}`).join(", ") || "—"
            const t = new Date(o.created_at)
            return {
              id: o.id.slice(-4).toUpperCase(),
              time: `${t.getHours().toString().padStart(2,"0")}:${t.getMinutes().toString().padStart(2,"0")}`,
              items: summary, subtotal: o.total ?? 0,
              voucherDiscount: 0,
              payMethod: o.pay_method ?? "cash",
            }
          }))
        } else {
          setRecentOrders([])
        }

        // Top items from all orders in period
        if (ordersData.length > 0) {
          const { data: allItems } = await supabase
            .from("order_items")
            .select("name,qty,price")
            .in("order_id", ordersData.map(o => o.id))

          const aggMap = new Map<string, { qty: number; subtotal: number }>()
          for (const item of allItems ?? []) {
            const cur = aggMap.get(item.name) ?? { qty: 0, subtotal: 0 }
            aggMap.set(item.name, { qty: cur.qty + item.qty, subtotal: cur.subtotal + (item.price * item.qty) })
          }
          const totalSub = Array.from(aggMap.values()).reduce((s, x) => s + x.subtotal, 0)
          const sorted = Array.from(aggMap.entries())
            .sort((a, b) => b[1].subtotal - a[1].subtotal)
            .slice(0, 5)
            .map(([name, v]) => ({ name, qty: v.qty, subtotal: v.subtotal, pct: totalSub > 0 ? Math.round(v.subtotal / totalSub * 100) : 0 }))
          setTopItems(sorted)
        } else {
          setTopItems([])
        }
      } catch (err) {
        console.error("revenue load error:", err)
        setLoadErr("Không thể tải dữ liệu. Vui lòng thử lại.")
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const totalSubtotal   = daily.reduce((s, d) => s + d.subtotal, 0)
  const totalVoucher    = daily.reduce((s, d) => s + d.voucherDiscount, 0)
  const totalCommission = Math.round(totalSubtotal * commRate)
  const totalNet        = totalSubtotal - totalCommission - totalVoucher
  const totalOrders     = daily.reduce((s, d) => s + d.orders, 0)
  const maxSub          = Math.max(...daily.map(d => d.subtotal), 1)

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{display:none}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
      `}</style>

      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"calc(env(safe-area-inset-top) + 14px) 16px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
            <a href="/merchant" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Doanh thu</div>
              <div style={{ color:"#6a5a40",fontSize:9 }}>{shopName || "Cửa hàng"} · Hoa hồng {Math.round(commRate * 100)}%</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:"#3ecf6e",fontSize:10,fontWeight:700 }}>💵 Tiền mặt</div>
              <div style={{ color:"#6a5a40",fontSize:8 }}>Từ tài xế khi lấy hàng</div>
            </div>
          </div>
          <div style={{ display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:10,padding:2,gap:2 }}>
            {(["week","month"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ flex:1,height:32,borderRadius:8,background:period===p?"rgba(255,107,0,0.15)":"transparent",border:period===p?"1px solid rgba(255,107,0,0.3)":"1px solid transparent",cursor:"pointer",color:period===p?"#FF8C00":"#6a5a40",fontSize:10,fontWeight:period===p?700:500,fontFamily:"Lexend",transition:"all .2s" }}>
                {p==="week"?"Tuần này":"Tháng này"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px 24px" }}>

          {loading ? (
            <div style={{ textAlign:"center",padding:"40px 0" }}>
              <div style={{ fontSize:32,marginBottom:8 }}>📊</div>
              <div style={{ color:"#6a5a40",fontSize:12 }}>Đang tải doanh thu...</div>
            </div>
          ) : loadErr ? (
            <div style={{ textAlign:"center",padding:"40px 16px" }}>
              <div style={{ fontSize:32,marginBottom:8 }}>⚠️</div>
              <div style={{ color:"#ff4040",fontSize:13,marginBottom:16 }}>{loadErr}</div>
              <button onClick={() => { setPeriod(p => p) }} style={{ background:"rgba(255,107,0,0.12)",border:"1px solid rgba(255,107,0,0.3)",borderRadius:10,padding:"8px 20px",color:"#FF8C00",fontSize:12,fontWeight:600,cursor:"pointer" }}>
                Thử lại
              </button>
            </div>
          ) : (
            <>
              {/* Tổng quan */}
              <div style={{ background:"rgba(255,107,0,0.05)",border:"1px solid rgba(255,107,0,0.15)",borderRadius:16,padding:16,marginBottom:12 }}>
                <div style={{ color:"#6a5a40",fontSize:9,textAlign:"center",marginBottom:6 }}>Doanh thu {period==="week"?"tuần này":"tháng này"}</div>
                <div style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontSize:28,fontWeight:800,textAlign:"center",marginBottom:4 }}>
                  {totalSubtotal > 0 ? fmt(totalSubtotal) : "—"}
                </div>
                <div style={{ color:"#6a5a40",fontSize:9,textAlign:"center",marginBottom:14 }}>Tiền hàng · {totalOrders} đơn</div>

                {totalSubtotal > 0 && (
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1px 1fr 1px 1fr",gap:0 }}>
                    <div style={{ textAlign:"center",padding:"8px 0" }}>
                      <div style={{ color:"#ff4040",fontSize:13,fontWeight:800 }}>−{fmt(totalCommission)}</div>
                      <div style={{ color:"#6a5a40",fontSize:8,marginTop:3 }}>Hoa hồng {Math.round(commRate*100)}%</div>
                    </div>
                    <div style={{ background:"rgba(255,255,255,0.07)" }} />
                    <div style={{ textAlign:"center",padding:"8px 0" }}>
                      <div style={{ color:"#FFB347",fontSize:13,fontWeight:800 }}>−{fmt(totalVoucher)}</div>
                      <div style={{ color:"#6a5a40",fontSize:8,marginTop:3 }}>Voucher trừ</div>
                    </div>
                    <div style={{ background:"rgba(255,255,255,0.07)" }} />
                    <div style={{ textAlign:"center",padding:"8px 0" }}>
                      <div style={{ color:"#3ecf6e",fontSize:13,fontWeight:800 }}>{fmt(totalNet)}</div>
                      <div style={{ color:"#6a5a40",fontSize:8,marginTop:3 }}>✓ Thực nhận</div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop:10,background:"rgba(62,207,110,0.07)",border:"1px solid rgba(62,207,110,0.2)",borderRadius:9,padding:"8px 12px",display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:16 }}>💵</span>
                  <div style={{ color:"#3ecf6e",fontSize:9.5,lineHeight:1.5 }}>
                    Tài xế trả tiền mặt cho quán khi đến lấy hàng (sau khi đã trừ hoa hồng và voucher).
                  </div>
                </div>
              </div>

              {/* Bar chart */}
              <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:12 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                  <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700 }}>📊 Doanh thu theo ngày</div>
                  <div style={{ display:"flex",gap:8,fontSize:8,color:"#6a5a40" }}>
                    <span style={{ display:"flex",alignItems:"center",gap:3 }}><span style={{ width:8,height:8,borderRadius:2,background:"#FF8C00",display:"inline-block" }} />Tiền hàng</span>
                    <span style={{ display:"flex",alignItems:"center",gap:3 }}><span style={{ width:8,height:8,borderRadius:2,background:"#3ecf6e",display:"inline-block" }} />Thực nhận</span>
                  </div>
                </div>
                {daily.length === 0 ? (
                  <div style={{ textAlign:"center",padding:"20px 0",color:"#6a5a40",fontSize:11 }}>Chưa có đơn hàng nào</div>
                ) : (
                  <div style={{ display:"flex",gap:5,alignItems:"flex-end",height:90 }}>
                    {daily.map((d, i) => {
                      const { net } = calcNet(d.subtotal, d.voucherDiscount, commRate)
                      const hSub = Math.max(4, Math.round((d.subtotal / maxSub) * 82))
                      const hNet = Math.max(2, Math.round((net / maxSub) * 82))
                      const isLast = i === daily.length - 1
                      return (
                        <div key={d.day} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                          <div style={{ color:"#6a5a40",fontSize:7 }}>{d.orders}</div>
                          <div style={{ width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:hSub }}>
                            <div style={{ flex:1,height:hSub,borderRadius:"3px 3px 0 0",background:isLast?"linear-gradient(180deg,#FF6B00,#FF8C00)":"rgba(255,107,0,0.2)" }} />
                            <div style={{ flex:1,height:hNet,borderRadius:"3px 3px 0 0",background:isLast?"#3ecf6e":"rgba(62,207,110,0.2)" }} />
                          </div>
                          <div style={{ color:isLast?"#FF8C00":"#6a5a40",fontSize:8,fontWeight:isLast?700:400 }}>{d.day}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {daily.length > 0 && (
                  <div style={{ display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color:"#6a5a40",fontSize:8 }}>Thấp nhất: {fmtK(Math.min(...daily.map(d => d.subtotal)))}</span>
                    <span style={{ color:"#FF8C00",fontSize:8,fontWeight:700 }}>Cao nhất: {fmtK(maxSub)}</span>
                  </div>
                )}
              </div>

              {/* Đơn hôm nay */}
              <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,overflow:"hidden",marginBottom:12 }}>
                <div style={{ padding:"12px 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700 }}>🧾 Đơn hôm nay — Chi tiết thu nhập</div>
                </div>
                {recentOrders.length === 0 ? (
                  <div style={{ textAlign:"center",padding:"24px 0",color:"#6a5a40",fontSize:11 }}>Chưa có đơn nào hôm nay</div>
                ) : recentOrders.map((o, i) => {
                  const { commission, net } = calcNet(o.total, o.voucherDiscount, commRate)
                  const isExpanded = expandOrder === o.id
                  const payIcon = o.payMethod === "wallet" ? "💙" : o.payMethod === "vietqr" ? "🏦" : "💵"
                  return (
                    <div key={o.id} style={{ borderBottom: i < recentOrders.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <div onClick={() => setExpandOrder(p => p === o.id ? null : o.id)}
                        style={{ padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
                            <span style={{ color:"#FF8C00",fontSize:11,fontWeight:800 }}>#{o.id}</span>
                            <span style={{ color:"#6a5a40",fontSize:9 }}>{o.time}</span>
                            <span style={{ fontSize:11 }}>{payIcon}</span>
                          </div>
                          <div style={{ color:"#6a5a40",fontSize:9,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{o.items}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ color:"#3ecf6e",fontSize:13,fontWeight:800 }}>{fmt(net)}</div>
                          <div style={{ color:"#6a5a40",fontSize:8 }}>thực nhận</div>
                        </div>
                        <div style={{ color:"#6a5a40",fontSize:12,transform:isExpanded?"rotate(180deg)":"none",transition:"transform .2s" }}>⌾</div>
                      </div>
                      {isExpanded && (
                        <div style={{ padding:"0 14px 12px" }}>
                          <div style={{ background:"rgba(0,0,0,0.2)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"10px 12px" }}>
                            {[
                              { label:"Tiền hàng", value:o.total, color:"#f8f0e0", prefix:"" },
                              { label:`Hoa hồng app ${Math.round(commRate*100)}%`, value:commission, color:"#ff4040", prefix:"−" },
                              ...(o.voucherDiscount > 0 ? [{ label:"Voucher giảm giá", value:o.voucherDiscount, color:"#FFB347", prefix:"−" }] : []),
                            ].map(r => (
                              <div key={r.label} style={{ display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                                <span style={{ color:"#6a5a40",fontSize:11 }}>{r.label}</span>
                                <span style={{ color:r.color,fontSize:11,fontWeight:600 }}>{r.prefix}{fmt(r.value)}</span>
                              </div>
                            ))}
                            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,paddingTop:8,borderTop:"1px solid rgba(62,207,110,0.25)" }}>
                              <div>
                                <div style={{ color:"#3ecf6e",fontSize:12,fontWeight:800 }}>✓ Thực nhận</div>
                                <div style={{ color:"#6a5a40",fontSize:8,marginTop:1 }}>Tài xế trả khi lấy hàng</div>
                              </div>
                              <div style={{ color:"#3ecf6e",fontSize:16,fontWeight:800 }}>{fmt(net)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Top items */}
              {topItems.length > 0 && (
                <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,overflow:"hidden",marginBottom:12 }}>
                  <div style={{ padding:"12px 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:700 }}>🏆 Món bán chạy nhất</div>
                  </div>
                  {topItems.map((item, i) => {
                    const commission = Math.round(item.subtotal * commRate)
                    const net = item.subtotal - commission
                    return (
                      <div key={item.name} style={{ padding:"10px 14px",borderBottom:i<topItems.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                            <span style={{ fontSize:13 }}>{["🥇","🥈","🥉"][i] || `${i+1}.`}</span>
                            <span style={{ color:"#f8f0e0",fontSize:10.5,fontWeight:600 }}>{item.name}</span>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ color:"#3ecf6e",fontSize:11,fontWeight:700 }}>{fmt(net)}</div>
                            <div style={{ color:"#6a5a40",fontSize:8 }}>thực nhận</div>
                          </div>
                        </div>
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <div style={{ flex:1,height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden" }}>
                            <div style={{ width:`${item.pct}%`,height:"100%",borderRadius:2,background:"linear-gradient(90deg,#FF6B00,#FFB347)" }} />
                          </div>
                          <span style={{ color:"#6a5a40",fontSize:8,flexShrink:0 }}>{item.qty} suất · −{fmt(commission)} hoa hồng</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Tổng kết */}
              {totalSubtotal > 0 && (
                <div style={{ background:"rgba(62,207,110,0.05)",border:"1px solid rgba(62,207,110,0.2)",borderRadius:14,overflow:"hidden" }}>
                  <div style={{ padding:"12px 14px 10px",borderBottom:"1px solid rgba(62,207,110,0.12)" }}>
                    <div style={{ color:"#3ecf6e",fontSize:11,fontWeight:700 }}>💵 Tổng thu nhập thực tế</div>
                  </div>
                  <div style={{ padding:"0 14px" }}>
                    {[
                      { label:"Tổng tiền hàng", value:totalSubtotal, color:"#f8f0e0", prefix:"" },
                      { label:`Hoa hồng Giao Nhanh (${Math.round(commRate*100)}%)`, value:totalCommission, color:"#ff4040", prefix:"−" },
                      { label:"Voucher giảm giá", value:totalVoucher, color:"#FFB347", prefix:"−" },
                    ].map(r => (
                      <div key={r.label} style={{ display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ color:"#6a5a40",fontSize:11 }}>{r.label}</span>
                        <span style={{ color:r.color,fontSize:11,fontWeight:700 }}>{r.prefix}{fmt(r.value)}</span>
                      </div>
                    ))}
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0" }}>
                      <div>
                        <div style={{ color:"#3ecf6e",fontSize:13,fontWeight:800 }}>✓ Thực nhận từ tài xế</div>
                        <div style={{ color:"#6a5a40",fontSize:9,marginTop:2 }}>Tài xế trả tiền mặt khi đến lấy từng đơn hàng</div>
                      </div>
                      <div style={{ color:"#3ecf6e",fontSize:20,fontWeight:800 }}>{fmt(totalNet)}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
