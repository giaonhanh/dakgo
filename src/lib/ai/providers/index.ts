// AI Provider Factory
// Đổi provider: set env AI_PROVIDER=grok|gemini|openai|local
// Không sửa pipeline khi đổi provider

import type { AIProvider } from './base'
import { GrokProvider }   from './grok'
import { GeminiProvider } from './gemini'

let _cached: AIProvider | null = null

export function getProvider(): AIProvider {
  if (_cached) return _cached

  const name = (process.env.AI_PROVIDER ?? 'grok').toLowerCase()

  switch (name) {
    case 'gemini': _cached = new GeminiProvider(); break
    default:       _cached = new GrokProvider();   break
  }

  console.log(`[ai] Using provider: ${_cached.name}`)
  return _cached
}

export type { AIProvider }
