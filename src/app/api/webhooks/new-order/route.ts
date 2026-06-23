// Webhook: POST /api/webhooks/new-order
// Được gọi bởi Supabase Database Webhook khi có INSERT vào bảng orders
// Cấu hình tại: Supabase Dashboard → Database → Webhooks

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Xác thực chữ ký từ Supabase webhook
function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

interface SupabaseWebhookPayload {
  type:   'INSERT' | 'UPDATE' | 'DELETE'
  table:  string
  schema: string
  record: {
    id:        string
    status:    string
    shop_id:   string
    created_at: string
    [key: string]: unknown
  }
}

export async function POST(req: NextRequest) {
  const rawBody  = await req.text()
  const sig      = req.headers.get('x-supabase-signature')

  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: SupabaseWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Chỉ xử lý đơn mới (INSERT) với status pending
  if (payload.type !== 'INSERT' || payload.table !== 'orders') {
    return NextResponse.json({ skipped: true })
  }

  const orderId = payload.record.id
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.dakgo.com'

  // Gửi thông báo Zalo bất đồng bộ (không block response)
  fetch(`${baseUrl}/api/notify/zalo-order`, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-internal-secret': process.env.INTERNAL_WEBHOOK_SECRET ?? '',
    },
    body: JSON.stringify({ orderId }),
  }).catch(e => console.error('[new-order webhook] Zalo notify failed:', e))

  return NextResponse.json({ ok: true, orderId })
}
