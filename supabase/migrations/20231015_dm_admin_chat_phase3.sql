create table if not exists public.dm_audit (
  id bigserial primary key,
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  action text not null check (action in (
    'message_create','message_edit','message_delete_soft','message_delete_hard',
    'role_promote','role_demote','thread_meta','subscribe_push','unsubscribe_push'
  )),
  target_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dm_audit_thread_created_idx
  on public.dm_audit(thread_id, created_at desc);

create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.dm_audit enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists(
    select 1
    from pg_policies
    where tablename = 'dm_audit'
      and policyname = 'dm_audit_view'
  ) then
    create policy dm_audit_view on public.dm_audit for select using (
      exists (
        select 1
        from public.dm_participants p
        where p.thread_id = dm_audit.thread_id
          and p.user_id = auth.uid()
          and p.role = 'dm_admin'
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists(
    select 1
    from pg_policies
    where tablename = 'push_subscriptions'
      and policyname = 'push_self_all'
  ) then
    create policy push_self_all on public.push_subscriptions
      for all using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
