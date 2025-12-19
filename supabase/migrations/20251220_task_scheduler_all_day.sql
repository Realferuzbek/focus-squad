alter table public.task_calendar_events
  add column if not exists is_all_day boolean not null default false;
