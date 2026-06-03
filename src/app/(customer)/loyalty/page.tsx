"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

type TierLevel = "bronze" | "silver" | "gold" | "platinum"

interface PointTx {
  id: string
  points: number
  reason: string
  created_at: string
}

const TIER_CFG: Record<TierLevel, {
  label: string; icon: string; color: string; bg: string; border: string
  min: number; max: number; nextTier: TierLevel | null; nextMin: number | null
}> = {
  bronze:   { label: "Bronze",   icon: "🥉", color: "#cd7f32", bg: "linear-gradient(135deg,#1a0f05,#2a1a09)", border: "rgba(205,127,50,0.35)",  min: 0,     max: 999,   nextTier: "silver",   nextMin: 1000  },
  silver:   { label: "Silver",   icon: "🥈", color: "#b464ff", bg: "linear-gradient(135deg,#0d0a1a,#160d2a)", border: "rgba(180,100,255,0.35)", min: 1000,  max: 4999,  nextTier: "gold",     nextMin: 5000  },
  gold:     { label: "Gold",     icon: "🥇", color: "#f5c542", bg: "linear-gradient(135deg,#1a1200,#2d1f00)", border: "rgba(245,197,66,0.35)",  min: 5000,  max: 14999, nextTier: "platinum", nextMin: 15000 },
  platinum: { label: "Platinum", icon: "💎", color: "#4a8ff5", bg: "linear-gradient(135deg,#050d1a,#0a1530)", border: "rgba(74,143,245,0.35)",  min: 15000, max: 99999, nextTier: null,       nextMin: null  },
}

function getTier(points: number): TierLevel {
  if (points >= 15000) return "platinum"
  if (points >= 5000)  return "gold"
  if (points >= 1000)  return "silver"
  return "bronze"
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return `Hôm nay · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
  if (diffDays === 1) return `Hôm qua · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
  if (diffDays < 7)  return `${diffDays} ngày trước`
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`
}

export default function LoyaltyPage() {
  const supabase = createClient()
  const [points, setPoints]   = useState(0)
  const [history, setHistory] = useState<PointTx[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<"history" | "info">("history")

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [{ data: loyalty }, { data: txs }] = await Promise.all([
        supabase.from("loyalty_points").select("total_points").eq("user_id", user.id).single(),
        supabase.from("point_transactions").select("id, points, reason, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ])

      setPoints(loyalty?.total_points ?? 0)
      setHistory(txs ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const tier = getTier(points)
  const tierCfg = TIER_CFG[tier]
  const progressPct = tierCfg.nextMin
    ? Math.min(100, ((points - tierCfg.min) / (tierCfg.nextMin - tierCfg.min)) * 100)
    : 100
  const pointsToNext = tierCfg.nextMin ? tierCfg.nextMin - points : 0

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
        @keyframes tierGlow{0%,100%{box-shadow:0 0 20px rgba(180,100,255,0.3)}50%{box-shadow:0 0 40px rgba(180,100,255,0.5)}}
      `}</style>

      <div style={{ position: "fixed", inset: 0, background: "#080806", display: "flex", flexDirection: "column", fontFamily: "'Lexend',sans-serif" }}>

        {/* Header */}
        <div style={{ background: "rgba(8,8,6,0.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/profile" style={{ width: 32, height: 32, borderRadius: 9, textDecoration: "none", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>←</a>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 700 }}>Điểm Thưởng</div>
              <div style={{ color: "#6a5a40", fontSize: 11 }}>Tích điểm · Lên hạng · Đổi quà</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 88px", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[120, 80, 200].map((h, i) => (
                <div key={i} style={{ height: h, borderRadius: 16, background: "rgba(255,255,255,0.04)", animation: "shimmer 1.5s infinite" }} />
              ))}
            </div>
          ) : (
            <>
              {/* Tier Card */}
              <div style={{ background: tierCfg.bg, border: `1px solid ${tierCfg.border}`, borderRadius: 20, padding: "20px 18px", marginBottom: 12, position: "relative", overflow: "hidden", animation: "tierGlow 3s infinite" }}>
                <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, background: `radial-gradient(circle,${tierCfg.color}33 0%,transparent 65%)` }} />
                <div style={{ position: "absolute", top: 0, left: "-100%", width: "50%", height: "100%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)", animation: "shimmer 5s infinite" }} />

                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `${tierCfg.color}20`, border: `2px solid ${tierCfg.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                      {tierCfg.icon}
                    </div>
                    <div>
                      <div style={{ color: "#6a5a40", fontSize: 11, marginBottom: 2 }}>Hạng thành viên</div>
                      <div style={{ color: tierCfg.color, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{tierCfg.label}</div>
                    </div>
                    <div style={{ marginLeft: "auto", background: `${tierCfg.color}15`, border: `1px solid ${tierCfg.color}40`, borderRadius: 8, padding: "4px 10px", color: tierCfg.color, fontSize: 10, fontWeight: 700 }}>
                      #{(["bronze","silver","gold","platinum"] as TierLevel[]).indexOf(tier) + 1}/4
                    </div>
                  </div>

                  <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1, marginBottom: 4, background: `linear-gradient(135deg,${tierCfg.color},#fff)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    {points.toLocaleString()}
                    <span style={{ fontSize: 14, fontWeight: 400, WebkitTextFillColor: "unset", background: "none", color: "#6a5a40", marginLeft: 6 }}>điểm</span>
                  </div>

                  {tierCfg.nextTier && (
                    <>
                      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)", marginBottom: 6, overflow: "hidden" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPct}%` }}
                          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                          style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg,${tierCfg.color},${tierCfg.color}cc)` }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#6a5a40", fontSize: 11 }}>{tierCfg.label} · {tierCfg.min.toLocaleString()} điểm</span>
                        <span style={{ color: tierCfg.color, fontSize: 11, fontWeight: 600 }}>
                          Còn {pointsToNext.toLocaleString()} điểm → {tierCfg.nextTier && TIER_CFG[tierCfg.nextTier].label} {tierCfg.nextTier && TIER_CFG[tierCfg.nextTier].icon}
                        </span>
                      </div>
                    </>
                  )}
                  {!tierCfg.nextTier && (
                    <div style={{ color: tierCfg.color, fontSize: 11, fontWeight: 600 }}>💎 Bạn đang ở hạng cao nhất!</div>
                  )}
                </div>
              </div>

              {/* Cách tích điểm */}
              <div style={{ background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.15)", borderRadius: 14, padding: "11px 14px", marginBottom: 14 }}>
                <div style={{ color: "#FF8C00", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>💡 Cách tích điểm</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[
                    { icon: "🍜", text: "Đặt đồ ăn thành công: +1 điểm / 10.000đ" },
                    { icon: "🛵", text: "Đặt xe ôm / taxi thành công: +1 điểm / 10.000đ" },
                    { icon: "🛍️", text: "Mua hộ / Giao hộ thành công: +1 điểm / 10.000đ" },
                  ].map(b => (
                    <div key={b.text} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13 }}>{b.icon}</span>
                      <span style={{ color: "#b0956a", fontSize: 11 }}>{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {([["history", "📋 Lịch sử"], ["info", "🎁 Quyền lợi"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)}
                    style={{ flex: 1, height: 36, borderRadius: 10, background: tab === k ? "rgba(180,100,255,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${tab === k ? "rgba(180,100,255,0.4)" : "rgba(255,255,255,0.07)"}`, color: tab === k ? "#b464ff" : "#6a5a40", fontSize: 10, fontWeight: tab === k ? 700 : 400, cursor: "pointer", fontFamily: "Lexend", transition: "all .15s" }}>
                    {l}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {tab === "history" && (
                  <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    {history.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "40px 0", color: "#6a5a40", fontSize: 11 }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>🌟</div>
                        Chưa có lịch sử điểm.<br />Đặt hàng để bắt đầu tích điểm!
                      </div>
                    ) : (
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
                        {history.map((tx, i) => (
                          <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderBottom: i < history.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: tx.points > 0 ? "rgba(180,100,255,0.1)" : "rgba(255,64,64,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                              {tx.points > 0 ? "⭐" : "🔻"}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: "#f8f0e0", fontSize: 10.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.reason}</div>
                              <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 2 }}>{fmtTime(tx.created_at)}</div>
                            </div>
                            <div style={{ color: tx.points > 0 ? "#b464ff" : "#ff4040", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                              {tx.points > 0 ? "+" : ""}{tx.points.toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {tab === "info" && (
                  <motion.div key="info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(["bronze","silver","gold","platinum"] as TierLevel[]).map(t => {
                        const cfg = TIER_CFG[t]
                        const isCurrentTier = t === tier
                        return (
                          <div key={t} style={{ background: isCurrentTier ? cfg.bg : "rgba(255,255,255,0.03)", border: `1px solid ${isCurrentTier ? cfg.border : "rgba(255,255,255,0.07)"}`, borderRadius: 14, padding: "12px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                              <span style={{ fontSize: 22 }}>{cfg.icon}</span>
                              <div>
                                <div style={{ color: isCurrentTier ? cfg.color : "#b0956a", fontSize: 12, fontWeight: 700 }}>{cfg.label}</div>
                                <div style={{ color: "#6a5a40", fontSize: 11 }}>{cfg.min.toLocaleString()} – {cfg.max.toLocaleString()} điểm</div>
                              </div>
                              {isCurrentTier && (
                                <div style={{ marginLeft: "auto", background: `${cfg.color}20`, border: `1px solid ${cfg.color}40`, borderRadius: 6, padding: "2px 8px", color: cfg.color, fontSize: 11, fontWeight: 700 }}>Hạng hiện tại</div>
                              )}
                            </div>
                            <div style={{ color: "#b0956a", fontSize: 11 }}>
                              {t === "bronze"   && "Tích điểm cơ bản · Nhận thông báo ưu đãi"}
                              {t === "silver"   && "Tích điểm x1.2 · Quà sinh nhật · Ưu tiên hỗ trợ"}
                              {t === "gold"     && "Tích điểm x1.5 · Quà đặc biệt · Ưu tiên ghép đơn"}
                              {t === "platinum" && "Tích điểm x2 · VIP support 24/7 · Quà cao cấp hàng tháng"}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </>
  )
}
