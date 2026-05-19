// src/types/index.ts — Tất cả TypeScript interfaces (CLAUDE.md Section 5)

export type UserRole      = "customer" | "driver" | "merchant" | "admin"
export type OrderStatus   = "pending" | "accepted" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled"
export type RideStatus    = "searching" | "accepted" | "arrived" | "in_progress" | "completed" | "cancelled"
export type DriverStatus  = "offline" | "online" | "busy"
export type ErrandStatus  = "pending" | "accepted" | "shopping" | "delivering" | "delivered" | "cancelled"
export type ErrandType    = "buy_for_me" | "deliver_for_me"
export type PaymentMethod = "cash" | "vietqr" | "momo" | "zalopay" | "wallet"
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded"
export type ShopStatus    = "pending" | "approved" | "suspended"
export type TierLevel     = "bronze" | "silver" | "gold" | "platinum"
export type NotifType     = "order" | "promo" | "system" | "ride"

export interface Profile {
  id: string
  phone: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  fcm_token: string | null
  is_active: boolean
  created_at: string
}

export interface SavedAddress {
  id: string
  user_id: string
  label: string
  address: string
  lat: number
  lng: number
  is_default: boolean
  created_at: string
}

export interface AddressPickerResult {
  lat: number
  lng: number
  address: string
  note: string
}

export interface Shop {
  id: string
  owner_id: string
  name: string
  description: string | null
  cover_image_url: string | null
  logo_url: string | null
  address: string
  category: string
  is_open: boolean
  commission_rate: number
  status: ShopStatus
  rating_avg: number
  total_reviews: number
  distance_km?: number
}

export interface Product {
  id: string
  shop_id: string
  name: string
  description: string | null
  image_url: string | null
  price: number
  original_price: number | null
  category: string | null
  meal_time: "morning" | "lunch" | "dinner" | "drinks" | "drinking" | "snack" | null
  is_available: boolean
  sold_count: number
}

export interface CartItem {
  id: string
  name: string
  price: number
  qty: number
  shop: string
  shopId: string
  imageUrl?: string
  note?: string
}

export interface Order {
  id: string
  customer_id: string
  shop_id: string
  driver_id: string | null
  status: OrderStatus
  delivery_address: string
  delivery_lat: number
  delivery_lng: number
  note: string | null
  subtotal: number
  delivery_fee: number
  discount_amount: number
  total_amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  cancelled_at: string | null
  cancel_reason: string | null
  delivered_at: string | null
  estimated_delivery_at: string | null
  created_at: string
  shop?: Shop
  items?: OrderItem[]
  driver?: Profile
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  name: string
  price: number
  quantity: number
  subtotal: number
  note: string | null
}

export interface Driver {
  id: string
  vehicle_type: string
  license_plate: string
  status: DriverStatus
  location?: { lat: number; lng: number }
  rating_avg: number
  total_trips: number
  is_approved: boolean
  profile?: Profile
}

export interface Ride {
  id: string
  customer_id: string
  driver_id: string | null
  status: RideStatus
  vehicle_type: string
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  distance_km: number | null
  estimated_fare: number | null
  final_fare: number | null
  payment_method: PaymentMethod
  created_at: string
  driver?: Driver
}

export interface Errand {
  id: string
  customer_id: string
  driver_id: string | null
  type: ErrandType
  status: ErrandStatus
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  delivery_address: string
  delivery_lat: number
  delivery_lng: number
  items_description: string | null
  estimated_items_cost: number | null
  package_description: string | null
  package_photo_url: string | null
  note: string | null
  service_fee: number
  actual_items_cost: number | null
  total_amount: number | null
  payment_method: PaymentMethod
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotifType
  title: string
  body: string
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

export interface Voucher {
  id: string
  code: string
  title: string
  discount_type: "percent" | "fixed" | "freeship"
  discount_value: number
  min_order: number
  max_discount: number | null
  valid_from: string
  valid_to: string
  shop_id: string | null
  is_active: boolean
}

export interface LoyaltyPoints {
  id: string
  user_id: string
  total_points: number
  tier: TierLevel
  updated_at: string
}

export interface Review {
  id: string
  order_id: string
  reviewer_id: string
  driver_id: string | null
  shop_id: string
  driver_rating: number | null
  food_rating: number | null
  comment: string | null
  images: string[]
  tip_amount: number
  created_at: string
}

export interface Wallet {
  id: string
  user_id: string
  type: "customer" | "driver" | "merchant"
  balance: number
  updated_at: string
}

export interface Particle {
  id: number
  x: number
  y: number
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
}
