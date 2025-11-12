const assert = require("assert");

const {
  generateSessionId,
  needsRollingRotation,
  resolveSessionRollingInterval,
  DEFAULT_SESSION_ROLLING_INTERVAL_MINUTES,
  MIN_SESSION_ROLLING_INTERVAL_MINUTES,
  MINUTES_TO_MS,
} = require("../lib/session-security");

(function testGenerateSessionIdShape() {
  const id = generateSessionId();
  assert.strictEqual(typeof id, "string", "session id should be a string");
  assert.strictEqual(id.length, 32, "session id should be 32 hex characters");
})();

(function testResolveSessionRollingIntervalDefaults() {
  const defaultMs = resolveSessionRollingInterval();
  assert.strictEqual(
    defaultMs,
    DEFAULT_SESSION_ROLLING_INTERVAL_MINUTES * MINUTES_TO_MS,
    "default interval should be 15 minutes",
  );

  const clampedMs = resolveSessionRollingInterval("1");
  assert.strictEqual(
    clampedMs,
    MIN_SESSION_ROLLING_INTERVAL_MINUTES * MINUTES_TO_MS,
    "interval should clamp to minimum when too small",
  );

  const explicitMs = resolveSessionRollingInterval("30");
  assert.strictEqual(
    explicitMs,
    30 * MINUTES_TO_MS,
    "explicit minutes should be converted to ms",
  );
})();

(function testNeedsRollingRotation() {
  const interval = resolveSessionRollingInterval("15");
  const now = Date.now();

  assert.strictEqual(
    needsRollingRotation(null, now, interval),
    true,
    "missing issuedAt should force rotation",
  );
  assert.strictEqual(
    needsRollingRotation(now - interval - 1000, now, interval),
    true,
    "expired session should rotate",
  );
  assert.strictEqual(
    needsRollingRotation(now - interval + 1000, now, interval),
    false,
    "fresh session should not rotate",
  );
})();

console.log("session rotation helper tests passed");
process.exit(0);
