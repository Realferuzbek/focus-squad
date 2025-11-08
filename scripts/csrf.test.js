// scripts/csrf.test.js
const assert = require('assert');
const { generateCsrfToken, safeEqual, CSRF_COOKIE_NAME, CSRF_HEADER } = require('../lib/csrf');

// Constants
assert.strictEqual(typeof CSRF_COOKIE_NAME, 'string', 'CSRF cookie name should be a string');
assert.strictEqual(typeof CSRF_HEADER, 'string', 'CSRF header name should be a string');
assert(CSRF_HEADER.toLowerCase() === 'x-csrf-token', 'CSRF header must default to x-csrf-token');

// Token generation
const t1 = generateCsrfToken();
const t2 = generateCsrfToken();
assert(typeof t1 === 'string' && t1.length === 64, 'token should be 64 hex chars');
assert(t1 !== t2, 'tokens should be different');

// safeEqual
assert(safeEqual(t1, t1) === true, 'safeEqual should match identical strings');
assert(safeEqual(t1, t2) === false, 'safeEqual should not match different strings');
assert(safeEqual(undefined, t1) === false, 'safeEqual handles undefined');

console.log('csrf unit tests passed');
process.exit(0);
