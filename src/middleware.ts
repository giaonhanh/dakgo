import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  // ── DEV QUICK LOGIN bypass (chỉ hoạt động khi NODE_ENV=development) ──
  if (process.env.NODE_ENV === "development") {
    const devRole = request.cookies.get("dev_role")?.value;
    if (devRole) {
      if (pathname === "/login") return response; // cho phép ở trang login
      // Redirect từ root "/" sang đúng dashboard
      if (pathname === "/") {
        const dest = devRole === "driver"   ? "/driver"
                   : devRole === "merchant" ? "/merchant"
                   : devRole === "admin"    ? "/admin"    : null;
        if (dest) return NextResponse.redirect(new URL(dest, request.url));
        return response;
      }
      // Bảo vệ route theo dev_role
      if (pathname.startsWith("/driver")   && devRole !== "driver"   && devRole !== "admin")
        return NextResponse.redirect(new URL("/", request.url));
      if (pathname.startsWith("/merchant") && devRole !== "merchant" && devRole !== "admin")
        return NextResponse.redirect(new URL("/", request.url));
      if (pathname.startsWith("/admin")    && devRole !== "admin")
        return NextResponse.redirect(new URL("/", request.url));
      return response; // cho qua
    }
    // Không có dev_role cookie → fall through để kiểm tra Supabase session thật
  }
  // ── END DEV BYPASS ──

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

  // Chưa đăng nhập → redirect login (trừ trang login)
  if (!user && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    // Tài khoản bị khóa (chỉ khi profile tồn tại VÀ is_active = false)
    if (profile?.is_active === false) {
      return NextResponse.redirect(new URL("/login?error=suspended", request.url));
    }

    // Profile chưa tạo (trigger thất bại) → mặc định customer, cho qua
    const role = profile?.role ?? "customer";

    // Normalize: DB có thể dùng "shop" hoặc "merchant" — đều vào /merchant
    const isMerchant = role === "merchant" || role === "shop";

    // /login: cho qua dù đã đăng nhập (để đổi account)
    if (pathname === "/login") return response;

    // Sau login → redirect đúng dashboard theo role
    if (pathname === "/") {
      const dest =
        role === "driver" ? "/driver"   :
        isMerchant        ? "/merchant" :
        role === "admin"  ? "/admin"    : "/";
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
    "/((?!api|_next/static|_next/image|favicon.ico|icon-|manifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
