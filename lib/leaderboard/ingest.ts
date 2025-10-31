import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { LeaderboardExportPayload, LeaderboardScope } from '@/types/leaderboard';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const REQUIRED_SCOPES = ['day', 'week', 'month'] as const satisfies LeaderboardScope[];
export const SECRET_HEADER = 'x-leaderboard-secret';

const entrySchema = z
  .object({
    rank: z.number().int().min(1).max(5),
    username: z
      .string()
      .min(1)
      .refine((value) => !value.includes('@'), {
        message: 'username should not include the @ prefix',
      }),
    minutes: z.number().int().min(0),
    title: z.string(),
    emojis: z.array(z.string().min(1)).max(10),
  })
  .strict();

const boardSchema = z
  .object({
    scope: z.enum(REQUIRED_SCOPES),
    period_start: z.string().regex(ISO_DATE_PATTERN, 'period_start must be YYYY-MM-DD'),
    period_end: z.string().regex(ISO_DATE_PATTERN, 'period_end must be YYYY-MM-DD'),
    entries: z.array(entrySchema).max(5),
  })
  .strict()
  .superRefine((board, ctx) => {
    if (board.scope === 'day' && board.period_start !== board.period_end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'day scope expects identical start and end dates',
        path: ['period_end'],
      });
    }

    const seenRanks = new Set<number>();
    board.entries.forEach((entry, index) => {
      if (seenRanks.has(entry.rank)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate rank detected: ${entry.rank}`,
          path: ['entries', index, 'rank'],
        });
      }
      seenRanks.add(entry.rank);
    });
  });

export const payloadSchema = z
  .object({
    posted_at: z
      .string()
      .refine((value) => {
        if (!value.endsWith('Z')) {
          return false;
        }
        const parsed = new Date(value);
        return !Number.isNaN(parsed.getTime());
      }, 'posted_at must be an ISO timestamp in UTC (ending with Z)'),
    source: z.literal('tracker'),
    message_id: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    chat_id: z.number().int().max(Number.MAX_SAFE_INTEGER),
    boards: z.array(boardSchema).length(REQUIRED_SCOPES.length),
  })
  .strict()
  .superRefine((payload, ctx) => {
    const scopes = new Set(payload.boards.map((board) => board.scope));
    if (scopes.size !== payload.boards.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'board scopes must be unique',
        path: ['boards'],
      });
    }

    REQUIRED_SCOPES.forEach((scope) => {
      if (!scopes.has(scope)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `missing ${scope} board`,
          path: ['boards'],
        });
      }
    });
  });

export type ParsedLeaderboardPayload = z.infer<typeof payloadSchema>;

type AdminClient = ReturnType<typeof supabaseAdmin>;

export function validateLeaderboardPayload(raw: unknown) {
  return payloadSchema.safeParse(raw);
}

export async function storeFailedLeaderboardPayload(
  client: AdminClient,
  raw: unknown,
  issues: unknown,
) {
  const { error } = await client
    .from('leaderboard_meta')
    .upsert({
      key: 'last_failed_payload',
      value: {
        payload: raw,
        issues,
        recorded_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('leaderboard ingest: failed to persist invalid payload for review', error);
    return false;
  }

  return true;
}

function buildRecordsFromPayload(payload: LeaderboardExportPayload) {
  const postedAtIso = new Date(payload.posted_at).toISOString();
  const updatedAtIso = new Date().toISOString();

  return payload.boards.map((board) => {
    const sortedEntries = [...board.entries].sort((a, b) => a.rank - b.rank);
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

export async function upsertLeaderboardPayload(client: AdminClient, payload: LeaderboardExportPayload) {
  const records = buildRecordsFromPayload(payload);
  const identifiers = records.map((record) => ({
    scope: record.scope,
    period_start: record.period_start,
    period_end: record.period_end,
  }));

  let existingCount = 0;
  if (identifiers.length > 0) {
    const orFilters = identifiers
      .map(
        (identifier) =>
          `(scope.eq.${identifier.scope},period_start.eq.${identifier.period_start},period_end.eq.${identifier.period_end})`,
      )
      .join(',');

    if (orFilters) {
      const { data: existingRows, error: existingError } = await client
        .from('leaderboards')
        .select('scope, period_start, period_end')
        .or(orFilters);

      if (existingError) {
        console.error('leaderboard ingest: failed to check existing rows', existingError);
        throw existingError;
      }

      existingCount = existingRows?.length ?? 0;
    }
  }

  const { error } = await client
    .from('leaderboards')
    .upsert(records, { onConflict: 'scope,period_start,period_end' });

  if (error) {
    console.error('leaderboard ingest: failed to upsert snapshot', error);
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
