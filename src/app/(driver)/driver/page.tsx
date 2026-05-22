"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

const COUNTDOWN_SEC = 30

/* ── helpers ── */
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

const RING_R = 36
const RING_C = 2 * Math.PI * RING_R

/* ── mock incoming order ── */
const MOCK_ORDER = {
  id: "GN-8821",
  shopName: "Bún Bò Huế Ngon",
  shopAddress: "22 Lê Hồng Phong, Phước An",
  customerName: "Phạm Thị Lan",
  customerAddress: "15 Trần Hưng Đạo, Phước An",
  distanceToShop: 1.2,
  distanceToCustomer: 2.8,
  items: [
    { name: "Bún bò đặc biệt", qty: 2, price: 45000 },
    { name: "Trà đá",           qty: 2, price: 5000  },
  ],
  subtotal: 100000,
  deliveryFee: 18000,
  total: 118000,
  earnerFee: 14000,
  payMethod: "Tiền mặt",
}

/* ── sub-components ── */
function RadarRings() {
  return (
    <div style={{ position:"relative", width:160, height:160, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`
        @keyframes radarRing {
          0%   { transform:scale(.25); opacity:.8 }
          100% { transform:scale(1);   opacity:0   }
        }
      `}</style>
      {[0, 0.6, 1.2].map((delay, i) => (
        <div key={i} style={{
          position:"absolute", borderRadius:"50%",
          border:"1.5px solid rgba(255,107,0,0.5)",
          width:"100%", height:"100%",
          animation:`radarRing 2.4s ${delay}s infinite`,
        }} />
      ))}
      <div style={{
        width:52, height:52, borderRadius:"50%",
        background:"linear-gradient(135deg,rgba(255,107,0,0.25),rgba(255,140,0,0.1))",
        border:"2px solid rgba(255,107,0,0.55)",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"0 0 20px rgba(255,107,0,0.3)",
        fontSize:22,
      }}>🛵</div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon:string; label:string; value:string; color:string }) {
  return (
    <div style={{
      flex:1, padding:"10px 6px", borderRadius:14, textAlign:"center",
      background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{ fontSize:18, marginBottom:4 }}>{icon}</div>
      <div style={{ color, fontSize:14, fontWeight:800, lineHeight:1 }}>{value}</div>
      <div style={{ color:"#6a5a40", fontSize:9, marginTop:3 }}>{label}</div>
    </div>
  )
}

/* ── countdown ring ── */
function CountdownRing({ sec, total }: { sec:number; total:number }) {
  const pct = sec / total
  const offset = RING_C * (1 - pct)
  const color = pct > 0.5 ? "#3ecf6e" : pct > 0.25 ? "#FFB347" : "#ff4040"
  return (
    <svg width={88} height={88} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={44} cy={44} r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
      <circle cx={44} cy={44} r={RING_R} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={RING_C} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition:"stroke-dashoffset .95s linear, stroke .4s" }}
      />
      <text x={44} y={44} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={17} fontWeight={800}
        style={{ fontFamily:"Lexend,sans-serif", transform:"rotate(90deg)", transformOrigin:"44px 44px" }}>
        {sec}
      </text>
    </svg>
  )
}

/* ── order popup ── */
function OrderPopup({
  onAccept, onReject,
}: { onAccept:()=>void; onReject:()=>void }) {
  const [sec, setSec] = useState(COUNTDOWN_SEC)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSec(s => {
        if (s <= 1) { clearInterval(timerRef.current!); onReject(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [onReject])

  const o = MOCK_ORDER
  return (
    <motion.div
      initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
      transition={{ type:"spring", damping:26, stiffness:280 }}
      style={{
        position:"fixed", inset:0, top:0, zIndex:80,
        background:"rgba(8,8,6,0.7)", backdropFilter:"blur(6px)",
        display:"flex", flexDirection:"column", justifyContent:"flex-end",
      }}
      onClick={e => e.target === e.currentTarget && onReject()}
    >
      <div style={{
        background:"linear-gradient(180deg,#0e0b07,#080806)",
        borderTop:"1px solid rgba(255,107,0,0.35)",
        borderRadius:"24px 24px 0 0",
        padding:"0 0 env(safe-area-inset-bottom)",
        maxHeight:"90dvh", overflowY:"auto",
      }}>
        {/* ── alert strip ── */}
        <div style={{
          background:"linear-gradient(90deg,rgba(255,107,0,0.18),rgba(255,140,0,0.1))",
          borderBottom:"1px solid rgba(255,107,0,0.2)",
          padding:"10px 18px",
          display:"flex", alignItems:"center", gap:10,
        }}>
          <motion.div
            animate={{ scale:[1,1.12,1] }} transition={{ repeat:Infinity, duration:.8 }}
            style={{ fontSize:20 }}>🔔</motion.div>
          <div style={{ flex:1 }}>
            <div style={{ color:"#FF8C00", fontSize:12, fontWeight:800 }}>ĐƠN MỚI! #{o.id}</div>
            <div style={{ color:"rgba(255,140,0,0.55)", fontSize:9 }}>Xác nhận trong {COUNTDOWN_SEC}s — tự động từ chối nếu bỏ qua</div>
          </div>
          <CountdownRing sec={sec} total={COUNTDOWN_SEC} />
        </div>

        <div style={{ padding:"14px 16px 0" }}>
          {/* ── route viz ── */}
          <div style={{
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14, padding:"12px 14px", marginBottom:12,
          }}>
            <div style={{ display:"flex", alignItems:"stretch", gap:10 }}>
              {/* left line */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:"#FF6B00", flexShrink:0 }} />
                <div style={{ flex:1, width:2, background:"rgba(255,107,0,0.25)", margin:"4px 0", minHeight:28 }} />
                <div style={{ width:10, height:10, borderRadius:"50%", background:"#3ecf6e", flexShrink:0 }} />
              </div>
              {/* right text */}
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10 }}>
                <div>
                  <div style={{ color:"#FF8C00", fontSize:10, fontWeight:700 }}>🏪 {o.shopName}</div>
                  <div style={{ color:"#6a5a40", fontSize:9 }}>{o.shopAddress}</div>
                </div>
                <div>
                  <div style={{ color:"#3ecf6e", fontSize:10, fontWeight:700 }}>📍 {o.customerName}</div>
                  <div style={{ color:"#6a5a40", fontSize:9 }}>{o.customerAddress}</div>
                </div>
              </div>
              {/* distances */}
              <div style={{ display:"flex", flexDirection:"column", justifyContent:"space-between", alignItems:"flex-end" }}>
                <span style={{ color:"#b0956a", fontSize:9, fontWeight:600 }}>{o.distanceToShop}km</span>
                <span style={{ color:"#b0956a", fontSize:9, fontWeight:600 }}>{o.distanceToCustomer}km</span>
              </div>
            </div>
            {/* total distance badge */}
            <div style={{
              marginTop:8, background:"rgba(255,107,0,0.08)", borderRadius:8,
              padding:"4px 10px", display:"inline-flex", alignItems:"center", gap:6,
            }}>
              <span style={{ fontSize:9 }}>🗺</span>
              <span style={{ color:"#FF8C00", fontSize:9, fontWeight:700 }}>
                Tổng quãng đường: {(o.distanceToShop + o.distanceToCustomer).toFixed(1)}km
              </span>
            </div>
          </div>

          {/* ── items ── */}
          <div style={{
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14, padding:"10px 14px", marginBottom:12,
          }}>
            <div style={{ color:"#b0956a", fontSize:9, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:".5px" }}>Đơn hàng</div>
            {o.items.map((it, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: i < o.items.length-1 ? 6 : 0 }}>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <span style={{ color:"#6a5a40", fontSize:9 }}>×{it.qty}</span>
                  <span style={{ color:"#f8f0e0", fontSize:11 }}>{it.name}</span>
                </div>
                <span style={{ color:"#b0956a", fontSize:10, fontWeight:600 }}>{fmt(it.price * it.qty)}</span>
              </div>
            ))}
          </div>

          {/* ── fare summary ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
            {[
              { label:"Khách trả",   value: fmt(o.total),       color:"#f8f0e0", bg:"rgba(255,255,255,0.04)" },
              { label:"Tiền công",   value: fmt(o.earnerFee),   color:"#3ecf6e", bg:"rgba(62,207,110,0.08)"  },
              { label:"Thanh toán",  value: o.payMethod,         color:"#4a8ff5", bg:"rgba(74,143,245,0.08)"  },
            ].map(c => (
              <div key={c.label} style={{
                background:c.bg, border:"1px solid rgba(255,255,255,0.06)",
                borderRadius:12, padding:"10px 8px", textAlign:"center",
              }}>
                <div style={{ color:c.color, fontSize:11, fontWeight:800 }}>{c.value}</div>
                <div style={{ color:"#6a5a40", fontSize:8, marginTop:2 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* ── buttons ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:10, paddingBottom:12 }}>
            <button onClick={onReject}
              style={{
                height:50, borderRadius:14, border:"1px solid rgba(255,255,255,0.1)",
                background:"rgba(255,255,255,0.06)", color:"#b0956a",
                fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Lexend",
              }}>
              Từ chối
            </button>
            <motion.button whileTap={{ scale:.96 }} onClick={onAccept}
              style={{
                height:50, borderRadius:14, border:"none", overflow:"hidden",
                background:"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
                color:"#fff", fontSize:13, fontWeight:800,
                cursor:"pointer", fontFamily:"Lexend", position:"relative",
                boxShadow:"0 4px 18px rgba(255,107,0,0.45)",
              }}>
              <span style={{
                position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)",
                animation:"shimmer 2s infinite",
              }} />
              <span style={{ position:"relative", zIndex:1 }}>✓ Nhận đơn</span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ── main page ── */
export default function DriverDashboard() {
  const [online, setOnline]       = useState(false)
  const [showOrder, setShowOrder] = useState(false)
  const [accepted, setAccepted]   = useState<string | null>(null)
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* demo: trigger popup 2s after going online */
  useEffect(() => {
    if (online && !accepted) {
      demoTimer.current = setTimeout(() => setShowOrder(true), 2000)
    } else {
      clearTimeout(demoTimer.current!)
      if (!online) setShowOrder(false)
    }
    return () => clearTimeout(demoTimer.current!)
  }, [online, accepted])

  const handleAccept = () => {
    setShowOrder(false)
    setAccepted(MOCK_ORDER.id)
    // TODO: navigate to /driver/navigate/[orderId] + update DB
  }
  const handleReject = () => {
    setShowOrder(false)
    // TODO: record rejection in DB
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{display:none}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
        @keyframes radarRing{0%{transform:scale(.25);opacity:.8}100%{transform:scale(1);opacity:0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
      `}</style>

      <div style={{ minHeight:"100dvh", background:"#080806", paddingBottom:80 }}>

        {/* ── header ── */}
        <div style={{
          position:"sticky", top:0, zIndex:40,
          background:"rgba(8,8,6,0.95)", backdropFilter:"blur(20px)",
          borderBottom:"1px solid rgba(255,107,0,0.08)",
          padding:"0 16px", height:56,
          display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:38, height:38, borderRadius:12,
              background:"rgba(255,107,0,0.12)", border:"1px solid rgba(255,107,0,0.25)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
            }}>🛵</div>
            <div>
              <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:800 }}>Phạm Hồng Mỹ</div>
              <div style={{ color:"#6a5a40", fontSize:9 }}>Tài xế · Giao Nhanh</div>
            </div>
          </div>

          <motion.button whileTap={{ scale:.93 }} onClick={() => setOnline(v => !v)}
            style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"7px 14px", borderRadius:20, fontFamily:"Lexend",
              background: online ? "rgba(62,207,110,0.12)" : "rgba(255,255,255,0.07)",
              border: online ? "1px solid rgba(62,207,110,0.4)" : "1px solid rgba(255,255,255,0.12)",
              color: online ? "#3ecf6e" : "#6a5a40",
              fontSize:11, fontWeight:700, cursor:"pointer",
            }}>
            <div style={{
              width:7, height:7, borderRadius:"50%",
              background: online ? "#3ecf6e" : "#6a5a40",
              boxShadow: online ? "0 0 6px #3ecf6e" : "none",
              animation: online ? "pulse 1.5s infinite" : "none",
            }} />
            {online ? "Đang hoạt động" : "Ngoại tuyến"}
          </motion.button>
        </div>

        <div style={{ padding:"0 16px" }}>

          {/* ── map / radar area ── */}
          <div style={{
            margin:"12px 0", borderRadius:20, overflow:"hidden",
            background:"linear-gradient(135deg,#0d0a06,#13100a,#0a0804)",
            border:"1px solid rgba(255,107,0,0.12)",
            height:240, position:"relative",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <AnimatePresence mode="wait">
              {online ? (
                <motion.div key="radar"
                  initial={{ opacity:0, scale:.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                  style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
                  <RadarRings />
                  <div style={{ textAlign:"center" }}>
                    <div style={{ color:"#FF8C00", fontSize:12, fontWeight:700 }}>Đang tìm đơn gần bạn...</div>
                    <div style={{ color:"#6a5a40", fontSize:9, marginTop:3 }}>Phước An, Krông Pắc</div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="offline"
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  style={{ textAlign:"center" }}>
                  <div style={{ fontSize:44, marginBottom:10, opacity:.4 }}>😴</div>
                  <div style={{ color:"#b0956a", fontSize:13, fontWeight:700 }}>Bạn đang ngoại tuyến</div>
                  <div style={{ color:"#6a5a40", fontSize:10, marginTop:4 }}>Bật trạng thái để bắt đầu nhận đơn</div>
                  <motion.button whileTap={{ scale:.95 }}
                    onClick={() => setOnline(true)}
                    style={{
                      marginTop:14, padding:"9px 22px", borderRadius:20, border:"none",
                      background:"linear-gradient(90deg,#FF6B00,#FF8C00)",
                      color:"#fff", fontSize:11, fontWeight:700,
                      cursor:"pointer", fontFamily:"Lexend",
                      boxShadow:"0 4px 14px rgba(255,107,0,0.35)",
                    }}>
                    ⚡ Bắt đầu ca làm
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* location badge */}
            <div style={{
              position:"absolute", bottom:10, left:10,
              background:"rgba(8,8,6,0.75)", backdropFilter:"blur(8px)",
              border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:8, padding:"4px 10px",
              display:"flex", alignItems:"center", gap:5,
            }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:online?"#3ecf6e":"#6a5a40" }} />
              <span style={{ color:"#b0956a", fontSize:9 }}>Phước An · Krông Pắc</span>
            </div>
          </div>

          {/* ── accepted order banner ── */}
          <AnimatePresence>
            {accepted && (
              <motion.a href={`/driver/navigate/GN-8821`}
                initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                style={{
                  display:"flex", alignItems:"center", gap:10,
                  background:"rgba(62,207,110,0.1)", border:"1px solid rgba(62,207,110,0.3)",
                  borderRadius:14, padding:"12px 14px", marginBottom:12,
                  textDecoration:"none",
                }}>
                <div style={{ fontSize:22 }}>🚀</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:"#3ecf6e", fontSize:12, fontWeight:800 }}>Đang giao #{accepted}</div>
                  <div style={{ color:"#6a5a40", fontSize:9 }}>Nhấn để xem chi tiết lộ trình</div>
                </div>
                <div style={{ color:"#3ecf6e", fontSize:16 }}>›</div>
              </motion.a>
            )}
          </AnimatePresence>

          {/* ── today stats ── */}
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <StatCard icon="📦" label="Đơn hôm nay" value="12"    color="#FF8C00" />
            <StatCard icon="💰" label="Thu nhập"    value="245k"  color="#3ecf6e" />
            <StatCard icon="🗺" label="Quãng đường" value="38km"  color="#4a8ff5" />
            <StatCard icon="⭐" label="Đánh giá"    value="4.9"   color="#FFB347" />
          </div>

          {/* ── quick links ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
            {[
              { href:"/driver/earnings", icon:"📊", label:"Thu nhập chi tiết", sub:"Xem báo cáo tuần/tháng", color:"#3ecf6e" },
              { href:"/driver/reviews",  icon:"⭐", label:"Đánh giá của tôi",  sub:"Xem nhận xét từ khách",   color:"#f5c542" },
              { href:"/driver/profile",  icon:"👤", label:"Hồ sơ & giấy tờ",  sub:"Cập nhật thông tin xe",   color:"#4a8ff5" },
            ].map(l => (
              <a key={l.href} href={l.href} style={{ textDecoration:"none" }}>
                <div style={{
                  background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)",
                  borderRadius:14, padding:"12px 12px",
                }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{l.icon}</div>
                  <div style={{ color:"#f8f0e0", fontSize:11, fontWeight:700 }}>{l.label}</div>
                  <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>{l.sub}</div>
                </div>
              </a>
            ))}
          </div>

          {/* ── tips card ── */}
          <div style={{
            background:"rgba(255,107,0,0.06)", border:"1px dashed rgba(255,107,0,0.2)",
            borderRadius:14, padding:"12px 14px", display:"flex", gap:10, alignItems:"flex-start",
          }}>
            <div style={{ fontSize:20, flexShrink:0 }}>💡</div>
            <div>
              <div style={{ color:"#FF8C00", fontSize:11, fontWeight:700, marginBottom:2 }}>Mẹo hôm nay</div>
              <div style={{ color:"#b0956a", fontSize:9, lineHeight:1.5 }}>
                Giờ cao điểm 11h–13h và 17h–19h thường có nhiều đơn nhất. Hãy bật trạng thái đúng giờ để nhận nhiều đơn hơn!
              </div>
            </div>
          </div>
        </div>

        {/* ── bottom nav ── */}
        <nav style={{
          position:"fixed", bottom:12, left:14, right:14, height:56,
          borderRadius:9999, zIndex:50,
          background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)",
          boxShadow:"0 0 20px rgba(255,107,0,0.1)",
          display:"flex", alignItems:"center", justifyContent:"space-around",
          padding:"0 8px",
        }}>
          {[
            { href:"/driver",          icon:"🏠", label:"Trang chủ", active:true  },
            { href:"/driver/earnings", icon:"📊", label:"Thu nhập",  active:false },
            { href:"/driver/profile",  icon:"👤", label:"Hồ sơ",     active:false },
          ].map(tab => (
            <a key={tab.href} href={tab.href} style={{
              display:"flex", flexDirection:"column", alignItems:"center", gap:2,
              textDecoration:"none", padding:"6px 16px", borderRadius:20,
              background: tab.active ? "rgba(255,107,0,0.1)" : "transparent",
              transition:"background .2s",
            }}>
              <span style={{ fontSize:17, transform: tab.active ? "translateY(-1px)" : "none", transition:"transform .2s" }}>{tab.icon}</span>
              <span style={{ fontSize:8, fontWeight:700, color: tab.active ? "#FF8C00" : "#6a5a40" }}>{tab.label}</span>
              {tab.active && (
                <div style={{
                  position:"absolute", bottom:-1, width:28, height:3,
                  background:"radial-gradient(ellipse,rgba(255,107,0,0.9) 0%,transparent 70%)",
                  filter:"blur(1px)",
                }} />
              )}
            </a>
          ))}
        </nav>
      </div>

      {/* ── incoming order popup ── */}
      <AnimatePresence>
        {showOrder && (
          <OrderPopup onAccept={handleAccept} onReject={handleReject} />
        )}
      </AnimatePresence>
    </>
  )
}
