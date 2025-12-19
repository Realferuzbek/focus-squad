alter table public.task_calendar_events
  add column if not exists recurrence jsonb;
