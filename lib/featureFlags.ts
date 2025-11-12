import { supabaseAdmin } from "./supabaseServer";

const FLAG_CACHE_MS = 30 * 1000;
const flagCache = new Map<string, { value: boolean; expiresAt: number }>();
const AI_CHAT_FLAG = "ai_chat_enabled";

async function fetchFlag(key: string, defaultValue: boolean) {
  const now = Date.now();
  const cached = flagCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("feature_flags")
      .select("enabled")
      .eq("key", key)
      .maybeSingle();

    if (error) throw error;

    const value = data?.enabled ?? defaultValue;
    flagCache.set(key, { value, expiresAt: now + FLAG_CACHE_MS });
    return value;
  } catch (error) {
    console.error(`[feature_flags] Failed to read flag "${key}"`, error);
    flagCache.set(key, {
      value: defaultValue,
      expiresAt: now + FLAG_CACHE_MS / 2,
    });
    return defaultValue;
  }
}

async function writeFlag(
  key: string,
  enabled: boolean,
  userId?: string | null,
) {
  const sb = supabaseAdmin();
  const { error } = await sb.from("feature_flags").upsert({
    key,
    enabled,
    updated_by: userId ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  flagCache.set(key, { value: enabled, expiresAt: Date.now() + FLAG_CACHE_MS });
}

export async function isAiChatEnabled(defaultValue = true) {
  return fetchFlag(AI_CHAT_FLAG, defaultValue);
}

export async function setAiChatEnabled(
  enabled: boolean,
  userId?: string | null,
) {
  await writeFlag(AI_CHAT_FLAG, enabled, userId);
  return enabled;
}
