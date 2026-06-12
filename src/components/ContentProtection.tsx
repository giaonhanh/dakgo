"use client"

import { useEffect } from "react"

/**
 * Chặn các hành vi lấy nội dung trên web app:
 * - Chuột phải (context menu)
 * - Ctrl+S / Ctrl+P / Ctrl+U (save/print/view-source)
 * - Long-press trên mobile (context menu)
 * Không thể ngăn hoàn toàn — người dùng kỹ thuật vẫn dùng DevTools được.
 */
export default function ContentProtection() {
  useEffect(() => {
    const blockContext = (e: MouseEvent) => {
      // Cho phép chuột phải trên input/textarea để paste
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      e.preventDefault()
    }

    const blockShortcuts = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      const k = e.key.toLowerCase()
      // Ctrl+S (save), Ctrl+P (print), Ctrl+U (view-source)
      if (k === "s" || k === "p" || k === "u") {
        e.preventDefault()
      }
    }

    document.addEventListener("contextmenu", blockContext)
    document.addEventListener("keydown", blockShortcuts)

    return () => {
      document.removeEventListener("contextmenu", blockContext)
      document.removeEventListener("keydown", blockShortcuts)
    }
  }, [])

  return null
}
