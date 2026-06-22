import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface GuestOrderBody {
  items:         Array<{ productId: string; name: string; price: number; quantity: number; note?: string | null }>
  shopId:        string
  shopName:      string
  address:       string
  addressLat?:   number
  addressLng?:   number
  phone:         string
  name:          string
  paymentMethod: 'cash' | 'transfer'
  subtotal:      number
  deliveryFee:   number
  total:         number
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as GuestOrderBody
    const { items, shopId, address, addressLat, addressLng, phone, name, paymentMethod, subtotal, deliveryFee, total } = body

    if (!phone || !address || !items?.length || !shopId) {
      return NextResponse.json({ error: 'Thiếu thông tin đặt hàng' }, { status: 400 })
    }

    const supabase = adminClient()

    // 1. Tìm hoặc tạo profile bằng số điện thoại
    const normalPhone = phone.replace(/\s/g, '').replace(/^0/, '+84')

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    let userId: string

    if (existing?.id) {
      userId = existing.id
      // Cập nhật tên nếu chưa có
      if (name) {
        await supabase.from('profiles').update({ full_name: name }).eq('id', userId).is('full_name', null)
      }
    } else {
      // Tạo auth user mới → trigger tự tạo profile
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        phone:         normalPhone,
        phone_confirm: true,
        user_metadata: { full_name: name || 'Khách hàng' },
      })

      if (authErr || !authData.user) {
        // Fallback: thử tìm theo phone format khác
        const { data: fallback } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', normalPhone)
          .maybeSingle()

        if (!fallback?.id) {
          return NextResponse.json({ error: 'Không thể tạo tài khoản. Vui lòng thử lại.' }, { status: 500 })
        }
        userId = fallback.id
      } else {
        userId = authData.user.id
        // Đảm bảo profile tồn tại (trigger có thể delay)
        await supabase.from('profiles').upsert({
          id:        userId,
          phone:     phone,
          full_name: name || 'Khách hàng',
          role:      'customer',
        }, { onConflict: 'id' })
      }
    }

    // 2. Tạo order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id:      userId,
        shop_id:          shopId,
        status:           'pending',
        delivery_address: address,
        delivery_lat:     addressLat ?? 12.6644,   // fallback tọa độ Krông Pắc
        delivery_lng:     addressLng ?? 108.4833,
        subtotal,
        delivery_fee:     deliveryFee,
        discount_amount:  0,
        total_amount:     total,
        payment_method:   paymentMethod === 'transfer' ? 'vietqr' : 'cash',
        payment_status:   'pending',
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      console.error('Order create error:', orderErr)
      return NextResponse.json({ error: 'Không tạo được đơn hàng' }, { status: 500 })
    }

    // 3. Tạo order_items
    const orderItems = items.map(i => ({
      order_id:   order.id,
      product_id: i.productId,
      name:       i.name,
      price:      i.price,
      quantity:   i.quantity,
      subtotal:   i.price * i.quantity,
      note:       i.note ?? null,
    }))

    await supabase.from('order_items').insert(orderItems)

    // 4. Tạo notification cho user
    await supabase.from('notifications').insert({
      user_id: userId,
      type:    'order',
      title:   'Đặt hàng thành công!',
      body:    `Đơn hàng của bạn đã được ghi nhận. Quán đang chuẩn bị...`,
      data:    { orderId: order.id },
    })

    return NextResponse.json({ orderId: order.id, userId })

  } catch (err) {
    console.error('Guest checkout error:', err)
    return NextResponse.json({ error: 'Lỗi hệ thống, vui lòng thử lại' }, { status: 500 })
  }
}
