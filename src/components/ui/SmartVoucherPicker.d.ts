import { FC } from "react"
import { VoucherItem } from "./VoucherCard"

export interface BestComboResult {
  voucher: VoucherItem
  savings: number
}

export declare function calcSavings(
  voucher: VoucherItem,
  cartTotal: number,
  shippingFee?: number
): number

export declare function findBestVoucherCombo(
  cartTotal: number,
  vouchers: VoucherItem[],
  shippingFee?: number
): BestComboResult | null

export interface SmartVoucherPickerProps {
  cartTotal?: number
  shippingFee?: number
  vouchers?: VoucherItem[]
  appliedVoucherId?: string
  onSuggest?: (voucher: VoucherItem) => void
  onDismiss?: () => void
  className?: string
}

declare const SmartVoucherPicker: FC<SmartVoucherPickerProps>
export default SmartVoucherPicker
