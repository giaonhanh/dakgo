"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type PushPermission = "default" | "granted" | "denied"

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function usePushNotification() {
  const [permission, setPermission] = useState<PushPermission>(() => {
    if (typeof Notification === "undefined") return "default"
    return Notification.permission as PushPermission
  })

  const requestPermission = async (userId: string): Promise<boolean> => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) return false

    const result = await Notification.requestPermission()
    setPermission(result as PushPermission)
    console.log("[Push] Permission:", result)
    if (result !== "granted") return false

    try {
      const registration = await navigator.serviceWorker.ready
      console.log("[Push] SW ready, subscribing...")
      const existing = await registration.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ) as unknown as ArrayBuffer,
      })

      const json = sub.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      const supabase = createClient()
      await supabase.from("push_subscriptions").upsert({
        user_id:  userId,
        endpoint: json.endpoint,
        p256dh:   json.keys.p256dh,
        auth:     json.keys.auth,
      }, { onConflict: "user_id" })

      console.log("[Push] Subscription saved for", userId)
      return true
    } catch (err) {
      console.error("[Push] Subscription error:", err)
      return false
    }
  }

  const unsubscribe = async (userId: string): Promise<void> => {
    if (!("serviceWorker" in navigator)) return
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()

    const supabase = createClient()
    await supabase.from("push_subscriptions").delete().eq("user_id", userId)
  }

  return { permission, requestPermission, unsubscribe }
}
