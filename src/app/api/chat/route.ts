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
    if (!sessionKey || typeof sessionKey !== 'string') {
      return NextResponse.json({ error: 'Thiếu sessionKey' }, { status: 400 })
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
