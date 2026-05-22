"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

type TxType = "payment" | "topup" | "refund" | "reward" | "commission" | "withdrawal"
interface XuTx {
  id: string; type: TxType; label: string
  amount: number; balance: number; time: string
}

const TOPUP_AMOUNTS = [50000, 100000, 200000, 500000]
const fmt = (n: number) => Math.abs(n).toLocaleString("vi-VN")

const TX_CFG: Record<string, { icon:string; color:string; bg:string; label:string }> = {
  payment:    { icon:"🛒", color:"#ff6060", bg:"rgba(255,64,64,0.1)",    label:"Thanh toán" },
  topup:      { icon:"💳", color:"#b464ff", bg:"rgba(180,100,255,0.12)", label:"Nạp xu"     },
  refund:     { icon:"↩️", color:"#4a8ff5", bg:"rgba(74,143,245,0.1)",  label:"Hoàn xu"    },
  commission: { icon:"🎁", color:"#FFB347", bg:"rgba(255,179,71,0.12)",  label:"Hoa hồng"   },
  withdrawal: { icon:"🏦", color:"#9080b0", bg:"rgba(144,128,176,0.1)", label:"Rút xu"     },
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  const d = new Date(dateStr)
  const hhmm = d.toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" })
  if (diff < 86400)  return `Hôm nay · ${hhmm}`
  if (diff < 172800) return `Hôm qua · ${hhmm}`
  return `${Math.floor(diff/86400)} ngày trước`
}

export default function XuPage() {
  const supabase = createClient()
  const [balance,        setBalance]        = useState(0)
  const [txs,            setTxs]            = useState<XuTx[]>([])
  const [showTopup,      setShowTopup]      = useState(false)
  const [showWithdraw,   setShowWithdraw]   = useState(false)
  const [showQR,         setShowQR]         = useState(false)
  const [topupAmount,    setTopupAmount]    = useState(100000)
  const [customAmount,   setCustomAmount]   = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawBank,   setWithdrawBank]   = useState("")
  const [filterType,     setFilterType]     = useState<TxType|"all">("all")
  const [toast,          setToast]          = useState("")

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: wallet } = await supabase
        .from("wallets").select("id,balance").eq("user_id", user.id).eq("type", "customer").maybeSingle()
      if (wallet) {
        setBalance(wallet.balance)
        const { data: txData } = await supabase
          .from("transactions")
          .select("id,type,amount,balance_after,note,created_at")
          .eq("wallet_id", wallet.id)
          .order("created_at", { ascending: false })
          .limit(30)
        setTxs((txData ?? []).map((t: {id:string;type:string;amount:number;balance_after:number;note:string|null;created_at:string}) => ({
          id: t.id, type: t.type as TxType,
          label: t.note ?? TX_CFG[t.type]?.label ?? t.type,
          amount: t.amount, balance: t.balance_after, time: timeAgo(t.created_at),
        })))
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2400) }
  const finalTopup = customAmount ? parseInt(customAmount.replace(/\D/g,"")) || 0 : topupAmount
  const vietQRUrl  = `https://img.vietqr.io/image/BIDV-1234567890-qr_only.png?amount=${finalTopup}&addInfo=NAP%20XU%20GIAONHANH`
  const filtered   = txs.filter(t => filterType === "all" || t.type === filterType)

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
        html, body { background: #080806; font-family: 'Lexend', sans-serif; height: 100%; overflow: hidden }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-thumb { background: rgba(180,100,255,0.25); border-radius: 2px }
        @keyframes shimmer    { 0% { left: -60% } 100% { left: 120% } }
        @keyframes purplePulse { 0%,100% { box-shadow: 0 0 16px rgba(180,100,255,0.3) } 50% { box-shadow: 0 0 30px rgba(180,100,255,0.5) } }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-14 }}
            style={{ position:"fixed", top:52, left:"50%", transform:"translateX(-50%)",
              zIndex:999, whiteSpace:"nowrap",
              background:"rgba(180,100,255,0.15)", border:"1px solid rgba(180,100,255,0.35)",
              borderRadius:12, padding:"7px 18px", color:"#b464ff",
              fontSize:11, fontWeight:600, backdropFilter:"blur(10px)" }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nạp xu Sheet ── */}
      <AnimatePresence>
        {showTopup && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => { setShowTopup(false); setShowQR(false) }}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:90, backdropFilter:"blur(4px)" }} />
            <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
              transition={{ type:"spring", damping:27, stiffness:300 }}
              style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:91,
                background:"#0e0c09", border:"1px solid rgba(180,100,255,0.22)",
                borderRadius:"22px 22px 0 0", maxHeight:"90vh", display:"flex", flexDirection:"column" }}>
              <div style={{ padding:"14px 18px 10px", flexShrink:0 }}>
                <div style={{ width:36, height:4, background:"rgba(255,255,255,0.12)",
                  borderRadius:2, margin:"0 auto 16px" }} />
                <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:700, marginBottom:14 }}>
                  💳 Nạp xu Giao Nhanh
                </div>

                {!showQR ? (
                  <>
                    <div style={{ color:"rgba(180,100,255,0.55)", fontSize:9.5, marginBottom:8 }}>Chọn số xu</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:7, marginBottom:12 }}>
                      {TOPUP_AMOUNTS.map(v => (
                        <div key={v} onClick={() => { setTopupAmount(v); setCustomAmount("") }}
                          style={{ height:44, borderRadius:11, cursor:"pointer",
                            background: topupAmount===v&&!customAmount ? "rgba(180,100,255,0.12)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${topupAmount===v&&!customAmount ? "rgba(180,100,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            color: topupAmount===v&&!customAmount ? "#b464ff" : "#b0956a",
                            fontSize:12, fontWeight: topupAmount===v&&!customAmount ? 700 : 400, transition:"all .15s" }}>
                          {v.toLocaleString("vi-VN")} xu
                        </div>
                      ))}
                    </div>
                    <div style={{ color:"rgba(180,100,255,0.55)", fontSize:9.5, marginBottom:5 }}>Hoặc nhập số xu khác</div>
                    <FInput label="" value={customAmount} onChange={setCustomAmount}
                      placeholder="VD: 150000" icon="💳" type="number" suffix="xu" />
                    <div style={{ background:"rgba(180,100,255,0.06)", border:"1px solid rgba(180,100,255,0.15)",
                      borderRadius:10, padding:"9px 12px", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:14 }}>💡</span>
                      <div style={{ color:"#6a5a40", fontSize:8.5, lineHeight:1.5 }}>
                        1 xu = 1đ · Thanh toán ngay khi đặt hàng<br />
                        Tối thiểu 10.000 xu · Cộng tự động sau khi quét QR
                      </div>
                    </div>
                    <button onClick={() => finalTopup >= 10000 && setShowQR(true)}
                      disabled={finalTopup < 10000}
                      style={{ width:"100%", height:46, borderRadius:12, border:"none",
                        background: finalTopup >= 10000 ? "linear-gradient(90deg,#b464ff,#d484ff)" : "rgba(255,255,255,0.07)",
                        color: finalTopup >= 10000 ? "#fff" : "#6a5a40",
                        fontSize:12, fontWeight:700, fontFamily:"Lexend",
                        cursor: finalTopup >= 10000 ? "pointer" : "not-allowed",
                        position:"relative", overflow:"hidden",
                        boxShadow: finalTopup >= 10000 ? "0 3px 14px rgba(180,100,255,0.35)" : "none" }}>
                      {finalTopup >= 10000 && (
                        <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
                          background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                          animation:"shimmer 2.5s infinite" }} />
                      )}
                      <span style={{ position:"relative", zIndex:1 }}>
                        {finalTopup >= 10000 ? `Tạo QR nạp ${finalTopup.toLocaleString("vi-VN")} xu` : "Nhập tối thiểu 10.000 xu"}
                      </span>
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign:"center" }}>
                    <div style={{ color:"#b464ff", fontSize:12, fontWeight:600, marginBottom:14 }}>
                      Quét mã để nạp {finalTopup.toLocaleString("vi-VN")} xu
                    </div>
                    <div style={{ display:"inline-block", background:"#fff", padding:12, borderRadius:16, marginBottom:12 }}>
                      <img src={vietQRUrl} alt="VietQR" style={{ width:180, height:180, display:"block" }}
                        onError={e => {
                          (e.target as HTMLImageElement).style.display = "none"
                          const p = document.createElement("div")
                          p.style.cssText = "width:180px;height:180px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:40px;border-radius:8px"
                          p.textContent = "📱"
                          ;(e.target as HTMLImageElement).parentNode?.appendChild(p)
                        }} />
                    </div>
                    <div style={{ color:"#6a5a40", fontSize:9, lineHeight:1.7, marginBottom:12 }}>
                      Ngân hàng BIDV · TK: 1234567890<br />
                      Nội dung: <strong style={{ color:"#b464ff" }}>NAP XU GIAONHANH</strong>
                    </div>
                    <div style={{ background:"rgba(180,100,255,0.08)", border:"1px solid rgba(180,100,255,0.2)",
                      borderRadius:9, padding:"7px 12px", marginBottom:12,
                      display:"flex", alignItems:"center", gap:7, justifyContent:"center" }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:"#b464ff",
                        boxShadow:"0 0 6px #b464ff" }} />
                      <span style={{ color:"#b464ff", fontSize:9 }}>Đang chờ xác nhận thanh toán...</span>
                    </div>
                    <button onClick={() => setShowQR(false)}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#6a5a40", fontSize:10, fontFamily:"Lexend" }}>
                      ← Đổi số xu
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Rút xu Sheet ── */}
      <AnimatePresence>
        {showWithdraw && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setShowWithdraw(false)}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:90, backdropFilter:"blur(4px)" }} />
            <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
              transition={{ type:"spring", damping:27, stiffness:300 }}
              style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:91,
                background:"#0e0c09", border:"1px solid rgba(180,100,255,0.18)",
                borderRadius:"22px 22px 0 0", padding:"20px 18px 36px" }}>
              <div style={{ width:36, height:4, background:"rgba(255,255,255,0.12)",
                borderRadius:2, margin:"0 auto 16px" }} />
              <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:700, marginBottom:16 }}>
                🏦 Rút xu về ngân hàng
              </div>
              <div style={{ background:"rgba(180,100,255,0.07)", border:"1px solid rgba(180,100,255,0.2)",
                borderRadius:11, padding:"10px 13px", marginBottom:14,
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ color:"#6a5a40", fontSize:10 }}>Xu khả dụng</span>
                <div style={{ textAlign:"right" }}>
                  <span style={{ color:"#b464ff", fontSize:14, fontWeight:700 }}>{fmt(balance)} xu</span>
                  <div style={{ color:"rgba(180,100,255,0.45)", fontSize:9 }}>= {fmt(balance)}đ</div>
                </div>
              </div>
              <FInput label="Số tài khoản ngân hàng" value={withdrawBank}
                onChange={setWithdrawBank} placeholder="VD: 0123456789" icon="🏦" type="number" />
              <FInput label="Số xu muốn rút" value={withdrawAmount}
                onChange={setWithdrawAmount} placeholder="VD: 100000" icon="💳" type="number" suffix="xu" />
              <div style={{ background:"rgba(245,197,66,0.06)", border:"1px solid rgba(245,197,66,0.18)",
                borderRadius:9, padding:"8px 11px", marginBottom:14,
                color:"rgba(245,197,66,0.6)", fontSize:8.5, lineHeight:1.6 }}>
                ⚠️ Phí rút: 0đ · 1 xu = 1đ · Xử lý 1–3 ngày làm việc
              </div>
              <button onClick={() => {
                if (!withdrawBank || !withdrawAmount) return
                const amt = parseInt(withdrawAmount) || 0
                if (amt <= 0) { fireToast("Số xu không hợp lệ"); return }
                if (amt > balance) { fireToast("Số xu vượt quá số dư"); return }
                if (withdrawBank.replace(/\D/g,"").length < 8) { fireToast("Số tài khoản không hợp lệ"); return }
                fireToast("Đã gửi yêu cầu rút xu thành công!")
                setShowWithdraw(false); setWithdrawBank(""); setWithdrawAmount("")
              }} style={{ width:"100%", height:46, borderRadius:12, border:"none",
                background:"linear-gradient(90deg,#b464ff,#d484ff)",
                color:"#fff", fontSize:12, fontWeight:700, fontFamily:"Lexend",
                cursor:"pointer", boxShadow:"0 3px 14px rgba(180,100,255,0.3)" }}>
                💜 Xác nhận rút xu
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── ROOT ── */}
      <div style={{ position:"fixed", inset:0, background:"#080806",
        display:"flex", flexDirection:"column", fontFamily:"'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)", backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          padding:"44px 16px 12px", flexShrink:0, zIndex:40 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/wallet" style={{ width:32, height:32, borderRadius:9, textDecoration:"none",
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>💳 Ví Xu</div>
              <div style={{ color:"#6a5a40", fontSize:9, marginTop:1 }}>1 xu = 1đ · thanh toán đơn hàng</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5,
              background:"rgba(180,100,255,0.08)", border:"1px solid rgba(180,100,255,0.2)",
              borderRadius:8, padding:"4px 10px" }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"#b464ff", boxShadow:"0 0 4px #b464ff" }} />
              <span style={{ color:"#b464ff", fontSize:9, fontWeight:600 }}>Đã xác thực</span>
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px 88px",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {/* Balance card */}
          <div style={{ background:"linear-gradient(135deg,#0d0a1a,#160d2a,#080612)",
            border:"1px solid rgba(180,100,255,0.32)", borderRadius:18,
            padding:"18px 16px", marginBottom:12,
            position:"relative", overflow:"hidden", animation:"purplePulse 3s infinite" }}>
            <div style={{ position:"absolute", top:-20, right:-20, width:120, height:120,
              background:"radial-gradient(circle,rgba(180,100,255,0.2) 0%,transparent 65%)" }} />
            <div style={{ position:"absolute", top:0, left:"-100%", width:"50%", height:"100%",
              background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)",
              animation:"shimmer 4s infinite" }} />
            <div style={{ color:"rgba(180,100,255,0.5)", fontSize:10, marginBottom:4, position:"relative", zIndex:1 }}>
              Xu hiện có
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4, position:"relative", zIndex:1 }}>
              <div style={{ fontSize:36, fontWeight:800, lineHeight:1,
                background:"linear-gradient(135deg,#b464ff,#d484ff,#e8a4ff)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
                {fmt(balance)}
              </div>
              <span style={{ color:"#b464ff", fontSize:16, fontWeight:600 }}>xu</span>
            </div>
            <div style={{ color:"rgba(180,100,255,0.4)", fontSize:10, marginBottom:10, position:"relative", zIndex:1 }}>
              = {fmt(balance)}đ · dùng thanh toán đơn hàng
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
            <button onClick={() => { setShowTopup(true); setShowQR(false) }}
              style={{ height:64, borderRadius:13, border:"none",
                background:"linear-gradient(135deg,#b464ff,#d484ff)",
                color:"#fff", fontSize:10, fontWeight:700, fontFamily:"Lexend",
                cursor:"pointer", position:"relative", overflow:"hidden",
                boxShadow:"0 3px 12px rgba(180,100,255,0.35)",
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3 }}>
              <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                animation:"shimmer 2.5s infinite" }} />
              <span style={{ fontSize:22, position:"relative", zIndex:1 }}>➕</span>
              <span style={{ position:"relative", zIndex:1 }}>Nạp xu</span>
            </button>
            <button onClick={() => setShowWithdraw(true)}
              style={{ height:64, borderRadius:13,
                border:"1px solid rgba(180,100,255,0.25)",
                background:"rgba(180,100,255,0.08)",
                color:"#9080b0", fontSize:10, fontWeight:700, fontFamily:"Lexend",
                cursor:"pointer", display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center", gap:3 }}>
              <span style={{ fontSize:22 }}>🏦</span>
              <span>Rút xu</span>
            </button>
          </div>

          {/* Info */}
          <div style={{ background:"rgba(180,100,255,0.05)", border:"1px solid rgba(180,100,255,0.15)",
            borderRadius:12, padding:"11px 13px", marginBottom:14,
            display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:9, background:"rgba(180,100,255,0.12)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>💡</div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#b464ff", fontSize:11, fontWeight:600 }}>Cách tích xu</div>
              <div style={{ color:"#6a5a40", fontSize:8.5, marginTop:2, lineHeight:1.5 }}>
                Nạp VietQR · Admin cộng · Hoàn đơn · Mini game · Đổi từ điểm tích lũy
              </div>
            </div>
          </div>

          {/* Transaction section */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ color:"#b0956a", fontSize:10, fontWeight:600 }}>Lịch sử xu</div>
          </div>

          {/* Filter chips */}
          <div style={{ display:"flex", gap:5, overflowX:"auto",
            scrollbarWidth:"none", marginBottom:10, paddingBottom:2 } as React.CSSProperties}>
            {[
              { v:"all",        l:"Tất cả" },
              { v:"payment",    l:"Thanh toán" },
              { v:"topup",      l:"Nạp xu" },
              { v:"refund",     l:"Hoàn xu" },
              { v:"reward",     l:"Admin cộng" },
              { v:"minigame",   l:"Mini game" },
              { v:"withdrawal", l:"Rút xu" },
            ].map(f => (
              <div key={f.v} onClick={() => setFilterType(f.v as TxType|"all")}
                style={{ padding:"4px 11px", borderRadius:20, cursor:"pointer", flexShrink:0,
                  background: filterType===f.v ? "rgba(180,100,255,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${filterType===f.v ? "rgba(180,100,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                  color: filterType===f.v ? "#b464ff" : "#6a5a40",
                  fontSize:9, fontWeight: filterType===f.v ? 600 : 400, transition:"all .15s" }}>
                {f.l}
              </div>
            ))}
          </div>

          {/* Transaction list */}
          <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
            <AnimatePresence>
              {filtered.map((tx, i) => {
                const cfg = TX_CFG[tx.type]
                return (
                  <motion.div key={tx.id} initial={{ opacity:0 }} animate={{ opacity:1 }}
                    transition={{ delay:i*0.03 }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 13px",
                      borderBottom: i < filtered.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <div style={{ width:34, height:34, borderRadius:10, background:cfg.bg,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                      {cfg.icon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:"#f8f0e0", fontSize:10.5, fontWeight:500,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {tx.label}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                        <span style={{ color:"#6a5a40", fontSize:8 }}>{tx.time}</span>
                        <span style={{ fontSize:7.5, fontWeight:600, padding:"1px 5px", borderRadius:4,
                          background:cfg.bg, color:cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ color:"#6a5a40", fontSize:7.5, marginTop:1 }}>
                        Số dư: {tx.balance.toLocaleString("vi-VN")} xu
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ color: tx.amount > 0 ? "#3ecf6e" : "#ff6060", fontSize:11, fontWeight:700 }}>
                        {tx.amount > 0 ? "+" : "-"}{Math.abs(tx.amount).toLocaleString("vi-VN")}
                      </div>
                      <div style={{ color:"rgba(180,100,255,0.5)", fontSize:8 }}>xu</div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Nav */}
        <div style={{ position:"absolute", bottom:"max(16px,env(safe-area-inset-bottom))", left:14, right:14, height:56,
          background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999,
          display:"flex", alignItems:"center", justifyContent:"space-around",
          padding:"0 6px", zIndex:50, boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            { icon:"🏠", label:"Trang chủ", href:"/",        active:false },
            { icon:"📋", label:"Đơn hàng",  href:"/orders",  active:false },
            { icon:"🛒", label:"Giỏ hàng",  href:"/cart",    active:false },
            { icon:"⚙️", label:"Cài đặt",   href:"/settings",active:false },
          ].map(tab => (
            <a key={tab.href} href={tab.href} style={{ textDecoration:"none",
              display:"flex", flexDirection:"column", alignItems:"center", gap:2,
              padding:"5px 11px", borderRadius:18,
              background: tab.active ? "rgba(255,107,0,0.12)" : "transparent" }}>
              <span style={{ fontSize:19 }}>{tab.icon}</span>
              <span style={{ fontSize:7.5, color:"#6a5a40" }}>{tab.label}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}

function FInput({ label, value, onChange, placeholder, icon, type="text", suffix }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; icon?: string; type?: string; suffix?: string
}) {
  const [f, setF] = useState(false)
  return (
    <div style={{ marginBottom:10 }}>
      {label && <label style={{ color:"rgba(180,100,255,0.55)", fontSize:9.5, display:"block", marginBottom:4 }}>{label}</label>}
      <div style={{ display:"flex", alignItems:"center", gap:8,
        background:"rgba(255,255,255,0.04)",
        border: `1px solid ${f ? "rgba(180,100,255,0.5)" : "rgba(255,255,255,0.08)"}`,
        borderRadius:12, padding:"0 12px", height:44, transition:"all .2s",
        boxShadow: f ? "0 0 0 3px rgba(180,100,255,0.09)" : "none" }}>
        {icon && <span style={{ fontSize:15 }}>{icon}</span>}
        <input type={type} value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setF(true)} onBlur={() => setF(false)}
          style={{ flex:1, background:"transparent", border:"none", outline:"none",
            color:"#f8f0e0", fontSize:12, fontFamily:"Lexend" }} />
        {suffix && <span style={{ color:"#b464ff", fontSize:10, fontWeight:600 }}>{suffix}</span>}
      </div>
    </div>
  )
}
