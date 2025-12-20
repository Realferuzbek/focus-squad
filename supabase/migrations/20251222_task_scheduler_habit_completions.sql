-- Task Scheduler habit completions.
create table if not exists public.task_habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  habit_id text not null,
  date_key text not null,
  completed_at timestamptz not null default now(),
  unique (user_id, habit_id, date_key)
);

create index if not exists task_habit_completions_user_date_idx
  on public.task_habit_completions (user_id, date_key desc);

create index if not exists task_habit_completions_user_habit_idx
  on public.task_habit_completions (user_id, habit_id, date_key desc);

alter table public.task_habit_completions enable row level security;

do $$
begin
  if not exists(
     select 
    from pg_policies
    where schemaname = 'public'
      and tablename = 'task_habit_completions'
      and policyname = 'task_habit_completions_owner'
  ) then
    create policy task_habit_completions_owner on public.task_habit_completions
      for all using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
