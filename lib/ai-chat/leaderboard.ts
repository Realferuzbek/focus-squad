import type { SupportedLanguage } from "@/lib/ai-chat/language";
import {
  getLeaderboardMissingDateResponse,
  getLeaderboardMissingRankResponse,
  getLeaderboardNotFoundResponse,
  getLeaderboardScopeLabel,
} from "@/lib/ai-chat/messages";
import { supabaseAdmin } from "@/lib/supabaseServer";
import type { LeaderboardEntry, LeaderboardScope } from "@/types/leaderboard";

type LeaderboardSnapshot = {
  scope: LeaderboardScope;
  period_start: string;
  period_end: string;
  posted_at: string | null;
  entries: LeaderboardEntry[];
};

export type LeaderboardToolResult = {
  handled: boolean;
  text?: string;
  metadata?: Record<string, unknown>;
};

const DATE_PATTERN = /\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/;
const LEADERBOARD_KEYWORD = /\b(leaderboard|ranking|rank)\b/i;
const PLACE_KEYWORD = /\bplace\b/i;
const ORDINAL_NUMBER = /\b(\d{1,2})(st|nd|rd|th)\b/i;
const RANK_WORDS = new Map<string, number>([
  ["first", 1],
  ["second", 2],
  ["third", 3],
  ["fourth", 4],
  ["fifth", 5],
  ["sixth", 6],
  ["seventh", 7],
  ["eighth", 8],
  ["ninth", 9],
  ["tenth", 10],
]);

const SCOPE_MATCHERS: Record<LeaderboardScope, RegExp> = {
  day: /\b(daily|day)\b/i,
  week: /\b(weekly|week)\b/i,
  month: /\b(monthly|month)\b/i,
};

const ALL_SCOPES: LeaderboardScope[] = ["day", "week", "month"];

export async function maybeHandleLeaderboardQuestion(params: {
  input: string;
  language: SupportedLanguage;
}): Promise<LeaderboardToolResult> {
  const normalized = params.input.toLowerCase();
  if (!isLeaderboardIntent(normalized)) {
    return { handled: false };
  }

  const date = parseDate(normalized);
  if (!date) {
    return {
      handled: true,
      text: getLeaderboardMissingDateResponse(params.language),
      metadata: { reason: "leaderboard_missing_date" },
    };
  }

  const scope = parseScope(normalized);
  const rank = parseRank(normalized);

  if (!rank) {
    return {
      handled: true,
      text: getLeaderboardMissingRankResponse(params.language),
      metadata: {
        reason: "leaderboard_missing_rank",
        date,
        scope: scope ?? "all",
      },
    };
  }

  const scopes = scope ? [scope] : ALL_SCOPES;

  let snapshots: Array<LeaderboardSnapshot | null> = [];
  try {
    snapshots = await Promise.all(
      scopes.map((scopeKey) => fetchSnapshot(scopeKey, date)),
    );
  } catch (error) {
    console.error("[ai-chat] leaderboard lookup failed", error);
    return {
      handled: true,
      text: getLeaderboardNotFoundResponse(params.language),
      metadata: {
        reason: "leaderboard_error",
        date,
        scope: scope ?? "all",
        rank,
      },
    };
  }

  const available = snapshots.filter(Boolean) as LeaderboardSnapshot[];
  if (!available.length) {
    return {
      handled: true,
      text: getLeaderboardNotFoundResponse(params.language),
      metadata: {
        reason: "leaderboard_not_found",
        date,
        scope: scope ?? "all",
        rank,
      },
    };
  }

  const lines = available
    .map((snapshot) =>
      formatSnapshotLine(snapshot, rank, params.language, date),
    )
    .filter(Boolean);
  const reply = lines.join("\n");

  return {
    handled: true,
    text: reply,
    metadata: {
      reason: "leaderboard",
      date,
      scope: scope ?? "all",
      rank,
      foundScopes: available.map((snap) => snap.scope),
    },
  };
}

function isLeaderboardIntent(input: string) {
  if (LEADERBOARD_KEYWORD.test(input)) return true;
  if (!PLACE_KEYWORD.test(input)) return false;
  return ORDINAL_NUMBER.test(input) || hasRankWord(input);
}

function parseDate(input: string): string | null {
  const match = DATE_PATTERN.exec(input);
  if (!match) return null;
  const value = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return value;
}

function parseScope(input: string): LeaderboardScope | null {
  for (const [scope, matcher] of Object.entries(SCOPE_MATCHERS)) {
    if (matcher.test(input)) return scope as LeaderboardScope;
  }
  return null;
}

function parseRank(input: string): number | null {
  const ordinalMatch = ORDINAL_NUMBER.exec(input);
  if (ordinalMatch?.[1]) {
    return clampRank(Number.parseInt(ordinalMatch[1], 10));
  }

  const numberMatch = /\b(?:rank|place|position)\s*(\d{1,2})\b/i.exec(
    input,
  );
  if (numberMatch?.[1]) {
    return clampRank(Number.parseInt(numberMatch[1], 10));
  }

  const wordMatch = /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/i.exec(
    input,
  );
  if (wordMatch?.[1]) {
    return clampRank(RANK_WORDS.get(wordMatch[1].toLowerCase()) ?? 0);
  }

  return null;
}

function clampRank(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(value, 100);
}

async function fetchSnapshot(
  scope: LeaderboardScope,
  date: string,
): Promise<LeaderboardSnapshot | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("leaderboards")
    .select("scope, period_start, period_end, posted_at, entries")
    .eq("scope", scope)
    .lte("period_start", date)
    .gte("period_end", date)
    .order("posted_at", { ascending: false })
    .order("period_end", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const row = data?.[0];
  if (!row) return null;

  const entries = Array.isArray(row.entries)
    ? (row.entries as LeaderboardEntry[])
    : [];

  return {
    scope: row.scope as LeaderboardScope,
    period_start: String(row.period_start ?? ""),
    period_end: String(row.period_end ?? ""),
    posted_at: row.posted_at ? String(row.posted_at) : null,
    entries,
  };
}

function formatSnapshotLine(
  snapshot: LeaderboardSnapshot,
  rank: number,
  language: SupportedLanguage,
  fallbackDate: string,
) {
  const label = getLeaderboardScopeLabel(snapshot.scope, language);
  const period = formatPeriod(snapshot, fallbackDate);
  const entry = findEntry(snapshot.entries, rank);
  if (!entry) {
    return `${label} (${period}): no entry recorded for #${rank}.`;
  }
  const username = formatUsername(entry.username);
  const minutes = Number.isFinite(entry.minutes)
    ? Math.round(entry.minutes)
    : entry.minutes;
  return `${label} (${period}): #${rank} ${username} with ${minutes} minutes.`;
}

function formatPeriod(snapshot: LeaderboardSnapshot, fallback: string) {
  const start = normalizeDate(snapshot.period_start);
  const end = normalizeDate(snapshot.period_end);
  if (start && end && start !== end) return `${start} to ${end}`;
  return start || end || fallback;
}

function normalizeDate(value: string) {
  if (!value) return "";
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
  return match ? match[0] : value;
}

function findEntry(entries: LeaderboardEntry[], rank: number) {
  if (!entries.length) return null;
  return (
    entries.find((entry) => entry.rank === rank) ??
    [...entries].sort((a, b) => a.rank - b.rank)[rank - 1] ??
    null
  );
}

function formatUsername(username: string) {
  if (!username) return "unknown";
  return username.startsWith("@") ? username : `@${username}`;
}

function hasRankWord(input: string) {
  for (const key of RANK_WORDS.keys()) {
    if (input.includes(key)) return true;
  }
  return false;
}
