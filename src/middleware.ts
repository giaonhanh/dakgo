import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Chưa đăng nhập → redirect login, giữ lại URL gốc để quay lại sau khi đăng nhập
  // Exclude "/" để Zalo/crawler đọc được meta tag từ root layout
  const publicPaths = ["/login", "/link-account", "/update-phone"]
  if (!user && !publicPaths.some(p => pathname.startsWith(p)) && pathname !== "/") {
    const loginUrl = new URL("/login", request.url)
    // Chỉ giữ redirect cho các trang customer-facing (không giữ /admin, /driver, /merchant)
    if (!pathname.startsWith("/admin") && !pathname.startsWith("/driver") && !pathname.startsWith("/merchant")) {
      loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (user) {
    // /login: cho qua ngay — tránh loop khi profile null redirect về /login
    if (pathname.startsWith("/login")) return response;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    // Tài khoản bị khóa
    if (profile?.is_active === false) {
      return NextResponse.redirect(new URL("/login?error=suspended", request.url));
    }

    // Profile không tồn tại → cho qua, trang sẽ tự xử lý
    if (!profile) {
      return response;
    }

    const role = profile.role;

    // Normalize: DB có thể dùng "shop" hoặc "merchant" — đều vào /merchant
    const isMerchant = role === "merchant" || role === "shop";

    // Admin Preview Mode: admin xem giao diện khách mà không cần đăng xuất
    const adminPreview = request.cookies.get("admin_preview")?.value === "1";

    // Sau login → redirect đúng dashboard theo role
    if (pathname === "/") {
      const dest =
        role === "driver"                    ? "/driver"   :
        isMerchant                           ? "/merchant" :
        role === "admin" && !adminPreview    ? "/admin"    : "/";
      if (dest !== pathname) {
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }

    // Bảo vệ route (driver): chỉ driver + admin được vào
    if (pathname.startsWith("/driver") && role !== "driver" && role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Bảo vệ route (merchant): chỉ merchant/shop + admin được vào
    if (pathname.startsWith("/merchant") && !isMerchant && role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Bảo vệ route (admin): chỉ admin được vào
    if (pathname.startsWith("/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon-|manifest|sw\\.js|zalo_verifier|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)",
  ],
};
