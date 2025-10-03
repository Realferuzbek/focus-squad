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

## Scripts

- `npm run dev` – start development server (port 3000)
- `npm run build` – production build
- `npm run start` – start production server
- `npm run lint` – run ESLint

