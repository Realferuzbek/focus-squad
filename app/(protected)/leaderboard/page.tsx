export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import GlowPanel from '@/components/GlowPanel';
import { auth } from '@/lib/auth';
import { loadLatestLeaderboards, type LeaderboardSnapshot } from '@/lib/leaderboard/loadLatest';
import type { LeaderboardScope } from '@/types/leaderboard';

type ScopeConfig = {
  label: string;
  tagline: string;
  accent: string;
  icon: string;
  subtle?: boolean;
};

const SCOPE_CONFIG: Record<LeaderboardScope, ScopeConfig> = {
  day: {
    label: 'Daily Legends',
    tagline: "Today's hardest workers, tallied after the 21:30 check-in.",
    accent: 'from-[#a855f7] via-[#6366f1] to-[#22d3ee]',
    icon: '☀️',
  },
  week: {
    label: 'Weekly Marathoners',
    tagline: 'Seven-day consistency club - every minute adds up.',
    accent: 'from-[#22d3ee] via-[#2dd4bf] to-[#0ea5e9]',
    icon: '📅',
    subtle: true,
  },
  month: {
    label: 'Monthly Champions',
    tagline: 'Long-game legends keeping momentum all month long.',
    accent: 'from-[#f97316] via-[#fb7185] to-[#a855f7]',
    icon: '🌙',
    subtle: true,
  },
};

function buildFormatter(options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat('en-US', options);
  } catch (error) {
    console.warn('leaderboard: failed to build formatter', { options, error });
    return null;
  }
}

const postedFormatter = buildFormatter({
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tashkent',
});

const periodFormatter = buildFormatter({
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const monthFormatter = buildFormatter({
  month: 'long',
  year: 'numeric',
});

const weekdayFormatter = buildFormatter({
  weekday: 'short',
});

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function formatPeriod(scope: LeaderboardScope, snapshot: LeaderboardSnapshot | null) {
  if (!snapshot) return 'Awaiting first snapshot';
  const start = new Date(`${snapshot.period_start}T00:00:00Z`);
  const end = new Date(`${snapshot.period_end}T00:00:00Z`);

  if (scope === 'day') {
    const weekday = weekdayFormatter?.format(start);
    const dateLabel = periodFormatter?.format(start) ?? snapshot.period_start;
    return weekday ? `${dateLabel} | ${weekday}` : dateLabel;
  }

  if (scope === 'week') {
    const startLabel = periodFormatter?.format(start) ?? snapshot.period_start;
    const endLabel = periodFormatter?.format(end) ?? snapshot.period_end;
    return `${startLabel} -> ${endLabel}`;
  }

  return monthFormatter?.format(start) ?? snapshot.period_start;
}

function formatPostedAt(snapshot: LeaderboardSnapshot | null) {
  if (!snapshot) return 'Not published yet';
  const date = new Date(snapshot.posted_at);
  if (Number.isNaN(date.getTime())) {
    return snapshot.posted_at;
  }
  const formatted = postedFormatter?.format(date) ?? date.toISOString();
  return `${formatted} - Asia/Tashkent`;
}

function formatSyncLabel(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return postedFormatter?.format(date) ?? date.toISOString();
}

function rankAccent(rank: number) {
  if (rank === 1) return 'bg-[linear-gradient(135deg,#facc15,#f97316)] text-black shadow-[0_12px_30px_rgba(250,204,21,0.35)]';
  if (rank === 2) return 'bg-[linear-gradient(135deg,#e5e7eb,#94a3b8)] text-black shadow-[0_12px_26px_rgba(148,163,184,0.35)]';
  if (rank === 3) return 'bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] text-black shadow-[0_12px_26px_rgba(245,158,11,0.35)]';
  return 'bg-white/10 text-white/90 border border-white/10';
}

const EMPTY_SNAPSHOTS: Record<LeaderboardScope, LeaderboardSnapshot | null> = {
  day: null,
  week: null,
  month: null,
};

export default async function LeaderboardPage() {
  const session = await auth();
  const viewer = session?.user as any;
  const avatarSrc = viewer?.avatar_url ?? viewer?.image ?? null;

  let snapshots = EMPTY_SNAPSHOTS;
  let loadError: unknown = null;
  try {
    snapshots = await loadLatestLeaderboards();
  } catch (error) {
    console.error('leaderboard: failed to load snapshots', error);
    loadError = error;
  }
  const dataLoadedAt = new Date();

  const scopes: LeaderboardScope[] = ['day', 'week', 'month'];

  const latestPostedAt = scopes.reduce<string | null>((latest, scope) => {
    const current = snapshots[scope]?.posted_at ?? null;
    if (!current) return latest;
    if (!latest) return current;
    return new Date(current) > new Date(latest) ? current : latest;
  }, null);

  const lastSyncLabel =
    latestPostedAt !== null ? formatSyncLabel(latestPostedAt) : 'No snapshots yet';

  return (
    <div className="min-h-[100dvh] bg-[#07070b] text-white">
      <Navbar isAdmin={!!viewer?.is_admin} avatarUrl={avatarSrc} />

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
        <header className="rounded-[32px] border border-white/10 bg-gradient-to-br from-[#1f1f33] via-[#121225] to-[#0a0a14] p-6 shadow-[0_25px_70px_rgba(104,67,255,0.25)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="text-xs uppercase tracking-[0.45em] text-fuchsia-300/70">Focus Squad Leaderboard</span>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Celebrate the focus legends</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/60">
                The same rankings posted to Telegram every evening now live on the dashboard.
                Check who is leading today, the past week, and the full month - updated right after the 21:30 Asia/Tashkent snapshot.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">
              <div className="flex items-center justify-between gap-3">
                <span className="uppercase tracking-[0.35em] text-[10px] text-white/50">Last sync</span>
                <span className="font-semibold text-white/80">{lastSyncLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-white/50">
                <span>Local time</span>
                <time dateTime={dataLoadedAt.toISOString()}>
                  {postedFormatter.format(dataLoadedAt)}
                </time>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {scopes.map((scope) => {
            const config = SCOPE_CONFIG[scope];
            const snapshot = snapshots[scope] ?? null;
            const iconClasses = [
              'grid h-12 w-12 place-items-center rounded-2xl border border-white/15 text-2xl shadow-[0_12px_32px_rgba(0,0,0,0.35)]',
              `bg-gradient-to-br ${config.accent}`,
            ].join(' ');

            return (
              <GlowPanel key={scope} subtle={config.subtle} className="bg-gradient-to-br from-[#111122] via-[#0a0a16] to-[#03030a]/95">
                <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-5">
                  <div className="flex items-center gap-3">
                    <div className={iconClasses}>
                      {config.icon}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white/90">{config.label}</h2>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/40">{scope}</p>
                    </div>
                  </div>
                  <span className={`rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/55`}>
                    {snapshot ? 'Live' : 'Awaiting'}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <p className="text-sm text-white/65">{config.tagline}</p>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Period</p>
                  <p className="text-sm font-medium text-white/80">{formatPeriod(scope, snapshot)}</p>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Posted</p>
                  <p className="text-sm text-white/75">{formatPostedAt(snapshot)}</p>
                </div>

                <div className="mt-6 rounded-2xl border border-white/5 bg-black/30 p-4">
                  {snapshot && snapshot.entries.length > 0 ? (
                    <ol className="space-y-3">
                      {snapshot.entries.map((entry) => (
                        <li
                          key={entry.rank}
                          className="grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3 pr-4 text-sm text-white shadow-[0_18px_40px_rgba(8,7,21,0.45)]"
                        >
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold ${rankAccent(entry.rank)}`}
                          >
                            #{entry.rank}
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">@{entry.username}</span>
                              {entry.title ? (
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-[0.25em] text-white/60">
                                  {entry.title}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-white/60">
                              <span className="font-mono text-sm text-white/80">{formatMinutes(entry.minutes)}</span>
                              {entry.emojis.length > 0 ? (
                                <span className="text-base leading-none">{entry.emojis.join(' ')}</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/40">Minutes</p>
                            <p className="font-semibold text-white/80">{entry.minutes}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 text-center text-sm text-white/55">
                      <span className="text-2xl">🕒</span>
                      <p>No snapshot stored for this period yet.</p>
                      <p className="text-xs text-white/35">
                        Snapshots appear automatically once the tracker posts to Telegram.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 text-xs text-white/45">Synced from Study With Me tracker</div>
              </GlowPanel>
            );
          })}
        </section>

        {loadError ? (
          <p className="rounded-2xl border border-yellow-600/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
            Live leaderboard data is temporarily unavailable. We will refresh automatically once the tracker exports again.
          </p>
        ) : null}

        <footer className="pb-10 text-center text-sm text-white/60">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/70 underline-offset-4 transition hover:text-white hover:underline"
          >
            <span>←</span>
            Back to dashboard
          </Link>
        </footer>
      </main>
    </div>
  );
}
