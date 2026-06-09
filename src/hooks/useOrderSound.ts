"use client"
import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

// Map sound key → file path
const SOUND: Record<string, string> = {
  merchant:  "/sounds/ban_oi_co_don.mp3",
  food:      "/sounds/co_don_do_an_ban_oi.mp3",
  buy_for:   "/sounds/co_don_giao_hang_ban_oi.mp3",
  taxi:      "/sounds/co_don_taxi_ban_oi.mp3",
  xe_om:     "/sounds/co-don-xe-om-ban-oi.mp3",
}

// Driver: service_type → sound key
const DRIVER_SOUND: Record<string, string> = {
  food:    "food",
  buy_for: "buy_for",
  taxi:    "taxi",
  xe_om:   "xe_om",
}

export function useOrderSound(
  role: "merchant" | "driver",
  shopId?: string | null,
) {
  const unlockedRef = useRef(false)

  // Unlock audio context sau lần tương tác đầu tiên
  useEffect(() => {
    const unlock = () => { unlockedRef.current = true }
    window.addEventListener("click",       unlock, { once: true })
    window.addEventListener("touchstart",  unlock, { once: true })
    return () => {
      window.removeEventListener("click",      unlock)
      window.removeEventListener("touchstart", unlock)
    }
  }, [])

  function play(key: string) {
    const src = SOUND[key]
    if (!src) return
    const audio = new Audio(src)
    audio.volume = 1
    audio.play().catch(() => null)
  }

  // ── Nguồn 1: SW postMessage (app mở ở tab khác / background) ──
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "PLAY_ORDER_SOUND" && e.data.sound) {
        play(e.data.sound)
      }
    }
    navigator.serviceWorker.addEventListener("message", handler)
    return () => navigator.serviceWorker.removeEventListener("message", handler)
  }, [])

  // ── Nguồn 2: Supabase Realtime (app đang foreground) ──
  useEffect(() => {
    const supabase = createClient()

    if (role === "merchant") {
      if (!shopId) return
      const ch = supabase
        .channel(`order-sound-merchant-${shopId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders", filter: `shop_id=eq.${shopId}` },
          () => play("merchant"),
        )
        .subscribe()
      return () => { supabase.removeChannel(ch) }
    }

    if (role === "driver") {
      // orders table = food orders only, no service_type column exists
      const chOrders = supabase
        .channel("order-sound-driver-orders")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
          play("food")
        })
        .subscribe()

      // errands: map type field to sound key
      const ERRAND_SOUND: Record<string, string> = {
        deliver_for_me: "buy_for",
        buy_for_me:     "buy_for",
      }
      const chErrands = supabase
        .channel("order-sound-driver-errands")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "errands" }, payload => {
          const etype = (payload.new as { type?: string }).type ?? ""
          play(ERRAND_SOUND[etype] ?? "food")
        })
        .subscribe()

      return () => { supabase.removeChannel(chOrders); supabase.removeChannel(chErrands) }
    }
  }, [role, shopId])
}
