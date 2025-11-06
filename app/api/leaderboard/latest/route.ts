export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

import { REQUIRED_SCOPES } from '@/lib/leaderboard/ingest';
import { supabaseAdmin } from '@/lib/supabaseServer';

type LeaderboardRow = Record<string, unknown> | null;

const loadLatest = unstable_cache(
  async () => {
    const client = supabaseAdmin();

    const entries = await Promise.all(
      REQUIRED_SCOPES.map(async (scope) => {
        const { data, error } = await client
          .from('leaderboards')
          .select(
            'scope, period_start, period_end, posted_at, entries, message_id, chat_id',
          )
          .eq('scope', scope)
          .order('posted_at', { ascending: false })
          .order('period_end', { ascending: false })
          .limit(1);

        if (error) {
          throw error;
        }

        return [scope, data?.[0] ?? null] as const;
      }),
    );

    return Object.fromEntries(entries) as Record<string, LeaderboardRow>;
  },
  ['leaderboard-latest'],
  { revalidate: 60 },
);

export async function GET() {
  try {
    const latest = await loadLatest();
    return NextResponse.json({ data: latest });
  } catch (error) {
    console.error('leaderboard latest: failed to load snapshots', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
