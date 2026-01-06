import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  MAX_LEADERBOARD_ENTRIES,
  getUsernameSortKey,
  normalizeUsername,
  sortByMinutesThenUsername,
} from "@/lib/leaderboard/entries";
import {
  LeaderboardExportPayload,
  LeaderboardScope,
} from "@/types/leaderboard";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TRACKER_ENTRIES = 50;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
const KEYCAP_PATTERN = /[#*0-9]\uFE0F?\u20E3/u;
const LETTER_PATTERN = /\p{Letter}/u;
const RANK_EMOJI = new Map<number, string>([
  [1, "\u{1F947}"],
  [2, "\u{1F948}"],
  [3, "\u{1F949}"],
  [4, "\u0034\uFE0F\u20E3"],
  [5, "\u0035\uFE0F\u20E3"],
]);

const isValidIsoDate = (value: string) => {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().startsWith(value);
};

export const REQUIRED_SCOPES = [
  "day",
  "week",
  "month",
] as const satisfies LeaderboardScope[];
export const SECRET_HEADER = "x-leaderboard-secret";

export const trackerEntrySchema = z
  .object({
    rank: z.number().int().min(1).max(1000),
    user_id: z.union([z.string(), z.number()]).optional(),
    seconds: z.number().int().min(0).optional(),
    minutes: z.number().int().min(0),
    display: z.string().min(1),
    rank_emoji: z.string().optional(),
    badge: z.string().optional(),
    compliment: z.string().optional(),
  })
  .passthrough();

function normalizeTrackerDate(
  raw: string,
  ctx: z.RefinementCtx,
  label: "period_start" | "period_end",
): string | typeof z.NEVER {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (!match) {
    ctx.addIssue({
      code: "invalid_string",
      validation: "regex",
      message: `${label} must be YYYY-MM-DD`,
    });
    return z.NEVER;
  }

  const datePart = match[1];
  const [yearStr, monthStr, dayStr] = datePart.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const d = new Date(Date.UTC(year, month - 1, day));
  const valid =
    !Number.isNaN(d.getTime()) &&
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day;

  if (!valid) {
    ctx.addIssue({
      code: "custom",
      message: `${label} is not a valid calendar date`,
    });
    return z.NEVER;
  }

  return datePart;
}

const trackerDateSchema = (label: "period_start" | "period_end") =>
  z.string().transform((value, ctx) =>
    normalizeTrackerDate(value, ctx, label),
  );

export const trackerBoardSchema = z
  .object({
    scope: z.enum(REQUIRED_SCOPES),
    title: z.string(),
    header: z.string(),
    period_start: trackerDateSchema("period_start"),
    period_end: trackerDateSchema("period_end"),
    entries: z.array(trackerEntrySchema).max(MAX_TRACKER_ENTRIES),
  })
  .passthrough()
  .superRefine((board, ctx) => {
    if (board.scope === "day" && board.period_start !== board.period_end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "day scope expects identical start and end dates",
        path: ["period_end"],
      });
    }
  });

export const trackerPayloadSchema = z
  .object({
    posted_at: z.string().refine((value) => {
      const parsed = new Date(value);
      return !Number.isNaN(parsed.getTime());
    }, "posted_at must be a parseable ISO timestamp"),
    source: z.literal("tracker"),
    message_id: z
      .number()
      .int()
      .min(1)
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .optional(),
    chat_id: z
      .number()
      .int()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .optional(),
    boards: z.array(trackerBoardSchema).length(REQUIRED_SCOPES.length),
  })
  .passthrough()
  .superRefine((payload, ctx) => {
    const scopes = new Set(payload.boards.map((board) => board.scope));
    if (scopes.size !== payload.boards.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "board scopes must be unique",
        path: ["boards"],
      });
    }

    REQUIRED_SCOPES.forEach((scope) => {
      if (!scopes.has(scope)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `missing ${scope} board`,
          path: ["boards"],
        });
      }
    });
});

export type TrackerEntry = z.infer<typeof trackerEntrySchema>;
export type TrackerBoard = z.infer<typeof trackerBoardSchema>;
export type TrackerPayload = z.infer<typeof trackerPayloadSchema>;

const entrySchema = z
  .object({
    rank: z.number().int().min(1).max(MAX_LEADERBOARD_ENTRIES),
    username: z
      .string()
      .min(1)
      .refine((value) => !value.includes("@"), {
        message: "username should not include the @ prefix",
      }),
    minutes: z.number().int().min(0),
    title: z.string(),
    emojis: z.array(z.string().min(1)).max(10),
  });

const boardSchema = z
  .object({
    scope: z.enum(REQUIRED_SCOPES),
    period_start: z
      .string()
      .regex(ISO_DATE_PATTERN, "period_start must be YYYY-MM-DD"),
    period_end: z
      .string()
      .regex(ISO_DATE_PATTERN, "period_end must be YYYY-MM-DD"),
    entries: z.array(entrySchema).max(MAX_LEADERBOARD_ENTRIES),
  })
  .superRefine((board, ctx) => {
    if (!isValidIsoDate(board.period_start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "period_start is not a valid calendar date",
        path: ["period_start"],
      });
    }

    if (!isValidIsoDate(board.period_end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "period_end is not a valid calendar date",
        path: ["period_end"],
      });
    }

    if (board.scope === "day" && board.period_start !== board.period_end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "day scope expects identical start and end dates",
        path: ["period_end"],
      });
    }

    const seenRanks = new Set<number>();
    board.entries.forEach((entry, index) => {
      if (seenRanks.has(entry.rank)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate rank detected: ${entry.rank}`,
          path: ["entries", index, "rank"],
        });
      }
      seenRanks.add(entry.rank);
    });
  });

export const payloadSchema = z
  .object({
    posted_at: z.string().refine((value) => {
      if (!value.endsWith("Z")) {
        return false;
      }
      const parsed = new Date(value);
      return !Number.isNaN(parsed.getTime());
    }, "posted_at must be an ISO timestamp in UTC (ending with Z)"),
    source: z.literal("tracker"),
    message_id: z
      .number()
      .int()
      .min(1)
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .optional(),
    chat_id: z
      .number()
      .int()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .optional(),
    boards: z.array(boardSchema).length(REQUIRED_SCOPES.length),
  })
  .superRefine((payload, ctx) => {
    const scopes = new Set(payload.boards.map((board) => board.scope));
    if (scopes.size !== payload.boards.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "board scopes must be unique",
        path: ["boards"],
      });
    }

    REQUIRED_SCOPES.forEach((scope) => {
      if (!scopes.has(scope)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `missing ${scope} board`,
          path: ["boards"],
        });
      }
    });
  });

export type ParsedLeaderboardPayload = z.infer<typeof payloadSchema>;

type AdminClient = ReturnType<typeof supabaseAdmin>;

type NormalizedTrackerEntry = {
  username: string;
  minutes: number;
  badge?: string;
  compliment?: string;
};

function isEmojiLike(value: string | undefined) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (LETTER_PATTERN.test(trimmed)) return false;
  return EMOJI_PATTERN.test(trimmed) || KEYCAP_PATTERN.test(trimmed);
}

function getRankEmoji(rank: number) {
  return RANK_EMOJI.get(rank) ?? "";
}

function mergeTrackerEntry(
  existing: NormalizedTrackerEntry,
  next: NormalizedTrackerEntry,
) {
  if (next.minutes > existing.minutes) {
    return {
      ...next,
      badge: next.badge || existing.badge,
      compliment: next.compliment || existing.compliment,
    };
  }

  if (next.minutes === existing.minutes) {
    return {
      ...existing,
      badge: existing.badge || next.badge,
      compliment: existing.compliment || next.compliment,
    };
  }

  return {
    ...existing,
    badge: existing.badge || next.badge,
    compliment: existing.compliment || next.compliment,
  };
}

export function normalizeTrackerPayload(
  payload: TrackerPayload,
): LeaderboardExportPayload {
  const normalizedPostedAt = new Date(payload.posted_at).toISOString();

  return {
    posted_at: normalizedPostedAt,
    source: payload.source,
    message_id: payload.message_id,
    chat_id: payload.chat_id,
    boards: payload.boards.map((board) => ({
      scope: board.scope,
      period_start: board.period_start,
      period_end: board.period_end,
      entries: (() => {
        const deduped = new Map<string, NormalizedTrackerEntry>();

        board.entries.forEach((entry) => {
          const username = normalizeUsername(entry.display);
          if (!username) return;
          const key = getUsernameSortKey(username);
          const candidate = {
            username,
            minutes: entry.minutes,
            badge: entry.badge?.trim() || undefined,
            compliment: entry.compliment?.trim() || undefined,
          };

          const existing = deduped.get(key);
          deduped.set(key, existing ? mergeTrackerEntry(existing, candidate) : candidate);
        });

        const sorted = sortByMinutesThenUsername(Array.from(deduped.values()));

        return sorted.slice(0, MAX_LEADERBOARD_ENTRIES).map((entry, index) => {
          const rank = index + 1;
          const title =
            entry.compliment && entry.badge
              ? `${entry.badge} — ${entry.compliment}`
              : entry.compliment || entry.badge || "";
          const badgeEmoji = isEmojiLike(entry.badge) ? entry.badge : null;
          const emojis = [getRankEmoji(rank), badgeEmoji].filter(
            Boolean,
          ) as string[];

          return {
            rank,
            username: entry.username,
            minutes: entry.minutes,
            title,
            emojis,
          };
        });
      })(),
    })),
  };
}

export function validateLeaderboardPayload(raw: unknown) {
  const trackerResult = trackerPayloadSchema.safeParse(raw);
  if (!trackerResult.success) {
    return {
      success: false as const,
      issues: trackerResult.error.issues,
    };
  }

  const normalized = normalizeTrackerPayload(trackerResult.data);
  const normalizedResult = payloadSchema.safeParse(normalized);
  if (!normalizedResult.success) {
    return {
      success: false as const,
      issues: normalizedResult.error.issues,
    };
  }

  return {
    success: true as const,
    tracker: trackerResult.data,
    normalized: normalizedResult.data,
  };
}

export async function storeFailedLeaderboardPayload(
  client: AdminClient,
  raw: unknown,
  issues: unknown,
) {
  const { error } = await client.from("leaderboard_meta").upsert({
    key: "last_failed_payload",
    value: {
      payload: raw,
      issues,
      recorded_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error(
      "leaderboard ingest: failed to persist invalid payload for review",
      error,
    );
    return false;
  }

  return true;
}

export async function storeSuccessfulLeaderboardPayload(
  payload: LeaderboardExportPayload,
  result: { inserted: number; updated: number },
) {
  const client = supabaseAdmin();
  const { error } = await client.from("leaderboard_meta").upsert({
    key: "last_successful_payload",
    value: {
      stage: "ok",
      payload,
      result,
      recorded_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error(
      "leaderboard ingest: failed to persist successful payload for review",
      error,
    );
    return false;
  }

  return true;
}

export async function storeLeaderboardFailure(
  stage: "tracker-parse" | "normalized-parse" | "db-upsert",
  rawBody: unknown,
  issuesOrError: unknown,
) {
  const client = supabaseAdmin();
  const payloadIssues = {
    stage,
    issues: issuesOrError,
    recorded_at: new Date().toISOString(),
  };

  try {
    const stored = await storeFailedLeaderboardPayload(
      client,
      rawBody,
      payloadIssues,
    );
    if (!stored) {
      console.error("leaderboard ingest: failed to persist failure payload");
    }
  } catch (error) {
    console.error(
      "leaderboard ingest: error while persisting failure payload",
      error,
    );
  }
}

export async function storeDebugIngestMeta(stage: string, extra?: unknown) {
  const client = supabaseAdmin();
  const { error } = await client.from("leaderboard_meta").upsert({
    key: "debug_ingest",
    value: {
      stage,
      extra,
      recorded_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("leaderboard ingest: failed to persist debug meta", error);
  }
}

function buildRecordsFromPayload(payload: LeaderboardExportPayload) {
  const postedAtIso = new Date(payload.posted_at).toISOString();
  const updatedAtIso = new Date().toISOString();

  return payload.boards.map((board) => {
    const sortedEntries = sortByMinutesThenUsername(board.entries)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }))
      .slice(0, MAX_LEADERBOARD_ENTRIES);
    return {
      scope: board.scope,
      period_start: board.period_start,
      period_end: board.period_end,
      posted_at: postedAtIso,
      message_id: payload.message_id,
      chat_id: payload.chat_id,
      entries: sortedEntries,
      raw_snapshot: {
        posted_at: postedAtIso,
        source: payload.source,
        message_id: payload.message_id,
        chat_id: payload.chat_id,
        ...board,
        entries: sortedEntries,
      },
      updated_at: updatedAtIso,
    };
  });
}

type UpsertResult = {
  inserted: number;
  updated: number;
  posted_at: string;
};

type LeaderboardIdentifier = {
  scope: LeaderboardScope;
  period_start: string;
  period_end: string;
};

function buildExistingRowsFilter(rows: LeaderboardIdentifier[]) {
  return rows
    .map((row) =>
      [
        `scope.eq.${row.scope}`,
        `period_start.eq.${row.period_start}`,
        `period_end.eq.${row.period_end}`,
      ].join(","),
    )
    .map((group) => `and(${group})`)
    .join(",");
}

export async function upsertLeaderboardPayload(
  client: AdminClient,
  payload: LeaderboardExportPayload,
) {
  const records = buildRecordsFromPayload(payload);
  const identifiers: LeaderboardIdentifier[] = records.map((record) => ({
    scope: record.scope,
    period_start: record.period_start,
    period_end: record.period_end,
  }));

  let existingCount = 0;
  if (identifiers.length > 0) {
    const orFilter = buildExistingRowsFilter(identifiers);

    if (orFilter) {
      console.info("INGEST v2: existing rows filter", { orFilter });
      const { data: existingRows, error: existingError } = await client
        .from("leaderboards")
        .select("scope, period_start, period_end")
        .or(orFilter);

      if (existingError) {
        console.error(
          "leaderboard ingest: failed to check existing rows",
          existingError,
        );
        throw existingError;
      }

      existingCount = existingRows?.length ?? 0;
    }
  }

  const { error } = await client
    .from("leaderboards")
    .upsert(records, { onConflict: "scope,period_start,period_end" });

  if (error) {
    console.error("leaderboard ingest: failed to upsert snapshot", error);
    throw error;
  }

  const inserted = records.length - existingCount;
  const updated = existingCount;

  return {
    inserted,
    updated,
    posted_at: new Date(payload.posted_at).toISOString(),
  } satisfies UpsertResult;
}
