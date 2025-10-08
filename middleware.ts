// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const SESSION_VERSION = process.env.SESSION_VERSION || "1";

// Paths that never require auth/link
const PUBLIC_PATHS = new Set<string>([
  "/signin",
  "/api/auth",
  "/api/telegram/webhook",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/opengraph-image",
]);

function isPublic(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/") return true;
  for (const p of PUBLIC_PATHS) if (pathname.startsWith(p)) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  if (isPublic(req)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const signin = new URL("/signin", req.url);
    signin.searchParams.set("callbackUrl", url.pathname + url.search);
    return NextResponse.redirect(signin);
  }

  // Global re-login if session version changed
  const sv = req.cookies.get("sv")?.value;
  if (sv !== SESSION_VERSION) {
    const out = new URL("/api/auth/signout", req.url);
    out.searchParams.set("callbackUrl", "/signin");
    return NextResponse.redirect(out);
  }

  // Require Telegram link for protected areas except the link page itself
  const needLink = !(token as any).telegram_linked;
  const onLinkPage = url.pathname.startsWith("/link-telegram");
  if (needLink && !onLinkPage) {
    const linkUrl = new URL("/link-telegram", req.url);
    return NextResponse.redirect(linkUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
