"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { usePushNotification } from "@/hooks/usePushNotification"
import { useOrderSound } from "@/hooks/useOrderSound"
import { useDriverLocation } from "@/hooks/useDriverLocation"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()
const COUNTDOWN_SEC = 30

/* ── helpers ── */
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

const RING_R = 36
const RING_C = 2 * Math.PI * RING_R

interface OrderData {
  id:                  string
  fullId:              string
  orderTable:          "orders" | "errands"
  shopName:            string
  shopAddress:         string
  customerName:        string
  customerAddress:     string
  distanceToShop:      number  // -1 = chưa có tọa độ
  distanceToCustomer:  number  // -1 = chưa có tọa độ
  items:               { name: string; qty: number; price: number }[]
  subtotal:            number
  deliveryFee:         number
  total:               number
  earnerFee:           number
  payMethod:           string
  // Errand-specific
  packagePhotoUrl?: string
  senderName?:      string
  senderPhone?:     string
  recipientName?:   string
  recipientPhone?:  string
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
  order, onAccept, onReject,
}: { order: OrderData; onAccept:()=>void; onReject:()=>void }) {
  const [sec, setSec] = useState(COUNTDOWN_SEC)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSec(s => {
        if (s <= 1) { clearInterval(timerRef.current!); onReject(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [onReject])

  // Phát âm thanh lặp liên tục suốt countdown — dừng khi đóng popup
  useEffect(() => {
    const audio = new Audio("/sounds/ban_oi_co_don.mp3")
    audio.loop = true
    audio.volume = 0.85
    audioRef.current = audio
    audio.play().catch(() => null)
    return () => { audio.pause(); audio.currentTime = 0 }
  }, [])

  const o = order
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
                <span style={{ color:"#b0956a", fontSize:9, fontWeight:600 }}>
                  {o.distanceToShop >= 0 ? `${o.distanceToShop.toFixed(1)}km` : "—"}
                </span>
                <span style={{ color:"#b0956a", fontSize:9, fontWeight:600 }}>
                  {o.distanceToCustomer >= 0 ? `${o.distanceToCustomer.toFixed(1)}km` : "—"}
                </span>
              </div>
            </div>
            {/* total distance badge */}
            {o.distanceToShop >= 0 && o.distanceToCustomer >= 0 && (
              <div style={{
                marginTop:8, background:"rgba(255,107,0,0.08)", borderRadius:8,
                padding:"4px 10px", display:"inline-flex", alignItems:"center", gap:6,
              }}>
                <span style={{ fontSize:9 }}>🗺</span>
                <span style={{ color:"#FF8C00", fontSize:9, fontWeight:700 }}>
                  Tổng quãng đường: {(o.distanceToShop + o.distanceToCustomer).toFixed(1)}km
                </span>
              </div>
            )}
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

          {/* ── Ảnh gói hàng (errand) ── */}
          {o.packagePhotoUrl && (
            <div style={{
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:14, overflow:"hidden", marginBottom:12,
            }}>
              <div style={{ padding:"8px 14px 6px", color:"#b0956a", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px" }}>
                📷 Ảnh gói hàng — nhận dạng khi lấy
              </div>
              <img src={o.packagePhotoUrl} alt="Gói hàng"
                style={{ width:"100%", maxHeight:200, objectFit:"cover", display:"block" }} />
            </div>
          )}

          {/* ── Thông tin người gửi / nhận (errand) ── */}
          {(o.senderName || o.recipientName) && (
            <div style={{
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:14, padding:"10px 14px", marginBottom:12,
            }}>
              <div style={{ color:"#b0956a", fontSize:9, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:".5px" }}>
                Thông tin giao nhận
              </div>
              {o.senderName && (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div>
                    <div style={{ color:"#6a5a40", fontSize:8 }}>👤 Người gửi</div>
                    <div style={{ color:"#f8f0e0", fontSize:11, fontWeight:600, marginTop:1 }}>{o.senderName}</div>
                  </div>
                  {o.senderPhone && (
                    <a href={`tel:${o.senderPhone}`}
                      style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(74,143,245,0.1)",
                        border:"1px solid rgba(74,143,245,0.25)", borderRadius:8, padding:"5px 10px",
                        textDecoration:"none", color:"#4a8ff5", fontSize:10, fontWeight:600 }}>
                      📞 {o.senderPhone}
                    </a>
                  )}
                </div>
              )}
              {o.senderName && o.recipientName && (
                <div style={{ height:1, background:"rgba(255,255,255,0.05)", margin:"6px 0" }} />
              )}
              {o.recipientName && (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ color:"#6a5a40", fontSize:8 }}>📬 Người nhận</div>
                    <div style={{ color:"#f8f0e0", fontSize:11, fontWeight:600, marginTop:1 }}>{o.recipientName}</div>
                  </div>
                  {o.recipientPhone && (
                    <a href={`tel:${o.recipientPhone}`}
                      style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(62,207,110,0.1)",
                        border:"1px solid rgba(62,207,110,0.25)", borderRadius:8, padding:"5px 10px",
                        textDecoration:"none", color:"#3ecf6e", fontSize:10, fontWeight:600 }}>
                      📞 {o.recipientPhone}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── fare summary ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
            {[
              { label:"Khách trả",      value: fmt(o.total),       color:"#f8f0e0", bg:"rgba(255,255,255,0.04)" },
              { label:"Tiền công (~)", value: fmt(o.earnerFee),   color:"#3ecf6e", bg:"rgba(62,207,110,0.08)"  },
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

/* ── setup gate ── */
function SetupGate({
  status, walletBalance, onClose, onTopup,
}: {
  status: { bankLinked: boolean; vehicleDocs: boolean; depositDone: boolean }
  walletBalance: number
  onClose: () => void
  onTopup: () => void
}) {
  const profileItems = [
    { done: status.bankLinked,  icon: "🏦", label: "Tài khoản ngân hàng",  sub: status.bankLinked  ? "Đã liên kết" : "Chưa liên kết tài khoản nhận tiền" },
    { done: status.vehicleDocs, icon: "🛵", label: "Thông tin phương tiện", sub: status.vehicleDocs ? "Đã cập nhật" : "Cần cập nhật biển số và loại xe"   },
  ]
  const allDone = status.bankLinked && status.vehicleDocs && status.depositDone

  function ItemRow({ done, icon, label, sub, onClick }: { done: boolean; icon: string; label: string; sub: string; onClick: () => void }) {
    return (
      <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14, cursor:"pointer", background: done ? "rgba(62,207,110,0.06)" : "rgba(255,255,255,0.04)", border:`1px solid ${done ? "rgba(62,207,110,0.2)" : "rgba(255,255,255,0.08)"}` }}>
        <div style={{ width:40, height:40, borderRadius:12, background: done ? "rgba(62,207,110,0.12)" : "rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{icon}</div>
        <div style={{ flex:1 }}>
          <div style={{ color:"#f8f0e0", fontSize:12, fontWeight:700 }}>{label}</div>
          <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>{sub}</div>
        </div>
        {done ? <span style={{ color:"#3ecf6e", fontSize:18 }}>✓</span> : <span style={{ color:"#FF8C00", fontSize:14 }}>›</span>}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(8,8,6,0.85)", backdropFilter:"blur(8px)", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background:"linear-gradient(180deg,#0e0b07,#080806)", borderTop:"1px solid rgba(255,107,0,0.35)", borderRadius:"24px 24px 0 0", padding:"20px 20px calc(env(safe-area-inset-bottom) + 20px)" }}>
        <div style={{ display:"flex", alignItems:"center", marginBottom:4 }}>
          <div style={{ flex:1 }}>
            <div style={{ color:"#FF8C00", fontSize:15, fontWeight:800 }}>⚠️ Hoàn thành hồ sơ tài xế</div>
            <div style={{ color:"#6a5a40", fontSize:10, marginTop:2 }}>Cần hoàn thành các bước sau để bắt đầu nhận đơn</div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"none", color:"#6a5a40", fontSize:16, cursor:"pointer" }}>×</button>
        </div>
        <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:10 }}>
          {/* Ngân hàng + phương tiện → vào profile */}
          {profileItems.map((item) => (
            <ItemRow key={item.label} {...item} onClick={() => { window.location.href = "/driver/profile" }} />
          ))}
          {/* Nạp tiền → mở TopupSheet */}
          <ItemRow
            done={status.depositDone}
            icon="💳"
            label="Nạp tiền vào ví (tối thiểu 200,000đ)"
            sub={`Số dư hiện tại: ${walletBalance.toLocaleString("vi-VN")}đ`}
            onClick={() => { onClose(); onTopup() }}
          />
        </div>
        {!allDone && (
          <div style={{ marginTop:14, padding:"10px 14px", borderRadius:12, background:"rgba(255,107,0,0.06)", border:"1px dashed rgba(255,107,0,0.2)", display:"flex", gap:10, alignItems:"flex-start" }}>
            <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
            <span style={{ color:"#b0956a", fontSize:9, lineHeight:1.5 }}>Hoàn thành hồ sơ để bắt đầu nhận đơn và kiếm thu nhập.</span>
          </div>
        )}
        <button
          onClick={allDone ? onClose : () => { window.location.href = "/driver/profile" }}
          style={{
            width:"100%", marginTop:16, height:50, borderRadius:14, border:"none",
            background: allDone ? "linear-gradient(90deg,#3ecf6e,#2db55d)" : "linear-gradient(90deg,#FF6B00,#FF8C00)",
            color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"Lexend",
            boxShadow: allDone ? "0 4px 16px rgba(62,207,110,0.3)" : "0 4px 16px rgba(255,107,0,0.35)",
          }}>
          {allDone ? "✓ Bắt đầu nhận đơn" : "📋 Cập nhật hồ sơ →"}
        </button>
      </div>
    </motion.div>
  )
}

/* ── topup sheet ── */
const PRESET_AMOUNTS = [50000, 100000, 200000, 500000]

// Map BIN → tên ngân hàng (dùng để hiện tên thay vì "Xem trong app")
const BIN_MAP: Record<string, string> = {
  "970436":"Vietcombank","970407":"Techcombank","970422":"MB Bank",
  "970418":"BIDV","970432":"VPBank","970405":"Agribank","970416":"ACB",
  "970415":"VietinBank","970423":"TPBank","970437":"HDBank",
  "970403":"Sacombank","970431":"Eximbank","970426":"MSB","970429":"SHB",
  "970441":"VIB","970440":"SeABank","970425":"ABBank","970428":"NamABank",
  "970454":"BVBank","422589":"BVBank","796500":"Cake by VPBank",
}

interface PayInfo {
  bin: string
  accountNumber: string
  accountName: string
  bankName: string
  qrCode: string
  description: string
}

function TopupSheet({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [amount,    setAmount]    = useState(200000)
  const [custom,    setCustom]    = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [step,      setStep]      = useState<"pick"|"pay">("pick")
  const [payInfo,   setPayInfo]   = useState<PayInfo | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [err,       setErr]       = useState("")
  const [paid,      setPaid]      = useState(false)
  const [copied,    setCopied]    = useState<string | null>(null)
  const [showQR,    setShowQR]    = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const payCodeRef  = useRef<number>(0)

  const finalAmount = useCustom ? (parseInt(custom.replace(/\D/g, "")) || 0) : amount

  // VietQR image URL từ thông tin ngân hàng nền tảng (bin + STK + tên)
  const vietQrUrl = payInfo
    ? `https://img.vietqr.io/image/${payInfo.bin}-${payInfo.accountNumber}-compact2.png` +
      `?amount=${finalAmount}&addInfo=${encodeURIComponent(payInfo.description)}&accountName=${encodeURIComponent(payInfo.accountName)}`
    : ""

  async function createQR() {
    if (finalAmount < 10000) return setErr("Số tiền tối thiểu 10,000đ")
    setLoading(true); setErr("")
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Chưa đăng nhập")

      const payCode = Math.floor(10000000 + Math.random() * 90000000)
      payCodeRef.current = payCode

      // Lấy tên tài xế, strip dấu cho tương thích hệ thống ngân hàng
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).single()
      const rawName = profile?.full_name ?? "Tai xe"
      const asciiName = rawName
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .replace(/[^a-zA-Z0-9 ]/g, "").trim()
      const desc = `NAP VI ${asciiName}`.slice(0, 25)

      const { error: dbErr } = await supabase.from("wallet_topups").insert({
        user_id: user.id, wallet_type: "driver",
        payment_code: payCode, amount: finalAmount, status: "pending",
      })
      if (dbErr) throw new Error(dbErr.message)

      const res = await fetch("/api/payment/payos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: payCode, amount: finalAmount,
          description: desc,
          returnUrl: `${window.location.origin}/driver`,
          cancelUrl: `${window.location.origin}/driver`,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        // Cleanup record pending nếu PayOS fail
        await supabase.from("wallet_topups").delete().eq("payment_code", payCode)
        throw new Error(json.error ?? "Không thể kết nối cổng thanh toán")
      }

      setPayInfo({
        bin:           json.bin ?? "",
        accountNumber: json.accountNumber ?? "",
        accountName:   json.accountName ?? "",
        bankName:      json.bankName ?? "",
        qrCode:        json.qrCode ?? "",
        description:   desc,
      })
      setStep("pay")

      // Polling mỗi 5s, tối đa 60 lần (5 phút) — tránh interval vô hạn
      let retries = 0
      intervalRef.current = setInterval(async () => {
        retries++
        if (retries > 60) {
          clearInterval(intervalRef.current!)
          setErr("Hết thời gian chờ. Nếu đã chuyển khoản, ví sẽ được cộng tự động trong vài phút.")
          return
        }
        const { data: topup } = await supabase
          .from("wallet_topups").select("status")
          .eq("payment_code", payCode).single()
        if (topup?.status === "paid") {
          clearInterval(intervalRef.current!)
          setPaid(true)
          setTimeout(() => onSuccess(), 1500)
        }
      }, 5000)
    } catch (e) {
      setErr((e as Error).message || "Lỗi không xác định, thử lại sau")
    } finally {
      setLoading(false)
    }
  }

  // Tên ngân hàng nền tảng từ BIN (PayOS trả về bankName thường rỗng)
  const platformBank = payInfo
    ? (payInfo.bankName || BIN_MAP[payInfo.bin] || "Ngân hàng thụ hưởng")
    : ""

  // Clipboard format chuẩn — BIDV/MB/VCB tự nhận diện và điền vào Chuyển tiền
  function getClipboardText() {
    if (!payInfo) return ""
    return [
      `Ngân hàng: ${platformBank}`,
      `Số tài khoản: ${payInfo.accountNumber}`,
      `Tên tài khoản: ${payInfo.accountName}`,
      `Số tiền: ${finalAmount.toLocaleString("vi-VN")}`,
      `Nội dung: ${payInfo.description}`,
    ].join("\n")
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  // Mở VietQR deeplink — chuẩn quốc gia, 80% banking app VN hỗ trợ
  // Đồng thời copy clipboard format chuẩn để app tự điền (BIDV, MB, VCB...)
  function openVietQR() {
    if (!payInfo) return
    const clipText = getClipboardText()
    navigator.clipboard?.writeText(clipText).then(() => {
      setCopied("open")
      setTimeout(() => setCopied(null), 4000)
    })
    setTimeout(() => {
      const deeplink = `vietqr://pay?ba=${payInfo.accountNumber}@${payInfo.bin}` +
        `&am=${finalAmount}&tn=${encodeURIComponent(payInfo.description)}`
      window.location.href = deeplink
    }, 150)
  }

  function goBack() {
    setStep("pick")
    setPayInfo(null)
    setPaid(false)
    setShowQR(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position:"fixed", inset:0, zIndex:101, background:"rgba(8,8,6,0.9)", backdropFilter:"blur(8px)", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background:"linear-gradient(180deg,#0e0b07,#080806)", borderTop:"1px solid rgba(62,207,110,0.3)", borderRadius:"24px 24px 0 0", maxHeight:"92dvh", overflowY:"auto", padding:"20px 20px calc(env(safe-area-inset-bottom) + 24px)" }}>

        {/* header */}
        <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
          <div style={{ flex:1 }}>
            <div style={{ color:"#3ecf6e", fontSize:15, fontWeight:800 }}>💳 Nạp tiền vào ví</div>
            <div style={{ color:"#6a5a40", fontSize:10, marginTop:2 }}>
              {step === "pick" ? "Chọn số tiền muốn nạp" : "Quét QR hoặc mở app ngân hàng"}
            </div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"none", color:"#6a5a40", fontSize:16, cursor:"pointer" }}>×</button>
        </div>

        {/* ── STEP 1: chọn số tiền ── */}
        {step === "pick" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
              {PRESET_AMOUNTS.map(a => (
                <button key={a} onClick={() => { setAmount(a); setUseCustom(false) }}
                  style={{ padding:"12px 0", borderRadius:12, border:`1px solid ${!useCustom && amount===a ? "rgba(62,207,110,0.6)" : "rgba(255,255,255,0.08)"}`, background: !useCustom && amount===a ? "rgba(62,207,110,0.1)" : "rgba(255,255,255,0.04)", color: !useCustom && amount===a ? "#3ecf6e" : "#f8f0e0", fontSize:13, fontWeight:!useCustom && amount===a ? 800 : 500, cursor:"pointer", fontFamily:"Lexend" }}>
                  {(a/1000).toFixed(0)}k
                </button>
              ))}
            </div>
            <input type="tel" placeholder="Hoặc nhập số tiền khác..." value={custom}
              onFocus={() => setUseCustom(true)}
              onChange={e => { setUseCustom(true); setCustom(e.target.value) }}
              style={{ width:"100%", boxSizing:"border-box", height:44, padding:"0 14px", borderRadius:12, border:`1px solid ${useCustom ? "rgba(62,207,110,0.4)" : "rgba(255,255,255,0.08)"}`, background:"rgba(255,255,255,0.04)", color:"#f8f0e0", fontSize:13, fontFamily:"Lexend", outline:"none", marginBottom:6 }}
            />
            {useCustom && finalAmount > 0 && (
              <div style={{ color:"#6a5a40", fontSize:9, marginBottom:12, paddingLeft:4 }}>= {finalAmount.toLocaleString("vi-VN")}đ</div>
            )}
            {err && <div style={{ color:"#ff4040", fontSize:10, marginBottom:10, textAlign:"center" }}>{err}</div>}
            <button onClick={createQR} disabled={loading || finalAmount < 10000}
              style={{ width:"100%", height:50, borderRadius:14, border:"none", background:"linear-gradient(90deg,#3ecf6e,#2db55d)", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"Lexend", opacity: loading || finalAmount < 10000 ? 0.5 : 1, marginTop:4 }}>
              {loading ? "Đang tạo QR..." : `Tạo mã QR · ${finalAmount >= 10000 ? finalAmount.toLocaleString("vi-VN") + "đ" : "chọn số tiền"}`}
            </button>
          </>
        )}

        {/* ── STEP 2: thông tin CK + mở app ── */}
        {step === "pay" && !paid && payInfo && (
          <>
            {/* Số tiền nổi bật */}
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ color:"#3ecf6e", fontSize:28, fontWeight:800 }}>{finalAmount.toLocaleString("vi-VN")}đ</div>
              <div style={{ color:"#6a5a40", fontSize:10, marginTop:2 }}>Chuyển khoản đến tài khoản bên dưới</div>
            </div>

            {/* Thông tin CK — từng dòng có nút copy */}
            <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, overflow:"hidden", marginBottom:14 }}>
              {[
                { label:"Số tài khoản", value: payInfo.accountNumber,                     key:"stk",   big: true },
                { label:"Ngân hàng",    value: platformBank,                               key:"bank",  big: false },
                { label:"Chủ TK",       value: payInfo.accountName,                        key:"name",  big: false },
                { label:"Nội dung CK",  value: payInfo.description,                        key:"desc",  big: false },
                { label:"Số tiền",      value: finalAmount.toLocaleString("vi-VN") + "đ", key:"amt",   big: true },
              ].map((row, i, arr) => (
                <div key={row.key} style={{ display:"flex", alignItems:"center", padding:"10px 14px", borderBottom: i < arr.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ color:"#6a5a40", fontSize:9 }}>{row.label}</div>
                    <div style={{ color: row.big ? "#3ecf6e" : "#f8f0e0", fontSize: row.big ? 14 : 12, fontWeight: row.big ? 800 : 500, marginTop:2 }}>{row.value}</div>
                  </div>
                  <button onClick={() => copy(row.value, row.key)}
                    style={{ flexShrink:0, padding:"4px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.1)", background: copied===row.key ? "rgba(62,207,110,0.12)" : "rgba(255,255,255,0.05)", color: copied===row.key ? "#3ecf6e" : "#6a5a40", fontSize:9, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
                    {copied===row.key ? "✓ Đã copy" : "Copy"}
                  </button>
                </div>
              ))}
            </div>

            {/* Mở app ngân hàng — VietQR universal deeplink */}
            <div style={{ background:"rgba(74,143,245,0.07)", border:"1px solid rgba(74,143,245,0.2)", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
              <div style={{ color:"#6a5a40", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>Mở app ngân hàng để chuyển khoản</div>
              <button onClick={openVietQR}
                style={{ width:"100%", height:48, borderRadius:12, border:"none", background:"linear-gradient(90deg,#4a8ff5,#3a7ae4)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", boxShadow:"0 4px 16px rgba(74,143,245,0.3)", marginBottom:10 }}>
                {copied==="open" ? "✓ Đã copy thông tin · Đang mở app..." : "🏦 Mở app ngân hàng · Chuyển khoản"}
              </button>
              <div style={{ color:"#6a5a40", fontSize:9, textAlign:"center", lineHeight:1.7 }}>
                Vào <b style={{color:"#b0956a"}}>Chuyển tiền</b> → App hỏi <b style={{color:"#b0956a"}}>&quot;Dán thông tin?&quot;</b> → <b style={{color:"#b0956a"}}>Có</b> → xác nhận bảo mật
              </div>
              <div style={{ color:"#4a8ff5", fontSize:8, textAlign:"center", marginTop:6, opacity:0.7 }}>
                BIDV · MB Bank · Vietcombank · VPBank và hầu hết ngân hàng VN
              </div>
            </div>

            {/* QR phụ — dùng điện thoại khác quét */}
            <button onClick={() => setShowQR(v => !v)}
              style={{ width:"100%", height:36, borderRadius:10, border:"1px solid rgba(255,255,255,0.07)", background:"transparent", color:"#6a5a40", fontSize:10, cursor:"pointer", fontFamily:"Lexend", marginBottom: showQR ? 10 : 14 }}>
              {showQR ? "▲ Ẩn mã QR" : "▼ Hiện mã QR (dùng máy khác quét)"}
            </button>
            {showQR && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:14 }}>
                <div style={{ background:"#fff", borderRadius:16, padding:12 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={vietQrUrl} alt="VietQR" width={180} height={180} style={{ display:"block", borderRadius:6 }}
                    onError={e => { (e.target as HTMLImageElement).style.display="none" }} />
                </div>
                <div style={{ color:"#6a5a40", fontSize:9, marginTop:8 }}>Quét bằng điện thoại khác để chuyển khoản</div>
              </div>
            )}

            {/* Trạng thái chờ */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, color:"#6a5a40", fontSize:10, marginBottom:14 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#3ecf6e", animation:"pulse 1.5s ease-in-out infinite" }} />
              Đang chờ xác nhận thanh toán tự động...
            </div>

            <button onClick={goBack}
              style={{ width:"100%", height:40, borderRadius:11, border:"1px solid rgba(255,255,255,0.07)", background:"transparent", color:"#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend" }}>
              ← Chọn lại số tiền
            </button>
          </>
        )}

        {/* ── PAID ── */}
        {paid && (
          <div style={{ textAlign:"center", padding:"24px 0" }}>
            <div style={{ fontSize:60, marginBottom:14 }}>🎉</div>
            <div style={{ color:"#3ecf6e", fontSize:20, fontWeight:800, marginBottom:6 }}>Nạp tiền thành công!</div>
            <div style={{ color:"#6a5a40", fontSize:12 }}>+{finalAmount.toLocaleString("vi-VN")}đ đã vào ví của bạn</div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ── withdraw sheet ── */
function WithdrawSheet({ onClose, walletBalance, onSuccess }: {
  onClose: () => void
  walletBalance: number
  onSuccess: () => void
}) {
  const supabase = createClient()
  const PRESETS = [100000, 200000, 500000, 1000000]
  const [amount,    setAmount]    = useState(200000)
  const [custom,    setCustom]    = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [err,       setErr]       = useState("")
  const [bankInfo,  setBankInfo]  = useState<{ bank_name: string; bank_account_number: string; bank_account_name: string } | null>(null)
  const submittingRef = useRef(false)

  const finalAmount = useCustom ? (parseInt(custom.replace(/\D/g, "")) || 0) : amount

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from("drivers")
        .select("bank_name, bank_account_number, bank_account_name")
        .eq("id", user.id).single()
        .then(({ data }) => { if (data?.bank_account_number) setBankInfo(data as { bank_name: string; bank_account_number: string; bank_account_name: string }) })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit() {
    if (submittingRef.current) return  // chống double-submit
    setErr("")
    if (finalAmount < 50000) return setErr("Số tiền tối thiểu 50,000đ")
    if (finalAmount > walletBalance) return setErr(`Số dư không đủ. Ví hiện có ${walletBalance.toLocaleString("vi-VN")}đ`)
    if (!bankInfo) return setErr("Bạn chưa liên kết tài khoản ngân hàng")
    submittingRef.current = true
    setLoading(true)
    try {
      const res = await fetch("/api/driver/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount }),
      })
      const json = await res.json()
      if (!res.ok) return setErr(json.error ?? "Không thể xử lý yêu cầu")
      setDone(true)
      setTimeout(onSuccess, 2000)
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      style={{ position:"fixed", inset:0, zIndex:101, background:"rgba(8,8,6,0.9)", backdropFilter:"blur(8px)", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background:"linear-gradient(180deg,#0e0b07,#080806)", borderTop:"1px solid rgba(255,107,0,0.3)", borderRadius:"24px 24px 0 0", maxHeight:"88dvh", overflowY:"auto", padding:"20px 20px calc(env(safe-area-inset-bottom) + 24px)" }}>

        {/* header */}
        <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
          <div style={{ flex:1 }}>
            <div style={{ color:"#FF8C00", fontSize:15, fontWeight:800 }}>💸 Rút tiền về ngân hàng</div>
            <div style={{ color:"#6a5a40", fontSize:10, marginTop:2 }}>Chuyển từ ví tài xế về tài khoản của bạn</div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"none", color:"#6a5a40", fontSize:16, cursor:"pointer" }}>×</button>
        </div>

        {done ? (
          <div style={{ textAlign:"center", padding:"24px 0" }}>
            <div style={{ fontSize:56, marginBottom:12 }}>✅</div>
            <div style={{ color:"#3ecf6e", fontSize:18, fontWeight:800, marginBottom:6 }}>Yêu cầu đã gửi!</div>
            <div style={{ color:"#6a5a40", fontSize:11, lineHeight:1.7 }}>
              Admin sẽ chuyển khoản trong vòng <b style={{color:"#b0956a"}}>24 giờ</b><br />
              đến tài khoản {bankInfo?.bank_name} của bạn.
            </div>
          </div>
        ) : (
          <>
            {/* balance */}
            <div style={{ background:"rgba(255,107,0,0.07)", border:"1px solid rgba(255,107,0,0.2)", borderRadius:14, padding:"12px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ color:"#6a5a40", fontSize:11 }}>Số dư ví hiện tại</span>
              <span style={{ color:"#FF8C00", fontSize:16, fontWeight:800 }}>{walletBalance.toLocaleString("vi-VN")}đ</span>
            </div>

            {/* bank info */}
            {bankInfo ? (
              <div style={{ background:"rgba(62,207,110,0.06)", border:"1px solid rgba(62,207,110,0.2)", borderRadius:14, padding:"12px 16px", marginBottom:16 }}>
                <div style={{ color:"#6a5a40", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>Tài khoản nhận tiền</div>
                <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:700 }}>{bankInfo.bank_name}</div>
                <div style={{ color:"#3ecf6e", fontSize:12, fontWeight:600, marginTop:2 }}>{bankInfo.bank_account_number}</div>
                <div style={{ color:"#6a5a40", fontSize:10, marginTop:2 }}>{bankInfo.bank_account_name}</div>
              </div>
            ) : (
              <div style={{ background:"rgba(255,64,64,0.07)", border:"1px solid rgba(255,64,64,0.2)", borderRadius:14, padding:"12px 16px", marginBottom:16, display:"flex", gap:10, alignItems:"center" }}>
                <span style={{ fontSize:20 }}>⚠️</span>
                <div>
                  <div style={{ color:"#ff4040", fontSize:11, fontWeight:700 }}>Chưa liên kết ngân hàng</div>
                  <div style={{ color:"#6a5a40", fontSize:9, marginTop:2 }}>Vào Hồ sơ → Tài khoản ngân hàng để thêm</div>
                </div>
              </div>
            )}

            {/* amount presets */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              {PRESETS.map(a => (
                <button key={a} onClick={() => { setAmount(a); setUseCustom(false) }}
                  style={{ padding:"11px 0", borderRadius:12, border:`1px solid ${!useCustom && amount===a ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.08)"}`, background:!useCustom && amount===a ? "rgba(255,107,0,0.1)" : "rgba(255,255,255,0.04)", color:!useCustom && amount===a ? "#FF8C00" : "#f8f0e0", fontSize:13, fontWeight:!useCustom && amount===a ? 800 : 500, cursor:"pointer", fontFamily:"Lexend" }}>
                  {(a/1000).toFixed(0)}k
                </button>
              ))}
            </div>
            <input type="tel" placeholder="Hoặc nhập số tiền khác..." value={custom}
              onFocus={() => setUseCustom(true)}
              onChange={e => { setUseCustom(true); setCustom(e.target.value) }}
              style={{ width:"100%", boxSizing:"border-box", height:44, padding:"0 14px", borderRadius:12, border:`1px solid ${useCustom ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.08)"}`, background:"rgba(255,255,255,0.04)", color:"#f8f0e0", fontSize:13, fontFamily:"Lexend", outline:"none", marginBottom:6 }}
            />
            {err && <div style={{ color:"#ff4040", fontSize:10, marginBottom:10, textAlign:"center" }}>⚠ {err}</div>}

            <button onClick={submit} disabled={loading || !bankInfo || finalAmount < 50000}
              style={{ width:"100%", height:50, borderRadius:14, border:"none", background:"linear-gradient(90deg,#FF6B00,#FF8C00)", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"Lexend", opacity: loading || !bankInfo || finalAmount < 50000 ? 0.5 : 1, marginTop:4 }}>
              {loading ? "Đang xử lý..." : `Gửi yêu cầu rút · ${finalAmount >= 50000 ? finalAmount.toLocaleString("vi-VN") + "đ" : "chọn số tiền"}`}
            </button>
            <div style={{ color:"#6a5a40", fontSize:9, textAlign:"center", marginTop:8 }}>
              Xử lý trong vòng 24 giờ · Miễn phí rút tiền
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}

/* ── main page ── */
export default function DriverDashboard() {
  const router = useRouter()
  const [online,        setOnline]        = useState(false)
  const [showOrder,     setShowOrder]     = useState(false)
  const [pendingOrder,  setPendingOrder]  = useState<OrderData | null>(null)
  const [accepted,      setAccepted]      = useState<string | null>(null)
  const { requestPermission } = usePushNotification()
  useOrderSound("driver")
  const [driverName,    setDriverName]    = useState("Tài xế")
  const [driverId,      setDriverId]      = useState<string | null>(null)
  const [todayStats,    setTodayStats]    = useState({ orders: 0, earnings: 0, rating: 5.0 })
  const [toggling,      setToggling]      = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [showWithdraw,  setShowWithdraw]  = useState(false)
  const [setupDone,     setSetupDone]     = useState(false)
  const [setupStatus,   setSetupStatus]   = useState({ bankLinked: false, vehicleDocs: false, depositDone: false })
  const [showSetupGate, setShowSetupGate] = useState(false)
  const [showTopup,     setShowTopup]     = useState(false)
  const [isApproved,    setIsApproved]    = useState<boolean | null>(null)
  const [unreadNotif,   setUnreadNotif]   = useState(0)
  useDriverLocation(driverId, online)  // lưu GPS realtime vào drivers.location trong DB
  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const gpsWatchRef   = useRef<number | null>(null)
  const gpsRef        = useRef({ lat: 0, lng: 0 })
  const showOrderRef  = useRef(false)
  const acceptedRef   = useRef<string | null>(null)
  const orderQueueRef = useRef<OrderData[]>([])

  // ── Load driver profile on mount ──
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setDriverId(user.id)
      requestPermission(user.id)   // xin quyền push notification

      const [{ data: profile }, { data: driver }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("drivers").select("status, rating_avg, license_plate, bank_account_number, is_approved").eq("id", user.id).single(),
      ])

      if (profile?.full_name) setDriverName(profile.full_name)
      if (driver) {
        setIsApproved((driver as { is_approved?: boolean }).is_approved ?? false)
        setOnline(driver.status === "online")
        setTodayStats(s => ({ ...s, rating: Number(driver.rating_avg ?? 5) }))
      } else {
        setIsApproved(false)
      }

      // Today's delivered orders — dùng driver_commission_amount đã lưu (chính xác với per-driver rate)
      const today = new Date().toISOString().split("T")[0]
      const { count, data: delivered } = await supabase
        .from("orders")
        .select("ship_fee, driver_commission_amount", { count: "exact" })
        .eq("driver_id", user.id)
        .eq("status", "delivered")
        .gte("created_at", `${today}T00:00:00`)

      const earnings = (delivered ?? []).reduce((sum, o) =>
        sum + Math.max(0, (o.ship_fee ?? 0) - (o.driver_commission_amount ?? 0)), 0)
      setTodayStats(s => ({ ...s, orders: count ?? 0, earnings }))

      // ── Setup gate checks ──
      const bankLinked = !!((driver as { bank_account_number?: string } | null)?.bank_account_number)
      const vehicleDocs = !!((driver as { license_plate?: string } | null)?.license_plate)
      const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).eq("type", "driver").maybeSingle()
      const walletBal = (wallet as { balance: number } | null)?.balance ?? 0
      const depositDone = walletBal >= 200000
      setWalletBalance(walletBal)
      const status = { bankLinked, vehicleDocs, depositDone }
      setSetupStatus(status)
      const done = bankLinked && vehicleDocs && depositDone
      setSetupDone(done)
      if (!done) setShowSetupGate(true)

      // Unread notifications
      const { count: notifCount } = await supabase
        .from("notifications").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("is_read", false)
      setUnreadNotif(notifCount ?? 0)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Bật GPS khi online, tắt khi offline ──
  useEffect(() => {
    if (online && navigator.geolocation) {
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        pos => { gpsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude } },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
      )
    } else {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current)
        gpsWatchRef.current = null
      }
    }
    return () => {
      if (gpsWatchRef.current !== null) navigator.geolocation.clearWatch(gpsWatchRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  // ── Toggle online/offline ──
  const handleToggleOnline = async () => {
    if (!driverId || toggling) return
    if (!setupDone) { setShowSetupGate(true); return }
    setToggling(true)
    const next = !online
    await supabase.from("drivers").update({ status: next ? "online" : "offline", is_online: next }).eq("id", driverId)
    setOnline(next)
    if (!next) setShowOrder(false)
    setToggling(false)
  }

  // ── Helper: build OrderData from a raw order row ──────────────
  const buildOrderData = useCallback(async (o: {
    id: string; shop_id: string; customer_id: string
    delivery_address: string; total: number; ship_fee: number
    total_amount: number; pay_method: string
  }): Promise<OrderData | null> => {
    const [{ data: shop }, { data: customer }, { data: items }] = await Promise.all([
      supabase.from("shops").select("name, address, commission_rate").eq("id", o.shop_id).single(),
      supabase.from("profiles").select("full_name").eq("id", o.customer_id).single(),
      supabase.from("order_items").select("name, qty, price").eq("order_id", o.id),
    ])
    // earnerFee ước tính từ commission quán — số thực trừ khi nhận đơn
    const commRate  = Number(shop?.commission_rate ?? 15)
    const earnerFee = Math.round((o.ship_fee ?? 0) * (1 - commRate / 100))
    return {
      id: o.id.slice(0, 8).toUpperCase(), fullId: o.id, orderTable: "orders",
      shopName: shop?.name ?? "Cửa hàng", shopAddress: shop?.address ?? "",
      customerName: customer?.full_name ?? "Khách hàng", customerAddress: o.delivery_address ?? "",
      distanceToShop: -1, distanceToCustomer: -1,
      items: (items ?? []).map(i => ({ name: i.name, qty: i.qty ?? 1, price: i.price })),
      subtotal: o.total ?? 0, deliveryFee: o.ship_fee ?? 0, total: o.total_amount ?? 0,
      earnerFee, payMethod: o.pay_method === "cash" ? "Tiền mặt" : "Chuyển khoản",
    }
  }, [supabase])

  // ── Khi bật online: gọi API để tìm đơn pending (bypass RLS) ──
  useEffect(() => {
    if (!online || !driverId) return
    async function checkPendingOrders() {
      if (showOrderRef.current || acceptedRef.current) return
      try {
        const res = await fetch(`/api/driver/check-pending?driverLat=${gpsRef.current.lat}&driverLng=${gpsRef.current.lng}`)
        if (!res.ok) return
        const { order } = await res.json()
        if (order) { setPendingOrder(order); setShowOrder(true); showOrderRef.current = true }
      } catch { /* ignore */ }
    }
    checkPendingOrders()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, driverId])

  // ── Poll đơn pending mỗi 20 giây khi online (dự phòng nếu realtime miss) ──
  useEffect(() => {
    if (!online || !driverId) return
    const interval = setInterval(async () => {
      if (showOrderRef.current || acceptedRef.current) return
      try {
        const res = await fetch(`/api/driver/check-pending?driverLat=${gpsRef.current.lat}&driverLng=${gpsRef.current.lng}`)
        if (!res.ok) return
        const { order } = await res.json()
        if (order) { setPendingOrder(order); setShowOrder(true); showOrderRef.current = true }
      } catch { /* ignore */ }
    }, 20_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, driverId])

  // ── Subscribe to pending orders when online ──
  useEffect(() => {
    if (!online || !driverId) {
      channelRef.current?.unsubscribe()
      channelRef.current = null
      return
    }

    const ch = supabase
      .channel("driver-pending-orders")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "orders",
        filter: "status=eq.pending",
      }, async (payload) => {
        const o = payload.new as {
          id: string; shop_id: string; customer_id: string
          delivery_address: string; total: number; ship_fee: number
          total_amount: number; pay_method: string
        }
        const orderData = await buildOrderData(o)
        if (!orderData) return
        if (acceptedRef.current) return
        if (showOrderRef.current) { orderQueueRef.current.push(orderData); return }
        setPendingOrder(orderData); setShowOrder(true); showOrderRef.current = true
      })
      .subscribe()

    // ── Subscription: errands (giao hộ / mua hộ) ──────────────
    const chErrands = supabase
      .channel("driver-pending-errands")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "errands",
        filter: "status=eq.pending",
      }, async (payload) => {
        if (acceptedRef.current) return
        const e = payload.new as {
          id: string; type: string; customer_id: string
          pickup_address: string; delivery_address: string
          package_description: string | null; items_description: string | null
          service_fee: number; payment_method: string
          sender_name: string | null; sender_phone: string | null
          recipient_name: string | null; recipient_phone: string | null
          package_photo_url: string | null
        }

        const { data: customer } = await supabase
          .from("profiles").select("full_name").eq("id", e.customer_id).single()

        const isDeliver = e.type === "deliver_for_me"
        const fee = e.service_fee ?? 0

        const orderData: OrderData = {
          id:                 e.id.slice(0, 8).toUpperCase(),
          fullId:             e.id,
          orderTable:         "errands",
          shopName:           isDeliver ? "📦 Giao hộ" : "🛍️ Mua hộ",
          shopAddress:        e.pickup_address ?? "",
          customerName:       e.recipient_name ?? customer?.full_name ?? "Người nhận",
          customerAddress:    e.delivery_address ?? "",
          distanceToShop:     -1,
          distanceToCustomer: -1,
          items: [{
            name:  isDeliver
              ? (e.package_description ?? "Gói hàng")
              : (e.items_description   ?? "Danh sách mua"),
            qty:   1,
            price: fee,
          }],
          subtotal:    fee,
          deliveryFee: 0,
          total:       fee,
          earnerFee:   Math.round(fee * 0.85),
          payMethod:   e.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản",
          packagePhotoUrl: e.package_photo_url ?? undefined,
          senderName:      e.sender_name    ?? undefined,
          senderPhone:     e.sender_phone   ?? undefined,
          recipientName:   e.recipient_name ?? undefined,
          recipientPhone:  e.recipient_phone ?? undefined,
        }
        if (showOrderRef.current) { orderQueueRef.current.push(orderData); return }
        setPendingOrder(orderData); setShowOrder(true); showOrderRef.current = true
      })
      .subscribe()

    // ── Lắng nghe khi merchant xác nhận (UPDATE status → accepted, driver_id vẫn null) ──
    const chAccepted = supabase
      .channel("driver-merchant-accepted")
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "orders",
        filter: "status=eq.accepted",
      }, async (payload) => {
        const o = payload.new as { id: string; status: string; driver_id: string | null; shop_id: string; customer_id: string; delivery_address: string; total: number; ship_fee: number; total_amount: number; pay_method: string }
        // Bỏ qua nếu đơn đã có tài xế, hoặc đang xử lý
        if (o.driver_id !== null || acceptedRef.current) return
        const orderData = await buildOrderData(o)
        if (!orderData) return
        if (showOrderRef.current) { orderQueueRef.current.push(orderData); return }
        setPendingOrder(orderData); setShowOrder(true); showOrderRef.current = true
      })
      .subscribe()

    // ── Lắng nghe UPDATE khi dispatch gán driver_id cho đơn ──────────
    const chAssigned = supabase
      .channel("driver-assigned-orders")
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "orders",
        filter: `driver_id=eq.${driverId}`,
      }, async (payload) => {
        const o = payload.new as { id: string; status: string; driver_id: string; shop_id: string; customer_id: string; delivery_address: string; total: number; ship_fee: number; total_amount: number; pay_method: string }
        // Hiện popup khi đơn có driver_id là tài xế này và còn có thể nhận
        if (!["pending", "accepted"].includes(o.status) || acceptedRef.current) return
        const orderData = await buildOrderData(o)
        if (!orderData) return
        if (showOrderRef.current) { orderQueueRef.current.push(orderData); return }
        setPendingOrder(orderData); setShowOrder(true); showOrderRef.current = true
      })
      .subscribe()

    channelRef.current = ch
    return () => { ch.unsubscribe(); chErrands.unsubscribe(); chAccepted.unsubscribe(); chAssigned.unsubscribe(); channelRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, driverId])

  const handleAccept = async () => {
    if (!pendingOrder || !driverId) return
    const orderId = pendingOrder.fullId
    const table   = pendingOrder.orderTable

    // Đơn errand/ride: dùng direct update (chưa có commission cho errand)
    if (table === "errands") {
      const { error } = await supabase.from("errands").update({
        status:      "accepted",
        driver_id:   driverId,
        accepted_at: new Date().toISOString(),
      }).eq("id", orderId).is("driver_id", null)

      if (error) {
        alert("Đơn đã được tài xế khác nhận!"); return
      }
      setShowOrder(false); showOrderRef.current = false; orderQueueRef.current = []
      setAccepted(orderId); acceptedRef.current = orderId
      router.push(`/driver/navigate/${orderId}`)
      return
    }

    // Đơn đồ ăn: dùng RPC atomic — trừ hoa hồng + chống race condition
    const { data: result, error: rpcErr } = await supabase.rpc("accept_order_with_commission", {
      p_order_id:  orderId,
      p_driver_id: driverId,
    })
    type AcceptResult = { success?: boolean; error?: string; commission_amount?: number }
    const res = result as AcceptResult | null

    if (rpcErr || res?.error) {
      const errMsg = (res?.error as string | undefined) ?? rpcErr?.message ?? "Không thể nhận đơn, thử lại"
      console.error("[Driver] accept error:", { rpcErr, res })

      // Lỗi ví không đủ → báo nạp tiền, không thử fallback
      if (errMsg.includes("Số dư ví") || errMsg.includes("chưa có ví")) {
        alert(errMsg + "\n\nVào mục Thu nhập → Ví để nạp tiền.")
        setShowOrder(false); showOrderRef.current = false; setPendingOrder(null)
        return
      }

      // Đơn đã có tài xế khác → bỏ qua
      if (errMsg.includes("đã được tài xế") || errMsg.includes("không còn có thể")) {
        alert("Đơn đã được tài xế khác nhận!")
        setShowOrder(false); showOrderRef.current = false; setPendingOrder(null)
        return
      }

      // Lỗi SQL / kỹ thuật → thử API fallback (service role bypass RLS)
      const fbRes = await fetch("/api/driver/accept-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, driver_id: driverId }),
      })
      if (!fbRes.ok) {
        const fbErr = await fbRes.json().catch(() => ({}))
        alert(fbErr?.error ?? errMsg)
        setShowOrder(false); showOrderRef.current = false; setPendingOrder(null)
        return
      }
      // Fallback thành công — tiếp tục
    }

    setShowOrder(false); showOrderRef.current = false; orderQueueRef.current = []
    setAccepted(orderId); acceptedRef.current = orderId

    // Push notification khách: tài xế đã nhận đơn
    fetch("/api/orders/notify-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, status: "driver_accepted" }),
    }).catch(() => {})

    router.push(`/driver/navigate/${orderId}`)
  }

  const handleReject = () => {
    const rejected = pendingOrder
    showOrderRef.current = false
    setShowOrder(false)
    setPendingOrder(null)

    // Báo server để dispatch sang tài xế tiếp theo
    if (rejected) {
      fetch("/api/dispatch/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: rejected.orderTable, id: rejected.fullId }),
      }).catch(() => {})
    }

    const next = orderQueueRef.current.shift()
    if (next) {
      setTimeout(() => {
        setPendingOrder(next)
        setShowOrder(true)
        showOrderRef.current = true
      }, 400)
    }
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

      {/* ── Chưa được duyệt ── */}
      {isApproved === false && (
        <div style={{
          minHeight:"100dvh", background:"#080806", display:"flex",
          alignItems:"center", justifyContent:"center", padding:24,
          fontFamily:"'Lexend',sans-serif",
        }}>
          <div style={{
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,107,0,0.2)",
            borderRadius:20, padding:32, maxWidth:340, textAlign:"center",
          }}>
            <div style={{ fontSize:56, marginBottom:16 }}>⏳</div>
            <div style={{ color:"#f8f0e0", fontSize:18, fontWeight:800, marginBottom:8 }}>
              Đang chờ duyệt
            </div>
            <div style={{ color:"#b0956a", fontSize:13, lineHeight:1.6, marginBottom:24 }}>
              Tài khoản tài xế của bạn đang được admin xem xét. Bạn sẽ nhận được thông báo khi được phê duyệt.
            </div>
            <button onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return
              const { data: d } = await supabase.from("drivers").select("is_approved").eq("id", user.id).single()
              if ((d as { is_approved?: boolean } | null)?.is_approved) setIsApproved(true)
            }} style={{
              background:"rgba(255,107,0,0.12)", border:"1px solid rgba(255,107,0,0.3)",
              color:"#FF8C00", borderRadius:12, padding:"10px 24px",
              fontFamily:"'Lexend',sans-serif", fontSize:12, fontWeight:700,
              cursor:"pointer", marginBottom:12, display:"block", width:"100%",
            }}>
              🔄 Kiểm tra lại trạng thái
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login" }}
              style={{
                background:"transparent", border:"1px solid rgba(255,255,255,0.08)",
                color:"#6a5a40", borderRadius:12, padding:"10px 24px",
                fontFamily:"'Lexend',sans-serif", fontSize:12, fontWeight:600,
                cursor:"pointer", display:"block", width:"100%",
              }}>
              Đăng xuất
            </button>
          </div>
        </div>
      )}

      {isApproved !== false && <div style={{ minHeight:"100dvh", background:"#080806", paddingBottom:80 }}>

        {/* ── header ── */}
        <div style={{ position:"sticky", top:0, zIndex:40, background:"rgba(8,8,6,0.95)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,107,0,0.08)", paddingTop:"env(safe-area-inset-top)" }}>
        <div style={{ height:56, padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:38, height:38, borderRadius:12,
              background:"rgba(255,107,0,0.12)", border:"1px solid rgba(255,107,0,0.25)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
            }}>🛵</div>
            <div>
              <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:800 }}>{driverName}</div>
              <div style={{ color:"#6a5a40", fontSize:9 }}>Tài xế · Giao Nhanh</div>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* Bell */}
          <Link href="/driver/notifications" style={{ position:"relative", display:"block", textDecoration:"none" }}>
            <div style={{
              width:36, height:36, borderRadius:10,
              background: unreadNotif > 0 ? "rgba(255,107,0,0.1)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${unreadNotif > 0 ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.08)"}`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:16,
            }}>🔔</div>
            {unreadNotif > 0 && (
              <div style={{
                position:"absolute", top:-4, right:-4, minWidth:18, height:18,
                borderRadius:9, background:"#ff4040", padding:"0 4px",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:9, fontWeight:800, color:"#fff",
              }}>{unreadNotif}</div>
            )}
          </Link>

          <motion.button whileTap={{ scale:.93 }} onClick={handleToggleOnline}
            disabled={toggling}
            style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"7px 14px", borderRadius:20, fontFamily:"Lexend",
              background: online ? "rgba(62,207,110,0.12)" : "rgba(255,255,255,0.07)",
              border: online ? "1px solid rgba(62,207,110,0.4)" : "1px solid rgba(255,255,255,0.12)",
              color: online ? "#3ecf6e" : "#6a5a40",
              fontSize:11, fontWeight:700, cursor: toggling ? "default" : "pointer", opacity: toggling ? 0.7 : 1,
            }}>
            <div style={{
              width:7, height:7, borderRadius:"50%",
              background: online ? "#3ecf6e" : "#6a5a40",
              boxShadow: online ? "0 0 6px #3ecf6e" : "none",
              animation: online ? "pulse 1.5s infinite" : "none",
            }} />
            {toggling ? "..." : online ? "Đang hoạt động" : "Ngoại tuyến"}
          </motion.button>
          </div>
        </div>
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
                    onClick={handleToggleOnline}
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
              <motion.a href={`/driver/navigate/${accepted}`}
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
            <StatCard icon="📦" label="Đơn hôm nay" value={String(todayStats.orders)} color="#FF8C00" />
            <StatCard icon="💰" label="Thu nhập" value={todayStats.earnings > 0 ? `${Math.round(todayStats.earnings/1000)}k` : "0đ"} color="#3ecf6e" />
            <StatCard icon="⭐" label="Đánh giá" value={todayStats.rating.toFixed(1)} color="#FFB347" />
          </div>

          {/* ── wallet balance ── */}
          <div style={{
            background:"linear-gradient(135deg,rgba(62,207,110,0.08),rgba(62,207,110,0.03))",
            border:`1px solid ${walletBalance < 100000 ? "rgba(255,64,64,0.3)" : "rgba(62,207,110,0.2)"}`,
            borderRadius:16, padding:"14px 16px", marginBottom:14,
            display:"flex", alignItems:"center", gap:12,
          }}>
            <div style={{ width:44, height:44, borderRadius:13, background:"rgba(62,207,110,0.12)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>💳</div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#6a5a40", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", marginBottom:2 }}>Số dư ví tài xế</div>
              <div style={{ color:"#3ecf6e", fontSize:20, fontWeight:800 }}>{walletBalance.toLocaleString("vi-VN")}đ</div>
              {walletBalance < 100000 && (
                <div style={{ color:"#ff4040", fontSize:9, marginTop:2 }}>⚠ Số dư thấp — nạp thêm để nhận đơn thoải mái</div>
              )}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
              <button onClick={() => setShowTopup(true)} style={{ padding:"7px 12px", borderRadius:10, border:"none", background:"linear-gradient(90deg,#3ecf6e,#2db55d)", color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", whiteSpace:"nowrap" }}>
                + Nạp tiền
              </button>
              <button onClick={() => setShowWithdraw(true)} style={{ padding:"7px 12px", borderRadius:10, border:"1px solid rgba(255,107,0,0.35)", background:"rgba(255,107,0,0.08)", color:"#FF8C00", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", whiteSpace:"nowrap" }}>
                💸 Rút tiền
              </button>
            </div>
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
            { href:"/driver/orders",   icon:"📋", label:"Đơn hàng",  active:false },
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
      </div>}

      {/* ── incoming order popup ── */}
      <AnimatePresence>
        {showOrder && pendingOrder && (
          <OrderPopup order={pendingOrder} onAccept={handleAccept} onReject={handleReject} />
        )}
      </AnimatePresence>

      {/* ── setup gate ── */}
      <AnimatePresence>
        {showSetupGate && (
          <SetupGate
            status={setupStatus}
            walletBalance={walletBalance}
            onClose={() => setShowSetupGate(false)}
            onTopup={() => setShowTopup(true)}
          />
        )}
      </AnimatePresence>

      {/* ── topup sheet ── */}
      <AnimatePresence>
        {showTopup && (
          <TopupSheet
            onClose={() => setShowTopup(false)}
            onSuccess={async () => {
              setShowTopup(false)
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return
              const { data: w } = await supabase
                .from("wallets").select("balance")
                .eq("user_id", user.id).eq("type", "driver").maybeSingle()
              const newBal = (w as { balance: number } | null)?.balance ?? 0
              setWalletBalance(newBal)
              setSetupStatus(s => ({ ...s, depositDone: newBal >= 200000 }))
            }}
          />
        )}
      </AnimatePresence>

      {/* ── withdraw sheet ── */}
      <AnimatePresence>
        {showWithdraw && (
          <WithdrawSheet
            walletBalance={walletBalance}
            onClose={() => setShowWithdraw(false)}
            onSuccess={async () => {
              setShowWithdraw(false)
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return
              const { data: w } = await supabase
                .from("wallets").select("balance")
                .eq("user_id", user.id).eq("type", "driver").maybeSingle()
              const newBal = (w as { balance: number } | null)?.balance ?? 0
              setWalletBalance(newBal)
              setSetupStatus(s => ({ ...s, depositDone: newBal >= 200000 }))
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
