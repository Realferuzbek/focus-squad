-- AI chat data storage: chat logs, per-user memory, retention, and consent toggles.
create table if not exists public.ai_chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  session_id uuid not null,
  language text not null default 'en',
  input text not null,
  reply text not null,
  used_rag boolean not null default false,
  created_at timestamptz not null default now(),
  rating smallint check (rating between -1 and 1),
  redaction_status text not null default 'redacted' check (
    redaction_status in ('redacted', 'skipped', 'failed')
  ),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_chat_logs_user_created_idx
  on public.ai_chat_logs (user_id, created_at desc);

create index if not exists ai_chat_logs_created_idx
  on public.ai_chat_logs (created_at desc);

create table if not exists public.ai_chat_memories (
  user_id uuid not null references public.users(id) on delete cascade,
  memory_key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, memory_key)
);

create index if not exists ai_chat_memories_updated_idx
  on public.ai_chat_memories (updated_at desc);

create table if not exists public.ai_chat_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  memory_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create
or replace function public.touch_ai_chat_preferences() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger ai_chat_preferences_touch
before update on public.ai_chat_preferences
for each row
execute function public.touch_ai_chat_preferences();

create
or replace function public.purge_expired_ai_chat_logs() returns trigger language plpgsql as $$
begin
  delete from public.ai_chat_logs
   where created_at < (now() - interval '90 days');
  return new;
end; $$;

drop trigger if exists ai_chat_logs_retention on public.ai_chat_logs;

create trigger ai_chat_logs_retention
after insert on public.ai_chat_logs
for each statement
execute function public.purge_expired_ai_chat_logs();

alter table public.ai_chat_logs enable row level security;
alter table public.ai_chat_memories enable row level security;
alter table public.ai_chat_preferences enable row level security;
