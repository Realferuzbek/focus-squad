-- Align rag_reindex_state with deploy-triggered reindex tracking
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

alter table public.rag_reindex_state
  alter column key set default 'deploy';

alter table public.rag_reindex_state
  add column if not exists id bigint;

alter table public.rag_reindex_state
  add column if not exists last_deploy_id text;

alter table public.rag_reindex_state
  add column if not exists last_reindexed_at timestamptz;

alter table public.rag_reindex_state
  add column if not exists lock_until timestamptz;

alter table public.rag_reindex_state
  add column if not exists last_error text;

update public.rag_reindex_state
set
  id = coalesce(id, 1),
  last_deploy_id = coalesce(last_deploy_id, deploy_id),
  last_reindexed_at = coalesce(last_reindexed_at, last_indexed_at),
  lock_until = coalesce(lock_until, lock_expires_at);

alter table public.rag_reindex_state
  alter column id set default 1;

alter table public.rag_reindex_state
  alter column id set not null;
