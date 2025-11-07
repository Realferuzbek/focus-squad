const crypto = require('crypto');

const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function safeEqual(a, b) {
  if (!a || !b) return false;
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  try {
    return crypto.timingSafeEqual(A, B);
  } catch {
    return false;
  }
}

module.exports = {
  generateCsrfToken,
  safeEqual,
  CSRF_COOKIE_NAME,
  CSRF_HEADER,
};
