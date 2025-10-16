import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client for server-only storage ops
export const adminStorage = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}).storage;

// tiny filename cleaner
export function slugify(name: string) {
  return name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '').toLowerCase();
}

export function pickPath(threadId: string, filename: string) {
  return `dm-uploads/${threadId}/${crypto.randomUUID()}-${slugify(filename)}`;
}

export function pickLivePath(filename: string) {
  return `live-uploads/${crypto.randomUUID()}-${slugify(filename)}`;
}
