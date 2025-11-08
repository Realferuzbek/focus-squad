// scripts/csrf.test.js
const assert = require("assert");

const MODULE_PATH = "../lib/csrf";

function loadCsrf() {
  delete require.cache[require.resolve(MODULE_PATH)];
  return require(MODULE_PATH);
}

const {
  generateCsrfToken,
  safeEqual,
  CSRF_COOKIE_NAME,
  CSRF_HEADER,
} = loadCsrf();

// Constants
assert.strictEqual(
  typeof CSRF_COOKIE_NAME,
  "string",
  "CSRF cookie name should be a string",
);
assert.strictEqual(
  typeof CSRF_HEADER,
  "string",
  "CSRF header name should be a string",
);
assert(
  CSRF_HEADER.toLowerCase() === "x-csrf-token",
  "CSRF header must default to x-csrf-token",
);

// Token generation using runtime crypto
const t1 = generateCsrfToken();
const t2 = generateCsrfToken();
assert(
  typeof t1 === "string" && t1.length === 64,
  "token should be 64 hex chars",
);
assert(t1 !== t2, "tokens should be different");

// safeEqual
assert(safeEqual(t1, t1) === true, "safeEqual should match identical strings");
assert(
  safeEqual(t1, t2) === false,
  "safeEqual should not match different strings",
);
assert(safeEqual(undefined, t1) === false, "safeEqual handles undefined");

// Deterministic getRandomValues path
(function testDeterministicGetRandomValues() {
  const originalCrypto = globalThis.crypto;
  const stubValue = 0xab;
  const stubbedCrypto = {
    ...(originalCrypto ?? {}),
    getRandomValues(target) {
      const filled = target;
      for (let i = 0; i < filled.length; i += 1) {
        filled[i] = stubValue;
      }
      return filled;
    },
  };
  globalThis.crypto = stubbedCrypto;
  const { generateCsrfToken: deterministicGenerator } = loadCsrf();
  const deterministicToken = deterministicGenerator();
  assert.strictEqual(
    deterministicToken,
    "ab".repeat(32),
    "deterministic generator should honor custom getRandomValues",
  );
  if (originalCrypto === undefined) {
    delete globalThis.crypto;
  } else {
    globalThis.crypto = originalCrypto;
  }
  loadCsrf();
})();

console.log("csrf unit tests passed");
process.exit(0);
