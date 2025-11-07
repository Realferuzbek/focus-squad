// lib/csrf.ts
import { randomBytes, timingSafeEqual } from 'crypto';

export const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'csrf-token';
export const CSRF_HEADER = 'x-csrf-token';

// Generate a 32-byte (256-bit) CSRF token in hex
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

// Constant-time compare using Node.js crypto.timingSafeEqual
// This prevents timing attacks on CSRF token validation
export function safeEqual(a: string | undefined, b: string | undefined): boolean {
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

// Named exports are already declared above; no default export.
