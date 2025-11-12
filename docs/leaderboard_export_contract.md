# Leaderboard Export Contract

The tracker sends a single POST request to `/api/leaderboard/ingest` immediately after publishing the Telegram leaderboard message. The request is authenticated, validated, and ingested into Supabase for idempotent storage.

## Authentication

The request **must** include the shared secret header:

```text
X-Leaderboard-Secret: <LEADERBOARD_INGEST_SECRET>
```

Requests without a valid secret are rejected with `403`.

## Payload shape

The body is JSON with the following structure:

```jsonc
{
  "posted_at": "2024-05-09T12:34:56Z", // ISO-8601 in UTC (must end with "Z")
  "source": "tracker", // literal string
  "message_id": 123, // Telegram message id
  "chat_id": -1001234567890, // Telegram chat id
  "boards": [
    {
      "scope": "day", // one of day | week | month
      "period_start": "2024-05-09", // YYYY-MM-DD
      "period_end": "2024-05-09", // YYYY-MM-DD (same as start for day scope)
      "entries": [
        {
          "rank": 1, // integer 1..5, unique within the board
          "username": "focus_user", // username without leading @
          "minutes": 240, // study minutes for the period
          "title": "Top Scholar", // optional tracker-provided label
          "emojis": ["🔥", "💯"], // ordered list of emoji markers
        },
        // ... up to 5 entries
      ],
    },
    // week board
    // month board
  ],
}
```

Rules:

- `boards` **must** contain exactly three items – one for each scope (`day`, `week`, `month`).
- `rank` values are integers between `1` and `5` and must be unique within a board.
- `period_start`/`period_end` are validated as calendar dates. For the day scope the start and end dates must match.
- Usernames must omit the leading `@`.
- Empty bodies or structurally invalid payloads are captured for review instead of being rejected.

## Storage behaviour

- Valid payloads are upserted into the `leaderboards` table, keyed by `(scope, period_start, period_end)` to guarantee idempotency.
- Each row stores the ordered `entries` alongside the raw snapshot for auditing.
- On validation failure, the service writes the raw payload and validation issues to `leaderboard_meta` under the `last_failed_payload` key and responds with:

```json
{ "status": "stored-for-review" }
```

If Supabase storage fails, the endpoint responds with `500` and the error is logged.

### Public read API

Consumers can fetch the most recent leaderboard snapshot for each scope by calling `GET /api/leaderboard/latest`. The handler returns:

```json
{
  "data": {
    "day": {
      "scope": "day",
      "period_start": "2024-05-09",
      "period_end": "2024-05-09",
      "posted_at": "2024-05-09T12:34:56Z",
      "entries": [
        /* ... */
      ],
      "message_id": 123,
      "chat_id": -1001234567890
    },
    "week": {
      /* latest week snapshot or null */
    },
    "month": {
      /* latest month snapshot or null */
    }
  }
}
```

Missing scopes are returned as `null`.

## Environment variables

Two environment variables control the ingest flow:

- `LEADERBOARD_INGEST_SECRET` – shared secret used in the `X-Leaderboard-Secret` header.
- `LEADERBOARD_TIMEZONE` – canonical timezone identifier used by tracker tooling (defaults to `Asia/Tashkent`).

Configure them in your runtime environment (e.g. `.env.local` for development) and **never** commit plaintext secrets.
