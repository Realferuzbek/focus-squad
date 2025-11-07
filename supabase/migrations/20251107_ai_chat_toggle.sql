-- Feature flag table for AI chat availability
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

create index if not exists feature_flags_updated_at_idx
  on public.feature_flags (updated_at desc);

alter table public.feature_flags enable row level security;

insert into public.feature_flags (key, enabled)
values ('ai_chat_enabled', true)
on conflict (key) do nothing;
