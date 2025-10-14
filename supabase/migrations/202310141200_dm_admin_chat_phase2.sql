create extension if not exists pg_trgm;

alter table public.dm_messages
  add column if not exists file_url text,
  add column if not exists file_mime text,
  add column if not exists file_bytes int,
  add column if not exists edited_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dm_messages_kind_check'
  ) then
    alter table public.dm_messages
      add constraint dm_messages_kind_check
      check (kind in ('text','image','video','audio','file','system'));
  end if;
end
$$;

create index if not exists dm_messages_text_trgm
  on public.dm_messages
  using gin (text gin_trgm_ops);

alter table public.dm_threads
  add column if not exists avatar_url text,
  add column if not exists wallpaper_url text,
  add column if not exists description text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dm_threads_description_words_chk'
  ) then
    alter table public.dm_threads
      add constraint dm_threads_description_words_chk
      check (
        description is null
        or array_length(
          regexp_split_to_array(
            trim(description),
            '\s+'
          ),
          1
        ) <= 40
      );
  end if;
end
$$;
