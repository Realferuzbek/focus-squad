# e2e-smoke-template.ps1
# This is a template for a staging-only smoke test (do not run in production automatically).
# Requires: a staging URL and a headless browser or HTTP client.

param(
  [string]$STAGING_URL = "https://staging.example.com"
)

Write-Host "This script outlines steps to run a staging smoke test manually."
Write-Host "1) Sign in via OAuth flow and ensure redirect completes."
Write-Host "2) GET a page to verify CSRF cookie set: check for cookie 'csrf-token' present."
Write-Host "3) POST to a state-changing endpoint with header X-CSRF-Token matching the cookie -> expect 200."
Write-Host "4) POST same endpoint without header -> expect 403."

Write-Host "Use Playwright or similar to automate these steps. This file is a template only." 
