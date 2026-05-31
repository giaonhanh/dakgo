"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface ActiveOrder { id: string; status: string }

function ActiveOrderCard() {
  const [order, setOrder] = useState<ActiveOrder | null>(null)
  const pathname = usePathname()

  // Ẩn khi đang ở trang navigate/confirm (đã có toàn bộ thông tin đơn)
  const hidden = pathname.includes("/driver/navigate") || pathname.includes("/driver/confirm")

  useEffect(() => {
    const supabase = createClient()

    async function fetchActive() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("orders")
        .select("id, status")
        .eq("driver_id", user.id)
        .in("status", ["accepted", "delivering"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      setOrder(data ?? null)
    }

    fetchActive()

    const ch = supabase.channel("driver-active-layout")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, fetchActive)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  if (!order || hidden) return null

  const label = order.status === "delivering" ? "Đang giao hàng" : "Đã nhận · Đến lấy hàng"
  const num   = order.id.slice(-6).toUpperCase()

  return (
    <a href={`/driver/navigate/${order.id}`} style={{
      position: "fixed", bottom: 76, left: 14, right: 14, zIndex: 45,
      display: "flex", alignItems: "center", gap: 12,
      background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.35)",
      borderRadius: 14, padding: "10px 14px",
      backdropFilter: "blur(12px)",
      textDecoration: "none",
      boxShadow: "0 4px 20px rgba(62,207,110,0.12)",
    }}>
      <div style={{ fontSize: 22 }}>🚀</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#3ecf6e", fontSize: 12, fontWeight: 800 }}>
          #{num} · {label}
        </div>
        <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 2 }}>
          Nhấn để xem lộ trình
        </div>
      </div>
      <div style={{
        padding: "5px 10px", borderRadius: 8,
        background: "rgba(62,207,110,0.2)", border: "1px solid rgba(62,207,110,0.3)",
        color: "#3ecf6e", fontSize: 10, fontWeight: 700,
      }}>
        Xem →
      </div>
    </a>
  )
}

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ActiveOrderCard />
    </>
  )
}
