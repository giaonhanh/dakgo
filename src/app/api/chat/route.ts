import { NextResponse } from 'next/server'
import { runPipeline } from '@/lib/ai/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { message, sessionKey } = await req.json()

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Tin nhắn không hợp lệ' }, { status: 400 })
    }
    if (message.trim().length > 500) {
      return NextResponse.json({ error: 'Tin nhắn quá dài' }, { status: 400 })
    }
    if (!sessionKey || typeof sessionKey !== 'string' || sessionKey.length > 64) {
      return NextResponse.json({ error: 'Thiếu sessionKey' }, { status: 400 })
    }
    // Validate UUID format (v4)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionKey)) {
      return NextResponse.json({ error: 'sessionKey không hợp lệ' }, { status: 400 })
    }

    const result = await runPipeline(message.trim(), sessionKey.trim())
    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/chat] error:', err)
    return NextResponse.json({
      reply:        'Xin lỗi, mình gặp sự cố nhỏ 😅 Bạn thử lại sau ít giây nhé!',
      actions:      [],
      quickReplies: ['🔄 Thử lại', '📞 Liên hệ hỗ trợ'],
      richContent:  [],
      confidence:   0,
      sessionId:    '',
    })
  }
}
