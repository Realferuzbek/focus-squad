const PERMISSIONS_POLICY =
  "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=(), bluetooth=(), gyroscope=(), magnetometer=()";

const CSP_REPORT_ONLY =
  "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'; upgrade-insecure-requests; block-all-mixed-content";

// CSP enforces by default in production builds; set SECURITY_CSP_ENFORCE=0 to force report-only
// or SECURITY_CSP_ENFORCE=1 / { enforceCsp: true } to pin enforcement in any environment.
function buildContentSecurityPolicy(context = {}) {
  // The caller decides whether this string is attached as CSP or CSP-Report-Only.
  return CSP_REPORT_ONLY;
}

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": PERMISSIONS_POLICY,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

const OPTIONAL_HEADERS = ["Strict-Transport-Security"];

function resolveBooleanEnvFlag(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function shouldEnforceCsp(context = {}) {
  if (context.enforceCsp) return true;
  const explicit = resolveBooleanEnvFlag(process.env.SECURITY_CSP_ENFORCE);
  if (explicit !== null) return explicit;
  return process.env.NODE_ENV === "production";
}

/**
 * Builds the header key/value pairs.
 * @param {SecurityHeaderContext} [context]
 * @returns {Record<string, string>}
 */
function buildSecurityHeaders(context = {}) {
  const headers = { ...BASE_HEADERS };
  const hstsValue = deriveStrictTransportSecurity(context);
  if (hstsValue) headers["Strict-Transport-Security"] = hstsValue;
  const enforceCsp = shouldEnforceCsp(context);
  let csp = buildContentSecurityPolicy(context);
  
  // Allow iframe embedding for timer HTML files
  if (context.allowIframe) {
    delete headers["X-Frame-Options"];
    csp = null;
  }
  
  if (csp) {
    const headerName = enforceCsp
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";
    headers[headerName] = csp;
    const alternate =
      headerName === "Content-Security-Policy"
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy";
    delete headers[alternate];
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
  if (context.allowIframe) {
    response.headers.delete("X-Frame-Options");
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
 * @property {boolean} [allowIframe] - Allow iframe embedding (for timer HTML files)
 */
