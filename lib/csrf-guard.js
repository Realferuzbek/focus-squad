// lib/csrf-guard.js
// CommonJS companion for unit tests
const { safeEqual } = require("./csrf");

const WEBHOOK_PREFIXES = [/^\/api\/telegram/, /^\/api\/webhooks/];

function isStateChangingMethod(method) {
  if (!method) return false;
  const normalized = method.toUpperCase();
  return (
    normalized === "POST" ||
    normalized === "PUT" ||
    normalized === "PATCH" ||
    normalized === "DELETE"
  );
}

function requiresCsrfProtection(method, pathname) {
  if (!isStateChangingMethod(method)) return false;
  return !WEBHOOK_PREFIXES.some((pattern) => pattern.test(pathname));
}

function validateCsrfTokens(options) {
  const reasons = [];
  const {
    cookieToken,
    headerToken,
    originHeader,
    refererHeader,
    expectedOrigin,
  } = options;

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

function buildCsrfCookieOptions(context) {
  return {
    httpOnly: false,
    sameSite: "lax",
    secure: !!context?.isSecureTransport,
    path: "/",
  };
}

function buildSessionCookieOptions(context) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: !!context?.isSecureTransport,
    path: "/",
  };
}

module.exports = {
  isStateChangingMethod,
  requiresCsrfProtection,
  validateCsrfTokens,
  buildCsrfCookieOptions,
  buildSessionCookieOptions,
  __private: {
    WEBHOOK_PREFIXES,
  },
};
