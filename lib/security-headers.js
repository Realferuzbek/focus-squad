const PERMISSIONS_POLICY =
  "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=(), bluetooth=(), gyroscope=(), magnetometer=()";

const CSP_REPORT_ONLY =
  "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'; upgrade-insecure-requests; block-all-mixed-content";

// By default we publish CSP in report-only mode to avoid accidental breakage.
// To enable enforcement, set the environment variable SECURITY_CSP_ENFORCE=1
// or pass { enforceCsp: true } in the SecurityHeaderContext when calling builders.
function buildContentSecurityPolicy(context = {}) {
  const enforce = !!(process.env.SECURITY_CSP_ENFORCE || context.enforceCsp);
  // If enforcement requested, use the same policy but without the Report-Only header name.
  return enforce ? CSP_REPORT_ONLY : CSP_REPORT_ONLY;
}

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": PERMISSIONS_POLICY,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy-Report-Only": CSP_REPORT_ONLY,
};

const OPTIONAL_HEADERS = ["Strict-Transport-Security"];

/**
 * Builds the header key/value pairs.
 * @param {SecurityHeaderContext} [context]
 * @returns {Record<string, string>}
 */
function buildSecurityHeaders(context = {}) {
  const headers = { ...BASE_HEADERS };
  const hstsValue = deriveStrictTransportSecurity(context);
  if (hstsValue) headers["Strict-Transport-Security"] = hstsValue;
  // Swap Report-Only -> Enforce header when requested.
  const csp = buildContentSecurityPolicy(context);
  if (csp) {
    if (context.enforceCsp || process.env.SECURITY_CSP_ENFORCE) {
      headers["Content-Security-Policy"] = csp;
      delete headers["Content-Security-Policy-Report-Only"];
    } else {
      headers["Content-Security-Policy-Report-Only"] = csp;
      delete headers["Content-Security-Policy"];
    }
  }
  return headers;
}

/**
 * Applies headers to the provided response instance.
 * @template {Response} T
 * @param {T} response
 * @param {SecurityHeaderContext} [context]
 * @returns {T}
 */
function applySecurityHeaders(response, context = {}) {
  if (!response || !response.headers) return response;
  const desired = buildSecurityHeaders(context);
  for (const [key, value] of Object.entries(desired)) {
    response.headers.set(key, value);
  }
  for (const header of OPTIONAL_HEADERS) {
    if (!(header in desired)) response.headers.delete(header);
  }
  response.headers.delete("x-powered-by");
  response.headers.delete("server");
  return response;
}

/**
 * Computes the HSTS header value when allowed.
 * @param {SecurityHeaderContext} [context]
 * @returns {string | null}
 */
function deriveStrictTransportSecurity(context = {}) {
  if (!context.isProduction) return null;
  if (!context.isSecureTransport) return null;
  return "max-age=31536000; includeSubDomains";
}

module.exports = {
  applySecurityHeaders,
  buildSecurityHeaders,
  deriveStrictTransportSecurity,
  PERMISSIONS_POLICY,
  CSP_REPORT_ONLY,
};

/**
 * @typedef {Object} SecurityHeaderContext
 * @property {boolean} [isProduction]
 * @property {boolean} [isSecureTransport]
 */
