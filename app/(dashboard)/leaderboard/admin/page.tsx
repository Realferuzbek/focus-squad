export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCachedSession } from '@/lib/server-session';
import { REQUIRED_SCOPES, upsertLeaderboardPayload } from '@/lib/leaderboard/ingest';
import { supabaseAdmin } from '@/lib/supabaseServer';
import type { LeaderboardScope } from '@/types/leaderboard';
import { createSampleLeaderboardPayload } from './samplePayload';

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

interface ScopeSummary {
  scope: LeaderboardScope;
  count: number;
  lastPostedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

async function loadSummaries(): Promise<ScopeSummary[]> {
  const client = supabaseAdmin();

  const summaries = await Promise.all(
    REQUIRED_SCOPES.map(async (scope) => {
      const { data, count, error } = await client
        .from('leaderboards')
        .select('posted_at, period_start, period_end', { count: 'exact' })
        .eq('scope', scope)
        .order('posted_at', { ascending: false })
        .order('period_end', { ascending: false })
        .limit(1);

      if (error) {
        console.error('leaderboard admin: failed to load summary', { scope, error });
        throw error;
      }

      const latest = data?.[0] ?? null;

      return {
        scope,
        count: count ?? 0,
        lastPostedAt: latest?.posted_at ?? null,
        periodStart: latest?.period_start ?? null,
        periodEnd: latest?.period_end ?? null,
      } satisfies ScopeSummary;
    }),
  );

  return summaries;
}

async function simulateIngestAction() {
  'use server';

  if (process.env.NODE_ENV === 'production') {
    console.warn('leaderboard admin: simulate ingest attempted in production');
    redirect('/leaderboard/admin?error=simulation-disabled');
  }

  if (!process.env.LEADERBOARD_INGEST_SECRET) {
    console.warn('leaderboard admin: simulation failed because secret is missing');
    redirect('/leaderboard/admin?error=secret-missing');
  }

  const client = supabaseAdmin();
  const payload = createSampleLeaderboardPayload();

  try {
    const result = await upsertLeaderboardPayload(client, payload);
    console.info('leaderboard admin: simulation ingested payload', result);
    revalidatePath('/leaderboard/admin');
    redirect('/leaderboard/admin?simulated=1');
  } catch (error) {
    console.error('leaderboard admin: simulation failed', error);
    redirect('/leaderboard/admin?error=simulation-failed');
  }
}

export default async function LeaderboardAdminPage({ searchParams }: PageProps) {
  const session = await getCachedSession();
  if (!session?.user) redirect('/signin');
  if (!(session.user as any).telegram_linked) redirect('/link-telegram');

  const allowSimulation = process.env.NODE_ENV !== 'production';
  const summaries = await loadSummaries();
  const message = typeof searchParams?.simulated === 'string' ? 'Simulation payload ingested successfully.' : null;
  const error = typeof searchParams?.error === 'string' ? searchParams?.error : null;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leaderboard ingest admin</h1>
          <p className="text-sm text-muted-foreground">
            Review the latest stored leaderboard snapshots and trigger a local simulation.
          </p>
        </div>
        {allowSimulation ? (
          <form action={simulateIngestAction}>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-500"
            >
              Simulate ingest
            </button>
          </form>
        ) : null}
      </header>

      {message ? <p className="rounded border border-green-600 bg-green-50 p-3 text-sm text-green-700">{message}</p> : null}
      {error ? (
        <p className="rounded border border-red-600 bg-red-50 p-3 text-sm text-red-700">
          Simulation failed ({error}). Check server logs for details.
        </p>
      ) : null}

      <section>
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2">Scope</th>
              <th className="py-2">Entries stored</th>
              <th className="py-2">Last posted at</th>
              <th className="py-2">Period</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.scope} className="border-b border-border last:border-b-0">
                <td className="py-2 font-medium capitalize">{summary.scope}</td>
                <td className="py-2">{summary.count}</td>
                <td className="py-2 font-mono text-xs">
                  {summary.lastPostedAt ? summary.lastPostedAt : '—'}
                </td>
                <td className="py-2 font-mono text-xs">
                  {summary.periodStart && summary.periodEnd
                    ? `${summary.periodStart} → ${summary.periodEnd}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
