// DakGo AI Pipeline — Orchestrator
// Thứ tự tầng KHÔNG thay đổi:
// 1-Spam → 2-Gatekeeper → 3-Intent → 4-Search → 5-Extract →
// 6-Confidence → 7-Validate → 8-Missing → 9-Memory → 10-Action → 11-Controller

import { checkAntiSpam }        from './layers/spam'
import { checkGatekeeper }      from './layers/gatekeeper'
import { classifyIntent }       from './layers/intent'
import { fuzzySearchProducts, fuzzySearchShops, getOpenShops } from './layers/search'
import { extractFromMessage }   from './layers/extractor'
import { calculateConfidence }  from './layers/confidence'
import { validateOrder }        from './layers/validator'
import { getNextMissingField }  from './layers/missing'
import { loadOrCreateSession, loadHistory, persistTurn } from './layers/memory'
import { decideAction }         from './layers/action'
import { formatForWeb }         from './layers/controller'
import type { PipelineOutput, SessionContext, ResolvedItem, UIResponse } from './types'
import { EMPTY_CONTEXT }        from './types'

export async function runPipeline(
  message:    string,
  sessionKey: string,
): Promise<UIResponse> {
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

  // ── Layer 3: Intent Classifier ────────────────────────────────────────────
  const intent = classifyIntent({ message, sessionKey, session, history })

  // ── Layer 5: AI Extractor (async, concurrent with search) ────────────────
  const contextSummary = ctx.items.length > 0
    ? `Đã chọn: ${ctx.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}. Đang hỏi về: ${ctx.lastAskField ?? 'địa chỉ'}.`
    : ''

  // ── Layers 4 & 5: Fuzzy Search + AI Extract in parallel ──────────────────
  const [extracted, openShops] = await Promise.all([
    extractFromMessage(message, contextSummary),
    (intent === 'FIND_SHOP' || ctx.items.length === 0) ? getOpenShops() : Promise.resolve([]),
  ])

  // Layer 4: Fuzzy search products from extracted item names
  let productResults: Awaited<ReturnType<typeof fuzzySearchProducts>> = []
  let shopResults:    Awaited<ReturnType<typeof fuzzySearchShops>>    = openShops

  if (extracted.items.length > 0) {
    productResults = await fuzzySearchProducts(extracted.items[0].rawName)
  }
  if (intent === 'FIND_SHOP' && extracted.items.length === 0) {
    shopResults = openShops
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
  if (extracted.phone   && !ctx.phone)   newCtx.phone   = extracted.phone
  if (extracted.address && !ctx.address) newCtx.address = extracted.address
  if (updatedItems.length > 0 && !ctx.shopId) {
    newCtx.shopId   = updatedItems[0].shopId
    newCtx.shopName = updatedItems[0].shopName
  }

  // ── Layer 6: Confidence Layer ─────────────────────────────────────────────
  const confidence = calculateConfidence(newCtx)

  // ── Layer 7: Business Validator ───────────────────────────────────────────
  const validation = newCtx.shopId
    ? await validateOrder(newCtx)
    : { valid: true, issues: [], shopIsOpen: true, shopName: null }

  // ── Layer 8: Missing Info Engine ──────────────────────────────────────────
  const missingField = getNextMissingField(newCtx)
  if (missingField) newCtx.lastAskField = missingField

  // ── Layer 10: Action Layer ────────────────────────────────────────────────
  const decision = decideAction({
    intent,
    aiIntent:       extracted.intent,
    ctx:            newCtx,
    confidence,
    validation,
    missingField,
    productResults,
    shopResults,
    offTopic:       gate.offTopic,
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
    quickReplies:   ['🍜 Đặt đồ ăn', '📦 Giao hộ'],
    updatedContext: EMPTY_CONTEXT,
    blocked:        true,
    confidence:     0,
  }
}
