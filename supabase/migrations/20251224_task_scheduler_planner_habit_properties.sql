-- Planner task + habit tracker property schema updates.

alter table public.task_items
  add column if not exists due_start_date date,
  add column if not exists due_end_date date;

update public.task_items
set status = case
  when status = 'done' then 'active'
  when status = 'active' then 'active'
  when status = 'planned' then 'planned'
  when status = 'in_progress' then 'in_progress'
  when status = 'not_started' then 'not_started'
  else 'planned'
end;

update public.task_items
set subject = case
  when subject is null then null
  when btrim(subject) = '' then null
  when lower(subject) = 'math' then 'math'
  when lower(subject) = 'ielts' then 'ielts'
  when lower(subject) = 'sat' then 'sat'
  when lower(subject) = 'other' then 'other'
  else 'other'
end;

update public.task_items
set resource_url = case
  when resource_url is null then null
  when btrim(resource_url) = '' then null
  when lower(resource_url) = 'telegram' then 'telegram'
  when lower(resource_url) in ('youtube', 'you tube', 'you-tube') then 'youtube'
  when lower(resource_url) = 'instagram' then 'instagram'
  when lower(resource_url) = 'other' then 'other'
  else 'other'
end;

update public.task_items
set estimated_minutes = null
where estimated_minutes is not null
  and estimated_minutes not in (30, 60, 90, 120, 180);

alter table public.task_items
  alter column status set default 'planned';

alter table public.task_items
  drop constraint if exists task_items_status_check,
  add constraint task_items_status_check
    check (status in ('planned', 'active', 'in_progress', 'not_started'));

alter table public.task_items
  drop constraint if exists task_items_due_range_check,
  add constraint task_items_due_range_check
    check (
      due_start_date is null
        or due_end_date is null
        or due_end_date >= due_start_date
    );

alter table public.task_items
  drop constraint if exists task_items_subject_check,
  add constraint task_items_subject_check
    check (subject is null or subject in ('math', 'ielts', 'sat', 'other'));

alter table public.task_items
  drop constraint if exists task_items_resource_check,
  add constraint task_items_resource_check
    check (
      resource_url is null
        or resource_url in ('telegram', 'youtube', 'instagram', 'other')
    );

alter table public.task_items
  drop constraint if exists task_items_estimate_check,
  add constraint task_items_estimate_check
    check (
      estimated_minutes is null
        or estimated_minutes in (30, 60, 90, 120, 180)
    );

update public.task_habits
set status = case
  when status = 'active' then 'active'
  when status = 'paused' then 'not_started'
  when status = 'planned' then 'planned'
  when status = 'in_progress' then 'in_progress'
  when status = 'not_started' then 'not_started'
  else 'planned'
end;

update public.task_habits
set resource_url = case
  when resource_url is null then null
  when btrim(resource_url) = '' then null
  when lower(resource_url) = 'telegram' then 'telegram'
  when lower(resource_url) in ('youtube', 'you tube', 'you-tube') then 'youtube'
  when lower(resource_url) = 'instagram' then 'instagram'
  when lower(resource_url) = 'other' then 'other'
  else 'other'
end;

update public.task_habits
set target = null;

alter table public.task_habits
  add column if not exists schedule_start_time integer,
  add column if not exists schedule_end_time integer;

alter table public.task_habits
  drop constraint if exists task_habits_target_check,
  alter column target type text using target::text,
  alter column schedule_start_time type integer using (
    case
      when schedule_start_time is null then null
      when schedule_start_time::text ~ '^\d+$' then
        case
          when schedule_start_time::int between 0 and 1439
            then schedule_start_time::int
          else null
        end
      when schedule_start_time::text ~ '^\d{1,2}:\d{2}' then
        case
          when split_part(schedule_start_time::text, ':', 1)::int between 0 and 23
            and split_part(schedule_start_time::text, ':', 2)::int between 0 and 59
            then
              split_part(schedule_start_time::text, ':', 1)::int * 60
              + split_part(schedule_start_time::text, ':', 2)::int
          else null
        end
      else null
    end
  ),
  alter column schedule_end_time type integer using (
    case
      when schedule_end_time is null then null
      when schedule_end_time::text ~ '^\d+$' then
        case
          when schedule_end_time::int between 0 and 1439
            then schedule_end_time::int
          else null
        end
      when schedule_end_time::text ~ '^\d{1,2}:\d{2}' then
        case
          when split_part(schedule_end_time::text, ':', 1)::int between 0 and 23
            and split_part(schedule_end_time::text, ':', 2)::int between 0 and 59
            then
              split_part(schedule_end_time::text, ':', 1)::int * 60
              + split_part(schedule_end_time::text, ':', 2)::int
          else null
        end
      else null
    end
  ),
  alter column status set default 'planned';

alter table public.task_habits
  drop constraint if exists task_habits_status_check,
  add constraint task_habits_status_check
    check (status in ('planned', 'active', 'in_progress', 'not_started'));

alter table public.task_habits
  drop constraint if exists task_habits_target_check,
  add constraint task_habits_target_check
    check (target is null or target in ('health', 'fitness', 'study', 'other'));

alter table public.task_habits
  drop constraint if exists task_habits_resource_check,
  add constraint task_habits_resource_check
    check (
      resource_url is null
        or resource_url in ('telegram', 'youtube', 'instagram', 'other')
    );

alter table public.task_habits
  drop constraint if exists task_habits_schedule_time_check,
  add constraint task_habits_schedule_time_check
    check (
      (schedule_start_time is null
        or (schedule_start_time >= 0 and schedule_start_time <= 1439))
      and (schedule_end_time is null
        or (schedule_end_time >= 0 and schedule_end_time <= 1439))
      and (
        schedule_start_time is null
          or schedule_end_time is null
          or schedule_end_time > schedule_start_time
      )
    );

alter table public.task_habit_completions
  add column if not exists value text not null default 'yes';

alter table public.task_habit_completions
  drop constraint if exists task_habit_completions_value_check,
  add constraint task_habit_completions_value_check
    check (value in ('yes', 'no'));
