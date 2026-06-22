import type { AIProvider } from './base'
import type { AIExtraction, ExtractedItem } from '../types'
import { EXTRACTION_SCHEMA, EXTRACTION_RULES } from './base'

const GROK_BASE = 'https://api.x.ai/v1'

// Danh sách model free của xAI — thứ tự ưu tiên: nhanh nhất trước
// Khi một model hit quota (429) → tự động thử model tiếp theo
const FREE_MODELS = [
  'grok-3-mini',        // nhanh nhất, quota thấp nhất
  'grok-3-mini-fast',   // faster variant nếu có
  'grok-2-1212',        // model cũ, quota riêng biệt
  'grok-beta',          // fallback cuối
] as const

// Cho phép override toàn bộ chain qua env
const MODEL_CHAIN: string[] = process.env.GROK_MODEL_CHAIN
  ? process.env.GROK_MODEL_CHAIN.split(',').map(s => s.trim()).filter(Boolean)
  : [...FREE_MODELS]

// Rate-limit tracker: model → timestamp hết hạn tạm nghỉ
// Mỗi server instance giữ state này trong memory (đủ cho serverless per-request)
// Cooldown 60s — sau đó thử lại model đó
const RATE_LIMITED = new Map<string, number>()
const COOLDOWN_MS  = 60_000

function isRateLimited(model: string): boolean {
  const until = RATE_LIMITED.get(model)
  if (!until) return false
  if (Date.now() > until) { RATE_LIMITED.delete(model); return false }
  return true
}

function markRateLimited(model: string): void {
  RATE_LIMITED.set(model, Date.now() + COOLDOWN_MS)
  console.warn(`[grok] model ${model} rate-limited — cooldown 60s, thử model khác`)
}

const SYSTEM_PROMPT = `Bạn là module trích xuất dữ liệu đơn hàng cho app giao đồ ăn DakGo tại Krông Pắc, Đắk Lắk.

QUY TẮC ĐẦU RA TUYỆT ĐỐI:
- Chỉ trả về JSON hợp lệ. Không markdown. Không giải thích. Không text thừa.
- Không chào hỏi. Không bình luận. Không gợi ý ngoài schema.
- Output không phải JSON hợp lệ = lỗi nghiêm trọng.

SCHEMA bắt buộc:
${EXTRACTION_SCHEMA}

${EXTRACTION_RULES}

HÀNH VI BỊ CẤM:
- Không chat với user
- Không giải thích reasoning
- Không gợi ý món ăn
- Không thêm field ngoài schema
- Không output text ngoài JSON

VÍ DỤ:
Input: "2 my cay lam hoa cap 2 it bot ngot"
Output: {"items":[{"name":"mỳ cay","quantity":2,"modifiers":["cấp 2","ít bột ngọt"]}],"shopName":"Lâm Hoà","phone":null,"address":null,"intent":"ORDER","confidence":0.85}

Input: "cho mình 1 com ga khong hanh giao 123 le loi sdt 0901234567"
Output: {"items":[{"name":"cơm gà","quantity":1,"modifiers":["không hành"]}],"shopName":null,"phone":"0901234567","address":"123 Lê Lợi","intent":"ORDER","confidence":0.95}

Input: "2 mỳ cayy ko hanh"
Output: {"items":[{"name":"mỳ cay","quantity":2,"modifiers":["không hành"]}],"shopName":null,"phone":null,"address":null,"intent":"ORDER","confidence":0.75}

Input: "mỳ cay có cay không"
Output: {"items":[],"shopName":null,"phone":null,"address":null,"intent":"FIND","confidence":0.88}

Input: "gà rán mr ben 3 phần giao gần cây xăng phước an"
Output: {"items":[{"name":"gà rán","quantity":3,"modifiers":[]}],"shopName":"Mr Ben","phone":null,"address":"cây xăng Krông Pắc","intent":"ORDER","confidence":0.92}`

const EMPTY: AIExtraction = {
  items: [], shopName: null, phone: null, address: null, intent: null, confidence: 0,
}

export class GrokProvider implements AIProvider {
  readonly name = 'grok'

  async extract(message: string, contextSummary: string): Promise<AIExtraction> {
    const apiKey = process.env.GROK_API_KEY
    if (!apiKey) {
      console.warn('[grok] GROK_API_KEY not set')
      return EMPTY
    }

    const userContent = contextSummary
      ? `[Ngữ cảnh: ${contextSummary}]\n\nKhách nhắn: "${message}"`
      : `Khách nhắn: "${message}"`

    // Thử từng model trong chain, bỏ qua model đang bị rate-limit
    for (const model of MODEL_CHAIN) {
      if (isRateLimited(model)) {
        console.info(`[grok] skip ${model} (rate-limited, cooldown)`)
        continue
      }

      const result = await this.callModel(model, apiKey, userContent)

      if (result === 'RATE_LIMITED') {
        markRateLimited(model)
        continue   // thử model tiếp theo
      }

      if (result === 'ERROR') {
        continue   // lỗi khác (network, parse) → thử model tiếp theo
      }

      // Thành công
      return result
    }

    // Tất cả model đều fail
    console.error('[grok] all models failed or rate-limited')
    return EMPTY
  }

  private async callModel(
    model:      string,
    apiKey:     string,
    content:    string,
  ): Promise<AIExtraction | 'RATE_LIMITED' | 'ERROR'> {
    try {
      const res = await fetch(`${GROK_BASE}/chat/completions`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages:        [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content },
          ],
          temperature:     0,
          max_tokens:      400,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(5000),
      })

      // 429 = quota hoặc rate limit
      if (res.status === 429) {
        const body = await res.text().catch(() => '')
        console.warn(`[grok] ${model} 429:`, body.slice(0, 100))
        return 'RATE_LIMITED'
      }

      // 402 = hết credit/quota billing
      if (res.status === 402) {
        console.warn(`[grok] ${model} 402: quota/billing exceeded`)
        return 'RATE_LIMITED'
      }

      if (!res.ok) {
        console.error(`[grok] ${model} HTTP ${res.status}`)
        return 'ERROR'
      }

      const data    = await res.json()
      const text    = data.choices?.[0]?.message?.content ?? '{}'
      return this.parse(text)

    } catch (err) {
      // AbortError = timeout
      const isTimeout = (err as Error).name === 'AbortError'
      if (isTimeout) {
        console.warn(`[grok] ${model} timeout 5s`)
      } else {
        console.error(`[grok] ${model} error:`, (err as Error).message)
      }
      return 'ERROR'
    }
  }

  private parse(raw: string): AIExtraction {
    try {
      const parsed = JSON.parse(raw)
      const items: ExtractedItem[] = Array.isArray(parsed.items)
        ? parsed.items.map((it: Record<string, unknown>) => ({
            rawName:   String(it.name ?? it.rawName ?? '').slice(0, 100),
            quantity:  Math.max(1, Math.min(20, parseInt(String(it.quantity)) || 1)),
            note:      Array.isArray(it.modifiers) && it.modifiers.length > 0
                         ? (it.modifiers as string[]).join(', ')
                         : (it.note ? String(it.note).slice(0, 200) : null),
            modifiers: Array.isArray(it.modifiers) ? (it.modifiers as string[]).map(String) : [],
          })).filter((it: ExtractedItem) => it.rawName.length > 0)
        : []

      return {
        items,
        shopName:   parsed.shopName   ? String(parsed.shopName).slice(0, 100) : null,
        phone:      parsed.phone      ? String(parsed.phone).replace(/\D/g, '').slice(0, 11) : null,
        address:    parsed.address    ? String(parsed.address).slice(0, 300) : null,
        intent:     ['ORDER','FIND','CANCEL','TRACK','OTHER'].includes(parsed.intent)
                      ? parsed.intent as AIExtraction['intent']
                      : null,
        confidence: typeof parsed.confidence === 'number'
                      ? Math.min(1, Math.max(0, parsed.confidence))
                      : 0.5,
      }
    } catch {
      return EMPTY
    }
  }
}
