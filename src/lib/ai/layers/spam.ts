// Layer 1: Anti Spam
import type { PipelineInput } from '../types'

// In-memory rate limit — resets on serverless cold start (acceptable: rare, soft limit)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>()
const WINDOW_MS    = 60_000
const MAX_PER_MIN  = 20   // tăng từ 15 → 20 (user typing nhanh khi đặt đơn)

const MASH_RE   = /(.)\1{6,}/       // aaaaaaa, 111111
const URL_RE    = /https?:\/\/|t\.me\/|zalo\.me\/|bit\.ly\//i
const PHONE_RE  = /(\d[\s\-.]?){10,}/  // chuỗi số dài — có thể là spam hoặc input số phone (OK)

export function checkAntiSpam(input: PipelineInput): { blocked: boolean; reason?: string } {
  const { message, sessionKey } = input
  const text = message.trim()

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (!text) return { blocked: true, reason: 'empty' }

  // ── Quá dài (giảm 500 → 300 — chat đặt đơn không cần dài hơn) ─────────────
  if (text.length > 300) {
    return { blocked: true, reason: 'Nhắn ngắn thôi bạn ơi, tối đa 300 ký tự nhé! 😄' }
  }

  // ── Keyboard mash (aaaaaaa, 11111111) ──────────────────────────────────────
  if (MASH_RE.test(text)) {
    return { blocked: true, reason: 'Mình không hiểu bạn muốn nói gì rồi 😅 Thử lại nhé!' }
  }

  // ── Link spam ──────────────────────────────────────────────────────────────
  if (URL_RE.test(text)) {
    return { blocked: true, reason: 'Mình chỉ nhận đặt đồ ăn thôi, không nhận link nhé! 🙏' }
  }

  // ── Rate limit per session ──────────────────────────────────────────────────
  const now = Date.now()
  const rl  = rateLimitMap.get(sessionKey)
  if (!rl || now - rl.windowStart > WINDOW_MS) {
    rateLimitMap.set(sessionKey, { count: 1, windowStart: now })
  } else {
    rl.count++
    if (rl.count > MAX_PER_MIN) {
      return { blocked: true, reason: 'Bạn đang nhắn quá nhanh! 😅 Đợi chút rồi thử lại nhé.' }
    }
  }

  // ── Repeated message (3 lần liên tiếp) ─────────────────────────────────────
  const recentUser = input.history
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.content.trim().toLowerCase())
  if (recentUser.length >= 3 && recentUser.every(c => c === text.toLowerCase())) {
    return { blocked: true, reason: 'Mình nhận tin rồi nha! Bạn thử hỏi cách khác xem sao? 😊' }
  }

  // ── Bỏ qua PHONE_RE — số điện thoại là input hợp lệ ───────────────────────
  void PHONE_RE

  return { blocked: false }
}
