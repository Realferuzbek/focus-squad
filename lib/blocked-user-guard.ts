const BLOCKED_QUERY_PARAM = "blocked";
const BLOCKED_QUERY_VALUE = "1";
const BLOCKED_CALLBACK_PATH = `/signin?${BLOCKED_QUERY_PARAM}=${BLOCKED_QUERY_VALUE}`;

type BlockedRecord = { is_blocked?: boolean | null } | null | undefined;

/**
 * Normalizes the blocked flag coming from Supabase records or JWT tokens.
 */
export function isBlockedFlag(value: unknown): boolean {
  return value === true;
}

/**
 * Determines whether Supabase sign-in should be rejected for an existing record.
 */
export function shouldDenySignIn(existing: BlockedRecord): boolean {
  return isBlockedFlag(existing?.is_blocked);
}

/**
 * Resolves the next blocked flag that should be stored on the JWT/session.
 * Explicit Supabase values win over token state; otherwise the previous value is preserved.
 */
export function resolveBlockedStatus(previous: unknown, record?: BlockedRecord): boolean {
  if (record && typeof record.is_blocked === "boolean") {
    return record.is_blocked;
  }
  return isBlockedFlag(previous);
}

/**
 * Builds the enforced sign-out redirect URL used by middleware when blocked users appear.
 */
export function buildBlockedRedirectUrl(requestUrl: string): URL {
  const out = new URL("/api/auth/signout", requestUrl);
  out.searchParams.set("callbackUrl", BLOCKED_CALLBACK_PATH);
  return out;
}

export { BLOCKED_QUERY_PARAM, BLOCKED_QUERY_VALUE, BLOCKED_CALLBACK_PATH };

