// Layer 9: Context Memory — Supabase, anonymous session (no auth required)
import { createClient } from '@supabase/supabase-js'
import type { ChatSession, ChatMessage, SessionContext } from '../types'
import { EMPTY_CONTEXT } from '../types'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function loadOrCreateSession(sessionKey: string): Promise<ChatSession> {
  const supabase = sb()

  const { data } = await supabase
    .from('chat_sessions')
    .select('id, session_key, context, message_count')
    .eq('session_key', sessionKey)
    .single()

  if (data) {
    return {
      id:           data.id,
      sessionKey:   data.session_key,
      context:      (data.context as SessionContext) ?? EMPTY_CONTEXT,
      messageCount: data.message_count ?? 0,
    }
  }

  const { data: created } = await supabase
    .from('chat_sessions')
    .insert({ session_key: sessionKey, context: EMPTY_CONTEXT, message_count: 0 })
    .select('id, session_key, context, message_count')
    .single()

  return {
    id:           created!.id,
    sessionKey,
    context:      EMPTY_CONTEXT,
    messageCount: 0,
  }
}

export async function loadHistory(sessionId: string, limit = 10): Promise<ChatMessage[]> {
  const supabase = sb()

  const { data } = await supabase
    .from('chat_messages')
    .select('id, session_id, role, content, metadata, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return ((data ?? []).reverse()) as unknown as ChatMessage[]
}

export async function persistTurn(
  sessionId:  string,
  userMsg:    string,
  assistMsg:  string,
  newCtx:     SessionContext,
  metadata:   Record<string, unknown> = {},
): Promise<void> {
  const supabase = sb()

  await Promise.all([
    supabase.from('chat_messages').insert([
      { session_id: sessionId, role: 'user',      content: userMsg,  metadata: {} },
      { session_id: sessionId, role: 'assistant', content: assistMsg, metadata },
    ]),
    supabase.from('chat_sessions').update({
      context:         newCtx,
      message_count:   newCtx.turnCount,
      last_message_at: new Date().toISOString(),
    }).eq('id', sessionId),
  ])
}

export async function resetSession(sessionKey: string): Promise<void> {
  const supabase = sb()
  await supabase
    .from('chat_sessions')
    .update({ context: EMPTY_CONTEXT, message_count: 0 })
    .eq('session_key', sessionKey)
}
