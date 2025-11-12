import { createClient } from "@supabase/supabase-js";

type StorageClient = ReturnType<typeof createClient>["storage"];

let cachedStorage: StorageClient | undefined;

function resolveSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
}

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Lazily instantiate the Supabase storage client so builds do not fail when env is absent.
export function getAdminStorage(): StorageClient {
  if (!cachedStorage) {
    const url = requireEnv(
      resolveSupabaseUrl(),
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    );
    const serviceKey = requireEnv(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    cachedStorage = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).storage;
  }

  return cachedStorage;
}

// tiny filename cleaner
export function slugify(name: string) {
  return name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .toLowerCase();
}

export function pickPath(threadId: string, filename: string) {
  return `dm-uploads/${threadId}/${crypto.randomUUID()}-${slugify(filename)}`;
}

export function pickLivePath(filename: string) {
  return `live-uploads/${crypto.randomUUID()}-${slugify(filename)}`;
}

export function pickLiveAssetPath(
  filename: string,
  variant: "avatar" | "wallpaper",
) {
  return `live-assets/${variant}/${crypto.randomUUID()}-${slugify(filename)}`;
}
