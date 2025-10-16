import { supabaseAdmin } from "@/lib/supabaseServer";

export type ThreadRow = {
  id: string;
  user_id: string;
  status: string;
  started_at: string;
  last_message_at: string | null;
  wallpaper_url: string | null;
  avatar_url: string | null;
  description: string | null;
};

export type MessageRow = {
  id: string;
  thread_id: string;
  author_id: string | null;
  kind: string;
  text: string | null;
  file_url: string | null;
  file_mime: string | null;
  file_bytes: number | null;
  edited_at: string | null;
  created_at: string;
};

const THREAD_COLUMNS =
  "id,user_id,status,started_at,last_message_at,wallpaper_url,avatar_url,description";

const MESSAGE_COLUMNS =
  "id,thread_id,author_id,kind,text,file_url,file_mime,file_bytes,edited_at,created_at";

export async function fetchThreadByUserId(
  userId: string,
): Promise<ThreadRow | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("dm_threads")
    .select(THREAD_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as ThreadRow | null) ?? null;
}

export async function fetchThreadById(
  threadId: string,
): Promise<ThreadRow | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("dm_threads")
    .select(THREAD_COLUMNS)
    .eq("id", threadId)
    .maybeSingle();

  if (error) throw error;
  return (data as ThreadRow | null) ?? null;
}

export async function ensureParticipant(
  threadId: string,
  userId: string,
  role: "member" | "dm_admin",
  sbInstance?: ReturnType<typeof supabaseAdmin>,
) {
  const sb = sbInstance ?? supabaseAdmin();
  const { error } = await sb
    .from("dm_participants")
    .upsert(
      {
        thread_id: threadId,
        user_id: userId,
        role,
      },
      { onConflict: "thread_id,user_id" },
    );
  if (error) throw error;
}

export async function ensureAdminParticipants(
  threadId: string,
  sbInstance?: ReturnType<typeof supabaseAdmin>,
) {
  const sb = sbInstance ?? supabaseAdmin();
  const { data: adminRows, error: adminsError } = await sb
    .from("users")
    .select("id")
    .eq("is_dm_admin", true);
  if (adminsError) throw adminsError;
  const adminIds = (adminRows ?? [])
    .map((row: any) => row.id as string | null)
    .filter((id): id is string => !!id);
  if (!adminIds.length) return;
  const upserts = adminIds.map((id) => ({
    thread_id: threadId,
    user_id: id,
    role: "dm_admin" as const,
  }));
  const { error } = await sb
    .from("dm_participants")
    .upsert(upserts, { onConflict: "thread_id,user_id" });
  if (error) throw error;
}

export async function ensureUserThread(
  userId: string,
): Promise<ThreadRow> {
  const existing = await fetchThreadByUserId(userId);
  const sb = supabaseAdmin();
  if (existing) {
    await ensureParticipant(existing.id, userId, "member", sb);
    await ensureAdminParticipants(existing.id, sb);
    await sb
      .from("dm_receipts")
      .upsert({ thread_id: existing.id, user_id: userId, typing: false });
    return existing;
  }

  const { data, error } = await sb
    .from("dm_threads")
    .insert({ user_id: userId, status: "open" })
    .select(THREAD_COLUMNS)
    .single();

  if (error || !data) {
    if (error) throw error;
    throw new Error("Failed to create thread");
  }

  const thread = data as ThreadRow;
  await ensureParticipant(thread.id, userId, "member", sb);
  await ensureAdminParticipants(thread.id, sb);
  await sb
    .from("dm_receipts")
    .upsert({ thread_id: thread.id, user_id: userId, typing: false });

  return thread;
}

export async function getParticipant(
  threadId: string,
  userId: string,
): Promise<{ role: string } | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("dm_participants")
    .select("role")
    .eq("thread_id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { role: string } | null) ?? null;
}

export async function isThreadParticipant(
  threadId: string,
  userId: string,
): Promise<boolean> {
  const participant = await getParticipant(threadId, userId);
  if (participant) return true;
  const thread = await fetchThreadById(threadId);
  if (!thread) return false;
  return thread.user_id === userId;
}

export function mapThread(row: ThreadRow) {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    startedAt: row.started_at,
    lastMessageAt: row.last_message_at,
    wallpaperUrl: row.wallpaper_url,
    avatarUrl: row.avatar_url,
    description: row.description,
  };
}

export function mapMessage(row: MessageRow) {
  return {
    id: row.id,
    threadId: row.thread_id,
    authorId: row.author_id,
    kind: row.kind,
    text: row.text,
    fileUrl: row.file_url,
    fileMime: row.file_mime,
    fileBytes: row.file_bytes,
    editedAt: row.edited_at,
    createdAt: row.created_at,
  };
}

export function isDmAdmin(user: any): boolean {
  return !!user?.is_dm_admin;
}

export { THREAD_COLUMNS, MESSAGE_COLUMNS };

export function buildMessagePreview(
  kind: string,
  text: string | null,
  fileMime?: string | null,
  fileBytes?: number | null,
) {
  const trimmed = text?.trim();
  if (trimmed) {
    return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed;
  }
  switch (kind) {
    case "image":
      return "[image]";
    case "video":
      return "[video]";
    case "audio":
      return "[audio]";
    case "file":
      if (fileMime?.startsWith("application/pdf")) return "PDF";
      if (fileMime?.startsWith("application/zip")) return "Archive";
      if (fileMime?.startsWith("application/vnd")) return "Document";
      return fileMime ?? (fileBytes ? "File" : "[file]");
    case "system":
      return "New activity";
    default:
      return "New message";
  }
}
