import type { AIProvider } from './base'
import type { AIExtraction, ExtractedItem } from '../types'
import { EXTRACTION_SCHEMA, EXTRACTION_RULES } from './base'

const GROK_BASE  = 'https://api.x.ai/v1'
const GROK_MODEL = process.env.GROK_MODEL ?? 'grok-3-mini'

const SYSTEM_PROMPT = `Bạn là module trích xuất dữ liệu đơn hàng cho app giao đồ ăn DakGo Việt Nam.
Phân tích tin nhắn tiếng Việt và trích xuất thông tin đặt hàng.

Schema bắt buộc:
${EXTRACTION_SCHEMA}
${EXTRACTION_RULES}`

export class GrokProvider implements AIProvider {
  readonly name = 'grok'

  async extract(message: string, contextSummary: string): Promise<AIExtraction> {
    const apiKey = process.env.GROK_API_KEY
    if (!apiKey) {
      console.warn('[grok] GROK_API_KEY not set, returning empty extraction')
      return { items: [], phone: null, address: null, intent: null }
    }

    const userContent = contextSummary
      ? `[Ngữ cảnh hiện tại: ${contextSummary}]\n\nTin nhắn của khách: ${message}`
      : message

    try {
      const res = await fetch(`${GROK_BASE}/chat/completions`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model:           GROK_MODEL,
          messages:        [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: userContent },
          ],
          temperature:     0,
          max_tokens:      600,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(8000),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error('[grok] API error:', res.status, err.slice(0, 200))
        return { items: [], phone: null, address: null, intent: null }
      }

      const data    = await res.json()
      const content = data.choices?.[0]?.message?.content ?? '{}'
      return this.parse(content)
    } catch (err) {
      console.error('[grok] request error:', err)
      return { items: [], phone: null, address: null, intent: null }
    }
  }

  private parse(raw: string): AIExtraction {
    try {
      const parsed = JSON.parse(raw)
      const items: ExtractedItem[] = Array.isArray(parsed.items)
        ? parsed.items.map((it: Record<string, unknown>) => ({
            rawName:  String(it.rawName ?? it.name ?? '').slice(0, 100),
            quantity: Math.max(1, Math.min(20, parseInt(String(it.quantity)) || 1)),
            note:     it.note ? String(it.note).slice(0, 200) : null,
          })).filter((it: ExtractedItem) => it.rawName.length > 0)
        : []

      return {
        items,
        phone:   parsed.phone   ? String(parsed.phone).replace(/\D/g, '').slice(0, 11) : null,
        address: parsed.address ? String(parsed.address).slice(0, 300) : null,
        intent:  ['ORDER','FIND','CANCEL','TRACK','OTHER'].includes(parsed.intent)
          ? parsed.intent as AIExtraction['intent']
          : null,
      }
    } catch {
      return { items: [], phone: null, address: null, intent: null }
    }
  }
}
