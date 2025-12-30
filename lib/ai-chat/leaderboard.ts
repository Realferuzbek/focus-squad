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

type DateSource = "explicit" | "today" | "yesterday" | "this_week";
type LeaderboardQueryKind = "rank" | "top" | "change";

type LeaderboardQuery = {
  intent: boolean;
  kind?: LeaderboardQueryKind;
  date?: string | null;
  dateSource?: DateSource | null;
  scope?: LeaderboardScope | null;
  rank?: number | null;
  topN?: number | null;
};

const DATE_PATTERN = /\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/;
const TODAY_PATTERN = /\btoday\b/i;
const YESTERDAY_PATTERN = /\byesterday\b/i;
const THIS_WEEK_PATTERN = /\bthis\s+week\b/i;
const LEADERBOARD_KEYWORD = /\b(leaderboard|ranking)\b/i;
const PLACE_KEYWORD = /\bplace\b/i;
const TOP_PATTERN = /\btop\s+(\d{1,2})\b/i;
const ORDINAL_NUMBER = /\b(\d{1,2})(st|nd|rd|th)\b/i;
const CHANGE_PATTERN =
  /\b(change|delta|difference|diff|vs\.?\s*last\s*week|last\s*week\s*vs|compare(d)?\s+to\s+last\s*week)\b/i;
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

const TASHKENT_TZ = "Asia/Tashkent";
const TASHKENT_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TASHKENT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function isLeaderboardIntent(input: string) {
  return parseLeaderboardQuery(input).intent;
}

export async function maybeHandleLeaderboardQuestion(params: {
  input: string;
  language: SupportedLanguage;
}): Promise<LeaderboardToolResult> {
  const normalized = params.input.toLowerCase();
  const parsed = parseLeaderboardQuery(normalized);
  if (!parsed.intent) {
    return { handled: false };
  }

  const date = parsed.date ?? null;
  if (!date) {
    return {
      handled: true,
      text: getLeaderboardMissingDateResponse(params.language),
      metadata: { reason: "leaderboard_missing_date" },
    };
  }

  const scope = resolveScope(parsed, normalized);

  if (parsed.kind === "change") {
    if (scope !== "week") {
      return {
        handled: true,
        text: getLeaderboardNotFoundResponse(params.language),
        metadata: { reason: "leaderboard_change_scope", date, scope },
      };
    }
    return handleWeeklyChange({
      language: params.language,
      date,
    });
  }

  if (parsed.kind === "top") {
    const topN = parsed.topN ?? null;
    if (!topN) {
      return {
        handled: true,
        text: getLeaderboardMissingRankResponse(params.language),
        metadata: {
          reason: "leaderboard_missing_rank",
          date,
          scope,
        },
      };
    }
    return handleTopSnapshot({
      language: params.language,
      date,
      scope,
      topN,
    });
  }

  const rank = parsed.rank ?? null;
  if (!rank) {
    return {
      handled: true,
      text: getLeaderboardMissingRankResponse(params.language),
      metadata: {
        reason: "leaderboard_missing_rank",
        date,
        scope,
      },
    };
  }

  return handleRankSnapshot({
    language: params.language,
    date,
    scope,
    rank,
  });
}

function parseLeaderboardQuery(input: string): LeaderboardQuery {
  const date = parseDate(input);
  const scope = parseScope(input);
  const rank = parseRank(input);
  const topN = parseTopN(input);
  const wantsChange = CHANGE_PATTERN.test(input);
  const intent = computeIntent({
    input,
    hasDate: Boolean(date),
    hasRank: Boolean(rank),
    hasTop: Boolean(topN),
    wantsChange,
  });

  if (!intent) {
    return { intent: false };
  }

  let kind: LeaderboardQueryKind | undefined;
  if (wantsChange) {
    kind = "change";
  } else if (topN) {
    kind = "top";
  } else {
    kind = "rank";
  }

  return {
    intent: true,
    kind,
    date: date?.date ?? null,
    dateSource: date?.source ?? null,
    scope,
    rank,
    topN,
  };
}

function computeIntent(params: {
  input: string;
  hasDate: boolean;
  hasRank: boolean;
  hasTop: boolean;
  wantsChange: boolean;
}) {
  if (LEADERBOARD_KEYWORD.test(params.input)) return true;
  if (params.wantsChange) {
    return params.hasDate || THIS_WEEK_PATTERN.test(params.input);
  }
  if (params.hasTop || params.hasRank) {
    return params.hasDate;
  }
  if (PLACE_KEYWORD.test(params.input) && ORDINAL_NUMBER.test(params.input)) {
    return params.hasDate;
  }
  return false;
}

function parseDate(input: string): { date: string; source: DateSource } | null {
  const match = DATE_PATTERN.exec(input);
  if (match) {
    const value = `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return { date: value, source: "explicit" };
  }
  if (THIS_WEEK_PATTERN.test(input)) {
    return { date: getTodayInTashkent(), source: "this_week" };
  }
  if (TODAY_PATTERN.test(input)) {
    return { date: getTodayInTashkent(), source: "today" };
  }
  if (YESTERDAY_PATTERN.test(input)) {
    return { date: getYesterdayInTashkent(), source: "yesterday" };
  }
  return null;
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

  const numberMatch = /\b(?:rank|place|position|#)\s*(\d{1,2})\b/i.exec(
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

function parseTopN(input: string): number | null {
  const match = TOP_PATTERN.exec(input);
  if (!match?.[1]) return null;
  return clampRank(Number.parseInt(match[1], 10));
}

function clampRank(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(value, 100);
}

function resolveScope(query: LeaderboardQuery, input: string): LeaderboardScope {
  if (query.scope) return query.scope;
  if (query.dateSource === "this_week") return "week";
  if (query.dateSource === "today" || query.dateSource === "yesterday") {
    return "day";
  }
  if (SCOPE_MATCHERS.week.test(input)) return "week";
  if (SCOPE_MATCHERS.month.test(input)) return "month";
  return "day";
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
  return entries.find((entry) => entry.rank === rank) ?? null;
}

function formatUsername(username: string) {
  if (!username) return "unknown";
  return username.startsWith("@") ? username : `@${username}`;
}

function getTodayInTashkent() {
  return formatDateInTashkent(new Date());
}

function getYesterdayInTashkent() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return formatDateInTashkent(yesterday);
}

function formatDateInTashkent(date: Date) {
  const parts = TASHKENT_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function normalizeUserKey(username: string) {
  return username.trim().replace(/^@/, "").toLowerCase();
}

async function handleRankSnapshot(params: {
  language: SupportedLanguage;
  date: string;
  scope: LeaderboardScope;
  rank: number;
}): Promise<LeaderboardToolResult> {
  try {
    const snapshot = await fetchSnapshot(params.scope, params.date);
    if (!snapshot || !snapshot.entries.length) {
      return {
        handled: true,
        text: getLeaderboardNotFoundResponse(params.language),
        metadata: {
          reason: "leaderboard_not_found",
          date: params.date,
          scope: params.scope,
          rank: params.rank,
        },
      };
    }

    const entry = findEntry(snapshot.entries, params.rank);
    if (!entry) {
      return {
        handled: true,
        text: getLeaderboardNotFoundResponse(params.language),
        metadata: {
          reason: "leaderboard_rank_unverified",
          date: params.date,
          scope: params.scope,
          rank: params.rank,
        },
      };
    }

    const label = getLeaderboardScopeLabel(snapshot.scope, params.language);
    const period = formatPeriod(snapshot, params.date);
    const username = formatUsername(entry.username);
    const minutes = Number.isFinite(entry.minutes)
      ? Math.round(entry.minutes)
      : entry.minutes;

    return {
      handled: true,
      text: `${label} (${period}): #${params.rank} ${username} with ${minutes} minutes.`,
      metadata: {
        reason: "leaderboard_rank",
        date: params.date,
        scope: params.scope,
        rank: params.rank,
      },
    };
  } catch (error) {
    console.error("[ai-chat] leaderboard lookup failed", error);
    return {
      handled: true,
      text: getLeaderboardNotFoundResponse(params.language),
      metadata: {
        reason: "leaderboard_error",
        date: params.date,
        scope: params.scope,
        rank: params.rank,
      },
    };
  }
}

async function handleTopSnapshot(params: {
  language: SupportedLanguage;
  date: string;
  scope: LeaderboardScope;
  topN: number;
}): Promise<LeaderboardToolResult> {
  try {
    const snapshot = await fetchSnapshot(params.scope, params.date);
    if (!snapshot || !snapshot.entries.length) {
      return {
        handled: true,
        text: getLeaderboardNotFoundResponse(params.language),
        metadata: {
          reason: "leaderboard_not_found",
          date: params.date,
          scope: params.scope,
          topN: params.topN,
        },
      };
    }

    const sorted = [...snapshot.entries].sort((a, b) => a.rank - b.rank);
    const list = sorted.slice(0, params.topN);
    if (!list.length) {
      return {
        handled: true,
        text: getLeaderboardNotFoundResponse(params.language),
        metadata: {
          reason: "leaderboard_not_found",
          date: params.date,
          scope: params.scope,
          topN: params.topN,
        },
      };
    }

    const label = getLeaderboardScopeLabel(snapshot.scope, params.language);
    const period = formatPeriod(snapshot, params.date);
    const availableNotice =
      list.length < params.topN
        ? ` (showing ${list.length})`
        : "";
    const header = `${label} (${period}): Top ${params.topN}${availableNotice}`;
    const lines = list.map((entry) => {
      const username = formatUsername(entry.username);
      const minutes = Number.isFinite(entry.minutes)
        ? Math.round(entry.minutes)
        : entry.minutes;
      return `#${entry.rank} ${username} - ${minutes} min`;
    });

    return {
      handled: true,
      text: [header, ...lines].join("\n"),
      metadata: {
        reason: "leaderboard_top",
        date: params.date,
        scope: params.scope,
        topN: params.topN,
        returned: list.length,
      },
    };
  } catch (error) {
    console.error("[ai-chat] leaderboard lookup failed", error);
    return {
      handled: true,
      text: getLeaderboardNotFoundResponse(params.language),
      metadata: {
        reason: "leaderboard_error",
        date: params.date,
        scope: params.scope,
        topN: params.topN,
      },
    };
  }
}

async function handleWeeklyChange(params: {
  language: SupportedLanguage;
  date: string;
}): Promise<LeaderboardToolResult> {
  try {
    const current = await fetchSnapshot("week", params.date);
    if (!current || !current.entries.length) {
      return {
        handled: true,
        text: getLeaderboardNotFoundResponse(params.language),
        metadata: {
          reason: "leaderboard_not_found",
          date: params.date,
          scope: "week",
        },
      };
    }

    const previous = await fetchPreviousWeekSnapshot(current.period_start);
    if (!previous || !previous.entries.length) {
      return {
        handled: true,
        text: getLeaderboardNotFoundResponse(params.language),
        metadata: {
          reason: "leaderboard_previous_not_found",
          date: params.date,
          scope: "week",
        },
      };
    }

    const label = getLeaderboardScopeLabel("week", params.language);
    const currentPeriod = formatPeriod(current, params.date);
    const previousPeriod = formatPeriod(previous, current.period_start);
    const header = `${label} change (${currentPeriod} vs ${previousPeriod})`;

    const previousByUser = new Map<string, number>();
    previous.entries.forEach((entry) => {
      previousByUser.set(normalizeUserKey(entry.username), entry.rank);
    });

    const sorted = [...current.entries].sort((a, b) => a.rank - b.rank);
    const lines = sorted.map((entry) => {
      const username = formatUsername(entry.username);
      const minutes = Number.isFinite(entry.minutes)
        ? Math.round(entry.minutes)
        : entry.minutes;
      const prevRank = previousByUser.get(normalizeUserKey(entry.username));
      const changeLabel =
        typeof prevRank === "number"
          ? prevRank === entry.rank
            ? "no change"
            : prevRank > entry.rank
              ? `up ${prevRank - entry.rank}`
              : `down ${entry.rank - prevRank}`
          : "new";
      return `#${entry.rank} ${username} - ${minutes} min (${changeLabel})`;
    });

    return {
      handled: true,
      text: [header, ...lines].join("\n"),
      metadata: {
        reason: "leaderboard_change_week",
        date: params.date,
        scope: "week",
      },
    };
  } catch (error) {
    console.error("[ai-chat] leaderboard lookup failed", error);
    return {
      handled: true,
      text: getLeaderboardNotFoundResponse(params.language),
      metadata: {
        reason: "leaderboard_error",
        date: params.date,
        scope: "week",
      },
    };
  }
}

async function fetchPreviousWeekSnapshot(
  periodStart: string,
): Promise<LeaderboardSnapshot | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("leaderboards")
    .select("scope, period_start, period_end, posted_at, entries")
    .eq("scope", "week")
    .lt("period_end", periodStart)
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
