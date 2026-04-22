-- Run once in Supabase SQL Editor.
-- Allows a user with a pending invite link/email to activate their own membership.
-- This migration is intentionally idempotent.

create or replace function public.has_pending_workspace_invite(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_invites wi
    where wi.workspace_id = target_workspace
      and wi.status = 'pending'
      and lower(wi.email) = lower(coalesce(auth.jwt()->>'email', auth.email(), ''))
  );
$$;

create or replace function public.accept_workspace_invite(invite_id uuid)
returns table(accepted_workspace_id uuid, accepted_role text)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  invite_record record;
  current_email text;
  normalized_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  current_email := lower(coalesce(auth.jwt()->>'email', auth.email(), ''));

  if current_email = '' then
    raise exception 'missing_auth_email';
  end if;

  select wi.id, wi.workspace_id, wi.role, wi.email
  into invite_record
  from public.workspace_invites wi
  where wi.id = invite_id
    and wi.status = 'pending'
    and lower(wi.email) = current_email
  limit 1;

  if invite_record.id is null then
    raise exception 'invite_not_found_or_wrong_email';
  end if;

  normalized_role := case
    when lower(invite_record.role) in ('finance', 'finansije') then 'finance'
    when lower(invite_record.role) = 'admin' then 'admin'
    else 'member'
  end;

  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  values (invite_record.workspace_id, auth.uid(), normalized_role, 'active', now())
  on conflict (workspace_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    joined_at = coalesce(public.workspace_members.joined_at, excluded.joined_at);

  update public.workspace_invites wi
  set status = 'accepted'
  where wi.id = invite_record.id;

  return query
  select invite_record.workspace_id::uuid, normalized_role::text;
end;
$$;

grant execute on function public.accept_workspace_invite(uuid) to authenticated;

drop policy if exists "workspace_members_insert_self_from_pending_invite" on public.workspace_members;
create policy "workspace_members_insert_self_from_pending_invite"
on public.workspace_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'active'
  and role in ('admin', 'finance', 'member')
  and exists (
    select 1
    from public.workspace_invites wi
    where wi.workspace_id = workspace_members.workspace_id
      and wi.status = 'pending'
      and lower(wi.email) = lower(coalesce(auth.jwt()->>'email', auth.email(), ''))
      and (
        wi.role = workspace_members.role
        or (lower(wi.role) = 'finansije' and workspace_members.role = 'finance')
      )
  )
);

drop policy if exists "workspace_members_update_self_from_pending_invite" on public.workspace_members;
create policy "workspace_members_update_self_from_pending_invite"
on public.workspace_members
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_invites wi
    where wi.workspace_id = workspace_members.workspace_id
      and wi.status = 'pending'
      and lower(wi.email) = lower(coalesce(auth.jwt()->>'email', auth.email(), ''))
  )
)
with check (
  user_id = auth.uid()
  and status = 'active'
  and role in ('admin', 'finance', 'member')
);

drop policy if exists "workspace_members_insert_owner_or_admin" on public.workspace_members;
create policy "workspace_members_insert_owner_or_admin"
on public.workspace_members
for insert
to authenticated
with check (
  (
    user_id = auth.uid()
    and role = 'admin'
    and status in ('invited', 'active')
    and exists (
      select 1
      from public.workspaces w
      where w.id = workspace_id
        and w.owner_user_id = auth.uid()
    )
  )
  or public.is_workspace_admin(workspace_id)
  or (
    user_id = auth.uid()
    and status = 'active'
    and exists (
      select 1
      from public.workspace_invites wi
      where wi.workspace_id = workspace_members.workspace_id
        and wi.status = 'pending'
        and lower(wi.email) = lower(coalesce(auth.jwt()->>'email', auth.email(), ''))
        and (
          wi.role = workspace_members.role
          or (lower(wi.role) = 'finansije' and workspace_members.role = 'finance')
        )
    )
  )
);
