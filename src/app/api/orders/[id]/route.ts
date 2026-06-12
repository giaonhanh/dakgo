import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { maskPhone } from "@/lib/maskPhone"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        *,
        shop:shops(id, name, logo_url, address, phone),
        items:order_items(*),
        driver:drivers(id, vehicle_type, license_plate, profile:profiles(full_name, avatar_url, phone))
      `)
      .eq("id", id)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 })
    }

    // Mask SĐT trước khi trả về client — giữ đầy đủ ở server, mask ở response
    const safeOrder = {
      ...order,
      shop: order.shop ? { ...order.shop, phone: maskPhone(order.shop.phone) } : order.shop,
      driver: order.driver ? {
        ...order.driver,
        profile: order.driver.profile ? {
          ...order.driver.profile,
          phone: maskPhone(order.driver.profile.phone),
        } : order.driver.profile,
      } : order.driver,
    }

    return NextResponse.json(safeOrder)
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const body = await req.json()
    const allowed = ["status", "accepted_at", "preparing_at", "ready_at", "picked_up_at", "delivered_at"]
    const update: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) update[key] = body[key]
    }

    if (!Object.keys(update).length) {
      return NextResponse.json({ error: "Không có trường nào được cập nhật" }, { status: 400 })
    }

    const { error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", id)

    if (error) return NextResponse.json({ error: "Cập nhật thất bại" }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
