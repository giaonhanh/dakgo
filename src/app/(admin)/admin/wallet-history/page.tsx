"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

type TxType    = "topup" | "payment" | "refund" | "commission" | "withdrawal" | string
type WalletType = "customer" | "driver" | "merchant" | string

const TX_CFG: Record<string, { label: string; color: string; bg: string; sign: "+" | "-" | "~" }> = {
  topup:      { label: "Nạp tiền",   color: "#3ecf6e", bg: "rgba(62,207,110,0.1)",  sign: "+" },
  withdrawal: { label: "Rút tiền",   color: "#ff4040", bg: "rgba(255,64,64,0.1)",   sign: "-" },
  payment:    { label: "Thanh toán", color: "#f5c542", bg: "rgba(245,197,66,0.1)",  sign: "-" },
  refund:     { label: "Hoàn tiền",  color: "#4a8ff5", bg: "rgba(74,143,245,0.1)",  sign: "+" },
  commission: { label: "Hoa hồng",   color: "#b464ff", bg: "rgba(180,100,255,0.1)", sign: "-" },
  gift:       { label: "Admin tặng", color: "#FF8C00", bg: "rgba(255,107,0,0.1)",   sign: "+" },
}

const WALLET_CFG: Record<string, { label: string; color: string; icon: string }> = {
  customer: { label: "Khách hàng", color: "#f0eaff", icon: "👤" },
  driver:   { label: "Tài xế",     color: "#4a8ff5", icon: "🛵" },
  merchant: { label: "Cửa hàng",  color: "#FFB347", icon: "🏪" },
}

interface WalletTx {
  id: string
  txType: TxType
  walletType: WalletType
  amount: number
  balanceAfter: number
  note: string | null
  refType: string | null
  createdAt: string
  userName: string
  userPhone: string
}

const fmt      = (n: number) => n.toLocaleString("vi-VN") + "đ"
const fmtShort = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" :
  n >= 1_000     ? (n / 1_000).toFixed(0) + "k" :
  n.toString()
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

export default function WalletHistoryPage() {
  const [txs,           setTxs]           = useState<WalletTx[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filterWallet,  setFilterWallet]  = useState<"all" | WalletType>("all")
  const [filterTx,      setFilterTx]      = useState<"all" | TxType>("all")
  const [search,        setSearch]        = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: txData, error } = await supabase
      .from("transactions")
      .select("id, type, amount, balance_after, note, ref_type, created_at, wallet_id")
      .order("created_at", { ascending: false })
      .limit(500)

    if (error || !txData || txData.length === 0) {
      setLoading(false)
      return
    }

    const walletIds = [...new Set(txData.map(t => t.wallet_id))]
    const { data: wallets } = await supabase
      .from("wallets")
      .select("id, user_id, type")
      .in("id", walletIds)
    const walletMap = Object.fromEntries((wallets ?? []).map(w => [w.id, w]))

    const userIds = [...new Set((wallets ?? []).map(w => w.user_id).filter(Boolean))]
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds)
    const profMap = Object.fromEntries((profs ?? []).map(p => [p.id, p]))

    setTxs(txData.map(t => {
      const wallet  = walletMap[t.wallet_id]
      const profile = wallet ? profMap[wallet.user_id] : null
      return {
        id:          t.id,
        txType:      t.type,
        walletType:  wallet?.type ?? "customer",
        amount:      t.amount,
        balanceAfter: t.balance_after,
        note:        t.note,
        refType:     t.ref_type,
        createdAt:   t.created_at,
        userName:    profile?.full_name ?? "—",
        userPhone:   profile?.phone    ?? "—",
      }
    }))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const shown = txs
    .filter(t => filterWallet === "all" || t.walletType === filterWallet)
    .filter(t => filterTx     === "all" || t.txType     === filterTx)
    .filter(t => !search ||
      t.userName.toLowerCase().includes(search.toLowerCase()) ||
      t.userPhone.includes(search) ||
      (t.note ?? "").toLowerCase().includes(search.toLowerCase())
    )

  // KPI aggregation
  const totalTopup   = txs.filter(t => t.txType === "topup"      ).reduce((s,t) => s+t.amount, 0)
  const totalWithdraw = txs.filter(t => t.txType === "withdrawal" ).reduce((s,t) => s+t.amount, 0)
  const totalPayment = txs.filter(t => t.txType === "payment"    ).reduce((s,t) => s+t.amount, 0)
  const totalRefund  = txs.filter(t => t.txType === "refund"     ).reduce((s,t) => s+t.amount, 0)
  const totalCommission = txs.filter(t => t.txType === "commission").reduce((s,t) => s+t.amount, 0)
  const totalOther   = txs.filter(t => !TX_CFG[t.txType]).reduce((s,t) => s+t.amount, 0)

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        input{outline:none;font-family:'Lexend',sans-serif}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .tx-row:hover{background:rgba(255,107,0,0.04)!important}
      `}</style>

      <AdminShell
        pageTitle="💳 Lịch sử Rút / Nạp"
        pageSubtitle={loading ? "Đang tải..." : `${txs.length} giao dịch · ${shown.length} hiện thị`}
        actions={
          <button onClick={load} style={{ width:36, height:36, borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#f0eaff", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>↺</button>
        }
      >
        <div style={{ flex:1, overflowY:"auto", padding:16, height:"100%" }}>

          {/* KPI strip */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10, marginBottom:16 }}>
            {[
              { icon:"💚", label:"Tổng nạp",     value:fmtShort(totalTopup),      c:"#3ecf6e", bg:"rgba(62,207,110,0.07)",  bd:"rgba(62,207,110,0.2)"  },
              { icon:"🔴", label:"Tổng rút",      value:fmtShort(totalWithdraw),   c:"#ff4040", bg:"rgba(255,64,64,0.07)",   bd:"rgba(255,64,64,0.2)"   },
              { icon:"💛", label:"Thanh toán",    value:fmtShort(totalPayment),    c:"#f5c542", bg:"rgba(245,197,66,0.07)",  bd:"rgba(245,197,66,0.2)"  },
              { icon:"🔵", label:"Hoàn tiền",     value:fmtShort(totalRefund),     c:"#4a8ff5", bg:"rgba(74,143,245,0.07)", bd:"rgba(74,143,245,0.2)"  },
              { icon:"🟣", label:"Hoa hồng",      value:fmtShort(totalCommission), c:"#b464ff", bg:"rgba(180,100,255,0.07)",bd:"rgba(180,100,255,0.2)" },
              { icon:"🟠", label:"Khác",           value:fmtShort(totalOther),      c:"#FF8C00", bg:"rgba(255,107,0,0.07)",  bd:"rgba(255,107,0,0.2)"   },
            ].map((k, i) => (
              <div key={i} style={{ background:k.bg, border:`1px solid ${k.bd}`, borderRadius:12, padding:"11px 12px", animation:"fadeUp .35s ease both", animationDelay:`${i*0.04}s` }}>
                <div style={{ fontSize:16, marginBottom:5 }}>{k.icon}</div>
                <div style={{ color:k.c, fontSize:16, fontWeight:800, lineHeight:1, marginBottom:2 }}>{k.value}</div>
                <div style={{ color:"rgba(240,234,255,0.5)", fontSize:8 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* ── SQL reminder ── */}
          {!loading && txs.length === 0 && (
            <div style={{ background:"rgba(255,179,71,0.06)", border:"1px solid rgba(255,179,71,0.25)", borderRadius:12, padding:"14px 16px", marginBottom:16, fontSize:10, color:"#FFB347", lineHeight:1.8 }}>
              <div style={{ fontWeight:700, marginBottom:6 }}>⚠️ Không có dữ liệu — Cần cấu hình RLS Supabase</div>
              <div style={{ fontFamily:"monospace", fontSize:9, background:"rgba(0,0,0,0.3)", padding:"8px 12px", borderRadius:8, color:"#f0eaff" }}>
                {`CREATE POLICY "wallets_admin" ON wallets FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "transactions_admin" ON transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);`}
              </div>
              <div style={{ marginTop:6, fontSize:9, opacity:0.7 }}>Chạy SQL trên trong Supabase SQL Editor, sau đó tải lại trang.</div>
            </div>
          )}

          {/* Filters */}
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:13, padding:"11px 13px", marginBottom:12 }}>
            {/* Search */}
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:9, padding:"7px 11px", marginBottom:10 }}>
              <span style={{ color:"rgba(144,128,176,0.5)", fontSize:14 }}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tên, SĐT, ghi chú..." style={{ flex:1, background:"transparent", border:"none", color:"#f0eaff", fontSize:11 }} />
              {search && <span onClick={()=>setSearch("")} style={{ color:"rgba(144,128,176,0.4)", cursor:"pointer", fontSize:13 }}>✕</span>}
            </div>

            {/* Wallet type filter */}
            <div style={{ display:"flex", gap:6, marginBottom:8, alignItems:"center" }}>
              <span style={{ color:"rgba(144,128,176,0.4)", fontSize:8, flexShrink:0, marginRight:2 }}>Loại ví:</span>
              {([
                { key:"all",      label:"Tất cả",    c:"#FF8C00"  },
                { key:"customer", label:"👤 Khách",   c:"#f0eaff"  },
                { key:"driver",   label:"🛵 Tài xế",  c:"#4a8ff5"  },
                { key:"merchant", label:"🏪 Cửa hàng",c:"#FFB347" },
              ] as const).map(t => (
                <button key={t.key} onClick={()=>setFilterWallet(t.key)}
                  style={{ padding:"4px 12px", borderRadius:7, cursor:"pointer", fontFamily:"Lexend", fontSize:9, fontWeight:filterWallet===t.key?700:400, background:filterWallet===t.key?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)", border:`1px solid ${filterWallet===t.key?"rgba(255,107,0,0.35)":"rgba(255,255,255,0.07)"}`, color:filterWallet===t.key?t.c:"rgba(144,128,176,0.55)" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Transaction type filter */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ color:"rgba(144,128,176,0.4)", fontSize:8, flexShrink:0, marginRight:2 }}>Giao dịch:</span>
              {([
                { key:"all",        label:"Tất cả",   c:"#FF8C00" },
                { key:"topup",      label:"💚 Nạp",   c:"#3ecf6e" },
                { key:"withdrawal", label:"🔴 Rút",   c:"#ff4040" },
                { key:"payment",    label:"💛 TT",    c:"#f5c542" },
                { key:"refund",     label:"🔵 Hoàn",  c:"#4a8ff5" },
                { key:"commission", label:"🟣 HH",    c:"#b464ff" },
              ] as const).map(t => (
                <button key={t.key} onClick={()=>setFilterTx(t.key)}
                  style={{ padding:"4px 10px", borderRadius:7, cursor:"pointer", fontFamily:"Lexend", fontSize:9, fontWeight:filterTx===t.key?700:400, background:filterTx===t.key?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)", border:`1px solid ${filterTx===t.key?"rgba(255,107,0,0.35)":"rgba(255,255,255,0.07)"}`, color:filterTx===t.key?t.c:"rgba(144,128,176,0.55)" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction table */}
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:13, overflow:"hidden" }}>
            <div style={{ overflowX:"auto" }}>
              <div style={{ minWidth:720 }}>
                {/* Header */}
                <div style={{ display:"grid", gridTemplateColumns:"1.5fr 100px 80px 100px 90px 90px 90px", gap:8, padding:"9px 14px", borderBottom:"1px solid rgba(255,255,255,0.07)", background:"rgba(255,255,255,0.02)" }}>
                  {["Người dùng","SĐT","Loại ví","Giao dịch","Số tiền","Số dư sau","Thời gian"].map(h => (
                    <div key={h} style={{ color:"rgba(144,128,176,0.4)", fontSize:7.5, textTransform:"uppercase", letterSpacing:0.6, fontWeight:700 }}>{h}</div>
                  ))}
                </div>

                {loading ? (
                  <div style={{ padding:"40px 0", textAlign:"center", color:"rgba(144,128,176,0.35)", fontSize:11 }}>Đang tải...</div>
                ) : shown.length === 0 ? (
                  <div style={{ padding:"40px 0", textAlign:"center", color:"rgba(144,128,176,0.35)", fontSize:10, lineHeight:1.8 }}>
                    Không có giao dịch nào
                  </div>
                ) : shown.map((t, idx) => {
                  const txCfg  = TX_CFG[t.txType] ?? { label: t.txType, color: "#f0eaff", bg: "rgba(255,255,255,0.06)", sign: "~" as const }
                  const walCfg = WALLET_CFG[t.walletType] ?? { label: t.walletType, color: "#f0eaff", icon: "💼" }
                  const isIncome = txCfg.sign === "+"
                  return (
                    <div key={t.id} className="tx-row"
                      style={{ display:"grid", gridTemplateColumns:"1.5fr 100px 80px 100px 90px 90px 90px", gap:8, padding:"9px 14px", alignItems:"center", borderBottom:idx < shown.length-1?"1px solid rgba(255,255,255,0.04)":"none", transition:"background .15s" }}>
                      <div>
                        <div style={{ color:"#f0eaff", fontSize:10, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.userName}</div>
                        {t.note && <div style={{ color:"rgba(144,128,176,0.4)", fontSize:8, marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.note}</div>}
                      </div>
                      <div style={{ color:"rgba(240,234,255,0.5)", fontSize:9 }}>{t.userPhone}</div>
                      <div>
                        <span style={{ fontSize:8, padding:"2px 6px", borderRadius:4, background:`${walCfg.color}18`, color:walCfg.color, fontWeight:700 }}>
                          {walCfg.icon} {walCfg.label}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize:8, padding:"2px 7px", borderRadius:4, background:txCfg.bg, color:txCfg.color, fontWeight:700 }}>{txCfg.label}</span>
                      </div>
                      <div style={{ color:isIncome?"#3ecf6e":"#ff4040", fontSize:11, fontWeight:800 }}>
                        {isIncome?"+":"-"}{fmtShort(t.amount)}
                      </div>
                      <div style={{ color:"rgba(240,234,255,0.5)", fontSize:9, fontWeight:600 }}>
                        {fmt(t.balanceAfter)}
                      </div>
                      <div style={{ color:"rgba(144,128,176,0.4)", fontSize:9 }}>{fmtDate(t.createdAt)}</div>
                    </div>
                  )
                })}

                <div style={{ padding:"8px 14px", borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ color:"rgba(144,128,176,0.35)", fontSize:8 }}>Hiện {shown.length} / {txs.length} giao dịch</div>
                  <div style={{ color:"rgba(144,128,176,0.35)", fontSize:8 }}>Nạp ròng: <span style={{ color: totalTopup - totalWithdraw >= 0 ? "#3ecf6e" : "#ff4040", fontWeight:700 }}>{fmtShort(totalTopup - totalWithdraw)}</span></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </AdminShell>
    </>
  )
}
