// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { applySecurityHeaders } from "./lib/security-headers";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = new Set<string>([
  "/signin",
  "/api/auth",
  "/api/chat",
  "/api/reindex",
  "/api/telegram/webhook",
  "/api/admin/state",
  "/feature",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/opengraph-image",
]);

// treat common static assets as public
const STATIC_EXT = /\.(?:png|svg|jpg|jpeg|gif|webp|ico|txt|xml|html)$/i;

function isPublic(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/") return true;
  if (STATIC_EXT.test(pathname)) return true;
  for (const p of PUBLIC_PATHS) if (pathname.startsWith(p)) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  if (isPublic(req)) {
    const resp = NextResponse.next();
    // apply security headers in all responses including public assets
    return applySecurityHeaders(resp, {
      isProduction: process.env.NODE_ENV === "production",
      // in edge runtimes, req.nextUrl.protocol may not be present; approximate
      isSecureTransport: req.nextUrl.protocol === "https" || req.headers.get("x-forwarded-proto") === "https",
    });
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const signin = new URL("/signin", req.url);
    signin.searchParams.set("callbackUrl", url.pathname + url.search);
    const redirect = NextResponse.redirect(signin);
    return applySecurityHeaders(redirect, {
      isProduction: process.env.NODE_ENV === "production",
      isSecureTransport: req.nextUrl.protocol === "https" || req.headers.get("x-forwarded-proto") === "https",
    });
  }

  let latestVersion: string | null = null;
  try {
    const stateUrl = new URL("/api/admin/state", req.url);
    const stateRes = await fetch(stateUrl.toString(), { cache: "no-store" });
    if (stateRes.ok) {
      const data = await stateRes.json();
      latestVersion = `${data?.session_version ?? 1}`;
    }
  } catch (err) {}

  const svCookie = req.cookies.get("sv")?.value ?? null;
  if (!latestVersion) {
    latestVersion = svCookie ?? "1";
  }

  if (svCookie && latestVersion && svCookie !== latestVersion) {
    const out = new URL("/api/auth/signout", req.url);
    out.searchParams.set("callbackUrl", "/signin");
    const redirect = NextResponse.redirect(out);
    return applySecurityHeaders(redirect, {
      isProduction: process.env.NODE_ENV === "production",
      isSecureTransport: req.nextUrl.protocol === "https" || req.headers.get("x-forwarded-proto") === "https",
    });
  }

  const needLink = !(token as any).telegram_linked;
  const onLinkPage = url.pathname.startsWith("/link-telegram");
  if (needLink && !onLinkPage) {
    const linkUrl = new URL("/link-telegram", req.url);
    return NextResponse.redirect(linkUrl);
  }

  const response = NextResponse.next();
  if (latestVersion && svCookie !== latestVersion) {
    response.cookies.set("sv", latestVersion, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  }

  return applySecurityHeaders(response, {
    isProduction: process.env.NODE_ENV === "production",
    isSecureTransport: req.nextUrl.protocol === "https" || req.headers.get("x-forwarded-proto") === "https",
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
