"use client"
import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

type PostgresEvent = "INSERT" | "UPDATE" | "DELETE" | "*"

export interface RealtimeOptions {
  channelName: string
  table: string
  event?: PostgresEvent
  filter?: string
  enabled?: boolean
  onData: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
}

export function useRealtime({
  channelName,
  table,
  event = "*",
  filter,
  enabled = true,
  onData,
}: RealtimeOptions) {
  // Keep onData ref-stable to avoid re-subscribing on every render
  const onDataRef = useRef(onData)
  onDataRef.current = onData

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const config = filter
      ? { event, schema: "public" as const, table, filter }
      : { event, schema: "public" as const, table }

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", config, (payload) => onDataRef.current(payload))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [channelName, table, event, filter, enabled])
}
