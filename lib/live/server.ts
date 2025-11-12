import { supabaseAdmin } from "@/lib/supabaseServer";

export type LiveSupabaseClient = ReturnType<typeof supabaseAdmin>;

export type LiveMessageRow = {
  id: number;
  author_id: string | null;
  kind: "text" | "image" | "video" | "audio" | "file";
  text: string | null;
  file_path: string | null;
  file_mime: string | null;
  file_bytes: number | null;
  created_at: string;
  author?:
    | {
        display_name: string | null;
        avatar_url: string | null;
      }
    | Array<{
        display_name: string | null;
        avatar_url: string | null;
      }>
    | null;
};

export type LiveMessage = {
  id: number;
  authorId: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  kind: LiveMessageRow["kind"];
  text: string | null;
  filePath: string | null;
  fileMime: string | null;
  fileBytes: number | null;
  createdAt: string;
  highlight?: string | null;
};

export function mapLiveMessage(row: LiveMessageRow): LiveMessage {
  const rawAuthor =
    Array.isArray(row.author) && row.author.length
      ? row.author[0]
      : (row.author as {
          display_name: string | null;
          avatar_url: string | null;
        } | null);

  return {
    id: row.id,
    authorId: row.author_id,
    authorName: rawAuthor?.display_name ?? null,
    authorAvatar: rawAuthor?.avatar_url ?? null,
    kind: row.kind,
    text: row.text ?? null,
    filePath: row.file_path ?? null,
    fileMime: row.file_mime ?? null,
    fileBytes: row.file_bytes ?? null,
    createdAt: row.created_at,
    highlight: null,
  };
}

export function buildLivePreview(
  kind: LiveMessageRow["kind"],
  text?: string | null,
  fileMime?: string | null,
  fileBytes?: number | null,
) {
  const trimmed = (text ?? "").trim();
  if (kind === "text" && trimmed) {
    return trimmed.slice(0, 120);
  }

  if (trimmed) {
    return trimmed.slice(0, 120);
  }

  switch (kind) {
    case "image":
      return "📷 Image shared";
    case "video":
      return "🎥 Video shared";
    case "audio":
      return "🎧 Audio shared";
    case "file":
      if (fileMime?.startsWith("application/pdf")) return "📄 PDF shared";
      if (fileMime?.startsWith("application/zip")) return "🗜️ Archive shared";
      if (fileMime?.startsWith("application/vnd")) return "📄 Document shared";
      if (fileMime?.startsWith("text/")) return "📄 File shared";
      return fileBytes ? "📎 File uploaded" : "📎 Attachment";
    default:
      return "New message";
  }
}

export async function fetchLiveState(client: LiveSupabaseClient) {
  const { data, error } = await client
    .from("live_stream_state")
    .select(
      "is_live,updated_at,group_name,group_avatar_url,group_description,wallpaper_url,subscribers_count",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    isLive: data?.is_live ?? false,
    updatedAt: data?.updated_at ?? null,
    groupName: data?.group_name ?? "Live Stream Chat",
    groupAvatarUrl: data?.group_avatar_url ?? null,
    groupDescription: data?.group_description ?? null,
    wallpaperUrl: data?.wallpaper_url ?? null,
    subscribersCount: data?.subscribers_count ?? 0,
  };
}

export async function isLiveMember(client: LiveSupabaseClient, userId: string) {
  const { data, error } = await client
    .from("live_stream_members")
    .select("user_id")
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return !!data;
}

export async function countLiveMembers(client: LiveSupabaseClient) {
  const { count, error } = await client
    .from("live_stream_members")
    .select("*", { head: true, count: "exact" })
    .is("left_at", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
