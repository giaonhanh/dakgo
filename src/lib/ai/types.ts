// DakGo AI Pipeline — Type definitions
// Channel-agnostic: pipeline không biết Web/Zalo/Messenger

// ─── Enums ───────────────────────────────────────────────────────────────────

export type Intent =
  | 'ORDER_FOOD'
  | 'FIND_SHOP'
  | 'TRACK_ORDER'
  | 'MODIFY_CART'
  | 'GENERAL_QUESTION'
  | 'CANCEL'
  | 'GREET'
  | 'CONFIRM_ORDER'
  | 'UNKNOWN'

export type ActionType =
  | 'ADD_TO_CART'
  | 'ASK_LOCATION'
  | 'ASK_PHONE'
  | 'CHECKOUT'
  | 'SHOW_PRODUCTS'
  | 'SHOW_SHOP'
  | 'HUMAN_HANDOFF'

// ─── Session & Memory ─────────────────────────────────────────────────────────

export interface SessionContext {
  intent:        Intent | null
  items:         ResolvedItem[]
  shopId:        string | null
  shopName:      string | null
  phone:         string | null
  address:       string | null
  addressLat:    number | null
  addressLng:    number | null
  lastAskField:  string | null
  turnCount:     number
}

export const EMPTY_CONTEXT: SessionContext = {
  intent:       null,
  items:        [],
  shopId:       null,
  shopName:     null,
  phone:        null,
  address:      null,
  addressLat:   null,
  addressLng:   null,
  lastAskField: null,
  turnCount:    0,
}

export interface ChatSession {
  id:           string
  sessionKey:   string
  context:      SessionContext
  messageCount: number
}

export interface ChatMessage {
  id:        string
  sessionId: string
  role:      'user' | 'assistant'
  content:   string
  metadata:  Record<string, unknown>
  createdAt: string
}

// ─── Items & Search ───────────────────────────────────────────────────────────

export interface ExtractedItem {
  rawName:  string
  quantity: number
  note:     string | null
}

export interface ResolvedItem {
  rawName:     string
  productId:   string
  productName: string
  shopId:      string
  shopName:    string
  quantity:    number
  price:       number
  note:        string | null
  confidence:  number
}

export interface ProductSearchResult {
  id:         string
  name:       string
  price:      number
  shopId:     string
  shopName:   string
  isOpen:     boolean
  imageUrl:   string | null
  similarity: number
}

export interface ShopSearchResult {
  id:            string
  name:          string
  category:      string
  isOpen:        boolean
  coverImageUrl: string | null
  logoUrl:       string | null
  ratingAvg:     number
  similarity:    number
}

// ─── AI Provider (Adapter pattern) ───────────────────────────────────────────

export interface AIExtraction {
  items:   ExtractedItem[]
  phone:   string | null
  address: string | null
  intent:  'ORDER' | 'FIND' | 'CANCEL' | 'TRACK' | 'OTHER' | null
}

// ─── Confidence ───────────────────────────────────────────────────────────────

export interface ConfidenceScore {
  total:     number
  breakdown: {
    hasItems:      number
    itemsResolved: number
    hasShop:       number
    hasAddress:    number
    hasPhone:      number
  }
}

// ─── Action Layer ─────────────────────────────────────────────────────────────

export interface Action {
  type:     ActionType
  payload?: Record<string, unknown>
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export interface PipelineInput {
  message:    string
  sessionKey: string
  session:    ChatSession
  history:    ChatMessage[]
}

export interface PipelineOutput {
  reply:          string
  actions:        Action[]
  quickReplies:   string[]
  updatedContext: Partial<SessionContext>
  blocked:        boolean
  confidence:     number
}

// ─── UI Controller output (channel-specific) ─────────────────────────────────

export type RichContent =
  | { type: 'product_card';    data: ProductCardData }
  | { type: 'shop_card';       data: ShopCardData }
  | { type: 'cart_preview';    data: CartPreviewData }
  | { type: 'checkout_button'; url: string }
  | { type: 'location_picker'; url: string }

export interface ProductCardData {
  id:       string
  name:     string
  price:    number
  shopId:   string
  shopName: string
  imageUrl: string | null
}

export interface ShopCardData {
  id:        string
  name:      string
  category:  string
  isOpen:    boolean
  logoUrl:   string | null
  ratingAvg: number
}

export interface CartPreviewData {
  items: Array<{ name: string; quantity: number; price: number }>
  total: number
}

export interface UIResponse {
  reply:        string
  actions:      Action[]
  quickReplies: string[]
  richContent:  RichContent[]
  confidence:   number
  sessionId:    string
}
