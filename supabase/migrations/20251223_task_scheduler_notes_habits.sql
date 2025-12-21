-- Notes inbox, list templates, and habit tracker tables.
alter table public.task_private_items
  add column if not exists list_type text not null default 'planner_tasks'
    check (list_type in ('planner_tasks', 'habit_tracker')),
  add column if not exists hidden_columns text[] not null default '{}'::text[];

create index if not exists task_private_items_user_list_type_idx
  on public.task_private_items (user_id, list_type, created_at desc);

alter table public.task_items
  add column if not exists subject text,
  add column if not exists resource_url text,
  add column if not exists due_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists task_items_user_list_due_at_idx
  on public.task_items (user_id, private_item_id, due_at);

create index if not exists task_items_user_list_completed_idx
  on public.task_items (user_id, private_item_id, completed_at desc);

create table if not exists public.task_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  text text not null,
  pinned boolean not null default false,
  converted_task_id uuid references public.task_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_notes_user_created_idx
  on public.task_notes (user_id, created_at desc);

create index if not exists task_notes_user_pinned_idx
  on public.task_notes (user_id, pinned, created_at desc);

create table if not exists public.task_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  private_item_id uuid not null references public.task_private_items(id) on delete cascade,
  name text not null,
  schedule_type text not null default 'daily'
    check (schedule_type in ('daily', 'weekdays', 'custom')),
  schedule_days smallint[]
    check (
      schedule_days is null
      or schedule_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
    ),
  status text not null default 'active'
    check (status in ('active', 'paused')),
  target integer check (target >= 0),
  notes text,
  resource_url text,
  start_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_habits_user_list_idx
  on public.task_habits (user_id, private_item_id, created_at desc);

create index if not exists task_habits_user_status_idx
  on public.task_habits (user_id, status);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'task_notes_touch'
  ) then
    create trigger task_notes_touch
    before update on public.task_notes
    for each row execute function public.touch_task_scheduler_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'task_habits_touch'
  ) then
    create trigger task_habits_touch
    before update on public.task_habits
    for each row execute function public.touch_task_scheduler_updated_at();
  end if;
end;
$$;

alter table public.task_notes enable row level security;
alter table public.task_habits enable row level security;

do $$
begin
  if not exists(
    select
    from pg_policies
    where schemaname = 'public'
      and tablename = 'task_notes'
      and policyname = 'task_notes_owner'
  ) then
    create policy task_notes_owner on public.task_notes
      for all using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists(
    select
    from pg_policies
    where schemaname = 'public'
      and tablename = 'task_habits'
      and policyname = 'task_habits_owner'
  ) then
    create policy task_habits_owner on public.task_habits
      for all using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;
