-- Track deploy-based reindex triggers
create table if not exists public.rag_reindex_state (
  key text primary key,
  deploy_id text,
  last_indexed_at timestamptz,
  in_progress boolean not null default false,
  lock_expires_at timestamptz,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.rag_reindex_state enable row level security;
