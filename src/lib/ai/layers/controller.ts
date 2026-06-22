// Layer 11: UI Controller — format response cho Web
// Zalo/Messenger: implement adapter riêng sau
import type { PipelineOutput, RichContent, UIResponse, ProductCardData, ShopCardData } from '../types'

const DELIVERY_FEE = 15000

export function formatForWeb(output: PipelineOutput, sessionId: string): UIResponse {
  const richContent: RichContent[] = []

  for (const action of output.actions) {
    switch (action.type) {

      case 'SHOW_PRODUCTS': {
        const products = (action.payload?.products ?? []) as ProductCardData[]
        products.forEach(p => richContent.push({ type: 'product_card', data: p }))
        break
      }

      case 'SHOW_SHOP': {
        const shops = (action.payload?.shops ?? []) as ShopCardData[]
        shops.forEach(s => richContent.push({ type: 'shop_card', data: s }))
        break
      }

      case 'SHOW_ORDER_CARD':
      case 'CHECKOUT': {
        type ItemLike = { productName: string; quantity: number; price: number; modifiers?: string[] }
        const items    = (action.payload?.items ?? []) as ItemLike[]
        const total    = typeof action.payload?.total === 'number' ? action.payload.total : 0
        const mode     = action.payload?.mode === 'auto' ? 'auto' : 'confirm'
        const address  = action.payload?.address as string | null ?? null
        const phone    = action.payload?.phone as string | null ?? null
        const shopName = action.payload?.shopName as string ?? ''

        if (action.type === 'SHOW_ORDER_CARD') {
          richContent.push({
            type: 'order_card',
            data: {
              items: items.map(i => ({
                name: i.productName, quantity: i.quantity, price: i.price,
                modifiers: i.modifiers ?? [],
              })),
              shopName, address, phone, total, mode,
            },
          })
        } else {
          // CHECKOUT → show checkout_sheet (bottom sheet)
          richContent.push({
            type: 'checkout_sheet',
            data: {
              items: items.map(i => ({
                name: i.productName, quantity: i.quantity, price: i.price,
                modifiers: i.modifiers ?? [],
              })),
              shopName,
              address: address ?? '',
              phone,
              subtotal:    total,
              deliveryFee: DELIVERY_FEE,
              total:       total + DELIVERY_FEE,
            },
          })
        }
        break
      }

      case 'ASK_LOCATION': {
        richContent.push({ type: 'location_picker' })
        break
      }

      case 'ADD_TO_CART': {
        // No rich content — cart sync happens in page.tsx
        break
      }

      case 'HUMAN_HANDOFF': {
        richContent.push({
          type: 'location_picker',   // tái dùng slot — hiện nút liên hệ
          url: 'https://zalo.me/0000000000',  // TODO: thay bằng số Zalo thật
        })
        break
      }
    }
  }

  return {
    reply:        output.reply,
    actions:      output.actions,
    quickReplies: output.quickReplies,
    richContent,
    confidence:   output.confidence,
    sessionId,
  }
}
