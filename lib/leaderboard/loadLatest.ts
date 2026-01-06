import { unstable_cache } from "next/cache";

import { supabaseAdmin } from "@/lib/supabaseServer";
import { REQUIRED_SCOPES } from "./ingest";
import { withCanonicalRanks } from "./entries";
import type { LeaderboardEntry, LeaderboardScope } from "@/types/leaderboard";

export interface LeaderboardSnapshot {
  scope: LeaderboardScope;
  period_start: string;
  period_end: string;
  posted_at: string;
  entries: LeaderboardEntry[];
  message_id: number | null | undefined;
  chat_id: number | null | undefined;
}

type SnapshotRecord = Record<LeaderboardScope, LeaderboardSnapshot | null>;

async function fetchLatestSnapshots(): Promise<SnapshotRecord> {
  const client = supabaseAdmin();

  const results = await Promise.all(
    REQUIRED_SCOPES.map(async (scope) => {
      const { data, error } = await client
        .from("leaderboards")
        .select(
          "scope, period_start, period_end, posted_at, entries, message_id, chat_id",
        )
        .eq("scope", scope)
        .order("posted_at", { ascending: false })
        .order("period_end", { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      const row = data?.[0];
      if (!row) {
        return [scope, null] as const;
      }

      const entries = Array.isArray(row.entries)
        ? withCanonicalRanks(row.entries as LeaderboardEntry[])
        : [];

      return [
        scope,
        {
          scope: row.scope as LeaderboardScope,
          period_start: row.period_start as string,
          period_end: row.period_end as string,
          posted_at: row.posted_at as string,
          entries,
          message_id: row.message_id as number | null | undefined,
          chat_id: row.chat_id as number | null | undefined,
        } satisfies LeaderboardSnapshot,
      ] as const;
    }),
  );

  return Object.fromEntries(results) as SnapshotRecord;
}

export const loadLatestLeaderboards = unstable_cache(
  fetchLatestSnapshots,
  ["leaderboard-latest"],
  {
    revalidate: 60,
  },
);
