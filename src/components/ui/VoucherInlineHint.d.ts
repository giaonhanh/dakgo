import { FC } from "react"
import { VoucherItem } from "./VoucherCard"

export interface VoucherInlineHintProps {
  appliedVoucher?: VoucherItem | null
  nudgeVoucher?: VoucherItem | null
  cartTotal?: number
  onClick?: () => void
  className?: string
}

declare const VoucherInlineHint: FC<VoucherInlineHintProps>
export default VoucherInlineHint
