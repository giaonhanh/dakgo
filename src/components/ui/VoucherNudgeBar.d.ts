import { FC } from "react"
import { VoucherItem } from "./VoucherCard"

export interface NudgeResult {
  voucher: VoucherItem
  reached: boolean
}

export declare function findNextThreshold(
  cartTotal: number,
  vouchers: VoucherItem[]
): NudgeResult | null

export interface VoucherNudgeBarProps {
  cartTotal?: number
  vouchers?: VoucherItem[]
  onPickVoucher?: () => void
  appliedVoucherId?: string
  className?: string
}

declare const VoucherNudgeBar: FC<VoucherNudgeBarProps>
export default VoucherNudgeBar
