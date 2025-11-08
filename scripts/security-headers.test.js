// scripts/security-headers.test.js
const assert = require("assert");
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
  const cspReportOnly = devHeaders.get("Content-Security-Policy-Report-Only");
  assert(cspReportOnly.includes("default-src 'self'"), "CSP-RO must include default-src self");
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

  const headersProd = buildSecurityHeaders({ isProduction: true, isSecureTransport: true });
  assert(headersProd["Strict-Transport-Security"], "HSTS must be present in production+secure");

  const headersCsp = buildSecurityHeaders({ isProduction: false });
  assert(
    "Content-Security-Policy-Report-Only" in headersCsp,
    "Default CSP should be report-only header",
  );

  const headersEnforce = buildSecurityHeaders({
    isProduction: true,
    isSecureTransport: true,
    enforceCsp: true,
  });
  assert("Content-Security-Policy" in headersEnforce, "CSP should be enforced when requested");
  assert(
    !("Content-Security-Policy-Report-Only" in headersEnforce),
    "Report-only must be removed when enforcing",
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
