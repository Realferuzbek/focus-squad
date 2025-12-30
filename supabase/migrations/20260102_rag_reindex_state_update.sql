-- Align rag_reindex_state with deploy-triggered reindex tracking
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
