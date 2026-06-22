'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Store, MapPin, Phone, User, Banknote, Smartphone } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { CheckoutSheetData } from '@/lib/ai/types'

type PaymentMethod = 'cash' | 'transfer'

interface FormState {
  name:    string
  phone:   string
  address: string
  payment: PaymentMethod
}

export default function ChatbotCheckoutPage() {
  const router = useRouter()
  const [data,    setData]    = useState<CheckoutSheetData | null>(null)
  const [form,    setForm]    = useState<FormState>({ name: '', phone: '', address: '', payment: 'cash' })
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState<{ orderId: string } | null>(null)
  const [error,   setError]   = useState('')

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('chatbot_checkout')
      if (!raw) { router.replace('/chatbot'); return }
      const parsed = JSON.parse(raw) as CheckoutSheetData
      setData(parsed)
      setForm(f => ({
        ...f,
        phone:   parsed.phone ?? '',
        address: parsed.address ?? '',
      }))
    } catch {
      router.replace('/chatbot')
    }
  }, [router])

  async function handleSubmit() {
    if (!data) return
    if (!form.phone.trim()) { setError('Vui lòng nhập số điện thoại để nhận đơn hàng'); return }
    if (!form.address.trim()) { setError('Vui lòng nhập địa chỉ giao hàng'); return }

    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/orders/chatbot-guest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items:         data.items,
          shopId:        data.shopId,
          shopName:      data.shopName,
          address:       form.address,
          phone:         form.phone,
          name:          form.name || 'Khách hàng',
          paymentMethod: form.payment,
          subtotal:      data.subtotal,
          deliveryFee:   data.deliveryFee,
          total:         data.total,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Đặt hàng thất bại, thử lại nhé!'); return }
      sessionStorage.removeItem('chatbot_checkout')
      setDone({ orderId: json.orderId })
    } catch {
      setError('Lỗi kết nối, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-8 h-8 rounded-full border-2 border-[#FF6B00] border-t-transparent animate-spin" />
    </div>
  )

  if (done) return <SuccessScreen orderId={done.orderId} onBack={() => router.push('/chatbot')} />

  const subtotal    = data.items.reduce((s, i) => s + i.price * i.quantity, 0)
  const deliveryFee = data.deliveryFee
  const total       = subtotal + deliveryFee

  return (
    <div className="min-h-screen pb-6" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{
        background: 'rgba(14,12,9,0.95)', borderBottom: '1px solid rgba(255,107,0,0.15)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(20px)',
      }}>
        <button onClick={() => router.back()} style={{
          background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.25)',
          borderRadius: 8, padding: 8, cursor: 'pointer', color: '#FF8C00', display: 'flex',
        }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Xác nhận đơn hàng</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{data.shopName}</div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Order items */}
        <section style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Store size={16} color="#FF8C00" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{data.shopName}</span>
          </div>
          {data.items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{item.quantity}× {item.name}</div>
                {item.note && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ghi chú: {item.note}</div>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#FF8C00' }}>
                {formatPrice(item.price * item.quantity)}
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,107,0,0.15)', marginTop: 10, paddingTop: 10 }}>
            <Row label="Tạm tính" value={formatPrice(subtotal)} />
            <Row label="Phí giao hàng" value={formatPrice(deliveryFee)} />
            <Row label="Tổng cộng" value={formatPrice(total)} highlight />
          </div>
        </section>

        {/* Delivery info */}
        <section style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <Field
            icon={<User size={16} color="#FF8C00" />}
            label="Tên người nhận"
            placeholder="Nhập tên (không bắt buộc)"
            value={form.name}
            onChange={v => setForm(f => ({ ...f, name: v }))}
          />
          <Field
            icon={<Phone size={16} color="#FF8C00" />}
            label="Số điện thoại"
            placeholder="0901 234 567"
            value={form.phone}
            type="tel"
            onChange={v => setForm(f => ({ ...f, phone: v }))}
            required
          />
          <Field
            icon={<MapPin size={16} color="#FF8C00" />}
            label="Địa chỉ giao hàng"
            placeholder="Nhập địa chỉ cụ thể"
            value={form.address}
            onChange={v => setForm(f => ({ ...f, address: v }))}
            required
          />
        </section>

        {/* Payment */}
        <section style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: 16,
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Phương thức thanh toán</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <PayBtn
              icon={<Banknote size={18} />}
              label="Tiền mặt"
              active={form.payment === 'cash'}
              onClick={() => setForm(f => ({ ...f, payment: 'cash' }))}
            />
            <PayBtn
              icon={<Smartphone size={18} />}
              label="Chuyển khoản"
              active={form.payment === 'transfer'}
              onClick={() => setForm(f => ({ ...f, payment: 'transfer' }))}
            />
          </div>
        </section>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(255,64,64,0.1)', border: '1px solid rgba(255,64,64,0.3)',
            borderRadius: 10, padding: '10px 14px', color: '#ff6060', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            position: 'relative', overflow: 'hidden', borderRadius: 14, height: 52,
            background: 'linear-gradient(90deg, #FF6B00, #FF8C00, #FFB347)',
            border: 'none', color: '#fff', fontWeight: 700, fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            boxShadow: '0 4px 20px rgba(255,107,0,0.4)',
          }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite', display: 'inline-block',
              }} />
              Đang đặt hàng...
            </span>
          ) : `Đặt ngay · ${formatPrice(total)}`}
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: -4 }}>
          Không cần đăng nhập · Thanh toán khi nhận hàng
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
      <span style={{ fontSize: 13, color: highlight ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontSize: highlight ? 15 : 13, fontWeight: highlight ? 700 : 400,
        color: highlight ? '#FF8C00' : 'var(--text-secondary)',
      }}>{value}</span>
    </div>
  )
}

function Field({
  icon, label, placeholder, value, onChange, type = 'text', required,
}: {
  icon: React.ReactNode; label: string; placeholder: string
  value: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon}
        <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {label}{required && <span style={{ color: '#ff4040' }}> *</span>}
        </label>
      </div>
      <input
        type={type}
        inputMode={type === 'tel' ? 'numeric' : undefined}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14,
          outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.2s',
          fontFamily: 'Lexend, sans-serif',
        }}
        onFocus={e  => { e.target.style.borderColor = 'rgba(255,107,0,0.5)' }}
        onBlur={e   => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
      />
    </div>
  )
}

function PayBtn({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
        background: active ? 'rgba(255,107,0,0.12)' : 'rgba(255,255,255,0.03)',
        border: active ? '1.5px solid rgba(255,107,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
        color: active ? '#FF8C00' : 'var(--text-muted)',
        fontFamily: 'Lexend, sans-serif', fontWeight: active ? 600 : 400, fontSize: 13,
        transition: 'all 0.18s',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function SuccessScreen({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const short = orderId.slice(0, 8).toUpperCase()
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      background: 'var(--bg-primary)', color: 'var(--text-primary)', textAlign: 'center',
    }}>
      <CheckCircle size={64} color="#3ecf6e" style={{ marginBottom: 16 }} />
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Đặt hàng thành công!</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
        Quán đang chuẩn bị đơn của bạn
      </p>
      <div style={{
        background: 'rgba(255,107,0,0.07)', border: '1px solid rgba(255,107,0,0.25)',
        borderRadius: 12, padding: '12px 24px', marginBottom: 32,
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mã đơn hàng</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#FF8C00', letterSpacing: 2 }}>
          #{short}
        </div>
      </div>
      <button
        onClick={onBack}
        style={{
          background: 'linear-gradient(90deg, #FF6B00, #FF8C00)',
          border: 'none', borderRadius: 12, padding: '12px 32px',
          color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          fontFamily: 'Lexend, sans-serif',
        }}
      >
        Về trang chat
      </button>
    </div>
  )
}
