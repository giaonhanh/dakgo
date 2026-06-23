// Webhook: /api/webhooks/zalo-oa
// Nhận event từ Zalo OA khi merchant bấm nút [✅ Xác nhận] hoặc [❌ Từ chối]
// Cấu hình tại: developers.zalo.me → OA của bạn → Webhook URL

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Xác thực chữ ký từ Zalo
function verifyZaloSignature(body: string, sig: string | null): boolean {
  const secret = process.env.ZALO_OA_SECRET
  if (!secret || !sig) return false
  const mac = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return sig === mac
}

// Zalo OA event types
interface ZaloEvent {
  app_id:          string
  user_id_by_app:  string   // Zalo user ID của merchant
  event_name:      string   // 'user_send_text' | 'user_send_sticker' | ...
  timestamp:       number
  message?: {
    text:   string
    msg_id: string
  }
  sender?: {
    id: string
  }
}

// Gửi tin nhắn phản hồi về Zalo OA
async function replyZalo(userId: string, text: string) {
  const token = process.env.ZALO_OA_ACCESS_TOKEN
  if (!token) return
  await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'access_token': token },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message:   { text },
    }),
  })
}

// GET: Zalo OA verification (khi setup webhook lần đầu)
export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('challenge')
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}

// POST: Nhận event từ Zalo
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig     = req.headers.get('X-ZEvent-Signature')

  // Bỏ qua verify trong dev, bật lại ở prod
  if (process.env.NODE_ENV === 'production' && !verifyZaloSignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: ZaloEvent
  try { event = JSON.parse(rawBody) }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Chỉ xử lý khi merchant gửi text (từ nút bấm template)
  if (event.event_name !== 'user_send_text' || !event.message?.text) {
    return NextResponse.json({ skipped: true })
  }

  const payload  = event.message.text.trim()
  const zaloId   = event.user_id_by_app ?? event.sender?.id
  const supabase = adminClient()

  // ── CONFIRM_{orderId} ────────────────────────────────────────────────────────
  if (payload.startsWith('CONFIRM_')) {
    const orderId = payload.replace('CONFIRM_', '')

    const { data: order, error } = await supabase
      .from('orders')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending')   // chỉ update nếu vẫn còn pending
      .select('id, customer_id, shop_id')
      .single()

    if (error || !order) {
      await replyZalo(zaloId, '⚠️ Đơn hàng không tìm thấy hoặc đã được xử lý rồi.')
      return NextResponse.json({ error: 'Order not found or already processed' })
    }

    // Thông báo cho merchant
    const shortId = orderId.slice(0, 6).toUpperCase()
    await replyZalo(zaloId, `✅ Đã xác nhận đơn #GN-${shortId}!\nQuán đang chuẩn bị món. Tài xế sẽ sớm nhận đơn.`)

    // Thông báo cho khách hàng
    await supabase.from('notifications').insert({
      user_id: order.customer_id,
      type:    'order',
      title:   'Quán đã xác nhận đơn hàng!',
      body:    'Quán đang chuẩn bị món. Tài xế sẽ lấy đơn sớm.',
      data:    { orderId: order.id },
    })

    // Trigger tìm tài xế
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.dakgo.com'
    fetch(`${baseUrl}/api/orders/parallel-dispatch`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    process.env.DISPATCH_API_KEY ?? '',
      },
      body: JSON.stringify({ orderId: order.id }),
    }).catch(e => console.warn('[zalo-oa] dispatch failed:', e))

    return NextResponse.json({ ok: true, action: 'confirmed', orderId })
  }

  // ── REJECT_{orderId} ─────────────────────────────────────────────────────────
  if (payload.startsWith('REJECT_')) {
    const orderId = payload.replace('REJECT_', '')

    const { data: order, error } = await supabase
      .from('orders')
      .update({
        status:        'cancelled',
        cancelled_at:  new Date().toISOString(),
        cancel_reason: 'Quán từ chối đơn',
        cancelled_by:  null,
      })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id, customer_id')
      .single()

    if (error || !order) {
      await replyZalo(zaloId, '⚠️ Đơn hàng không tìm thấy hoặc đã được xử lý rồi.')
      return NextResponse.json({ error: 'Order not found or already processed' })
    }

    const shortId = orderId.slice(0, 6).toUpperCase()
    await replyZalo(zaloId, `❌ Đã từ chối đơn #GN-${shortId}. Khách hàng sẽ được thông báo.`)

    // Thông báo cho khách hàng
    await supabase.from('notifications').insert({
      user_id: order.customer_id,
      type:    'order',
      title:   'Đơn hàng bị hủy',
      body:    'Rất tiếc, quán không thể nhận đơn lúc này. Vui lòng thử lại hoặc chọn quán khác.',
      data:    { orderId: order.id },
    })

    return NextResponse.json({ ok: true, action: 'rejected', orderId })
  }

  // Event khác (tin nhắn thường) → bỏ qua
  return NextResponse.json({ skipped: true, payload })
}
