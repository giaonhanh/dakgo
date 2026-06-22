// DakGo AI Pipeline — Orchestrator
// Thứ tự tầng KHÔNG thay đổi:
// 1-Spam → 2-Gatekeeper → 3-Intent → 4-Search → 5-Extract →
// 6-Confidence → 7-Validate → 8-Missing → 9-Memory → 10-Action → 11-Controller

import { normalizeInput }        from './layers/normalizer'
import { checkAntiSpam }         from './layers/spam'
import { checkGatekeeper }       from './layers/gatekeeper'
import { classifyIntent, detectFaq, detectCategoryFromMessage, needsLocation } from './layers/intent'
import { fuzzySearchProducts, fuzzySearchShops, getOpenShops, getShopProducts } from './layers/search'
import { extractFromMessage }    from './layers/extractor'
import { calculateConfidence }   from './layers/confidence'
import { validateOrder }         from './layers/validator'
import { getNextMissingField }   from './layers/missing'
import { loadOrCreateSession, loadHistory, persistTurn } from './layers/memory'
import { decideAction }          from './layers/action'
import { formatForWeb }          from './layers/controller'
import type { PipelineOutput, SessionContext, ResolvedItem, UIResponse } from './types'
import { EMPTY_CONTEXT }         from './types'

export async function runPipeline(
  message:    string,
  sessionKey: string,
): Promise<UIResponse> {
  // ── Layer 0: Text Normalization ──────────────────────────────────────────
  message = normalizeInput(message)

  // ── Layer 9: Load Context Memory ──────────────────────────────────────────
  const session = await loadOrCreateSession(sessionKey)
  const history = await loadHistory(session.id, 8)
  const ctx     = session.context

  // ── Layer 1: Anti Spam ────────────────────────────────────────────────────
  const spam = checkAntiSpam({ message, sessionKey, session, history })
  if (spam.blocked) {
    return formatForWeb(blocked(spam.reason ?? 'Tin nhắn không hợp lệ.'), session.id)
  }

  // ── Layer 2: Gatekeeper ───────────────────────────────────────────────────
  const gate = checkGatekeeper(message)
  if (gate.blocked) {
    return formatForWeb(blocked(gate.blockMsg ?? 'Nội dung không phù hợp.'), session.id)
  }
  if (gate.isCompetitor) {
    return formatForWeb({
      reply:          'DakGo giao tại Krông Pắc, nhanh và giá tốt hơn 🍜 Gõ tên món là đặt được ngay!',
      actions:        [],
      quickReplies:   [],
      updatedContext: ctx,
      blocked:        false,
      confidence:     0,
    }, session.id)
  }

  // ── Layer 3: Intent Classifier ────────────────────────────────────────────
  const intent = classifyIntent({ message, sessionKey, session, history })

  // ── Layer 5: AI Extractor (async, concurrent with search) ────────────────
  const contextSummary = ctx.items.length > 0
    ? `Đã chọn: ${ctx.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}. Đang hỏi về: ${ctx.lastAskField ?? 'địa chỉ'}.`
    : ''

  // ── Layers 4 & 5: Fuzzy Search + AI Extract in parallel ──────────────────
  const faqKey      = detectFaq(message)
  const category    = detectCategoryFromMessage(message)
  const wantsNearby = needsLocation(message)

  const needShopMenu  = ctx.shopId !== null && ctx.items.length === 0
  const needOpenShops = !needShopMenu && (intent === 'FIND_SHOP' || intent === 'FAQ' || ctx.items.length === 0)

  const [extracted, openShops, shopMenu] = await Promise.all([
    intent === 'FAQ' ? Promise.resolve({ items: [], shopName: null, phone: null, address: null, intent: null, confidence: 0 })
                     : extractFromMessage(message, contextSummary),
    needOpenShops ? getOpenShops(category ?? undefined) : Promise.resolve([]),
    needShopMenu  ? getShopProducts(ctx.shopId!)        : Promise.resolve([]),
  ])

  // Layer 4: Fuzzy search products from extracted item names
  let productResults: Awaited<ReturnType<typeof fuzzySearchProducts>> = shopMenu
  let shopResults:    Awaited<ReturnType<typeof fuzzySearchShops>>    = openShops

  if (extracted.shopName && intent === 'FIND_SHOP') {
    // Tìm quán theo tên cụ thể
    const found = await fuzzySearchShops(extracted.shopName)
    if (found.length > 0) shopResults = found
  }

  if (extracted.items.length > 0) {
    const keyword = extracted.items[0].rawName
    if (ctx.shopId && shopMenu.length > 0) {
      // Tìm trong menu của quán đã chọn, fallback về full menu
      const filtered = shopMenu.filter(p =>
        p.name.toLowerCase().includes(keyword.toLowerCase().slice(0, Math.max(2, keyword.length - 1)))
      )
      productResults = filtered.length > 0 ? filtered : shopMenu
    } else {
      productResults = await fuzzySearchProducts(keyword)
    }
  }

  // Resolve extracted items against search results
  const updatedItems: ResolvedItem[] = [...ctx.items]

  for (const ei of extracted.items) {
    const key = ei.rawName.toLowerCase()

    // Skip if already in cart
    const exists = updatedItems.find(i => i.rawName.toLowerCase() === key)
    if (exists) { exists.quantity += ei.quantity; continue }

    // Match to product
    const match = productResults.find(p =>
      p.name.toLowerCase().includes(key.slice(0, Math.max(3, key.length - 1)))
    ) ?? productResults[0]

    if (match) {
      updatedItems.push({
        rawName:     ei.rawName,
        productId:   match.id,
        productName: match.name,
        shopId:      match.shopId,
        shopName:    match.shopName,
        quantity:    ei.quantity,
        price:       match.price,
        note:        ei.note,
        modifiers:   ei.modifiers ?? [],
        confidence:  match.similarity,
      })
    }
  }

  // Merge context
  const newCtx: SessionContext = {
    ...ctx,
    intent,
    items:     updatedItems,
    turnCount: ctx.turnCount + 1,
  }
  if (extracted.phone    && !ctx.phone)    newCtx.phone    = extracted.phone
  if (extracted.address  && !ctx.address)  newCtx.address  = extracted.address
  if (updatedItems.length > 0 && !ctx.shopId) {
    newCtx.shopId   = updatedItems[0].shopId
    newCtx.shopName = updatedItems[0].shopName
  }
  // Nếu AI trích xuất tên quán nhưng chưa có trong items, lưu vào context để search
  if (extracted.shopName && !newCtx.shopName) {
    newCtx.shopName = extracted.shopName
  }

  // ── Layer 6: Confidence Layer ─────────────────────────────────────────────
  const confidence = calculateConfidence(newCtx, extracted.confidence)

  // ── Layer 7: Business Validator — skip nếu confidence quá thấp (tiết kiệm DB call)
  const validation = (newCtx.shopId && confidence.total >= 0.30)
    ? await validateOrder(newCtx)
    : { valid: true, issues: [], shopIsOpen: true, shopName: null }

  // ── Layer 8: Missing Info Engine ──────────────────────────────────────────
  const missingField = getNextMissingField(newCtx)
  if (missingField) newCtx.lastAskField = missingField

  // ── Layer 10: Action Layer ────────────────────────────────────────────────
  const decision = decideAction({
    intent,
    aiIntent:        extracted.intent,
    ctx:             newCtx,
    confidence,
    validation,
    missingField,
    productResults,
    shopResults,
    offTopic:        gate.offTopic,
    isCompetitor:    gate.isCompetitor,
    faqKey:          faqKey ?? undefined,
    wantsNearby,
    category:        category ?? undefined,
  })

  const output: PipelineOutput = {
    reply:          decision.reply,
    actions:        [decision.action, ...decision.extraActions],
    quickReplies:   decision.quickReplies,
    updatedContext: newCtx,
    blocked:        false,
    confidence:     confidence.total,
  }

  // ── Persist to memory (Layer 9 write) ─────────────────────────────────────
  await persistTurn(session.id, message, decision.reply, newCtx, {
    intent,
    confidence:   confidence.total,
    actions:      output.actions.map(a => a.type),
  })

  // ── Layer 11: UI Controller ───────────────────────────────────────────────
  return formatForWeb(output, session.id)
}

function blocked(reason: string): PipelineOutput {
  return {
    reply:          reason,
    actions:        [],
    quickReplies:   [],
    updatedContext: EMPTY_CONTEXT,
    blocked:        true,
    confidence:     0,
  }
}
