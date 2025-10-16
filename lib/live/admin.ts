import type { Session } from "next-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { sendToTopic } from "@/lib/push";
import type { LiveSupabaseClient } from "./server";

export class LiveAdminError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "LiveAdminError";
    this.status = status;
  }
}

export type LiveAdminContext = {
  client: LiveSupabaseClient;
  userId: string;
};

export type AdminState = {
  isLive: boolean;
  updatedAt: string | null;
  groupName: string;
  groupAvatarUrl: string | null;
  groupDescription: string | null;
  wallpaperUrl: string | null;
  subscribersCount: number;
  activeMembers: number;
  removedMembers: number;
};

export type ListParams = {
  q?: string | null;
  cursor?: string | null;
  limit?: number | null;
};

export type ListedMember = {
  userId: string;
  joinedAt: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type ListedRemoved = {
  userId: string;
  removedAt: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type ListResponse<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type AuditEntry = {
  action: string;
  targetUser?: string | null;
  messageId?: number | null;
  fromText?: string | null;
  toText?: string | null;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function escapeLikeTerm(input: string) {
  return input.replace(/[%_]/g, (char) => `\\${char}`);
}

export async function requireAdmin(
  session: Session | null,
): Promise<LiveAdminContext> {
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    throw new LiveAdminError("Unauthorized", 401);
  }

  const client = supabaseAdmin();
  const { data, error } = await client.rpc("is_live_admin", {
    p_user: userId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new LiveAdminError("Forbidden", 403);
  }

  return { client, userId };
}

export async function getAdminState(
  context: LiveAdminContext,
): Promise<AdminState> {
  const { client } = context;

  const [stateRes, activeCountRes, removedCountRes] = await Promise.all([
    client
      .from("live_stream_state")
      .select(
        "is_live,updated_at,group_name,group_avatar_url,group_description,wallpaper_url,subscribers_count",
      )
      .eq("id", 1)
      .maybeSingle(),
    client
      .from("live_stream_members")
      .select("*", { head: true, count: "exact" })
      .is("left_at", null),
    client
      .from("live_stream_removed")
      .select("*", { head: true, count: "exact" }),
  ]);

  if (stateRes.error) throw stateRes.error;
  if (activeCountRes.error) throw activeCountRes.error;
  if (removedCountRes.error) throw removedCountRes.error;

  const state = stateRes.data ?? null;

  return {
    isLive: state?.is_live ?? false,
    updatedAt: state?.updated_at ?? null,
    groupName: state?.group_name ?? "Live Stream Chat",
    groupAvatarUrl: state?.group_avatar_url ?? null,
    groupDescription: state?.group_description ?? null,
    wallpaperUrl: state?.wallpaper_url ?? null,
    subscribersCount: state?.subscribers_count ?? 0,
    activeMembers: activeCountRes.count ?? 0,
    removedMembers: removedCountRes.count ?? 0,
  };
}

export type UpdateStateInput = {
  groupName?: string | null;
  groupDescription?: string | null;
  groupAvatarUrl?: string | null;
  wallpaperUrl?: string | null;
};

export async function updateState(
  context: LiveAdminContext,
  payload: UpdateStateInput,
): Promise<AdminState> {
  const { client } = context;

  const trimmedName =
    typeof payload.groupName === "string"
      ? payload.groupName.trim()
      : payload.groupName ?? undefined;
  const normalizedDescription =
    typeof payload.groupDescription === "string"
      ? payload.groupDescription.trim()
      : payload.groupDescription ?? undefined;

  if (trimmedName !== undefined && !trimmedName.length) {
    throw new LiveAdminError("Group name cannot be empty", 400);
  }

  if (normalizedDescription !== undefined && normalizedDescription) {
    const words = normalizedDescription.split(/\s+/).filter(Boolean);
    if (words.length > 40) {
      throw new LiveAdminError("Group description is limited to 40 words", 400);
    }
  }

  const updatePayload: Record<string, string | null> = {};
  if (trimmedName !== undefined) {
    updatePayload.group_name = trimmedName ?? "Live Stream Chat";
  }
  if (normalizedDescription !== undefined) {
    updatePayload.group_description = normalizedDescription || null;
  }
  if (payload.groupAvatarUrl !== undefined) {
    updatePayload.group_avatar_url = payload.groupAvatarUrl || null;
  }
  if (payload.wallpaperUrl !== undefined) {
    updatePayload.wallpaper_url = payload.wallpaperUrl || null;
  }

  if (!Object.keys(updatePayload).length) {
    return getAdminState(context);
  }

  const { data: before, error: beforeError } = await client
    .from("live_stream_state")
    .select(
      "group_name,group_avatar_url,group_description,wallpaper_url,is_live,updated_at,subscribers_count",
    )
    .eq("id", 1)
    .maybeSingle();

  if (beforeError) throw beforeError;

  const { data: after, error: updateError } = await client
    .from("live_stream_state")
    .update(updatePayload)
    .eq("id", 1)
    .select(
      "is_live,updated_at,group_name,group_avatar_url,group_description,wallpaper_url,subscribers_count",
    )
    .single();

  if (updateError) throw updateError;

  const headerChanged =
    (trimmedName !== undefined &&
      (before?.group_name ?? "Live Stream Chat") !==
        (after?.group_name ?? "Live Stream Chat")) ||
    (payload.groupAvatarUrl !== undefined &&
      (before?.group_avatar_url ?? null) !==
        (after?.group_avatar_url ?? null)) ||
    (payload.wallpaperUrl !== undefined &&
      (before?.wallpaper_url ?? null) !==
        (after?.wallpaper_url ?? null));

  if (headerChanged) {
    await safeBroadcast("Live stream updated", "Group visuals changed");
  }

  return {
    isLive: after?.is_live ?? false,
    updatedAt: after?.updated_at ?? null,
    groupName: after?.group_name ?? "Live Stream Chat",
    groupAvatarUrl: after?.group_avatar_url ?? null,
    groupDescription: after?.group_description ?? null,
    wallpaperUrl: after?.wallpaper_url ?? null,
    subscribersCount: after?.subscribers_count ?? 0,
    activeMembers:
      after?.subscribers_count ?? (await countActiveMembers(client)),
    removedMembers: await countRemovedMembers(client),
  };
}

async function countActiveMembers(client: LiveSupabaseClient) {
  const { count, error } = await client
    .from("live_stream_members")
    .select("*", { head: true, count: "exact" })
    .is("left_at", null);

  if (error) throw error;
  return count ?? 0;
}

async function countRemovedMembers(client: LiveSupabaseClient) {
  const { count, error } = await client
    .from("live_stream_removed")
    .select("*", { head: true, count: "exact" });

  if (error) throw error;
  return count ?? 0;
}

export async function fetchUsersByIds(
  client: LiveSupabaseClient,
  ids: string[],
) {
  if (!ids.length) return new Map<string, any>();

  const { data, error } = await client
    .from("users")
    .select("id,display_name,email,avatar_url")
    .in("id", ids);

  if (error) throw error;

  const map = new Map<string, any>();
  (data ?? []).forEach((row) => {
    if (row?.id) {
      map.set(row.id, row);
    }
  });
  return map;
}

async function safeBroadcast(title: string, body: string) {
  try {
    await sendToTopic("live_stream_chat", {
      title,
      body,
      url: "/community/live",
    });
  } catch (error) {
    console.error("[live_admin] broadcast failed", error);
  }
}

export async function listMembers(
  context: LiveAdminContext,
  params: ListParams = {},
): Promise<ListResponse<ListedMember>> {
  const { client } = context;
  const sanitizedLimit = Math.max(
    1,
    Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
  );

  let searchIds: string[] | null = null;
  const searchMap = new Map<string, any>();

  if (params.q) {
    const pattern = `%${escapeLikeTerm(params.q.trim())}%`;
    const { data: matches, error: searchError } = await client
      .from("users")
      .select("id,display_name,email,avatar_url")
      .or(
        `display_name.ilike.${pattern},email.ilike.${pattern}`,
      )
      .limit(200);

    if (searchError) throw searchError;

    searchIds = (matches ?? []).map((row) => row.id).filter(Boolean);
    (matches ?? []).forEach((row) => {
      if (row?.id) searchMap.set(row.id, row);
    });

    if (!searchIds.length) {
      return { items: [], nextCursor: null, hasMore: false };
    }
  }

  let query = client
    .from("live_stream_members")
    .select("user_id,joined_at")
    .is("left_at", null)
    .order("joined_at", { ascending: false })
    .limit(sanitizedLimit + 1);

  if (params.cursor) {
    query = query.lt("joined_at", params.cursor);
  }

  if (searchIds) {
    query = query.in("user_id", searchIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const hasMore = rows.length > sanitizedLimit;
  const sliced = hasMore ? rows.slice(0, sanitizedLimit) : rows;
  const userIds = sliced.map((row) => row.user_id).filter(Boolean);

  const profiles = await fetchUsersByIds(
    client,
    userIds.filter((id) => !searchMap.has(id)),
  );

  const items: ListedMember[] = sliced.map((row) => {
    const profile =
      searchMap.get(row.user_id) ?? profiles.get(row.user_id) ?? null;

    return {
      userId: row.user_id,
      joinedAt: row.joined_at ?? null,
      displayName: profile?.display_name ?? null,
      email: profile?.email ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    };
  });

  const nextCursor =
    hasMore && sliced.length
      ? sliced[sliced.length - 1]?.joined_at ?? null
      : null;

  return { items, nextCursor, hasMore };
}

export async function listRemoved(
  context: LiveAdminContext,
  params: ListParams = {},
): Promise<ListResponse<ListedRemoved>> {
  const { client } = context;
  const sanitizedLimit = Math.max(
    1,
    Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
  );

  let searchIds: string[] | null = null;
  const searchMap = new Map<string, any>();

  if (params.q) {
    const pattern = `%${escapeLikeTerm(params.q.trim())}%`;
    const { data: matches, error: searchError } = await client
      .from("users")
      .select("id,display_name,email,avatar_url")
      .or(
        `display_name.ilike.${pattern},email.ilike.${pattern}`,
      )
      .limit(200);

    if (searchError) throw searchError;

    searchIds = (matches ?? []).map((row) => row.id).filter(Boolean);
    (matches ?? []).forEach((row) => {
      if (row?.id) searchMap.set(row.id, row);
    });

    if (!searchIds.length) {
      return { items: [], nextCursor: null, hasMore: false };
    }
  }

  let query = client
    .from("live_stream_removed")
    .select("user_id,removed_at")
    .order("removed_at", { ascending: false })
    .limit(sanitizedLimit + 1);

  if (params.cursor) {
    query = query.lt("removed_at", params.cursor);
  }

  if (searchIds) {
    query = query.in("user_id", searchIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const hasMore = rows.length > sanitizedLimit;
  const sliced = hasMore ? rows.slice(0, sanitizedLimit) : rows;
  const userIds = sliced.map((row) => row.user_id).filter(Boolean);

  const profiles = await fetchUsersByIds(
    client,
    userIds.filter((id) => !searchMap.has(id)),
  );

  const items: ListedRemoved[] = sliced.map((row) => {
    const profile =
      searchMap.get(row.user_id) ?? profiles.get(row.user_id) ?? null;

    return {
      userId: row.user_id,
      removedAt: row.removed_at ?? null,
      displayName: profile?.display_name ?? null,
      email: profile?.email ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    };
  });

  const nextCursor =
    hasMore && sliced.length
      ? sliced[sliced.length - 1]?.removed_at ?? null
      : null;

  return { items, nextCursor, hasMore };
}

export async function removeMember(
  context: LiveAdminContext,
  userId: string,
) {
  const { client } = context;

  const now = new Date().toISOString();

  const [{ error: removedError }, { error: membershipError }] =
    await Promise.all([
      client
        .from("live_stream_removed")
        .upsert({ user_id: userId, removed_at: now }, { onConflict: "user_id" }),
      client
        .from("live_stream_members")
        .update({ left_at: now })
        .eq("user_id", userId),
    ]);

  if (removedError) throw removedError;
  if (membershipError) throw membershipError;

  await safeBroadcast("Member removed", "Live chat roster updated");
}

export async function restoreMember(
  context: LiveAdminContext,
  userId: string,
) {
  const { client } = context;

  const { error } = await client
    .from("live_stream_removed")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;

  await safeBroadcast("Member restored", "Live chat roster updated");
}

export async function addAdmin(
  context: LiveAdminContext,
  userId: string,
) {
  const { client } = context;

  const { error } = await client
    .from("live_stream_admins")
    .upsert({ user_id: userId }, { onConflict: "user_id" });

  if (error) throw error;
}

export async function removeAdmin(
  context: LiveAdminContext,
  userId: string,
) {
  const { client, userId: actor } = context;
  if (actor === userId) {
    throw new LiveAdminError("You cannot remove yourself", 400);
  }

  const { error } = await client
    .from("live_stream_admins")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}

export async function appendAudit(
  context: LiveAdminContext,
  entry: AuditEntry,
) {
  const { client, userId } = context;

  const payload: Record<string, any> = {
    action: entry.action,
    actor: userId,
    target_user: entry.targetUser ?? null,
    message_id: entry.messageId ?? null,
    from_text: entry.fromText ?? null,
    to_text: entry.toText ?? null,
  };

  const { error } = await client.from("live_stream_audit").insert(payload);
  if (error) throw error;
}
