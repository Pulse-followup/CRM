create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspaces(id) on delete set null,
  user_id uuid null references public.profiles(id) on delete set null,
  user_email text null,
  event_type text not null,
  entity_type text null,
  entity_id text null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_created_at_idx on public.usage_events (created_at desc);
create index if not exists usage_events_workspace_id_idx on public.usage_events (workspace_id);
create index if not exists usage_events_user_id_idx on public.usage_events (user_id);
create index if not exists usage_events_event_type_idx on public.usage_events (event_type);

alter table public.usage_events enable row level security;

drop policy if exists "usage_events_insert_authenticated" on public.usage_events;
create policy "usage_events_insert_authenticated"
  on public.usage_events
  for insert
  to authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and (
      workspace_id is null
      or exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = usage_events.workspace_id
          and wm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "usage_events_select_platform_owner" on public.usage_events;
create policy "usage_events_select_platform_owner"
  on public.usage_events
  for select
  to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'dragan@retailmediacenter.com'
  );
