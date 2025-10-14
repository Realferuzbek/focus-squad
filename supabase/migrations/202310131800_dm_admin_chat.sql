-- Admin Chat Phase 1 schema (idempotent)

-- Optional: ensure pgcrypto for UUID default (usually enabled)
create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'is_dm_admin'
  ) then
    alter table public.users
      add column is_dm_admin boolean not null default false;
  end if;
end
$$;

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  status text not null default 'open',
  started_at timestamptz not null default now(),
  last_message_at timestamptz,
  wallpaper_url text,
  avatar_url text,
  description text,
  unique (user_id)
);

create table if not exists public.dm_participants (
  thread_id uuid references public.dm_threads(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role text not null default 'member',
  added_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.dm_threads(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  kind text not null default 'text',
  text text,
  file_url text,
  file_mime text,
  file_bytes int,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.dm_message_visibility (
  message_id uuid references public.dm_messages(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  hidden boolean not null default false,
  primary key (message_id, user_id)
);

create table if not exists public.dm_receipts (
  thread_id uuid references public.dm_threads(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  typing boolean not null default false,
  primary key (thread_id, user_id)
);

create index if not exists dm_threads_user_id_idx on public.dm_threads(user_id);
create index if not exists dm_messages_thread_created_idx on public.dm_messages(thread_id, created_at desc);
create index if not exists dm_message_visibility_user_idx on public.dm_message_visibility(user_id);
create index if not exists dm_receipts_thread_user_idx on public.dm_receipts(thread_id, user_id);

alter table public.dm_threads enable row level security;
alter table public.dm_participants enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_message_visibility enable row level security;
alter table public.dm_receipts enable row level security;

-- Policies
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dm_threads' and policyname = 'dm_threads_select_participant'
  ) then
    create policy dm_threads_select_participant
      on public.dm_threads
      for select
      using (
        exists (
          select 1 from public.dm_participants p
          where p.thread_id = dm_threads.id
            and p.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dm_participants' and policyname = 'dm_participants_manage_self'
  ) then
    create policy dm_participants_manage_self
      on public.dm_participants
      for select using (
        auth.uid() = user_id
        or exists (
          select 1 from public.dm_participants p2
          where p2.thread_id = dm_participants.thread_id
            and p2.user_id = auth.uid()
            and p2.role = 'dm_admin'
        )
      )
      with check (
        auth.uid() = user_id
        or exists (
          select 1 from public.dm_participants p2
          where p2.thread_id = dm_participants.thread_id
            and p2.user_id = auth.uid()
            and p2.role = 'dm_admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dm_messages' and policyname = 'dm_messages_select_participant'
  ) then
    create policy dm_messages_select_participant
      on public.dm_messages
      for select
      using (
        exists (
          select 1 from public.dm_participants p
          where p.thread_id = dm_messages.thread_id
            and p.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dm_messages' and policyname = 'dm_messages_insert_participant'
  ) then
    create policy dm_messages_insert_participant
      on public.dm_messages
      for insert
      with check (
        exists (
          select 1 from public.dm_participants p
          where p.thread_id = dm_messages.thread_id
            and p.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dm_messages' and policyname = 'dm_messages_update_author'
  ) then
    create policy dm_messages_update_author
      on public.dm_messages
      for update
      using (auth.uid() = author_id)
      with check (auth.uid() = author_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dm_message_visibility' and policyname = 'dm_message_visibility_owner'
  ) then
    create policy dm_message_visibility_owner
      on public.dm_message_visibility
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dm_receipts' and policyname = 'dm_receipts_participant'
  ) then
    create policy dm_receipts_participant
      on public.dm_receipts
      for all
      using (
        exists (
          select 1 from public.dm_participants p
          where p.thread_id = dm_receipts.thread_id
            and p.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.dm_participants p
          where p.thread_id = dm_receipts.thread_id
            and p.user_id = auth.uid()
        )
      );
  end if;
end
$$;

