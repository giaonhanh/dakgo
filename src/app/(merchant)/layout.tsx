"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import MaintenanceGate from "@/components/MaintenanceGate"
import PushPermissionPrompt from "@/components/PushPermissionPrompt"
import { createClient } from "@/lib/supabase/client"

// Trang được phép vào ngay cả khi chưa setup xong
const SETUP_WHITELIST = ["/merchant/profile", "/merchant/register"]

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()

  useEffect(() => {
    if (SETUP_WHITELIST.some(p => pathname.startsWith(p))) return

    async function checkSetup() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shop } = await supabase
        .from("shops")
        .select("name, phone, lat, lng, status")
        .eq("owner_id", user.id)
        .single()

      if (!shop || (shop as { status?: string }).status !== "approved") return

      const complete = !!(shop as { lat?: number }).lat
        && !!(shop as { lng?: number }).lng
        && !!(shop as { phone?: string }).phone?.trim()
        && !!shop.name?.trim()

      if (!complete) router.replace("/merchant/profile")
    }
    checkSetup()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <MaintenanceGate>
      {children}
      <PushPermissionPrompt />
    </MaintenanceGate>
  )
}
