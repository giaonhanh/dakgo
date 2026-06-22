// Layer 5: AI Extractor — AI Provider + Rule-based fallback
// Khi AI fail/timeout/quota → rule-based vẫn đảm bảo pipeline hoạt động
import { getProvider }  from '../providers'
import type { AIExtraction, ExtractedItem } from '../types'

// ── Rule-based constants ─────────────────────────────────────────────────────

const QTY_WITH_UNIT = /(\d+)\s*(?:tô|ly|hộp|cái|gói|chai|suất|bịch|phần|con|ổ|cốc|lon|bình|dĩa|đĩa|bát)?\s+([a-zA-ZÀ-ỹà-ỹ][a-zA-ZÀ-ỹà-ỹ\s]{1,40}?)(?=\s+và\s|\s+\d|\s*giao\b|\s*ship\b|\s*$)/gi

const ADDRESS_RE = /(?:giao\s+(?:đến\s+|tới\s+)?|tới\s+|đến\s+|địa\s+chỉ[:\s]+)(.{5,80}?)(?:\s+sdt\b|\s+số\s+đt\b|\s+phone\b|\s*$)/i

const PHONE_RE = /(?:^|sdt[:\s]*|điện thoại[:\s]*|\bsố\b[:\s]*)((0|\+84)[0-9\s\-\.]{8,10})/i

const SHOP_RE = /(?:quán|nhà hàng|cửa hàng|từ quán|tại quán|ở quán)\s+([A-ZÀ-Ỹa-zà-ỹ][a-zA-ZÀ-ỹà-ỹ\s\.]{1,40}?)(?:\s+\d|\s*$|\s+cho\b|\s+giao\b)/i

// Tên quán viết tắt/không dấu → tên chuẩn
const SHOP_ALIASES: Record<string, string> = {
  'lam hoa': 'Lâm Hoà', 'lam hoà': 'Lâm Hoà',
  'tam phat': 'Tâm Phát', 'tâm phát': 'Tâm Phát',
  'mr ben': 'Mr. Ben', 'thanh thu': 'Thanh Thư',
}

// Modifier patterns (ít cay, không hành, thêm phô mai, v.v.)
const MODIFIER_RES = [
  /ít\s+(?:cay|đường|béo|đá|muối|bột ngọt|mắm|kem)/gi,
  /không\s+(?:hành|ớt|cay|đá|đường|nước mắm|rau|phô mai)/gi,
  /thêm\s+(?:phô mai|trứng|thịt|rau|ớt|tương|trứng gà)/gi,
  /(?:cấp|level)\s*\d+/gi,
  /(?:size|cỡ)\s*(?:lớn|nhỏ|vừa|L|M|S)\b/gi,
  /(?:nóng|lạnh|ấm)\b/gi,
]

function extractModifiers(text: string): string[] {
  const mods: string[] = []
  for (const re of MODIFIER_RES) {
    const hits = text.match(re)
    if (hits) mods.push(...hits.map(m => m.trim()))
    re.lastIndex = 0
  }
  return [...new Set(mods)]
}

function normalizeShopName(raw: string): string {
  const lower = raw.toLowerCase().trim()
  return SHOP_ALIASES[lower] ?? raw.trim()
}

// ── Rule-based extractor ─────────────────────────────────────────────────────

function ruleBasedExtract(message: string): AIExtraction {
  const items: ExtractedItem[] = []
  let address:  string | null = null
  let phone:    string | null = null
  let shopName: string | null = null

  // Extract items: "2 tô phở bò", "1 ly trà sữa"
  const re = new RegExp(QTY_WITH_UNIT.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(message)) !== null) {
    const qty  = Math.min(parseInt(m[1]) || 1, 20)
    const name = m[2]?.trim()
    if (name && name.length >= 2 && !/giao|ship|đến|tới/i.test(name)) {
      items.push({ rawName: name, quantity: qty, note: null, modifiers: extractModifiers(message) })
    }
  }

  // Fallback: "2 phở bò" không có đơn vị
  if (items.length === 0) {
    const simple = message.match(/(\d+)\s+([a-zA-ZÀ-ỹà-ỹ][a-zA-ZÀ-ỹà-ỹ\s]{1,30}?)(?:\s+giao\b|\s+ship\b|\s*$)/i)
    if (simple) {
      items.push({
        rawName:   simple[2].trim(),
        quantity:  Math.min(parseInt(simple[1]) || 1, 20),
        note:      null,
        modifiers: extractModifiers(message),
      })
    }
  }

  // Extract address
  const addrMatch = message.match(ADDRESS_RE)
  if (addrMatch) address = addrMatch[1].trim()

  // Extract phone
  const phoneMatch = message.match(PHONE_RE)
  if (phoneMatch) phone = phoneMatch[1].replace(/[\s\-\.]/g, '')

  // Extract shop name
  const shopMatch = message.match(SHOP_RE)
  if (shopMatch) shopName = normalizeShopName(shopMatch[1])

  const confidence = items.length > 0 ? (address ? 0.55 : 0.35) : 0.15

  return {
    items,
    shopName,
    phone,
    address,
    intent:     items.length > 0 ? 'ORDER' : null,
    confidence,
  }
}

// ── Main: AI first, rule-based fallback ─────────────────────────────────────

const EMPTY: AIExtraction = {
  items: [], shopName: null, phone: null, address: null, intent: null, confidence: 0,
}

export async function extractFromMessage(
  message:        string,
  contextSummary: string,
): Promise<AIExtraction> {
  try {
    const provider = getProvider()
    const result   = await provider.extract(message, contextSummary)

    // AI trả về có ích → dùng luôn
    if (result.items.length > 0 || result.shopName || result.address || result.phone) {
      return result
    }

    // AI trả về rỗng (fail/timeout/quota) → fallback rule-based
    console.warn('[L5] AI returned empty — rule-based fallback')
    const fallback = ruleBasedExtract(message)
    return fallback.items.length > 0 || fallback.address ? fallback : EMPTY

  } catch (err) {
    console.error('[L5] AI provider error — rule-based fallback:', (err as Error).message)
    const fallback = ruleBasedExtract(message)
    return fallback.items.length > 0 || fallback.address ? fallback : EMPTY
  }
}
