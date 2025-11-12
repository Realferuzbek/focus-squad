# Playwright E2E Templates

This folder contains a staging-only Playwright test template.

## Run locally

1. Install Playwright: npm install -D @playwright/test
2. Install browsers: npx playwright install
3. Set STAGING_URL environment variable to your staging site.
4. Run: npx playwright test tests/e2e/csrf.spec.ts --project=chromium

Note: The test contains TODOs for app-specific OAuth sign-in steps. The test is a template and may require adaptation to your auth flows.
