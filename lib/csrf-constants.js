const DEFAULT_CSRF_COOKIE_NAME = "csrf-token";
const DEFAULT_CSRF_HEADER_NAME = "x-csrf-token";

function resolveCookieName() {
  return (
    process.env.CSRF_COOKIE_NAME ||
    process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ||
    DEFAULT_CSRF_COOKIE_NAME
  );
}

function resolveHeaderName() {
  return (
    process.env.CSRF_HEADER_NAME ||
    process.env.NEXT_PUBLIC_CSRF_HEADER_NAME ||
    DEFAULT_CSRF_HEADER_NAME
  );
}

const CSRF_COOKIE_NAME = resolveCookieName();
const CSRF_HEADER_NAME = resolveHeaderName();

module.exports = {
  DEFAULT_CSRF_COOKIE_NAME,
  DEFAULT_CSRF_HEADER_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
};


