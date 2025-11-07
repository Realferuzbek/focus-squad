// security-headers.test.js
// Simple deterministic tests for lib/security-headers.js
const assert = require('assert');
const { buildSecurityHeaders, deriveStrictTransportSecurity } = require('../lib/security-headers');

function keys(obj) { return Object.keys(obj).sort(); }

// Test: when not production, no HSTS
const headersDev = buildSecurityHeaders({ isProduction: false, isSecureTransport: false });
assert(!('Strict-Transport-Security' in headersDev), 'HSTS must not be present in non-production');

// Test: production + secure transport => HSTS present
const headersProd = buildSecurityHeaders({ isProduction: true, isSecureTransport: true });
assert(headersProd['Strict-Transport-Security'], 'HSTS must be present in production+secure');
assert(headersProd['X-Content-Type-Options'] === 'nosniff');

// Test: CSP default is report-only header
const headersCsp = buildSecurityHeaders({ isProduction: false });
assert('Content-Security-Policy-Report-Only' in headersCsp, 'Default CSP should be report-only');

// Test: enforce via context
const headersEnforce = buildSecurityHeaders({ isProduction: true, isSecureTransport: true, enforceCsp: true });
assert('Content-Security-Policy' in headersEnforce, 'CSP should be enforced when requested');
assert(!('Content-Security-Policy-Report-Only' in headersEnforce), 'Report-only must be removed when enforcing');

console.log('security-headers tests passed');
process.exit(0);
