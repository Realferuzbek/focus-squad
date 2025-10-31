export const runtime = 'nodejs';
export const revalidate = 60;

import { NextResponse } from 'next/server';
import { REQUIRED_SCOPES } from '@/lib/leaderboard/ingest';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const client = supabaseAdmin();

  try {
    const entries = await Promise.all(
      REQUIRED_SCOPES.map(async (scope) => {
        const { data, error } = await client
          .from('leaderboards')
          .select('scope, period_start, period_end, posted_at, entries, message_id, chat_id')
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

    const latest = Object.fromEntries(entries);
    return NextResponse.json({ data: latest });
  } catch (error) {
    console.error('leaderboard latest: failed to load snapshots', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
