import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { dispatchOrder } from "@/lib/dispatch"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const { order_id } = await req.json()
    if (!order_id) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 })

    // Xác minh caller là merchant sở hữu shop của đơn này
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, shop_id, shops(owner_id)")
      .eq("id", order_id)
      .single()

    if (!order) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 })

    type OrderRow = { id: string; status: string; shop_id: string; shops: { owner_id: string } | { owner_id: string }[] | null }
    const o = order as OrderRow
    const shopOwner = Array.isArray(o.shops)
      ? o.shops[0]?.owner_id
      : (o.shops as { owner_id: string } | null)?.owner_id

    // Admin hoặc merchant sở hữu shop
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    const isAdmin    = profile?.role === "admin"
    const isMerchant = shopOwner === user.id

    if (!isAdmin && !isMerchant) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 })
    }

    const result = await dispatchOrder("orders", order_id, [])

    if (!result.dispatched) {
      return NextResponse.json({ ok: false, message: "Không có tài xế gần đây" })
    }

    return NextResponse.json({ ok: true, driverId: result.driverId })
  } catch (err) {
    console.error("orders/dispatch error:", err)
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
