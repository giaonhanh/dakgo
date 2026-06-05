"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

interface Withdrawal {
  id:           string
  user_id:      string
  wallet_type:  string
  amount:       number
  bank_bin:     string
  bank_account: string
  account_name: string | null
  status:       string
  error_msg:    string | null
  created_at:   string
  full_name:    string | null
  phone:        string | null
}

const fmt = (n: number) => n.toLocaleString("vi-VN")
const fmtTime = (iso: string) => {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 60000)
  const hhmm = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  const ddmm = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
  if (diff < 60)   return `${diff} phút trước`
  if (diff < 1440) return `${hhmm} hôm nay`
  return `${hhmm} · ${ddmm}`
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  processing:  { label: "Đang xử lý", color: "#FFB347", bg: "rgba(255,179,71,0.12)"   },
  success:     { label: "Chờ chuyển", color: "#4a8ff5", bg: "rgba(74,143,245,0.12)"   },
  transferred: { label: "Đã chuyển",  color: "#3ecf6e", bg: "rgba(62,207,110,0.12)"   },
  failed:      { label: "Từ chối",    color: "#ff6060", bg: "rgba(255,64,64,0.10)"    },
  refunded:    { label: "Hoàn lại",   color: "#9080b0", bg: "rgba(144,128,176,0.10)"  },
}

export default function AdminWithdrawalsPage() {
  const supabase = createClient()
  const [items,        setItems]        = useState<Withdrawal[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<"pending"|"all">("pending")
  const [acting,       setActing]       = useState<string | null>(null)
  const [toast,        setToast]        = useState("")
  const [pendingCount, setPendingCount] = useState(0)

  // Reject modal
  const [rejectId,     setRejectId]     = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejecting,    setRejecting]    = useState(false)

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from("withdrawals")
      .select("*, profiles!user_id(full_name, phone)")
      .order("created_at", { ascending: false })
      .limit(100)

    if (filter === "pending") q = q.in("status", ["success", "processing"])

    const { data } = await q
    const rows: Withdrawal[] = (data ?? []).map((r: Record<string, unknown>) => {
      const p = r.profiles as { full_name?: string; phone?: string } | null
      return {
        id:           r.id as string,
        user_id:      r.user_id as string,
        wallet_type:  r.wallet_type as string,
        amount:       r.amount as number,
        bank_bin:     r.bank_bin as string,
        bank_account: r.bank_account as string,
        account_name: r.account_name as string | null,
        status:       r.status as string,
        error_msg:    r.error_msg as string | null,
        created_at:   r.created_at as string,
        full_name:    p?.full_name ?? null,
        phone:        p?.phone ?? null,
      }
    })
    setItems(rows)

    const { count } = await supabase
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .in("status", ["success", "processing"])
    setPendingCount(count ?? 0)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => { load() }, [load])

  const callApi = async (withdrawal_id: string, action: string, reject_reason?: string) => {
    const res = await fetch("/api/admin/withdrawals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withdrawal_id, action, reject_reason }),
    })
    return res.json()
  }

  const markTransferred = async (id: string) => {
    setActing(id)
    const json = await callApi(id, "transferred")
    setActing(null)
    if (json.error) { fireToast(`Lỗi: ${json.error}`); return }
    fireToast("✅ Đã đánh dấu chuyển khoản")
    setItems(prev => prev.map(w => w.id === id ? { ...w, status: "transferred" } : w))
    setPendingCount(p => Math.max(0, p - 1))
  }

  const confirmReject = async () => {
    if (!rejectId || !rejectReason.trim()) return
    setRejecting(true)
    const json = await callApi(rejectId, "rejected", rejectReason.trim())
    setRejecting(false)
    if (json.error) { fireToast(`Lỗi: ${json.error}`); return }
    fireToast("❌ Đã từ chối và hoàn xu")
    setItems(prev => prev.map(w => w.id === rejectId ? { ...w, status: "failed", error_msg: `Admin từ chối: ${rejectReason}` } : w))
    setPendingCount(p => Math.max(0, p - 1))
    setRejectId(null); setRejectReason("")
  }

  const copy = (text: string) => { navigator.clipboard.writeText(text); fireToast("Đã sao chép") }

  return (
    <AdminShell
      pageTitle="🏦 Quản lý rút tiền"
      pageSubtitle={pendingCount > 0 ? `${pendingCount} yêu cầu chờ xử lý` : "Tất cả đã xử lý"}
    >
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:70, left:"50%", transform:"translateX(-50%)", zIndex:999,
          background:"rgba(10,9,18,0.95)", border:"1px solid rgba(62,207,110,0.35)",
          borderRadius:10, padding:"8px 20px", color:"#3ecf6e", fontSize:11, fontWeight:600,
          backdropFilter:"blur(12px)", whiteSpace:"nowrap", animation:"fadeIn .2s" }}>
          {toast}
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <>
          <div onClick={() => { setRejectId(null); setRejectReason("") }}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:80, backdropFilter:"blur(4px)" }} />
          <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
            zIndex:81, background:"#0e0b07", border:"1px solid rgba(255,107,0,0.3)",
            borderRadius:18, padding:"24px 20px", width:"min(360px,90vw)", animation:"fadeIn .2s" }}>
            <div style={{ color:"#f8f0e0", fontSize:14, fontWeight:700, marginBottom:6 }}>❌ Từ chối yêu cầu</div>
            <div style={{ color:"#6a5a40", fontSize:11, marginBottom:16 }}>
              Xu/tiền sẽ được hoàn lại ví ngay lập tức. Nhập lý do để thông báo cho người dùng.
            </div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="VD: Số tài khoản không chính xác, vui lòng kiểm tra lại..."
              rows={3}
              style={{ width:"100%", padding:"10px 12px", borderRadius:11, background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(255,107,0,0.25)", color:"#f8f0e0", fontSize:12,
                fontFamily:"Lexend", resize:"none", outline:"none", boxSizing:"border-box" }}
            />
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button onClick={() => { setRejectId(null); setRejectReason("") }}
                style={{ flex:1, height:42, borderRadius:11, border:"1px solid rgba(255,255,255,0.1)",
                  background:"rgba(255,255,255,0.04)", color:"#6a5a40", fontSize:12, fontWeight:600,
                  cursor:"pointer", fontFamily:"Lexend" }}>
                Huỷ
              </button>
              <button onClick={confirmReject} disabled={rejecting || !rejectReason.trim()}
                style={{ flex:1, height:42, borderRadius:11, border:"none",
                  background: rejectReason.trim() ? "linear-gradient(90deg,#ff4040,#ff6060)" : "rgba(255,255,255,0.07)",
                  color: rejectReason.trim() ? "#fff" : "#6a5a40", fontSize:12, fontWeight:700,
                  cursor: rejectReason.trim() ? "pointer" : "not-allowed", fontFamily:"Lexend" }}>
                {rejecting ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ padding:"16px", height:"100%", overflowY:"auto" }}>

        {/* Filter + Refresh */}
        <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
          {([["pending", `⏳ Chờ xử lý${pendingCount > 0 ? ` (${pendingCount})` : ""}`], ["all", "📋 Tất cả"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ padding:"7px 14px", borderRadius:9, cursor:"pointer", fontFamily:"Lexend", fontSize:11, fontWeight:filter===v?700:400,
                background: filter===v ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${filter===v ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.08)"}`,
                color: filter===v ? "#FF8C00" : "#6a5a40" }}>
              {l}
            </button>
          ))}
          <button onClick={load} style={{ marginLeft:"auto", padding:"7px 12px", borderRadius:9, cursor:"pointer",
            fontFamily:"Lexend", fontSize:11, background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)", color:"#6a5a40" }}>
            🔄 Làm mới
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:"48px 0", color:"#6a5a40", fontSize:12 }}>Đang tải...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign:"center", padding:"48px 0" }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🎉</div>
            <div style={{ color:"#6a5a40", fontSize:12 }}>Không có yêu cầu nào</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {items.map(w => {
              const cfg   = STATUS_CFG[w.status] ?? STATUS_CFG.failed
              const isPending = w.status === "success" || w.status === "processing"
              const unit  = w.wallet_type === "driver" ? "đ" : " xu"

              return (
                <div key={w.id} style={{ background:"rgba(255,255,255,0.03)",
                  border:`1px solid ${isPending ? "rgba(255,107,0,0.22)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius:14, padding:"14px 16px", animation:"fadeIn .25s" }}>

                  {/* Header: user + thời gian + status */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div>
                      <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:700 }}>
                        {w.full_name ?? "Người dùng"}
                        <span style={{ marginLeft:7, fontSize:9, color:"#6a5a40", fontWeight:400,
                          background:"rgba(255,255,255,0.06)", padding:"1px 6px", borderRadius:4 }}>
                          {w.wallet_type === "driver" ? "Tài xế" : "Khách"}
                        </span>
                      </div>
                      {w.phone && <div style={{ color:"#6a5a40", fontSize:11, marginTop:2 }}>{w.phone}</div>}
                      <div style={{ color:"#4a5568", fontSize:10, marginTop:2 }}>{fmtTime(w.created_at)}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ color:"#FF8C00", fontSize:17, fontWeight:800 }}>{fmt(w.amount)}{unit}</div>
                      <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:6,
                        background:cfg.bg, color:cfg.color, display:"inline-block", marginTop:4 }}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Thông tin chuyển khoản */}
                  <div style={{ background:"rgba(0,0,0,0.2)", borderRadius:10, padding:"10px 12px", marginBottom:10 }}>
                    {[
                      { label:"Chủ tài khoản", value: w.account_name ?? "—", highlight: true },
                      { label:"Số tài khoản",  value: w.bank_account, copy: true },
                      { label:"Số tiền CK",    value: `${fmt(w.amount)}đ`, copy: true, copyVal: String(w.amount) },
                    ].map(row => (
                      <div key={row.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                        <span style={{ color:"#6a5a40", fontSize:11 }}>{row.label}</span>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ color: row.highlight ? "#FFB347" : "#f8f0e0", fontSize:12, fontWeight: row.highlight ? 700 : 600 }}>
                            {row.value}
                          </span>
                          {row.copy && (
                            <button onClick={() => copy(row.copyVal ?? row.value)}
                              style={{ background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.2)",
                                borderRadius:5, padding:"1px 7px", cursor:"pointer", color:"#FF8C00", fontSize:10, fontFamily:"Lexend" }}>
                              Copy
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Lý do từ chối (nếu có) */}
                  {w.error_msg && (
                    <div style={{ background:"rgba(255,64,64,0.06)", border:"1px solid rgba(255,64,64,0.15)",
                      borderRadius:8, padding:"6px 10px", color:"rgba(255,100,100,0.8)", fontSize:10, marginBottom:10 }}>
                      ⚠️ {w.error_msg}
                    </div>
                  )}

                  {/* Actions */}
                  {isPending && (
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => markTransferred(w.id)} disabled={acting === w.id}
                        style={{ flex:2, height:42, borderRadius:11, border:"none",
                          background: acting === w.id ? "rgba(62,207,110,0.2)" : "linear-gradient(90deg,#3ecf6e,#2ecc71)",
                          color:"#fff", fontSize:12, fontWeight:700, fontFamily:"Lexend",
                          cursor: acting === w.id ? "not-allowed" : "pointer",
                          boxShadow: acting === w.id ? "none" : "0 3px 12px rgba(62,207,110,0.3)" }}>
                        {acting === w.id ? "..." : "✅ Đã chuyển khoản"}
                      </button>
                      <button onClick={() => { setRejectId(w.id); setRejectReason("") }} disabled={acting === w.id}
                        style={{ flex:1, height:42, borderRadius:11,
                          border:"1px solid rgba(255,64,64,0.3)", background:"rgba(255,64,64,0.08)",
                          color:"#ff6060", fontSize:12, fontWeight:700, fontFamily:"Lexend",
                          cursor: acting === w.id ? "not-allowed" : "pointer" }}>
                        ❌ Từ chối
                      </button>
                    </div>
                  )}

                  {w.status === "transferred" && (
                    <div style={{ textAlign:"center", color:"#3ecf6e", fontSize:11, fontWeight:600, paddingTop:4 }}>
                      ✅ Đã chuyển khoản
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminShell>
  )
}
