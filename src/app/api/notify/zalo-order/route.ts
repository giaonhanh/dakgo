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

  const items       = o.order_items ?? []
  const itemsDetail = items.map(i => `• ${i.quantity}× ${i.name} — ${fmt(i.price * i.quantity)}`).join('\n')
  const payLabel    = o.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'

  // ── Tin 1: Văn bản đầy đủ thông tin khách + đơn ──────────────────────────
  const fullText = [
    `🛵 ĐƠN MỚI · #GN-${shortId}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `👤 ${o.profiles?.full_name ?? 'Khách hàng'}`,
    `📞 ${o.profiles?.phone ?? 'Chưa có SĐT'}`,
    `📍 ${o.delivery_address}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `🍜 MÓN ĐẶT:`,
    itemsDetail,
    `━━━━━━━━━━━━━━━━━━━`,
    `💰 Tổng: ${fmt(o.total_amount)} · ${payLabel}`,
    ...(o.note ? [`📝 Ghi chú: ${o.note}`] : []),
  ].join('\n')

  await fetch(ZALO_OA_SEND, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'access_token': accessToken },
    body:    JSON.stringify({
      recipient: { user_id: owner.zalo_id },
      message:   { text: fullText },
    }),
  })

  // ── Tin 2: Ảnh đơn + nút [✅ Xác nhận] [❌ Từ chối] ─────────────────────
  let attachmentId: string | null = null
  try {
    const imageUrl = `${baseUrl}/api/orders/render-image?orderId=${orderId}`
    const imgRes   = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) })
    const imgBlob  = await imgRes.blob()
    const form     = new FormData()
    form.append('file', imgBlob, 'order.png')
    const up       = await fetch(ZALO_UPLOAD, {
      method: 'POST', headers: { 'access_token': accessToken }, body: form,
    })
    const upData   = await up.json() as { data?: { attachment_id?: string } }
    attachmentId   = upData.data?.attachment_id ?? null
  } catch (e) {
    console.warn('[zalo-order] image upload failed:', e)
  }

  const element: Record<string, unknown> = {
    title:   `#GN-${shortId} · ${fmt(o.total_amount)}`,
    subtitle: `Bấm để xác nhận hoặc từ chối đơn này`,
    default_action: { type: 'oa.open.url', url: `${baseUrl}/merchant` },
    buttons: [
      { title: '✅ Xác nhận đơn', type: 'oa.query.hide', payload: `CONFIRM_${orderId}` },
      { title: '❌ Từ chối',      type: 'oa.query.hide', payload: `REJECT_${orderId}`  },
    ],
  }
  if (attachmentId) element.image_url = `https://zalo.me/oa/image/${attachmentId}`

  const res  = await fetch(ZALO_OA_SEND, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'access_token': accessToken },
    body:    JSON.stringify({
      recipient: { user_id: owner.zalo_id },
      message:   { attachment: { type: 'template', payload: { template_type: 'list', elements: [element] } } },
    }),
  })
  const data = await res.json() as { error?: number }

  return NextResponse.json({ ok: !data.error || data.error === 0, hasImage: !!attachmentId, zaloUserId: owner.zalo_id })
}
