import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  LiveAdminError,
  fetchUsersByIds,
  requireAdmin,
} from "@/lib/live/admin";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function handleError(error: unknown) {
  if (error instanceof LiveAdminError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[live_admin_audit]", error);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new LiveAdminError("limit must be a positive integer", 400);
  }
  return Math.min(parsed, MAX_LIMIT);
}

function parseCursor(value: string | null) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new LiveAdminError("cursor must be a positive integer", 400);
  }
  return parsed;
}

export async function GET(req: NextRequest) {
  const session = await auth();

  let context;
  try {
    context = await requireAdmin(session);
  } catch (error) {
    return handleError(error);
  }

  const searchParams = req.nextUrl.searchParams;

  let limit: number;
  let cursor: number | undefined;

  try {
    limit = parseLimit(searchParams.get("limit"));
    cursor = parseCursor(searchParams.get("cursor"));
  } catch (error) {
    if (error instanceof LiveAdminError) {
      return handleError(error);
    }
    throw error;
  }

  let query = context.client
    .from("live_stream_audit")
    .select(
      "id,at,action,actor,target_user,message_id,from_text,to_text",
    )
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("id", cursor);
  }

  const { data, error } = await query;
  if (error) {
    return handleError(error);
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;

  const userIds = new Set<string>();
  sliced.forEach((row) => {
    if (row.actor) userIds.add(row.actor);
    if (row.target_user) userIds.add(row.target_user);
  });

  let userMap = new Map<string, any>();
  try {
    userMap = await fetchUsersByIds(context.client, Array.from(userIds));
  } catch (userError) {
    return handleError(userError);
  }

  const items = sliced.map((row) => {
    const actorProfile = row.actor ? userMap.get(row.actor) ?? null : null;
    const targetProfile = row.target_user
      ? userMap.get(row.target_user) ?? null
      : null;

    return {
      id: row.id,
      at: row.at,
      action: row.action,
      actor: row.actor,
      targetUser: row.target_user,
      messageId: row.message_id,
      fromText: row.from_text,
      toText: row.to_text,
      actorProfile: actorProfile
        ? {
            displayName: actorProfile.display_name ?? null,
            email: actorProfile.email ?? null,
            avatarUrl: actorProfile.avatar_url ?? null,
          }
        : null,
      targetProfile: targetProfile
        ? {
            displayName: targetProfile.display_name ?? null,
            email: targetProfile.email ?? null,
            avatarUrl: targetProfile.avatar_url ?? null,
          }
        : null,
    };
  });

  const nextCursor =
    hasMore && sliced.length ? String(sliced[sliced.length - 1].id) : null;

  return NextResponse.json({
    items,
    hasMore,
    nextCursor,
  });
}
