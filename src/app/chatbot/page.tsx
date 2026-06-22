'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, ShoppingCart, RotateCcw, MapPin, Phone, Store, ChevronRight } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { formatPrice }  from '@/lib/utils'
import type { UIResponse, RichContent, Action, OrderCardData, CheckoutSheetData } from '@/lib/ai/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id:           string
  role:         'user' | 'assistant'
  content:      string
  quickReplies: string[]
  richContent:  RichContent[]
  actions:      Action[]
  timestamp:    number
}

// ─── Session key (anonymous, stored in localStorage) ─────────────────────────

function getSessionKey(): string {
  if (typeof window === 'undefined') return ''
  let key = localStorage.getItem('dakgo-chat-session')
  if (!key) {
    key = crypto.randomUUID()
    localStorage.setItem('dakgo-chat-session', key)
  }
  return key
}

// ─── Rich Content Components ──────────────────────────────────────────────────

function ProductCard({ data, onAdd }: {
  data:  Extract<RichContent, { type: 'product_card' }>['data']
  onAdd: () => void
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border:     '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10, minWidth: 220,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
        background: 'rgba(255,107,0,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>
        🍽️
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#f8f0e0', marginBottom: 2 }}
           className="truncate">{data.name}</p>
        <p style={{ fontSize: 11, color: '#6a5a40' }}>{data.shopName}</p>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#FF8C00', marginTop: 2 }}>
          {formatPrice(data.price)}
        </p>
      </div>
      <button
        onClick={onAdd}
        style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.3)',
          color: '#FF8C00', fontSize: 18, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >+</button>
    </div>
  )
}

function ShopCard({ data, onSelect }: {
  data:     Extract<RichContent, { type: 'shop_card' }>['data']
  onSelect: () => void
}) {
  const CATEGORY_EMOJI: Record<string, string> = {
    'bun-pho': '🍜', 'com-hop': '🍱', 'lau-nuong': '🔥',
    'an-vat': '🍢', 'ca-phe': '☕', 'khac': '🍽️',
  }
  return (
    <button
      onClick={onSelect}
      style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10, minWidth: 200,
        cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: 'rgba(255,107,0,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>
        {CATEGORY_EMOJI[data.category] ?? '🍽️'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#f8f0e0' }} className="truncate">
          {data.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
            background: data.isOpen ? 'rgba(62,207,110,0.15)' : 'rgba(255,64,64,0.15)',
            color:      data.isOpen ? '#3ecf6e' : '#ff4040',
          }}>{data.isOpen ? 'Đang mở' : 'Đóng cửa'}</span>
          <span style={{ fontSize: 11, color: '#6a5a40' }}>⭐ {data.ratingAvg?.toFixed(1)}</span>
        </div>
      </div>
      <ChevronRight size={14} color="#6a5a40" />
    </button>
  )
}


function SmartOrderCard({ data, onConfirm, onEdit }: {
  data:      OrderCardData
  onConfirm: () => void
  onEdit:    () => void
}) {
  const DELIVERY_FEE = 15000
  return (
    <div style={{
      background: 'rgba(255,107,0,0.06)', border: '1px solid rgba(255,107,0,0.25)',
      borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 320,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid rgba(255,107,0,0.12)',
        background: 'rgba(255,107,0,0.08)',
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#FF8C00', margin: 0 }}>
          🛒 {data.shopName || 'Đơn hàng'}
        </p>
      </div>

      {/* Items */}
      <div style={{ padding: '10px 14px' }}>
        {data.items.map((it, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f8f0e0' }}>
                {it.quantity}× {it.name}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FF8C00' }}>
                {formatPrice(it.price * it.quantity)}
              </span>
            </div>
            {it.modifiers.length > 0 && (
              <p style={{ fontSize: 11, color: '#6a5a40', margin: '2px 0 0 12px' }}>
                {it.modifiers.join(' · ')}
              </p>
            )}
          </div>
        ))}

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '8px 0' }} />

        {/* Address */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <MapPin size={12} color={data.address ? '#FF8C00' : '#6a5a40'} />
          <span style={{ fontSize: 12, color: data.address ? '#b0956a' : '#6a5a40' }}>
            {data.address || 'Chưa có địa chỉ giao'}
          </span>
        </div>

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 12, color: '#6a5a40' }}>Tổng + ship</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#FF6B00' }}>
            {formatPrice(data.total + DELIVERY_FEE)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', borderTop: '1px solid rgba(255,107,0,0.12)',
      }}>
        <button onClick={onEdit} style={{
          flex: 1, padding: '11px 0', background: 'none', border: 'none',
          color: '#b0956a', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          borderRight: '1px solid rgba(255,107,0,0.12)',
        }}>
          ✏️ Sửa
        </button>
        <button onClick={onConfirm} style={{
          flex: 2, padding: '11px 0', background: 'none', border: 'none',
          color: '#FF8C00', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          ✅ Xác nhận đặt
        </button>
      </div>
    </div>
  )
}

// ─── Checkout Bottom Sheet ────────────────────────────────────────────────────

function CheckoutBottomSheet({ data, onClose, onComplete }: {
  data:       CheckoutSheetData
  onClose:    () => void
  onComplete: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#0e0c09',
          borderRadius: '20px 20px 0 0',
          border: '1px solid rgba(255,107,0,0.2)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          maxHeight: '80vh', overflowY: 'auto',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div style={{ padding: '4px 20px 20px' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#f8f0e0', marginBottom: 16 }}>
            📋 Xác nhận đơn hàng
          </p>

          {/* Shop */}
          <p style={{ fontSize: 12, color: '#6a5a40', marginBottom: 8 }}>
            🏪 {data.shopName}
          </p>

          {/* Items */}
          {data.items.map((it, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, color: '#f8f0e0' }}>{it.quantity}× {it.name}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#FF8C00' }}>
                  {formatPrice(it.price * it.quantity)}
                </span>
              </div>
              {it.modifiers.length > 0 && (
                <p style={{ fontSize: 11, color: '#6a5a40', margin: '2px 0 0 14px' }}>
                  {it.modifiers.join(' · ')}
                </p>
              )}
            </div>
          ))}

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '12px 0' }} />

          {/* Fees */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: '#6a5a40' }}>Tạm tính</span>
            <span style={{ fontSize: 13, color: '#b0956a' }}>{formatPrice(data.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#6a5a40' }}>Phí giao hàng</span>
            <span style={{ fontSize: 13, color: '#b0956a' }}>{formatPrice(data.deliveryFee)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f8f0e0' }}>Tổng cộng</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#FF6B00' }}>
              {formatPrice(data.total)}
            </span>
          </div>

          {/* Address */}
          {data.address && (
            <div style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 10,
              padding: '10px 12px', marginBottom: 16,
            }}>
              <p style={{ fontSize: 11, color: '#6a5a40', margin: '0 0 2px' }}>Giao đến</p>
              <p style={{ fontSize: 13, color: '#b0956a', margin: 0 }}>{data.address}</p>
            </div>
          )}

          {/* CTA */}
          <button onClick={onComplete} style={{
            width: '100%', padding: '16px 0',
            background: 'linear-gradient(to right, #FF6B00, #FF8C00)',
            border: 'none', borderRadius: 14, cursor: 'pointer',
            fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 0.5,
            boxShadow: '0 4px 20px rgba(255,107,0,0.5)',
          }}>
            HOÀN TẤT ĐẶT ĐƠN →
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onQuickReply, onProductAdd, onShopSelect, onUseLocation, onConfirmOrder, onEditOrder }: {
  msg:             Message
  onQuickReply:    (text: string) => void
  onProductAdd:    (data: Extract<RichContent, { type: 'product_card' }>['data']) => void
  onShopSelect:    (data: Extract<RichContent, { type: 'shop_card' }>['data'])    => void
  onUseLocation:   () => void
  onConfirmOrder:  () => void
  onEditOrder:     () => void
}) {
  const isUser = msg.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 6 }}
    >
      {/* Text bubble */}
      <div style={{
        maxWidth: '80%', padding: '10px 14px', borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser
          ? 'linear-gradient(135deg, #FF6B00, #FF8C00)'
          : 'rgba(255,255,255,0.06)',
        border:    isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
        color: '#f8f0e0', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line',
        boxShadow: isUser ? '0 2px 12px rgba(255,107,0,0.3)' : 'none',
      }}>
        {!isUser && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#FF8C00', display: 'block', marginBottom: 4 }}>
            DakGo 🍜
          </span>
        )}
        {msg.content}
      </div>

      {/* Rich content */}
      {msg.richContent.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          width: '100%', maxWidth: '90%',
        }}>
          {msg.richContent.map((rc, i) => {
            if (rc.type === 'product_card') {
              return <ProductCard key={i} data={rc.data} onAdd={() => onProductAdd(rc.data)} />
            }
            if (rc.type === 'shop_card') {
              return <ShopCard key={i} data={rc.data} onSelect={() => onShopSelect(rc.data)} />
            }
            if (rc.type === 'order_card') {
              return (
                <SmartOrderCard key={i} data={rc.data} onConfirm={onConfirmOrder} onEdit={onEditOrder} />
              )
            }
            if (rc.type === 'checkout_sheet') {
              // Bottom sheet is handled at page level — no inline render
              return null
            }
            if (rc.type === 'location_picker') {
              return (
                <button key={i} onClick={onUseLocation} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '10px 0', borderRadius: 12,
                  background: 'rgba(74,143,245,0.1)', border: '1px solid rgba(74,143,245,0.25)',
                  color: '#4a8ff5', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}>
                  <MapPin size={14} /> Dùng vị trí hiện tại của tôi
                </button>
              )
            }
            return null
          })}
        </div>
      )}

      {/* Quick reply chips */}
      {!isUser && msg.quickReplies.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: '95%' }}>
          {msg.quickReplies.map((qr, i) => (
            <button
              key={i}
              onClick={() => onQuickReply(qr)}
              style={{
                padding: '6px 14px', borderRadius: 999,
                background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.25)',
                color: '#FF8C00', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {qr}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─── Loading indicator ────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <div style={{
        padding: '10px 14px', borderRadius: '18px 18px 18px 4px',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', gap: 4, alignItems: 'center',
      }}>
        {[0, 0.2, 0.4].map((delay, i) => (
          <motion.div
            key={i}
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF8C00' }}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.7, delay, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────

export default function ChatbotPage() {
  const router                      = useRouter()
  const { addItem, clearCart, totalQty } = useCartStore()
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [sessionKey, setSessionKey]     = useState('')
  const [checkoutSheet, setCheckoutSheet] = useState<CheckoutSheetData | null>(null)
  const bottomRef                       = useRef<HTMLDivElement>(null)
  const inputRef                        = useRef<HTMLInputElement>(null)
  // Track synced productIds to avoid doubling cart from repeated ADD_TO_CART payloads (BUG-002)
  const syncedProductIds                = useRef<Set<string>>(new Set())

  // Init session + welcome message
  useEffect(() => {
    const key = getSessionKey()
    setSessionKey(key)

    setMessages([{
      id:           'welcome',
      role:         'assistant',
      content:      'Chào bạn! Mình giúp giao đồ ăn tại Phước An nhanh nhất 🍜\nHôm nay bạn muốn ăn gì?',
      quickReplies: ['🍜 Xem quán đang mở', '🍱 Cơm hộp', '☕ Cà phê', '📦 Giao hộ'],
      richContent:  [],
      actions:      [],
      timestamp:    Date.now(),
    }])
  }, [])

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading || !sessionKey) return

    const userMsg: Message = {
      id:           crypto.randomUUID(),
      role:         'user',
      content:      text.trim(),
      quickReplies: [],
      richContent:  [],
      actions:      [],
      timestamp:    Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text.trim(), sessionKey }),
      })

      const data: UIResponse = await res.json()

      const botMsg: Message = {
        id:           crypto.randomUUID(),
        role:         'assistant',
        content:      data.reply,
        quickReplies: data.quickReplies,
        richContent:  data.richContent,
        actions:      data.actions,
        timestamp:    Date.now(),
      }

      setMessages(prev => [...prev, botMsg])

      // Open checkout bottom sheet if checkout_sheet richContent is present
      const sheetContent = data.richContent.find(rc => rc.type === 'checkout_sheet')
      if (sheetContent && sheetContent.type === 'checkout_sheet') {
        setCheckoutSheet(sheetContent.data)
      }

      // Sync cart — only add NEW products (BUG-002: avoid re-adding on every message)
      type ItemLike = { productId: string; productName: string; price: number; quantity: number; shopId: string; shopName: string }
      for (const action of data.actions) {
        if (action.type === 'ADD_TO_CART') {
          const items = (action.payload?.items ?? []) as ItemLike[]
          for (const it of items) {
            if (!syncedProductIds.current.has(it.productId)) {
              syncedProductIds.current.add(it.productId)
              for (let q = 0; q < it.quantity; q++) {
                addItem({ id: it.productId, name: it.productName, price: it.price, shop: it.shopName, shopId: it.shopId })
              }
            }
          }
        }
        // Sync full checkout items to cart before redirecting
        if (action.type === 'CHECKOUT') {
          const items = (action.payload?.items ?? []) as ItemLike[]
          if (items.length > 0) {
            clearCart()
            syncedProductIds.current.clear()
            for (const it of items) {
              syncedProductIds.current.add(it.productId)
              for (let q = 0; q < it.quantity; q++) {
                addItem({ id: it.productId, name: it.productName, price: it.price, shop: it.shopName, shopId: it.shopId })
              }
            }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id:           crypto.randomUUID(),
        role:         'assistant',
        content:      'Xin lỗi, mình gặp sự cố nhỏ 😅 Bạn thử lại nhé!',
        quickReplies: ['🔄 Thử lại'],
        richContent:  [],
        actions:      [],
        timestamp:    Date.now(),
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [loading, sessionKey, addItem])

  function handleProductAdd(data: Extract<RichContent, { type: 'product_card' }>['data']) {
    // Chỉ gửi message lên pipeline — cart được sync từ ADD_TO_CART response (BUG-013)
    sendMessage(`Thêm 1 ${data.name}`)
  }

  function handleShopSelect(data: Extract<RichContent, { type: 'shop_card' }>['data']) {
    sendMessage(`Tôi muốn đặt từ quán ${data.name}`)
  }

  function handleUseLocation() {
    if (!navigator.geolocation) {
      sendMessage('Thiết bị không hỗ trợ GPS. Địa chỉ của tôi là:')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const json = await res.json()
          const addr = json.display_name?.split(',').slice(0, 3).join(',').trim() ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
          sendMessage(`Giao đến địa chỉ: ${addr}`)
        } catch {
          sendMessage(`Giao đến tọa độ: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
        }
      },
      () => { sendMessage('Không lấy được vị trí, địa chỉ của tôi là:') }
    )
  }

  function handleConfirmOrder() {
    sendMessage('✅ đặt ngay')
  }

  function handleEditOrder() {
    sendMessage('Tôi muốn sửa đơn')
  }

  function handleCheckoutComplete() {
    setCheckoutSheet(null)
    router.push('/checkout')
  }

  function handleReset() {
    if (!confirm('Bắt đầu cuộc hội thoại mới? Thông tin đơn hàng đang chat sẽ bị xóa.')) return
    localStorage.removeItem('dakgo-chat-session')
    syncedProductIds.current.clear()
    window.location.reload()
  }

  const cartQty = totalQty()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', background: '#080806',
      fontFamily: 'Lexend, Inter, sans-serif',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'rgba(8,8,6,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,107,0,0.12)',
        paddingTop: 'calc(12px + env(safe-area-inset-top))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b0956a', padding: 4 }}>←</button>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #FF6B00, #FF8C00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 0 12px rgba(255,107,0,0.4)',
          }}>🍜</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#f8f0e0', margin: 0 }}>DakGo</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ecf6e' }} />
              <span style={{ fontSize: 10, color: '#3ecf6e' }}>Đang hoạt động</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleReset}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#b0956a' }}
            title="Chat mới"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => router.push('/cart')}
            style={{
              position: 'relative', background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.25)',
              borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#FF8C00',
            }}
          >
            <ShoppingCart size={16} />
            {cartQty > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: '#FF6B00', color: '#fff', borderRadius: 999,
                fontSize: 9, fontWeight: 700, padding: '1px 4px', minWidth: 14, textAlign: 'center',
              }}>{cartQty}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onQuickReply={sendMessage}
              onProductAdd={handleProductAdd}
              onShopSelect={handleShopSelect}
              onUseLocation={handleUseLocation}
              onConfirmOrder={handleConfirmOrder}
              onEditOrder={handleEditOrder}
            />
          ))}
          <AnimatePresence>{loading && <TypingDots />}</AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Checkout Bottom Sheet ── */}
      <AnimatePresence>
        {checkoutSheet && (
          <CheckoutBottomSheet
            data={checkoutSheet}
            onClose={() => setCheckoutSheet(null)}
            onComplete={handleCheckoutComplete}
          />
        )}
      </AnimatePresence>

      {/* ── Input ── */}
      <div style={{
        padding: '10px 16px',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        background: 'rgba(8,8,6,0.95)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Nhắn gì đó... (VD: 2 tô phở bò)"
            disabled={loading}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 999,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#f8f0e0', fontSize: 13, outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 999, flexShrink: 0,
              background: input.trim()
                ? 'linear-gradient(135deg, #FF6B00, #FF8C00)'
                : 'rgba(255,255,255,0.06)',
              border: 'none', cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: input.trim() ? '0 0 12px rgba(255,107,0,0.4)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <Send size={17} color={input.trim() ? '#fff' : '#6a5a40'} />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
