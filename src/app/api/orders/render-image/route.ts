// API: GET /api/orders/render-image?orderId=xxx
// Render HTML order notification template → trả về PNG buffer
// Dùng puppeteer-core + @sparticuz/chromium-min (free, tự host trên Vercel)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

export const runtime  = 'nodejs'
export const maxDuration = 30   // Vercel Hobby: 10s limit, Pro: 60s

const CHROMIUM_URL = 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) return new NextResponse('Missing orderId', { status: 400 })

  const supabase = adminClient()

  // Lấy đơn hàng
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, status, delivery_address, note, subtotal, delivery_fee, total_amount,
      payment_method, created_at,
      profiles!orders_customer_id_fkey(full_name, phone),
      order_items(name, price, quantity, note)
    `)
    .eq('id', orderId)
    .single()

  if (!order) return new NextResponse('Order not found', { status: 404 })

  type OrderRow = typeof order & {
    profiles:    { full_name: string | null; phone: string } | null
    order_items: Array<{ name: string; price: number; quantity: number; note: string | null }>
  }
  const o = order as unknown as OrderRow

  const createdAt = new Date(o.created_at)
  const timeStr   = `${createdAt.getHours().toString().padStart(2,'0')}:${createdAt.getMinutes().toString().padStart(2,'0')} · ${createdAt.getDate()}/${createdAt.getMonth()+1}/${createdAt.getFullYear()}`
  const items     = (o.order_items ?? [])

  // Build HTML inline (không phụ thuộc URL bên ngoài → đảm bảo render offline)
  const itemsHtml = items.map(i => `
    <div class="item-row">
      <div>
        <div class="item-name">${i.name}</div>
        ${i.note ? `<div class="item-note">${i.note}</div>` : ''}
      </div>
      <div class="item-qty">×${i.quantity}</div>
      <div class="item-price">${fmt(i.price * i.quantity)}</div>
    </div>`).join('')

  const customerName = o.profiles?.full_name ?? 'Khách hàng'
  const paymentLabel = o.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'
  const shortId      = o.id.slice(0, 6).toUpperCase()

  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;padding:20px}
.card{width:420px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12)}
.header{background:linear-gradient(135deg,#FF6B00,#FF8C00);padding:16px 20px;display:flex;align-items:center;justify-content:space-between}
.header-left{display:flex;align-items:center;gap:10px}
.logo{width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px}
.brand{color:#fff;font-weight:800;font-size:16px}
.brand-sub{color:rgba(255,255,255,0.8);font-size:11px;margin-top:1px}
.status-badge{background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);border-radius:20px;padding:4px 12px;color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;gap:5px}
.dot{width:7px;height:7px;background:#fff;border-radius:50%}
.order-id-row{background:#FFF8F3;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #FFE5CC}
.order-id{font-size:13px;color:#999}
.order-id strong{color:#FF6B00;font-size:15px;font-weight:700}
.time{font-size:12px;color:#999}
.body{padding:16px 20px}
.section-title{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#aaa;font-weight:600;margin-bottom:8px}
.customer-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px}
.avatar{width:40px;height:40px;min-width:40px;background:linear-gradient(135deg,#FF6B00,#FFB347);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px}
.name{font-weight:700;font-size:15px;color:#1a1a1a}
.phone{font-size:13px;color:#666;margin-top:2px}
.address{font-size:12px;color:#888;margin-top:4px}
.divider{height:1px;background:#f0f0f0;margin:12px 0}
.item-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #f5f5f5}
.item-row:last-child{border-bottom:none}
.item-name{font-size:14px;color:#222;flex:1}
.item-qty{background:#FF6B00;color:#fff;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700;margin:0 10px}
.item-price{font-size:14px;font-weight:600;color:#333;min-width:75px;text-align:right}
.item-note{font-size:11px;color:#999;margin-top:2px}
.total-block{background:#FFF8F3;border-radius:10px;padding:12px 14px;margin:14px 0}
.total-row{display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:5px}
.total-row.bold{font-size:16px;font-weight:800;color:#1a1a1a;padding-top:8px;border-top:1px solid #FFE5CC;margin-top:6px}
.total-row.bold span:last-child{color:#FF6B00}
.payment-row{display:flex;align-items:center;gap:8px;background:#f8f8f8;border-radius:8px;padding:8px 12px;font-size:13px;color:#555}
.pill{background:#e3f2fd;color:#1565c0;border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600}
.footer{background:#fafafa;border-top:1px solid #f0f0f0;padding:10px 20px;text-align:center;font-size:11px;color:#bbb}
</style></head><body>
<div class="card">
  <div class="header">
    <div class="header-left">
      <div class="logo">🛵</div>
      <div><div class="brand">DakGo</div><div class="brand-sub">Krông Pắc · Đắk Lắk</div></div>
    </div>
    <div class="status-badge"><div class="dot"></div> Đơn mới</div>
  </div>
  <div class="order-id-row">
    <div class="order-id">Mã đơn: <strong>#GN-${shortId}</strong></div>
    <div class="time">${timeStr}</div>
  </div>
  <div class="body">
    <div class="section-title">Khách hàng</div>
    <div class="customer-row">
      <div class="avatar">${customerName.charAt(0).toUpperCase()}</div>
      <div>
        <div class="name">${customerName}</div>
        <div class="phone">📞 ${o.profiles?.phone ?? ''}</div>
        <div class="address">📍 ${o.delivery_address}</div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="section-title">Món đặt</div>
    ${itemsHtml}
    <div class="total-block">
      <div class="total-row"><span>Tạm tính</span><span>${fmt(o.subtotal)}</span></div>
      <div class="total-row"><span>Phí giao</span><span>${fmt(o.delivery_fee)}</span></div>
      <div class="total-row bold"><span>Tổng cộng</span><span>${fmt(o.total_amount)}</span></div>
    </div>
    <div class="payment-row">💳 Thanh toán: <span class="pill">${paymentLabel}</span></div>
    ${o.note ? `<div style="background:#fffde7;border-radius:8px;padding:8px 12px;margin-top:12px;font-size:13px;color:#795548">📝 ${o.note}</div>` : ''}
  </div>
  <div class="footer">DakGo · Krông Pắc · Đắk Lắk</div>
</div>
</body></html>`

  // Launch puppeteer
  const browser = await puppeteer.launch({
    args:            chromium.args,
    defaultViewport: { width: 460, height: 900, deviceScaleFactor: 2 },
    executablePath:  await chromium.executablePath(CHROMIUM_URL),
    headless:        true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    // Crop tới đúng kích thước card
    const card = await page.$('.card')
    const png  = await card!.screenshot({ type: 'png' })

    return new NextResponse(png as unknown as BodyInit, {
      headers: {
        'Content-Type':  'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } finally {
    await browser.close()
  }
}
