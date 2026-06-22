'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, ShoppingCart, RotateCcw, MapPin, Phone, Store, ChevronRight } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { formatPrice }  from '@/lib/utils'
import type { UIResponse, RichContent, Action } from '@/lib/ai/types'

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
        <p style={{ fontSize: 12, fontWeight: 700, color: '#f8f0e0', marginBottom: 2 }}
           className="truncate">{data.name}</p>
        <p style={{ fontSize: 10, color: '#6a5a40' }}>{data.shopName}</p>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#FF8C00', marginTop: 2 }}>
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
        <p style={{ fontSize: 12, fontWeight: 700, color: '#f8f0e0' }} className="truncate">
          {data.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
            background: data.isOpen ? 'rgba(62,207,110,0.15)' : 'rgba(255,64,64,0.15)',
            color:      data.isOpen ? '#3ecf6e' : '#ff4040',
          }}>{data.isOpen ? 'Đang mở' : 'Đóng cửa'}</span>
          <span style={{ fontSize: 10, color: '#6a5a40' }}>⭐ {data.ratingAvg?.toFixed(1)}</span>
        </div>
      </div>
      <ChevronRight size={14} color="#6a5a40" />
    </button>
  )
}

function CartPreviewCard({ data }: { data: Extract<RichContent, { type: 'cart_preview' }>['data'] }) {
  return (
    <div style={{
      background: 'rgba(255,107,0,0.06)', border: '1px solid rgba(255,107,0,0.2)',
      borderRadius: 12, padding: '10px 12px', minWidth: 220,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#FF8C00', marginBottom: 6 }}>
        🛒 Giỏ hàng
      </p>
      {data.items.map((it, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 11, color: '#b0956a' }}>{it.quantity}x {it.name}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#FF8C00' }}>
            {formatPrice(it.price * it.quantity)}
          </span>
        </div>
      ))}
      <div style={{
        borderTop: '1px solid rgba(255,107,0,0.15)', marginTop: 6, paddingTop: 6,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f8f0e0' }}>Tổng</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#FF6B00' }}>
          {formatPrice(data.total)}
        </span>
      </div>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onQuickReply, onProductAdd, onShopSelect }: {
  msg:           Message
  onQuickReply:  (text: string) => void
  onProductAdd:  (data: Extract<RichContent, { type: 'product_card' }>['data']) => void
  onShopSelect:  (data: Extract<RichContent, { type: 'shop_card' }>['data'])    => void
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
            DakGo AI 🤖
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
            if (rc.type === 'cart_preview') {
              return <CartPreviewCard key={i} data={rc.data} />
            }
            if (rc.type === 'checkout_button') {
              return (
                <a key={i} href={rc.url} style={{
                  display: 'block', padding: '12px 0', borderRadius: 12, textAlign: 'center',
                  background: 'linear-gradient(to right, #FF6B00, #FF8C00)',
                  color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(255,107,0,0.35)',
                }}>
                  ✅ Thanh toán ngay
                </a>
              )
            }
            if (rc.type === 'location_picker') {
              return (
                <a key={i} href={rc.url} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 0', borderRadius: 12, textAlign: 'center',
                  background: 'rgba(74,143,245,0.1)', border: '1px solid rgba(74,143,245,0.25)',
                  color: '#4a8ff5', fontWeight: 600, fontSize: 13, textDecoration: 'none',
                }}>
                  <MapPin size={14} /> Ghim vị trí trên bản đồ
                </a>
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
                padding: '5px 12px', borderRadius: 999,
                background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.25)',
                color: '#FF8C00', fontSize: 11, fontWeight: 600, cursor: 'pointer',
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
  const { addItem, totalQty }       = useCartStore()
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [sessionKey, setSessionKey] = useState('')
  const bottomRef                   = useRef<HTMLDivElement>(null)
  const inputRef                    = useRef<HTMLInputElement>(null)

  // Init session + welcome message
  useEffect(() => {
    const key = getSessionKey()
    setSessionKey(key)

    setMessages([{
      id:           'welcome',
      role:         'assistant',
      content:      'Chào bạn! Mình là DakGo AI 🤖\nBạn muốn đặt đồ ăn, giao hộ hay đặt xe ôm?',
      quickReplies: ['🍜 Đặt đồ ăn', '📦 Giao hộ', '🛵 Xe ôm', '🚕 Taxi'],
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

      // Sync cart actions
      for (const action of data.actions) {
        if (action.type === 'ADD_TO_CART') {
          type ItemLike = { productId: string; productName: string; price: number; quantity: number; shopId: string; shopName: string; note?: string }
          const items = (action.payload?.items ?? []) as ItemLike[]
          for (const it of items) {
            for (let q = 0; q < it.quantity; q++) {
              addItem({ id: it.productId, name: it.productName, price: it.price, shop: it.shopName, shopId: it.shopId })
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
    addItem({ id: data.id, name: data.name, price: data.price, shop: data.shopName, shopId: data.shopId })
    sendMessage(`Thêm 1 ${data.name}`)
  }

  function handleShopSelect(data: Extract<RichContent, { type: 'shop_card' }>['data']) {
    sendMessage(`Tôi muốn đặt từ quán ${data.name}`)
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
          }}>🤖</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#f8f0e0', margin: 0 }}>DakGo AI</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ecf6e' }} />
              <span style={{ fontSize: 10, color: '#3ecf6e' }}>Đang hoạt động</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              localStorage.removeItem('dakgo-chat-session')
              window.location.reload()
            }}
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
            />
          ))}
          <AnimatePresence>{loading && <TypingDots />}</AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>

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
