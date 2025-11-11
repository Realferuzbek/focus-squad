// scripts/security-headers.test.js
const assert = require("assert");
process.env.SECURITY_CSP_ENFORCE = "1";

const {
  applySecurityHeaders,
  buildSecurityHeaders,
  deriveStrictTransportSecurity,
} = require("../lib/security-headers");

function headersForResponse(context) {
  const response = applySecurityHeaders(new Response("ok"), context);
  return response.headers;
}

(function testAppliedResponseHeaders() {
  const devHeaders = headersForResponse({ isProduction: false, isSecureTransport: false });
  assert.strictEqual(devHeaders.get("X-Content-Type-Options"), "nosniff");
  assert.strictEqual(devHeaders.get("Referrer-Policy"), "no-referrer");
  assert.strictEqual(devHeaders.get("X-Frame-Options"), "DENY");
  assert.strictEqual(
    devHeaders.get("Permissions-Policy"),
    "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=(), bluetooth=(), gyroscope=(), magnetometer=()",
  );
  assert.strictEqual(devHeaders.get("Cross-Origin-Opener-Policy"), "same-origin");
  assert.strictEqual(devHeaders.get("Cross-Origin-Resource-Policy"), "same-origin");
  const enforcedCsp = devHeaders.get("Content-Security-Policy");
  assert(enforcedCsp.includes("default-src 'self'"), "CSP must include default-src self");
  assert.strictEqual(
    devHeaders.get("Strict-Transport-Security"),
    null,
    "HSTS should be omitted outside secure production",
  );
})();

(function testAppliedHstsWhenEligible() {
  const prodHeaders = headersForResponse({ isProduction: true, isSecureTransport: true });
  assert.strictEqual(
    prodHeaders.get("Strict-Transport-Security"),
    "max-age=31536000; includeSubDomains",
    "HSTS should be present for secure production responses",
  );
})();

(function testBuilderDefaults() {
  const headersDev = buildSecurityHeaders({ isProduction: false, isSecureTransport: false });
  assert(!("Strict-Transport-Security" in headersDev), "HSTS must not be present in non-production");
  assert(headersDev["X-Content-Type-Options"] === "nosniff");
  assert("Content-Security-Policy" in headersDev, "CSP should be enforced by default");
  assert.strictEqual(headersDev["X-Frame-Options"], "DENY");

  const headersProd = buildSecurityHeaders({ isProduction: true, isSecureTransport: true });
  assert(headersProd["Strict-Transport-Security"], "HSTS must be present in production+secure");

  process.env.SECURITY_CSP_ENFORCE = "0";
  const headersReportOnly = buildSecurityHeaders({ isProduction: false });
  assert(
    "Content-Security-Policy-Report-Only" in headersReportOnly,
    "Explicitly disabling enforcement should emit report-only header",
  );
  process.env.SECURITY_CSP_ENFORCE = "1";
})();

(function testIframeAllowanceStripsFrameGuards() {
  const headers = buildSecurityHeaders({ allowIframe: true });
  assert(!("X-Frame-Options" in headers), "X-Frame-Options must be removed when iframe embedding is allowed");
  assert(
    !("Content-Security-Policy" in headers) &&
      !("Content-Security-Policy-Report-Only" in headers),
    "CSP should be removed entirely for iframe-allowed responses",
  );
})();

(function testDeriveHstsVariants() {
  assert.strictEqual(
    deriveStrictTransportSecurity({ isProduction: true, isSecureTransport: true }),
    "max-age=31536000; includeSubDomains",
  );
  assert.strictEqual(
    deriveStrictTransportSecurity({ isProduction: true, isSecureTransport: false }),
    null,
  );
  assert.strictEqual(
    deriveStrictTransportSecurity({ isProduction: false, isSecureTransport: true }),
    null,
  );
})();

console.log("security-headers tests passed");
process.exit(0);
