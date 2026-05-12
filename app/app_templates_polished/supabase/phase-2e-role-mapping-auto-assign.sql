-- FAZA 2E — production role mapping + auto-assign support
-- Run after phase-2C products/templates foundation.

alter table if exists public.workspace_members
add column if not exists production_role text;

alter table if exists public.workspace_invites
add column if not exists production_role text;

-- If your accept_workspace_invite RPC exists, update it so invited production_role is copied to workspace_members.
create or replace function public.accept_workspace_invite(invite_id uuid)
returns table(accepted_workspace_id uuid, accepted_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record record;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  current_email := lower(coalesce(auth.jwt()->>'email', ''));

  select wi.id, wi.workspace_id, wi.role, wi.hourly_rate, wi.full_name, wi.production_role
  into invite_record
  from public.workspace_invites wi
  where wi.id = invite_id
    and wi.status = 'pending'
    and lower(wi.email) = current_email
  limit 1;

  if invite_record.id is null then
    raise exception 'invite_not_found_or_wrong_email';
  end if;

  update public.profiles
  set full_name = coalesce(nullif(invite_record.full_name, ''), public.profiles.full_name),
      updated_at = now()
  where id = auth.uid();

  insert into public.workspace_members (workspace_id, user_id, role, status, hourly_rate, production_role, joined_at)
  values (invite_record.workspace_id, auth.uid(), invite_record.role, 'active', invite_record.hourly_rate, invite_record.production_role, now())
  on conflict (workspace_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    hourly_rate = excluded.hourly_rate,
    production_role = excluded.production_role,
    joined_at = coalesce(public.workspace_members.joined_at, excluded.joined_at);

  update public.workspace_invites wi
  set status = 'accepted'
  where wi.id = invite_record.id;

  return query
  select invite_record.workspace_id::uuid, invite_record.role::text;
end;
$$;

grant execute on function public.accept_workspace_invite(uuid) to authenticated;
