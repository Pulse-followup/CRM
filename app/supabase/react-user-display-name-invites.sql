-- PULSE MVP - user display names for workspace invites
-- Run after workspace foundation if your DB already exists.

alter table if exists public.workspace_invites add column if not exists full_name text;

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

  select wi.id, wi.workspace_id, wi.role, wi.hourly_rate, wi.full_name
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

  insert into public.workspace_members (workspace_id, user_id, role, status, hourly_rate, joined_at)
  values (invite_record.workspace_id, auth.uid(), invite_record.role, 'active', invite_record.hourly_rate, now())
  on conflict (workspace_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    hourly_rate = excluded.hourly_rate,
    joined_at = coalesce(public.workspace_members.joined_at, excluded.joined_at);

  update public.workspace_invites wi
  set status = 'accepted'
  where wi.id = invite_record.id;

  return query
  select invite_record.workspace_id::uuid, invite_record.role::text;
end;
$$;

grant execute on function public.accept_workspace_invite(uuid) to authenticated;
