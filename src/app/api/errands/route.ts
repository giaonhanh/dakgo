import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { dispatchOrder } from "@/lib/dispatch"

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
      service_fee: clientServiceFee,
      payment_method = "cash",
    } = await req.json()

    if (!type || !pickup_address || !delivery_address ||
        pickup_lat == null || pickup_lng == null || delivery_lat == null || delivery_lng == null) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    if (!["buy_for_me", "deliver_for_me"].includes(type)) {
      return NextResponse.json({ error: "Loại dịch vụ không hợp lệ" }, { status: 400 })
    }

    // Lấy phí dịch vụ từ app_settings
    const { data: pricingRow } = await supabase
      .from("app_settings").select("value").eq("key", "pricing").maybeSingle()
    const pricingCfg = pricingRow?.value as Record<string, { rows?: string[]; extra?: string }> | null
    const getMinFee = (rows?: string[]) => parseInt(rows?.[0] ?? "0") || 20000
    const fallbackFee = type === "buy_for_me"
      ? getMinFee(pricingCfg?.errand?.rows)
      : getMinFee(pricingCfg?.delivery_pkg?.rows)
    const service_fee = (typeof clientServiceFee === "number" && clientServiceFee > 0)
      ? clientServiceFee
      : fallbackFee

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
        service_fee,
        payment_method,
      })
      .select("id")
      .single()

    if (error || !errand) return NextResponse.json({ error: "Không thể tạo yêu cầu" }, { status: 500 })

    // Dispatch:
    // - buy_for_me  → tìm tài xế gần địa điểm MUA HÀNG nhất (pickup = nơi mua)
    // - deliver_for_me → tìm tài xế gần người GỬI nhất (pickup = địa chỉ lấy hàng)
    dispatchOrder("errands", errand.id, []).catch(() => {})

    return NextResponse.json({ errandId: errand.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
