-- Add password auth support for users

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'password_hash'
  ) then
    alter table public.users
      add column password_hash text;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'users_email_lower_idx'
  ) then
    create unique index users_email_lower_idx
      on public.users (lower(email));
  end if;
end
$$;
