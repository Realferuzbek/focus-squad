# Focus Squad!

Next.js 14 app for the Focus Squad community. Features Google authentication via NextAuth, Supabase integration for task tracking, live session status powered by Telegram bot events, and real-time updates through Supabase Realtime!!!!!!!

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

## AI Chatbot & Crawler Configuration

Set the following variables in `.env.local` to enable the AI-powered crawler and chat features (all values shown below are examples only—never commit real keys):

- `OPENAI_API_KEY` – server-side API key used for both generation and embedding requests to OpenAI.
- `OPENAI_GEN_MODEL` – model identifier for chat/generation calls (defaults to `gpt-4.1`).
- `OPENAI_EMBED_MODEL` – embedding model used when vectorizing crawled content (defaults to `text-embedding-3-small`, which matches a 1536-dimension Upstash index).
- `UPSTASH_VECTOR_REST_URL` – REST endpoint for your Upstash Vector index.
- `UPSTASH_VECTOR_REST_TOKEN` – Upstash Vector REST token; keep private so only backend jobs can manage vectors.
- `UPSTASH_INDEX_NAME` – logical name of the Upstash Vector index the crawler writes to and the chatbot reads from.
- `UPSTASH_VECTOR_DIM` – dimension of the Upstash index (e.g., `1536`). This **must** match the embedding model you pick (`text-embedding-3-small` = 1536, `text-embedding-3-large` = 3072), otherwise Upstash rejects queries/upserts.
- `SITE_BASE_URL` – canonical site origin the crawler starts from (e.g., `https://study-with-feruzbek.vercel.app`).
- `INDEXER_SECRET` – shared secret required by any indexer webhook/cron to prevent unauthorized crawls.
- `CRAWL_MAX_PAGES` – safety limit on how many unique pages to visit per crawl run.
- `CRAWL_MAX_DEPTH` – maximum link depth from the base URL; helps bound crawl time.
- `CRAWL_ALLOWED_PATHS` – comma-separated list of path prefixes the crawler should include.
- `CRAWL_BLOCKED_PATHS` – comma-separated list of path prefixes to exclude (useful for `/api`, build assets, etc.).
- `USE_MOCK_AI` / `USE_MOCK_VECTOR` – optional toggles (`0`/`1`) that enable deterministic, in-memory embeddings + vector storage for local development so you can test the workflow without hitting OpenAI or Upstash quotas. When these are `1`, you can also adjust `MOCK_EMBED_DIM` (default `1536`) to match your Upstash index dimension.

## Reindex Automation

`vercel.json` defines a daily cron that reindexes production content at 03:00 UTC:

```json
{
  "crons": [
    { "path": "/api/reindex", "schedule": "0 3 * * *" }
  ]
}
```

Trigger the job manually with the shared secret:

- Local test (after `npm run dev`):  
  ```bash
  curl -X POST http://localhost:3000/api/reindex \
    -H "x-indexer-secret: ${INDEXER_SECRET}"
  ```

- Production (replace the domain if needed):  
  ```bash
  curl -X POST https://study-with-feruzbek.vercel.app/api/reindex \
    -H "x-indexer-secret: ${INDEXER_SECRET}"
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

APP_URL="https://studywithferuzbek.vercel.app"
CRON_SECRET="<set-in-vercel>"
GOOGLE_CLIENT_ID="<google-oauth-client-id>"
GOOGLE_CLIENT_SECRET="<google-oauth-client-secret>"
INDEXER_SECRET="<long-shared-secret>"
LEADERBOARD_INGEST_SECRET="<leaderboard-ingest-secret>"
NEXTAUTH_SECRET="<nextauth-secret>"
NEXTAUTH_URL="https://studywithferuzbek.vercel.app"
NEXT_PUBLIC_SITE_URL="https://studywithferuzbek.vercel.app"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<supabase-anon-key>"
NEXT_PUBLIC_SUPABASE_URL="https://rwjebnqymstetwgvwskm.supabase.co"
NEXT_PUBLIC_TZ="Asia/Tashkent"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="<public-vapid-key>"
OPENAI_API_KEY="<openai-api-key>"
OPENAI_EMBED_MODEL="text-embedding-3-small"
OPENAI_GEN_MODEL="gpt-4.1"
PUBLIC_TG_GROUP_LINK="https://t.me/studywithferuzbek"
SITE_BASE_URL="https://studywithferuzbek.vercel.app"
SUPABASE_ANON_KEY="<supabase-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<supabase-service-role-key>"
SUPABASE_URL="https://rwjebnqymstetwgvwskm.supabase.co"
TELEGRAM_BOT_TOKEN="<telegram-bot-token>"
TELEGRAM_BOT_USERNAME="Studywithferuzbek_bot"
TELEGRAM_GROUP_ID="<telegram-group-id>"
TELEGRAM_WEBHOOK_SECRET="<telegram-webhook-secret>"
UPSTASH_INDEX_NAME="study_with_feruzbek_site"
UPSTASH_VECTOR_REST_TOKEN="<upstash-vector-rest-token>"
UPSTASH_VECTOR_REST_URL="https://noble-moose-77370-us1-vector.upstash.io"
VAPID_PRIVATE_KEY="<private-vapid-key>"
VAPID_PUBLIC_KEY="<public-vapid-key>"
VAPID_SUBJECT="https://studywithferuzbek.vercel.app"
WEB_PUSH_PRIVATE_KEY="<web-push-private-key>"
WEB_PUSH_PUBLIC_KEY="<web-push-public-key>"
