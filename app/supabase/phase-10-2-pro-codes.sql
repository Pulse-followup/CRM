create table if not exists public.pro_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  status text not null default 'active',
  max_activations integer not null default 1,
  used_count integer not null default 0,
  assigned_email text,
  assigned_workspace_id uuid references public.workspaces(id) on delete set null,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  activated_by_user_id uuid references public.profiles(id) on delete set null,
  activated_workspace_id uuid references public.workspaces(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pro_codes_status_check check (status in ('active', 'used', 'expired', 'revoked')),
  constraint pro_codes_max_activations_check check (max_activations > 0),
  constraint pro_codes_used_count_check check (used_count >= 0)
);

alter table public.pro_codes enable row level security;

create or replace function public.activate_pro_code(p_code text, p_workspace_id uuid)
returns table (
  activated_workspace_id uuid,
  activated_plan_type text,
  activated_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_membership record;
  v_code public.pro_codes%rowtype;
begin
  if v_user_id is null then
    raise exception 'Morate biti ulogovani.';
  end if;

  if p_workspace_id is null then
    raise exception 'Workspace nije izabran.';
  end if;

  select p.email
  into v_user_email
  from public.profiles p
  where p.id = v_user_id
  limit 1;

  select wm.*
  into v_membership
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = v_user_id
    and wm.status = 'active'
    and wm.role = 'admin'
  limit 1;

  if not found then
    raise exception 'Samo admin workspace-a može aktivirati PRO kod.';
  end if;

  select *
  into v_code
  from public.pro_codes
  where upper(code) = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'PRO kod nije validan.';
  end if;

  if v_code.status = 'revoked' then
    raise exception 'PRO kod je opozvan.';
  end if;

  if v_code.status = 'expired' then
    raise exception 'PRO kod je istekao.';
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    update public.pro_codes
    set status = 'expired',
        updated_at = now()
    where id = v_code.id;
    raise exception 'PRO kod je istekao.';
  end if;

  if v_code.assigned_email is not null and lower(trim(v_code.assigned_email)) <> lower(coalesce(v_user_email, '')) then
    raise exception 'PRO kod nije dodeljen ovom korisniku.';
  end if;

  if v_code.assigned_workspace_id is not null and v_code.assigned_workspace_id <> p_workspace_id then
    raise exception 'PRO kod nije namenjen ovom workspace-u.';
  end if;

  if v_code.used_count >= v_code.max_activations or v_code.status = 'used' then
    raise exception 'PRO kod je već iskorišćen.';
  end if;

  update public.workspaces
  set plan_type = 'PRO',
      updated_at = now()
  where id = p_workspace_id;

  update public.pro_codes
  set used_count = used_count + 1,
      status = case
        when used_count + 1 >= max_activations then 'used'
        else 'active'
      end,
      activated_by_user_id = v_user_id,
      activated_workspace_id = p_workspace_id,
      updated_at = now()
  where id = v_code.id;

  return query
  select p_workspace_id, 'PRO'::text, v_code.code;
end;
$$;

create or replace function public.issue_pro_code(
  p_label text default null,
  p_assigned_email text default null,
  p_assigned_workspace_id uuid default null,
  p_expires_at timestamptz default null,
  p_max_activations integer default 1
)
returns table (
  id uuid,
  code text,
  label text,
  status text,
  assigned_email text,
  assigned_workspace_id uuid,
  expires_at timestamptz,
  max_activations integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_exists boolean := true;
  v_try integer := 0;
  v_inserted public.pro_codes%rowtype;
begin
  if p_max_activations is null or p_max_activations < 1 then
    raise exception 'max_activations mora biti najmanje 1.';
  end if;

  while v_exists and v_try < 20 loop
    v_try := v_try + 1;
    v_code :=
      'PULSE-PRO-' ||
      substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 4) || '-' ||
      substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 4) || '-' ||
      substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 4);

    select exists(select 1 from public.pro_codes pc where pc.code = v_code) into v_exists;
  end loop;

  if v_exists then
    raise exception 'Nije moguće generisati jedinstven PRO kod.';
  end if;

  insert into public.pro_codes (
    code,
    label,
    assigned_email,
    assigned_workspace_id,
    expires_at,
    max_activations,
    created_by_user_id
  )
  values (
    v_code,
    nullif(trim(coalesce(p_label, '')), ''),
    nullif(lower(trim(coalesce(p_assigned_email, ''))), ''),
    p_assigned_workspace_id,
    p_expires_at,
    p_max_activations,
    auth.uid()
  )
  returning *
  into v_inserted;

  return query
  select
    v_inserted.id,
    v_inserted.code,
    v_inserted.label,
    v_inserted.status,
    v_inserted.assigned_email,
    v_inserted.assigned_workspace_id,
    v_inserted.expires_at,
    v_inserted.max_activations;
end;
$$;

grant execute on function public.activate_pro_code(text, uuid) to authenticated;
revoke all on function public.issue_pro_code(text, text, uuid, timestamptz, integer) from public;
revoke all on table public.pro_codes from public;
