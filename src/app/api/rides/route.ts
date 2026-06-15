import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { dispatchOrder } from "@/lib/dispatch"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })

    const {
      vehicle_type,
      pickup_address,
      pickup_lat,
      pickup_lng,
      dropoff_address,
      dropoff_lat,
      dropoff_lng,
      distance_km,
      estimated_fare,
      payment_method = "cash",
    } = await req.json()

    if (!vehicle_type || !pickup_address || !dropoff_address ||
        pickup_lat == null || pickup_lng == null || dropoff_lat == null || dropoff_lng == null) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    const { data: ride, error } = await supabase
      .from("rides")
      .insert({
        customer_id:    user.id,
        status:         "searching",
        vehicle_type,
        pickup_address,
        pickup_lat,
        pickup_lng,
        dropoff_address,
        dropoff_lat,
        dropoff_lng,
        distance_km:    distance_km ?? null,
        estimated_fare: estimated_fare ?? null,
        payment_method,
      })
      .select("id")
      .single()

    if (error || !ride) return NextResponse.json({ error: "Không thể tạo chuyến xe" }, { status: 500 })

    // Dispatch: tìm tài xế gần điểm ĐÓN KHÁCH nhất (taxi + xe ôm đều dùng pickup)
    dispatchOrder("rides", ride.id, []).catch(() => {})

    return NextResponse.json({ rideId: ride.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
