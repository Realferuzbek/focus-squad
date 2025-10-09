// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const SESSION_VERSION = process.env.SESSION_VERSION || "1";

const PUBLIC_PATHS = new Set<string>([
  "/signin",
  "/api/auth",
  "/api/telegram/webhook",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/opengraph-image",
]);

// treat common static assets as public
const STATIC_EXT = /\.(?:png|svg|jpg|jpeg|gif|webp|ico|txt|xml)$/i;

function isPublic(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/") return true;
  if (STATIC_EXT.test(pathname)) return true;
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

  const svCookie = req.cookies.get("sv")?.value;
  if (svCookie && svCookie !== SESSION_VERSION) {
    const out = new URL("/api/auth/signout", req.url);
    out.searchParams.set("callbackUrl", "/signin");
    return NextResponse.redirect(out);
  }

  const needLink = !(token as any).telegram_linked;
  const onLinkPage = url.pathname.startsWith("/link-telegram");
  if (needLink && !onLinkPage) {
    const linkUrl = new URL("/link-telegram", req.url);
    return NextResponse.redirect(linkUrl);
  }

  const response = NextResponse.next();
  if (!svCookie) {
    response.cookies.set("sv", SESSION_VERSION, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
