import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me"
);

const COOKIE_NAME = "wholesale_token";

// These paths do not require authentication (public browsing + read-only data).
// Only checkout actions (/cart, /api/order) require a logged-in dealer.
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/products",
  "/stores",
  "/faq",
  "/api/auth/login",
  "/api/products",
  "/api/categories",
  "/api/exchange-rate",
  "/api/stores",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets (images, fonts, icons served from /public)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|txt|xml|map)$/i.test(
      pathname
    )
  ) {
    return NextResponse.next();
  }

  // Allow public paths (products browsing, login)
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  // Protected paths: /cart, /api/order
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
