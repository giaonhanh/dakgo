import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(n: number): string {
  return n.toLocaleString("vi-VN") + "đ"
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
}

export function generateVietQR(amount: number, orderId: string): string {
  const BANK_ID = "BIDV"
  const ACCOUNT = "1234567890"
  const addInfo = encodeURIComponent(`GN${orderId.slice(0, 8).toUpperCase()}`)
  return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT}-qr_only.png?amount=${amount}&addInfo=${addInfo}`
}

export function calcRideFare(distKm: number, type: string): number {
  const BASE: Record<string, number> = { motorbike: 10000, car: 15000, electric: 8000 }
  const PER:  Record<string, number> = { motorbike: 4500,  car: 8000,  electric: 3500 }
  return (BASE[type] ?? 10000) + Math.round(distKm * (PER[type] ?? 4500))
}

export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending:    "Đang chờ xác nhận",
    accepted:   "Đã xác nhận",
    preparing:  "Đang chuẩn bị",
    ready:      "Sẵn sàng giao",
    delivering: "Đang giao",
    delivered:  "Đã giao xong",
    cancelled:  "Đã hủy",
  }
  return labels[status] ?? status
}

export function getRideStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    searching:   "Đang tìm tài xế",
    accepted:    "Tài xế đã nhận",
    arrived:     "Tài xế đã đến",
    in_progress: "Đang di chuyển",
    completed:   "Hoàn thành",
    cancelled:   "Đã hủy",
  }
  return labels[status] ?? status
}
