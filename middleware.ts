// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { applySecurityHeaders } from "./lib/security-headers";
import { getToken } from "next-auth/jwt";
import {
  generateCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER,
} from "./lib/csrf";
import {
  requiresCsrfProtection,
  validateCsrfTokens,
  buildCsrfCookieOptions,
  buildSessionCookieOptions,
} from "./lib/csrf-guard";

type EnvMap = Record<string, string | undefined>;

const ENV: EnvMap =
  ((globalThis as Record<string, any>)?.process?.env ?? {}) as EnvMap;

const CSRF_ENFORCEMENT_DISABLED = ENV.CSRF_ENFORCEMENT_DISABLED === "1";
const CSRF_MAINTENANCE_PATH_PREFIXES = (ENV.CSRF_MAINTENANCE_PATHS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const INTERNAL_ADMIN_SIGNATURE_HEADER = "x-internal-admin-signature";
let cachedInternalSignature: string | null = null;

async function getInternalAdminSignature(): Promise<string | null> {
  if (cachedInternalSignature) return cachedInternalSignature;
  const secret = ENV.NEXTAUTH_SECRET;
  if (!secret) return null;
  try {
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(secret),
    );
    const hashArray = Array.from(new Uint8Array(digest));
    cachedInternalSignature = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return cachedInternalSignature;
  } catch {
    return null;
  }
}

function isProduction(): boolean {
  return ENV.NODE_ENV === "production";
}

function buildSecurityContext(req: NextRequest) {
  const proto = req.nextUrl.protocol;
  const forwardedProto = req.headers.get("x-forwarded-proto");
  return {
    isProduction: isProduction(),
    isSecureTransport:
      proto === "https" || proto === "https:" || forwardedProto === "https",
  };
}

const PUBLIC_PATHS = new Set<string>([
  "/signin",
  "/api/auth",
  "/api/reindex",
  "/api/telegram/webhook",
  "/api/admin/state",
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

function isMaintenanceBypassPath(pathname: string): boolean {
  for (const prefix of CSRF_MAINTENANCE_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

function redactUrlOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return value.slice(0, 128);
  }
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const securityContext = buildSecurityContext(req);

  if (isPublic(req)) {
    const resp = NextResponse.next();
    // apply security headers in all responses including public assets
    return applySecurityHeaders(resp, securityContext);
  }

  const token = await getToken({ req, secret: ENV.NEXTAUTH_SECRET });
  if (!token) {
    const signin = new URL("/signin", req.url);
    signin.searchParams.set("callbackUrl", url.pathname + url.search);
    const redirect = NextResponse.redirect(signin);
    return applySecurityHeaders(redirect, securityContext);
  }

  // CSRF protections (double-submit cookie) for cookie-backed sessions
  const method = req.method?.toUpperCase();
  const needsCsrf = requiresCsrfProtection(method, url.pathname);
  const csrfBypassed =
    needsCsrf &&
    (CSRF_ENFORCEMENT_DISABLED || isMaintenanceBypassPath(url.pathname));

  // For authenticated GETs, ensure a CSRF cookie is present (non-HttpOnly so client JS can read it)
  if (!needsCsrf && method === "GET") {
    const existing = req.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (!existing) {
      const tokenValue = generateCsrfToken();
      const resp = NextResponse.next();
      resp.cookies.set(
        CSRF_COOKIE_NAME,
        tokenValue,
        buildCsrfCookieOptions(securityContext),
      );
      return applySecurityHeaders(resp, securityContext);
    }
  }

  // Verify CSRF on state-changing requests unless webhook or public
  if (needsCsrf && !csrfBypassed) {
    const cookieVal = req.cookies.get(CSRF_COOKIE_NAME)?.value;
    const headerVal = req.headers.get(CSRF_HEADER) ?? undefined;
    const originHeader = req.headers.get("origin");
    const refererHeader = req.headers.get("referer");
    const validation = validateCsrfTokens({
      cookieToken: cookieVal,
      headerToken: headerVal,
      originHeader,
      refererHeader,
      expectedOrigin: req.nextUrl.origin,
    });
    if (!validation.ok) {
      const forwardedFor =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      console.warn("[csrf] blocked request", {
        path: url.pathname,
        method,
        reasons: validation.reasons,
        origin: redactUrlOrigin(originHeader),
        referer: redactUrlOrigin(refererHeader),
        forwardedFor,
      });
      const resp = new NextResponse("CSRF token missing or invalid", {
        status: 403,
      });
      return applySecurityHeaders(resp, securityContext);
    }
  } else if (csrfBypassed) {
    console.warn("[csrf] enforcement bypassed", {
      path: url.pathname,
      method,
      maintenance: true,
    });
  }

  let latestVersion: string | null = null;
  try {
    const stateUrl = new URL("/api/admin/state", req.url);
    const signature = await getInternalAdminSignature();
    const fetchOptions: RequestInit = { cache: "no-store" };
    if (signature) {
      fetchOptions.headers = { [INTERNAL_ADMIN_SIGNATURE_HEADER]: signature };
    }
    const stateRes = await fetch(stateUrl.toString(), fetchOptions);
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
    return applySecurityHeaders(redirect, securityContext);
  }

  const needLink = !(token as any).telegram_linked;
  const onLinkPage = url.pathname.startsWith("/link-telegram");
  if (needLink && !onLinkPage) {
    const linkUrl = new URL("/link-telegram", req.url);
    const redirect = NextResponse.redirect(linkUrl);
    return applySecurityHeaders(redirect, securityContext);
  }

  const response = NextResponse.next();
  if (latestVersion && svCookie !== latestVersion) {
    response.cookies.set(
      "sv",
      latestVersion,
      buildSessionCookieOptions(securityContext),
    );
  }

  return applySecurityHeaders(response, securityContext);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
