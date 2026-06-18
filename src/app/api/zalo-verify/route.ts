import { NextResponse } from "next/server"

export async function GET() {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta property="zalo-platform-site-verification" content="GltaCulOJ2XMfi9magn8KKw2tWQYz0jHEJ4t" />
</head>
<body>
There Is No Limit To What You Can Accomplish Using Zalo!
</body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  )
}
