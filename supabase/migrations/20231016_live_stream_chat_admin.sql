-- Live Stream Chat admin + moderation extensions

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'live_members'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'live_stream_members'
  ) then
    execute 'alter table public.live_members rename to live_stream_members';
  end if;
end
$$;

create table if not exists public.live_stream_members (
  user_id uuid primary key references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

alter table public.live_stream_members
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists left_at timestamptz;

alter table public.live_stream_members enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_stream_members'
      and policyname = 'live_members_self_manage'
  ) then
    execute 'drop policy live_members_self_manage on public.live_stream_members';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_stream_members'
      and policyname = 'live_stream_members_self_manage'
  ) then
    create policy live_stream_members_self_manage
      on public.live_stream_members
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

alter table public.live_stream_state
  add column if not exists group_name text not null default 'Live Stream Chat',
  add column if not exists group_avatar_url text,
  add column if not exists group_description text,
  add column if not exists wallpaper_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_stream_state_description_words_chk'
  ) then
    alter table public.live_stream_state
      add constraint live_stream_state_description_words_chk
      check (
        group_description is null
        or array_length(
          regexp_split_to_array(
            trim(group_description),
            '\s+'
          ),
          1
        ) <= 40
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'live_stream_state'
      and column_name = 'subscribers_count'
  ) then
    execute $ddl$
      alter table public.live_stream_state
        add column subscribers_count bigint generated always as (
          (
            select count(*)
            from public.live_stream_members m
            where m.left_at is null
          )
        ) stored
    $ddl$;
  end if;
end
$$;

create table if not exists public.live_stream_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

create table if not exists public.live_stream_removed (
  user_id uuid primary key references auth.users(id) on delete cascade,
  removed_at timestamptz not null default now()
);

create table if not exists public.live_stream_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  target_user uuid references auth.users(id) on delete set null,
  message_id bigint references public.live_messages(id) on delete set null,
  from_text text,
  to_text text
);

alter table public.live_stream_admins enable row level security;
alter table public.live_stream_removed enable row level security;
alter table public.live_stream_audit enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_stream_state'
      and policyname = 'live_stream_state_update_admin'
  ) then
    create policy live_stream_state_update_admin
      on public.live_stream_state
      for update
      using (
        exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_stream_admins'
      and policyname = 'live_stream_admins_select'
  ) then
    create policy live_stream_admins_select
      on public.live_stream_admins
      for select
      using (
        exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_stream_admins'
      and policyname = 'live_stream_admins_manage'
  ) then
    create policy live_stream_admins_manage
      on public.live_stream_admins
      for all
      using (
        exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_stream_removed'
      and policyname = 'live_stream_removed_select'
  ) then
    create policy live_stream_removed_select
      on public.live_stream_removed
      for select
      using (
        exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_stream_removed'
      and policyname = 'live_stream_removed_manage'
  ) then
    create policy live_stream_removed_manage
      on public.live_stream_removed
      for all
      using (
        exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_stream_audit'
      and policyname = 'live_stream_audit_select'
  ) then
    create policy live_stream_audit_select
      on public.live_stream_audit
      for select
      using (
        exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_stream_audit'
      and policyname = 'live_stream_audit_insert'
  ) then
    create policy live_stream_audit_insert
      on public.live_stream_audit
      for insert
      with check (
        exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      );
  end if;
end
$$;

create or replace function public.is_live_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.live_stream_admins a
    where a.user_id = coalesce(p_user, auth.uid())
  );
$$;

create or replace function public.live_stream_audit_message_update()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.text, '') is distinct from coalesce(old.text, '') then
    insert into public.live_stream_audit (
      actor,
      action,
      target_user,
      message_id,
      from_text,
      to_text
    )
    values (
      auth.uid(),
      'message_update',
      new.author_id,
      new.id,
      old.text,
      new.text
    );
  end if;
  return new;
end;
$$;

create or replace function public.live_stream_audit_message_delete()
returns trigger
language plpgsql
as $$
begin
  insert into public.live_stream_audit (
    actor,
    action,
    target_user,
    message_id,
    from_text,
    to_text
  )
  values (
    auth.uid(),
    'message_delete',
    old.author_id,
    old.id,
    old.text,
    null
  );
  return old;
end;
$$;

drop trigger if exists live_stream_messages_audit_update on public.live_messages;
create trigger live_stream_messages_audit_update
  after update on public.live_messages
  for each row
  when (coalesce(new.text, '') is distinct from coalesce(old.text, ''))
  execute function public.live_stream_audit_message_update();

drop trigger if exists live_stream_messages_audit_delete on public.live_messages;
create trigger live_stream_messages_audit_delete
  before delete on public.live_messages
  for each row
  execute function public.live_stream_audit_message_delete();

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where name = 'live_assets'
  ) then
    perform storage.create_bucket('live_assets', public => true);
  end if;
end
$$;

alter table storage.objects enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'live_assets_admin_manage'
  ) then
    create policy live_assets_admin_manage
      on storage.objects
      for all
      using (
        bucket_id = 'live_assets'
        and exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      )
      with check (
        bucket_id = 'live_assets'
        and exists (
          select 1
          from public.live_stream_admins a
          where a.user_id = auth.uid()
        )
      );
  end if;
end
$$;
