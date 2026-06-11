import { FC } from "react"

export interface BadgeProps {
  layer: 1 | 2 | 3
  variant: string
  size?: "sm" | "md" | "lg"
  icon?: boolean
  label?: string
  pulse?: boolean
  serviceType?: "food" | "delivery" | "ride" | "taxi"
  className?: string
}

declare const Badge: FC<BadgeProps>
export default Badge

export { default as FilterChip } from "./FilterChip"
export { default as NotifDot   } from "./NotifDot"
