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
) {
  const sb = supabaseAdmin();
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
