create extension if not exists pgcrypto;

-- drop legacy table from earlier iteration if it exists
drop table if exists public.leaderboard_exports;

create table if not exists public.leaderboards (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  period_start date not null,
  period_end date not null,
  posted_at timestamptz not null,
  message_id bigint not null,
  chat_id bigint not null,
  entries jsonb not null,
  raw_snapshot jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leaderboards_scope_check check (scope in ('day', 'week', 'month')),
  constraint leaderboards_scope_period_unique unique (scope, period_start, period_end)
);

create index if not exists leaderboards_posted_at_idx
  on public.leaderboards (posted_at desc);

create table if not exists public.leaderboard_meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.leaderboards enable row level security;
alter table public.leaderboard_meta enable row level security;
