create or replace function public.owner_usage_entities(
  p_entity text,
  p_days integer default null
)
returns table (
  entity_kind text,
  entity_id text,
  primary_label text,
  secondary_label text,
  status_label text,
  workspace_label text,
  created_at timestamptz
)
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

  if p_entity = 'workspaces' then
    return query
    select
      'workspaces'::text,
      w.id::text,
      coalesce(w.name, 'Workspace'),
      coalesce(w.plan_type, 'FREE')::text,
      'workspace'::text,
      '-'::text,
      w.created_at
    from public.workspaces w
    where p_days is null or w.created_at >= now() - make_interval(days => p_days)
    order by w.created_at desc
    limit 100;
  elsif p_entity = 'users' then
    return query
    select
      'users'::text,
      p.id::text,
      coalesce(nullif(trim(coalesce(p.full_name, '')), ''), p.email, 'User'),
      coalesce(p.email, '-')::text,
      'user'::text,
      '-'::text,
      p.created_at
    from public.profiles p
    where p_days is null or p.created_at >= now() - make_interval(days => p_days)
    order by p.created_at desc
    limit 100;
  elsif p_entity = 'clients' then
    return query
    select
      'clients'::text,
      c.id::text,
      coalesce(c.name, 'Klijent'),
      coalesce(c.client_city, '-')::text,
      'client'::text,
      coalesce(w.name, '-')::text,
      c.created_at
    from public.clients c
    left join public.workspaces w on w.id = c.workspace_id
    where p_days is null or c.created_at >= now() - make_interval(days => p_days)
    order by c.created_at desc
    limit 100;
  elsif p_entity = 'products' then
    return query
    select
      'products'::text,
      pr.id::text,
      coalesce(pr.title, 'Proizvod'),
      coalesce(pr.category, '-')::text,
      case when pr.is_active = false then 'archived' else 'active' end::text,
      coalesce(w.name, '-')::text,
      pr.created_at
    from public.products pr
    left join public.workspaces w on w.id = pr.workspace_id
    where p_days is null or pr.created_at >= now() - make_interval(days => p_days)
    order by pr.created_at desc
    limit 100;
  elsif p_entity = 'tasks' then
    return query
    select
      'tasks'::text,
      t.id::text,
      coalesce(t.title, 'Task'),
      coalesce(t.assigned_to_label, '-')::text,
      coalesce(t.status, '-')::text,
      coalesce(w.name, '-')::text,
      t.created_at
    from public.tasks t
    left join public.workspaces w on w.id = t.workspace_id
    where p_days is null or t.created_at >= now() - make_interval(days => p_days)
    order by t.created_at desc
    limit 100;
  else
    raise exception 'Nepoznat entity tip: %', p_entity;
  end if;
end;
$$;
