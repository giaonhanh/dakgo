import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      phone: string; password: string; name: string
      role: "customer" | "driver_moto" | "driver_taxi" | "merchant"
      vehicleType?: string; plate?: string; carModel?: string
      shopName?: string; shopAddr?: string; shopCat?: string
    }

    const { phone, password, name, role, vehicleType, plate, carModel, shopName, shopAddr, shopCat } = body

    const dbRole = role === "customer" ? "customer"
                 : role === "merchant" ? "merchant"
                 : "driver"

    // Create auth user — admin API auto-confirms, no email verification needed
    const { data, error: authErr } = await adminClient.auth.admin.createUser({
      email:         `${phone}@giaonhanh.local`,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, phone, role: dbRole },
    })

    if (authErr || !data.user) {
      const msg = authErr?.message ?? ""
      // Supabase trả về "already registered" hoặc "User already registered"
      if (msg.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "duplicate" }, { status: 409 })
      }
      return NextResponse.json({ error: msg || "Không tạo được tài khoản" }, { status: 400 })
    }

    const userId = data.user.id

    // Update profile — trigger đã tạo row với role='customer', ta update đúng role
    const { error: profileErr } = await adminClient.from("profiles").upsert({
      id:        userId,
      phone,
      full_name: name,
      role:      dbRole,
      is_active: true,
    }, { onConflict: "id" })

    if (profileErr) {
      // Rollback: xóa auth user vừa tạo
      await adminClient.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: "Lỗi tạo profile: " + profileErr.message }, { status: 500 })
    }

    // Tạo bản ghi drivers nếu đăng ký tài xế
    if (dbRole === "driver") {
      const { error: driverErr } = await adminClient.from("drivers").upsert({
        id:            userId,
        vehicle_type:  role === "driver_taxi" ? "car" : (vehicleType || "motorbike"),
        license_plate: plate || "—",
        vehicle_model: role === "driver_taxi" ? (carModel || null) : null,
        is_approved:   false,
        status:        "offline",
      }, { onConflict: "id" })

      if (driverErr) {
        await adminClient.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: "Lỗi tạo hồ sơ tài xế" }, { status: 500 })
      }
    }

    // Tạo bản ghi shops nếu đăng ký merchant
    if (dbRole === "merchant") {
      const { data: settingRow } = await adminClient
        .from("app_settings").select("value").eq("key", "commission").maybeSingle()
      const defaultCommission = parseInt(
        (settingRow?.value as { defaultRate?: string } | null)?.defaultRate ?? "15"
      ) || 15

      await adminClient.from("shops").insert({
        owner_id:        userId,
        name:            shopName || `Cửa hàng của ${name}`,
        address:         shopAddr || "Phước An, Krông Pắc",
        category:        shopCat ? shopCat.replace(/^[^\s]+ /, "").trim() : "Đồ ăn",
        status:          "pending",
        is_open:         false,
        commission_rate: defaultCommission,
      })
    }

    return NextResponse.json({ success: true, role: dbRole })
  } catch (err) {
    console.error("Register API error:", err)
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 })
  }
}
