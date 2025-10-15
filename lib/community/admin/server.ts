import { supabaseAdmin } from "@/lib/supabaseServer";
import { mapThread, type ThreadRow } from "@/lib/adminchat/server";

export type AdminInboxThread = {
  id: string;
  status: string;
  lastMessageAt: string | null;
  avatarUrl: string | null;
  lastMessagePreview: string | null;
  targetUser: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
  unread: boolean;
};

export type ThreadDisplayMeta = {
  avatarUrl: string | null;
  title: string;
  targetUser: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
};

function pickDisplayName(user: any): string | null {
  if (!user) return null;
  return (
    user.display_name ??
    user.displayName ??
    user.name ??
    user.full_name ??
    user.fullName ??
    null
  );
}

export async function listAdminThreads(adminId: string): Promise<AdminInboxThread[]> {
  const sb = supabaseAdmin();

  const { data: participantRows, error: participantsError } = await sb
    .from("dm_participants")
    .select("thread_id")
    .eq("user_id", adminId)
    .eq("role", "dm_admin");

  if (participantsError) {
    throw participantsError;
  }

  const threadIds = Array.from(
    new Set((participantRows ?? []).map((row) => row.thread_id).filter(Boolean)),
  ) as string[];

  if (!threadIds.length) {
    return [];
  }

  const { data: threadRows, error: threadsError } = await sb
    .from("dm_threads")
    .select(
      "id,user_id,status,last_message_at,avatar_url,description",
    )
    .in("id", threadIds)
    .limit(50);

  if (threadsError) {
    throw threadsError;
  }

  if (!threadRows?.length) {
    return [];
  }

  const orderedThreads = [...threadRows].sort((a, b) => {
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bTime - aTime;
  }).slice(0, 50);

  const userIds = Array.from(
    new Set(orderedThreads.map((row) => row.user_id).filter(Boolean)),
  ) as string[];

  const messagesPromise = sb
    .from("dm_messages")
    .select("thread_id,kind,text,file_mime,file_bytes,created_at")
    .in(
      "thread_id",
      orderedThreads.map((row) => row.id),
    )
    .order("created_at", { ascending: false })
    .limit(Math.max(orderedThreads.length * 3, 60));

  const receiptsPromise = sb
    .from("dm_receipts")
    .select("thread_id,last_read_at")
    .eq("user_id", adminId)
    .in("thread_id", orderedThreads.map((row) => row.id));

  const usersPromise = userIds.length
    ? sb
        .from("users")
        .select("id,display_name,name,email,avatar_url")
        .in("id", userIds)
    : Promise.resolve({ data: [] as any[], error: null });

  const [{ data: receiptRows, error: receiptsError }, { data: userRows, error: usersError }] =
    await Promise.all([receiptsPromise, usersPromise]);

  if (receiptsError) throw receiptsError;
  if (usersError) throw usersError;

  const receiptMap = new Map<string, string | null>();
  (receiptRows ?? []).forEach((row) => {
    receiptMap.set(row.thread_id, row.last_read_at ?? null);
  });

  const userMap = new Map<string, any>();
  (userRows ?? []).forEach((user) => {
    userMap.set(user.id, user);
  });

  const { data: messageRows, error: messagesError } = await messagesPromise;
  if (messagesError) throw messagesError;

  type LastMessageRow = {
    thread_id: string;
    kind: string;
    text: string | null;
    file_mime: string | null;
    file_bytes: number | null;
  };

  const lastMessageMap = new Map<string, LastMessageRow>();
  (messageRows ?? []).forEach((row: any) => {
    const threadId = row.thread_id as string | null;
    if (!threadId) return;
    if (!lastMessageMap.has(threadId)) {
      lastMessageMap.set(threadId, row as LastMessageRow);
    }
  });

  function buildPreview(row: LastMessageRow | undefined): string | null {
    if (!row) return null;
    if (row.kind === "text" && row.text) {
      const trimmed = row.text.replace(/\s+/g, " ").trim();
      if (!trimmed) return null;
      return trimmed.slice(0, 120);
    }
    if (row.kind === "audio") return "Voice message";
    if (row.kind === "video") return "Video";
    if (row.kind === "image") return "Photo";
    if (row.kind === "file") {
      if (row.file_mime?.startsWith("application/pdf")) return "PDF";
      if (row.file_mime?.startsWith("application/zip")) return "Archive";
      return "File";
    }
    return row.kind ? row.kind.charAt(0).toUpperCase() + row.kind.slice(1) : null;
  }

  return orderedThreads.map((row) => {
    const user = row.user_id ? userMap.get(row.user_id) : null;
    const lastMessageAt = row.last_message_at ?? null;
    const lastReadAt = receiptMap.get(row.id) ?? null;
    const unread =
      !!lastMessageAt &&
      (!lastReadAt || new Date(lastReadAt).getTime() < new Date(lastMessageAt).getTime());

    return {
      id: row.id,
      status: row.status,
      lastMessageAt,
       lastMessagePreview: buildPreview(lastMessageMap.get(row.id)),
      avatarUrl: row.avatar_url ?? (user?.avatar_url ?? null),
      targetUser: user
        ? {
            id: user.id,
            name: pickDisplayName(user),
            email: user.email ?? null,
            avatarUrl: user.avatar_url ?? null,
          }
        : null,
      unread,
    };
  });
}

export async function getThreadDisplayMeta(
  threadId: string,
): Promise<ThreadDisplayMeta | null> {
  const sb = supabaseAdmin();

  const { data: threadRow, error } = await sb
    .from("dm_threads")
    .select("id,user_id,status,last_message_at,avatar_url,wallpaper_url,description")
    .eq("id", threadId)
    .maybeSingle();

  if (error) throw error;
  if (!threadRow) return null;

  let targetUser: ThreadDisplayMeta["targetUser"] = null;

  if (threadRow.user_id) {
    const { data: userRow, error: userError } = await sb
      .from("users")
      .select("id,display_name,name,email,avatar_url")
      .eq("id", threadRow.user_id)
      .maybeSingle();

    if (userError) throw userError;
    if (userRow) {
      targetUser = {
        id: userRow.id,
        name: pickDisplayName(userRow),
        email: userRow.email ?? null,
        avatarUrl: userRow.avatar_url ?? null,
      };
    }
  }

  const avatarUrl = threadRow.avatar_url ?? targetUser?.avatarUrl ?? null;
  const title =
    targetUser?.name ??
    targetUser?.email ??
    "Admin Chat";

  return {
    avatarUrl,
    title,
    targetUser,
  };
}

export async function loadThreadForAdmin(threadId: string) {
  const { data, error } = await supabaseAdmin()
    .from("dm_threads")
    .select(
      "id,user_id,status,started_at,last_message_at,wallpaper_url,avatar_url,description",
    )
    .eq("id", threadId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapThread(data as ThreadRow);
}
