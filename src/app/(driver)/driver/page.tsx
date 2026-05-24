"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
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
  shopName:            string
  shopAddress:         string
  customerName:        string
  customerAddress:     string
  distanceToShop:      number
  distanceToCustomer:  number
  items:               { name: string; qty: number; price: number }[]
  subtotal:            number
  deliveryFee:         number
  total:               number
  earnerFee:           number
  payMethod:           string
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

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSec(s => {
        if (s <= 1) { clearInterval(timerRef.current!); onReject(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [onReject])

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

const VN_BANKS = [
  { name: "Vietcombank", ios: "vcbmobile",   pkg: "com.VCB.digibank" },
  { name: "Techcombank", ios: "techcombank", pkg: "vn.com.techcombank.tb" },
  { name: "MB Bank",     ios: "mbmobile",    pkg: "com.mbmobile" },
  { name: "BIDV",        ios: "bidv",        pkg: "com.BIDV.SmartBanking" },
  { name: "VPBank",      ios: "vpbank",      pkg: "com.vpbank.vpbankneo" },
  { name: "Agribank",    ios: "agribank",    pkg: "vn.agribank.ibanking" },
  { name: "ACB",         ios: "acb",         pkg: "vn.acb.digital" },
  { name: "VietinBank",  ios: "vietinbank",  pkg: "com.VietinBank.iBank" },
  { name: "TPBank",      ios: "tpbank",      pkg: "vn.tpb.business" },
  { name: "HDBank",      ios: "hdbank",      pkg: "vn.com.hdbank" },
  { name: "Sacombank",   ios: "sacombank",   pkg: "vn.sacombank.mbanking" },
  { name: "MSB",         ios: "msb",         pkg: "vn.msb.msb" },
  { name: "SHB",         ios: "shb",         pkg: "vn.shb.mobile" },
  { name: "OCB",         ios: "ocb",         pkg: "vn.ocb.om.android" },
  { name: "Nam A Bank",  ios: "namabank",    pkg: "com.namabank.mobile" },
]

interface PayInfo {
  bin: string
  accountNumber: string
  accountName: string
  bankName: string
  qrCode: string
  description: string
}

function TopupSheet({ onClose, onSuccess }: { onClose: () => void; onSuccess: (amount: number) => void }) {
  const [amount,    setAmount]    = useState(200000)
  const [custom,    setCustom]    = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [step,      setStep]      = useState<"pick"|"qr">("pick")
  const [payInfo,   setPayInfo]   = useState<PayInfo | null>(null)
  const [selBank,   setSelBank]   = useState(VN_BANKS[0].name)
  const [loading,   setLoading]   = useState(false)
  const [err,       setErr]       = useState("")
  const [paid,      setPaid]      = useState(false)
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
      const desc = `NAPVI ${payCode}`

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
      if (!res.ok || json.error) throw new Error(json.error ?? "Không thể kết nối cổng thanh toán")

      setPayInfo({
        bin:           json.bin ?? "",
        accountNumber: json.accountNumber ?? "",
        accountName:   json.accountName ?? "",
        bankName:      json.bankName ?? "",
        qrCode:        json.qrCode ?? "",
        description:   desc,
      })
      setStep("qr")

      intervalRef.current = setInterval(async () => {
        const { data: topup } = await supabase
          .from("wallet_topups").select("status")
          .eq("payment_code", payCode).single()
        if (topup?.status === "paid") {
          clearInterval(intervalRef.current!)
          setPaid(true)
          setTimeout(() => onSuccess(finalAmount), 1500)
        }
      }, 5000)
    } catch (e) {
      setErr((e as Error).message || "Lỗi không xác định, thử lại sau")
    } finally {
      setLoading(false)
    }
  }

  function openBankApp() {
    const bank = VN_BANKS.find(b => b.name === selBank)
    if (!bank || !payInfo?.qrCode) return

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const qr = encodeURIComponent(payInfo.qrCode)

    if (isIOS) {
      // iOS: truyền QR string vào scheme → app parse VietQR → điền sẵn form
      window.location.href = `${bank.ios}://qr?data=${qr}`
    } else {
      // Android: intent URL → mở đúng app, truyền QR data qua extra
      window.location.href =
        `intent://qr?data=${qr}#Intent;scheme=${bank.ios};package=${bank.pkg};end`
    }
  }

  function copyInfo() {
    if (!payInfo) return
    const text = `STK: ${payInfo.accountNumber}\nNgân hàng: ${payInfo.bankName}\nSố tiền: ${finalAmount.toLocaleString("vi-VN")}đ\nNội dung: ${payInfo.description}`
    navigator.clipboard?.writeText(text)
  }

  function goBack() {
    setStep("pick")
    setPayInfo(null)
    setPaid(false)
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

        {/* ── STEP 2: QR + bank deep link ── */}
        {step === "qr" && !paid && payInfo && (
          <>
            {/* VietQR image */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:16 }}>
              <div style={{ background:"#fff", borderRadius:18, padding:14, boxShadow:"0 8px 32px rgba(62,207,110,0.2)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={vietQrUrl} alt="VietQR" width={190} height={190}
                  style={{ display:"block", borderRadius:8 }}
                  onError={e => { (e.target as HTMLImageElement).style.display="none" }}
                />
              </div>
              <div style={{ marginTop:10, color:"#3ecf6e", fontSize:22, fontWeight:800 }}>
                {finalAmount.toLocaleString("vi-VN")}đ
              </div>
            </div>

            {/* thông tin chuyển khoản */}
            <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
              <div style={{ color:"#6a5a40", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>Thông tin chuyển khoản</div>
              {[
                { label:"Số tài khoản", value: payInfo.accountNumber, highlight: true },
                { label:"Ngân hàng",    value: payInfo.bankName || "Theo QR" },
                { label:"Chủ tài khoản", value: payInfo.accountName },
                { label:"Nội dung",     value: payInfo.description },
                { label:"Số tiền",      value: finalAmount.toLocaleString("vi-VN") + "đ", highlight: true },
              ].map(row => (
                <div key={row.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:6, marginBottom:6, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ color:"#6a5a40", fontSize:10 }}>{row.label}</span>
                  <span style={{ color: row.highlight ? "#3ecf6e" : "#f8f0e0", fontSize:11, fontWeight: row.highlight ? 700 : 500 }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* mở app ngân hàng */}
            <div style={{ background:"rgba(74,143,245,0.07)", border:"1px solid rgba(74,143,245,0.2)", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
              <div style={{ color:"#6a5a40", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>Chuyển khoản qua app ngân hàng</div>
              <select value={selBank} onChange={e => setSelBank(e.target.value)}
                style={{ width:"100%", height:44, padding:"0 12px", borderRadius:10, border:"1px solid rgba(74,143,245,0.3)", background:"rgba(255,255,255,0.05)", color:"#f8f0e0", fontSize:13, fontFamily:"Lexend", marginBottom:10, appearance:"auto", boxSizing:"border-box" }}>
                {VN_BANKS.map(b => <option key={b.name} value={b.name} style={{ background:"#0e0b07" }}>{b.name}</option>)}
              </select>
              <button onClick={openBankApp}
                style={{ width:"100%", height:46, borderRadius:12, border:"none", background:"linear-gradient(90deg,#4a8ff5,#3a7ae4)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", boxShadow:"0 4px 16px rgba(74,143,245,0.3)", marginBottom:8 }}>
                🚀 Mở {selBank} · Chuyển khoản
              </button>
              <button onClick={copyInfo}
                style={{ width:"100%", height:38, borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend" }}>
                📋 Sao chép thông tin chuyển khoản
              </button>
              <div style={{ color:"#6a5a40", fontSize:9, textAlign:"center", marginTop:8, lineHeight:1.5 }}>
                App sẽ mở thẳng trang chuyển khoản đã điền sẵn thông tin.<br/>
                Bạn chỉ cần xác nhận bảo mật là xong.
              </div>
            </div>

            {/* trạng thái chờ */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, color:"#6a5a40", fontSize:10, marginBottom:14 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#3ecf6e", animation:"pulse 1.5s ease-in-out infinite" }} />
              Đang chờ xác nhận thanh toán tự động...
            </div>

            <button onClick={goBack}
              style={{ width:"100%", height:42, borderRadius:12, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#6a5a40", fontSize:11, cursor:"pointer", fontFamily:"Lexend" }}>
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

/* ── main page ── */
export default function DriverDashboard() {
  const router = useRouter()
  const [online,        setOnline]        = useState(false)
  const [showOrder,     setShowOrder]     = useState(false)
  const [pendingOrder,  setPendingOrder]  = useState<OrderData | null>(null)
  const [accepted,      setAccepted]      = useState<string | null>(null)
  const [driverName,    setDriverName]    = useState("Tài xế")
  const [driverId,      setDriverId]      = useState<string | null>(null)
  const [todayStats,    setTodayStats]    = useState({ orders: 0, earnings: 0, rating: 5.0 })
  const [toggling,      setToggling]      = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [setupDone,     setSetupDone]     = useState(false)
  const [setupStatus,   setSetupStatus]   = useState({ bankLinked: false, vehicleDocs: false, depositDone: false })
  const [showSetupGate, setShowSetupGate] = useState(false)
  const [showTopup,     setShowTopup]     = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Load driver profile on mount ──
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setDriverId(user.id)

      const [{ data: profile }, { data: driver }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("drivers").select("status, rating_avg, license_plate, bank_account_number").eq("id", user.id).single(),
      ])

      if (profile?.full_name) setDriverName(profile.full_name)
      if (driver) {
        setOnline(driver.status === "online")
        setTodayStats(s => ({ ...s, rating: Number(driver.rating_avg ?? 5) }))
      }

      // Today's delivered orders
      const today = new Date().toISOString().split("T")[0]
      const { count, data: delivered } = await supabase
        .from("orders")
        .select("delivery_fee, shops(commission_rate)", { count: "exact" })
        .eq("driver_id", user.id)
        .eq("status", "delivered")
        .gte("created_at", `${today}T00:00:00`)

      const earnings = (delivered ?? []).reduce((sum, o) => {
        const commission = Array.isArray(o.shops)
          ? (o.shops[0] as { commission_rate: number })?.commission_rate ?? 15
          : (o.shops as { commission_rate: number } | null)?.commission_rate ?? 15
        return sum + Math.round(o.delivery_fee * (1 - commission / 100))
      }, 0)
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
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Toggle online/offline ──
  const handleToggleOnline = async () => {
    if (!driverId || toggling) return
    if (!setupDone) { setShowSetupGate(true); return }
    setToggling(true)
    const next = !online
    await supabase.from("drivers").update({ status: next ? "online" : "offline" }).eq("id", driverId)
    setOnline(next)
    if (!next) setShowOrder(false)
    setToggling(false)
  }

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
        if (showOrder || accepted) return
        const o = payload.new as {
          id: string; shop_id: string; customer_id: string
          delivery_address: string; subtotal: number; delivery_fee: number
          total_amount: number; payment_method: string
        }

        // Fetch shop + customer + items
        const [{ data: shop }, { data: customer }, { data: items }] = await Promise.all([
          supabase.from("shops").select("name, address, commission_rate").eq("id", o.shop_id).single(),
          supabase.from("profiles").select("full_name").eq("id", o.customer_id).single(),
          supabase.from("order_items").select("name, quantity, price").eq("order_id", o.id),
        ])

        const commRate = Number(shop?.commission_rate ?? 15)
        const earnerFee = Math.round(o.delivery_fee * (1 - commRate / 100))

        const orderData: OrderData = {
          id:                  o.id.slice(0, 8).toUpperCase(),
          fullId:              o.id,
          shopName:            shop?.name ?? "Cửa hàng",
          shopAddress:         shop?.address ?? "",
          customerName:        customer?.full_name ?? "Khách hàng",
          customerAddress:     o.delivery_address,
          distanceToShop:      1.0,
          distanceToCustomer:  2.0,
          items:               (items ?? []).map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
          subtotal:            o.subtotal,
          deliveryFee:         o.delivery_fee,
          total:               o.total_amount,
          earnerFee,
          payMethod:           o.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản",
        }
        setPendingOrder(orderData)
        setShowOrder(true)
      })
      .subscribe()

    channelRef.current = ch
    return () => { ch.unsubscribe(); channelRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, driverId, showOrder, accepted])

  const handleAccept = async () => {
    if (!pendingOrder || !driverId) return
    setShowOrder(false)
    const orderId = pendingOrder.fullId
    await supabase.from("orders").update({
      status: "accepted",
      driver_id: driverId,
      accepted_at: new Date().toISOString(),
    }).eq("id", orderId)
    setAccepted(orderId)
    router.push(`/driver/navigate/${orderId}`)
  }

  const handleReject = () => {
    setShowOrder(false)
    setPendingOrder(null)
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
              <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:800 }}>{driverName}</div>
              <div style={{ color:"#6a5a40", fontSize:9 }}>Tài xế · Giao Nhanh</div>
            </div>
          </div>

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
            <button onClick={() => setShowTopup(true)} style={{
              padding:"8px 14px", borderRadius:10, border:"none",
              background:"linear-gradient(90deg,#3ecf6e,#2db55d)",
              color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"Lexend", whiteSpace:"nowrap",
            }}>+ Nạp tiền</button>
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
            onSuccess={(added) => {
              setWalletBalance(b => b + added)
              setShowTopup(false)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
