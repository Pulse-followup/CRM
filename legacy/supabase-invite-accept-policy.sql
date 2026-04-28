-- Run once in Supabase SQL Editor.
-- Allows a user with a pending invite link/email to activate their own membership.

create or replace function public.has_pending_workspace_invite(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_invites wi
    where wi.workspace_id = target_workspace
      and wi.status = 'pending'
      and lower(wi.email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

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

  select wi.id, wi.workspace_id, wi.role
  into invite_record
  from public.workspace_invites wi
  where wi.id = invite_id
    and wi.status = 'pending'
    and lower(wi.email) = current_email
  limit 1;

  if invite_record.id is null then
    raise exception 'invite_not_found_or_wrong_email';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  values (invite_record.workspace_id, auth.uid(), invite_record.role, 'active', now())
  on conflict (workspace_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    joined_at = coalesce(public.workspace_members.joined_at, excluded.joined_at);

  update public.workspace_invites wi
  set status = 'accepted'
  where wi.id = invite_record.id;

  return query
  select invite_record.workspace_id::uuid, invite_record.role::text;
end;
$$;

grant execute on function public.accept_workspace_invite(uuid) to authenticated;

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
        and lower(wi.email) = lower(coalesce(auth.jwt()->>'email', ''))
        and wi.role = workspace_members.role
    )
  )
);
