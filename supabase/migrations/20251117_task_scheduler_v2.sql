-- Task Scheduler persistence for private lists, student tasks, and calendar events.
create table if not exists public.task_private_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  kind text not null default 'page' check (kind in ('page','task_list')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_private_items_user_idx
  on public.task_private_items (user_id, created_at desc);

create table if not exists public.task_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  private_item_id uuid not null references public.task_private_items(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','done')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high')),
  category text,
  due_date date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  estimated_minutes integer check (estimated_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_items_schedule_valid check (
    scheduled_end is null
      or scheduled_start is null
      or scheduled_end > scheduled_start
  )
);

create index if not exists task_items_user_private_idx
  on public.task_items (user_id, private_item_id, created_at desc);

create index if not exists task_items_schedule_idx
  on public.task_items (user_id, scheduled_start desc nulls last);

create table if not exists public.task_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  task_id uuid references public.task_items(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_calendar_events_duration check (end_at > start_at)
);

create index if not exists task_calendar_events_user_idx
  on public.task_calendar_events (user_id, start_at desc);

create unique index if not exists task_calendar_events_task_unique
  on public.task_calendar_events (task_id)
  where task_id is not null;

create or replace function public.touch_task_scheduler_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'task_private_items_touch'
  ) then
    create trigger task_private_items_touch
    before update on public.task_private_items
    for each row execute function public.touch_task_scheduler_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'task_items_touch'
  ) then
    create trigger task_items_touch
    before update on public.task_items
    for each row execute function public.touch_task_scheduler_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'task_calendar_events_touch'
  ) then
    create trigger task_calendar_events_touch
    before update on public.task_calendar_events
    for each row execute function public.touch_task_scheduler_updated_at();
  end if;
end;
$$;

alter table public.task_private_items enable row level security;
alter table public.task_items enable row level security;
alter table public.task_calendar_events enable row level security;
