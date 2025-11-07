# Focus Squad

Next.js 14 app for the Focus Squad community. Features Google authentication via NextAuth, Supabase integration for task tracking, live session status powered by Telegram bot events, and real-time updates through Supabase Realtime.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` (create one with the required keys) and fill in Supabase, Google, Telegram, and cron secrets.
3. Run the dev server:
   ```bash
   npm run dev
   ```

## Environment Variables

- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_ID`, `TELEGRAM_BOT_USERNAME`
- `PUBLIC_TG_GROUP_LINK`
- `CRON_SECRET`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
- `LEADERBOARD_INGEST_SECRET`
- `LEADERBOARD_TIMEZONE` (defaults to `Asia/Tashkent`)

See [`docs/leaderboard_export_contract.md`](./docs/leaderboard_export_contract.md) for the tracker export payload contract and ingest behaviour.

## Scheduled Checks

Configure a hosted cron (for example, [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)) to call the leaderboard health endpoint every day at 21:10 Asia/Tashkent (16:10 UTC). The job should use a simple GET request:

```
10 16 * * * https://<your-domain>/api/leaderboard/health
```

The endpoint returns `{ ok, latestPostedAt, scopes }` and logs an error whenever a scope is missing or has not been updated in the last 24 hours.

## Web Push Setup

Generate a VAPID key pair (run once) and copy the values into `.env.local`:

```bash
node -e "const webpush = require('web-push'); const keys = webpush.generateVAPIDKeys(); console.log(keys);"
```

Add the resulting values as:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_SUBJECT=mailto:hello@example.com
```

`VAPID_SUBJECT` can be a `mailto:` address or an HTTPS origin that identifies your application.

## Scripts

- `npm run dev` – start development server (port 3000)
- `npm run build` – production build
- `npm run start` – start production server
- `npm run lint` – run ESLint

## SEO & Indexing

- `NEXT_PUBLIC_SITE_URL` must be set on Vercel so canonical URLs resolve correctly.
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is optional and only needed if you plan to prove ownership in Google Search Console.
- `npm run build` runs `next-sitemap` (via `postbuild`) which regenerates `public/sitemap.xml` and `public/robots.txt`.
- Private/admin routes are excluded automatically through `next-sitemap.config.js`.

## Vercel Environment Variables Keys

