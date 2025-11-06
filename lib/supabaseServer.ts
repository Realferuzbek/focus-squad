import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient;

let adminClient: Client | undefined;
let anonClient: Client | undefined;

function resolveSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ''
  );
}

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function supabaseAdmin() {
  if (!adminClient) {
    const url = requireEnv(
      resolveSupabaseUrl(),
      'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL',
    );
    const key = requireEnv(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    adminClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return adminClient;
}

export function supabaseAnon() {
  if (!anonClient) {
    const url = requireEnv(
      resolveSupabaseUrl(),
      'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL',
    );
    const key = requireEnv(
      process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
    anonClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return anonClient;
}
