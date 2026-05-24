import type { Metadata, Viewport } from "next"
import { Lexend } from "next/font/google"
import "./globals.css"
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar"
import { SessionProvider } from "@/components/SessionProvider"

const lexend = Lexend({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Giao Nhanh — Phước An",
  description: "Giao hàng · Mua hộ · Xe ôm · Taxi tại Phước An, Krông Pắc",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Giao Nhanh",
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
    <html lang="vi" className={lexend.className}>
      <body>
        <SessionProvider>{children}</SessionProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
