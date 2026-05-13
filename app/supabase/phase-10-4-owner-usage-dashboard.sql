drop policy if exists "usage_events_insert_authenticated" on public.usage_events;

create policy "usage_events_insert_client"
  on public.usage_events
  for insert
  to authenticated, anon
  with check (
    (
      auth.role() = 'authenticated'
      and (user_id is null or user_id = auth.uid())
      and (
        workspace_id is null
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = usage_events.workspace_id
            and wm.user_id = auth.uid()
        )
      )
    )
    or
    (
      auth.role() = 'anon'
      and workspace_id is null
      and user_id is null
      and event_type in ('app_opened', 'demo_opened')
    )
  );

create or replace function public.owner_usage_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if v_email <> 'dragan@retailmediacenter.com' then
    raise exception 'Nemate pristup owner usage podacima.';
  end if;

  return jsonb_build_object(
    'workspaces', jsonb_build_object(
      'total', (select count(*) from public.workspaces),
      'new7d', (select count(*) from public.workspaces where created_at >= now() - interval '7 days'),
      'new30d', (select count(*) from public.workspaces where created_at >= now() - interval '30 days'),
      'older', (select count(*) from public.workspaces where created_at < now() - interval '30 days')
    ),
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'new7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
      'new30d', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
      'older', (select count(*) from public.profiles where created_at < now() - interval '30 days')
    ),
    'clients', jsonb_build_object(
      'total', (select count(*) from public.clients),
      'new7d', (select count(*) from public.clients where created_at >= now() - interval '7 days'),
      'new30d', (select count(*) from public.clients where created_at >= now() - interval '30 days'),
      'older', (select count(*) from public.clients where created_at < now() - interval '30 days')
    ),
    'products', jsonb_build_object(
      'total', (select count(*) from public.products),
      'new7d', (select count(*) from public.products where created_at >= now() - interval '7 days'),
      'new30d', (select count(*) from public.products where created_at >= now() - interval '30 days'),
      'older', (select count(*) from public.products where created_at < now() - interval '30 days')
    ),
    'tasks', jsonb_build_object(
      'total', (select count(*) from public.tasks),
      'new7d', (select count(*) from public.tasks where created_at >= now() - interval '7 days'),
      'new30d', (select count(*) from public.tasks where created_at >= now() - interval '30 days'),
      'older', (select count(*) from public.tasks where created_at < now() - interval '30 days')
    )
  );
end;
$$;
