import { safeEqual } from "./csrf";

const WEBHOOK_PREFIXES = [/^\/api\/telegram/, /^\/api\/webhooks/];

export function isStateChangingMethod(method: string | undefined): boolean {
  if (!method) return false;
  const normalized = method.toUpperCase();
  return (
    normalized === "POST" ||
    normalized === "PUT" ||
    normalized === "PATCH" ||
    normalized === "DELETE"
  );
}

export function requiresCsrfProtection(
  method: string | undefined,
  pathname: string,
): boolean {
  if (!isStateChangingMethod(method)) return false;
  return !WEBHOOK_PREFIXES.some((pattern) => pattern.test(pathname));
}

interface ValidateCsrfOptions {
  cookieToken?: string;
  headerToken?: string;
  originHeader?: string | null;
  refererHeader?: string | null;
  expectedOrigin: string;
}

export interface CsrfValidationResult {
  ok: boolean;
  reasons: string[];
}

export function validateCsrfTokens(
  options: ValidateCsrfOptions,
): CsrfValidationResult {
  const reasons: string[] = [];
  const { cookieToken, headerToken, originHeader, refererHeader, expectedOrigin } =
    options;

  if (!cookieToken) reasons.push("missing_cookie");
  if (!headerToken) reasons.push("missing_header");

  if (cookieToken && headerToken && !safeEqual(cookieToken, headerToken)) {
    reasons.push("token_mismatch");
  }

  const sameOrigin =
    (originHeader && originHeader.startsWith(expectedOrigin)) ||
    (refererHeader && refererHeader.startsWith(expectedOrigin));

  if (!sameOrigin) reasons.push("origin_mismatch");

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export interface CookieSecurityContext {
  isSecureTransport: boolean;
}

export function buildCsrfCookieOptions(context: CookieSecurityContext) {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: !!context.isSecureTransport,
    path: "/",
  };
}

export function buildSessionCookieOptions(context: CookieSecurityContext) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: !!context.isSecureTransport,
    path: "/",
  };
}

export const __private = {
  WEBHOOK_PREFIXES,
};

