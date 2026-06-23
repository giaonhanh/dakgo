// API: POST /api/notify/zalo-order
// Gửi tin nhắn Zalo OA dạng list template: ảnh đơn + nút [✅ Xác nhận] [❌ Từ chối]
// Merchant bấm nút trong Zalo → Zalo gửi event về /api/webhooks/zalo-oa → tự update DB

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ZALO_OA_SEND  = 'https://openapi.zalo.me/v3.0/oa/message/cs'
const ZALO_UPLOAD   = 'https://openapi.zalo.me/v2.0/oa/upload/image'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orderId } = await req.json() as { orderId: string }
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

  const supabase    = adminClient()
  const accessToken = process.env.ZALO_OA_ACCESS_TOKEN
  if (!accessToken) return NextResponse.json({ error: 'ZALO_OA_ACCESS_TOKEN not set' }, { status: 500 })

  // ── Lấy đơn + chủ quán ─────────────────────────────────────────────────────
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, total_amount, subtotal, delivery_fee, delivery_address, payment_method, note,
      shops!orders_shop_id_fkey(name, owner_id),
      profiles!orders_customer_id_fkey(full_name, phone),
      order_items(name, quantity, price)
    `)
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  type OrderRow = typeof order & {
    shops:       { name: string; owner_id: string } | null
    profiles:    { full_name: string | null; phone: string } | null
    order_items: Array<{ name: string; quantity: number; price: number }>
  }
  const o = order as unknown as OrderRow

  if (!o.shops?.owner_id) return NextResponse.json({ error: 'No shop owner' }, { status: 404 })

  const { data: owner } = await supabase
    .from('profiles')
    .select('zalo_id')
    .eq('id', o.shops.owner_id)
    .single()

  if (!owner?.zalo_id) {
    return NextResponse.json({ error: 'Owner zalo_id not linked', ownerId: o.shops.owner_id }, { status: 422 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.dakgo.com'
  const shortId = orderId.slice(0, 6).toUpperCase()
  const fmt     = (n: number) => n.toLocaleString('vi-VN') + 'đ'

  const itemsSummary = (o.order_items ?? []).slice(0, 4)
    .map(i => `${i.quantity}× ${i.name}`)
    .join(' · ')

  const subtitle = [
    `👤 ${o.profiles?.full_name ?? 'Khách'} · ${o.profiles?.phone ?? ''}`,
    `📍 ${o.delivery_address}`,
    `🍜 ${itemsSummary}`,
    `💰 ${fmt(o.total_amount)} · ${o.payment_method === 'cash' ? 'Tiền mặt' : 'CK'}`,
  ].join('\n')

  // ── Bước 1: Upload ảnh đơn lên Zalo ────────────────────────────────────────
  let attachmentId: string | null = null
  try {
    const imageUrl = `${baseUrl}/api/orders/render-image?orderId=${orderId}`
    const imgRes   = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) })
    const imgBlob  = await imgRes.blob()
    const form     = new FormData()
    form.append('file', imgBlob, 'order.png')

    const up      = await fetch(ZALO_UPLOAD, {
      method: 'POST', headers: { 'access_token': accessToken }, body: form,
    })
    const upData  = await up.json() as { data?: { attachment_id?: string } }
    attachmentId  = upData.data?.attachment_id ?? null
  } catch (e) {
    console.warn('[zalo-order] image upload failed:', e)
  }

  // ── Bước 2: Gửi list template với nút bấm ──────────────────────────────────
  // oa.query.hide: merchant bấm → Zalo gửi payload text về webhook của OA
  const element: Record<string, unknown> = {
    title:   `🛵 ĐƠN MỚI · #GN-${shortId}`,
    subtitle,
    default_action: {
      type: 'oa.open.url',
      url:  `${baseUrl}/merchant`,
    },
    buttons: [
      {
        title:   '✅ Xác nhận đơn',
        type:    'oa.query.hide',
        payload: `CONFIRM_${orderId}`,
      },
      {
        title:   '❌ Từ chối',
        type:    'oa.query.hide',
        payload: `REJECT_${orderId}`,
      },
    ],
  }

  if (attachmentId) {
    element.image_url = `https://zalo.me/oa/image/${attachmentId}`
  }

  const body = {
    recipient: { user_id: owner.zalo_id },
    message: {
      attachment: {
        type:    'template',
        payload: {
          template_type: 'list',
          elements:      [element],
        },
      },
    },
  }

  const res  = await fetch(ZALO_OA_SEND, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'access_token': accessToken },
    body:    JSON.stringify(body),
  })
  const data = await res.json() as { error?: number; message?: string }

  if (data.error && data.error !== 0) {
    // Fallback về text nếu template thất bại
    console.warn('[zalo-order] template failed, trying text:', data)
    const textRes = await fetch(ZALO_OA_SEND, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': accessToken },
      body: JSON.stringify({
        recipient: { user_id: owner.zalo_id },
        message: {
          text: `🛵 ĐƠN MỚI #GN-${shortId}\n${subtitle}\n\nXác nhận tại: ${baseUrl}/merchant`,
        },
      }),
    })
    const textData = await textRes.json() as { error?: number }
    return NextResponse.json({ ok: textData.error === 0, fallback: true })
  }

  return NextResponse.json({ ok: true, hasImage: !!attachmentId, zaloUserId: owner.zalo_id })
}
