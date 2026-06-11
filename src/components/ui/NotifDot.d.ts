import { FC } from "react"

export interface NotifDotProps {
  count?: number
  type?: "notification" | "cart"
  className?: string
}

declare const NotifDot: FC<NotifDotProps>
export default NotifDot
