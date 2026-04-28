drop policy if exists "profiles_select_workspace_peers" on public.profiles;

create policy "profiles_select_workspace_peers"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members me
    join public.workspace_members peer
      on peer.workspace_id = me.workspace_id
    where me.user_id = auth.uid()
      and me.status = 'active'
      and peer.user_id = profiles.id
      and peer.status = 'active'
  )
);
