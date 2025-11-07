create table if not exists public.dm_audit (
  id bigserial,
  thread_id uuid not null,
  actor_id uuid,
  action text not null,
  target_id uuid,
  meta jsonb,
  created_at timestamptz not null default now(),
  constraint dm_audit_pkey primary key (id),
  constraint dm_audit_thread_id_fkey foreign key (thread_id) references public.dm_threads(id) on delete cascade,
  constraint dm_audit_actor_id_fkey foreign key (actor_id) references public.users(id) on delete set null,
  constraint dm_audit_action_check check (action in (
    'message_create','message_edit','message_delete_soft','message_delete_hard',
    'role_promote','role_demote','thread_meta','subscribe_push','unsubscribe_push'
  ))
);

create index if not exists dm_audit_thread_created_idx
  on public.dm_audit(thread_id, created_at desc);

create table if not exists public.push_subscriptions (
  id bigserial,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade,
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists push_subscriptions_user_created_idx on public.push_subscriptions(user_id, created_at desc);

alter table public.dm_audit enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dm_audit'
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
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'push_self_all'
  ) then
    create policy push_self_all on public.push_subscriptions
      for all using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

-- Documentation comments for maintainers and auditors
comment on table public.dm_audit is 'Audit table for DM operations. RLS enabled; dm_audit_view policy grants SELECT to dm_admin participants.';
comment on column public.dm_audit.meta is 'Free-form JSON metadata for the audit event; avoid storing secrets.';
comment on table public.push_subscriptions is 'Push subscription storage. endpoint is unique globally; secrets stored in p256dh/auth fields.';
