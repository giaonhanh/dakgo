import { FC } from "react"

export interface FilterChipProps {
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
}

declare const FilterChip: FC<FilterChipProps>
export default FilterChip
