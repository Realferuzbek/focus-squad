SECURITY GUIDANCE

This file contains minimal, practical security guidance for the `focus-squad` repository focused on the DB artifacts changed in recent migrations (particularly `push_subscriptions` and `dm_audit`).

1) Push subscription secrets handling
- The `push_subscriptions` table stores `p256dh` and `auth` values used for Web Push. Treat these values as secrets.
- Do NOT log these fields to application logs. When debugging, redact them or display only the first/last 4 characters.
- Store production DB credentials and any push service keys in a secrets manager (e.g., environment variables backed by your cloud provider vault or an external secret manager).
- If a push subscription secret is suspected compromised, rotate keys at the push service and delete the affected `push_subscriptions` row(s). Notify users if required by policy.

2) Row-Level Security (RLS) expectations
- The migration enables RLS on `dm_audit` and `push_subscriptions`.
- `dm_audit` exposes a `dm_audit_view` policy that allows participants with role `dm_admin` to SELECT; ensure that `auth.uid()` is correctly provided by your auth integration and cannot be spoofed by untrusted clients.
- `push_subscriptions` policy `push_self_all` restricts access to the owning `user_id`. Do not expose `auth.uid()` behavior to unauthenticated callers.

3) Migration and rollout guidance
- Apply migrations first to a staging DB. Verify constraints, indexes, and policies are created and that RLS policies behave as intended.
- Keep `SECURITY_CSP_ENFORCE` or any other enforcement flag off by default until you've monitored report-only mode and fixed CSP violations.
- When enabling enforcement, do it gradually (canary) and have a rollback plan (unset env var or revert migration file).

4) Data retention and privacy
- Avoid storing PII in `dm_audit.meta` unless absolutely necessary. If you must, ensure encryption-at-rest and access controls are enforced.
- Audit logs should not include raw secrets.

5) Quick rollback steps
- If an issue is found after applying migrations: revert the migration commit in Git; if immediate DB rollback is required, use your DB backups or deployment runbook.

6) Contact & reporting
- For security incidents or questions, contact the repository maintainer(s) or the security contact defined in your organization.


Change notes
- This guidance was added to document the migration edits to `supabase/migrations/20231015_dm_admin_chat_phase3.sql` and to provide immediate operational guidance.

7) Session cookie and CSRF guidance
- Session cookies issued by NextAuth are configured to be HttpOnly, SameSite=Lax and Secure only in production by default.
- The client must use `csrfFetch` from `lib/csrf-client.ts` for all state-changing requests; it automatically injects the double-submit token header for same-origin requests.
- The middleware enforces token comparison and same-origin checks; CSRF failures are logged with redacted metadata for incident response.
- On sign-in the server ensures a `sid` claim exists in JWTs to mitigate session fixation; further rolling rotation is planned as a follow-up.

- Testing tips:
- Run `node ./scripts/session-cookie.test.js` and `npm run test:csrf` locally. The latter covers token helper assertions and a static check that ensures state-changing calls rely on `csrfFetch`.

E2E smoke testing (staging):
- Use the template `scripts/e2e-smoke-template.ps1` to implement a Playwright/Headless test that: signs in, verifies CSRF cookie creation on GET, performs a valid POST with `X-CSRF-Token` header and expects 200, and ensures invalid/missing token yields 403.

Semgrep rules:
- Additional rules added under `.semgrep-rules/` check for file upload validation and CSP unsafe-inline usage; configure semgrep in CI to fail or warn as policy requires.
