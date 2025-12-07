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
                  className="group flex min-w-[110px] flex-col justify-center rounded-3xl border border-white/10 bg-white/5 px-4 text-sm text-white/80 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <History className="h-4 w-4 text-fuchsia-200/90 transition group-hover:scale-105" />
                      History
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.28em] text-white/60">
                      New
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/50">
                    Browse past snapshots
                  </p>
                </button>
              </div>
            </div>
          </header>

          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {SCOPES.map((scope) => (
              <ScopeCard
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

type ScopeCardProps = {
  scope: LeaderboardScope;
  snapshot: CardSnapshot | null;
  badgeLabel: string;
};

function ScopeCard({ scope, snapshot, badgeLabel }: ScopeCardProps) {
  const config = SCOPE_CONFIG[scope];
  const iconClasses = [
    "grid h-12 w-12 place-items-center rounded-2xl border border-white/15 text-2xl shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
    `bg-gradient-to-br ${config.accent}`,
  ].join(" ");

  const badgeClasses =
    badgeLabel === "LIVE"
      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-50"
      : "border-white/15 bg-white/5 text-white/65";

  return (
    <GlowPanel
      subtle={config.subtle}
      className="bg-gradient-to-br from-[#111122] via-[#0a0a16] to-[#03030a]/95"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-5">
        <div className="flex items-center gap-3">
          <div className={iconClasses}>{config.icon}</div>
          <div>
            <h2 className="text-xl font-semibold text-white/90">
              {config.label}
            </h2>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">
              {scope}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.35em] ${badgeClasses}`}
        >
          {badgeLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <p className="text-sm text-white/65">{config.tagline}</p>
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">
          Period
        </p>
        <p className="text-sm font-medium text-white/80">
          {snapshot
            ? formatPeriodForCard(scope, snapshot.period_start, snapshot.period_end)
            : "Awaiting first snapshot"}
        </p>
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">
          Posted
        </p>
        <p className="text-sm text-white/75">
          {snapshot ? formatPostedLabel(snapshot.posted_at ?? null) : "Not published yet"}
        </p>
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
                    <span className="font-semibold text-white">
                      @{entry.username}
                    </span>
                    {entry.title ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-[0.25em] text-white/60">
                        {entry.title}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span className="font-mono text-sm text-white/80">
                      {formatMinutes(entry.minutes)}
                    </span>
                    {entry.emojis.length > 0 ? (
                      <span className="text-base leading-none">
                        {entry.emojis.join(" ")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                    Minutes
                  </p>
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

      <div className="mt-6 text-xs text-white/45">
        Synced from Study With Me tracker
      </div>
    </GlowPanel>
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
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-full max-w-6xl flex-col border-l border-white/10 bg-[#0a0a12] text-white shadow-[0_25px_60px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/45">
              History
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Leaderboard history</h2>
            <p className="text-sm text-white/60">
              Browse past Telegram snapshots by scope.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="flex flex-1 flex-col md:flex-row">
          <div
            className={`flex w-full flex-col border-b border-white/10 md:w-[40%] md:border-b-0 md:border-r ${mobileDetail ? "hidden md:flex" : "flex"}`}
          >
            <div className="flex gap-2 border-b border-white/10 px-6 py-4">
              {SCOPES.map((scopeOption) => (
                <button
                  key={scopeOption}
                  type="button"
                  onClick={() => setScope(scopeOption)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    scopeOption === scope
                      ? "bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.2)]"
                      : "border border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                  }`}
                  aria-pressed={scopeOption === scope}
                >
                  {scopeOption === "day"
                    ? "Day"
                    : scopeOption === "week"
                      ? "Week"
                      : "Month"}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
              {historyList.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-white/50">
                  <span className="text-2xl">📂</span>
                  <p>No snapshots stored yet.</p>
                  <p className="text-xs text-white/35">
                    Once the tracker posts to Telegram, snapshots will appear
                    here.
                  </p>
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
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selected
                          ? "border-white/30 bg-white/5 shadow-[0_15px_40px_rgba(8,7,21,0.35)]"
                          : "border-white/10 bg-white/0 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">
                            {formatHistoryPeriodLabel(
                              scope,
                              snapshot.period_start,
                              snapshot.period_end,
                            )}
                          </p>
                          <p className="mt-1 text-xs text-white/60">
                            {secondaryLine(snapshot)}
                          </p>
                          {telegramUrl ? (
                            <a
                              href={telegramUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] text-fuchsia-100 underline underline-offset-4"
                            >
                              Open in Telegram
                            </a>
                          ) : (
                            <span className="mt-1 inline-block text-[11px] text-white/45">
                              No Telegram message (backfill only)
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-white/50" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div
            className={`flex flex-1 flex-col overflow-y-auto ${mobileDetail ? "flex" : "hidden md:flex"}`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/65">
                  Snapshot
                </span>
                <span className="text-xs uppercase tracking-[0.35em] text-white/40">
                  {scope}
                </span>
              </div>
              <button
                type="button"
                className="md:hidden inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm text-white/70"
                onClick={() => setMobileDetail(false)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>

            {selectedSnapshot ? (
              <>
                <div className="border-b border-white/10 px-6 py-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">
                    Period
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {formatHistoryDetailLabel(
                      scope,
                      selectedSnapshot.period_start,
                      selectedSnapshot.period_end,
                    )}
                  </p>
                  <p className="text-sm text-white/60">
                    {formatPostedLabel(selectedSnapshot.posted_at)}
                  </p>
                </div>

                <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-3">
                  {SCOPES.map((scopeKey) => (
                    <ScopeCard
                      key={scopeKey}
                      scope={scopeKey}
                      snapshot={snapshotBoards[scopeKey]}
                      badgeLabel={
                        snapshotBoards[scopeKey] ? "SNAPSHOT" : "MISSING"
                      }
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/55">
                <span className="text-2xl">🗂️</span>
                <p>Select a snapshot on the left to view details.</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 px-6 py-3 text-xs text-white/50">
          <p>Synced from Study With Me tracker</p>
          <p className="text-white/35">
            Oldest snapshots may be pruned automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
