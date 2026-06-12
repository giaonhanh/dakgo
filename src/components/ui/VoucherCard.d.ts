import { FC } from "react"

export interface VoucherItem {
  id: string
  type: "percent" | "cash" | "freeship" | "combo"
  value: number
  maxDiscount?: number
  minOrder: number
  title: string
  description?: string
  scope?: "all" | "food" | "ride" | "delivery" | "shop" | "combo-items"
  expiresAt: Date | string
  remainingUses: number
  totalUses: number
  isSaved: boolean
  isApplied: boolean
  shopId?: string
  shopName?: string | null
}

export interface VoucherCardProps {
  voucher: VoucherItem
  onSave: (id: string) => void
  onApply: (id: string) => void
  onViewCombo?: () => void
  showProgress?: boolean
  showBottomBar?: boolean
}

declare const VoucherCard: FC<VoucherCardProps>
export default VoucherCard
