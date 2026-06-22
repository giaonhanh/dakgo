"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { BANKS } from "@/lib/banks"

type TxType = "payment" | "topup" | "refund" | "reward" | "commission" | "withdrawal"
interface XuTx {
  id: string; type: TxType; label: string
  amount: number; balance: number; time: string
}

const TOPUP_AMOUNTS = [50000, 100000, 200000, 500000]
const fmt = (n: number) => Math.abs(n).toLocaleString("vi-VN")

// debit = trừ ví, credit = cộng ví
const TX_DEBIT = new Set(["payment", "withdrawal"])

const TX_CFG: Record<string, { icon:string; color:string; bg:string; label:string; badge:string }> = {
  payment:    { icon:"🛒", color:"#ff6060", bg:"rgba(255,64,64,0.1)",    label:"Thanh toán đơn hàng", badge:"↓ TRỪ VÍ"   },
  topup:      { icon:"💳", color:"#3ecf6e", bg:"rgba(62,207,110,0.1)",   label:"Nạp xu",              badge:"↑ CỘNG VÍ"  },
  refund:     { icon:"↩️", color:"#3ecf6e", bg:"rgba(62,207,110,0.1)",   label:"Hoàn xu",             badge:"↑ HOÀN VÍ"  },
  reward:     { icon:"🎁", color:"#3ecf6e", bg:"rgba(62,207,110,0.1)",   label:"Admin cộng thưởng",   badge:"↑ CỘNG VÍ"  },
  commission: { icon:"🎁", color:"#3ecf6e", bg:"rgba(62,207,110,0.1)",   label:"Hoa hồng",            badge:"↑ CỘNG VÍ"  },
  withdrawal: { icon:"🏦", color:"#ff6060", bg:"rgba(255,64,64,0.1)",    label:"Rút xu về ngân hàng", badge:"↓ TRỪ VÍ"   },
  minigame:   { icon:"🎮", color:"#3ecf6e", bg:"rgba(62,207,110,0.1)",   label:"Mini game",           badge:"↑ CỘNG VÍ"  },
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
  const [bonusBalance,   setBonusBalance]   = useState(0)
  const [txs,            setTxs]            = useState<XuTx[]>([])
  const [showTopup,      setShowTopup]      = useState(false)
  const [showWithdraw,   setShowWithdraw]   = useState(false)
  const [showQR,         setShowQR]         = useState(false)
  const [topupAmount,    setTopupAmount]    = useState(100000)
  const [customAmount,   setCustomAmount]   = useState("")
  const [withdrawAmount,    setWithdrawAmount]    = useState("")
  const [withdrawBank,      setWithdrawBank]      = useState("")
  const [withdrawBankBin,   setWithdrawBankBin]   = useState(BANKS[0].bin)
  const [withdrawAcctName,  setWithdrawAcctName]  = useState("")
  const [filterType,     setFilterType]     = useState<TxType|"all">("all")
  const [toast,          setToast]          = useState("")

  const loadWallet = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: wallet } = await supabase
      .from("wallets").select("id,balance,bonus_balance").eq("user_id", user.id).eq("type", "customer").maybeSingle()
    if (wallet) {
      setBalance(wallet.balance)
      setBonusBalance((wallet as { bonus_balance?: number }).bonus_balance ?? 0)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadWallet()

    // Khi user quay lại tab/app sau khi thanh toán, reload balance ngay
    const onFocus = () => loadWallet()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2400) }
  const finalTopup = customAmount ? parseInt(customAmount.replace(/\D/g,"")) || 0 : topupAmount
  const filtered   = txs.filter(t => filterType === "all" || t.type === filterType)

  const [qrUrl,        setQrUrl]        = useState<string | null>(null)
  const [topupCode,    setTopupCode]    = useState<number | null>(null)
  const [qrLoading,    setQrLoading]    = useState(false)
  const [withdrawing,  setWithdrawing]  = useState(false)
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup interval khi unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const handleCreateQR = async () => {
    if (finalTopup < 10000) return
    setQrLoading(true)
    let code = 0
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { fireToast("Vui lòng đăng nhập lại"); return }

      code = Math.floor(10000000 + Math.random() * 90000000)

      // Tạo wallet_topups record để webhook nhận diện
      await supabase.from("wallet_topups").insert({
        user_id:      user.id,
        wallet_type:  "customer",
        amount:       finalTopup,
        payment_code: code,
        status:       "pending",
      })

      // Gọi PayOS tạo QR thật
      const res = await fetch("/api/payment/payos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode:   code,
          amount:      finalTopup,
          description: `NAP XU GN${code}`,
          returnUrl:   `${window.location.origin}/wallet/xu?topup=success`,
          cancelUrl:   `${window.location.origin}/wallet/xu`,
        }),
      })
      const data = await res.json() as { qrCode?: string; bin?: string; accountNumber?: string; error?: string }
      if (data.error || !data.bin || !data.accountNumber) {
        // Cleanup record pending nếu PayOS fail
        await supabase.from("wallet_topups").delete().eq("payment_code", code)
        throw new Error(data.error ?? "Không thể tạo QR")
      }

      // Dùng VietQR Image API thay vì raw EMVCo string
      const qrImageUrl = `https://img.vietqr.io/image/${data.bin}-${data.accountNumber}-compact2.png` +
        `?amount=${finalTopup}&addInfo=${encodeURIComponent(`NAP XU GN${code}`)}`
      setQrUrl(qrImageUrl)
      setTopupCode(code)
      setShowQR(true)

      // Polling tự động sau khi hiện QR, tối đa 60 lần (5 phút)
      let retries = 0
      pollRef.current = setInterval(async () => {
        retries++
        if (retries > 60) { clearInterval(pollRef.current!); return }
        const { data: topup } = await supabase
          .from("wallet_topups").select("status")
          .eq("payment_code", code).single()
        if (topup?.status === "paid") {
          clearInterval(pollRef.current!)
          fireToast("🎉 Nạp xu thành công!")
          setShowQR(false); setShowTopup(false)
          await loadWallet()
        }
      }, 5000)
    } catch {
      fireToast("Không thể tạo QR, vui lòng thử lại")
    } finally {
      setQrLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawBank || !withdrawAmount) return
    const amt = parseInt(withdrawAmount) || 0
    if (amt <= 0) { fireToast("Số xu không hợp lệ"); return }
    if (amt > balance) { fireToast(`Chỉ rút được tối đa ${fmt(balance)} xu`); return }
    if (withdrawBank.replace(/\D/g,"").length < 8) { fireToast("Số tài khoản không hợp lệ"); return }
    setWithdrawing(true)
    try {
      if (!withdrawAcctName.trim()) { fireToast("Vui lòng nhập tên chủ tài khoản"); return }
    const res = await fetch("/api/customer/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, bank_account: withdrawBank, bank_bin: withdrawBankBin, account_name: withdrawAcctName.trim().toUpperCase() }),
      })
      const json = await res.json()
      if (!res.ok) { fireToast(json.error ?? "Không thể xử lý yêu cầu"); return }
      fireToast("✅ Yêu cầu rút xu đã ghi nhận! Admin xử lý trong 24h.")
      setShowWithdraw(false); setWithdrawBank(""); setWithdrawAmount(""); setWithdrawBankBin(BANKS[0].bin); setWithdrawAcctName("")
      setBalance(b => b - amt)
    } catch {
      fireToast("Lỗi kết nối, vui lòng thử lại")
    } finally {
      setWithdrawing(false)
    }
  }

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
            style={{ position:"fixed", top:"calc(env(safe-area-inset-top, 0px) + 62px)", left:"50%", transform:"translateX(-50%)",
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
                  💳 Nạp xu DakGo
                </div>

                {!showQR ? (
                  <>
                    <div style={{ color:"rgba(180,100,255,0.55)", fontSize: 11, marginBottom:8 }}>Chọn số xu</div>
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
                    <div style={{ color:"rgba(180,100,255,0.55)", fontSize: 11, marginBottom:5 }}>Hoặc nhập số xu khác</div>
                    <FInput label="" value={customAmount} onChange={setCustomAmount}
                      placeholder="VD: 150000" icon="💳" type="number" suffix="xu" />
                    <div style={{ background:"rgba(180,100,255,0.06)", border:"1px solid rgba(180,100,255,0.15)",
                      borderRadius:10, padding:"9px 12px", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:14 }}>💡</span>
                      <div style={{ color:"#6a5a40", fontSize: 11, lineHeight:1.5 }}>
                        1 xu = 1đ · Thanh toán ngay khi đặt hàng<br />
                        Tối thiểu 10.000 xu · Cộng tự động sau khi quét QR
                      </div>
                    </div>
                    <button onClick={handleCreateQR}
                      disabled={finalTopup < 10000 || qrLoading}
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
                        {qrLoading ? "Đang tạo QR..." : finalTopup >= 10000 ? `Tạo QR nạp ${finalTopup.toLocaleString("vi-VN")} xu` : "Nhập tối thiểu 10.000 xu"}
                      </span>
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign:"center" }}>
                    <div style={{ color:"#b464ff", fontSize:12, fontWeight:600, marginBottom:14 }}>
                      Quét mã để nạp {finalTopup.toLocaleString("vi-VN")} xu
                    </div>
                    {qrUrl ? (
                      <div style={{ display:"inline-block", background:"#fff", padding:12, borderRadius:16, marginBottom:12 }}>
                        <img src={qrUrl} alt="VietQR" style={{ width:180, height:180, display:"block" }} />
                      </div>
                    ) : (
                      <div style={{ width:180, height:180, background:"rgba(180,100,255,0.08)", borderRadius:16,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:40, margin:"0 auto 12px" }}>📱</div>
                    )}
                    <div style={{ color:"#6a5a40", fontSize: 11, lineHeight:1.7, marginBottom:12 }}>
                      Mã nạp: <strong style={{ color:"#b464ff" }}>GN{topupCode}</strong><br />
                      Quét QR để thanh toán qua ngân hàng
                    </div>
                    <div style={{ background:"rgba(180,100,255,0.08)", border:"1px solid rgba(180,100,255,0.2)",
                      borderRadius:9, padding:"7px 12px", marginBottom:12,
                      display:"flex", alignItems:"center", gap:7, justifyContent:"center" }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:"#b464ff",
                        boxShadow:"0 0 6px #b464ff" }} />
                      <span style={{ color:"#b464ff", fontSize: 11 }}>Đang chờ xác nhận thanh toán...</span>
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
                <div>
                  <span style={{ color:"#6a5a40", fontSize:10 }}>Xu DakGo có thể rút</span>
                  {bonusBalance > 0 && (
                    <div style={{ color:"rgba(62,207,110,0.6)", fontSize: 11, marginTop:2 }}>
                      Xu thưởng {fmt(bonusBalance)}xu — không rút được
                    </div>
                  )}
                </div>
                <div style={{ textAlign:"right" }}>
                  <span style={{ color:"#b464ff", fontSize:14, fontWeight:700 }}>{fmt(balance)} xu</span>
                  <div style={{ color:"rgba(180,100,255,0.45)", fontSize: 11 }}>= {fmt(balance)}đ</div>
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={{ color:"rgba(180,100,255,0.55)", fontSize:11, display:"block", marginBottom:4 }}>Ngân hàng</label>
                <select value={withdrawBankBin} onChange={e => setWithdrawBankBin(e.target.value)}
                  style={{ width:"100%", height:44, padding:"0 12px", borderRadius:12,
                    background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
                    color:"#f8f0e0", fontSize:12, fontFamily:"Lexend", appearance:"auto", colorScheme:"dark" }}>
                  {BANKS.map(b => <option key={b.bin} value={b.bin} style={{ background:"#0e0c09" }}>{b.name}</option>)}
                </select>
              </div>
              <FInput label="Số tài khoản ngân hàng" value={withdrawBank}
                onChange={setWithdrawBank} placeholder="VD: 0123456789" icon="🏦" type="number" />
              <FInput label="Tên chủ tài khoản (IN HOA)" value={withdrawAcctName}
                onChange={v => setWithdrawAcctName(v.toUpperCase())} placeholder="VD: NGUYEN VAN A" icon="👤" />
              <FInput label="Số xu muốn rút" value={withdrawAmount}
                onChange={setWithdrawAmount} placeholder="VD: 100000" icon="💳" type="number" suffix="xu" />
              <div style={{ background:"rgba(245,197,66,0.06)", border:"1px solid rgba(245,197,66,0.18)",
                borderRadius:9, padding:"8px 11px", marginBottom:14,
                color:"rgba(245,197,66,0.6)", fontSize: 11, lineHeight:1.6 }}>
                ⚠️ Phí rút: 0đ · 1 xu = 1đ · Xử lý 1–3 ngày làm việc
              </div>
              <button onClick={handleWithdraw} disabled={withdrawing}
                style={{ width:"100%", height:46, borderRadius:12, border:"none",
                  background: withdrawing ? "rgba(180,100,255,0.3)" : "linear-gradient(90deg,#b464ff,#d484ff)",
                  color:"#fff", fontSize:12, fontWeight:700, fontFamily:"Lexend",
                  cursor: withdrawing ? "not-allowed" : "pointer",
                  boxShadow: withdrawing ? "none" : "0 3px 14px rgba(180,100,255,0.3)" }}>
                {withdrawing ? "Đang xử lý..." : "💜 Xác nhận rút xu"}
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
          padding:"calc(env(safe-area-inset-top) + 12px) 16px 12px", flexShrink:0, zIndex:40 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/wallet" style={{ width:32, height:32, borderRadius:9, textDecoration:"none",
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0", fontSize:15, fontWeight:700 }}>💳 Ví Xu</div>
              <div style={{ color:"#6a5a40", fontSize: 11, marginTop:1 }}>1 xu = 1đ · thanh toán đơn hàng</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5,
              background:"rgba(180,100,255,0.08)", border:"1px solid rgba(180,100,255,0.2)",
              borderRadius:8, padding:"4px 10px" }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"#b464ff", boxShadow:"0 0 4px #b464ff" }} />
              <span style={{ color:"#b464ff", fontSize: 11, fontWeight:600 }}>Đã xác thực</span>
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
              Xu DakGo (có thể rút)
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4, position:"relative", zIndex:1 }}>
              <div style={{ fontSize:36, fontWeight:800, lineHeight:1,
                background:"linear-gradient(135deg,#b464ff,#d484ff,#e8a4ff)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
                {fmt(balance)}
              </div>
              <span style={{ color:"#b464ff", fontSize:16, fontWeight:600 }}>xu</span>
            </div>
            <div style={{ color:"rgba(180,100,255,0.4)", fontSize:10, marginBottom:bonusBalance>0?8:10, position:"relative", zIndex:1 }}>
              = {fmt(balance)}đ · nạp tiền, thanh toán & rút được
            </div>
            {bonusBalance > 0 && (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                background:"rgba(62,207,110,0.08)", border:"1px solid rgba(62,207,110,0.2)",
                borderRadius:10, padding:"8px 12px", marginBottom:6, position:"relative", zIndex:1 }}>
                <div>
                  <div style={{ color:"#3ecf6e", fontSize:10, fontWeight:700 }}>🎁 Xu thưởng (referral)</div>
                  <div style={{ color:"rgba(62,207,110,0.55)", fontSize: 11, marginTop:2 }}>
                    Chỉ dùng để thanh toán — không rút được
                  </div>
                </div>
                <div style={{ color:"#3ecf6e", fontSize:16, fontWeight:800 }}>
                  {fmt(bonusBalance)} xu
                </div>
              </div>
            )}
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
              <div style={{ color:"#6a5a40", fontSize: 11, marginTop:2, lineHeight:1.5 }}>
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
                  fontSize: 11, fontWeight: filterType===f.v ? 600 : 400, transition:"all .15s" }}>
                {f.l}
              </div>
            ))}
          </div>

          {/* Transaction list */}
          <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" }}>
            <AnimatePresence>
              {filtered.length === 0 && (
                <div style={{ padding:"32px 16px", textAlign:"center", color:"#6a5a40", fontSize:12 }}>
                  Chưa có giao dịch nào
                </div>
              )}
              {filtered.map((tx, i) => {
                const cfg = TX_CFG[tx.type] ?? { icon:"💳", color:"#b464ff", bg:"rgba(180,100,255,0.1)", label:tx.type, badge:"—" }
                const isDebit = TX_DEBIT.has(tx.type)
                const sign    = isDebit ? "-" : "+"
                const amtColor = isDebit ? "#ff5555" : "#3ecf6e"
                return (
                  <motion.div key={tx.id} initial={{ opacity:0 }} animate={{ opacity:1 }}
                    transition={{ delay:i*0.03 }}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
                      borderBottom: i < filtered.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>

                    {/* Icon */}
                    <div style={{ width:38, height:38, borderRadius:11, background:cfg.bg, border:`1px solid ${cfg.color}33`,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                      {cfg.icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:"#f0eaff", fontSize:12, fontWeight:600,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {tx.label}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                        <span style={{ color:"#6a5a40", fontSize:10 }}>{tx.time}</span>
                        <span style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:4,
                          background: isDebit ? "rgba(255,64,64,0.12)" : "rgba(62,207,110,0.12)",
                          color: amtColor, letterSpacing:0.3 }}>
                          {cfg.badge}
                        </span>
                      </div>
                      <div style={{ color:"#5a5060", fontSize:10, marginTop:2 }}>
                        Số dư sau: <span style={{ color:"#8070a0" }}>{tx.balance.toLocaleString("vi-VN")} xu</span>
                      </div>
                    </div>

                    {/* Amount — to lớn, rõ ràng */}
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ color:amtColor, fontSize:15, fontWeight:800, lineHeight:1.2 }}>
                        {sign}{Math.abs(tx.amount).toLocaleString("vi-VN")}
                      </div>
                      <div style={{ color: isDebit ? "rgba(255,85,85,0.5)" : "rgba(62,207,110,0.5)", fontSize:10, marginTop:1 }}>xu</div>
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
            { icon:"⚙️", label:"Cài đặt",   href:"/profile",active:false },
          ].map(tab => (
            <a key={tab.href} href={tab.href} style={{ textDecoration:"none",
              display:"flex", flexDirection:"column", alignItems:"center", gap:2,
              padding:"5px 11px", borderRadius:18,
              background: tab.active ? "rgba(255,107,0,0.12)" : "transparent" }}>
              <span style={{ fontSize:19 }}>{tab.icon}</span>
              <span style={{ fontSize: 10, color:"#6a5a40" }}>{tab.label}</span>
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
      {label && <label style={{ color:"rgba(180,100,255,0.55)", fontSize: 11, display:"block", marginBottom:4 }}>{label}</label>}
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
