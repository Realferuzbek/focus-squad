const assert = require("assert");
const { URL } = require("url");
const { loadTsModule } = require("./test-helpers/load-ts");

const {
  shouldDenySignIn,
  resolveBlockedStatus,
  buildBlockedRedirectUrl,
  BLOCKED_CALLBACK_PATH,
  BLOCKED_QUERY_PARAM,
  BLOCKED_QUERY_VALUE,
} = loadTsModule("lib/blocked-user-guard.ts");

(function simulateBlockedUserJourney() {
  const supabaseRecord = { is_blocked: true };
  assert(
    shouldDenySignIn(supabaseRecord),
    "blocked Supabase record must fail sign-in",
  );

  const tokenStatus = resolveBlockedStatus(false, supabaseRecord);
  assert.strictEqual(
    tokenStatus,
    true,
    "blocked status should propagate to JWT/session payloads",
  );

  const redirectTarget = buildBlockedRedirectUrl("https://app.example.com/dashboard");
  assert.strictEqual(
    redirectTarget.pathname,
    "/api/auth/signout",
    "middleware should send users through /api/auth/signout",
  );
  const callbackParam = redirectTarget.searchParams.get("callbackUrl");
  assert.strictEqual(
    callbackParam,
    BLOCKED_CALLBACK_PATH,
    "callback must surface the blocked query flag",
  );

  const signinUrl = new URL(callbackParam, "https://app.example.com");
  assert.strictEqual(
    signinUrl.pathname,
    "/signin",
    "blocked redirect must point back to /signin",
  );
  assert.strictEqual(
    signinUrl.searchParams.get(BLOCKED_QUERY_PARAM),
    BLOCKED_QUERY_VALUE,
    "blocked query flag should be stable for the signin UI",
  );
})();

console.log("blocked-user e2e tests passed");
process.exit(0);

