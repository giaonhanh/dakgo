// Layer 11: UI Controller — format response cho từng channel
// Web: trả về richContent (product cards, shop cards, cart preview...)
// Zalo/Messenger: adapter riêng implement interface này sau

import type { PipelineOutput, RichContent, UIResponse, ProductCardData, ShopCardData } from '../types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.dakgo.com'

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
      case 'ADD_TO_CART':
      case 'CHECKOUT': {
        type ItemLike = { productName: string; quantity: number; price: number }
        const items = (action.payload?.items ?? []) as ItemLike[]
        if (items.length > 0) {
          richContent.push({
            type: 'cart_preview',
            data: {
              items: items.map(i => ({ name: i.productName, quantity: i.quantity, price: i.price })),
              total: items.reduce((s, i) => s + i.price * i.quantity, 0),
            },
          })
        }
        if (action.type === 'CHECKOUT') {
          richContent.push({ type: 'checkout_button', url: `${APP_URL}/checkout` })
        }
        break
      }
      case 'ASK_LOCATION': {
        richContent.push({ type: 'location_picker', url: `${APP_URL}/addresses` })
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
