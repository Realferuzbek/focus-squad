import { supabaseAdmin } from "@/lib/supabaseServer";

export interface MemoryEntry {
  key: string;
  value: string;
}

const MAX_MEMORY_ROWS = 5;

export function extractMemoryEntries(text: string): MemoryEntry[] {
  if (!text) return [];
  const entries: MemoryEntry[] = [];
  const cleanup = (value: string | null | undefined) =>
    value?.replace(/\s+/g, " ").trim().slice(0, 180) ?? null;

  const nameMatch = text.match(/\bmy name is ([a-z\s'-]{2,40})/i);
  if (nameMatch) {
    const value = cleanup(nameMatch[1]);
    if (value) entries.push({ key: "name", value });
  }

  const goalMatch = text.match(/\bmy goal (?:is|=)\s*([^.!?]+)/i);
  if (goalMatch) {
    const value = cleanup(goalMatch[1]);
    if (value) entries.push({ key: "goal", value });
  }

  const studyMatch =
    text.match(/\b(?:i am|i'm)\s+(?:studying|learning|building)\s+([^.!?]+)/i);
  if (studyMatch) {
    const value = cleanup(studyMatch[1]);
    if (value) entries.push({ key: "focus", value });
  }

  const timezoneMatch =
    text.match(/\bmy timezone (?:is|=)\s*([^.!?]+)/i) ||
    text.match(/\bi live in\s+([^.!?]+)/i);
  if (timezoneMatch) {
    const value = cleanup(timezoneMatch[1]);
    if (value) entries.push({ key: "timezone", value });
  }

  const deduped = new Map<string, string>();
  for (const entry of entries) {
    if (!deduped.has(entry.key)) {
      deduped.set(entry.key, entry.value);
    }
  }

  return Array.from(deduped.entries()).map(([key, value]) => ({
    key,
    value,
  }));
}

export async function getUserMemories(userId: string): Promise<string[]> {
  if (!userId) return [];
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ai_chat_memories")
    .select("value")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_MEMORY_ROWS);
  if (error) {
    console.warn("[ai-chat] failed to load memories", error);
    return [];
  }
  return (data ?? []).map((row) => row.value).filter(Boolean);
}

export async function upsertUserMemories(
  userId: string,
  entries: MemoryEntry[],
) {
  if (!userId || !entries.length) return;
  const sanitized = entries
    .slice(0, MAX_MEMORY_ROWS)
    .map((entry) => ({
      user_id: userId,
      memory_key: entry.key,
      value: entry.value,
      updated_at: new Date().toISOString(),
    }));
  const sb = supabaseAdmin();
  const { error } = await sb.from("ai_chat_memories").upsert(sanitized);
  if (error) {
    console.warn("[ai-chat] failed to upsert user memories", error);
  }
}

export async function getMemoryPreference(
  userId: string,
): Promise<boolean> {
  if (!userId) return false;
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ai_chat_preferences")
    .select("memory_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return true;
  return data?.memory_enabled ?? true;
}

export async function updateMemoryPreference(
  userId: string,
  enabled: boolean,
) {
  if (!userId) return;
  const sb = supabaseAdmin();
  const { error } = await sb.from("ai_chat_preferences").upsert({
    user_id: userId,
    memory_enabled: enabled,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw error;
  }
}
