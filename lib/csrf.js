// lib/csrf.js
// CommonJS version for Node.js test scripts (scripts/csrf.test.js)
// The TypeScript version (lib/csrf.ts) is used by Next.js/TypeScript imports
const { randomBytes, timingSafeEqual } = require('crypto');

const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

// Generate a 32-byte (256-bit) CSRF token in hex
function generateCsrfToken() {
  return randomBytes(32).toString('hex');
}

// Constant-time compare using Node.js crypto.timingSafeEqual
// This prevents timing attacks on CSRF token validation
function safeEqual(a, b) {
  if (!a || !b) return false;
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  try {
    return timingSafeEqual(A, B);
  } catch {
    // timingSafeEqual throws if buffers have different lengths, but we check above
    // This catch is defensive programming
    return false;
  }
}

module.exports = {
  generateCsrfToken,
  safeEqual,
  CSRF_COOKIE_NAME,
  CSRF_HEADER,
};
