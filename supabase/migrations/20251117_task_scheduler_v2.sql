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
  category text not null default 'assignment'
    check (category in ('assignment','exam','project','habit','other')),
  due_date date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  estimated_minutes integer check (estimated_minutes >= 0),
  repeat_rule text not null default 'none'
    check (repeat_rule in ('none','daily','weekdays','custom_days')),
  repeat_days smallint[],
  repeat_until date,
  auto_planned boolean not null default false,
  auto_block_duration_min integer not null default 50
    check (auto_block_duration_min > 0),
  auto_daily_max_minutes integer not null default 240
    check (auto_daily_max_minutes > 0),
  auto_start_date date,
  auto_allowed_days smallint[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_items_schedule_valid check (
    scheduled_end is null
      or scheduled_start is null
      or scheduled_end > scheduled_start
  ),
  constraint task_items_repeat_days_valid check (
    repeat_days is null
      or repeat_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
  ),
  constraint task_items_auto_days_valid check (
    auto_allowed_days is null
      or auto_allowed_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
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
  event_kind text not null default 'manual'
    check (event_kind in ('manual','auto_plan')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_calendar_events_duration check (end_at > start_at)
);

create index if not exists task_calendar_events_user_idx
  on public.task_calendar_events (user_id, start_at desc);

drop index if exists task_calendar_events_task_unique;

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
