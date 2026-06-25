"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

interface Message {
  id: string
  sender_id: string
  role: "customer" | "driver"
  content: string
  created_at: string
}

interface ChatDrawerProps {
  orderId: string
  currentUserId: string
  currentRole: "customer" | "driver"
  partnerId?: string
  partnerName: string
  isOpen: boolean
  onClose: () => void
}

const QUICK_REPLIES_CUSTOMER = [
  "Bạn đang ở đâu vậy?",
  "Tôi ở cổng chính nhé",
  "Gọi trước khi đến giùm",
  "Cảm ơn bạn!",
]
const QUICK_REPLIES_DRIVER = [
  "Tôi đang trên đường",
  "5 phút nữa tới",
  "Đang lấy hàng rồi",
  "Đã tới nơi!",
]

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function ChatDrawer({ orderId, currentUserId, currentRole, partnerId, partnerName, isOpen, onClose }: ChatDrawerProps) {
  const supabase    = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState("")
  const [sending,  setSending]  = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  // Track message IDs để dedup khi Realtime trả về tin đã optimistic insert
  const msgIdsRef  = useRef<Set<string>>(new Set())

  const mergeMessages = useCallback((incoming: Message[]) => {
    setMessages(prev => {
      const known = new Set(prev.map(m => m.id))
      const fresh = incoming.filter(m => !known.has(m.id))
      if (!fresh.length) return prev
      return [...prev, ...fresh].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    })
    incoming.forEach(m => msgIdsRef.current.add(m.id))
  }, [])

  // Load history khi mở drawer
  useEffect(() => {
    if (!isOpen || !orderId) return
    supabase
      .from("chat_messages")
      .select("id, sender_id, role, content, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data?.length) mergeMessages(data as Message[])
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId])

  // Realtime subscription cho tin từ đối phương
  useEffect(() => {
    if (!isOpen || !orderId) return
    const ch = supabase
      .channel(`chat:${orderId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `order_id=eq.${orderId}`,
      }, ({ new: msg }) => {
        const m = msg as Message
        // Bỏ qua nếu đã có (optimistic insert)
        if (msgIdsRef.current.has(m.id)) return
        mergeMessages([m])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId])

  // Poll 3 giây — fallback nếu Realtime miss (RLS phức tạp hoặc connection drop)
  useEffect(() => {
    if (!isOpen || !orderId) return
    const timer = setInterval(async () => {
      const lastId = msgIdsRef.current
      // Lấy tin nhắn mới nhất — chỉ các tin chưa có trong state
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_id, role, content, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(20)
      if (!data?.length) return
      const fresh = (data as Message[]).filter(m => !lastId.has(m.id))
      if (fresh.length) mergeMessages(fresh)
    }, 3000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId])

  // Scroll xuống khi có tin mới
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus input khi mở
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 350)
  }, [isOpen])

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || sending) return
    setSending(true)
    if (!text) setInput("")

    // Insert + select để lấy row với ID thật từ DB
    const { data: inserted, error } = await supabase
      .from("chat_messages")
      .insert({ order_id: orderId, sender_id: currentUserId, role: currentRole, content })
      .select("id, sender_id, role, content, created_at")
      .single()

    setSending(false)

    if (error) {
      // Khôi phục input nếu gửi lỗi
      if (!text) setInput(content)
      return
    }

    if (inserted) {
      // Optimistic: thêm vào state ngay, Realtime sẽ bị dedup
      mergeMessages([inserted as Message])
    }

    if (!partnerId) return

    // Push notification cho đối phương
    const chatUrl = currentRole === "customer"
      ? `/driver/navigate/${orderId}?chat=1`
      : `/tracking/${orderId}?chat=1`
    fetch("/api/notify/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: partnerId,
        title:   currentRole === "customer" ? "💬 Khách hàng vừa nhắn tin" : "💬 Tài xế vừa nhắn tin",
        body:    content.slice(0, 120),
        url:     chatUrl,
        tag:     `chat-${orderId}`,
      }),
    }).catch(() => {})
  }

  const quickReplies = currentRole === "customer" ? QUICK_REPLIES_CUSTOMER : QUICK_REPLIES_DRIVER

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201,
              background: "#0e0c09",
              borderRadius: "20px 20px 0 0",
              border: "1px solid rgba(255,107,0,0.2)",
              borderBottom: "none",
              height: "72vh",
              display: "flex", flexDirection: "column",
              maxWidth: 480, margin: "0 auto",
            }}
          >
            {/* Handle bar */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
            </div>

            {/* Header */}
            <div style={{
              padding: "8px 16px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>
                  {currentRole === "customer" ? "🛵" : "👤"}
                </div>
                <div>
                  <div style={{ color: "#f8f0e0", fontSize: 13, fontWeight: 700 }}>{partnerName}</div>
                  <div style={{ color: "#3ecf6e", fontSize: 9, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3ecf6e", display: "inline-block" }} />
                    Online
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(255,255,255,0.06)", border: "none",
                  color: "#b0956a", fontSize: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "14px 16px",
              display: "flex", flexDirection: "column", gap: 10,
              scrollbarWidth: "none",
            } as React.CSSProperties}>
              {messages.length === 0 && (
                <div style={{
                  textAlign: "center", color: "#6a5a40", fontSize: 11,
                  padding: "24px 0",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
                  Chưa có tin nhắn nào.<br />Nhắn tin với {partnerName} nhé!
                </div>
              )}

              {messages.map(msg => {
                const isMine = msg.sender_id === currentUserId
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}
                  >
                    <div style={{
                      maxWidth: "76%",
                      padding: "9px 13px",
                      borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isMine
                        ? "linear-gradient(135deg, #FF6B00, #FF8C00)"
                        : "rgba(255,255,255,0.07)",
                      border: isMine ? "none" : "1px solid rgba(255,255,255,0.08)",
                      color: isMine ? "#fff" : "#f8f0e0",
                      fontSize: 13, lineHeight: 1.5,
                      boxShadow: isMine ? "0 2px 12px rgba(255,107,0,0.25)" : "none",
                    }}>
                      {msg.content}
                    </div>
                    <div style={{ color: "#6a5a40", fontSize: 8.5, marginTop: 3 }}>
                      {fmtTime(msg.created_at)}
                    </div>
                  </motion.div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Quick replies */}
            <div style={{
              display: "flex", gap: 6, overflowX: "auto", padding: "6px 16px 8px",
              scrollbarWidth: "none", flexShrink: 0,
            } as React.CSSProperties}>
              {quickReplies.map(qr => (
                <button
                  key={qr}
                  onClick={() => send(qr)}
                  style={{
                    flexShrink: 0, padding: "5px 11px", borderRadius: 20, cursor: "pointer",
                    background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)",
                    color: "#FF8C00", fontSize: 10.5, fontWeight: 500, fontFamily: "Lexend, sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  {qr}
                </button>
              ))}
            </div>

            {/* Input row */}
            <div style={{
              padding: "8px 14px",
              paddingBottom: "calc(28px + env(safe-area-inset-bottom))",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex", gap: 8, alignItems: "center", flexShrink: 0,
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Nhắn tin..."
                style={{
                  flex: 1, height: 44, borderRadius: 13,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#f8f0e0", fontSize: 13,
                  padding: "0 14px", outline: "none",
                  fontFamily: "Lexend, sans-serif",
                  transition: "border-color .2s",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,107,0,0.4)" }}
                onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || sending}
                style={{
                  width: 44, height: 44, borderRadius: 13, border: "none",
                  background: input.trim() && !sending
                    ? "linear-gradient(135deg, #FF6B00, #FF8C00)"
                    : "rgba(255,255,255,0.06)",
                  color: "#fff", fontSize: 18, cursor: input.trim() ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background .2s",
                  flexShrink: 0,
                }}
              >
                {sending ? (
                  <span style={{ fontSize: 12, opacity: 0.7 }}>…</span>
                ) : "➤"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
