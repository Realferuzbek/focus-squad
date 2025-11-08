export const DEFAULT_CSRF_COOKIE_NAME = "csrf-token";
export const DEFAULT_CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Resolves the cookie name used for CSRF double-submit tokens.
 * Prefers server-side env overrides but falls back to public env/no override.
 */
const ENV: Record<string, string | undefined> =
  (typeof globalThis !== "undefined" &&
    (globalThis as any)?.process?.env) ||
  {};

export const CSRF_COOKIE_NAME =
  ENV.CSRF_COOKIE_NAME ??
  ENV.NEXT_PUBLIC_CSRF_COOKIE_NAME ??
  DEFAULT_CSRF_COOKIE_NAME;

/**
 * Resolves the request header name carrying the CSRF token for verification.
 */
export const CSRF_HEADER_NAME =
  ENV.CSRF_HEADER_NAME ??
  ENV.NEXT_PUBLIC_CSRF_HEADER_NAME ??
  DEFAULT_CSRF_HEADER_NAME;


