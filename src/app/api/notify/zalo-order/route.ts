// API: POST /api/notify/zalo-order
// Gửi ảnh thông báo đơn hàng đến Zalo cá nhân của chủ quán qua Zalo OA
// Điều kiện: chủ quán đã follow hoặc nhắn tin cho Zalo OA DakGo ít nhất 1 lần

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ZALO_OA_API = 'https://openapi.zalo.me/v3.0/oa/message/cs'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  // Xác thực internal call (chỉ webhook Supabase mới được gọi)
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orderId } = await req.json() as { orderId: string }
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

  const supabase    = adminClient()
  const accessToken = process.env.ZALO_OA_ACCESS_TOKEN

  if (!accessToken) {
    return NextResponse.json({ error: 'ZALO_OA_ACCESS_TOKEN not configured' }, { status: 500 })
  }

  // Lấy đơn + shop owner's zalo_id
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, total_amount, delivery_address, payment_method,
      shops!orders_shop_id_fkey(name, owner_id),
      profiles!orders_customer_id_fkey(full_name, phone),
      order_items(name, quantity)
    `)
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  type OrderRow = typeof order & {
    shops:    { name: string; owner_id: string } | null
    profiles: { full_name: string | null; phone: string } | null
    order_items: Array<{ name: string; quantity: number }>
  }
  const o = order as unknown as OrderRow

  if (!o.shops?.owner_id) {
    return NextResponse.json({ error: 'Shop owner not found' }, { status: 404 })
  }

  // Lấy zalo_id của chủ quán
  const { data: owner } = await supabase
    .from('profiles')
    .select('zalo_id, full_name')
    .eq('id', o.shops.owner_id)
    .single()

  if (!owner?.zalo_id) {
    return NextResponse.json({
      error: 'Shop owner has not linked Zalo account',
      ownerId: o.shops.owner_id,
    }, { status: 422 })
  }

  // Build URL ảnh đơn hàng
  const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.dakgo.com'
  const imageUrl  = `${baseUrl}/api/orders/render-image?orderId=${orderId}`

  // Tóm tắt món đặt
  const itemsSummary = (o.order_items ?? []).slice(0, 3)
    .map(i => `${i.quantity}× ${i.name}`)
    .join(', ')

  const shortId = orderId.slice(0, 6).toUpperCase()
  const fmt     = (n: number) => n.toLocaleString('vi-VN') + 'đ'

  // Gửi tin nhắn Zalo OA — dạng text + ảnh attachment
  // Bước 1: Upload ảnh lên Zalo để lấy attachment_id
  let attachmentId: string | null = null

  try {
    const imgRes  = await fetch(imageUrl)
    const imgBlob = await imgRes.blob()

    const formData = new FormData()
    formData.append('file', imgBlob, 'order.png')

    const uploadRes = await fetch('https://openapi.zalo.me/v2.0/oa/upload/image', {
      method:  'POST',
      headers: { 'access_token': accessToken },
      body:    formData,
    })
    const uploadData = await uploadRes.json() as { data?: { attachment_id?: string } }
    attachmentId = uploadData.data?.attachment_id ?? null
  } catch (e) {
    console.warn('[zalo-order] Image upload failed, sending text only:', e)
  }

  // Bước 2: Gửi tin nhắn
  let messageBody: object

  if (attachmentId) {
    // Gửi kèm ảnh
    messageBody = {
      recipient: { user_id: owner.zalo_id },
      message: {
        attachment: {
          type:    'template',
          payload: {
            template_type: 'media',
            elements:      [{ media_type: 'image', attachment_id: attachmentId }],
          },
        },
      },
    }
  } else {
    // Fallback: tin nhắn text
    messageBody = {
      recipient: { user_id: owner.zalo_id },
      message: {
        text: `🛵 ĐƠN MỚI #GN-${shortId}\n\n👤 ${o.profiles?.full_name ?? 'Khách hàng'} · ${o.profiles?.phone ?? ''}\n📍 ${o.delivery_address}\n🍜 ${itemsSummary}\n💰 ${fmt(o.total_amount)} · ${o.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}\n\n➡️ Vào app để xác nhận: ${baseUrl}/merchant`,
      },
    }
  }

  const zaloRes = await fetch(ZALO_OA_API, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': accessToken,
    },
    body: JSON.stringify(messageBody),
  })

  const zaloData = await zaloRes.json() as { error?: number; message?: string }

  if (zaloData.error && zaloData.error !== 0) {
    console.error('[zalo-order] Zalo API error:', zaloData)
    return NextResponse.json({ error: 'Zalo API error', detail: zaloData }, { status: 500 })
  }

  return NextResponse.json({ ok: true, zaloUserId: owner.zalo_id, hasImage: !!attachmentId })
}
