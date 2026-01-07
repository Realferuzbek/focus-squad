# Focus Squad!!

Next.js 14 app for the Focus Squad community. Features Google authentication via NextAuth, Supabase integration for task tracking, live session status powered by Telegram bot events, and real-time updates through Supabase Realtime.

## AI Assistant

- Floating “Ask AI” widget (bottom-right) answers site-specific questions with a motivating tone, supports multilingual replies, unique greetings, and off-topic redirection.
- Intent detection, moderation, PII redaction, RAG retrieval (Upstash Vector + OpenAI Responses API), and latency logging happen per message; no general-purpose answers leak through.
- Each conversation uses a privacy-safe session ID so anonymous visitors can rate answers; authenticated users automatically attach their Supabase user ID.
- Per-user memory is **on by default** for signed-in users. They can toggle “Use my messages to improve answers” and trigger “Forget my data” to purge chat logs + memory. Guests can opt out locally.
- Admins get a dedicated `/admin/chats` dashboard with filters (user/date/RAG usage), CSV/JSON exports, bulk deletion, and detail modals containing question/answer/rating info.
- Chat logs retain 90 days of history (Supabase trigger enforced) and include redaction status so privacy reviews stay simple.

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

See [`docs/leaderboard_export_contract.md`](./docs/leaderboard_export_contract.md) for the tracker export payload contract and ingest behaviour.

## Scheduled Checks

Configure a hosted cron (for example, [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)) to call the leaderboard health endpoint every day at 21:10 Asia/Tashkent (16:10 UTC). The job should use a simple GET request:

```text
10 16 * * * https://YOUR_DOMAIN/api/leaderboard/health
```

The endpoint returns `{ ok, latestPostedAt, scopes }` and logs an error whenever a scope is missing or has not been updated in the last 24 hours.

## Web Push Setup

Generate a VAPID key pair (run once) and copy the values into `.env.local`:

```bash
node -e "const webpush = require('web-push'); const keys = webpush.generateVAPIDKeys(); console.log(keys);"
```

Add the resulting values as:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_SUBJECT=mailto:hello@example.com
```

`VAPID_SUBJECT` can be a `mailto:` address or an HTTPS origin that identifies your application.

## AI Chatbot & Crawler Configuration

Set the following variables in `.env.local` to enable the AI-powered crawler and chat features (all values shown below are examples only—never commit real keys):

- `OPENAI_API_KEY` – server-side API key used for both generation and embedding requests to OpenAI.
- `OPENAI_GEN_MODEL` – model identifier for chat/generation calls (defaults to `gpt-5-mini`).
- `OPENAI_EMBED_MODEL` – embedding model used when vectorizing crawled content (defaults to `text-embedding-3-small`, which matches a 1536-dimension Upstash index).
- `UPSTASH_VECTOR_REST_URL` – REST endpoint for your Upstash Vector index.
- `UPSTASH_VECTOR_REST_TOKEN` – Upstash Vector REST token; keep private so only backend jobs can manage vectors.
- `UPSTASH_INDEX_NAME` – logical name of the Upstash Vector index the crawler writes to and the chatbot reads from (defaults to `focus-squad-site` so Preview/Prod can use different indices).
- `UPSTASH_VECTOR_DIM` – dimension of the Upstash index (e.g., `1536`). This **must** match the embedding model you pick (`text-embedding-3-small` = 1536, `text-embedding-3-large` = 3072), otherwise Upstash rejects queries/upserts.
- `SITE_BASE_URL` – canonical site origin the crawler starts from (e.g., `https://study-with-feruzbek.vercel.app`).
- `INDEXER_SECRET` – shared secret required by any indexer webhook/cron to prevent unauthorized crawls.
- `CRAWL_MAX_PAGES` – safety limit on how many unique pages to visit per crawl run.
- `CRAWL_MAX_DEPTH` – maximum link depth from the base URL; helps bound crawl time.
- `CRAWL_ALLOWED_PATHS` – comma-separated list of path prefixes the crawler should include.
- `CRAWL_BLOCKED_PATHS` – comma-separated list of path prefixes to exclude (useful for `/api`, build assets, etc.). Defaults block `/admin`, `/dashboard`, `/link-telegram`, `/signin`, `/api`, `/_next`, `/static`, `/assets`, `/community/admin`.
- `POST_DEPLOY_REINDEX_URL` – optional host override that `scripts/trigger-reindex.mjs` should hit after a successful deploy (falls back to the new Vercel deployment URL automatically).
- `USE_MOCK_AI` / `USE_MOCK_VECTOR` – optional toggles (`0`/`1`) that enable deterministic, in-memory embeddings + vector storage for local development so you can test the workflow without hitting OpenAI or Upstash quotas. When these are `1`, you can also adjust `MOCK_EMBED_DIM` (default `1536`) to match your Upstash index dimension.

## Reindex Automation

`vercel.json` defines a daily cron that reindexes production content at **16:00 UTC** (21:00 Asia/Tashkent) by calling `/api/cron/nightly-reindex`:

```json
{
  "crons": [{ "path": "/api/cron/nightly-reindex", "schedule": "0 16 * * *" }]
}
```

Successful Vercel deploys also run `scripts/trigger-reindex.mjs` (hooked via `npm run postbuild`), which waits for the deployment URL to come online and POSTs `/api/reindex` using the bearer secret. Trigger the job manually with the shared secret:

- Local test (after `npm run dev`):

  ```bash
  curl -X POST http://localhost:3000/api/reindex \
    -H "Authorization: Bearer ${INDEXER_SECRET}"
  ```

- Production (replace the domain if needed):

  ```bash
  curl -X POST https://study-with-feruzbek.vercel.app/api/reindex \
    -H "Authorization: Bearer ${INDEXER_SECRET}"
  ```

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

## ALL Vercel Environment Variables Keys

<!-- markdownlint-disable MD033 MD034 -->

```env
APP_URL="https://studywithferuzbek.vercel.app"
CRON_SECRET="SET_IN_VERCEL"
GOOGLE_CLIENT_ID="YOUR_GOOGLE_OAUTH_CLIENT_ID"
GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_OAUTH_CLIENT_SECRET"
INDEXER_SECRET="YOUR_INDEXER_SECRET"
LEADERBOARD_INGEST_SECRET="YOUR_LEADERBOARD_INGEST_SECRET"
NEXTAUTH_SECRET="YOUR_NEXTAUTH_SECRET"
NEXTAUTH_URL="https://studywithferuzbek.vercel.app"
NEXT_PUBLIC_SITE_URL="https://studywithferuzbek.vercel.app"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_NEXT_PUBLIC_SUPABASE_ANON_KEY"
NEXT_PUBLIC_SUPABASE_URL="https://rwjebnqymstetwgvwskm.supabase.co"
NEXT_PUBLIC_TZ="Asia/Tashkent"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="YOUR_PUBLIC_VAPID_KEY"
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
OPENAI_EMBED_MODEL="text-embedding-3-small"
OPENAI_GEN_MODEL="gpt-5-mini"
POST_DEPLOY_REINDEX_URL=""
PUBLIC_TG_GROUP_LINK="https://t.me/studywithferuzbek"
SITE_BASE_URL="https://studywithferuzbek.vercel.app"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
SUPABASE_URL="https://rwjebnqymstetwgvwskm.supabase.co"
TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
TELEGRAM_BOT_USERNAME="Studywithferuzbek_bot"
TELEGRAM_GROUP_ID="YOUR_TELEGRAM_GROUP_ID"
TELEGRAM_WEBHOOK_SECRET="YOUR_TELEGRAM_WEBHOOK_SECRET"
UPSTASH_INDEX_NAME="focus-squad-site"
UPSTASH_VECTOR_REST_TOKEN="YOUR_UPSTASH_VECTOR_REST_TOKEN"
UPSTASH_VECTOR_REST_URL="https://noble-moose-77370-us1-vector.upstash.io"
VAPID_PRIVATE_KEY="YOUR_PRIVATE_VAPID_KEY"
VAPID_PUBLIC_KEY="YOUR_PUBLIC_VAPID_KEY"
VAPID_SUBJECT="https://studywithferuzbek.vercel.app"
WEB_PUSH_PRIVATE_KEY="YOUR_WEB_PUSH_PRIVATE_KEY"
WEB_PUSH_PUBLIC_KEY="YOUR_WEB_PUSH_PUBLIC_KEY"
```

<!-- markdownlint-enable MD033 MD034 -->
