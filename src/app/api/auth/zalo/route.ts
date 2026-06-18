import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

// Bước 1: Redirect khách vào trang đăng nhập Zalo (PKCE flow)
export async function GET(request: NextRequest) {
  const appId = process.env.ZALO_APP_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin

  if (!appId) {
    console.error("[zalo] ZALO_APP_ID not set")
    return NextResponse.redirect(new URL("/login?error=zalo_config", appUrl))
  }

  const codeVerifier  = base64url(crypto.randomBytes(32))
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest())
  const state         = crypto.randomBytes(16).toString("hex")

  const callbackUrl = `${appUrl}/api/auth/zalo/callback`

  const zaloUrl =
    `https://oauth.zaloapp.com/v4/permission` +
    `?app_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&code_challenge=${codeChallenge}` +
    `&state=${state}`

  const isPopup = request.nextUrl.searchParams.get("mode") === "popup"
  const response = NextResponse.redirect(zaloUrl)

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30,
    path: "/",
    sameSite: "lax" as const,
  }
  response.cookies.set("zalo_code_verifier", codeVerifier, cookieOpts)
  response.cookies.set("zalo_state",         state,        cookieOpts)
  if (isPopup) response.cookies.set("zalo_popup", "1", cookieOpts)

  return response
}
