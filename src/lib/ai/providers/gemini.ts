// Gemini Provider — Adapter for Google Gemini API
// Activate: set AI_PROVIDER=gemini + GEMINI_API_KEY in env

import type { AIProvider } from './base'
import type { AIExtraction, ExtractedItem } from '../types'
import { EXTRACTION_SCHEMA, EXTRACTION_RULES } from './base'

const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

const SYSTEM_INSTRUCTION = `Bạn là module trích xuất dữ liệu đơn hàng cho app giao đồ ăn DakGo Việt Nam.
Schema: ${EXTRACTION_SCHEMA}${EXTRACTION_RULES}`

const EMPTY: AIExtraction = { items: [], shopName: null, phone: null, address: null, intent: null, confidence: 0 }

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini'

  async extract(message: string, contextSummary: string): Promise<AIExtraction> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.warn('[gemini] GEMINI_API_KEY not set')
      return EMPTY
    }

    const prompt = contextSummary
      ? `[Ngữ cảnh: ${contextSummary}]\n\nTin nhắn: ${message}`
      : message

    try {
      const res = await fetch(
        `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents:           [{ parts: [{ text: prompt }] }],
            generationConfig:   {
              temperature:      0,
              maxOutputTokens:  600,
              responseMimeType: 'application/json',
            },
          }),
          signal: AbortSignal.timeout(8000),
        },
      )

      if (!res.ok) return EMPTY

      const data = await res.json()
      const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
      return this.parse(raw)
    } catch (err) {
      console.error('[gemini] error:', err)
      return EMPTY
    }
  }

  private parse(raw: string): AIExtraction {
    try {
      const parsed = JSON.parse(raw)
      return {
        items:      Array.isArray(parsed.items)
          ? parsed.items.map((it: Record<string, unknown>): ExtractedItem => ({
              rawName:   String(it.rawName ?? it.name ?? '').slice(0, 100),
              quantity:  Math.max(1, Math.min(20, parseInt(String(it.quantity)) || 1)),
              note:      it.note ? String(it.note).slice(0, 200) : null,
              modifiers: Array.isArray(it.modifiers) ? (it.modifiers as string[]).map(String) : [],
            })).filter((it: ExtractedItem) => it.rawName.length > 0)
          : [],
        shopName:   parsed.shopName   ? String(parsed.shopName).slice(0, 100)  : null,
        phone:      parsed.phone      ? String(parsed.phone).replace(/\D/g, '').slice(0, 11) : null,
        address:    parsed.address    ? String(parsed.address).slice(0, 300)   : null,
        intent:     ['ORDER','FIND','CANCEL','TRACK','OTHER'].includes(parsed.intent)
          ? parsed.intent as AIExtraction['intent'] : null,
        confidence: typeof parsed.confidence === 'number'
          ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      }
    } catch {
      return EMPTY
    }
  }
}
