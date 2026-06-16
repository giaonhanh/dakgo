"use client"

export const dynamic = "force-dynamic"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useCartStore } from "@/store/cartStore"
import { useLocationStore } from "@/store/locationStore"
import type { CartItem } from "@/store/cartStore"
import AddressPicker from "@/components/map/AddressPicker"
import type { AddressPickerResult } from "@/types"
import { formatPrice } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getRouteKm, calcDeliveryFee, calcDeliveryFeeFromPricing } from "@/lib/vietmapRoute"
import VoucherNudgeBar, { findNextThreshold } from "@/components/ui/VoucherNudgeBar"
import VoucherInlineHint from "@/components/ui/VoucherInlineHint"
import type { VoucherItem } from "@/components/ui/VoucherCard"

const supabase = createClient()

// ─── Types & Constants ────────────────────────────────────────

type ScheduledRange   = { start: string; end: string }
type ScheduleConflict = { level: "error" | "warn"; icon: string; title: string; detail: string }

interface AddrOption { id: string; label: string; address: string; isDefault: boolean; lat?: number; lng?: number }

const PAYMENT_METHODS = [
  { id: "cash",   label: "Tiền mặt",      icon: "💵", desc: "Trả tiền mặt khi nhận hàng"                  },
  { id: "vietqr", label: "VietQR / MoMo", icon: "📲", desc: "Chuyển khoản ngân hàng · MoMo · Ví điện tử" },
]

interface BankInfo { code: string; name: string; short: string; featured: boolean; isMomo?: boolean }

interface AppliedVoucher { code: string; type: "app" | "shop"; label: string; discount: number }

interface ComboRequirement { product_id: string; min_quantity: number; products: { name: string } | null }
interface DbVoucher {
  id: string; code: string; title: string
  discount_type: "percent" | "fixed" | "freeship"
  discount_value: number; min_order: number; max_discount: number | null
  valid_to: string; shop_id: string | null; is_active: boolean
  per_person_limit: number | null
  is_combo: boolean
  combo_items: ComboRequirement[] | null
}

function dbVoucherToVoucherItem(v: DbVoucher, appliedCodes: string[], userUsageMap: Record<string, number>): VoucherItem {
  const type: VoucherItem["type"] = v.is_combo ? "combo"
    : v.discount_type === "fixed"    ? "cash"
    : v.discount_type === "freeship" ? "freeship"
    : "percent"
  const perLimit      = v.per_person_limit
  const usedByUser    = userUsageMap[v.id] ?? 0
  const remainingUses = perLimit !== null ? Math.max(0, perLimit - usedByUser) : 999
  return {
    id: v.id, type,
    value:          v.discount_value,
    maxDiscount:    v.max_discount ?? undefined,
    minOrder:       v.min_order,
    title:          v.title,
    description:    "",
    expiresAt:      v.valid_to,
    remainingUses,
    totalUses:      perLimit ?? 999,
    isSaved:        false,
    isApplied:      appliedCodes.includes(v.code),
    shopId:         v.shop_id ?? undefined,
  }
}

function calcVoucherDiscount(v: DbVoucher, sub: number, fee: number): number {
  if (v.discount_type === "percent") return Math.min(Math.round(sub * v.discount_value / 100), v.max_discount ?? 999999)
  if (v.discount_type === "freeship") return fee
  return v.discount_value
}

function dbVoucherType(v: DbVoucher): "app" | "shop" { return v.shop_id ? "shop" : "app" }
const BANK_APPS: BankInfo[] = [
  // ─── MoMo ────────────────────────────────────────────
  { code: "momo",   name: "Ví MoMo",          short: "MoMo",       featured: true,  isMomo: true },
  // ─── Top 8 phổ biến Tây Nguyên ───────────────────────
  { code: "970405", name: "Agribank",          short: "Agribank",   featured: true  },
  { code: "970418", name: "BIDV",              short: "BIDV",       featured: true  },
  { code: "970436", name: "Vietcombank",       short: "VCB",        featured: true  },
  { code: "970415", name: "VietinBank",        short: "VietinBank", featured: true  },
  { code: "970422", name: "MB Bank",           short: "MB Bank",    featured: true  },
  { code: "970407", name: "Techcombank",       short: "TCB",        featured: true  },
  { code: "970449", name: "LienVietPostBank",  short: "LPBank",     featured: true  },
  { code: "970403", name: "Sacombank",         short: "Sacombank",  featured: true  },
  // ─── Các ngân hàng khác ───────────────────────────────
  { code: "970432", name: "VPBank",            short: "VPBank",     featured: false },
  { code: "970416", name: "ACB",               short: "ACB",        featured: false },
  { code: "970423", name: "TPBank",            short: "TPBank",     featured: false },
  { code: "970443", name: "SHB",               short: "SHB",        featured: false },
  { code: "970441", name: "VIB",               short: "VIB",        featured: false },
  { code: "970426", name: "MSB",               short: "MSB",        featured: false },
  { code: "970437", name: "HDBank",            short: "HDBank",     featured: false },
  { code: "970448", name: "OCB",               short: "OCB",        featured: false },
  { code: "970440", name: "SeABank",           short: "SeABank",    featured: false },
  { code: "970431", name: "Eximbank",          short: "Eximbank",   featured: false },
  { code: "970425", name: "ABBank",            short: "ABBank",     featured: false },
  { code: "546034", name: "CAKE by VPBank",    short: "CAKE",       featured: false },
]

const APP_OPEN_H  = 7
const APP_CLOSE_H = 21

const MOCK_PRODUCT_HOURS = [
  { match: "bún",     sellStart: 6,  sellEnd: 11 },
  { match: "phở",     sellStart: 6,  sellEnd: 10 },
  { match: "cháo",    sellStart: 6,  sellEnd: 11 },
  { match: "cơm",     sellStart: 10, sellEnd: 14 },
  { match: "bánh mì", sellStart: 6,  sellEnd: 10 },
  { match: "cà phê",  sellStart: 6,  sellEnd: 11 },
] as const

const MOCK_DRIVER_BANK = {
  bankCode:      "970405",
  bankName:      "Agribank",
  accountNumber: "1234567890",
  accountName:   "TRAN VAN BINH",
}

const APP_COMMISSION  = 0.15    // 15% — từ shops.commission_rate

type Payment = "cash" | "vietqr"
const fmt = formatPrice

// ─── VietQR Sheet ──────────────────────────────────────────────

interface PayOSData {
  qrCode: string; checkoutUrl: string
  accountNumber: string; accountName: string; bin: string
}

function VietQRSheet({
  total, orderCode, payosData, payosLoading,
  onClose, onConfirm, confirming,
}: {
  total: number; orderCode: number
  payosData: PayOSData | null; payosLoading: boolean
  onClose: () => void; onConfirm: () => void; confirming: boolean
}) {
  const [localBankCode, setLocalBankCode] = useState<string | null>(null)
  const [bankErr,       setBankErr]       = useState(false)
  const [qrLoaded,      setQrLoaded]      = useState(false)
  const [qrTimeout,     setQrTimeout]     = useState(false)
  const myBank  = localBankCode ? (BANK_APPS.find(b => b.code === localBankCode) ?? null) : null
  const content = `GN${orderCode}`

  const qrImageUrl = payosData
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(payosData.qrCode)}&size=200x200&color=000000&bgcolor=ffffff`
    : null

  // Timeout 5s nếu QR chưa tải xong — hiện hướng dẫn chuyển khoản thủ công
  useEffect(() => {
    if (!qrImageUrl || qrLoaded) return
    setQrTimeout(false)
    const t = setTimeout(() => setQrTimeout(true), 5000)
    return () => clearTimeout(t)
  }, [qrImageUrl, qrLoaded])

  const handleOpenBank = () => {
    if (!localBankCode) { setBankErr(true); setTimeout(() => setBankErr(false), 2500); return }
    if (localBankCode === "momo") {
      window.location.href = "momo://app"
      setTimeout(() => window.open("https://nhantien.momo.vn", "_blank"), 500)
      return
    }
    if (payosData) {
      // VietQR deep link trực tiếp vào app ngân hàng — dùng tài khoản PayOS thật
      window.location.href = `https://dl.vietqr.io/pay?bank=${payosData.bin}&account=${payosData.accountNumber}&amount=${total}&memo=${encodeURIComponent(content)}`
      return
    }
    window.location.href = `https://dl.vietqr.io/pay?bank=${localBankCode}&amount=${total}&memo=${encodeURIComponent(content)}`
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 400,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        fontFamily: "'Lexend', sans-serif",
      }}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        style={{
          background: "#0e0c09", borderRadius: "20px 20px 0 0",
          borderTop: "1px solid rgba(255,215,0,0.2)",
          maxHeight: "92dvh", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{
          padding: "14px 16px 12px", flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <button type="button" onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 9, border: "none",
            background: "rgba(255,255,255,0.06)", color: "#f8f0e0",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 14,
          }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700 }}>Thanh toán chuyển khoản</div>
            <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>
              Quét mã QR · Ngân hàng · MoMo
            </div>
          </div>
          <div style={{
            background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.3)",
            borderRadius: 8, padding: "4px 10px",
            color: "#3ecf6e", fontSize: 11, fontWeight: 700,
          }}>{fmt(total)}</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: 10,
              boxShadow: "0 0 40px rgba(255,215,0,0.18)",
              minWidth: 200, minHeight: 200,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {payosLoading ? (
                <div style={{ width: 180, height: 180, borderRadius: 8,
                  background: "linear-gradient(90deg,#f0f0f0,#e0e0e0,#f0f0f0)",
                  animation: "shimmer 1.5s infinite", display: "flex",
                  alignItems: "center", justifyContent: "center", color: "#999", fontSize: 12 }}>
                  Đang tạo QR...
                </div>
              ) : qrImageUrl && !qrTimeout ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrImageUrl} alt="PayOS QR" width={180} height={180}
                  style={{ display: "block", borderRadius: 8 }}
                  onLoad={() => setQrLoaded(true)}
                  onError={() => setQrTimeout(true)} />
              ) : (
                <div style={{ width: 180, height: 180, borderRadius: 8,
                  background: "#f5f5f5", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  color: "#666", fontSize: 10, gap: 6, padding: 12, textAlign: "center" }}>
                  <span style={{ fontSize: 28 }}>📋</span>
                  <span style={{ fontWeight: 700, fontSize: 11 }}>QR tải chậm</span>
                  <span>Dùng thông tin chuyển khoản bên dưới để thanh toán thủ công</span>
                </div>
              )}
            </div>
            <p style={{ marginTop: 10, fontSize: 10, color: "#6a5a40", textAlign: "center" }}>
              Dùng app ngân hàng hoặc MoMo quét mã QR này
            </p>
          </div>

          {/* Ghi chú tài khoản đại diện */}
          <div style={{
            background: "rgba(62,207,110,0.06)", border: "1px solid rgba(62,207,110,0.2)",
            borderRadius: 12, padding: "11px 13px", marginBottom: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
              <span style={{ fontSize: 15 }}>🔒</span>
              <span style={{ color: "#3ecf6e", fontSize: 11, fontWeight: 700 }}>Thanh toán an toàn qua Giao Nhanh</span>
            </div>
            <div style={{ color: "#b0956a", fontSize: 11, lineHeight: 1.7 }}>
              • Tiền được giữ bởi <strong style={{ color: "#f8f0e0" }}>tài khoản đại diện Giao Nhanh</strong> — không phải tài khoản cá nhân tài xế.<br />
              • Tài xế chỉ nhận tiền sau khi <strong style={{ color: "#f8f0e0" }}>giao hàng thành công</strong>.<br />
              • Nếu đơn không được giao, <strong style={{ color: "#3ecf6e" }}>hoàn tiền 100%</strong> về nguồn trong vòng 24h.
            </div>
          </div>

          <div style={{
            background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)",
            borderRadius: 14, padding: "12px 14px", marginBottom: 18,
          }}>
            <div style={{
              color: "rgba(255,215,0,0.5)", fontSize: 11, fontWeight: 700,
              letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10,
            }}>Thông tin chuyển khoản</div>
            {[
              { label: "Số tài khoản", val: payosData?.accountNumber ?? "—", hi: false },
              { label: "Tên tài khoản",val: payosData?.accountName   ?? "—", hi: false },
              { label: "Vai trò",      val: "Đại diện Giao Nhanh",            hi: false },
              { label: "Số tiền",      val: fmt(total),                        hi: true  },
              { label: "Nội dung CK", val: content,                           hi: false },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                <span style={{ color: "#6a5a40", fontSize: 10 }}>{row.label}</span>
                <span style={{ color: row.hi ? "#FFD700" : "#f8f0e0", fontSize: row.hi ? 13 : 11, fontWeight: row.hi ? 800 : 600 }}>{row.val}</span>
              </div>
            ))}
          </div>

          {/* Dropdown chọn ngân hàng (trống mặc định) */}
          <BankDropdown selected={localBankCode} onSelect={code => { setLocalBankCode(code); setBankErr(false) }} />

          {/* Cảnh báo chưa chọn ngân hàng */}
          <AnimatePresence>
            {bankErr && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  marginBottom: 10, padding: "8px 12px", borderRadius: 10,
                  background: "rgba(255,64,64,0.08)", border: "1px solid rgba(255,64,64,0.25)",
                  color: "#ff4040", fontSize: 10.5, fontWeight: 600, textAlign: "center",
                }}>
                ⚠️ Vui lòng chọn ngân hàng trước khi mở app
              </motion.div>
            )}
          </AnimatePresence>

          {/* Nút mở app ngân hàng / MoMo */}
          <button type="button" onClick={handleOpenBank}
            style={{
              width: "100%", height: 52, borderRadius: 14, border: "none", cursor: "pointer",
              background: myBank
                ? myBank.isMomo
                  ? "linear-gradient(90deg,#ae2070,#d72d8c)"
                  : "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)"
                : "rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              marginBottom: myBank?.isMomo ? 8 : 4,
              boxShadow: myBank
                ? myBank.isMomo
                  ? "0 4px 20px rgba(215,45,140,0.4)"
                  : "0 4px 20px rgba(255,107,0,0.4)"
                : "none",
              position: "relative", overflow: "hidden", transition: "all .2s",
            }}>
            {myBank && (
              <div style={{ position:"absolute", top:0, left:"-60%", width:"35%", height:"100%",
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)",
                animation:"ckShim 2.5s infinite" }} />
            )}
            {myBank ? (
              <>
                {myBank.isMomo ? (
                  <span style={{ fontSize: 22, position: "relative" }}>💜</span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={`https://img.vietqr.io/image/${myBank.code}/logo.png`}
                    alt={myBank.name} width={28} height={28} loading="lazy"
                    style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0, position: "relative" }}
                    onError={e => { e.currentTarget.style.display = "none" }} />
                )}
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "Lexend", position: "relative" }}>
                  {myBank.isMomo ? "Mở MoMo · Quét mã QR" : `Mở ${myBank.name}`}
                </span>
              </>
            ) : (
              <span style={{ color: "#6a5a40", fontSize: 13, fontWeight: 600, fontFamily: "Lexend" }}>
                🏦 Chọn ngân hàng để mở app
              </span>
            )}
          </button>
          {myBank?.isMomo && (
            <div style={{ color: "#6a5a40", fontSize: 11, textAlign: "center", marginBottom: 4 }}>
              Trong MoMo: nhấn <strong style={{ color: "#b0956a" }}>Quét mã</strong> → scan QR bên trên để thanh toán
            </div>
          )}
        </div>

        <div style={{ padding: "12px 16px 28px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0e0c09" }}>
          <button type="button" onClick={onConfirm} disabled={confirming} style={{
            width: "100%", height: 52, borderRadius: 14, border: "none",
            background: confirming ? "rgba(255,255,255,0.08)" : "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
            color: confirming ? "#6a5a40" : "#fff",
            fontSize: 14, fontWeight: 800, fontFamily: "Lexend", cursor: "pointer",
            boxShadow: confirming ? "none" : "0 4px 24px rgba(255,107,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            position: "relative", overflow: "hidden",
          }}>
            {!confirming && (
              <div style={{
                position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                animation: "ckShim 2.5s infinite",
              }} />
            )}
            <span style={{ position: "relative", zIndex: 1 }}>
              {confirming ? "Đang đặt hàng..." : "🛵 Xác nhận đặt hàng"}
            </span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── UI Primitives ─────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, padding: "13px 14px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <div style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700 }}>{title}</div>
      </div>
      {children}
    </div>
  )
}

function RadioRow({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 11px", borderRadius: 10, cursor: "pointer",
      background: active ? "rgba(255,107,0,0.07)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${active ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.06)"}`,
      marginBottom: 7, transition: "all .18s",
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${active ? "#FF6B00" : "rgba(255,255,255,0.2)"}`,
        background: active ? "#FF6B00" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
      </div>
      {children}
    </div>
  )
}

// ─── Address Sheet ────────────────────────────────────────────

function AddressSheet({
  savedAddrs, tempAddr, selectedId, tierLimit,
  onSelect, onMapPick, onClose,
}: {
  savedAddrs: AddrOption[]; tempAddr: AddrOption | null
  selectedId: string; tierLimit: number
  onSelect: (id: string) => void; onMapPick: () => void; onClose: () => void
}) {
  const atLimit    = savedAddrs.length >= tierLimit
  const displayAll = [...(tempAddr ? [tempAddr] : []), ...savedAddrs]

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 350,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        fontFamily: "'Lexend', sans-serif",
      }}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0e0c09", borderRadius: "20px 20px 0 0",
          borderTop: "1px solid rgba(255,107,0,0.2)",
          maxHeight: "80dvh", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>
        <div style={{
          padding: "4px 16px 12px", flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <button type="button" onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: "none",
            background: "rgba(255,255,255,0.06)", color: "#f8f0e0",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 13, flexShrink: 0,
          }}>←</button>
          <span style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700 }}>Chọn địa chỉ giao hàng</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 20px" }}>
          {displayAll.map(addr => (
            <div key={addr.id} onClick={() => { onSelect(addr.id); onClose() }} style={{
              display: "flex", alignItems: "center", gap: 11,
              padding: "11px 12px", borderRadius: 12, cursor: "pointer", marginBottom: 8,
              background: selectedId === addr.id ? "rgba(255,107,0,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${selectedId === addr.id ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.06)"}`,
              transition: "all .15s",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: selectedId === addr.id ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
              }}>
                {addr.id === "map" ? "🗺️" : addr.label.split(" ")[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, flexWrap: "wrap" }}>
                  <span style={{ color: "#f8f0e0", fontSize: 11.5, fontWeight: 600 }}>{addr.label}</span>
                  {addr.isDefault && (
                    <span style={{ background: "rgba(62,207,110,0.12)", color: "#3ecf6e", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>Mặc định</span>
                  )}
                  {addr.id === "map" && (
                    <span style={{ background: "rgba(255,107,0,0.1)", color: "#FF8C00", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>Tạm thời</span>
                  )}
                </div>
                <div style={{ color: "#6a5a40", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {addr.address}
                </div>
              </div>
              {selectedId === addr.id && <span style={{ color: "#FF6B00", fontSize: 15, flexShrink: 0 }}>✓</span>}
            </div>
          ))}

          <button type="button" onClick={() => { onMapPick(); onClose() }} style={{
            width: "100%", height: 44, borderRadius: 12, cursor: "pointer",
            background: "rgba(255,215,0,0.05)", border: "1px dashed rgba(255,215,0,0.3)",
            color: "rgba(255,215,0,0.85)", fontSize: 11, fontWeight: 600, fontFamily: "Lexend",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            marginBottom: atLimit ? 12 : 0,
          }}>
            <span style={{ fontSize: 16 }}>🗺️</span>Chọn vị trí trên bản đồ
          </button>

          {atLimit && (
            <div style={{
              padding: "10px 12px", borderRadius: 11,
              background: "rgba(180,100,255,0.07)", border: "1px solid rgba(180,100,255,0.2)",
              display: "flex", alignItems: "flex-start", gap: 8,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>🔐</span>
              <div>
                <div style={{ color: "#b464ff", fontSize: 10, fontWeight: 700, marginBottom: 3 }}>
                  Đã dùng {savedAddrs.length}/{tierLimit} địa chỉ lưu (Hạng Bronze)
                </div>
                <div style={{ color: "#6a5a40", fontSize: 11, lineHeight: 1.6 }}>
                  Địa chỉ mới từ bản đồ sẽ chỉ dùng <strong style={{ color: "#b0956a" }}>tạm thời</strong> cho đơn này.<br />
                  Lên hạng <strong style={{ color: "#b464ff" }}>Silver ✦</strong> để lưu địa chỉ thứ 3.
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Bank Dropdown ────────────────────────────────────────────

function BankDropdown({
  selected, onSelect,
}: {
  selected: string | null; onSelect: (code: string) => void
}) {
  const [open, setOpen] = useState(false)
  const bank = selected ? (BANK_APPS.find(b => b.code === selected) ?? null) : null

  return (
    <div style={{ position: "relative", marginBottom: 8 }}>
      {/* Trigger row */}
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: open ? "12px 12px 0 0" : 12, cursor: "pointer",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${open ? "rgba(255,107,0,0.4)" : bank ? "rgba(255,107,0,0.25)" : "rgba(255,255,255,0.08)"}`,
        borderBottom: open ? "none" : undefined,
        transition: "all .15s",
      }}>
        {bank ? (
          bank.isMomo ? (
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: "linear-gradient(135deg,#ae2070,#d72d8c)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>💜</div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`https://img.vietqr.io/image/${bank.code}/logo.png`}
              alt={bank.name} width={32} height={32} loading="lazy"
              style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
              onError={e => { e.currentTarget.style.display = "none" }} />
          )
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>🏦</div>
        )}
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ color: bank ? "#f8f0e0" : "#6a5a40", fontSize: 11.5, fontWeight: 700, fontFamily: "Lexend" }}>
            {bank ? bank.name : "Chọn ngân hàng của bạn"}
          </div>
          <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>Ngân hàng bạn dùng để quét QR</div>
        </div>
        <span style={{ color: "#6a5a40", fontSize: 12, transition: "transform .2s",
          display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>

      {/* Dropdown list */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ maxHeight: 0, opacity: 0 }} animate={{ maxHeight: 600, opacity: 1 }}
            exit={{ maxHeight: 0, opacity: 0 }} transition={{ duration: 0.18, ease: "easeOut" }}
            style={{
              overflow: "hidden", position: "relative", zIndex: 10,
              borderRadius: "0 0 12px 12px",
              border: "1px solid rgba(255,107,0,0.4)", borderTop: "none",
              background: "#0e0c09",
            }}>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {/* Ví điện tử */}
              <div style={{
                padding: "6px 12px 4px",
                color: "#6a5a40", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.7,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>💜 Ví điện tử</div>
              {BANK_APPS.filter(b => b.isMomo).map(b => (
                <BankRow key={b.code} bank={b} selected={selected} onSelect={code => { onSelect(code); setOpen(false) }} />
              ))}
              {/* Ngân hàng phổ biến */}
              <div style={{
                padding: "6px 12px 4px",
                color: "#6a5a40", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.7,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                borderTop: "1px solid rgba(255,255,255,0.05)",
              }}>🌟 Ngân hàng phổ biến</div>
              {BANK_APPS.filter(b => b.featured && !b.isMomo).map(b => (
                <BankRow key={b.code} bank={b} selected={selected} onSelect={code => { onSelect(code); setOpen(false) }} />
              ))}
              {/* Ngân hàng khác */}
              <div style={{
                padding: "6px 12px 4px",
                color: "#6a5a40", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.7,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                borderTop: "1px solid rgba(255,255,255,0.05)",
              }}>Ngân hàng khác</div>
              {BANK_APPS.filter(b => !b.featured).map(b => (
                <BankRow key={b.code} bank={b} selected={selected} onSelect={code => { onSelect(code); setOpen(false) }} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BankRow({ bank, selected, onSelect }: { bank: BankInfo; selected: string | null; onSelect: (code: string) => void }) {
  const active = bank.code === selected
  return (
    <button type="button" onClick={() => onSelect(bank.code)} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 10,
      padding: "8px 12px", cursor: "pointer",
      background: active
        ? bank.isMomo ? "rgba(215,45,140,0.1)" : "rgba(255,107,0,0.08)"
        : "transparent",
      border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
      transition: "background .12s",
    }}>
      {bank.isMomo ? (
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: "linear-gradient(135deg,#ae2070,#d72d8c)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
        }}>💜</div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={`https://img.vietqr.io/image/${bank.code}/logo.png`}
          alt={bank.name} width={28} height={28} loading="lazy"
          style={{ borderRadius: 7, objectFit: "cover", flexShrink: 0 }}
          onError={e => { e.currentTarget.style.display = "none" }} />
      )}
      <span style={{
        flex: 1, textAlign: "left",
        color: active ? (bank.isMomo ? "#d72d8c" : "#FF8C00") : "#b0956a",
        fontSize: 11, fontWeight: active ? 700 : 400, fontFamily: "Lexend",
      }}>{bank.name}</span>
      {active && <span style={{ color: bank.isMomo ? "#d72d8c" : "#FF6B00", fontSize: 12 }}>✓</span>}
    </button>
  )
}

// ─── Voucher Picker Sheet ─────────────────────────────────────

function VoucherPickerSheet({
  appliedVouchers, subtotal, deliveryFee, onApply, onClose, vouchers, userUsageMap, shopId,
}: {
  appliedVouchers: AppliedVoucher[]
  subtotal: number; deliveryFee: number
  onApply: (code: string) => void
  onClose: () => void
  vouchers: DbVoucher[]
  userUsageMap: Record<string, number>
  shopId: string | null
}) {
  const appVouchers  = vouchers.filter(v => dbVoucherType(v) === "app")
  // Chỉ hiển thị voucher quán khớp với quán hiện tại trong giỏ hàng
  const shopVouchers = vouchers.filter(v => dbVoucherType(v) === "shop" && (!shopId || v.shop_id === shopId))

  const rowStatus = (v: DbVoucher) => {
    const code = v.code; const type = dbVoucherType(v)
    if (appliedVouchers.some(x => x.code === code))                                           return "applied"
    if (appliedVouchers.length >= 2)                                                          return "full"
    if (appliedVouchers.some(x => x.type === type))                                           return "conflict"
    if (v.per_person_limit !== null && (userUsageMap[v.id] ?? 0) >= v.per_person_limit)          return "maxed"
    return "available"
  }

  const VoucherRow = ({ v }: { v: DbVoucher }) => {
    const vType  = dbVoucherType(v)
    const status = rowStatus(v)
    const disc   = calcVoucherDiscount(v, subtotal, deliveryFee)
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: status === "applied" ? "rgba(62,207,110,0.04)" : "transparent",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: vType === "shop" ? "rgba(74,143,245,0.12)" : "rgba(255,107,0,0.12)",
          border: `1px solid ${vType === "shop" ? "rgba(74,143,245,0.25)" : "rgba(255,107,0,0.25)"}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>
          {vType === "shop" ? "🏪" : "🏷️"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: vType === "shop" ? "#4a8ff5" : "#FF8C00", fontSize: 11, fontWeight: 800, letterSpacing: 0.8 }}>
              {v.code}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
              background: vType === "shop" ? "rgba(74,143,245,0.12)" : "rgba(255,107,0,0.12)",
              color: vType === "shop" ? "#4a8ff5" : "#FF8C00",
            }}>
              {vType === "shop" ? "Quán" : "App"}
            </span>
          </div>
          <div style={{ color: "#b0956a", fontSize: 11, marginTop: 2 }}>{v.title}</div>
          <div style={{ color: "#3ecf6e", fontSize: 11, marginTop: 1, fontWeight: 700 }}>
            Giảm {disc.toLocaleString("vi-VN")}đ
          </div>
        </div>
        {status === "applied" ? (
          <span style={{ color: "#3ecf6e", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>✓ Đã áp</span>
        ) : status === "conflict" ? (
          <span style={{ color: "#6a5a40", fontSize: 11, flexShrink: 0, textAlign: "right", maxWidth: 60, lineHeight: 1.3 }}>Đã có<br/>loại này</span>
        ) : status === "full" ? (
          <span style={{ color: "#6a5a40", fontSize: 11, flexShrink: 0 }}>Đã đủ</span>
        ) : status === "maxed" ? (
          <span style={{ color: "#ff4040", fontSize: 11, flexShrink: 0, textAlign: "right", maxWidth: 68, lineHeight: 1.3 }}>Đã dùng<br/>tối đa {v.per_person_limit} lần</span>
        ) : (
          <button type="button" onClick={() => { onApply(v.code); onClose() }} style={{
            height: 28, padding: "0 10px", borderRadius: 8, border: "none",
            background: "rgba(255,107,0,0.15)", color: "#FF8C00",
            fontSize: 10, fontWeight: 700, fontFamily: "Lexend", cursor: "pointer", flexShrink: 0,
          }}>
            Dùng ngay
          </button>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 370,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        fontFamily: "'Lexend', sans-serif",
      }}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0e0c09", borderRadius: "20px 20px 0 0",
          borderTop: "1px solid rgba(255,107,0,0.2)",
          maxHeight: "78dvh", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>
        <div style={{
          padding: "4px 16px 12px", flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <button type="button" onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: "none",
            background: "rgba(255,255,255,0.06)", color: "#f8f0e0",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
          }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700 }}>🎟️ Túi Voucher</div>
            <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>
              Chọn tối đa 1 voucher app + 1 voucher quán
            </div>
          </div>
          {appliedVouchers.length > 0 && (
            <div style={{
              background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.3)",
              borderRadius: 8, padding: "3px 8px", color: "#3ecf6e", fontSize: 11, fontWeight: 700,
            }}>
              Đã áp {appliedVouchers.length}/2
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* App vouchers */}
          <div style={{
            padding: "8px 14px 5px",
            color: "#6a5a40", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.8,
          }}>🏷️ Voucher ứng dụng</div>
          {appVouchers.map(v => <VoucherRow key={v.code} v={v} />)}

          {/* Shop vouchers */}
          <div style={{
            padding: "10px 14px 5px",
            color: "#6a5a40", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.8,
            borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 4,
          }}>🏪 Voucher quán này</div>
          {shopVouchers.map(v => <VoucherRow key={v.code} v={v} />)}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Time Schedule Sheet ──────────────────────────────────────

function TimeScheduleSheet({
  nowDate, shopOpenH, shopCloseH, cartItems, initial,
  onConfirm, onOrderNow, onClose,
}: {
  nowDate: Date; shopOpenH: number; shopCloseH: number
  cartItems: CartItem[]; initial: ScheduledRange | null
  onConfirm: (range: ScheduledRange) => void
  onOrderNow: () => void
  onClose: () => void
}) {
  const pad      = (n: number) => String(n).padStart(2, "0")
  const toMins   = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m }
  const fromMins = (mins: number) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`
  const nowMins  = nowDate.getHours() * 60 + nowDate.getMinutes()

  const clampStart = (m: number) =>
    Math.max(Math.max(nowMins, shopOpenH * 60), Math.min(m, shopCloseH * 60 - 30))
  const autoEnd = (startM: number) =>
    Math.min(startM + 60, shopCloseH * 60)

  const initStart = fromMins(clampStart(nowMins + 60))
  const [startTime, setStartTime] = useState(initial?.start ?? initStart)
  const [endTime,   setEndTime]   = useState(initial?.end   ?? fromMins(autoEnd(clampStart(nowMins + 60))))
  const [quickSel,  setQuickSel]  = useState<number | null>(null)

  const handleQuick = (plusMins: number) => {
    const s = clampStart(nowMins + plusMins)
    const e = autoEnd(s)
    setStartTime(fromMins(s)); setEndTime(fromMins(e)); setQuickSel(plusMins)
  }

  const handleStartChange = (val: string) => {
    const s = toMins(val)
    setStartTime(val)
    setEndTime(fromMins(autoEnd(s)))
    setQuickSel(null)
  }

  const handleEndChange = (val: string) => {
    const s = toMins(startTime)
    const e = toMins(val)
    const clamped = e <= s ? s + 30 : e - s > 60 ? s + 60 : e
    setEndTime(fromMins(Math.min(clamped, shopCloseH * 60)))
    setQuickSel(null)
  }

  const startMins = toMins(startTime)
  const endMins   = toMins(endTime)
  const selH      = Math.floor(startMins / 60)
  const minsUntil = startMins - nowMins
  const durationM = endMins - startMins
  const tooSoon   = minsUntil >= 0 && minsUntil <= 30

  const conflicts: ScheduleConflict[] = (() => {
    const out: ScheduleConflict[] = []
    if (selH < APP_OPEN_H || selH >= APP_CLOSE_H)
      out.push({ level: "error", icon: "🚫",
        title: "Ngoài giờ hoạt động của App",
        detail: `App nhận đơn từ ${pad(APP_OPEN_H)}:00 đến ${pad(APP_CLOSE_H)}:00` })
    if (selH < shopOpenH || selH >= shopCloseH)
      out.push({ level: "error", icon: "🏪",
        title: "Cửa hàng đóng cửa lúc này",
        detail: `Quán hoạt động từ ${pad(shopOpenH)}:00 đến ${pad(shopCloseH)}:00` })
    for (const item of cartItems) {
      const r = MOCK_PRODUCT_HOURS.find(p => item.name.toLowerCase().includes(p.match))
      if (r && (selH < r.sellStart || selH >= r.sellEnd))
        out.push({ level: "warn", icon: "🍽️",
          title: `"${item.name}" không bán lúc ${startTime}`,
          detail: `Chỉ bán từ ${pad(r.sellStart)}:00 đến ${pad(r.sellEnd)}:00` })
    }
    return out
  })()
  const hasError = conflicts.some(c => c.level === "error")

  const minStart = fromMins(Math.max(nowMins + 30, shopOpenH * 60))
  const maxStart = fromMins(shopCloseH * 60 - 30)
  const maxEnd   = fromMins(Math.min(startMins + 60, shopCloseH * 60))

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 360,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        fontFamily: "'Lexend', sans-serif",
      }}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0e0c09", borderRadius: "20px 20px 0 0",
          borderTop: "1px solid rgba(255,107,0,0.2)",
          maxHeight: "88dvh", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Header */}
        <div style={{
          padding: "4px 16px 12px", flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <button type="button" onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: "none",
            background: "rgba(255,255,255,0.06)", color: "#f8f0e0",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 13, flexShrink: 0,
          }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700 }}>Hẹn giờ giao hàng</div>
            <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>
              Tối đa 1 tiếng · Giúp quán & tài xế chuẩn bị đúng giờ
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>

          {/* Quick chips */}
          <div style={{
            color: "#6a5a40", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10,
          }}>Gợi ý nhanh</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {([30, 60, 90] as const).map(mins => {
              const sLabel = fromMins(clampStart(nowMins + mins))
              const isAct  = quickSel === mins
              return (
                <button key={mins} type="button" onClick={() => handleQuick(mins)} style={{
                  flex: 1, height: 60, borderRadius: 12, cursor: "pointer",
                  background: isAct ? "rgba(255,107,0,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isAct ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.08)"}`,
                  transition: "all .15s", fontFamily: "Lexend", outline: "none",
                }}>
                  <div style={{ color: isAct ? "#FF8C00" : "#f8f0e0", fontSize: 15, fontWeight: 800 }}>
                    +{mins}p
                  </div>
                  <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 3 }}>~{sLabel}</div>
                </button>
              )
            })}
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ color: "#6a5a40", fontSize: 11, flexShrink: 0 }}>hoặc chọn thủ công</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* Time inputs */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                color: "#6a5a40", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7,
              }}>Bắt đầu</div>
              <input type="time" value={startTime} min={minStart} max={maxStart}
                onChange={e => handleStartChange(e.target.value)}
                style={{
                  width: "100%", height: 54, borderRadius: 12, border: "none",
                  background: "rgba(255,107,0,0.08)",
                  outline: "1px solid rgba(255,107,0,0.32)",
                  color: "#f8f0e0", fontSize: 22, fontWeight: 800,
                  fontFamily: "Lexend", textAlign: "center", cursor: "pointer",
                } as React.CSSProperties}
              />
            </div>
            <div style={{ color: "#6a5a40", fontSize: 20, paddingBottom: 16, flexShrink: 0 }}>→</div>
            <div style={{ flex: 1 }}>
              <div style={{
                color: "#6a5a40", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7,
              }}>
                Kết thúc
                <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 4 }}>(tối đa +1h)</span>
              </div>
              <input type="time" value={endTime} min={startTime} max={maxEnd}
                onChange={e => handleEndChange(e.target.value)}
                style={{
                  width: "100%", height: 54, borderRadius: 12, border: "none",
                  background: "rgba(255,255,255,0.05)",
                  outline: "1px solid rgba(255,255,255,0.1)",
                  color: "#b0956a", fontSize: 22, fontWeight: 700,
                  fontFamily: "Lexend", textAlign: "center", cursor: "pointer",
                } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Duration row */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "7px 12px", borderRadius: 9, marginBottom: 14,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ color: "#6a5a40", fontSize: 11 }}>Khoảng thời gian</span>
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              color: durationM > 60 ? "#ff4040" : durationM < 15 ? "#f5c542" : "#3ecf6e",
            }}>
              {durationM > 0 ? `${durationM} phút` : "—"}
              {durationM === 60 ? " · tối đa" : durationM > 60 ? " · vượt giới hạn ⚠️" : ""}
            </span>
          </div>

          {/* Too soon warning */}
          {tooSoon && (
            <div style={{
              padding: "10px 12px", borderRadius: 11, marginBottom: 10,
              background: "rgba(245,197,66,0.07)", border: "1px solid rgba(245,197,66,0.25)",
              display: "flex", alignItems: "center", gap: 9,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#f5c542", fontSize: 10.5, fontWeight: 600 }}>
                  Giờ hẹn sắp đến (~{minsUntil} phút nữa)
                </div>
                <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>
                  Tài xế có thể không kịp chuẩn bị đơn
                </div>
              </div>
              <button type="button" onClick={onOrderNow} style={{
                height: 28, padding: "0 10px", borderRadius: 7, border: "none",
                background: "rgba(245,197,66,0.18)", color: "#f5c542",
                fontSize: 11, fontWeight: 700, fontFamily: "Lexend",
                cursor: "pointer", flexShrink: 0,
              }}>Đặt ngay</button>
            </div>
          )}

          {/* Conflict banners */}
          {conflicts.map((c, i) => (
            <div key={i} style={{
              padding: "10px 12px", borderRadius: 11, marginBottom: 8,
              background: c.level === "error" ? "rgba(255,64,64,0.07)" : "rgba(245,197,66,0.06)",
              border: `1px solid ${c.level === "error" ? "rgba(255,64,64,0.25)" : "rgba(245,197,66,0.22)"}`,
              display: "flex", alignItems: "flex-start", gap: 9,
            }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
              <div>
                <div style={{
                  color: c.level === "error" ? "#ff4040" : "#f5c542",
                  fontSize: 10.5, fontWeight: 700, marginBottom: 3,
                }}>{c.title}</div>
                <div style={{ color: "#6a5a40", fontSize: 11, lineHeight: 1.5 }}>{c.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{
          padding: "12px 16px 28px", flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0e0c09",
        }}>
          <button type="button"
            onClick={() => { if (!hasError) onConfirm({ start: startTime, end: endTime }) }}
            disabled={hasError}
            style={{
              width: "100%", height: 50, borderRadius: 14, border: "none",
              background: hasError
                ? "rgba(255,255,255,0.07)"
                : "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
              color: hasError ? "#6a5a40" : "#fff",
              fontSize: 13, fontWeight: 800, fontFamily: "Lexend",
              cursor: hasError ? "not-allowed" : "pointer",
              boxShadow: hasError ? "none" : "0 4px 20px rgba(255,107,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              position: "relative", overflow: "hidden",
            }}>
            {!hasError && (
              <div style={{
                position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                animation: "ckShim 2.5s infinite",
              }} />
            )}
            <span style={{ position: "relative", zIndex: 1, fontSize: 16 }}>
              {hasError ? "⚠️" : "📅"}
            </span>
            <span style={{ position: "relative", zIndex: 1 }}>
              {hasError ? "Vui lòng chọn giờ khác" : `Xác nhận · ${startTime} – ${endTime}`}
            </span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter()
  const { items: cartItems, clearCart } = useCartStore()

  const [selectedAddr,     setSelectedAddr]     = useState("")
  const [savedAddrs,       setSavedAddrs]       = useState<AddrOption[]>([])
  const [xuBalance,        setXuBalance]        = useState(0)
  const [xuBonus,          setXuBonus]          = useState(0)
  const [xuWalletId,       setXuWalletId]       = useState<string | null>(null)
  const [userId,           setUserId]           = useState<string | null>(null)
  const [payment,          setPayment]          = useState<Payment>("cash")
  const [deliveryNow,      setDeliveryNow]      = useState(true)
  const [scheduledTime,    setScheduledTime]    = useState<ScheduledRange | null>(null)
  const [showTimeSheet,    setShowTimeSheet]    = useState(false)
  const [voucherInput,     setVoucherInput]     = useState("")
  const [appliedVouchers,  setAppliedVouchers]  = useState<AppliedVoucher[]>([])
  const [dbVouchers,       setDbVouchers]       = useState<DbVoucher[]>([])
  const [userUsageMap,     setUserUsageMap]     = useState<Record<string, number>>({})
  const [showVoucherPicker,setShowVoucherPicker] = useState(false)
  const [driverNote,       setDriverNote]       = useState("")
  const [loading,          setLoading]          = useState(false)
  const [pageReady,        setPageReady]        = useState(false)
  const [toast,            setToast]            = useState("")
  const [showMapPicker,    setShowMapPicker]    = useState(false)
  const [showVietQR,       setShowVietQR]       = useState(false)
  const [payosData,        setPayosData]        = useState<PayOSData | null>(null)
  const [useXuGN,          setUseXuGN]          = useState(false)
  const [useXuRef,         setUseXuRef]         = useState(false)
  const [payosLoading,     setPayosLoading]     = useState(false)
  const [mapAddress,       setMapAddress]       = useState<{ address: string; lat: number; lng: number } | null>(null)
  const [showAddressSheet, setShowAddressSheet] = useState(false)
  const [orderCode]                             = useState(() => Date.now() % 100_000_000)
  const [nowDate]                               = useState(() => new Date())
  const [refInput,   setRefInput]               = useState("")
  const [refApplied, setRefApplied]             = useState(false)
  const [refLoading, setRefLoading]             = useState(false)
  const [refMsg,     setRefMsg]                 = useState<{ ok: boolean; text: string } | null>(null)
  const [refAlready, setRefAlready]             = useState(false)
  const [surcharge,      setSurcharge]      = useState(0)
  const [surchargeLabel, setSurchargeLabel] = useState<string | null>(null)
  const [shopCoords,     setShopCoords]     = useState<{ lat: number; lng: number } | null>(null)
  const [shopOpenH,      setShopOpenH]      = useState(7)
  const [shopCloseH,     setShopCloseH]     = useState(21)
  const [routeKm,        setRouteKm]        = useState<number | null>(null)
  const [deliveryFee,    setDeliveryFee]    = useState(15000)
  const [feeLoading,     setFeeLoading]     = useState(false)
  const [foodPricing,    setFoodPricing]    = useState<{ rows: string[]; extra: string } | null>(null)
  // ── Load user, saved addresses, xu balance ──
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [{ data: addrs }, { data: wallet }, { data: voucherData }, { data: refUsage }, { data: settingsData }] = await Promise.all([
        supabase.from("saved_addresses").select("id, label, address, lat, lng, is_default").eq("user_id", user.id).order("is_default", { ascending: false }),
        supabase.from("wallets").select("id, balance, bonus_balance").eq("user_id", user.id).eq("type", "customer").maybeSingle(),
        supabase.from("vouchers").select("id,code,title,discount_type,discount_value,min_order,max_discount,valid_to,shop_id,is_active,per_person_limit,is_combo,combo_items(product_id,min_quantity,products(name))").eq("is_active", true).gte("valid_to", new Date().toISOString()).limit(30),
        supabase.from("referral_usages").select("id").eq("referee_id", user.id).maybeSingle(),
        supabase.from("app_settings").select("key,value").in("key", ["weather_surcharge","night_surcharge","pricing"]),
      ])

      // Tính phụ phí có điều kiện
      const settingsMap = Object.fromEntries((settingsData ?? []).map((r: {key:string;value:unknown}) => [r.key, r.value]))

      // Giá cước giao đồ ăn từ admin
      const pricingCfg = settingsMap.pricing as Record<string, { rows: string[]; extra: string }> | undefined
      if (pricingCfg?.food?.rows) setFoodPricing({ rows: pricingCfg.food.rows, extra: pricingCfg.food.extra ?? "5000" })
      const weatherCfg = settingsMap.weather_surcharge as { enabled: boolean; type: "percent"|"fixed"; value: string } | undefined
      const nightCfg   = settingsMap.night_surcharge   as { enabled: boolean; start: string; end: string; fee: string } | undefined
      const nowH = new Date().getHours()
      const nightStart = nightCfg?.start ? parseInt(nightCfg.start) : 22
      const nightEnd   = nightCfg?.end   ? parseInt(nightCfg.end)   : 5
      const isNight    = nightCfg?.enabled && (nowH >= nightStart || nowH < nightEnd)
      if (weatherCfg?.enabled) {
        const base = 15000
        const amt  = weatherCfg.type === "percent"
          ? Math.round(base * Number(weatherCfg.value) / 100)
          : Number(weatherCfg.value)
        setSurcharge(amt)
        setSurchargeLabel("⛈️ Thời tiết xấu")
      } else if (isNight) {
        setSurcharge(Number(nightCfg?.fee ?? 5000))
        setSurchargeLabel("🌙 Đêm khuya")
      }
      if (refUsage) setRefAlready(true)
      if (voucherData) {
        setDbVouchers(voucherData as unknown as DbVoucher[])
        const { data: usages } = await supabase.from("voucher_usages").select("voucher_id").eq("user_id", user.id)
        const umap: Record<string, number> = {}
        for (const u of usages ?? []) umap[u.voucher_id] = (umap[u.voucher_id] ?? 0) + 1
        setUserUsageMap(umap)

        // Gợi ý voucher từ trang "Dùng ngay"
        try {
          const raw = sessionStorage.getItem("pending_voucher")
          if (raw) {
            const pv = JSON.parse(raw) as { code: string; title: string }
            sessionStorage.removeItem("pending_voucher")
            const found = (voucherData as unknown as DbVoucher[]).find(v => v.code === pv.code)
            const currentShopId = cartItems[0]?.shopId ?? null
            // Chỉ gợi ý nếu voucher thuộc đúng quán hoặc là voucher toàn hệ thống
            if (found && (!found.shop_id || found.shop_id === currentShopId)) {
              setTimeout(() => {
                const yes = window.confirm(`Bạn có muốn áp dụng mã "${pv.code}" (${pv.title}) không?`)
                if (yes) applyVoucherCode(pv.code)
              }, 600)
            }
          }
        } catch { /* */ }
      }

      if (addrs && addrs.length > 0) {
        // Có địa chỉ đã lưu → dùng địa chỉ mặc định
        const mapped: AddrOption[] = addrs.map(a => ({
          id: a.id, label: a.label, address: a.address,
          isDefault: a.is_default, lat: a.lat, lng: a.lng,
        }))
        setSavedAddrs(mapped)
        const def = mapped.find(a => a.isDefault) ?? mapped[0]
        setSelectedAddr(def.id)
      } else {
        // Không có địa chỉ lưu → đọc GPS từ locationStore (layout đã lấy sẵn)
        const loc = useLocationStore.getState()
        if (loc.lat && loc.lng) {
          setMapAddress({ address: loc.address || "Vị trí hiện tại", lat: loc.lat, lng: loc.lng })
          setSelectedAddr("map")
        }
      }

      if (wallet) {
        setXuBalance(wallet.balance)
        setXuBonus((wallet as { bonus_balance?: number }).bonus_balance ?? 0)
        setXuWalletId(wallet.id)
      }
      setPageReady(true)
    }
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fetch shop coords khi biết shopId ──
  const shopId = cartItems[0]?.shopId ?? null
  useEffect(() => {
    if (!shopId) return
    supabase.from("shops").select("lat, lng, opening_hours").eq("id", shopId).single()
      .then(({ data }) => {
        if (data?.lat && data?.lng) setShopCoords({ lat: data.lat as number, lng: data.lng as number })
        if (data?.opening_hours) {
          const weekday = new Date().getDay() // 0=CN, 1=T2...
          const dayKey = ["sun","mon","tue","wed","thu","fri","sat"][weekday]
          const hours = (data.opening_hours as Record<string, { open: string; close: string }>)[dayKey]
          if (hours?.open && hours?.close) {
            setShopOpenH(parseInt(hours.open.split(":")[0]))
            setShopCloseH(parseInt(hours.close.split(":")[0]))
          }
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId])

  // ── Address helpers ──
  const tempAddr: AddrOption | null = mapAddress
    ? { id: "map", label: "📍 Bản đồ", address: mapAddress.address, isDefault: false, lat: mapAddress.lat, lng: mapAddress.lng }
    : null
  const allAddrs: AddrOption[] = [...savedAddrs, ...(tempAddr ? [tempAddr] : [])]
  const currentAddr = allAddrs.find(a => a.id === selectedAddr) ?? allAddrs[0] ?? null
  const TIER_ADDR_LIMIT = 3

  // ── Tính phí theo cung đường VietMap + giá cước admin ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const dLat = currentAddr?.lat
    const dLng = currentAddr?.lng
    if (!shopCoords || !dLat || !dLng) return
    setFeeLoading(true)
    getRouteKm(shopCoords.lat, shopCoords.lng, dLat, dLng).then(km => {
      setRouteKm(km)
      setDeliveryFee(
        foodPricing
          ? calcDeliveryFeeFromPricing(km, foodPricing.rows, foodPricing.extra)
          : calcDeliveryFee(km)
      )
      setFeeLoading(false)
    })
  }, [shopCoords, currentAddr?.lat, currentAddr?.lng, foodPricing]) // eslint-disable-line react-hooks/exhaustive-deps

  const nowH         = nowDate.getHours()
  const isBeforeOpen = nowH < shopOpenH
  const isAfterClose = nowH >= shopCloseH

  // ── Checkout-level warnings (errors are blocked inside TimeScheduleSheet) ──
  const checkoutConflicts: ScheduleConflict[] = (() => {
    if (deliveryNow || !scheduledTime) return []
    const selH = parseInt(scheduledTime.start.split(":")[0])
    const pad  = (n: number) => String(n).padStart(2, "0")
    const out: ScheduleConflict[] = []
    for (const item of cartItems) {
      const r = MOCK_PRODUCT_HOURS.find(p => item.name.toLowerCase().includes(p.match))
      if (r && (selH < r.sellStart || selH >= r.sellEnd))
        out.push({ level: "warn", icon: "🍽️",
          title: `"${item.name}" không bán lúc ${scheduledTime.start}`,
          detail: `Chỉ bán từ ${pad(r.sellStart)}:00 đến ${pad(r.sellEnd)}:00` })
    }
    return out
  })()

  // ── Prices ──
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0)
  const discount = appliedVouchers.reduce((s, v) => s + v.discount, 0)
  const total       = subtotal + deliveryFee + surcharge - discount

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2000) }

  // Chỉ giữ voucher toàn hệ thống + voucher đúng quán trong giỏ hàng
  const relevantVouchers = dbVouchers.filter(v => !v.shop_id || v.shop_id === shopId)

  const applyVoucherCode = (rawCode: string, fromPicker = false) => {
    const code = rawCode.trim().toUpperCase()
    if (!code) return
    if (appliedVouchers.some(v => v.code === code)) {
      fireToast("Mã này đã được áp dụng rồi!"); return
    }
    const found = dbVouchers.find(v => v.code === code)
    if (!found) { fireToast("Mã voucher không hợp lệ ❌"); return }

    // Kiểm tra voucher quán phải khớp với quán trong giỏ hàng
    if (found.shop_id && found.shop_id !== shopId) {
      fireToast("Voucher này chỉ áp dụng cho quán khác ❌"); return
    }

    // Kiểm tra per_person_limit client-side
    if (found.per_person_limit != null) {
      const usedCount = userUsageMap[found.id] ?? 0
      if (usedCount >= found.per_person_limit) {
        fireToast(`Bạn đã dùng voucher này tối đa ${found.per_person_limit} lần rồi ❌`); return
      }
    }

    // Validate combo: phải có đúng các sản phẩm yêu cầu trong giỏ
    if (found.is_combo && found.combo_items?.length) {
      const cartMap: Record<string, number> = {}
      for (const item of cartItems) {
        const pid = item.id.split("__")[0]
        cartMap[pid] = (cartMap[pid] ?? 0) + item.qty
      }
      const unmet = found.combo_items.filter(ci => (cartMap[ci.product_id] ?? 0) < ci.min_quantity)
      if (unmet.length > 0) {
        const names = unmet.map(ci => ci.products?.name ?? "món cần thiết").join(", ")
        fireToast(`❌ Chưa đủ combo — cần thêm: ${names}`)
        return
      }
    }

    const foundType = dbVoucherType(found)
    const conflict = appliedVouchers.find(v => v.type === foundType)
    if (conflict) {
      fireToast(`Chỉ được dùng 1 voucher ${foundType === "app" ? "ứng dụng" : "quán"} mỗi đơn`); return
    }
    const disc = calcVoucherDiscount(found, subtotal, deliveryFee)
    setAppliedVouchers(prev => [...prev, { code, type: foundType, label: found.title, discount: disc }])
    if (!fromPicker) setVoucherInput("")
    fireToast(`🎉 ${found.title} · Giảm ${fmt(disc)}`)
  }

  const applyVoucher = () => applyVoucherCode(voucherInput)

  const handleApplyRef = async () => {
    const code = refInput.trim().toUpperCase()
    if (!code || refApplied) return
    setRefLoading(true)
    setRefMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setRefMsg({ ok: false, text: "Vui lòng đăng nhập lại" }); return }
      const { data, error } = await supabase.rpc("apply_referral_code", {
        p_code: code, p_referee_id: user.id,
      })
      if (error) throw error
      const result = data as { ok: boolean; error?: string }
      if (result.ok) {
        setRefApplied(true)
        setRefMsg({ ok: true, text: "Mã hợp lệ! Cả hai sẽ nhận 5.000 xu sau khi đơn đầu tiên của bạn từ 50.000đ hoàn thành." })
      } else {
        setRefMsg({ ok: false, text: result.error ?? "Mã không hợp lệ" })
      }
    } catch {
      setRefMsg({ ok: false, text: "Lỗi kết nối, vui lòng thử lại" })
    } finally {
      setRefLoading(false)
    }
  }

  const payosAbortRef = useRef<AbortController | null>(null)

  const handleOrder = async () => {
    if (cartItems.length === 0) { fireToast("Giỏ hàng trống!"); return }
    if (!deliveryNow && !scheduledTime) { fireToast("Vui lòng chọn giờ giao hàng"); return }
    if (!currentAddr) { fireToast("Vui lòng chọn địa chỉ giao hàng"); return }

    setLoading(true)
    try {
      const uid = userId
      if (!uid) { fireToast("Vui lòng đăng nhập lại"); setLoading(false); return }

      const shopId = cartItems[0]?.shopId
      if (!shopId) { fireToast("Lỗi giỏ hàng"); setLoading(false); return }

      // Tọa độ = 0 hoặc null đều không hợp lệ — dùng trung tâm Phước An làm fallback
      const deliveryLat = (currentAddr.lat && currentAddr.lat !== 0) ? currentAddr.lat : 12.6521
      const deliveryLng = (currentAddr.lng && currentAddr.lng !== 0) ? currentAddr.lng : 108.5073

      const scheduledAt = (!deliveryNow && scheduledTime)
        ? `${new Date().toISOString().split("T")[0]}T${scheduledTime.start}:00`
        : null

      // Gọi /api/orders — validate giá từ DB, tạo order + order_items server-side
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id:          shopId,
          items:            cartItems.map(item => ({
            product_id: item.id.split("__")[0],
            quantity:   item.qty,
            note:       item.note?.trim() || null,
            breakdown:  item.breakdown ?? null,
          })),
          delivery_address: currentAddr.address,
          delivery_lat:     deliveryLat,
          delivery_lng:     deliveryLng,
          note:             driverNote || null,
          payment_method:   payment,
          voucher_id:       appliedVouchers[0] ? (dbVouchers.find(v => v.code === appliedVouchers[0].code)?.id ?? null) : null,
          scheduled_at:     scheduledAt,
          payment_code:     payment === "vietqr" ? orderCode : null,
          surcharge,
          delivery_fee:     deliveryFee,
        }),
      })
      const orderJson = await orderRes.json() as { orderId?: string; error?: string }
      if (!orderRes.ok || !orderJson.orderId) throw new Error(orderJson.error ?? "Không thể tạo đơn hàng")
      const order = { id: orderJson.orderId }

      // Trừ xu server-side (validate số dư thực tế trước khi trừ)
      if (xuBonusUsed > 0 || xuUsed > 0) {
        const xuRes = await fetch("/api/orders/deduct-xu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: order.id, xu_used: xuUsed, xu_bonus_used: xuBonusUsed }),
        })
        if (!xuRes.ok) {
          const { error } = await xuRes.json() as { error: string }
          await supabase.from("orders").delete().eq("id", order.id)
          throw new Error(error ?? "Không thể trừ xu")
        }
      }

      // Parallel dispatch: notify merchant + tìm tài xế cùng lúc (fire & forget)
      fetch("/api/orders/parallel-dispatch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ order_id: order.id }),
      }).catch(() => {})

      clearCart()
      router.push(`/order-success?orderId=${order.id}`)
    } catch (err) {
      console.error(err)
      fireToast(err instanceof Error && err.message ? err.message : "Có lỗi xảy ra, vui lòng thử lại")
      setLoading(false)
    }
  }

  const handlePaymentSelect = (id: string) => {
    setPayment(id as Payment)
    // PayOS chỉ gọi khi user nhấn CTA — không auto-open ở đây
  }

  const openVietQR = async () => {
    // Hủy request cũ nếu đang chạy
    payosAbortRef.current?.abort()
    const ac = new AbortController()
    payosAbortRef.current = ac

    setShowVietQR(true)
    setPayosData(null)
    setPayosLoading(true)
    try {
      const res = await fetch("/api/payment/payos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode,
          amount:      remaining,   // dùng remaining sau khi trừ xu
          description: `GN${orderCode}`,
        }),
        signal: ac.signal,
      })
      const data = await res.json() as PayOSData & { error?: string }
      if (data.error) throw new Error(data.error)
      setPayosData(data)
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      fireToast("Không thể tạo QR, vui lòng thử lại")
    } finally {
      setPayosLoading(false)
    }
  }

  const xuRefUsed   = useXuRef ? Math.min(xuBonus, total) : 0
  const xuBonusUsed = xuRefUsed   // alias cho submit code cũ
  const xuUsed      = useXuGN ? Math.min(xuBalance, Math.max(0, total - xuRefUsed)) : 0
  const remaining   = total - xuRefUsed - xuUsed
  const ctaBlocked  = loading || (!deliveryNow && !scheduledTime)

  // Spinner chỉ hiện trong lúc đang load dữ liệu từ Supabase
  if (!pageReady) return (
    <div style={{ minHeight:"100dvh", background:"#080806", display:"flex",
      alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:28, height:28, borderRadius:"50%",
        border:"2px solid rgba(255,107,0,0.2)", borderTopColor:"#FF8C00",
        animation:"spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%}
        ::-webkit-scrollbar{display:none}
        @keyframes ckShim{0%{left:-60%}100%{left:120%}}
        @keyframes ckSpin{to{transform:rotate(360deg)}}
        input[type=time]::-webkit-calendar-picker-indicator{filter:invert(0.6)}
      `}</style>

      {/* AddressPicker overlay */}
      {showMapPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300 }}>
          <AddressPicker height="100dvh"
            initialLat={mapAddress?.lat}
            initialLng={mapAddress?.lng}
            onClose={() => setShowMapPicker(false)}
            onConfirm={(result: AddressPickerResult) => {
              setMapAddress({ address: result.address, lat: result.lat, lng: result.lng })
              setSelectedAddr("map")
              setShowMapPicker(false)
            }}
          />
        </div>
      )}

      {/* Voucher Picker Sheet */}
      <AnimatePresence>
        {showVoucherPicker && (
          <VoucherPickerSheet
            appliedVouchers={appliedVouchers}
            subtotal={subtotal} deliveryFee={deliveryFee}
            onApply={code => applyVoucherCode(code, true)}
            onClose={() => setShowVoucherPicker(false)}
            vouchers={dbVouchers}
            userUsageMap={userUsageMap}
            shopId={shopId}
          />
        )}
      </AnimatePresence>

      {/* Address Sheet */}
      <AnimatePresence>
        {showAddressSheet && (
          <AddressSheet
            savedAddrs={savedAddrs} tempAddr={tempAddr}
            selectedId={selectedAddr} tierLimit={TIER_ADDR_LIMIT}
            onSelect={setSelectedAddr}
            onMapPick={() => setShowMapPicker(true)}
            onClose={() => setShowAddressSheet(false)}
          />
        )}
      </AnimatePresence>

      {/* Time Schedule Sheet */}
      <AnimatePresence>
        {showTimeSheet && (
          <TimeScheduleSheet
            nowDate={nowDate} shopOpenH={shopOpenH} shopCloseH={shopCloseH}
            cartItems={cartItems} initial={scheduledTime}
            onConfirm={range => { setScheduledTime(range); setShowTimeSheet(false) }}
            onOrderNow={() => { setDeliveryNow(true); setShowTimeSheet(false) }}
            onClose={() => setShowTimeSheet(false)}
          />
        )}
      </AnimatePresence>

      {/* VietQR Sheet */}
      <AnimatePresence>
        {showVietQR && (
          <VietQRSheet total={remaining} orderCode={orderCode}
            payosData={payosData} payosLoading={payosLoading}
            onClose={() => setShowVietQR(false)}
            onConfirm={handleOrder} confirming={loading}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            style={{
              position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 62px)", left: "50%", transform: "translateX(-50%)",
              zIndex: 500, whiteSpace: "nowrap",
              background: "rgba(255,107,0,0.15)", border: "1px solid rgba(255,107,0,0.35)",
              borderRadius: 12, padding: "7px 16px",
              color: "#FF8C00", fontSize: 11, fontWeight: 600, backdropFilter: "blur(10px)",
            }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position: "fixed", inset: 0, background: "#080806", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{
          background: "rgba(8,8,6,0.96)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px", flexShrink: 0, zIndex: 40,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/cart" style={{
              width: 32, height: 32, borderRadius: 9,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, textDecoration: "none", color: "#f8f0e0",
            }}>←</a>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 15, fontWeight: 700 }}>Xác nhận đặt hàng</div>
              <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>
                {cartItems.reduce((s, i) => s + i.qty, 0)} món · {fmt(subtotal)}
              </div>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#FF8C00",
              background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.25)",
              borderRadius: 6, padding: "3px 8px", flexShrink: 0,
            }}>Bước 2/2</div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 100px" } as React.CSSProperties}>

          {/* 1. Địa chỉ giao hàng */}
          <div style={{
            color: "#6a5a40", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 7,
          }}>Địa chỉ giao hàng</div>
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, padding: "12px 14px", marginBottom: 10,
            display: "flex", alignItems: "center", gap: 11,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>📍</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {currentAddr ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700 }}>{currentAddr.label}</span>
                    {currentAddr.isDefault && (
                      <span style={{
                        background: "rgba(62,207,110,0.12)", color: "#3ecf6e",
                        borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700,
                      }}>Mặc định</span>
                    )}
                  </div>
                  <div style={{ color: "#6a5a40", fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {currentAddr.address}
                  </div>
                </>
              ) : (
                <div style={{ color: "#FF8C00", fontSize: 11, fontWeight: 600 }}>
                  Chưa có địa chỉ — nhấn Đổi để chọn
                </div>
              )}
            </div>
            <button type="button" onClick={() => setShowAddressSheet(true)} style={{
              height: 30, padding: "0 12px", borderRadius: 8, cursor: "pointer",
              border: "1px solid rgba(255,107,0,0.3)", background: "rgba(255,107,0,0.08)",
              color: "#FF8C00", fontSize: 10.5, fontWeight: 700, fontFamily: "Lexend", flexShrink: 0,
            }}>Đổi</button>
          </div>

          {/* 2. Thời gian giao */}
          <SectionCard title="Thời gian giao hàng" icon="⏰">
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { now: true,  label: "Ngay bây giờ", emoji: "⚡",
                  sub: "~20–30 phút" },
                { now: false, label: "Hẹn giờ", emoji: "📅",
                  sub: scheduledTime ? `${scheduledTime.start} – ${scheduledTime.end}` : "Chọn khung giờ" },
              ].map(opt => (
                <div key={String(opt.now)}
                  onClick={() => {
                    setDeliveryNow(opt.now)
                    if (!opt.now) setShowTimeSheet(true)
                  }}
                  style={{
                    flex: 1, padding: "10px 10px", borderRadius: 11, cursor: "pointer",
                    background: deliveryNow === opt.now ? "rgba(255,107,0,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${deliveryNow === opt.now ? "rgba(255,107,0,0.35)" : "rgba(255,255,255,0.07)"}`,
                    textAlign: "center", transition: "all .18s",
                  }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{opt.emoji}</div>
                  <div style={{ color: deliveryNow === opt.now ? "#FF8C00" : "#b0956a", fontSize: 10.5, fontWeight: 600 }}>
                    {opt.label}
                  </div>
                  <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>{opt.sub}</div>
                </div>
              ))}
            </div>

            <AnimatePresence>
              {!deliveryNow && (
                <motion.div initial={{ maxHeight: 0, opacity: 0 }} animate={{ maxHeight: 500, opacity: 1 }}
                  exit={{ maxHeight: 0, opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}>
                  <div style={{ marginTop: 12 }}>

                    {/* App đã đóng */}
                    {isAfterClose && (
                      <div style={{
                        padding: "12px 14px", borderRadius: 12, marginBottom: 10,
                        background: "rgba(255,64,64,0.07)", border: "1px solid rgba(255,64,64,0.2)",
                        display: "flex", alignItems: "flex-start", gap: 9,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>🕐</span>
                        <div>
                          <div style={{ color: "#ff4040", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                            App đã đóng cửa hôm nay
                          </div>
                          <div style={{ color: "#6a5a40", fontSize: 11, lineHeight: 1.6 }}>
                            Hoạt động: 7:00 – 21:00 hàng ngày<br />
                            Hẹn giao sớm nhất:{" "}
                            <strong style={{ color: "#b0956a" }}>7:00 sáng ngày mai</strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* App chưa mở */}
                    {isBeforeOpen && (
                      <div style={{
                        padding: "12px 14px", borderRadius: 12, marginBottom: 10,
                        background: "rgba(74,143,245,0.07)", border: "1px solid rgba(74,143,245,0.2)",
                        display: "flex", alignItems: "flex-start", gap: 9,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>🌅</span>
                        <div>
                          <div style={{ color: "#4a8ff5", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                            App chưa mở cửa
                          </div>
                          <div style={{ color: "#6a5a40", fontSize: 11, lineHeight: 1.6 }}>
                            Hoạt động: 7:00 – 21:00 hàng ngày<br />
                            Bạn có thể hẹn giờ{" "}
                            <strong style={{ color: "#b0956a" }}>từ 7:00 sáng hôm nay</strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scheduled time display */}
                    {scheduledTime ? (
                      <>
                        <div style={{
                          display: "flex", alignItems: "center",
                          padding: "11px 13px", borderRadius: 12,
                          background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.2)",
                          gap: 10,
                        }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>📅</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>
                              <span style={{
                                background: "linear-gradient(90deg,#FF6B00,#FFB347)",
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                backgroundClip: "text",
                              } as React.CSSProperties}>
                                {scheduledTime.start} – {scheduledTime.end}
                              </span>
                            </div>
                            <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 2 }}>
                              {(() => {
                                const [sh, sm] = scheduledTime.start.split(":").map(Number)
                                const [eh, em] = scheduledTime.end.split(":").map(Number)
                                const d = (eh * 60 + em) - (sh * 60 + sm)
                                return `Hôm nay · ${d === 60 ? "1 tiếng" : `${d} phút`} giao hàng`
                              })()}
                            </div>
                          </div>
                          <button type="button" onClick={() => setShowTimeSheet(true)} style={{
                            height: 30, padding: "0 12px", borderRadius: 8, cursor: "pointer",
                            border: "1px solid rgba(255,107,0,0.3)", background: "rgba(255,107,0,0.08)",
                            color: "#FF8C00", fontSize: 10.5, fontWeight: 700,
                            fontFamily: "Lexend", flexShrink: 0,
                          }}>Đổi</button>
                        </div>

                        {/* Product hour warnings */}
                        {checkoutConflicts.map((c, i) => (
                          <motion.div key={i} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                            style={{
                              marginTop: 8, padding: "10px 12px", borderRadius: 11,
                              background: "rgba(245,197,66,0.06)", border: "1px solid rgba(245,197,66,0.22)",
                              display: "flex", alignItems: "flex-start", gap: 9,
                            }}>
                            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
                            <div>
                              <div style={{ color: "#f5c542", fontSize: 10.5, fontWeight: 700, marginBottom: 2 }}>{c.title}</div>
                              <div style={{ color: "#6a5a40", fontSize: 11, lineHeight: 1.5 }}>{c.detail}</div>
                            </div>
                          </motion.div>
                        ))}
                      </>
                    ) : !isAfterClose && (
                      <button type="button" onClick={() => setShowTimeSheet(true)} style={{
                        width: "100%", height: 46, borderRadius: 12, cursor: "pointer",
                        background: "rgba(255,107,0,0.06)", border: "1px dashed rgba(255,107,0,0.25)",
                        color: "#FF8C00", fontSize: 11, fontWeight: 600, fontFamily: "Lexend",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}>
                        <span>📅</span> Nhấn để chọn giờ hẹn
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </SectionCard>

          {/* 3a. XU Giao Nhanh */}
          {xuBalance > 0 && (
          <SectionCard title="XU Giao Nhanh" icon="🪙">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
                  background:"rgba(255,215,0,0.08)", border:"1px solid rgba(255,215,0,0.2)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🪙</div>
                <div>
                  <div style={{ color:"#f8f0e0", fontSize:11, fontWeight:600 }}>Dùng XU Giao Nhanh</div>
                  <div style={{ color:"#6a5a40", fontSize:10, marginTop:3 }}>
                    Số dư: <span style={{ color:"#FFD700", fontWeight:700 }}>{xuBalance.toLocaleString("vi-VN")} xu</span>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setUseXuGN(v => !v)}
                style={{ width:46, height:26, borderRadius:13, border:"none", cursor:"pointer",
                  background: useXuGN ? "linear-gradient(90deg,#FF6B00,#FF8C00)" : "rgba(255,255,255,0.1)",
                  position:"relative", flexShrink:0, transition:"background 0.2s" }}>
                <div style={{ position:"absolute", top:3, width:20, height:20, borderRadius:10,
                  background:"#fff", transition:"left 0.2s", left: useXuGN ? 23 : 3,
                  boxShadow:"0 1px 4px rgba(0,0,0,0.35)" }} />
              </button>
            </div>
            {useXuGN && xuUsed > 0 && (
              <div style={{ marginTop:10, padding:"9px 12px", borderRadius:10,
                background:"rgba(255,215,0,0.05)", border:"1px solid rgba(255,215,0,0.18)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ color:"#6a5a40", fontSize:10 }}>Xu sử dụng</span>
                  <span style={{ color:"#FFD700", fontSize:10, fontWeight:700 }}>−{xuUsed.toLocaleString("vi-VN")} xu</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:"#6a5a40", fontSize:10 }}>Còn lại trong ví</span>
                  <span style={{ color:"#b0956a", fontSize:10 }}>{(xuBalance - xuUsed).toLocaleString("vi-VN")} xu</span>
                </div>
              </div>
            )}
          </SectionCard>
          )}

          {/* 3b. XU Giới Thiệu */}
          {xuBonus > 0 && (
          <SectionCard title="XU Giới Thiệu" icon="🎁">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
                  background:"rgba(62,207,110,0.08)", border:"1px solid rgba(62,207,110,0.25)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🎁</div>
                <div>
                  <div style={{ color:"#f8f0e0", fontSize:11, fontWeight:600 }}>Dùng XU Giới Thiệu</div>
                  <div style={{ color:"#6a5a40", fontSize:10, marginTop:3 }}>
                    Số dư: <span style={{ color:"#3ecf6e", fontWeight:700 }}>{xuBonus.toLocaleString("vi-VN")} xu</span>
                  </div>
                </div>
              </div>
              <button type="button"
                onClick={() => setUseXuRef(v => !v)}
                style={{ width:46, height:26, borderRadius:13, border:"none", cursor:"pointer",
                  background: useXuRef ? "linear-gradient(90deg,#3ecf6e,#27ae60)" : "rgba(255,255,255,0.1)",
                  position:"relative", flexShrink:0, transition:"background 0.2s" }}>
                <div style={{ position:"absolute", top:3, width:20, height:20, borderRadius:10,
                  background:"#fff", transition:"left 0.2s", left: useXuRef ? 23 : 3,
                  boxShadow:"0 1px 4px rgba(0,0,0,0.35)" }} />
              </button>
            </div>
            {useXuRef && xuRefUsed > 0 && (
              <div style={{ marginTop:10, padding:"9px 12px", borderRadius:10,
                background:"rgba(62,207,110,0.05)", border:"1px solid rgba(62,207,110,0.18)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ color:"#6a5a40", fontSize:10 }}>Xu sử dụng</span>
                  <span style={{ color:"#3ecf6e", fontSize:10, fontWeight:700 }}>−{xuRefUsed.toLocaleString("vi-VN")} xu</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:"#6a5a40", fontSize:10 }}>Còn lại</span>
                  <span style={{ color:"#b0956a", fontSize:10 }}>{(xuBonus - xuRefUsed).toLocaleString("vi-VN")} xu</span>
                </div>
              </div>
            )}
          </SectionCard>
          )}

          {/* 3.5 Phương thức thanh toán phần còn lại */}
          {remaining > 0 && (
          <SectionCard title="Phương thức thanh toán" icon="💳">
            {PAYMENT_METHODS.map(pm => (
              <RadioRow key={pm.id} active={payment === pm.id as Payment}
                onClick={() => handlePaymentSelect(pm.id as Payment)}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{pm.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 600 }}>{pm.label}</div>
                  <div style={{ color: "#6a5a40", fontSize: 11 }}>{pm.desc}</div>
                </div>
                {payment === pm.id && <span style={{ color: "#3ecf6e", fontSize: 13, flexShrink: 0 }}>✓</span>}
              </RadioRow>
            ))}
            <AnimatePresence>
              {payment === "vietqr" && remaining > 0 && (
                <motion.div key="vietqr-extra"
                  initial={{ opacity: 0, maxHeight: 0 }} animate={{ opacity: 1, maxHeight: 120 }}
                  exit={{ opacity: 0, maxHeight: 0 }} transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{ overflow: "hidden", marginTop: 4 }}>
                  <button type="button" onClick={openVietQR} style={{
                    width: "100%", padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                    background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.2)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 16 }}>📲</span>
                    <span style={{ color: "rgba(255,215,0,0.85)", fontSize: 11, fontWeight: 600, fontFamily: "Lexend" }}>
                      Mở trang thanh toán VietQR
                    </span>
                    <span style={{ marginLeft: "auto", color: "rgba(255,215,0,0.5)", fontSize: 14 }}>›</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </SectionCard>
          )}


          <SectionCard title="Mã giảm giá" icon="🏷️">
            {/* VoucherNudgeBar — nudge mua thêm để đạt ngưỡng */}
            {appliedVouchers.length === 0 && (() => {
              const voucherItems = relevantVouchers.map(v => dbVoucherToVoucherItem(v, [], userUsageMap))
              return (
                <div style={{ marginBottom: 10 }}>
                  <VoucherNudgeBar
                    cartTotal={subtotal}
                    vouchers={voucherItems}
                    onPickVoucher={() => setShowVoucherPicker(true)}
                  />
                </div>
              )
            })()}
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button type="button" onClick={() => setShowVoucherPicker(true)} style={{
                width: "100%", height: 36, borderRadius: 10, border: "none", cursor: "pointer",
                background: "rgba(255,107,0,0.08)", borderWidth: 1, borderStyle: "dashed",
                borderColor: "rgba(255,107,0,0.3)",
                color: "#FF8C00", fontSize: 11, fontWeight: 600, fontFamily: "Lexend",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <span>🎟️</span>
                <span>Mở Túi Voucher · Chọn nhanh</span>
                {appliedVouchers.length > 0 && (
                  <span style={{
                    background: "rgba(62,207,110,0.15)", color: "#3ecf6e",
                    fontSize: 11, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                  }}>
                    {appliedVouchers.length}/2
                  </span>
                )}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={voucherInput}
                onChange={e => setVoucherInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && applyVoucher()}
                placeholder={appliedVouchers.length >= 2 ? "Đã áp tối đa 2 voucher" : "Nhập mã voucher (VD: WELCOME25)"}
                disabled={appliedVouchers.length >= 2}
                style={{
                  flex: 1, height: 40, borderRadius: 10,
                  background: appliedVouchers.length >= 2 ? "rgba(62,207,110,0.05)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${appliedVouchers.length >= 2 ? "rgba(62,207,110,0.2)" : "rgba(255,255,255,0.1)"}`,
                  color: "#f8f0e0", fontSize: 11, padding: "0 12px",
                  fontFamily: "Lexend", letterSpacing: 1, outline: "none",
                }} />
              <button type="button" onClick={applyVoucher} disabled={appliedVouchers.length >= 2} style={{
                height: 40, padding: "0 14px", borderRadius: 10, border: "none",
                cursor: appliedVouchers.length >= 2 ? "default" : "pointer",
                background: appliedVouchers.length >= 2 ? "rgba(62,207,110,0.12)" : "rgba(255,107,0,0.15)",
                color: appliedVouchers.length >= 2 ? "#3ecf6e" : "#FF8C00",
                fontSize: 11, fontWeight: 700, fontFamily: "Lexend", flexShrink: 0,
              }}>
                {appliedVouchers.length >= 2 ? "✓ OK" : "Áp dụng"}
              </button>
            </div>

            {/* Chip tags — voucher đã áp */}
            {appliedVouchers.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {appliedVouchers.map(v => (
                  <div key={v.code} style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "6px 10px", borderRadius: 9,
                    background: v.type === "app" ? "rgba(255,107,0,0.07)" : "rgba(74,143,245,0.07)",
                    border: `1px solid ${v.type === "app" ? "rgba(255,107,0,0.25)" : "rgba(74,143,245,0.25)"}`,
                  }}>
                    <span style={{ fontSize: 12 }}>{v.type === "app" ? "🏷️" : "🏪"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ color: "#b0956a", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{v.code}</span>
                      <span style={{ color: "#6a5a40", fontSize: 11, marginLeft: 5 }}>· {v.label}</span>
                    </div>
                    <span style={{
                      color: v.type === "app" ? "#FF8C00" : "#4a8ff5",
                      fontSize: 10, fontWeight: 700,
                    }}>-{fmt(v.discount)}</span>
                    <button type="button"
                      onClick={() => setAppliedVouchers(prev => prev.filter(x => x.code !== v.code))}
                      style={{
                        color: "#6a5a40", fontSize: 14, background: "none", border: "none",
                        cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0,
                      }}>×</button>
                  </div>
                ))}
                {appliedVouchers.length < 2 && (
                  <div style={{ color: "#6a5a40", fontSize: 11, textAlign: "center", paddingTop: 2 }}>
                    Còn thể thêm 1 voucher {appliedVouchers[0]?.type === "app" ? "quán 🏪" : "ứng dụng 🏷️"}
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* 5. Ghi chú */}
          <SectionCard title="Ghi chú cho tài xế" icon="🛵">
            <textarea value={driverNote} onChange={e => setDriverNote(e.target.value)}
              placeholder="VD: Gọi trước khi đến, để trước cổng, tầng 2..."
              rows={2}
              style={{
                width: "100%", borderRadius: 10,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#f8f0e0", fontSize: 11, padding: "10px 12px",
                fontFamily: "Lexend", outline: "none", resize: "none", lineHeight: 1.6,
              }} />
          </SectionCard>

          {/* 5.5 Mã giới thiệu */}
          {!refApplied && !refAlready && (
            <SectionCard title="Mã giới thiệu" icon="🎁">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={refInput}
                  onChange={e => { setRefInput(e.target.value.toUpperCase()); setRefMsg(null) }}
                  onKeyDown={e => e.key === "Enter" && handleApplyRef()}
                  placeholder="Nhập mã GNxxxxxx (nếu có)"
                  maxLength={8}
                  style={{
                    flex: 1, height: 40, borderRadius: 10,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#f8f0e0", fontSize: 12, padding: "0 12px",
                    fontFamily: "Lexend", letterSpacing: 2, outline: "none",
                  }}
                />
                <button type="button" onClick={handleApplyRef} disabled={refLoading || !refInput.trim()}
                  style={{
                    height: 40, padding: "0 14px", borderRadius: 10, border: "none",
                    background: refLoading || !refInput.trim() ? "rgba(255,255,255,0.06)" : "rgba(255,107,0,0.15)",
                    color: refLoading || !refInput.trim() ? "#6a5a40" : "#FF8C00",
                    fontSize: 11, fontWeight: 700, fontFamily: "Lexend",
                    cursor: refLoading || !refInput.trim() ? "default" : "pointer", flexShrink: 0,
                  }}>
                  {refLoading ? "..." : "Áp dụng"}
                </button>
              </div>
              {refMsg && (
                <div style={{
                  marginTop: 8, padding: "8px 11px", borderRadius: 9,
                  background: refMsg.ok ? "rgba(62,207,110,0.08)" : "rgba(255,64,64,0.08)",
                  border: `1px solid ${refMsg.ok ? "rgba(62,207,110,0.25)" : "rgba(255,64,64,0.25)"}`,
                  color: refMsg.ok ? "#3ecf6e" : "#ff4040", fontSize: 10.5,
                }}>
                  {refMsg.ok ? "✓" : "✗"} {refMsg.text}
                </div>
              )}
              {(refApplied || refAlready) && total < 50000 && (
                <div style={{ marginTop: 8, padding: "8px 11px", borderRadius: 9,
                  background: "rgba(255,179,71,0.08)", border: "1px solid rgba(255,179,71,0.25)",
                  color: "#FFB347", fontSize: 10.5, display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <span style={{ flexShrink:0 }}>⚠️</span>
                  <span>Đơn hàng chưa đủ 50.000đ — bạn và người giới thiệu sẽ chưa nhận được 5.000 xu thưởng cho đơn này.</span>
                </div>
              )}
            </SectionCard>
          )}

          {refApplied && (
            <div style={{
              marginBottom: 10, padding: "10px 14px", borderRadius: 14,
              background: "rgba(62,207,110,0.07)", border: "1px solid rgba(62,207,110,0.25)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>🎁</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#3ecf6e", fontSize: 11, fontWeight: 700 }}>Mã giới thiệu đã đăng ký</div>
                <div style={{ color: "#6a5a40", fontSize: 11, marginTop: 1 }}>
                  10.000đ xu sẽ vào ví sau khi đơn hoàn thành
                </div>
              </div>
              <span style={{ color: "#3ecf6e", fontSize: 14 }}>✓</span>
            </div>
          )}

          {/* 6. Tóm tắt */}
          <SectionCard title="Tóm tắt đơn hàng" icon="📋">
            {cartItems.length === 0 && (
              <div style={{ textAlign: "center", padding: "16px 0", color: "#6a5a40", fontSize: 11 }}>
                Giỏ hàng trống — <a href="/cart" style={{ color: "#FF8C00" }}>Quay lại giỏ</a>
              </div>
            )}
            {cartItems.map(item => (
              <div key={item.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <span style={{ fontSize: 14 }}>🍽️</span>
                  <div>
                    <div style={{ color: "#b0956a", fontSize: 10.5 }}>{item.name}</div>
                    <div style={{ color: "#6a5a40", fontSize: 11 }}>
                      ×{item.qty}{item.note ? ` · ${item.note}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ color: "#f8f0e0", fontSize: 11, fontWeight: 600 }}>
                  {fmt(item.price * item.qty)}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              {[
                { label: "Tạm tính",  val: fmt(subtotal),    color: "#b0956a" },
                {
                  label: feeLoading
                    ? "Phí giao  ⏳"
                    : routeKm != null
                      ? `Phí giao  (${routeKm.toFixed(1)} km)`
                      : "Phí giao",
                  val: fmt(deliveryFee),
                  color: "#b0956a",
                },
                ...(surcharge > 0 && surchargeLabel ? [{
                  label: `Phụ phí ${surchargeLabel}`, val: `+${fmt(surcharge)}`, color: "#FFB347",
                }] : []),
                ...(appliedVouchers.reduce((s, v) => s + v.discount, 0) > 0 ? [{
                  label: appliedVouchers.length > 1 ? `Giảm giá (${appliedVouchers.length} voucher)` : "Giảm giá",
                  val: `-${fmt(appliedVouchers.reduce((s, v) => s + v.discount, 0))}`, color: "#3ecf6e",
                }] : []),
                ...(useXuGN && xuUsed > 0 ? [{
                  label: "🪙 Xu Giao Nhanh",
                  val: `-${xuUsed.toLocaleString("vi-VN")} xu`, color: "#FFD700",
                }] : []),
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ color: "#6a5a40", fontSize: 10 }}>{row.label}</span>
                  <span style={{ color: row.color, fontSize: 10, fontWeight: 600 }}>{row.val}</span>
                </div>
              ))}
              <div style={{
                display: "flex", justifyContent: "space-between", padding: "10px 0 0",
                marginTop: 6, borderTop: "1px solid rgba(255,255,255,0.08)",
              }}>
                <span style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 700 }}>
                  {useXuGN && remaining < total ? "Còn phải trả" : "Tổng cộng"}
                </span>
                <span style={{
                  background: remaining === 0
                    ? "linear-gradient(90deg,#3ecf6e,#2db55d)"
                    : "linear-gradient(90deg,#FF6B00,#FFB347)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  backgroundClip: "text", fontSize: 16, fontWeight: 800,
                } as React.CSSProperties}>
                  {remaining === 0 ? "Miễn phí 🎉" : fmt(remaining)}
                </span>
              </div>
              {/* VoucherInlineHint — dưới total */}
              {(() => {
                const voucherItems = relevantVouchers.map(v => dbVoucherToVoucherItem(v, appliedVouchers.map(av => av.code), userUsageMap))
                const appliedItem  = appliedVouchers[0] ? voucherItems.find(vi => vi.isApplied) : null
                const nudgeResult  = !appliedItem ? findNextThreshold(subtotal, voucherItems) : null
                return (
                  <div style={{ marginTop: 8 }}>
                    <VoucherInlineHint
                      appliedVoucher={appliedItem ?? null}
                      nudgeVoucher={nudgeResult && !nudgeResult.reached ? nudgeResult.voucher : null}
                      cartTotal={subtotal}
                      onClick={() => setShowVoucherPicker(true)}
                    />
                  </div>
                )
              })()}
            </div>
          </SectionCard>
        </div>

        {/* CTA sticky */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(8,8,6,0.97)", backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          padding: "12px 14px 28px", zIndex: 50,
        }}>
          <button type="button"
            onClick={payment === "vietqr" && remaining > 0 ? openVietQR : handleOrder}
            disabled={ctaBlocked}
            style={{
              width: "100%", height: 52, borderRadius: 14, border: "none",
              background: ctaBlocked
                ? "rgba(255,255,255,0.08)"
                : "linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",
              color: ctaBlocked ? "#6a5a40" : "#fff",
              fontSize: 14, fontWeight: 800, fontFamily: "Lexend", cursor: "pointer",
              position: "relative", overflow: "hidden",
              boxShadow: ctaBlocked ? "none" : "0 4px 24px rgba(255,107,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all .25s",
            }}>
            {!ctaBlocked && (
              <div style={{
                position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%",
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                animation: "ckShim 2.5s infinite",
              }} />
            )}
            {loading ? (
              <>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#FF8C00",
                  animation: "ckSpin 0.8s linear infinite",
                }} />
                <span style={{ position: "relative", zIndex: 1 }}>Đang đặt hàng...</span>
              </>
            ) : !deliveryNow && !scheduledTime ? (
              <>
                <span style={{ fontSize: 18, position: "relative", zIndex: 1 }}>📅</span>
                <span style={{ position: "relative", zIndex: 1 }}>Vui lòng chọn giờ hẹn</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 18, position: "relative", zIndex: 1 }}>
                  {remaining === 0 ? "🪙" : payment === "vietqr" ? "📲" : "🛵"}
                </span>
                <span style={{ position: "relative", zIndex: 1 }}>
                  {remaining === 0
                    ? `Đặt hàng bằng xu · Miễn phí`
                    : payment === "vietqr"
                    ? `Thanh toán QR · ${fmt(remaining)}`
                    : useXuGN
                    ? `Đặt hàng · ${fmt(remaining)} + ${xuUsed.toLocaleString("vi-VN")} xu`
                    : `Đặt hàng ngay · ${fmt(total)}`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
