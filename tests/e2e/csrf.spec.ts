import { test, expect } from '@playwright/test';

// Template e2e test for staging (manual run after installing Playwright)
// Steps:
// 1) Sign in via OAuth (requires staging credentials and configured redirect).
// 2) Visit a page to ensure CSRF cookie is set.
// 3) Use fetch within the page context to POST with X-CSRF-Token header matching cookie.
// 4) Assert 200 on valid request and 403 on invalid/missing token.

const STAGING_URL = process.env.STAGING_URL || 'https://staging.example.com';

test('CSRF double-submit smoke (manual staging only)', async ({ page }) => {
  test.skip(!process.env.STAGING_URL, 'set STAGING_URL to run staging e2e');

  await page.goto(STAGING_URL);

  // TODO: do OAuth sign-in. This is app-specific and may require interactive steps.
  // For demo, we assume a session is already present or a test user cookie is injected.

  // Verify CSRF cookie present
  const cookies = await page.context().cookies();
  const csrf = cookies.find(c => c.name === 'csrf-token');
  expect(csrf).toBeTruthy();

  // Valid POST via page eval (reads cookie and sends header)
  const result = await page.evaluate(async () => {
    const csrf = document.cookie.split('; ').find(c => c.startsWith('csrf-token='))?.split('=')[1];
    const res = await fetch('/api/some-state-change', { method: 'POST', headers: { 'x-csrf-token': csrf }, body: JSON.stringify({ test: true }) });
    return { status: res.status, text: await res.text() };
  });
  expect(result.status).toBe(200);

  // Invalid POST without header
  const bad = await page.evaluate(async () => {
    const res = await fetch('/api/some-state-change', { method: 'POST', body: JSON.stringify({ test: true }) });
    return res.status;
  });
  expect(bad).toBe(403);
});
