"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function ClientRedirect({ shopId }: { shopId: string }) {
  const router = useRouter()
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(`/shop/${shopId}`)
    })
  }, [shopId, router])
  return null
}
