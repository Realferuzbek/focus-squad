"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  History,
  Sparkles,
} from "lucide-react";
import GlowPanel from "@/components/GlowPanel";
import {
  formatHistoryDetailLabel,
  formatHistoryPeriodLabel,
  formatMinutes,
  formatPeriodForCard,
  formatPostedLabel,
  formatSyncLabel,
  formatWithFallback,
} from "@/lib/leaderboard/format";
import {
  getTopEntryFromSnapshot,
  type LeaderboardHistoryByScope,
  type LeaderboardSnapshotRow,
} from "@/lib/leaderboard/history";
import type { LeaderboardSnapshot } from "@/lib/leaderboard/loadLatest";
import type { LeaderboardEntry, LeaderboardScope } from "@/types/leaderboard";

type CardSnapshot = {
  scope: LeaderboardScope;
  period_start: string;
  period_end: string;
  posted_at?: string;
  entries: LeaderboardEntry[];
};

type LeaderboardClientProps = {
  snapshots: Record<LeaderboardScope, LeaderboardSnapshot | null>;
  historyByScope: LeaderboardHistoryByScope;
  dataLoadedAt: string;
  loadError: boolean;
  backLabel: string;
};

type ScopeConfig = {
  label: string;
  tagline: string;
  accent: string;
  icon: string;
  subtle?: boolean;
};

const SCOPE_CONFIG: Record<LeaderboardScope, ScopeConfig> = {
  day: {
    label: "Daily Legends",
    tagline: "Today's hardest workers, tallied after the 21:30 check-in.",
    accent: "from-[#a855f7] via-[#6366f1] to-[#22d3ee]",
    icon: "☀️",
  },
  week: {
    label: "Weekly Marathoners",
    tagline: "Seven-day consistency club - every minute adds up.",
    accent: "from-[#22d3ee] via-[#2dd4bf] to-[#0ea5e9]",
    icon: "📅",
    subtle: true,
  },
  month: {
    label: "Monthly Champions",
    tagline: "Long-game legends keeping momentum all month long.",
    accent: "from-[#f97316] via-[#fb7185] to-[#a855f7]",
    icon: "🌙",
    subtle: true,
  },
};

const SCOPES: LeaderboardScope[] = ["day", "week", "month"];

function buildTelegramMessageLink(
  chatId: number | null | undefined,
  messageId: number | null | undefined,
) {
  if (!chatId || !messageId) return null;
  const chatSegment = String(chatId).startsWith("-100")
    ? String(chatId).slice(4)
    : String(Math.abs(chatId));
  return `https://t.me/c/${chatSegment}/${messageId}`;
}

function rankAccent(rank: number) {
  if (rank === 1)
    return "bg-[linear-gradient(135deg,#facc15,#f97316)] text-black shadow-[0_12px_30px_rgba(250,204,21,0.35)]";
  if (rank === 2)
    return "bg-[linear-gradient(135deg,#e5e7eb,#94a3b8)] text-black shadow-[0_12px_26px_rgba(148,163,184,0.35)]";
  if (rank === 3)
    return "bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] text-black shadow-[0_12px_26px_rgba(245,158,11,0.35)]";
  return "bg-white/10 text-white/90 border border-white/10";
}

function buildCardSnapshotsFromPayload(
  snapshot: LeaderboardSnapshotRow | null,
): Record<LeaderboardScope, CardSnapshot | null> {
  const empty: Record<LeaderboardScope, CardSnapshot | null> = {
    day: null,
    week: null,
    month: null,
  };
  if (!snapshot) {
    return empty;
  }

  const boards = Array.isArray(snapshot.payload?.boards)
    ? snapshot.payload.boards
    : [];

  boards.forEach((board) => {
    empty[board.scope] = {
      scope: board.scope,
      period_start: board.period_start,
      period_end: board.period_end,
      posted_at: snapshot.posted_at,
      entries: Array.isArray(board.entries) ? board.entries : [],
    };
  });

  if (boards.length === 0) {
    empty[snapshot.scope] = {
      scope: snapshot.scope,
      period_start: snapshot.period_start,
      period_end: snapshot.period_end,
      posted_at: snapshot.posted_at,
      entries: snapshot.entries,
    };
  }

  return empty;
}

function buildLiveCardSnapshots(
  snapshots: Record<LeaderboardScope, LeaderboardSnapshot | null>,
) {
  const mapped: Record<LeaderboardScope, CardSnapshot | null> = {
    day: null,
    week: null,
    month: null,
  };

  SCOPES.forEach((scope) => {
    const snapshot = snapshots[scope];
    if (!snapshot) return;
    mapped[scope] = {
      scope,
      period_start: snapshot.period_start,
      period_end: snapshot.period_end,
      posted_at: snapshot.posted_at,
      entries: snapshot.entries,
    };
  });

  return mapped;
}

type ScopeCardProps = {
  scope: LeaderboardScope;
  snapshot: CardSnapshot | null;
  badgeLabel: string;
};

type SnapshotEmptyStateProps = {
  icon: string;
  title: string;
  subtitle: string;
};

function SnapshotEmptyState({
  icon,
  title,
  subtitle,
}: SnapshotEmptyStateProps) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center text-sm text-white/60">
      <span className="text-2xl">{icon}</span>
      <p className="font-semibold text-white">{title}</p>
      <p className="text-xs text-white/45">{subtitle}</p>
    </div>
  );
}

function LeaderboardEntryRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <li className="group rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[0_18px_45px_rgba(8,7,21,0.35)] transition-transform transition-shadow duration-200 ease-out hover:-translate-y-[2px] hover:scale-[1.01] hover:shadow-[0_25px_55px_rgba(8,7,21,0.45)]">
      <div className="flex flex-col gap-3 md:grid md:grid-cols-[auto,1fr,auto] md:items-center md:gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold uppercase tracking-tight ${rankAccent(entry.rank)}`}
        >
          #{entry.rank}
        </div>

        <div className="min-w-0 space-y-1">
          <p
            className="truncate text-base font-semibold text-white"
            title={`@${entry.username}`}
          >
            @{entry.username}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            {entry.title ? (
              <span className="truncate" title={entry.title}>
                {entry.title}
              </span>
            ) : null}
            {entry.emojis.length > 0 ? (
              <span className="text-base leading-none">{entry.emojis.join(" ")}</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 text-right md:flex-col md:items-end md:justify-center md:gap-1">
          <span className="text-[11px] uppercase tracking-[0.3em] text-white/45">
            Minutes
          </span>
          <span
            className="text-lg font-semibold text-white"
            title={`${entry.minutes} minutes`}
          >
            {formatMinutes(entry.minutes)}
          </span>
        </div>
      </div>
    </li>
  );
}

function LiveScopeCard({ scope, snapshot, badgeLabel }: ScopeCardProps) {
  const config = SCOPE_CONFIG[scope];
  const iconClasses = [
    "grid h-12 w-12 place-items-center rounded-2xl border border-white/15 text-xl shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
    `bg-gradient-to-br ${config.accent}`,
  ].join(" ");

  const badgeClasses =
    badgeLabel === "LIVE"
      ? "border-emerald-400/35 bg-emerald-500/20 text-emerald-50 shadow-[0_8px_20px_rgba(16,185,129,0.25)]"
      : "border-white/15 bg-white/5 text-white/65";

  return (
    <GlowPanel
      subtle={config.subtle}
      className="flex h-full flex-col bg-gradient-to-br from-indigo-950/70 via-slate-950/65 to-black/80 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className={iconClasses}>{config.icon}</div>
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/45">
              {scope === "day" ? "Day" : scope === "week" ? "Week" : "Month"}
            </p>
            <h2 className="text-lg font-semibold text-white">{config.label}</h2>
          </div>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.35em] ${badgeClasses}`}
        >
          {badgeLabel}
        </span>
      </div>

      <p className="mt-3 text-sm text-white/65">{config.tagline}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">
            Period
          </p>
          <p className="mt-1 font-semibold leading-snug text-white">
            {snapshot
              ? formatPeriodForCard(scope, snapshot.period_start, snapshot.period_end)
              : "Awaiting first snapshot"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">
            Posted
          </p>
          <p className="mt-1 leading-snug text-white/75">
            {snapshot ? formatPostedLabel(snapshot.posted_at ?? null) : "Not published yet"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex-1 rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 via-white/5 to-white/0 p-3">
        {snapshot ? (
          snapshot.entries.length > 0 ? (
            <ol className="space-y-3">
              {snapshot.entries.map((entry) => (
                <LeaderboardEntryRow key={entry.rank} entry={entry} />
              ))}
            </ol>
          ) : (
            <SnapshotEmptyState
              icon="📂"
              title="No entries"
              subtitle="Snapshot stored without leaderboard entries."
            />
          )
        ) : (
          <SnapshotEmptyState
            icon="🕒"
            title="No snapshot stored for this period yet."
            subtitle="Snapshots appear automatically once the tracker posts to Telegram."
          />
        )}
      </div>

      <p className="mt-4 text-xs text-white/45">
        Synced from Study With Me tracker
      </p>
    </GlowPanel>
  );
}

export default function LeaderboardClient({
  snapshots,
  historyByScope,
  dataLoadedAt,
  loadError,
  backLabel,
}: LeaderboardClientProps) {
  const [activeTab, setActiveTab] = useState<"telegram" | "onsite">("telegram");
  const [historyOpen, setHistoryOpen] = useState(false);

  const liveSnapshots = useMemo(
    () => buildLiveCardSnapshots(snapshots),
    [snapshots],
  );

  const latestPostedAt = useMemo(() => {
    return SCOPES.reduce<string | null>((latest, scope) => {
      const current = snapshots[scope]?.posted_at ?? null;
      if (!current) return latest;
      if (!latest) return current;
      return new Date(current) > new Date(latest) ? current : latest;
    }, null);
  }, [snapshots]);

  const lastSyncLabel = formatSyncLabel(latestPostedAt);
  const dataLoadedAtDate = useMemo(() => new Date(dataLoadedAt), [dataLoadedAt]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-sm shadow-[0_12px_40px_rgba(8,7,21,0.35)]">
          <button
            type="button"
            className={`relative min-w-[140px] rounded-full px-5 py-2 font-semibold transition ${activeTab === "telegram" ? "bg-white text-black shadow-[0_15px_40px_rgba(255,255,255,0.2)]" : "text-white/70 hover:text-white"}`}
            aria-pressed={activeTab === "telegram"}
            onClick={() => setActiveTab("telegram")}
          >
            Telegram
          </button>
          <button
            type="button"
            className={`relative min-w-[140px] rounded-full px-5 py-2 font-semibold transition ${activeTab === "onsite" ? "bg-white text-black shadow-[0_15px_40px_rgba(255,255,255,0.2)]" : "text-white/70 hover:text-white"}`}
            aria-pressed={activeTab === "onsite"}
            onClick={() => setActiveTab("onsite")}
          >
            On-site
          </button>
        </div>
      </div>

      {activeTab === "telegram" ? (
        <>
          <header className="rounded-[32px] border border-white/10 bg-gradient-to-br from-[#1f1f33] via-[#121225] to-[#0a0a14] p-6 shadow-[0_25px_70px_rgba(104,67,255,0.25)]">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="text-xs uppercase tracking-[0.45em] text-fuchsia-300/70">
                  Focus Squad Leaderboard
                </span>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  Celebrate the focus legends
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-white/60">
                  The same rankings posted to Telegram every evening now live on
                  the dashboard. Check who is leading today, the past week, and
                  the full month - updated right after the 21:30 Asia/Tashkent
                  snapshot.
                </p>
              </div>

              <div className="flex items-stretch gap-3">
                <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70 shadow-[0_18px_40px_rgba(8,7,21,0.45)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="uppercase tracking-[0.35em] text-[10px] text-white/50">
                      Last sync
                    </span>
                    <span className="font-semibold text-white/80">
                      {lastSyncLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-white/50">
                    <span>Local time</span>
                    <time dateTime={dataLoadedAtDate.toISOString()}>
                      {formatWithFallback(dataLoadedAtDate)}
                    </time>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="group relative flex min-w-[120px] flex-col justify-center overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-r from-fuchsia-500/10 via-purple-500/10 to-cyan-400/10 px-4 py-3 text-sm text-white/85 shadow-[0_18px_50px_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 hover:border-white/30 hover:shadow-[0_24px_70px_rgba(124,58,237,0.25)]"
                >
                  <span className="pointer-events-none absolute inset-0 opacity-40 blur-xl bg-gradient-to-r from-white/10 via-fuchsia-200/15 to-cyan-200/10" />
                  <div className="relative flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold tracking-tight">
                      <History className="h-4 w-4 text-fuchsia-200/90 transition group-hover:scale-105" />
                      History
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.28em] text-white/70 shadow-[0_10px_30px_rgba(124,58,237,0.25)]">
                      New
                    </span>
                  </div>
                  <p className="relative mt-1 text-xs text-white/60">
                    Browse past snapshots
                  </p>
                </button>
              </div>
            </div>
          </header>

          <section className="grid gap-6 md:grid-cols-3">
            {SCOPES.map((scope) => (
              <LiveScopeCard
                key={scope}
                scope={scope}
                snapshot={liveSnapshots[scope]}
                badgeLabel={liveSnapshots[scope] ? "LIVE" : "AWAITING"}
              />
            ))}
          </section>

          {loadError ? (
            <p className="rounded-2xl border border-yellow-600/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
              Live leaderboard data is temporarily unavailable. We will refresh
              automatically once the tracker exports again.
            </p>
          ) : null}

          <footer className="pb-10 text-center text-sm text-white/60">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-white/70 underline-offset-4 transition hover:text-white hover:underline"
            >
              <span>←</span>
              {backLabel}
            </Link>
          </footer>
        </>
      ) : (
        <GlowPanel className="rounded-[32px] border border-white/10 bg-gradient-to-br from-[#1a1a2a] via-[#0d0d18] to-[#05050c] p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-white/60">
                Coming soon
              </span>
              <h2 className="mt-4 text-2xl font-semibold text-white">
                Studywithferuzbek Live Leaderboard
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-white/65">
                Real-time rankings based on focus sessions you start on this
                site. Track streaks, battle for the top spots, and watch your
                progress update instantly.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 shadow-[0_18px_40px_rgba(8,7,21,0.45)]">
              <Sparkles className="h-5 w-5 text-fuchsia-200" />
              <div className="flex flex-col">
                <span className="font-semibold text-white">Live telemetry</span>
                <span className="text-xs text-white/60">
                  Powered by on-site focus sessions
                </span>
              </div>
            </div>
          </div>
        </GlowPanel>
      )}

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        historyByScope={historyByScope}
      />
    </main>
  );
}

function ScopeCard({ scope, snapshot, badgeLabel }: ScopeCardProps) {
  const config = SCOPE_CONFIG[scope];

  const badgeClasses =
    badgeLabel === "SNAPSHOT"
      ? "border-emerald-300/50 bg-emerald-400/20 text-emerald-50 shadow-[0_10px_30px_rgba(16,185,129,0.3)]"
      : "border-white/20 bg-white/10 text-white/65";

  const scopeLabel = scope === "day" ? "Day" : scope === "week" ? "Week" : "Month";

  const SnapshotEntryRow = ({ entry }: { entry: LeaderboardEntry }) => (
    <li className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white transition duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold uppercase tracking-tight ${rankAccent(entry.rank)}`}
      >
        #{entry.rank}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-semibold">@{entry.username}</p>
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-white/60">
          {entry.title ? (
            <span className="truncate" title={entry.title}>
              {entry.title}
            </span>
          ) : null}
          {entry.emojis.length > 0 ? (
            <span className="text-base leading-none">{entry.emojis.join(" ")}</span>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] uppercase tracking-[0.26em] text-white/45">Minutes</p>
        <p className="font-semibold text-white">{formatMinutes(entry.minutes)}</p>
      </div>
    </li>
  );

  return (
    <div className="relative h-full overflow-hidden rounded-[24px] border border-white/15 bg-gradient-to-br from-[#0f1122]/85 via-[#0a0d18]/82 to-[#05060f]/90 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur">
      <div
        className={`pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl ${`bg-gradient-to-br ${config.accent}`}`}
      />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-white/10 via-white/30 to-white/10" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`grid h-12 w-12 place-items-center rounded-2xl border border-white/15 text-xl shadow-[0_14px_36px_rgba(0,0,0,0.35)] bg-gradient-to-br ${config.accent}`}
          >
            {config.icon}
          </div>
          <div className="space-y-1 leading-tight">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.32em] text-white/70">
                Snapshot
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.32em] text-white/80">
                {scopeLabel}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-white">{config.label}</h2>
            <p className="text-xs text-white/60">{config.tagline}</p>
          </div>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.35em] ${badgeClasses}`}
        >
          {badgeLabel}
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Period</p>
          <p className="mt-1 font-semibold leading-snug text-white">
            {snapshot
              ? formatPeriodForCard(scope, snapshot.period_start, snapshot.period_end)
              : "Awaiting first snapshot"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Posted</p>
          <p className="mt-1 leading-snug text-white/80">
            {snapshot ? formatPostedLabel(snapshot.posted_at ?? null) : "Not published yet"}
          </p>
        </div>
      </div>

      <div className="relative mt-4 rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
        {snapshot ? (
          snapshot.entries.length > 0 ? (
            <ol className="space-y-2.5">
              {snapshot.entries.map((entry) => (
                <SnapshotEntryRow key={entry.rank} entry={entry} />
              ))}
            </ol>
          ) : (
            <div className="flex min-h-[170px] flex-col items-center justify-center gap-3 text-center text-sm text-white/60">
              <span className="text-2xl">📂</span>
              <p className="font-semibold text-white">No entries</p>
              <p className="text-xs text-white/45">
                No entries recorded for this snapshot.
              </p>
            </div>
          )
        ) : (
          <div className="flex min-h-[170px] flex-col items-center justify-center gap-3 text-center text-sm text-white/60">
            <span className="text-2xl">🕒</span>
            <p className="font-semibold text-white">No snapshot stored for this period yet.</p>
            <p className="text-xs text-white/45">
              Snapshots appear automatically once the tracker posts to Telegram.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 text-[11px] uppercase tracking-[0.3em] text-white/40">
        Synced from Study With Me tracker
      </div>
    </div>
  );
}

type HistoryDrawerProps = {
  open: boolean;
  onClose: () => void;
  historyByScope: LeaderboardHistoryByScope;
};

function HistoryDrawer({ open, onClose, historyByScope }: HistoryDrawerProps) {
  const [scope, setScope] = useState<LeaderboardScope>("day");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    historyByScope.day?.[0]?.id ?? null,
  );
  const [mobileDetail, setMobileDetail] = useState(false);

  useEffect(() => {
    if (!open) {
      setMobileDetail(false);
    }
  }, [open]);

  useEffect(() => {
    const first = historyByScope[scope]?.[0];
    setSelectedSnapshotId(first?.id ?? null);
    setMobileDetail(false);
  }, [scope, historyByScope]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const selectedSnapshot =
    historyByScope[scope]?.find((snap) => snap.id === selectedSnapshotId) ??
    historyByScope[scope]?.[0] ??
    null;

  const snapshotBoards = useMemo(() => {
    return buildCardSnapshotsFromPayload(selectedSnapshot);
  }, [selectedSnapshot]);

  const historyList = historyByScope[scope] ?? [];

  if (!open) return null;

  const secondaryLine = (snapshot: LeaderboardSnapshotRow) => {
    const topEntryFromPayload = getTopEntryFromSnapshot(
      snapshot.payload,
      scope,
    );
    const topEntry =
      topEntryFromPayload ||
      (snapshot.entries.length > 0
        ? [...snapshot.entries].sort((a, b) => a.rank - b.rank)[0]
        : null);
    if (!topEntry) return "No entries";
    const username = topEntry.username.startsWith("@")
      ? topEntry.username.slice(1)
      : topEntry.username;
    return `#1 @${username} \u00b7 ${formatMinutes(topEntry.minutes)}`;
  };

  const handleSelectSnapshot = (id: string) => {
    setSelectedSnapshotId(id);
    setMobileDetail(true);
  };

  return (
    <div className="fixed inset-0 z-40 overflow-hidden overscroll-none">
      <div
        className="absolute inset-0 bg-[#04030c]/70 backdrop-blur-2xl transition duration-200"
        onClick={onClose}
      />
      <div className="relative z-50 flex h-full w-full overflow-hidden items-center justify-center px-3 py-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
          className="relative flex h-full min-h-0 w-full max-h-[calc(100vh-2rem)] max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#0b0c1a]/92 via-[#060712]/93 to-[#04040c]/96 text-white shadow-[0_35px_120px_rgba(0,0,0,0.6)]"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-fuchsia-300/40 via-white/30 to-cyan-300/40" />
          <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.38em] text-white/55">
                  History
                </p>
                <h2 className="bg-gradient-to-r from-white via-fuchsia-100 to-cyan-100 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
                  Leaderboard history
                </h2>
                <p className="max-w-2xl text-sm text-white/65">
                  Browse past Telegram snapshots by scope.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-white/55">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/65">
                  Choose scope
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/65">
                  {scope === "day" ? "Day" : scope === "week" ? "Week" : "Month"} view
                </span>
              </div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 shadow-[0_12px_45px_rgba(8,7,21,0.45)]">
                {SCOPES.map((scopeOption) => (
                  <button
                    key={scopeOption}
                    type="button"
                    onClick={() => setScope(scopeOption)}
                    className={`relative min-w-[96px] overflow-hidden rounded-full px-4 py-2 text-sm font-semibold transition duration-200 ${
                      scopeOption === scope
                        ? "bg-gradient-to-r from-fuchsia-500/80 via-purple-500/80 to-cyan-400/80 text-white shadow-[0_15px_45px_rgba(124,58,237,0.35)]"
                        : "text-white/70 hover:text-white"
                    }`}
                    aria-pressed={scopeOption === scope}
                  >
                    <span className="relative z-10">
                      {scopeOption === "day"
                        ? "Day"
                        : scopeOption === "week"
                          ? "Week"
                          : "Month"}
                    </span>
                    {scopeOption === scope ? (
                      <span className="absolute inset-0 z-0 opacity-60 blur-lg bg-gradient-to-r from-white/70 via-fuchsia-200/60 to-cyan-200/60" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col md:flex-row md:divide-x md:divide-white/10">
            <div
              className={`relative flex min-h-0 w-full flex-col bg-transparent md:w-[38%] md:min-w-[320px] md:max-w-[400px] ${mobileDetail ? "hidden md:flex" : "flex"}`}
            >
              <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 md:pt-6">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-white/55">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                    Timeline
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                    {scope === "day" ? "Day" : scope === "week" ? "Week" : "Month"}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden min-h-0">
                <div className="h-full space-y-3 overflow-y-auto overscroll-contain px-5 pb-6 hide-scrollbar">
                  {historyList.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 text-2xl shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                        📂
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-white">No snapshots stored yet.</p>
                        <p className="text-xs text-white/45">
                          Once the tracker posts to Telegram, snapshots will appear here.
                        </p>
                      </div>
                    </div>
                  ) : (
                    historyList.map((snapshot) => {
                      const selected = snapshot.id === selectedSnapshot?.id;
                      const telegramUrl = buildTelegramMessageLink(
                        snapshot.chat_id,
                        snapshot.message_id,
                      );
                      return (
                        <button
                          key={snapshot.id}
                          type="button"
                          onClick={() => handleSelectSnapshot(snapshot.id)}
                          className={`group relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition duration-200 ${
                            selected
                              ? "border-fuchsia-300/50 bg-gradient-to-br from-white/10 via-white/5 to-transparent shadow-[0_25px_70px_rgba(124,58,237,0.25)] ring-2 ring-fuchsia-300/35"
                              : "border-white/10 bg-white/0 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/5 hover:shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
                          }`}
                        >
                          <div
                            className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${selected ? "from-fuchsia-400 via-purple-400 to-cyan-300" : "from-white/10 via-white/5 to-transparent"}`}
                          />
                          <div className="relative flex items-start gap-3">
                            <div className="flex-1 space-y-1.5">
                              <p className="text-sm font-semibold text-white">
                                {formatHistoryPeriodLabel(
                                  scope,
                                  snapshot.period_start,
                                  snapshot.period_end,
                                )}
                              </p>
                              <p className="text-xs text-white/60">
                                {secondaryLine(snapshot)}
                              </p>
                              {telegramUrl ? (
                                <a
                                  href={telegramUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="group/link inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-100 transition hover:border-fuchsia-200/60 hover:bg-fuchsia-500/10 hover:text-white"
                                >
                                  <span>Open in Telegram</span>
                                  <ChevronRight className="h-3 w-3 transition group-hover/link:translate-x-0.5" />
                                </a>
                              ) : (
                                <span className="inline-flex text-[11px] text-white/50">
                                  No Telegram message (backfill only)
                                </span>
                              )}
                            </div>
                            <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition group-hover:border-white/25 group-hover:text-white/80">
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div
              className={`relative flex min-h-0 flex-1 flex-col ${mobileDetail ? "flex" : "hidden md:flex"}`}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/65">
                    Snapshot
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/70">
                    {scope === "day" ? "Day" : scope === "week" ? "Week" : "Month"}
                  </span>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/75 transition hover:border-white/30 hover:text-white md:hidden"
                  onClick={() => setMobileDetail(false)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>

              <div className="flex-1 overflow-hidden min-h-0">
                {selectedSnapshot ? (
                  <div className="h-full overflow-y-auto overscroll-contain px-5 pb-6 pt-4 hide-scrollbar">
                    <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.32em] text-white/50">
                          Period
                        </p>
                        <p className="text-lg font-semibold text-white">
                          {formatHistoryDetailLabel(
                            scope,
                            selectedSnapshot.period_start,
                            selectedSnapshot.period_end,
                          )}
                        </p>
                      </div>
                      <div className="space-y-1 sm:text-right">
                        <p className="text-[11px] uppercase tracking-[0.32em] text-white/50">
                          Posted
                        </p>
                        <p className="text-sm text-white/75">
                          {formatPostedLabel(selectedSnapshot.posted_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {SCOPES.map((scopeKey) => (
                        <ScopeCard
                          key={scopeKey}
                          scope={scopeKey}
                          snapshot={snapshotBoards[scopeKey]}
                          badgeLabel={snapshotBoards[scopeKey] ? "SNAPSHOT" : "MISSING"}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center text-sm text-white/60">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-2xl shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
                      🗂️
                    </div>
                    <p className="font-semibold text-white">
                      Select a snapshot on the left to view details.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/5 px-5 py-3 text-xs text-white/55">
            <p>Synced from Study With Me tracker</p>
            <p className="text-white/35">
              Oldest snapshots may be pruned automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
