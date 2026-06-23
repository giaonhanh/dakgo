// API: /api/orders/notification-image?orderId=xxx
// Trả về URL đến trang HTML preview đơn hàng (có thể screenshot thành ảnh)
// Dùng để chia sẻ qua Zalo: gửi link hoặc screenshot trang này

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

  const supabase = adminClient()

  // Lấy đơn hàng + items + khách hàng
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id, status, delivery_address, note, subtotal, delivery_fee, total_amount,
      payment_method, created_at,
      profiles!orders_customer_id_fkey(full_name, phone),
      order_items(name, price, quantity, note)
    `)
    .eq('id', orderId)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  type OrderRow = typeof order & {
    profiles: { full_name: string | null; phone: string } | null
    order_items: Array<{ name: string; price: number; quantity: number; note: string | null }>
  }
  const o = order as unknown as OrderRow

  const items = (o.order_items ?? []).map(i => ({
    name:  i.name,
    price: i.price,
    qty:   i.quantity,
    note:  i.note,
  }))

  const createdAt = new Date(o.created_at)
  const timeStr = `${createdAt.getHours().toString().padStart(2,'0')}:${createdAt.getMinutes().toString().padStart(2,'0')} · ${createdAt.getDate()}/${createdAt.getMonth()+1}/${createdAt.getFullYear()}`

  // Build URL cho trang HTML template
  const baseUrl = req.nextUrl.origin
  const params = new URLSearchParams({
    id:      o.id,
    time:    timeStr,
    name:    o.profiles?.full_name ?? 'Khách hàng',
    phone:   o.profiles?.phone ?? '',
    address: o.delivery_address,
    items:   encodeURIComponent(JSON.stringify(items)),
    payment: o.payment_method,
    ...(o.note ? { note: o.note } : {}),
  })

  const htmlUrl = `${baseUrl}/order-notification-template.html?${params}`

  return NextResponse.json({
    orderId: o.id,
    status:  o.status,
    htmlUrl,
    // Ghi chú: mở htmlUrl trên browser → screenshot → gửi Zalo
    message: 'Mở htmlUrl, chụp màn hình và gửi qua Zalo',
  })
}
