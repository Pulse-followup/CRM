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
