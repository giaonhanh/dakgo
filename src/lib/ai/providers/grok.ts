import type { AIProvider } from './base'
import type { AIExtraction, ExtractedItem } from '../types'
import { EXTRACTION_SCHEMA, EXTRACTION_RULES } from './base'

const GROK_BASE  = 'https://api.x.ai/v1'
const GROK_MODEL = process.env.GROK_MODEL ?? 'grok-3-mini'

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

export class GrokProvider implements AIProvider {
  readonly name = 'grok'

  async extract(message: string, contextSummary: string): Promise<AIExtraction> {
    const apiKey = process.env.GROK_API_KEY
    if (!apiKey) {
      console.warn('[grok] GROK_API_KEY not set')
      return { items: [], shopName: null, phone: null, address: null, intent: null, confidence: 0 }
    }

    const userContent = contextSummary
      ? `[Ngữ cảnh: ${contextSummary}]\n\nKhách nhắn: "${message}"`
      : `Khách nhắn: "${message}"`

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
          max_tokens:      400,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(8000),
      })

      if (!res.ok) {
        console.error('[grok] API error:', res.status)
        return { items: [], shopName: null, phone: null, address: null, intent: null, confidence: 0 }
      }

      const data    = await res.json()
      const content = data.choices?.[0]?.message?.content ?? '{}'
      return this.parse(content)
    } catch (err) {
      console.error('[grok] request error:', err)
      return { items: [], shopName: null, phone: null, address: null, intent: null, confidence: 0 }
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
      return { items: [], shopName: null, phone: null, address: null, intent: null, confidence: 0 }
    }
  }
}
