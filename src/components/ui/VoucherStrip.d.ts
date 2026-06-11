import { FC } from "react"
import { VoucherItem } from "./VoucherCard"

export interface VoucherStripProps {
  voucher: VoucherItem
  selected?: boolean
  onSelect?: (id: string) => void
  disabled?: boolean
}

declare const VoucherStrip: FC<VoucherStripProps>
export default VoucherStrip
