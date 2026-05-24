"use client"
import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSessionStore } from "@/store/sessionStore"
import type { UserRole } from "@/types"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { setProfile, clear } = useSessionStore()

  useEffect(() => {
    const supabase = createClient()

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { clear(); return }

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, phone, role, is_active")
        .eq("id", user.id)
        .single()

      if (data) setProfile({ ...data, role: data.role as UserRole })
      else clear()
    }

    loadProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") clear()
      else loadProfile()
    })

    return () => subscription.unsubscribe()
  }, [setProfile, clear])

  return <>{children}</>
}
