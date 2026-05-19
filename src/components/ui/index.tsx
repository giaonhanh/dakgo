"use client"

import { motion } from "framer-motion"

// ─── GlassCard ───────────────────────────────────────────────────────────────
interface GlassCardProps {
  children: React.ReactNode
  accent?: boolean
  strong?: boolean
  className?: string
  onClick?: () => void
}

export function GlassCard({ children, accent = false, strong = false, className = "", onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        "backdrop-blur-[12px] rounded-[14px] border",
        strong
          ? "bg-[rgba(255,107,0,0.07)] border-[rgba(255,107,0,0.35)]"
          : accent
          ? "bg-[rgba(255,107,0,0.07)] border-[rgba(255,107,0,0.20)]"
          : "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  )
}

// ─── CTAButton — nút cam chính, shimmer effect ────────────────────────────────
interface CTAButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  type?: "button" | "submit"
  loading?: boolean
}

export function CTAButton({ children, onClick, disabled, className = "", type = "button", loading = false }: CTAButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      className={[
        "relative overflow-hidden rounded-[14px] h-[48px] w-full",
        "bg-gradient-to-r from-[#FF6B00] via-[#FF8C00] to-[#FFB347]",
        "text-white font-bold text-[13px] font-sans",
        "shadow-[0_4px_20px_rgba(255,107,0,0.4)]",
        "transition-opacity",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    >
      <span className="absolute top-0 left-[-60%] w-[35%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2.5s_infinite] pointer-events-none" />
      <span className="relative z-10">
        {loading ? "Đang xử lý..." : children}
      </span>
    </motion.button>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode
  variant?: "acc" | "green" | "red" | "blue" | "purple" | "muted"
  className?: string
}

export function Badge({ children, variant = "acc", className = "" }: BadgeProps) {
  const colors: Record<string, string> = {
    acc:    "bg-[rgba(255,107,0,0.15)] text-[#FF8C00] border-[rgba(255,107,0,0.3)]",
    green:  "bg-[rgba(62,207,110,0.15)] text-[#3ecf6e] border-[rgba(62,207,110,0.3)]",
    red:    "bg-[rgba(255,64,64,0.15)] text-[#ff4040] border-[rgba(255,64,64,0.3)]",
    blue:   "bg-[rgba(74,143,245,0.15)] text-[#4a8ff5] border-[rgba(74,143,245,0.3)]",
    purple: "bg-[rgba(180,100,255,0.15)] text-[#b464ff] border-[rgba(180,100,255,0.3)]",
    muted:  "bg-[rgba(255,255,255,0.06)] text-[#6a5a40] border-[rgba(255,255,255,0.08)]",
  }
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
        colors[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={[
        "animate-pulse rounded-lg bg-[rgba(255,255,255,0.06)]",
        className,
      ].join(" ")}
    />
  )
}

// ─── Toast (simple) ───────────────────────────────────────────────────────────
export function showToast(msg: string, type: "success" | "error" | "info" = "info") {
  if (typeof document === "undefined") return
  const toast = document.createElement("div")
  const colors: Record<string, string> = {
    success: "background:rgba(62,207,110,0.15);border:1px solid rgba(62,207,110,0.3);color:#3ecf6e",
    error:   "background:rgba(255,64,64,0.15);border:1px solid rgba(255,64,64,0.3);color:#ff4040",
    info:    "background:rgba(255,107,0,0.12);border:1px solid rgba(255,107,0,0.25);color:#FF8C00",
  }
  toast.style.cssText = `
    position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
    z-index:9999;padding:10px 18px;border-radius:12px;
    font-size:13px;font-weight:600;font-family:Lexend,sans-serif;
    backdrop-filter:blur(12px);
    ${colors[type]};
    white-space:nowrap;
    transition:opacity 0.3s;
  `
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(() => { toast.style.opacity = "0" }, 2200)
  setTimeout(() => toast.remove(), 2500)
}

// ─── PriceText — gradient cam ─────────────────────────────────────────────────
interface PriceTextProps {
  amount: number
  className?: string
}

export function PriceText({ amount, className = "" }: PriceTextProps) {
  return (
    <span
      className={[
        "bg-gradient-to-r from-[#FF6B00] to-[#FFB347] bg-clip-text text-transparent font-bold",
        className,
      ].join(" ")}
    >
      {amount.toLocaleString("vi-VN")}đ
    </span>
  )
}
