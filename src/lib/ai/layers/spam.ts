// Layer 1: Anti Spam
import type { PipelineInput } from '../types'

const rateLimitMap = new Map<string, { count: number; windowStart: number }>()
const WINDOW_MS   = 60_000
const MAX_PER_MIN = 15

export function checkAntiSpam(input: PipelineInput): { blocked: boolean; reason?: string } {
  const { message, sessionKey } = input

  if (!message.trim()) return { blocked: true, reason: 'empty' }

  if (message.length > 500) {
    return { blocked: true, reason: 'Tin nhắn quá dài (tối đa 500 ký tự) nhé!' }
  }

  // Rate limiting per session
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

  // Repeated message (3 lần liên tiếp)
  const recentUser = input.history
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.content.trim())
  if (recentUser.length >= 3 && recentUser.every(c => c === message.trim())) {
    return { blocked: true, reason: 'Mình nhận tin rồi nha! Bạn muốn mình làm gì không?' }
  }

  return { blocked: false }
}
