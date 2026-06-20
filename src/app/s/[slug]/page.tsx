import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Image from "next/image"
import type { Metadata } from "next"
import { ShareButtons } from "./ShareButtons"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dakgo.com"

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase  = await createClient()
  let { data: shop } = await supabase
    .from("shops")
    .select("name, description, cover_image_url, logo_url, category")
    .eq("slug", slug)
    .eq("status", "approved")
    .single()

  if (!shop) {
    const { data: byPrev } = await supabase
      .from("shops")
      .select("name, description, cover_image_url, logo_url, category")
      .eq("previous_slug", slug)
      .eq("status", "approved")
      .single()
    shop = byPrev
  }

  if (!shop) return { title: "DakGo" }

  const image = shop.cover_image_url ?? shop.logo_url ?? `${APP_URL}/icon-512.png`
  const title = `${shop.name} 🛵 Đặt hàng trên DakGo`
  const desc  = shop.description?.trim()
    || "Đặt đồ ăn/xe ôm/taxi online tại xã Krông Pắc, tỉnh Đắk Lắk!"

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url: `${APP_URL}/s/${slug}`,
      siteName: "DakGo — Giao Nhanh Krông Pắc",
      images: [{ url: image, width: 1200, height: 630, alt: shop.name }],
      type: "website",
      locale: "vi_VN",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [image],
    },
  }
}

export default async function ShopSlugPage({ params }: Props) {
  const { slug } = await params
  const supabase  = await createClient()

  let { data: shop } = await supabase
    .from("shops")
    .select("id, name, description, cover_image_url, logo_url, category, is_open, rating_avg, address, slug")
    .eq("slug", slug)
    .eq("status", "approved")
    .single()

  // Slug cũ → redirect sang slug mới
  if (!shop) {
    const { data: byPrev } = await supabase
      .from("shops")
      .select("id, name, description, cover_image_url, logo_url, category, is_open, rating_avg, address, slug")
      .eq("previous_slug", slug)
      .eq("status", "approved")
      .single()
    if (byPrev?.slug) redirect(`/s/${byPrev.slug}`)
    shop = byPrev
  }

  if (!shop) redirect("/")

  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect(`/shop/${shop.id}`)

  return (
    <div style={{ minHeight: "100vh", background: "#080806", color: "#f8f0e0", fontFamily: "sans-serif" }}>
      {/* Hero ảnh bìa */}
      <div style={{ position: "relative", height: 220, background: "#151210" }}>
        {shop.cover_image_url
          ? <Image src={shop.cover_image_url} alt={shop.name} fill style={{ objectFit: "cover", opacity: 0.7 }} />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1a0d00,#2d1500)" }} />
        }
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, #080806 100%)" }} />
        <div style={{
          position: "absolute", bottom: -28, left: 20,
          width: 56, height: 56, borderRadius: 14,
          border: "2px solid rgba(255,107,0,0.4)",
          background: "#151210", overflow: "hidden",
        }}>
          {shop.logo_url
            ? <Image src={shop.logo_url} alt={shop.name} width={56} height={56} style={{ objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🍽️</div>
          }
        </div>
      </div>

      <div style={{ padding: "40px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#f8f0e0" }}>{shop.name}</h1>
          {shop.is_open
            ? <span style={{ background: "rgba(62,207,110,0.15)", color: "#3ecf6e", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>Đang mở</span>
            : <span style={{ background: "rgba(255,64,64,0.15)", color: "#ff4040", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>Đã đóng</span>
          }
        </div>
        <p style={{ color: "#b0956a", fontSize: 13, margin: "4px 0 8px" }}>{shop.category}</p>
        {shop.description && (
          <p style={{ color: "#6a5a40", fontSize: 13, lineHeight: 1.5, margin: "0 0 16px" }}>{shop.description}</p>
        )}
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#b0956a", marginBottom: 24 }}>
          <span>⭐ {shop.rating_avg?.toFixed(1) ?? "5.0"}</span>
          <span>📍 {shop.address}</span>
        </div>

        <div style={{ background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 16, padding: 20, textAlign: "center" }}>
          <p style={{ color: "#b0956a", fontSize: 14, margin: "0 0 16px", lineHeight: 1.5 }}>
            Đăng nhập để xem menu và đặt hàng từ <b style={{ color: "#FF8C00" }}>{shop.name}</b>
          </p>
          <a href={`/login?redirect=/shop/${shop.id}`} style={{
            display: "block", width: "100%", boxSizing: "border-box",
            padding: "14px 0", borderRadius: 14, textDecoration: "none",
            background: "linear-gradient(to right, #FF6B00, #FF8C00)",
            color: "#fff", fontWeight: 700, fontSize: 15,
            boxShadow: "0 4px 20px rgba(255,107,0,0.4)",
          }}>
            🛵 Đặt hàng ngay
          </a>
          <a href={`/login?mode=register&redirect=/shop/${shop.id}`} style={{
            display: "block", marginTop: 10, padding: "12px 0",
            borderRadius: 14, textDecoration: "none",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#b0956a", fontWeight: 600, fontSize: 14,
          }}>
            Chưa có tài khoản? Đăng ký miễn phí
          </a>
        </div>

        <ShareButtons shopName={shop.name} slug={slug} />
      </div>
    </div>
  )
}
