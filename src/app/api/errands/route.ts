import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const {
      type,
      pickup_address,
      pickup_lat,
      pickup_lng,
      delivery_address,
      delivery_lat,
      delivery_lng,
      items_description,
      estimated_items_cost,
      package_description,
      note,
      payment_method = "cash",
    } = await req.json()

    if (!type || !pickup_address || !delivery_address ||
        pickup_lat == null || pickup_lng == null || delivery_lat == null || delivery_lng == null) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    if (!["buy_for_me", "deliver_for_me"].includes(type)) {
      return NextResponse.json({ error: "Loại dịch vụ không hợp lệ" }, { status: 400 })
    }

    const { data: errand, error } = await supabase
      .from("errands")
      .insert({
        customer_id:          user.id,
        type,
        status:               "pending",
        pickup_address,
        pickup_lat,
        pickup_lng,
        delivery_address,
        delivery_lat,
        delivery_lng,
        items_description:    items_description ?? null,
        estimated_items_cost: estimated_items_cost ?? null,
        package_description:  package_description ?? null,
        note:                 note ?? null,
        service_fee:          25000,
        payment_method,
      })
      .select("id")
      .single()

    if (error || !errand) return NextResponse.json({ error: "Không thể tạo yêu cầu" }, { status: 500 })

    return NextResponse.json({ errandId: errand.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
