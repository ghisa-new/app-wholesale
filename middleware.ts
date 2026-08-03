import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isTurkishIp, clientIpFromHeaders } from "@/lib/geo";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me"
);

const COOKIE_NAME = "wholesale_token";

// The auth surface + the region-block page must stay reachable from ANY IP
// (a Turkish visitor has to be able to reach login/register to get a code).
const PUBLIC_PATHS = ["/login", "/forgot", "/reset", "/register", "/blocked"];

// Always-allow IPs regardless of geo (office VPN / NEBIM egress).
const ALLOW_IPS = new Set(["95.9.94.84"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|txt|xml|map|mp4|webm)$/i.test(
      pathname
    )
  ) {
    return NextResponse.next();
  }

  // Public: the auth surface + region page + auth/cron APIs
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Admin section is server-gated here AND in each /api/admin route
    if (
      (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
      payload.role !== "admin"
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/products", request.url));
    }

    // ── Turkey geo-gate (per-account 3-day allowance) ────────────────────────
    // Admins always pass. Everyone else on a Turkish IP needs a live trUntil
    // window (from the TR signup code or an admin grant).
    if (payload.role !== "admin") {
      const ip = clientIpFromHeaders(request.headers);
      if (ip && !ALLOW_IPS.has(ip) && isTurkishIp(ip)) {
        const trUntil = typeof payload.trUntil === "number" ? payload.trUntil : 0;
        if (Date.now() >= trUntil) {
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              { error: "Bölgenizde erişim kısıtlı", code: "REGION_BLOCKED" },
              { status: 451 }
            );
          }
          return NextResponse.redirect(new URL("/blocked", request.url));
        }
      }
    }

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
