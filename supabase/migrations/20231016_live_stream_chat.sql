-- Live Stream Chat schema (idempotent)

create extension if not exists pg_trgm;

create table if not exists public.live_stream_state (
  id int primary key default 1,
  is_live boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.live_members (
  user_id uuid primary key references public.users(id) on delete cascade,
  joined_at timestamptz not null default now()
);

create table if not exists public.live_messages (
  id bigserial primary key,
  author_id uuid references public.users(id) on delete set null,
  kind text not null check (kind in ('text','image','video','audio','file')),
  text text,
  file_path text,
  file_mime text,
  file_bytes integer,
  created_at timestamptz not null default now()
);

create index if not exists live_messages_created_desc_idx
  on public.live_messages (created_at desc);

create index if not exists live_messages_text_trgm
  on public.live_messages
  using gin (text gin_trgm_ops);

insert into public.live_stream_state (id, is_live)
values (1, false)
on conflict (id) do nothing;

alter table public.live_stream_state enable row level security;
alter table public.live_members enable row level security;
alter table public.live_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'push_subscriptions'
      and column_name = 'meta'
  ) then
    alter table public.push_subscriptions
      add column meta jsonb not null default '{}'::jsonb;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'live_stream_state'
      and policyname = 'live_stream_state_select_authenticated'
  ) then
    create policy live_stream_state_select_authenticated
      on public.live_stream_state
      for select
      using (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'live_members'
        and policyname = 'live_members_self_manage'
  ) then
    create policy live_members_self_manage
      on public.live_members
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'live_messages'
        and policyname = 'live_messages_select_authenticated'
  ) then
    create policy live_messages_select_authenticated
      on public.live_messages
      for select
      using (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'live_messages'
        and policyname = 'live_messages_insert_joined_live'
  ) then
    create policy live_messages_insert_joined_live
      on public.live_messages
      for insert
      with check (
        exists (
          select 1
          from public.live_members m
          where m.user_id = auth.uid()
        )
        and coalesce((
          select s.is_live
          from public.live_stream_state s
          where s.id = 1
        ), false)
      );
  end if;

  if not exists (
    select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'live_messages'
        and policyname = 'live_messages_delete_own'
  ) then
    create policy live_messages_delete_own
      on public.live_messages
      for delete
      using (
        author_id = auth.uid()
        and exists (
          select 1
          from public.live_members m
          where m.user_id = auth.uid()
        )
      );
  end if;
end
$$;

