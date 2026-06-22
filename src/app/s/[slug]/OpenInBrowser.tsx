"use client"

import { useEffect, useState } from "react"

export function OpenInBrowser() {
  const [inAppBrowser, setInAppBrowser] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const isInApp = /FBAN|FBAV|FB_IAB|Instagram|Line|Zalo|Twitter|TikTok/i.test(ua)
    setInAppBrowser(isInApp)
  }, [])

  if (!inAppBrowser) return null

  const openExternal = () => {
    const url = window.location.href
    // Thử mở trong trình duyệt ngoài
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <button
      onClick={openExternal}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: "100%", padding: "12px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.05)", color: "#b0956a",
        fontSize: 13, fontWeight: 600, fontFamily: "Lexend", cursor: "pointer",
        marginTop: 10,
      }}
    >
      🌐 Mở trong trình duyệt để cài app
    </button>
  )
}
