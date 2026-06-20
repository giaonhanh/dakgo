"use client"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dakgo.com"

export function ShareButtons({ shopName, slug }: { shopName: string; slug: string }) {
  const shareUrl  = `${APP_URL}/s/${slug}?v=1`
  const shareText = `Đặt hàng từ ${shopName} trên DakGo 🛵`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      alert("Đã copy link!")
    } catch {
      prompt("Copy link này:", shareUrl)
    }
  }

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: shopName, text: shareText, url: shareUrl })
    } else {
      copyLink()
    }
  }

  return (
    <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
      {/* Zalo share */}
      <a
        href={`https://zalo.me/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
        target="_blank" rel="noopener noreferrer"
        style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, padding: "11px 0", borderRadius: 12, textDecoration: "none",
          background: "rgba(0,120,255,0.12)", border: "1px solid rgba(0,120,255,0.25)",
          color: "#4a8ff5", fontWeight: 600, fontSize: 13,
        }}
      >
        <span style={{ fontSize: 16 }}>💬</span> Chia sẻ Zalo
      </a>

      {/* Share / Copy */}
      <button
        onClick={nativeShare}
        style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, padding: "11px 0", borderRadius: 12,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#b0956a", fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 16 }}>🔗</span> Chia sẻ
      </button>
    </div>
  )
}
