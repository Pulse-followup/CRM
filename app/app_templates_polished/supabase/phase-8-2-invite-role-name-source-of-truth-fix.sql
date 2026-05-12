-- FAZA 8.2 — Invite role/name source of truth final fix
-- Run this in Supabase SQL editor.
-- Purpose:
-- 1) Invited users keep the role from workspace_invites, not default admin.
-- 2) Invited users keep the invited display name, hourly rate and production role.
-- 3) Already accepted/broken invites can be re-synced safely.

alter table if exists public.workspace_members
add column if not exists production_role text;

alter table if exists public.workspace_members
add column if not exists display_name text;

alter table if exists public.workspace_invites
add column if not exists production_role text;

create or replace function public.accept_workspace_invite(invite_id uuid)
returns table(accepted_workspace_id uuid, accepted_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record record;
  current_email text;
  clean_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  current_email := lower(coalesce(auth.jwt()->>'email', ''));

  select wi.id,
         wi.workspace_id,
         wi.role,
         wi.hourly_rate,
         wi.full_name,
         wi.production_role,
         wi.status
  into invite_record
  from public.workspace_invites wi
  where wi.id = invite_id
    and wi.status in ('pending', 'accepted')
    and lower(wi.email) = current_email
  limit 1;

  if invite_record.id is null then
    raise exception 'invite_not_found_or_wrong_email';
  end if;

  clean_name := nullif(btrim(coalesce(invite_record.full_name, '')), '');

  insert into public.profiles (id, email, full_name, updated_at)
  values (auth.uid(), current_email, coalesce(clean_name, current_email), now())
  on conflict (id)
  do update set
    email = excluded.email,
    full_name = coalesce(clean_name, public.profiles.full_name, excluded.email),
    updated_at = now();

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    status,
    hourly_rate,
    production_role,
    display_name,
    joined_at
  )
  values (
    invite_record.workspace_id,
    auth.uid(),
    invite_record.role,
    'active',
    invite_record.hourly_rate,
    invite_record.production_role,
    clean_name,
    now()
  )
  on conflict (workspace_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    hourly_rate = excluded.hourly_rate,
    production_role = excluded.production_role,
    display_name = coalesce(excluded.display_name, public.workspace_members.display_name),
    joined_at = coalesce(public.workspace_members.joined_at, excluded.joined_at);

  update public.workspace_invites wi
  set status = 'accepted'
  where wi.id = invite_record.id;

  return query
  select invite_record.workspace_id::uuid, invite_record.role::text;
end;
$$;

grant execute on function public.accept_workspace_invite(uuid) to authenticated;
