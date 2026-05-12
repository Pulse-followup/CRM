create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'web',
  device_label text null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, recipient_user_id, token)
);

create index if not exists device_tokens_workspace_recipient_idx
  on public.device_tokens (workspace_id, recipient_user_id, revoked_at);

create index if not exists device_tokens_token_idx
  on public.device_tokens (token);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_select_own" on public.device_tokens;
create policy "device_tokens_select_own"
  on public.device_tokens
  for select
  to authenticated
  using (recipient_user_id = auth.uid());

drop policy if exists "device_tokens_insert_own" on public.device_tokens;
create policy "device_tokens_insert_own"
  on public.device_tokens
  for insert
  to authenticated
  with check (recipient_user_id = auth.uid());

drop policy if exists "device_tokens_update_own" on public.device_tokens;
create policy "device_tokens_update_own"
  on public.device_tokens
  for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());
