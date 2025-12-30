-- Allow public read of the AI chat flag for status checks
alter table public.feature_flags enable row level security;

drop policy if exists feature_flags_read_ai_chat_enabled
  on public.feature_flags;

create policy feature_flags_read_ai_chat_enabled
  on public.feature_flags
  for select
  using (key = 'ai_chat_enabled');
