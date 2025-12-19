-- Task Scheduler calendars and calendar event notes.
create table if not exists public.task_calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  color text not null,
  is_default boolean not null default false,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_calendars_user_created_idx
  on public.task_calendars (user_id, created_at desc);

create index if not exists task_calendars_user_sort_idx
  on public.task_calendars (user_id, sort_order asc);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'task_calendars_touch'
  ) then
    create trigger task_calendars_touch
    before update on public.task_calendars
    for each row execute function public.touch_task_scheduler_updated_at();
  end if;
end;
$$;

alter table public.task_calendars enable row level security;

alter table public.task_calendar_events
  add column if not exists calendar_id uuid references public.task_calendars(id) on delete set null,
  add column if not exists description text;
