import { supabaseAdmin } from "@/lib/supabaseServer";
import { REQUIRED_SCOPES } from "./ingest";
import type {
  LeaderboardExportPayload,
  LeaderboardEntry,
  LeaderboardScope,
} from "@/types/leaderboard";

export interface LeaderboardSnapshotRow {
  id: string;
  scope: LeaderboardScope;
  period_start: string;
  period_end: string;
  posted_at: string;
  message_id: number | null | undefined;
  chat_id: number | null | undefined;
  entries: LeaderboardEntry[];
  payload?: LeaderboardExportPayload | null;
}

export type LeaderboardHistoryByScope = Record<
  LeaderboardScope,
  LeaderboardSnapshotRow[]
>;

function normalizeDateString(value: unknown) {
  if (typeof value !== "string") {
    return value ? String(value) : "";
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : value;
}

function normalizePostedAt(value: unknown) {
  if (typeof value === "string") return value;
  try {
    const date = new Date(value as string);
    return Number.isNaN(date.getTime())
      ? value
        ? String(value)
        : ""
      : date.toISOString();
  } catch (_error) {
    return value ? String(value) : "";
  }
}

export async function getLeaderboardHistory(
  scope: LeaderboardScope,
  limit = 60,
): Promise<LeaderboardSnapshotRow[]> {
  const client = supabaseAdmin();
  const { data, error } = await client
    .from("leaderboards")
    .select(
      "id, scope, period_start, period_end, posted_at, message_id, chat_id, entries",
    )
    .eq("scope", scope)
    .order("period_start", { ascending: false })
    .order("posted_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const messageId =
      row.message_id === null || row.message_id === undefined
        ? row.message_id
        : Number(row.message_id);
    const chatId =
      row.chat_id === null || row.chat_id === undefined
        ? row.chat_id
        : Number(row.chat_id);
    const entries = Array.isArray(row.entries)
      ? (row.entries as LeaderboardEntry[])
      : [];

    return {
      id: String(row.id),
      scope: row.scope as LeaderboardScope,
      period_start: normalizeDateString(row.period_start),
      period_end: normalizeDateString(row.period_end),
      posted_at: normalizePostedAt(row.posted_at),
      message_id: messageId as number | null | undefined,
      chat_id: chatId as number | null | undefined,
      entries,
      payload: null,
    } satisfies LeaderboardSnapshotRow;
  });
}

export async function getLeaderboardHistoryByScope(
  limit = 60,
): Promise<LeaderboardHistoryByScope> {
  const results = await Promise.all(
    REQUIRED_SCOPES.map(async (scope) => {
      try {
        const history = await getLeaderboardHistory(scope, limit);
        return [scope, history] as const;
      } catch (error) {
        console.error("leaderboard history: failed to load scope", {
          scope,
          error,
        });
        return [scope, []] as const;
      }
    }),
  );

  return Object.fromEntries(results) as LeaderboardHistoryByScope;
}

export function getTopEntryFromSnapshot(
  payload: LeaderboardExportPayload | null | undefined,
  scope: LeaderboardScope,
) {
  if (!payload || !Array.isArray(payload.boards)) return null;
  const board = payload.boards.find((candidate) => candidate.scope === scope);
  if (!board || !Array.isArray(board.entries) || board.entries.length === 0) {
    return null;
  }

  const first = board.entries[0];
  const username =
    typeof first.username === "string" && first.username.startsWith("@")
      ? first.username.slice(1)
      : first.username;

  return { username, minutes: first.minutes };
}
