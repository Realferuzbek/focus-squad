const assert = require("assert");
const { loadTsModule } = require("./test-helpers/load-ts");

const { shouldDenySignIn, resolveBlockedStatus, isBlockedFlag } = loadTsModule(
  "lib/blocked-user-guard.ts",
);

(function testShouldDenySignIn() {
  assert.strictEqual(
    shouldDenySignIn(null),
    false,
    "missing record should pass",
  );
  assert.strictEqual(
    shouldDenySignIn({ is_blocked: true }),
    true,
    "blocked record must be denied",
  );
  assert.strictEqual(
    shouldDenySignIn({ is_blocked: false }),
    false,
    "explicitly unblocked record must pass",
  );
})();

(function testResolveBlockedStatus() {
  assert.strictEqual(
    resolveBlockedStatus(false, { is_blocked: true }),
    true,
    "record flag should win over previous token",
  );
  assert.strictEqual(
    resolveBlockedStatus(true, { is_blocked: false }),
    false,
    "record unblocked state should clear token flag",
  );
  assert.strictEqual(
    resolveBlockedStatus(true, undefined),
    true,
    "missing record preserves previous token state",
  );
  assert.strictEqual(
    resolveBlockedStatus(false, { is_blocked: null }),
    false,
    "null record flag should fall back to previous token",
  );
})();

(function testIsBlockedFlag() {
  assert.strictEqual(isBlockedFlag(true), true);
  assert.strictEqual(isBlockedFlag("true"), false);
  assert.strictEqual(isBlockedFlag(undefined), false);
})();

console.log("blocked-user unit tests passed");
process.exit(0);
