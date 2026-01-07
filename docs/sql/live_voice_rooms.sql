create table if not exists public.live_voice_rooms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text not null,
  title text not null,
  description text null,
  visibility text not null default 'public',
  status text not null default 'active',
  hms_room_id text not null,
  hms_room_name text not null,
  max_size int not null default 30
);

create index if not exists live_voice_rooms_status_visibility_created_at_idx
  on public.live_voice_rooms (status, visibility, created_at desc);

create index if not exists live_voice_rooms_created_by_created_at_idx
  on public.live_voice_rooms (created_by, created_at desc);
