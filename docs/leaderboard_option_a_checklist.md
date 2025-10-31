# Leaderboard Option A Rollout Checklist

## Pre-flight

1. Set `LEADERBOARD_INGEST_SECRET` in the website environment.
2. Deploy the website with the ingest route and admin page.
3. On the tracker machine, set the export environment variables but keep `LEADERBOARD_WEB_EXPORT_ENABLED=false`.
4. Confirm the tracker runs and posts to Telegram as usual.

## Dry-run

1. From the website admin, use “Simulate ingest” (dev only) to confirm database writes and the latest API response.

## Live one-night

1. Switch the tracker to `LEADERBOARD_WEB_EXPORT_ENABLED=true`.
2. After the Telegram post, verify the website received the payload:
   - The admin page shows a fresh `posted_at`.
   - `GET /api/leaderboard/latest` returns populated scopes.

## Failure simulation

1. Temporarily break the ingest URL (for example, provide the wrong secret).
2. Confirm the following:
   - Telegram still posts as usual.
   - The tracker logs a single `WARN`.
   - Website data remains unchanged.

## Rollback

1. Set `LEADERBOARD_WEB_EXPORT_ENABLED=false` so the export stops while all other behavior continues.
