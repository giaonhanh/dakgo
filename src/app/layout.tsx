import type { Metadata, Viewport } from "next"
import { Lexend } from "next/font/google"
import "./globals.css"
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar"
import { SessionProvider } from "@/components/SessionProvider"
import ContentProtection from "@/components/ContentProtection"

const lexend = Lexend({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "DakGo — Krông Pắc",
  description: "Giao hàng · Mua hộ · Xe ôm · Taxi tại Krông Pắc, Đắk Lắk",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DakGo",
  },
  icons: {
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "zalo-platform-site-verification": "GItaCuIOJ2XMfi9magn8KKw2tWQYz0jHEJ4t",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#080806",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={lexend.className} style={{ background: "#080806" }}>
      <head>
        <meta name="zalo-platform-site-verification" content="GItaCuIOJ2XMfi9magn8KKw2tWQYz0jHEJ4t" />
        <link rel="preconnect" href="https://soaqedkloqyznmqzybgq.supabase.co" />
        <link rel="dns-prefetch" href="https://soaqedkloqyznmqzybgq.supabase.co" />
      </head>
      <body style={{ background: "#080806", margin: 0 }}>
        <ContentProtection />
        <SessionProvider>{children}</SessionProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
