import { FC } from "react"

export interface BadgeProps {
  variant: string
  size?: "sm" | "md" | "lg"
  icon?: boolean
  customIcon?: string
  pulse?: boolean
  label?: string
  count?: number
  serviceType?: string
  className?: string
}

declare const Badge: FC<BadgeProps>
export default Badge

export interface FilterChipProps {
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
}

export declare const FilterChip: FC<FilterChipProps>

export interface NotifDotProps {
  count?: number
  className?: string
}

export declare const NotifDot: FC<NotifDotProps>
