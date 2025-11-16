import { supabaseAdmin } from "@/lib/supabaseServer";
import type { RedactionStatus } from "./redaction";
import type { SupportedLanguage } from "./language";

export interface ChatLogInsert {
  userId?: string | null;
  sessionId: string;
  language: SupportedLanguage;
  input: string;
  reply: string;
  usedRag: boolean;
  metadata?: Record<string, unknown>;
  redactionStatus: RedactionStatus;
}

export async function saveChatLog(payload: ChatLogInsert) {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("ai_chat_logs")
      .insert({
        user_id: payload.userId ?? null,
        session_id: payload.sessionId,
        language: payload.language,
        input: payload.input,
        reply: payload.reply,
        used_rag: payload.usedRag,
        metadata: payload.metadata ?? {},
        redaction_status: payload.redactionStatus,
      })
      .select("id,created_at")
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  } catch (error) {
    console.error("[ai-chat] failed to save chat log", error);
    return null;
  }
}

export interface ChatLogRecord {
  id: string;
  user_id: string | null;
  session_id: string;
  language: string;
  input: string;
  reply: string;
  used_rag: boolean;
  rating: number | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface ListChatLogsOptions {
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
  usedRag?: boolean;
}

export async function listChatLogs(options: ListChatLogsOptions) {
  const limit = Math.min(options.limit ?? 25, 100);
  const sb = supabaseAdmin();
  let query = sb
    .from("ai_chat_logs")
    .select(
      "id,user_id,session_id,language,input,reply,used_rag,rating,created_at,metadata",
    )
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (options.userId) query = query.eq("user_id", options.userId);
  if (typeof options.usedRag === "boolean") {
    query = query.eq("used_rag", options.usedRag);
  }
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lte("created_at", options.to);
  if (options.cursor) {
    const decoded = decodeCursor(options.cursor);
    if (decoded) {
      query = query.lt("created_at", decoded.createdAt);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  const items = (data ?? []) as ChatLogRecord[];
  let nextCursor: string | null = null;
  if (items.length > limit) {
    const tail = items.pop()!;
    nextCursor = encodeCursor(tail);
  }

  return { items, nextCursor };
}

export interface ExportChatLogsOptions
  extends Omit<ListChatLogsOptions, "limit" | "cursor"> {
  limit?: number;
}

export async function exportChatLogs(options: ExportChatLogsOptions) {
  const limit = options.limit ?? 1000;
  const sb = supabaseAdmin();
  let query = sb
    .from("ai_chat_logs")
    .select(
      "id,user_id,session_id,language,input,reply,used_rag,rating,created_at,metadata",
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 5000));
  if (options.userId) query = query.eq("user_id", options.userId);
  if (typeof options.usedRag === "boolean") {
    query = query.eq("used_rag", options.usedRag);
  }
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lte("created_at", options.to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ChatLogRecord[];
}

export interface DeleteChatLogsOptions {
  chatIds?: string[];
  userId?: string;
  before?: string;
}

export async function deleteChatLogs(options: DeleteChatLogsOptions) {
  if (
    (!options.chatIds || !options.chatIds.length) &&
    !options.userId &&
    !options.before
  ) {
    throw new Error("At least one filter must be provided.");
  }
  const sb = supabaseAdmin();
  let query = sb.from("ai_chat_logs").delete();
  if (options.chatIds?.length) {
    query = query.in("id", options.chatIds);
  }
  if (options.userId) query = query.eq("user_id", options.userId);
  if (options.before) query = query.lt("created_at", options.before);
  const { error } = await query;
  if (error) throw error;
}

export async function forgetUserAiData(userId: string) {
  const sb = supabaseAdmin();
  await sb.from("ai_chat_logs").delete().eq("user_id", userId);
  await sb.from("ai_chat_memories").delete().eq("user_id", userId);
  await sb.from("ai_chat_preferences").delete().eq("user_id", userId);
}

export async function updateChatRating(chatId: string, rating: number) {
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("ai_chat_logs")
    .update({ rating })
    .eq("id", chatId);
  if (error) throw error;
}

function encodeCursor(row: { created_at: string; id: string }) {
  return Buffer.from(`${row.created_at}|${row.id}`, "utf8").toString(
    "base64url",
  );
}

function decodeCursor(cursor: string) {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const [createdAt, id] = decoded.split("|");
    if (createdAt && id) {
      return { createdAt, id };
    }
    return null;
  } catch {
    return null;
  }
}
